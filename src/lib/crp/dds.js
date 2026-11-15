// DXT1 / DXT5 (BC1 / BC3) encoder + DDS container writer, with full mip chains.
// Cities: Skylines stores Texture2D assets inside CRP files as plain DDS bytes.

function downsample(src, w, h) {
  const w2 = Math.max(1, w >> 1), h2 = Math.max(1, h >> 1);
  const out = new Uint8Array(w2 * h2 * 4);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    for (let c = 0; c < 4; c++) {
      let s = 0, n = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const sx = Math.min(w - 1, x * 2 + dx), sy = Math.min(h - 1, y * 2 + dy);
        s += src[(sy * w + sx) * 4 + c]; n++;
      }
      out[(y * w2 + x) * 4 + c] = Math.round(s / n);
    }
  }
  return { data: out, w: w2, h: h2 };
}

const to565 = (r, g, b) => ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
const from565 = (c) => {
  const r = (c >> 11) & 31, g = (c >> 5) & 63, b = c & 31;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
};

function encodeColorBlock(px, out, o) {
  let minR = 255, minG = 255, minB = 255, maxR = 0, maxG = 0, maxB = 0;
  for (let i = 0; i < 16; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    if (r < minR) minR = r; if (g < minG) minG = g; if (b < minB) minB = b;
    if (r > maxR) maxR = r; if (g > maxG) maxG = g; if (b > maxB) maxB = b;
  }
  const ir = (maxR - minR) >> 4, ig = (maxG - minG) >> 4, ib = (maxB - minB) >> 4;
  let c0 = to565(maxR - ir, maxG - ig, maxB - ib);
  let c1 = to565(minR + ir, minG + ig, minB + ib);
  if (c0 < c1) { const t = c0; c0 = c1; c1 = t; }
  out[o] = c0 & 255; out[o + 1] = c0 >> 8; out[o + 2] = c1 & 255; out[o + 3] = c1 >> 8;
  if (c0 === c1) { out[o + 4] = out[o + 5] = out[o + 6] = out[o + 7] = 0; return; }
  const p0 = from565(c0), p1 = from565(c1);
  const pal = [p0, p1, p0.map((v, k) => Math.round((2 * v + p1[k]) / 3)), p0.map((v, k) => Math.round((v + 2 * p1[k]) / 3))];
  let bits = 0;
  for (let i = 15; i >= 0; i--) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < 4; k++) {
      const dr = px[i * 4] - pal[k][0], dg = px[i * 4 + 1] - pal[k][1], db = px[i * 4 + 2] - pal[k][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; best = k; }
    }
    bits = ((bits << 2) | best) >>> 0;
  }
  out[o + 4] = bits & 255; out[o + 5] = (bits >> 8) & 255; out[o + 6] = (bits >> 16) & 255; out[o + 7] = (bits >>> 24) & 255;
}

function encodeAlphaBlock(px, out, o) {
  let a0 = 0, a1 = 255;
  for (let i = 0; i < 16; i++) { const a = px[i * 4 + 3]; if (a > a0) a0 = a; if (a < a1) a1 = a; }
  out[o] = a0; out[o + 1] = a1;
  if (a0 === a1) { for (let k = 2; k < 8; k++) out[o + k] = 0; return; }
  const pal = [a0, a1];
  for (let k = 1; k <= 6; k++) pal.push(Math.round(((7 - k) * a0 + k * a1) / 7));
  let lo = 0, hi = 0; // 48 bits as two 24-bit halves
  for (let i = 0; i < 16; i++) {
    const a = px[i * 4 + 3];
    let best = 0, bd = 1e9;
    for (let k = 0; k < 8; k++) { const d = Math.abs(a - pal[k]); if (d < bd) { bd = d; best = k; } }
    if (i < 8) lo |= best << (3 * i); else hi |= best << (3 * (i - 8));
  }
  out[o + 2] = lo & 255; out[o + 3] = (lo >> 8) & 255; out[o + 4] = (lo >> 16) & 255;
  out[o + 5] = hi & 255; out[o + 6] = (hi >> 8) & 255; out[o + 7] = (hi >> 16) & 255;
}

function encodeLevel(data, w, h, format) {
  const bw = Math.max(1, (w + 3) >> 2), bh = Math.max(1, (h + 3) >> 2);
  const bs = format === 'DXT5' ? 16 : 8;
  const out = new Uint8Array(bw * bh * bs);
  const px = new Uint8Array(64);
  let o = 0;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const sx = Math.min(w - 1, bx * 4 + x), sy = Math.min(h - 1, by * 4 + y);
      const s = (sy * w + sx) * 4, d = (y * 4 + x) * 4;
      px[d] = data[s]; px[d + 1] = data[s + 1]; px[d + 2] = data[s + 2]; px[d + 3] = data[s + 3];
    }
    if (format === 'DXT5') { encodeAlphaBlock(px, out, o); encodeColorBlock(px, out, o + 8); } else encodeColorBlock(px, out, o);
    o += bs;
  }
  return out;
}

export function encodeDDS({ width, height, rgba, format = 'DXT1', mips = true }) {
  const levels = [];
  let cur = { data: rgba, w: width, h: height };
  for (;;) {
    levels.push(encodeLevel(cur.data, cur.w, cur.h, format));
    if (!mips || (cur.w === 1 && cur.h === 1)) break;
    cur = downsample(cur.data, cur.w, cur.h);
  }
  const total = 128 + levels.reduce((a, l) => a + l.length, 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  out.set([0x44, 0x44, 0x53, 0x20], 0); // "DDS "
  dv.setUint32(4, 124, true);
  dv.setUint32(8, 0x1 | 0x2 | 0x4 | 0x1000 | 0x80000 | (mips ? 0x20000 : 0), true);
  dv.setUint32(12, height, true);
  dv.setUint32(16, width, true);
  dv.setUint32(20, levels[0].length, true);
  dv.setUint32(28, levels.length, true);
  dv.setUint32(76, 32, true); // pixel format size
  dv.setUint32(80, 0x4, true); // DDPF_FOURCC
  out.set([...format].map((c) => c.charCodeAt(0)), 84);
  dv.setUint32(108, 0x1000 | (mips ? 0x400008 : 0), true);
  let off = 128;
  for (const l of levels) { out.set(l, off); off += l.length; }
  return out;
}

// Minimal DDS reader used by the validator: returns header info + top-level decoded size.
export function readDDSInfo(bytes) {
  if (bytes.length < 128 || bytes[0] !== 0x44 || bytes[1] !== 0x44 || bytes[2] !== 0x53 || bytes[3] !== 0x20) throw new Error('not a DDS file');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    height: dv.getUint32(12, true), width: dv.getUint32(16, true), mips: dv.getUint32(28, true),
    fourCC: String.fromCharCode(bytes[84], bytes[85], bytes[86], bytes[87]),
  };
}
