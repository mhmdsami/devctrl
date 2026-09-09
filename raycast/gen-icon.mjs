import zlib from 'zlib'
import fs from 'fs'

const S = 512
const px = Buffer.alloc(S * S * 4)

function set(x, y, r, g, b, a = 255) {
  const i = (y * S + x) * 4
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a
}

function inRoundedRect(x, y, x0, y0, x1, y1, rad) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.max(x0 + rad, Math.min(x, x1 - rad))
  const cy = Math.max(y0 + rad, Math.min(y, y1 - rad))
  const dx = x - cx, dy = y - cy
  return dx * dx + dy * dy <= rad * rad
}
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let hit = 0
    for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      if (inRoundedRect(x + ox, y + oy, 16, 16, S - 17, S - 17, 96)) hit++
    }
    if (hit === 0) continue
    const a = (hit / 4) * 255
    set(x, y, 24, 28, 38, a)
  }
}
function distToSeg(px0, py0, px1, py1, x, y) {
  const dx = px1 - px0, dy = py1 - py0
  const t = Math.max(0, Math.min(1, ((x - px0) * dx + (y - py0) * dy) / (dx * dx + dy * dy)))
  const cx = px0 + t * dx, cy = py0 + t * dy
  return Math.hypot(x - cx, y - cy)
}
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const d = Math.min(distToSeg(160, 160, 260, 256, x, y), distToSeg(260, 256, 160, 352, x, y))
    if (d <= 26) set(x, y, 82, 196, 118)
  }
}
for (let y = 300; y < 352; y++) {
  for (let x = 300; x < 400; x++) {
    if (x < S && y < S) set(x, y, 82, 196, 118)
  }
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) >>> 0 : crc32(body))
  return Buffer.concat([len, body, crc])
}
function crc32(buf) {
  let c, table = []
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0 }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4)
ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
const raw = Buffer.alloc(S * (S * 4 + 1))
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0
  px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4)
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])
fs.writeFileSync(new URL('./assets/icon.png', import.meta.url), png)
console.log('icon written:', png.length, 'bytes')
