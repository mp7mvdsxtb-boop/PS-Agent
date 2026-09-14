const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 更新配置
const UPDATE_CONFIG_FILE = path.join(__dirname, 'update-config.json');
const PACKAGE_JSON = path.join(__dirname, 'package.json');
const TEMP_DIR = path.join(__dirname, 'temp');

// 默认更新配置
const DEFAULT_CONFIG = {
    repoOwner: 'mp7mvdsxtb-boop',
    repoName: 'PS-agent',
    branch: 'main',
    downloadPassword: 'songjiahua' // 下载密码
};

// 读取更新配置
function getUpdateConfig() {
    try {
        if (fs.existsSync(UPDATE_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(UPDATE_CONFIG_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('读取更新配置失败:', e.message);
    }
    return DEFAULT_CONFIG;
}

// 获取当前版本
function getCurrentVersion() {
    try {
        const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
        return pkg.version || '0.0.0';
    } catch (e) {
        return '0.0.0';
    }
}

// HTTP/HTTPS 请求
function httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const lib = isHttps ? https : http;
        const parsed = new URL(url);

        const req = lib.request({
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: options.timeout || 30000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy(new Error('请求超时'));
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// 检查远程版本
async function checkRemoteVersion(config) {
    const url = `https://raw.githubusercontent.com/${config.repoOwner}/${config.repoName}/${config.branch}/releases/version.json`;
    try {
        const resp = await httpRequest(url, { timeout: 10000 });
        if (resp.status === 200) {
            return JSON.parse(resp.data);
        }
    } catch (e) {
        console.error('检查更新失败:', e.message);
    }
    return null;
}

// 验证下载密码
function verifyDownloadPassword(inputPassword, config) {
    return inputPassword === config.downloadPassword;
}

// 下载文件
async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const lib = isHttps ? https : http;

        const req = lib.get(url, { timeout: 120000 }, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                // 跟随重定向
                return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                reject(new Error(`下载失败: HTTP ${res.statusCode}`));
                return;
            }

            const file = fs.createWriteStream(destPath);
            res.pipe(file);

            file.on('finish', () => {
                file.close();
                resolve(destPath);
            });

            file.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy(new Error('下载超时'));
        });
    });
}

// 解压 ZIP 文件（Windows）
async function extractZip(zipPath, destDir) {
    return new Promise((resolve, reject) => {
        const powershell = spawn('powershell', [
            '-Command',
            `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`
        ], { stdio: 'pipe' });

        let stderr = '';
        powershell.stderr.on('data', (data) => stderr += data.toString());

        powershell.on('close', (code) => {
            if (code === 0) {
                resolve(destDir);
            } else {
                reject(new Error(`解压失败: ${stderr}`));
            }
        });
    });
}

// 复制文件（替换更新）
function copyFiles(srcDir, destDir) {
    const files = fs.readdirSync(srcDir);
    let copiedCount = 0;

    for (const file of files) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);

        // 跳过敏感文件和目录
        const skipFiles = ['node_modules', '.git', 'vision-config.json', 'temp', '.env'];
        if (skipFiles.includes(file)) {
            continue;
        }

        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
            }
            copyFiles(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
            copiedCount++;
        }
    }

    return copiedCount;
}

// 执行更新
async function performUpdate(versionInfo, config, downloadPassword) {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                    开始更新...                            ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    // 创建临时目录
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const zipPath = path.join(TEMP_DIR, `update-${versionInfo.version}.zip`);
    const extractDir = path.join(TEMP_DIR, `update-${versionInfo.version}`);

    try {
        // 1. 下载更新包
        console.log(`[1/3] 下载更新包 v${versionInfo.version}...`);
        const downloadUrl = versionInfo.url || `https://github.com/${config.repoOwner}/${config.repoName}/releases/download/v${versionInfo.version}/ai-psassistant-v${versionInfo.version}.zip`;
        await downloadFile(downloadUrl, zipPath);
        console.log('      下载完成');

        // 2. 解压
        console.log('[2/3] 解压更新包...');
        if (fs.existsSync(extractDir)) {
            fs.rmSync(extractDir, { recursive: true, force: true });
        }
        await extractZip(zipPath, extractDir);
        console.log('      解压完成');

        // 3. 复制文件
        console.log('[3/3] 替换文件...');
        const srcDir = path.join(extractDir, 'AI-PsAssistant');
        if (!fs.existsSync(srcDir)) {
            // 尝试其他可能的目录名
            const dirs = fs.readdirSync(extractDir).filter(d => fs.statSync(path.join(extractDir, d)).isDirectory());
            if (dirs.length > 0) {
                var actualSrcDir = path.join(extractDir, dirs[0]);
            } else {
                throw new Error('更新包格式错误');
            }
        }
        const finalSrcDir = srcDir || actualSrcDir;
        const copiedCount = copyFiles(finalSrcDir, __dirname);
        console.log(`      已更新 ${copiedCount} 个文件`);

        // 清理临时文件
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });

        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║                    更新完成！                            ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('请重启程序以使用新版本');
        console.log('');

        return true;
    } catch (e) {
        console.error('');
        console.error('更新失败:', e.message);
        console.error('');
        // 清理临时文件
        try {
            fs.rmSync(TEMP_DIR, { recursive: true, force: true });
        } catch (cleanupErr) {}
        return false;
    }
}

// 主检查函数
async function checkAndUpdate(forceCheck = false) {
    const config = getUpdateConfig();
    const currentVersion = getCurrentVersion();

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                AI-PsAssistant 更新检查                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`当前版本: v${currentVersion}`);
    console.log('');

    // 检查远程版本
    console.log('正在检查更新...');
    const remoteInfo = await checkRemoteVersion(config);

    if (!remoteInfo) {
        console.log('无法获取更新信息，跳过更新检查');
        return true; // 继续启动
    }

    console.log(`最新版本: v${remoteInfo.version}`);
    console.log('');

    // 比较版本
    if (remoteInfo.version <= currentVersion && !forceCheck) {
        console.log('已是最新版本');
        return true;
    }

    // 有更新，提示用户
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                    发现新版本！                           ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`更新内容: ${remoteInfo.description || '暂无说明'}`);
    console.log('');

    // 验证下载密码
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('请输入下载密码以更新: ', async (password) => {
            rl.close();

            if (!verifyDownloadPassword(password, config)) {
                console.log('');
                console.log('密码错误，跳过更新');
                console.log('');
                resolve(true); // 继续启动
                return;
            }

            // 执行更新
            const success = await performUpdate(remoteInfo, config, password);
            resolve(success ? true : true); // 无论成功失败都继续启动
        });
    });
}

// 导出
module.exports = {
    checkAndUpdate,
    checkRemoteVersion,
    getCurrentVersion,
    getUpdateConfig,
    performUpdate,
    verifyDownloadPassword
};

// 命令行运行
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.includes('--force')) {
        checkAndUpdate(true).then(() => process.exit(0));
    } else {
        checkAndUpdate().then(() => process.exit(0));
    }
}
