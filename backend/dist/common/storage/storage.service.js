"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = exports.CHAT_ATTACHMENT_LIMITS = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const path_1 = require("path");
const env_config_1 = require("../../config/env.config");
exports.CHAT_ATTACHMENT_LIMITS = {
    maxCount: 10,
    imageBytes: 10 * 1024 * 1024,
    videoBytes: 50 * 1024 * 1024,
    audioBytes: 25 * 1024 * 1024,
    fileBytes: 25 * 1024 * 1024
};
let StorageService = class StorageService {
    constructor() {
        this.bucketName = env_config_1.envConfig.aws.bucketName;
        this.client = new client_s3_1.S3Client({
            region: env_config_1.envConfig.aws.region,
            endpoint: env_config_1.envConfig.aws.endpoint || undefined,
            forcePathStyle: env_config_1.envConfig.aws.forcePathStyle,
            credentials: env_config_1.envConfig.aws.accessKeyId && env_config_1.envConfig.aws.secretAccessKey
                ? {
                    accessKeyId: env_config_1.envConfig.aws.accessKeyId,
                    secretAccessKey: env_config_1.envConfig.aws.secretAccessKey,
                    sessionToken: env_config_1.envConfig.aws.sessionToken || undefined
                }
                : undefined
        });
    }
    uploadTutorEvidence(userId, file) {
        return this.uploadPrivateFile(`private/tutor-evidence/users/${this.safeSegment(userId)}`, file);
    }
    uploadChatAttachment(conversationId, senderId, file) {
        return this.uploadPrivateFile(`private/chat/conversations/${this.safeSegment(conversationId)}/senders/${this.safeSegment(senderId)}`, file);
    }
    isTutorEvidenceOwnedBy(fileKey, userId) {
        return fileKey.startsWith(`private/tutor-evidence/users/${this.safeSegment(userId)}/`);
    }
    maxBytesForMime(mimeType) {
        const category = this.categoryForMime(mimeType);
        if (category === 'image')
            return exports.CHAT_ATTACHMENT_LIMITS.imageBytes;
        if (category === 'video')
            return exports.CHAT_ATTACHMENT_LIMITS.videoBytes;
        if (category === 'audio')
            return exports.CHAT_ATTACHMENT_LIMITS.audioBytes;
        return exports.CHAT_ATTACHMENT_LIMITS.fileBytes;
    }
    async createDownloadUrl(fileKey, originalFileName, mode = 'inline', expiresInSeconds = 300) {
        this.assertConfigured();
        if (!fileKey.startsWith('private/')) {
            throw new common_1.InternalServerErrorException('Invalid private storage key');
        }
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
            ResponseContentDisposition: this.contentDisposition(originalFileName, mode)
        });
        return (0, s3_request_presigner_1.getSignedUrl)(this.client, command, { expiresIn: expiresInSeconds });
    }
    async deletePrivateFile(fileKey) {
        this.assertConfigured();
        if (!fileKey.startsWith('private/'))
            return;
        await this.client.send(new client_s3_1.DeleteObjectCommand({ Bucket: this.bucketName, Key: fileKey }));
    }
    async uploadPrivateFile(prefix, file) {
        this.assertConfigured();
        const now = new Date();
        const year = String(now.getUTCFullYear());
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const category = this.categoryForMime(file.mimetype);
        const extension = (0, path_1.extname)(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
        const safeName = this.safeFileStem(file.originalname);
        const fileKey = `${prefix}/${year}/${month}/${category}/${(0, crypto_1.randomUUID)()}-${safeName}${extension}`;
        await this.client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
            ContentLength: file.size,
            ContentDisposition: this.contentDisposition(file.originalname, this.canPreview(file.mimetype) ? 'inline' : 'attachment'),
            ServerSideEncryption: 'AES256',
            Metadata: {
                originalnamebase64: Buffer.from(file.originalname, 'utf8').toString('base64'),
                category
            }
        }));
        return {
            fileKey,
            originalFileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            category
        };
    }
    assertConfigured() {
        if (!env_config_1.envConfig.aws.region || !this.bucketName) {
            throw new common_1.InternalServerErrorException('AWS S3 storage is not configured');
        }
    }
    categoryForMime(mimeType) {
        const normalized = String(mimeType || '').toLowerCase();
        if (normalized.startsWith('image/'))
            return 'image';
        if (normalized.startsWith('video/'))
            return 'video';
        if (normalized.startsWith('audio/'))
            return 'audio';
        return 'file';
    }
    canPreview(mimeType) {
        const normalized = String(mimeType || '').toLowerCase();
        return normalized.startsWith('image/') ||
            normalized.startsWith('video/') ||
            normalized.startsWith('audio/') ||
            normalized.startsWith('text/') ||
            ['application/pdf', 'application/json', 'application/xml'].includes(normalized);
    }
    safeSegment(value) {
        return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100) || 'unknown';
    }
    safeFileStem(fileName) {
        const extension = (0, path_1.extname)(fileName);
        const stem = fileName.slice(0, Math.max(0, fileName.length - extension.length));
        return stem.normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'file';
    }
    contentDisposition(fileName, mode) {
        const asciiFallback = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'download';
        return `${mode}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)()
], StorageService);
//# sourceMappingURL=storage.service.js.map