import { buildZip } from './zip-builder.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'

test('ZIP builder produces valid PK archive with correct signatures', () => {
  const zip = buildZip([
    { name: 'tasks.csv', data: Buffer.from('\uFEFFTitle,Space\r\n"My task","School"\r\n', 'utf8') },
    { name: 'files/My task/notes.pdf', data: Buffer.from('%PDF-1.4 test') },
  ])
  // Local file header signature PK\x03\x04
  assert.equal(zip[0], 0x50)
  assert.equal(zip[1], 0x4B)
  assert.equal(zip[2], 0x03)
  assert.equal(zip[3], 0x04)
  // End of central directory signature PK\x05\x06
  const eocd = zip.slice(-22)
  assert.equal(eocd[0], 0x50)
  assert.equal(eocd[1], 0x4B)
  assert.equal(eocd[2], 0x05)
  assert.equal(eocd[3], 0x06)
  // Two entries
  assert.equal(eocd[8] | (eocd[9] << 8), 2)
  console.log('ZIP ok:', zip.length, 'bytes')
})
