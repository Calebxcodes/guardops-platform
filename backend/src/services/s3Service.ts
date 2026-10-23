import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'

const REGION = process.env.AWS_REGION || 'eu-west-2'
const s3 = new S3Client({ region: REGION })
const BUCKET = process.env.AWS_S3_BUCKET_NAME || 'strondis-uploads'
const HOST = `${BUCKET}.s3.${REGION}.amazonaws.com`

// The bucket is private. The DB stores the canonical object URL; clients only
// ever receive short-lived signed links to it.
const SIGNED_URL_TTL_SECONDS = 15 * 60

export async function uploadToS3(buffer: Buffer, mimeType: string, prefix: string): Promise<string> {
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'bin'
  const key = `${prefix}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ServerSideEncryption: 'AES256',
  }))
  return `https://${HOST}/${key}`
}

/** Object key for a URL in our bucket (canonical or signed), or null for anything else. */
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || u.hostname !== HOST) return null
    const key = decodeURIComponent(u.pathname.replace(/^\/+/, ''))
    return key || null
  } catch {
    return null
  }
}

/** Canonical stored form of a URL in our bucket; null if it isn't one. */
export function canonicalUrl(url: string | null | undefined): string | null {
  const key = keyFromUrl(url)
  return key ? `https://${HOST}/${key}` : null
}

/** Short-lived signed download link for a stored URL; null if it isn't in our bucket. */
export async function signedUrl(url: string | null | undefined): Promise<string | null> {
  const key = keyFromUrl(url)
  if (!key) return null
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: SIGNED_URL_TTL_SECONDS })
}

/** Returns copies of rows with the given URL field replaced by a signed link. */
export async function withSignedUrls<T extends Record<string, any>>(rows: T[], field: keyof T): Promise<T[]> {
  return Promise.all(rows.map(async r => ({ ...r, [field]: await signedUrl(r[field]) })))
}

export async function deleteFromS3(url: string): Promise<void> {
  try {
    const key = keyFromUrl(url)
    if (!key) return
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
  } catch { /* best-effort — don't throw on cleanup failure */ }
}
