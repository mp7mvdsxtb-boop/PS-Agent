const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { getVisionConfig, callVision } = require('./vision');
const { PNG } = require('pngjs');

// 图片缩小到最长边 maxDim 以内，减少视觉模型 token 消耗
function downscaleImage(base64, maxDim = 768) {
    try {
        const png = PNG.sync.read(Buffer.from(base64, 'base64'));
        const { width, height } = png;
        if (width <= maxDim && height <= maxDim) return base64;
        const scale = maxDim / Math.max(width, height);
        const newW = Math.max(1, Math.round(width * scale));
        const newH = Math.max(1, Math.round(height * scale));
        const result = new PNG({ width: newW, height: newH });
        for (let y = 0; y < newH; y++) {
            const srcY = Math.min(height - 1, Math.floor((y + 0.5) / scale));
            for (let x = 0; x < newW; x++) {
                const srcX = Math.min(width - 1, Math.floor((x + 0.5) / scale));
                const si = (width * srcY + srcX) << 2;
                const di = (newW * y + x) << 2;
                result.data[di] = png.data[si];
                result.data[di + 1] = png.data[si + 1];
                result.data[di + 2] = png.data[si + 2];
                result.data[di + 3] = png.data[si + 3];
            }
        }
        return PNG.sync.write(result).toString('base64');
    } catch (e) {
        return base64;
    }
}

const PHOTOSHOP_MCP_ENTRY = path.join(__dirname, 'node_modules', '@alisaitteke', 'photoshop-mcp', 'dist', 'index.js');
const TEMP_DIR = path.join(__dirname, 'temp');
// 会话文件由 photoshop-mcp-ui 写入，位置在 ~/.photoshop-mcp/
const SESSION_FILE = path.join(os.homedir(), '.photoshop-mcp', 'ui-session.json');

let mcpClient = null;

// ---------- MCP 客户端（用于导出当前PS文档） ----------
async function connectMCP() {
    if (mcpClient) return mcpClient;
    if (!fs.existsSync(PHOTOSHOP_MCP_ENTRY)) {
        throw new Error('photoshop-mcp 未找到，请先运行 npm install');
    }
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [PHOTOSHOP_MCP_ENTRY],
        env: { ...process.env, LOG_LEVEL: '2' },
        stderr: 'pipe'
    });
    const client = new Client({ name: 'psmcp-loop', version: '1.0.0' });
    await client.connect(transport);
    mcpClient = client;
    return client;
}

async function callToolWithTimeout(client, name, args, timeoutMs = 30000) {
    return Promise.race([
        client.callTool({ name, arguments: args }),
        new Promise((_, reject) => setTimeout(() => reject(new Error(name + ' 超时')), timeoutMs))
    ]);
}

async function captureImage() {
    const client = await connectMCP();
    // 先检查PS是否连接
    try {
        const ping = await callToolWithTimeout(client, 'photoshop_ping', {}, 8000);
        const pingText = typeof ping.content === 'string' ? ping.content : ping.content?.map(c => c.text || '').join('');
        if (!/successfully|connected/i.test(pingText)) {
            throw new Error('Photoshop 未连接，请先打开 Photoshop 并载入图片');
        }
    } catch (e) {
        if (e.message.includes('未连接')) throw e;
        throw new Error('Photoshop 未连接，请先打开 Photoshop 并载入图片');
    }
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
    const filePath = path.join(TEMP_DIR, `current-${Date.now()}.png`);
    const result = await callToolWithTimeout(client, 'photoshop_export_as', { path: filePath, format: 'PNG' }, 30000);
    const text = typeof result.content === 'string'
        ? result.content
        : result.content?.map(c => c.text || '').join('');
    if (text.includes('"ok":false') || /fail/i.test(text)) {
        throw new Error('导出失败: ' + text.slice(0, 200));
    }
    if (!fs.existsSync(filePath)) {
        throw new Error('导出失败：未生成文件');
    }
    const base64 = fs.readFileSync(filePath).toString('base64');
    const downscaled = downscaleImage(base64, 768);
    return { base64: downscaled, filePath, mimeType: 'image/png' };
}

// ---------- 分场景审美标准 ----------
const SCENE_CRITERIA = {
    '通用': '整体协调美观，色调自然舒服',
    '电商产品': '纯白背景、主体突出居中、光线均匀无阴影杂质、产品细节清晰锐利',
    '人像': '肤色自然、磨皮不过度保留皮肤质感、五官立体、背景干净、整体柔和有层次',
    '风景': '层次丰富、色彩通透不溢出、天空有细节、对比适中、氛围感强',
    '美食': '色泽诱人、暖色调、细节清晰、画面有食欲'
};

// ---------- 视觉评估 ----------
async function evaluateImage(goal, imageBase64, scene = '通用') {
    const cfg = getVisionConfig();
    if (!cfg || !cfg.apiKey) {
        return { done: true, feedback: '未配置视觉模型，无法评估' };
    }
    const criteria = SCENE_CRITERIA[scene] || SCENE_CRITERIA['通用'];
    const prompt = `你是一位资深的专业修图师和商业设计师，审美标准很高。

用户想要达到的目标：${goal}
图片类型：${scene}

请仔细分析这张图片，从以下专业维度逐一检查：
1. 构图：主体是否突出、画面是否平衡
2. 色彩：色调是否和谐、饱和度是否自然、有无色偏
3. 光影：明暗层次是否丰富、高光是否过曝、阴影是否死黑
4. 对比度：整体对比是否适中
5. 清晰度：主体是否清晰、有无明显噪点
6. 细节：边缘是否干净、有无瑕疵和多余杂物

本类型图片的核心标准：${criteria}

判断规则：
- 如果已经达到目标，只回复两个字：完成
- 如果还没达到，指出最关键的1-3个问题，每条都要给出具体、可执行的修改方法（例如"背景偏灰，把背景调成纯白"），不要超过3条。`;
    const result = await callVision(cfg, imageBase64, prompt, 'image/png');
    if (!result.ok) {
        return { done: true, feedback: '视觉评估失败：' + result.error };
    }
    const text = result.text.trim();
    const done = /^完成$/.test(text) || /已达标/.test(text) || text.length <= 3;
    return { done, feedback: text };
}

// ---------- 执行修图（复用 photoshop-mcp-ui 的 /api/chat） ----------
function getSessionToken() {
    try {
        const s = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
        return s.token || '';
    } catch (e) {
        return '';
    }
}

function requestJSON(options, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.setTimeout(180000, () => { req.destroy(new Error('执行超时')); });
        if (body) req.write(body);
        req.end();
    });
}

async function executeEdit(prompt) {
    const token = getSessionToken();
    if (!token) throw new Error('未找到会话令牌，请确保服务已启动');
    const headers = {
        'Content-Type': 'application/json',
        'x-psmcp-token': token
    };
    const base = { hostname: '127.0.0.1', port: 5176, headers };

    // 创建会话
    const chatRes = await requestJSON({ ...base, path: '/api/chats', method: 'POST' }, JSON.stringify({}));
    if (chatRes.status !== 200) throw new Error('创建会话失败');
    const chat = JSON.parse(chatRes.data);
    const chatId = chat.id;

    // 发送修图指令，等待完成
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ prompt, chatId });
        const req = http.request({
            ...base,
            path: '/api/chat',
            method: 'POST',
            headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
        }, (res) => {
            let buf = '';
            res.on('data', c => {
                buf += c.toString();
                if (buf.includes('event: done')) resolve({ ok: true, chatId });
                if (buf.includes('event: error')) {
                    const m = buf.match(/"message":"([^"]+)"/);
                    reject(new Error(m ? m[1] : '执行出错'));
                }
            });
            res.on('end', () => resolve({ ok: true, chatId }));
        });
        req.on('error', reject);
        req.setTimeout(180000, () => { req.destroy(); reject(new Error('执行超时')); });
        req.write(body);
        req.end();
    });
}

// ---------- 闭环主循环 ----------
async function runClosedLoop(goal, maxRounds = 2, scene = '通用') {
    const steps = [];
    for (let i = 1; i <= maxRounds; i++) {
        // 1. 导出当前图片
        let image;
        try {
            image = await captureImage();
        } catch (e) {
            steps.push({ round: i, type: 'capture', text: '无法获取当前图片：' + e.message });
            break;
        }
        // 2. 视觉评估
        const evalResult = await evaluateImage(goal, image.base64, scene);
        steps.push({ round: i, type: 'evaluate', text: evalResult.feedback });
        if (evalResult.done) {
            steps.push({ round: i, type: 'done', text: '已达到目标' });
            break;
        }
        // 3. 执行修改
        try {
            const instruction = `你是一位专业的修图师。请按照下面的建议精确地修改图片。

修改原则：先调整整体光影和色调，再处理局部细节；修改要克制、自然、不过度。

具体建议：
${evalResult.feedback}`;
            await executeEdit(instruction);
            steps.push({ round: i, type: 'execute', text: '已执行修改，继续检查...' });
        } catch (e) {
            steps.push({ round: i, type: 'execute', text: '执行失败：' + e.message });
            break;
        }
    }
    return steps;
}

async function shutdown() {
    try {
        if (mcpClient) { await mcpClient.close(); mcpClient = null; }
    } catch (e) { /* ignore */ }
}

module.exports = { runClosedLoop, captureImage, shutdown, connectMCP };
