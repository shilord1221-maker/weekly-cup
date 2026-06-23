import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { env } from '@/env.js';

let client: S3Client | null = null;

export function isStorageConfigured(): boolean {
  return !!(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY && env.S3_PUBLIC_URL);
}

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: env.S3_ENDPOINT,
      credentials: { accessKeyId: env.S3_ACCESS_KEY!, secretAccessKey: env.S3_SECRET_KEY! },
    });
  }
  return client;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export class UploadError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function uploadImage(buffer: Buffer, contentType: string, folder: string): Promise<string> {
  if (!isStorageConfigured()) {
    throw new UploadError('STORAGE_NOT_CONFIGURED', 'Загрузка файлов сейчас недоступна — обратитесь к администратору');
  }
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new UploadError('INVALID_FILE_TYPE', 'Поддерживаются только изображения: JPEG, PNG, WEBP, GIF');
  }
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new UploadError('FILE_TOO_LARGE', 'Файл слишком большой — максимум 8MB');
  }

  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : contentType === 'image/gif' ? 'gif' : 'jpg';
  const key = `${folder}/${randomUUID()}.${ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return `${env.S3_PUBLIC_URL!.replace(/\/$/, '')}/${key}`;
}

export async function deleteImageByUrl(url: string): Promise<void> {
  if (!isStorageConfigured() || !env.S3_PUBLIC_URL) return;
  const prefix = `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/`;
  if (!url.startsWith(prefix)) return;

  const key = url.slice(prefix.length);
  await getClient()
    .send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
    .catch(() => {});
}
