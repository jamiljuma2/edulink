import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function getR2Config() {
  const accountId = getRequiredEnv('R2_ACCOUNT_ID');
  const accessKeyId = getRequiredEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getRequiredEnv('R2_SECRET_ACCESS_KEY');
  const bucket = getRequiredEnv('R2_BUCKET');
  const endpoint = String(process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`).trim();
  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint };
}

let cachedClient: S3Client | null = null;

export function getR2Client() {
  if (cachedClient) return cachedClient;
  const { accessKeyId, secretAccessKey, endpoint } = getR2Config();
  cachedClient = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

export function getR2BucketName() {
  return getR2Config().bucket;
}

export async function createR2UploadUrl(key: string, contentType?: string, expiresInSec = 900) {
  const client = getR2Client();
  const bucket = getR2BucketName();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSec });
}

export async function createR2ReadUrl(key: string, expiresInSec = 3600) {
  const client = getR2Client();
  const bucket = getR2BucketName();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSec });
}

export function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}
