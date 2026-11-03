import { inflateRawSync } from 'node:zlib'
// Bounded structural check, not a malware scanner. Never extracts files to disk.
export function isOfficePackage(buffer, extension) {
  try {
    let end = -1
    for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { end = i; break }
    }
    if (end < 0 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) return false
    const count = buffer.readUInt16LE(end + 10), size = buffer.readUInt32LE(end + 12), start = buffer.readUInt32LE(end + 16)
    if (!count || count > 4096 || count !== buffer.readUInt16LE(end + 8) || start + size !== end) return false
    let offset = start
    const entries = new Map()
    for (let i = 0; i < count; i++) {
      if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) return false
      const flags = buffer.readUInt16LE(offset + 8), method = buffer.readUInt16LE(offset + 10)
      const compressed = buffer.readUInt32LE(offset + 20), expanded = buffer.readUInt32LE(offset + 24)
      const n = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32)
      const local = buffer.readUInt32LE(offset + 42)
      if (offset + 46 + n + extra + comment > end || flags & 1 || ![0,8].includes(method)) return false
      const name = buffer.toString('utf8', offset + 46, offset + 46 + n)
      if (!name || entries.has(name) || name.includes('..') || name.includes('\\') || name.startsWith('/') || /vbaProject\.bin$/i.test(name)) return false
      if (local + 30 > start || buffer.readUInt32LE(local) !== 0x04034b50) return false
      const localName = buffer.readUInt16LE(local + 26), localExtra = buffer.readUInt16LE(local + 28)
      const dataStart = local + 30 + localName + localExtra
      if (buffer.toString('utf8',local+30,local+30+localName) !== name || dataStart + compressed > start) return false
      entries.set(name, {method,compressed,expanded,dataStart})
      offset += 46 + n + extra + comment
    }
    if (offset !== end || !entries.has('_rels/.rels') || !entries.has(extension === 'docx' ? 'word/document.xml' : 'ppt/presentation.xml')) return false
    const types = entries.get('[Content_Types].xml')
    if (!types || types.expanded > 262144) return false
    const data = buffer.subarray(types.dataStart,types.dataStart+types.compressed)
    const xml = (types.method === 8 ? inflateRawSync(data,{maxOutputLength:262144}) : data).toString('utf8')
    if (Buffer.byteLength(xml) > 262144 || /<!DOCTYPE|<!ENTITY|macroEnabled/i.test(xml)) return false
    return xml.includes(extension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml')
  } catch { return false }
}
