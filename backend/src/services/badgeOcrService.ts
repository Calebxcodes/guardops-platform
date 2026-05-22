import { RekognitionClient, DetectTextCommand } from '@aws-sdk/client-rekognition'

const client = new RekognitionClient({
  region: process.env.AWS_REGION || 'eu-west-2',
})

export interface ExtractedBadgeData {
  sia_license_number: string | null
  sia_expiry_date: string | null
  badge_number: string | null
  card_type: string | null
  confidence: number
  raw_text: string
}

export async function extractBadgeData(imageBuffer: Buffer): Promise<ExtractedBadgeData> {
  const response = await client.send(new DetectTextCommand({
    Image: { Bytes: imageBuffer }
  }))

  const detections = response.TextDetections || []
  const allText = detections.map(t => t.DetectedText || '').join(' ')

  // SIA License Number: "SIA" followed by 6-7 digits
  const siaMatch = allText.match(/SIA\s*0*(\d{6,7})/i)
  const sia_license_number = siaMatch ? `SIA${siaMatch[1].padStart(7, '0')}` : null

  // Expiry date: look for keywords followed by dd/mm/yyyy or dd-mm-yyyy
  const expiryMatch = allText.match(
    /(expir[ey]s?|valid\s+until|valid\s+to)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i
  )
  let sia_expiry_date: string | null = null
  if (expiryMatch) {
    const parts = expiryMatch[2].split(/[\/\-]/)
    if (parts.length === 3) {
      sia_expiry_date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
  }

  // Badge number: alphanumeric pattern like "CMD-001" or "SB/12345"
  const badgeMatch = allText.match(/\b([A-Z]{2,4}[\/\-]\d{3,5})\b/)
  const badge_number = badgeMatch ? badgeMatch[1] : null

  // Card type
  const cardTypeMatch = allText.match(/\b(Frontline|Standard|Manager|Supervisor|Basic)\b/i)
  const card_type = cardTypeMatch ? cardTypeMatch[1] : null

  const confidence = detections.length > 0
    ? detections.filter(t => (t.Confidence || 0) > 90).length / detections.length
    : 0

  return { sia_license_number, sia_expiry_date, badge_number, card_type, confidence, raw_text: allText }
}

export function isBadgeExpired(expiryDateStr: string): boolean {
  return new Date(expiryDateStr) < new Date()
}
