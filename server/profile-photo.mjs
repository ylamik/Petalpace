import sharp from 'sharp'

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024
let processing = 0
export async function prepareProfilePhoto(base64) {
  if (typeof base64 !== 'string' || !base64 || base64.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw Object.assign(new Error('Choose a JPG, PNG, or WebP image no larger than 2 MB.'), { status: 400 })
  }
  const input = Buffer.from(base64, 'base64')
  if (input.length > MAX_PHOTO_BYTES) throw Object.assign(new Error('Your photo must be 2 MB or smaller.'), { status: 413 })
  const supportedSignature = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || input.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    || (input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP')
  if (!supportedSignature) throw Object.assign(new Error('Choose a real JPG, PNG, or WebP photo.'), { status: 400 })
  if (processing >= 2) throw Object.assign(new Error('Please try your upload again in a moment.'), { status: 429 })
  processing++
  try {
    const image = sharp(input, { limitInputPixels: 4096 * 4096, failOn: 'warning', animated: false })
    const info = await image.metadata()
    if (!['jpeg', 'png', 'webp'].includes(info.format) || (info.pages || 1) !== 1 || !info.width || !info.height || info.width > 4096 || info.height > 4096) throw new Error('Unsupported image')
    // Decode and re-encode, rather than trusting an extension/MIME or storing user bytes.
    // Metadata is stripped by default; output is a bounded static square image.
    return await image.rotate().resize(512, 512, { fit: 'cover' }).webp({ quality: 82 }).toBuffer()
  } catch {
    throw Object.assign(new Error('Use a valid, non-animated JPG, PNG, or WebP photo, up to 4096 × 4096 pixels.'), { status: 400 })
  } finally { processing-- }
}
