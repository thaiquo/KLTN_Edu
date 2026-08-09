import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { envConfig } from '../../config/env.config';

export type StorageCategory = 'image' | 'video' | 'audio' | 'file';
export type SignedUrlMode = 'inline' | 'attachment';

export interface StorageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StoredFile {
  fileKey: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  category: StorageCategory;
}

export const CHAT_ATTACHMENT_LIMITS = {
  maxCount: 10,
  imageBytes: 10 * 1024 * 1024,
  videoBytes: 50 * 1024 * 1024,
  audioBytes: 25 * 1024 * 1024,
  fileBytes: 25 * 1024 * 1024
} as const;

@Injectable()
export class StorageService {
  private readonly bucketName = envConfig.aws.bucketName;
  private readonly client = new S3Client({
    region: envConfig.aws.region,
    endpoint: envConfig.aws.endpoint || undefined,
    forcePathStyle: envConfig.aws.forcePathStyle,
    credentials: envConfig.aws.accessKeyId && envConfig.aws.secretAccessKey
      ? {
          accessKeyId: envConfig.aws.accessKeyId,
          secretAccessKey: envConfig.aws.secretAccessKey,
          sessionToken: envConfig.aws.sessionToken || undefined
        }
      : undefined
  });

  uploadTutorEvidence(userId: string, file: StorageFile) {
    return this.uploadPrivateFile(
      `private/tutor-evidence/users/${this.safeSegment(userId)}`,
      file
    );
  }

  // Ready for the chat module: one isolated prefix per conversation and sender.
  uploadChatAttachment(conversationId: string, senderId: string, file: StorageFile) {
    return this.uploadPrivateFile(
      `private/chat/conversations/${this.safeSegment(conversationId)}/senders/${this.safeSegment(senderId)}`,
      file
    );
  }

  isTutorEvidenceOwnedBy(fileKey: string, userId: string) {
    return fileKey.startsWith(
      `private/tutor-evidence/users/${this.safeSegment(userId)}/`
    );
  }

  maxBytesForMime(mimeType: string) {
    const category = this.categoryForMime(mimeType);
    if (category === 'image') return CHAT_ATTACHMENT_LIMITS.imageBytes;
    if (category === 'video') return CHAT_ATTACHMENT_LIMITS.videoBytes;
    if (category === 'audio') return CHAT_ATTACHMENT_LIMITS.audioBytes;
    return CHAT_ATTACHMENT_LIMITS.fileBytes;
  }

  async createDownloadUrl(
    fileKey: string,
    originalFileName: string,
    mode: SignedUrlMode = 'inline',
    expiresInSeconds = 300
  ) {
    this.assertConfigured();
    if (!fileKey.startsWith('private/')) {
      throw new InternalServerErrorException('Invalid private storage key');
    }
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ResponseContentDisposition: this.contentDisposition(originalFileName, mode)
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async deletePrivateFile(fileKey: string) {
    this.assertConfigured();
    if (!fileKey.startsWith('private/')) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: fileKey }));
  }

  private async uploadPrivateFile(prefix: string, file: StorageFile): Promise<StoredFile> {
    this.assertConfigured();
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const category = this.categoryForMime(file.mimetype);
    const extension = extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    const safeName = this.safeFileStem(file.originalname);
    const fileKey = `${prefix}/${year}/${month}/${category}/${randomUUID()}-${safeName}${extension}`;

    await this.client.send(new PutObjectCommand({
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

  private assertConfigured() {
    if (!envConfig.aws.region || !this.bucketName) {
      throw new InternalServerErrorException('AWS S3 storage is not configured');
    }
  }

  private categoryForMime(mimeType: string): StorageCategory {
    const normalized = String(mimeType || '').toLowerCase();
    if (normalized.startsWith('image/')) return 'image';
    if (normalized.startsWith('video/')) return 'video';
    if (normalized.startsWith('audio/')) return 'audio';
    return 'file';
  }

  private canPreview(mimeType: string) {
    const normalized = String(mimeType || '').toLowerCase();
    return normalized.startsWith('image/') ||
      normalized.startsWith('video/') ||
      normalized.startsWith('audio/') ||
      normalized.startsWith('text/') ||
      ['application/pdf', 'application/json', 'application/xml'].includes(normalized);
  }

  private safeSegment(value: string) {
    return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100) || 'unknown';
  }

  private safeFileStem(fileName: string) {
    const extension = extname(fileName);
    const stem = fileName.slice(0, Math.max(0, fileName.length - extension.length));
    return stem.normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'file';
  }

  private contentDisposition(fileName: string, mode: SignedUrlMode) {
    const asciiFallback = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'download';
    return `${mode}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  }
}
