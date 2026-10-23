import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.AWS_REGION = 'eu-west-2'
  process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
  process.env.AWS_ACCESS_KEY_ID = 'AKIATESTTESTTESTTEST'
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-test-secret-test-secret-0000'
})

const load = () => import('../services/s3Service')
const HOST = 'https://test-bucket.s3.eu-west-2.amazonaws.com'

describe('private uploads bucket links', () => {
  it('extracts the key from canonical and signed URLs in our bucket', async () => {
    const { keyFromUrl } = await load()
    expect(keyFromUrl(`${HOST}/badges/1-abc.jpg`)).toBe('badges/1-abc.jpg')
    expect(keyFromUrl(`${HOST}/badges/1-abc.jpg?X-Amz-Signature=x`)).toBe('badges/1-abc.jpg')
  })

  it('rejects URLs outside our bucket', async () => {
    const { keyFromUrl, canonicalUrl } = await load()
    expect(keyFromUrl('https://evil.example.com/badges/1.jpg')).toBeNull()
    expect(keyFromUrl('http://test-bucket.s3.eu-west-2.amazonaws.com/x.jpg')).toBeNull()
    expect(keyFromUrl('not a url')).toBeNull()
    expect(canonicalUrl('https://evil.example.com/x.jpg')).toBeNull()
  })

  it('stores the canonical form of a signed link', async () => {
    const { canonicalUrl } = await load()
    expect(canonicalUrl(`${HOST}/badges/1-abc.jpg?X-Amz-Expires=900&X-Amz-Signature=x`)).toBe(`${HOST}/badges/1-abc.jpg`)
  })

  it('signs a short-lived GET link for objects in our bucket only', async () => {
    const { signedUrl } = await load()
    const url = new URL((await signedUrl(`${HOST}/tax-docs/1-abc.pdf`))!)
    expect(url.hostname).toBe('test-bucket.s3.eu-west-2.amazonaws.com')
    expect(url.pathname).toBe('/tax-docs/1-abc.pdf')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy()
    expect(await signedUrl('https://evil.example.com/x.pdf')).toBeNull()
  })
})
