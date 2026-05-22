import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'

const s3 = new S3Client({ region: process.env.AWS_REGION || 'eu-west-2' })
const BUCKET = process.env.AWS_S3_BUCKET_NAME || 'strondis-uploads'

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
  return `https://${BUCKET}.s3.${process.env.AWS_REGION || 'eu-west-2'}.amazonaws.com/${key}`
}

export async function deleteFromS3(url: string): Promise<void> {
  try {
    const key = url.split('.amazonaws.com/')[1]
    if (!key) return
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
  } catch { /* best-effort — don't throw on cleanup failure */ }
}
