const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 视觉模型配置文件（存储在用户目录下，与程序分离）
const USER_DATA_DIR = path.join(os.homedir(), '.ai-ps');
const VISION_CONFIG_FILE = path.join(USER_DATA_DIR, 'vision-config.json');

// 常见视觉模型预设（OpenAI/Anthropic 兼容）
const VISION_PRESETS = [
    { id: 'qwen-vl-max', name: '通义千问 Qwen-VL-Max', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiFormat: 'openai', model: 'qwen-vl-max', websiteUrl: 'https://bailian.console.aliyun.com/' },
    { id: 'qwen-vl-plus', name: '通义千问 Qwen-VL-Plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiFormat: 'openai', model: 'qwen-vl-plus', websiteUrl: 'https://bailian.console.aliyun.com/' },
    { id: 'glm-4v-flash', name: '智谱 GLM-4V-Flash', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiFormat: 'openai', model: 'glm-4v-flash', websiteUrl: 'https://open.bigmodel.cn/' },
    { id: 'gpt-4o', name: 'OpenAI GPT-4o', baseUrl: 'https://api.openai.com/v1', apiFormat: 'openai', model: 'gpt-4o', websiteUrl: 'https://platform.openai.com/api-keys' },
    { id: 'gemini-2.0-flash', name: 'Google Gemini 2.0 Flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiFormat: 'openai', model: 'gemini-2.0-flash', websiteUrl: 'https://aistudio.google.com/apikey' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', baseUrl: 'https://api.anthropic.com', apiFormat: 'anthropic', model: 'claude-sonnet-4-5-20250514', websiteUrl: 'https://console.anthropic.com/settings/keys' }
];

function getVisionConfig() {
    try {
        if (!fs.existsSync(VISION_CONFIG_FILE)) return null;
        return JSON.parse(fs.readFileSync(VISION_CONFIG_FILE, 'utf8'));
    } catch (e) {
        return null;
    }
}

function saveVisionConfig(config) {
    // 确保用户数据目录存在
    if (!fs.existsSync(USER_DATA_DIR)) {
        fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(VISION_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return config;
}

function httpRequest(url, options, body) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const lib = isHttps ? https : http;
        const parsed = new URL(url);
        const req = lib.request({
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: options.method || 'POST',
            headers: options.headers || {}
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.setTimeout(90000, () => { req.destroy(new Error('请求超时')); });
        if (body) req.write(body);
        req.end();
    });
}

// 调用视觉模型分析图片
async function callVision(modelConfig, imageBase64, prompt, mimeType = 'image/png') {
    if (!modelConfig) {
        return { ok: false, error: '未配置视觉模型，请先在"模型设置"中添加' };
    }
    if (!modelConfig.apiKey) {
        return { ok: false, error: '未配置API Key' };
    }

    const baseUrl = (modelConfig.baseUrl || '').replace(/\/+$/, '');
    const apiFormat = modelConfig.apiFormat === 'anthropic' ? 'anthropic' : 'openai';

    try {
        if (apiFormat === 'anthropic') {
            const url = `${baseUrl}/v1/messages`;
            const payload = {
                model: modelConfig.model,
                max_tokens: 300,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
                        { type: 'text', text: prompt }
                    ]
                }]
            };
            const resp = await httpRequest(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': modelConfig.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            }, JSON.stringify(payload));

            if (resp.status !== 200) {
                return { ok: false, error: `Claude API错误(${resp.status}): ${resp.data.slice(0, 200)}` };
            }
            const result = JSON.parse(resp.data);
            const text = result.content?.filter(c => c.type === 'text').map(c => c.text).join('') || '';
            return { ok: true, text };
        } else {
            const url = `${baseUrl}/chat/completions`;
            const dataUrl = `data:${mimeType};base64,${imageBase64}`;
            const payload = {
                model: modelConfig.model,
                max_tokens: 300,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: dataUrl } },
                        { type: 'text', text: prompt }
                    ]
                }]
            };
            const resp = await httpRequest(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${modelConfig.apiKey}`
                }
            }, JSON.stringify(payload));

            if (resp.status !== 200) {
                return { ok: false, error: `API错误(${resp.status}): ${resp.data.slice(0, 200)}` };
            }
            const result = JSON.parse(resp.data);
            const text = result.choices?.[0]?.message?.content || '';
            return { ok: true, text };
        }
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

module.exports = {
    VISION_PRESETS,
    getVisionConfig,
    saveVisionConfig,
    callVision
};
