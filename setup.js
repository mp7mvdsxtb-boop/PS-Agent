const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('');
  console.log('==============================================');
  console.log('    AI-PsAssistant 首次配置向导');
  console.log('    智能体控制Photoshop - 让AI帮你P图');
  console.log('==============================================');
  console.log('');

  console.log('[第1步] 检查Photoshop...');
  try {
    if (process.platform === 'win32') {
      const result = execSync('tasklist /FI "IMAGENAME eq Photoshop.exe" 2>nul', { encoding: 'utf8' });
      if (result.includes('Photoshop.exe')) {
        console.log('  [OK] Photoshop 正在运行');
      } else {
        console.log('  [提示] Photoshop 未运行，请先打开Adobe Photoshop');
      }
    }
  } catch (e) {
    console.log('  [提示] 无法检测Photoshop，请确保已安装并打开');
  }

  console.log('');
  console.log('[第2步] 选择AI模型提供商');
  console.log('');
  console.log('  支持图片分析的模型（可上传参考图）：');
  console.log('  [1] 通义千问 Qwen-VL (推荐) - 阿里出品，便宜');
  console.log('  [2] 智谱 GLM-4V - 性价比高');
  console.log('  [3] Claude - 最强但较贵');
  console.log('  [4] GPT-4o - OpenAI');
  console.log('  纯文本模型（不支持图片）：');
  console.log('  [5] DeepSeek V4 Pro - 最便宜');
  console.log('  [6] DeepSeek Flash - 更便宜');
  console.log('  [7] 自定义视觉模型 - 自己填API地址和模型ID');
  console.log('');

  const provider = await ask('  请输入数字 (1-7): ');

  let providerName = '';
  let baseUrl = '';
  let model = '';
  let apiKey = '';
  let apiFormat = 'openai';

  switch (provider) {
    case '1':
      providerName = 'Qwen';
      baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      model = 'qwen-vl-max';
      console.log('');
      console.log('  获取通义千问 API Key:');
      console.log('  1. 打开浏览器访问 https://bailian.console.aliyun.com/');
      console.log('  2. 登录阿里云账号（没有就注册）');
      console.log('  3. 点击 "API-KEY管理" -> "创建"');
      console.log('  4. 复制生成的API Key');
      console.log('');
      apiKey = await ask('  请输入你的通义千问 API Key: ');
      break;

    case '2':
      providerName = 'GLM';
      baseUrl = 'https://open.bigmodel.cn/api/paas/v4';
      model = 'glm-4v-flash';
      console.log('');
      console.log('  获取智谱 API Key:');
      console.log('  1. 打开浏览器访问 https://open.bigmodel.cn/');
      console.log('  2. 注册/登录后创建API Key');
      console.log('');
      apiKey = await ask('  请输入你的智谱 API Key: ');
      break;

    case '3':
      providerName = 'Anthropic';
      baseUrl = 'https://api.anthropic.com';
      model = 'claude-sonnet-4-5-20250514';
      apiFormat = 'anthropic';
      console.log('');
      console.log('  获取Claude API Key:');
      console.log('  1. 打开浏览器访问 https://console.anthropic.com/settings/keys');
      console.log('  2. 注册/登录后创建API Key');
      console.log('');
      apiKey = await ask('  请输入你的Claude API Key: ');
      break;

    case '4':
      providerName = 'OpenAI';
      baseUrl = 'https://api.openai.com/v1';
      model = 'gpt-4o';
      console.log('');
      console.log('  获取OpenAI API Key:');
      console.log('  1. 打开浏览器访问 https://platform.openai.com/api-keys');
      console.log('  2. 注册/登录后创建API Key');
      console.log('');
      apiKey = await ask('  请输入你的OpenAI API Key: ');
      break;

    case '5':
      providerName = 'DeepSeek';
      baseUrl = 'https://api.deepseek.com/v1';
      model = 'deepseek-v4-pro';
      console.log('');
      console.log('  获取DeepSeek API Key:');
      console.log('  1. 打开浏览器访问 https://platform.deepseek.com/api_keys');
      console.log('  2. 注册/登录后创建API Key');
      console.log('');
      apiKey = await ask('  请输入你的DeepSeek API Key: ');
      break;

    case '6':
      providerName = 'DeepSeek';
      baseUrl = 'https://api.deepseek.com/v1';
      model = 'deepseek-flash';
      console.log('');
      console.log('  获取DeepSeek API Key:');
      console.log('  1. 打开浏览器访问 https://platform.deepseek.com/api_keys');
      console.log('  2. 注册/登录后创建API Key');
      console.log('');
      apiKey = await ask('  请输入你的DeepSeek API Key: ');
      break;

    case '7':
      providerName = 'Custom';
      console.log('');
      console.log('  自定义视觉模型（支持图片）:');
      console.log('');
      baseUrl = await ask('  请输入 API 地址 (Base URL): ');
      model = await ask('  请输入 模型 ID (例如 qwen-vl-max): ');
      apiKey = await ask('  请输入 API Key: ');
      console.log('');
      break;

    default:
      console.log('  无效的选择');
      rl.close();
      return;
  }

  console.log('');
  console.log('[第3步] 保存配置...');

  const dbPath = path.join(process.env.USERPROFILE, '.photoshop-mcp', 'data.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    const Database = require('better-sqlite3');

    const db = new Database(dbPath);
    db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)');

    const configData = {
      providers: {
        custom: {
          apiKey: apiKey,
          defaultModel: model
        }
      },
      activeProvider: 'custom',
      activeModel: model,
      actionPlanBeta: false,
      customProvider: {
        name: providerName,
        baseUrl: baseUrl,
        apiKey: apiKey,
        apiFormat: apiFormat,
        models: [{
          id: model,
          label: providerName + ' ' + model
        }],
        defaultModel: model
      }
    };

    db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)').run('config', JSON.stringify(configData));
    db.close();

    console.log('  [OK] 配置已保存');
  } catch (e) {
    console.log('  [错误] 保存配置失败: ' + e.message);
    console.log('');
    if (e.message.includes('better-sqlite3') || e.message.includes('bindings') || e.message.includes('Could not locate')) {
      console.log('  原因：依赖包没有装好（better-sqlite3 需要编译/下载）。');
      console.log('  解决办法：');
      console.log('  1. 关闭本窗口');
      console.log('  2. 删除本目录下的 node_modules 文件夹');
      console.log('  3. 重新双击 Setup.bat');
    } else {
      console.log('  原因：可能是程序正在运行，锁定了配置文件。');
      console.log('  解决办法：先关闭正在运行的程序（黑色窗口），再重新运行本配置。');
    }
    console.log('');
    rl.close();
    return;
  }

  console.log('');
  console.log('==============================================');
  console.log('  配置完成！');
  console.log('');

  if (['1', '2', '3', '4'].includes(provider)) {
    console.log('  你选择的模型支持图片分析，可以使用参考图功能！');
    console.log('');
  }

  console.log('  现在你可以：');
  console.log('');
  console.log('  1. 双击 Start.bat 启动程序');
  console.log('  2. 打开浏览器访问 http://localhost:5175');
  console.log('  3. 在聊天框输入指令，例如：');
  console.log('     - "把图片调亮一点"');
  console.log('     - "把背景去掉"');
  console.log('');
  console.log('==============================================');
  console.log('');

  rl.close();
}

process.on('uncaughtException', (err) => {
  console.log('');
  console.log('  [错误] 发生异常: ' + err.message);
  console.log('');
  process.exit(0);
});
process.on('unhandledRejection', (err) => {
  console.log('');
  console.log('  [错误] 发生异常: ' + (err && err.message ? err.message : err));
  console.log('');
  process.exit(0);
});

main().catch((e) => {
  console.log('');
  console.log('  [错误] ' + (e && e.message ? e.message : e));
  console.log('');
  process.exit(0);
});
