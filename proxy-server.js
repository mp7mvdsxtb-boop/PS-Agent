const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { VISION_PRESETS, getVisionConfig, saveVisionConfig, callVision } = require('./vision');
const { runClosedLoop } = require('./agent-loop');

const EXTERNAL_PORT = 5175;
const INTERNAL_PORT = 5176;

let mcpProcess = null;

function startMCPInternal() {
    console.log('正在启动MCP内部服务...');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    mcpProcess = spawn(npxCmd, ['photoshop-mcp-ui', '--port', String(INTERNAL_PORT), '--no-open'], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: { ...process.env, ANALYTICS_DISABLED: 'true' }
    });
    mcpProcess.stdout.on('data', (data) => console.log(`[MCP] ${data.toString().trim()}`));
    mcpProcess.stderr.on('data', (data) => console.error(`[MCP] ${data.toString().trim()}`));
}

function proxyRequest(req, res) {
    const headers = { ...req.headers, host: `127.0.0.1:${INTERNAL_PORT}` };
    delete headers.origin;
    const options = {
        hostname: '127.0.0.1',
        port: INTERNAL_PORT,
        path: req.url,
        method: req.method,
        headers: headers
    };
    const proxy = http.request(options, (proxyRes) => {
        const contentType = proxyRes.headers['content-type'] || '';
        const isHtml = contentType.includes('text/html');
        if (isHtml) {
            let body = '';
            proxyRes.on('data', chunk => body += chunk);
            proxyRes.on('end', () => {
                const modified = injectPanel(body);
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(modified) });
                res.end(modified);
            });
        } else {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        }
    });
    proxy.on('error', () => { res.writeHead(502); res.end('服务启动中，请稍后刷新...'); });
    req.pipe(proxy);
}

function injectPanel(html) {
    const css = `<style>
.panel{position:fixed;right:0;top:0;width:340px;height:100vh;background:#1a1a2e;border-left:1px solid #2a2a4a;z-index:9999;display:flex;flex-direction:column;transform:translateX(110%);transition:transform .3s;box-shadow:-4px 0 20px rgba(0,0,0,.4)}
.panel.open{transform:translateX(0)}
.tgl-btn{position:fixed;right:20px;z-index:10000;color:#000;border:none;border-radius:8px;padding:10px 15px;cursor:pointer;font-weight:bold;font-size:13px;box-shadow:0 4px 12px rgba(0,217,255,.3)}
.tgl-btn:hover{opacity:.9}
#upload-toggle{top:20px;background:#00d9ff}
#model-toggle{top:70px;background:#00ff88}
#loop-toggle{top:120px;background:#ff9f43}
.panel-header{padding:15px 20px;border-bottom:1px solid #2a2a4a;display:flex;justify-content:space-between;align-items:center}
.panel-header h3{color:#00d9ff;margin:0;font-size:16px}
.panel-close{background:none;border:none;color:#8892b0;font-size:20px;cursor:pointer}
.panel-close:hover{color:#fff}
.panel-body{flex:1;overflow-y:auto;padding:15px}
.upload-area{border:2px dashed #2a2a4a;border-radius:12px;padding:22px;text-align:center;cursor:pointer;transition:all .3s;margin-bottom:12px}
.upload-area:hover{border-color:#00d9ff;background:rgba(0,217,255,.05)}
.upload-area.dragover{border-color:#00d9ff;background:rgba(0,217,255,.1)}
.upload-area .icon{font-size:32px;margin-bottom:8px}
.upload-area .text{color:#8892b0;font-size:13px}
.upload-area .text span{color:#00d9ff}
#preview-container{display:none;margin-bottom:12px}
#preview-container img{width:100%;border-radius:8px;border:1px solid #2a2a4a}
.preview-info{margin-top:8px;padding:8px;background:#0a0a1a;border-radius:6px;font-size:11px;color:#8892b0}
.path-box{display:flex;gap:8px;margin-top:8px}
.path-box input{flex:1;background:#0a0a1a;border:1px solid #2a2a4a;border-radius:6px;padding:6px;color:#00d9ff;font-size:11px}
.path-box button{padding:6px 10px;background:#00d9ff;color:#000;border:none;border-radius:6px;font-size:11px;cursor:pointer}
.btn{width:100%;margin-top:8px;padding:9px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px}
.btn-primary{background:#00ff88;color:#000}
.btn-secondary{background:#2a2a4a;color:#8892b0}
.btn-vision{background:#00d9ff;color:#000}
.status-box{padding:10px;background:#0a0a1a;border-radius:6px;font-size:12px;color:#8892b0;margin-bottom:12px;line-height:1.6}
.status-box .ok{color:#00ff88}
.status-box .warn{color:#ffb020}
.status-box .err{color:#ff6b6b}
.preset-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px}
.preset-btn{padding:7px 4px;background:#0a0a1a;border:1px solid #2a2a4a;border-radius:6px;color:#8892b0;font-size:11px;cursor:pointer;text-align:center;line-height:1.3}
.preset-btn:hover{border-color:#00ff88;color:#00ff88}
.form-group{margin-bottom:10px}
.form-group label{display:block;font-size:11px;color:#8892b0;margin-bottom:4px}
.form-group input,.form-group select{width:100%;background:#0a0a1a;border:1px solid #2a2a4a;border-radius:6px;padding:8px;color:#e0e0e0;font-size:12px;box-sizing:border-box}
.form-group input:focus,.form-group select:focus{outline:none;border-color:#00d9ff}
.section-title{font-size:13px;color:#00d9ff;margin:14px 0 8px;font-weight:bold;border-bottom:1px solid #2a2a4a;padding-bottom:6px}
.tips{padding:12px 15px;border-top:1px solid #2a2a4a}
.tips h4{color:#00d9ff;margin-bottom:8px;font-size:13px}
.tips ul{font-size:11px;color:#8892b0;padding-left:15px;margin:0}
.tips li{margin:4px 0}
.tips code{background:#1a1a2e;padding:2px 4px;border-radius:3px;color:#00d9ff;font-size:10px}
#vision-result{display:none;margin-top:10px;padding:10px;background:#0a0a1a;border-radius:6px;font-size:12px;color:#e0e0e0;line-height:1.6;white-space:pre-wrap}
#vision-result.error{color:#ff6b6b}
#loop-result{display:none;margin-top:10px;font-size:12px;color:#e0e0e0;line-height:1.7}
.loop-step{padding:8px 10px;background:#0a0a1a;border-radius:6px;margin-bottom:6px;border-left:3px solid #ff9f43}
.loop-step.done{border-left-color:#00ff88}
.loop-step.evaluate{border-left-color:#00d9ff}
.loop-step .tag{color:#ff9f43;font-weight:bold;font-size:11px}
.loop-step.done .tag{color:#00ff88}
.loop-step.evaluate .tag{color:#00d9ff}
</style>`;

    const html_content = `
<button class="tgl-btn" id="upload-toggle">  参考图</button>
<button class="tgl-btn" id="model-toggle">  模型设置</button>
<button class="tgl-btn" id="loop-toggle">  闭环修图</button>

<div class="panel" id="upload-panel">
  <div class="panel-header"><h3>  参考图 / 视觉分析</h3><button class="panel-close" onclick="togglePanel('upload')">✕</button></div>
  <div class="panel-body">
    <div class="upload-area" id="uploadArea"><div class="icon"> </div><div class="text">拖拽图片到这里，或 <span>点击选择</span></div></div>
    <input type="file" id="fileInput" accept="image/*" style="display:none">
    <div id="preview-container"><img id="previewImg" src="" alt=""><div class="preview-info"><div id="fileName"></div><div id="fileSize"></div></div><div class="path-box"><input type="text" id="filePath" readonly><button onclick="copyPath()">复制</button></div><button class="btn btn-primary" onclick="useInChat()">在对话中使用</button></div>
    <div class="section-title">  AI 视觉分析</div>
    <div class="form-group"><label>告诉AI你的目标（例如：这张图怎么样，哪里需要改进）</label><input type="text" id="visionPrompt" placeholder="分析这张图并给出修图建议"></div>
    <button class="btn btn-vision" id="visionBtn" onclick="runVision()">  让AI看图分析</button>
    <div id="vision-result"></div>
  </div>
  <div class="tips"><h4>  使用方法</h4><ul><li>1. 上传图片（参考图或当前效果）</li><li>2. 输入目标，点击"让AI看图分析"</li><li>3. 或点"在对话中使用"把参考图加入聊天</li></ul></div>
</div>

<div class="panel" id="model-panel">
  <div class="panel-header"><h3>  模型设置</h3><button class="panel-close" onclick="togglePanel('model')">✕</button></div>
  <div class="panel-body">
    <div class="status-box" id="modelStatus">加载中...</div>
    <div class="section-title">  快速选择视觉模型</div>
    <div class="preset-grid" id="presetGrid"></div>
    <div class="section-title">⚙️ 自定义模型</div>
    <div class="form-group"><label>模型名称（随便起）</label><input type="text" id="mName" placeholder="例如：我的通义千问"></div>
    <div class="form-group"><label>API 地址（Base URL）</label><input type="text" id="mBaseUrl" placeholder="https://.../v1"></div>
    <div class="form-group"><label>API Key</label><input type="password" id="mApiKey" placeholder="sk-..."></div>
    <div class="form-group"><label>模型 ID</label><input type="text" id="mModel" placeholder="例如：qwen-vl-max"></div>
    <div class="form-group"><label>接口格式</label><select id="mFormat"><option value="openai">OpenAI 兼容（千问/智谱/GPT/Gemini）</option><option value="anthropic">Anthropic 兼容（Claude）</option></select></div>
    <button class="btn btn-primary" onclick="saveModel()">  保存并切换</button>
  </div>
  <div class="tips"><h4>  说明</h4><ul><li>视觉模型能"看懂"图片</li><li>支持 OpenAI 兼容和 Claude 格式</li><li>API Key 只存在你本机</li></ul></div>
</div>

<div class="panel" id="loop-panel">
  <div class="panel-header"><h3>  闭环修图</h3><button class="panel-close" onclick="togglePanel('loop')">✕</button></div>
  <div class="panel-body">
    <div class="status-box"><span class="warn">● AI 自动"看→改→看→改"循环</span><br>先配置好视觉模型（模型设置）再使用</div>
    <div class="form-group"><label>修图目标（越具体越好）</label><input type="text" id="loopGoal" placeholder="例如：把这张产品图做成白色背景的专业电商图"></div>
    <button class="btn btn-primary" id="loopBtn" onclick="runLoop()">  开始闭环修图</button>
    <div id="loop-result"></div>
  </div>
  <div class="tips"><h4>  说明</h4><ul><li>AI先看当前PS里的图</li><li>判断哪里没达标</li><li>自动执行修改</li><li>再检查，最多3轮</li></ul></div>
</div>`;

    const js = `<script>
(function(){
  // ---- 面板开关 ----
  const panels = { upload: document.getElementById('upload-panel'), model: document.getElementById('model-panel'), loop: document.getElementById('loop-panel') };
  window.togglePanel = function(name) {
    const p = panels[name]; if(!p) return;
    const isOpen = p.classList.contains('open');
    Object.values(panels).forEach(x => x.classList.remove('open'));
    if(!isOpen) p.classList.add('open');
  };
  document.getElementById('upload-toggle').addEventListener('click', () => togglePanel('upload'));
  document.getElementById('model-toggle').addEventListener('click', () => { togglePanel('model'); loadModelStatus(); });
  document.getElementById('loop-toggle').addEventListener('click', () => togglePanel('loop'));

  // ---- 参考图上传 ----
  const uploadArea=document.getElementById('uploadArea'),fileInput=document.getElementById('fileInput'),previewContainer=document.getElementById('preview-container'),previewImg=document.getElementById('previewImg'),fileName=document.getElementById('fileName'),fileSize=document.getElementById('fileSize'),filePath=document.getElementById('filePath');
  let currentImagePath='', currentImageData='';
  uploadArea.addEventListener('click',()=>fileInput.click());
  uploadArea.addEventListener('dragover',e=>{e.preventDefault();uploadArea.classList.add('dragover')});
  uploadArea.addEventListener('dragleave',()=>uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop',e=>{e.preventDefault();uploadArea.classList.remove('dragover');handleFile(e.dataTransfer.files[0])});
  fileInput.addEventListener('change',e=>{if(e.target.files[0])handleFile(e.target.files[0])});
  function handleFile(file){
    if(!file||!file.type.startsWith('image/'))return;
    const reader=new FileReader();
    reader.onload=e=>{
      const path='D:\\\\AI参考图\\\\'+file.name;
      currentImagePath=path;
      currentImageData=e.target.result;
      previewImg.src=e.target.result;
      fileName.textContent=file.name;
      fileSize.textContent=formatSize(file.size);
      filePath.value=path;
      previewContainer.style.display='block';
      saveFile(file,path);
    };
    reader.readAsDataURL(file);
  }
  window.useInChat=function(){
    if(!currentImagePath)return;
    const chatInput=document.querySelector('textarea')||document.querySelector('input[type="text"]');
    if(chatInput){chatInput.value='参考这张图 '+currentImagePath+'，';chatInput.focus()}
    togglePanel('upload');
  };
  window.copyPath=function(){filePath.select();document.execCommand('copy');alert('路径已复制！')};
  async function saveFile(file,path){
    try{
      await fetch('/api/mkdir',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dirPath:'D:\\\\AI参考图'})});
      const reader=new FileReader();
      reader.onload=async e=>{await fetch('/api/save-file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:path,data:e.target.result})})};
      reader.readAsDataURL(file);
    }catch(e){console.error('保存失败:',e)}
  }

  // ---- 视觉分析 ----
  window.runVision=async function(){
    const result=document.getElementById('vision-result');
    if(!currentImageData){result.style.display='block';result.className='error';result.textContent='请先上传一张图片';return;}
    const prompt=document.getElementById('visionPrompt').value.trim()||'请分析这张图片，指出可以改进的地方，并给出具体的修图建议';
    const btn=document.getElementById('visionBtn');
    btn.textContent='⏳ 分析中...';btn.disabled=true;
    result.style.display='block';result.className='';result.textContent='AI 正在看图分析...';
    try{
      const res=await fetch('/api/vision/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:currentImageData,prompt:prompt})});
      const data=await res.json();
      if(data.ok){result.textContent=data.text;}
      else{result.className='error';result.textContent='分析失败：'+(data.error||'未知错误')+'\\n\\n提示：请先在"模型设置"里添加一个支持图片的模型。';}
    }catch(e){result.className='error';result.textContent='请求失败：'+e.message;}
    btn.textContent='  让AI看图分析';btn.disabled=false;
  };

  // ---- 模型设置 ----
  const VISION_PRESETS_DEFAULT=[
    {name:'通义千问 VL-Max',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',apiFormat:'openai',model:'qwen-vl-max'},
    {name:'智谱 GLM-4V',baseUrl:'https://open.bigmodel.cn/api/paas/v4',apiFormat:'openai',model:'glm-4v-flash'},
    {name:'GPT-4o',baseUrl:'https://api.openai.com/v1',apiFormat:'openai',model:'gpt-4o'},
    {name:'Gemini 2.0',baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',apiFormat:'openai',model:'gemini-2.0-flash'},
    {name:'Claude Sonnet',baseUrl:'https://api.anthropic.com',apiFormat:'anthropic',model:'claude-sonnet-4-5-20250514'}
  ];
  let presets=VISION_PRESETS_DEFAULT;
  fetch('/api/vision/presets').then(r=>r.json()).then(d=>{if(d.presets)presets=d.presets.map(p=>({name:p.name,baseUrl:p.baseUrl,apiFormat:p.apiFormat,model:p.model}));renderPresets();}).catch(()=>renderPresets());

  function renderPresets(){
    const grid=document.getElementById('presetGrid');
    grid.innerHTML='';
    presets.forEach(p=>{
      const b=document.createElement('button');
      b.className='preset-btn';
      b.textContent=p.name;
      b.onclick=()=>{document.getElementById('mName').value=p.name;document.getElementById('mBaseUrl').value=p.baseUrl;document.getElementById('mModel').value=p.model;document.getElementById('mFormat').value=p.apiFormat;};
      grid.appendChild(b);
    });
  }

  async function loadModelStatus(){
    const el=document.getElementById('modelStatus');
    try{
      const res=await fetch('/api/vision/status');
      const s=await res.json();
      if(s.configured){el.innerHTML='<span class="ok">● 当前视觉模型：</span>'+s.model+'<br><span class="ok">格式：</span>'+(s.apiFormat||'openai');}
      else{el.innerHTML='<span class="warn">● 尚未配置视觉模型</span><br>请选择预设或填写自定义模型';}
    }catch(e){el.innerHTML='<span class="err">● 无法读取状态</span>';}
  }

  window.saveModel=async function(){
    const name=document.getElementById('mName').value.trim();
    const baseUrl=document.getElementById('mBaseUrl').value.trim();
    const apiKey=document.getElementById('mApiKey').value.trim();
    const model=document.getElementById('mModel').value.trim();
    const apiFormat=document.getElementById('mFormat').value;
    const el=document.getElementById('modelStatus');
    if(!baseUrl||!model){el.innerHTML='<span class="warn">● 请填写 API 地址和模型 ID</span>';return;}
    if(!apiKey){el.innerHTML='<span class="warn">● 请填写 API Key</span>';return;}
    el.innerHTML='<span class="ok">保存中...</span>';
    try{
      const body={name:name||'自定义视觉模型',baseUrl:baseUrl,apiKey:apiKey,apiFormat:apiFormat,model:model};
      const res=await fetch('/api/vision/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await res.json();
      if(data.ok){el.innerHTML='<span class="ok">● 已保存并激活：</span>'+model;alert('视觉模型已保存！现在可以"让AI看图分析"了');}
      else{el.innerHTML='<span class="err">● 保存失败：</span>'+(data.error||'未知错误');}
    }catch(e){el.innerHTML='<span class="err">● 保存失败：</span>'+e.message;}
  };

  function formatSize(bytes){if(bytes<1024)return bytes+' B';if(bytes<1048576)return(bytes/1024).toFixed(1)+' KB';return(bytes/1048576).toFixed(1)+' MB'}

  // ---- 闭环修图 ----
  window.runLoop=async function(){
    const goal=document.getElementById('loopGoal').value.trim();
    const result=document.getElementById('loop-result');
    const btn=document.getElementById('loopBtn');
    if(!goal){alert('请先填写修图目标');return;}
    btn.textContent='⏳ 闭环修图中...';btn.disabled=true;
    result.style.display='block';
    result.innerHTML='<div class="loop-step"><span class="tag">开始</span> AI 正在查看当前PS图片...</div>';
    try{
      const res=await fetch('/api/loop/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal:goal})});
      const data=await res.json();
      if(!data.ok){result.innerHTML='<div class="loop-step"><span class="tag">失败</span> '+(data.error||'未知错误')+'</div>';}
      else{
        let html='';
        data.steps.forEach(s=>{
          const cls=s.type==='done'?'done':(s.type==='evaluate'?'evaluate':'');
          const tag={capture:'看图',evaluate:'评估',execute:'执行',done:'完成'}[s.type]||s.type;
          html+='<div class="loop-step '+cls+'"><span class="tag">'+tag+'</span> '+escapeHtml(s.text)+'</div>';
        });
        result.innerHTML=html;
      }
    }catch(e){result.innerHTML='<div class="loop-step"><span class="tag">失败</span> '+escapeHtml(e.message)+'</div>';}
    btn.textContent='  开始闭环修图';btn.disabled=false;
  };
  function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
})();
</script>`;

    html = html.replace('</head>', css + '</head>');
    html = html.replace('</body>', html_content + js + '</body>');
    return html;
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    if (req.method === 'POST' && req.url === '/api/mkdir') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { dirPath } = JSON.parse(body);
                if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (req.method === 'POST' && req.url === '/api/save-file') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { path: filePath, data } = JSON.parse(body);
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                const base64Data = data.replace(/^data:image\/\w+;base64,/, '');
                fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
                console.log(`文件已保存: ${filePath}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, path: filePath }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // 视觉模型预设列表
    if (req.method === 'GET' && req.url === '/api/vision/presets') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ presets: VISION_PRESETS }));
        return;
    }

    // 当前激活的模型状态
    if (req.method === 'GET' && req.url === '/api/vision/status') {
        const cfg = getVisionConfig();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            configured: Boolean(cfg && cfg.apiKey),
            name: cfg ? cfg.name : null,
            model: cfg ? cfg.model : null,
            apiFormat: cfg ? cfg.apiFormat : null,
            baseUrl: cfg ? cfg.baseUrl : null
        }));
        return;
    }

    // 保存视觉模型配置
    if (req.method === 'POST' && req.url === '/api/vision/config') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const cfg = JSON.parse(body);
                if (!cfg.baseUrl || !cfg.model || !cfg.apiKey) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: 'baseUrl、model、apiKey 不能为空' }));
                    return;
                }
                cfg.apiFormat = cfg.apiFormat === 'anthropic' ? 'anthropic' : 'openai';
                saveVisionConfig(cfg);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, model: cfg.model }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: e.message }));
            }
        });
        return;
    }

    // 视觉分析：图片 + 提示词 → 视觉模型
    if (req.method === 'POST' && req.url === '/api/vision/analyze') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { image, prompt } = JSON.parse(body);
                if (!image || !prompt) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: '缺少图片或提示词' }));
                    return;
                }
                const cfg = getVisionConfig();
                if (!cfg || !cfg.apiKey) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: '未配置视觉模型，请先在"模型设置"中添加' }));
                    return;
                }
                // 解析 data URL
                const m = image.match(/^data:(image\/\w+);base64,(.+)$/);
                const mimeType = m ? m[1] : 'image/png';
                const base64 = m ? m[2] : image;
                const result = await callVision(cfg, base64, prompt, mimeType);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: e.message }));
            }
        });
        return;
    }

    // 闭环修图：看→改→看→改 自动循环
    if (req.method === 'POST' && req.url === '/api/loop/run') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { goal } = JSON.parse(body);
                if (!goal) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ ok: false, error: '缺少目标描述' }));
                    return;
                }
                const steps = await runClosedLoop(goal, 3);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, steps }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: e.message }));
            }
        });
        return;
    }

    proxyRequest(req, res);
});

startMCPInternal();
setTimeout(() => {
    server.listen(EXTERNAL_PORT, '0.0.0.0', () => {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║        AI-PsAssistant 已启动                              ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('  访问地址: http://localhost:' + EXTERNAL_PORT);
        console.log('');
        console.log('  右上角有"参考图"按钮，点击可上传图片');
        console.log('');
    });
}, 3000);
