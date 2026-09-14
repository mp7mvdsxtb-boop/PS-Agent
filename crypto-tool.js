const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const USER_DATA_DIR = path.join(os.homedir(), '.ai-ps');
const CONFIG_FILE = path.join(USER_DATA_DIR, 'config.json');

// 获取机器唯一标识作为加密密钥的一部分
function getMachineKey() {
    const hostname = os.hostname();
    const username = os.userInfo().username;
    const platform = os.platform();
    return crypto.createHash('sha256')
        .update(`${hostname}-${username}-${platform}`)
        .digest('hex')
        .slice(0, 32);
}

// 从用户密码生成密钥
function getKeyFromPassword(password) {
    return crypto.createHash('sha256')
        .update(password + getMachineKey())
        .digest('hex')
        .slice(0, 32);
}

// 生成随机 IV
function generateIV() {
    return crypto.randomBytes(IV_LENGTH);
}

// 加密文本
function encrypt(text, password) {
    const key = getKeyFromPassword(password);
    const iv = generateIV();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

// 解密文本
function decrypt(encryptedText, password) {
    const key = getKeyFromPassword(password);
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
        throw new Error('加密格式错误');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// 加密对象
function encryptObject(obj, password) {
    const jsonStr = JSON.stringify(obj);
    return encrypt(jsonStr, password);
}

// 解密对象
function decryptObject(encryptedText, password) {
    const jsonStr = decrypt(encryptedText, password);
    return JSON.parse(jsonStr);
}

// 保存加密配置
function saveEncryptedConfig(config, password) {
    if (!fs.existsSync(USER_DATA_DIR)) {
        fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }
    const encrypted = encryptObject(config, password);
    fs.writeFileSync(CONFIG_FILE, encrypted, 'utf8');
    return true;
}

// 读取加密配置
function loadEncryptedConfig(password) {
    if (!fs.existsSync(CONFIG_FILE)) {
        return null;
    }
    const encrypted = fs.readFileSync(CONFIG_FILE, 'utf8');
    try {
        return decryptObject(encrypted, password);
    } catch (e) {
        return null; // 密码错误
    }
}

// 检查配置文件是否存在
function configExists() {
    return fs.existsSync(CONFIG_FILE);
}

// 验证密码是否正确
function verifyPassword(password) {
    if (!configExists()) {
        return false;
    }
    try {
        const config = loadEncryptedConfig(password);
        return config !== null;
    } catch (e) {
        return false;
    }
}

// 删除配置文件
function deleteConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
    }
    return true;
}

// 从旧路径迁移配置（兼容旧版本）
function migrateFromOldPath(oldVisionConfigPath, password) {
    const newVisionConfigPath = path.join(USER_DATA_DIR, 'vision-config.json');

    // 迁移 vision-config.json
    if (fs.existsSync(oldVisionConfigPath) && !fs.existsSync(newVisionConfigPath)) {
        try {
            const visionConfig = JSON.parse(fs.readFileSync(oldVisionConfigPath, 'utf8'));
            if (!fs.existsSync(USER_DATA_DIR)) {
                fs.mkdirSync(USER_DATA_DIR, { recursive: true });
            }
            fs.writeFileSync(newVisionConfigPath, JSON.stringify(visionConfig, null, 2), 'utf8');
            console.log('已迁移视觉模型配置到新位置');
        } catch (e) {
            console.error('迁移视觉模型配置失败:', e.message);
        }
    }

    // 从旧的 data.db 读取配置
    const oldDbPath = path.join(os.homedir(), '.photoshop-mcp', 'data.db');
    if (fs.existsSync(oldDbPath)) {
        console.log('检测到旧配置，请运行 setup.js 重新配置');
    }

    return true;
}

module.exports = {
    encrypt,
    decrypt,
    encryptObject,
    decryptObject,
    saveEncryptedConfig,
    loadEncryptedConfig,
    configExists,
    verifyPassword,
    deleteConfig,
    migrateFromOldPath,
    USER_DATA_DIR,
    CONFIG_FILE
};
