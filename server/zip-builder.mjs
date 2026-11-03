/**
 * Minimal ZIP builder — no dependencies, pure Node.js.
 * Uses STORE (no compression) — fine for already-compressed binaries
 * (PDF, DOCX, PPTX) and for small text files like CSV.
 */

// CRC-32 table (pre-computed polynomial 0xEDB88320)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0   // unsigned 32-bit
}

function u16(buf, off, v) { buf[off] = v & 0xFF; buf[off + 1] = (v >>> 8) & 0xFF }
function u32(buf, off, v) { u16(buf, off, v); u16(buf, off + 2, v >>> 16) }

/**
 * Build a ZIP archive buffer.
 * @param {Array<{name: string, data: Buffer|Uint8Array|string}>} entries
 * @returns {Buffer}
 */
export function buildZip(entries) {
  const parts = []
  const centralDir = []
  let offset = 0

  // Fixed DOS date: 2026-01-01 00:00:00
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1
  const dosTime = 0

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8')
    const data = entry.data instanceof Buffer
      ? entry.data
      : Buffer.from(entry.data instanceof Uint8Array ? entry.data : String(entry.data), 'utf8')
    const size = data.length
    const crc  = crc32(data)

    // Local file header (30 + name length bytes)
    const lh = Buffer.alloc(30 + nameBytes.length)
    u32(lh,  0, 0x04034B50)        // signature PK\x03\x04
    u16(lh,  4, 20)                // version needed: 2.0
    u16(lh,  6, 0x0800)            // general flag: UTF-8 filename
    u16(lh,  8, 0)                 // compression: STORE
    u16(lh, 10, dosTime)
    u16(lh, 12, dosDate)
    u32(lh, 14, crc)
    u32(lh, 18, size)              // compressed size
    u32(lh, 22, size)              // uncompressed size
    u16(lh, 26, nameBytes.length)
    u16(lh, 28, 0)                 // extra field length
    nameBytes.copy(lh, 30)

    // Central directory entry (46 + name length bytes) — collected for later
    const cd = Buffer.alloc(46 + nameBytes.length)
    u32(cd,  0, 0x02014B50)        // signature PK\x01\x02
    u16(cd,  4, 20)                // version made by
    u16(cd,  6, 20)                // version needed
    u16(cd,  8, 0x0800)            // flags
    u16(cd, 10, 0)                 // compression: STORE
    u16(cd, 12, dosTime)
    u16(cd, 14, dosDate)
    u32(cd, 16, crc)
    u32(cd, 20, size)              // compressed
    u32(cd, 24, size)              // uncompressed
    u16(cd, 28, nameBytes.length)
    u16(cd, 30, 0)                 // extra length
    u16(cd, 32, 0)                 // comment length
    u16(cd, 34, 0)                 // disk number start
    u16(cd, 36, 0)                 // internal attributes
    u32(cd, 38, 0)                 // external attributes
    u32(cd, 42, offset)            // offset of local file header
    nameBytes.copy(cd, 46)

    parts.push(lh, data)
    centralDir.push(cd)
    offset += lh.length + size
  }

  // Concatenate central directory
  const cdBuf  = Buffer.concat(centralDir)
  const cdSize = cdBuf.length
  const cdOff  = offset

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22)
  u32(eocd,  0, 0x06054B50)          // signature PK\x05\x06
  u16(eocd,  4, 0)                   // disk number
  u16(eocd,  6, 0)                   // cd start disk
  u16(eocd,  8, entries.length)      // entries on this disk
  u16(eocd, 10, entries.length)      // total entries
  u32(eocd, 12, cdSize)              // central directory size
  u32(eocd, 16, cdOff)               // central directory offset
  u16(eocd, 20, 0)                   // comment length

  return Buffer.concat([...parts, cdBuf, eocd])
}
