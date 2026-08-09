import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function loadDotEnv() {
  const envPaths = [resolve(process.cwd(), '.env'), resolve(__dirname, '../../.env')];
  const envPath = envPaths.find((path) => existsSync(path));
  if (!envPath) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
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

export const envConfig = {
  port: Number(process.env.PORT || 3000),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/educonnect',
  jwtSecret: process.env.JWT_SECRET || 'educonnect_dev_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8081').split(',').map((origin) => origin.trim()).filter(Boolean),
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken: process.env.AWS_SESSION_TOKEN || '',
    region: process.env.AWS_REGION || '',
    bucketName: process.env.AWS_S3_BUCKET_NAME || '',
    endpoint: process.env.S3_ENDPOINT || '',
    forcePathStyle: ['1', 'true', 'yes', 'on'].includes(
      String(process.env.S3_FORCE_PATH_STYLE || '').trim().toLowerCase()
    )
  }
};
