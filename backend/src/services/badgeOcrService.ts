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

  // SIA licence number: printed on the card as 16 digits in groups of four;
  // older internal format "SIA" + 6-7 digits still accepted
  const cardNoMatch = allText.match(/\b(\d{4})\s?(\d{4})\s?(\d{4})\s?(\d{4})\b/)
  const siaMatch = allText.match(/SIA\s*0*(\d{6,7})\b/i)
  const sia_license_number = cardNoMatch
    ? cardNoMatch.slice(1, 5).join('')
    : siaMatch ? `SIA${siaMatch[1].padStart(7, '0')}` : null

  // Expiry date: look for keywords followed by dd/mm/yyyy or dd-mm-yyyy
  // (SIA cards print "EXPIRES 01 JAN 2029"; numeric months and / or - separators also accepted)
  const expiryMatch = allText.match(
    /(expir[ey]s?|valid\s+until|valid\s+to)[:\s]+(\d{1,2})[\/\-\s]+([A-Za-z]{3,9}|\d{1,2})[\/\-\s]+(\d{4})/i
  )
  let sia_expiry_date: string | null = null
  if (expiryMatch) {
    const [, , day, mon, year] = expiryMatch
    const month = /^\d+$/.test(mon)
      ? Number(mon)
      : ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(mon.slice(0, 3).toLowerCase()) + 1
    if (month >= 1 && month <= 12) {
      sia_expiry_date = `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`
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
