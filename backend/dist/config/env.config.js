"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envConfig = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
function loadDotEnv() {
    const envPaths = [(0, path_1.resolve)(process.cwd(), '.env'), (0, path_1.resolve)(__dirname, '../../.env')];
    const envPath = envPaths.find((path) => (0, fs_1.existsSync)(path));
    if (!envPath) {
        return;
    }
    const lines = (0, fs_1.readFileSync)(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex === -1) {
            continue;
        }
        const key = trimmed.slice(0, equalsIndex).trim();
        const rawValue = trimmed.slice(equalsIndex + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, '');
        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}
loadDotEnv();
exports.envConfig = {
    port: Number(process.env.PORT || 3000),
    mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/educonnect',
    jwtSecret: process.env.JWT_SECRET || 'educonnect_dev_secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8081').split(',').map((origin) => origin.trim()).filter(Boolean)
};
//# sourceMappingURL=env.config.js.map