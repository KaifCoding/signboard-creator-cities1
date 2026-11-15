// Server-side export pipeline: spec + atlas PNG -> validated .crp (or fallback kit).
import pngjs from 'pngjs';
import { buildSignMesh, ATLAS } from '../geometry.js';
import { buildCrp, buildMaps } from './writer.js';
import { readCrp } from './reader.js';
import { zipStore, toObj } from './kit.js';

const { PNG } = pngjs;

export function safeName(s) {
  const base = String(s || 'Signboard').normalize('NFKD').replace(/[^A-Za-z0-9_\- ]+/g, '').trim().replace(/\s+/g, '_');
  return (base || 'Signboard').slice(0, 48);
}

export function decodeAtlas(pngBuffer) {
  const png = PNG.sync.read(pngBuffer);
  return { width: png.width, height: png.height, data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length) };
}

// Preview image for the Content Manager: the design (top part of the atlas) fitted onto a dark backdrop.
export function makePreviewPng(atlas, faceV0, W, H) {
  const fh = Math.max(1, Math.round(atlas.height * (1 - faceV0))), fw = atlas.width;
  const out = new PNG({ width: W, height: H });
  const margin = Math.round(Math.min(W, H) * 0.08);
  const sc = Math.min((W - 2 * margin) / fw, (H - 2 * margin) / fh);
  const dw = fw * sc, dh = fh * sc, ox = (W - dw) / 2, oy = (H - dh) / 2;
  const bg = [16, 20, 27];
  const sample = (fx, fy) => { // bilinear
    const x0 = Math.max(0, Math.min(fw - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(fh - 1, Math.floor(fy)));
    const x1 = Math.min(fw - 1, x0 + 1), y1 = Math.min(fh - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    const px = (x, y, c) => atlas.data[(y * atlas.width + x) * 4 + c];
    return [0, 1, 2, 3].map((c) => (px(x0, y0, c) * (1 - tx) + px(x1, y0, c) * tx) * (1 - ty) + (px(x0, y1, c) * (1 - tx) + px(x1, y1, c) * tx) * ty);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4;
    let c = bg;
    if (x >= ox && x < ox + dw && y >= oy && y < oy + dh) {
      // 2x2 supersample to keep downscaled text readable
      const acc = [0, 0, 0, 0];
      for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { const v = sample((x + dx - ox) / sc, (y + dy - oy) / sc); for (let k = 0; k < 4; k++) acc[k] += v[k] / 4; }
      const a = acc[3] / 255;
      c = [0, 1, 2].map((k) => acc[k] * a + bg[k] * (1 - a));
    }
    out.data[o] = c[0]; out.data[o + 1] = c[1]; out.data[o + 2] = c[2]; out.data[o + 3] = 255;
  }
  return new Uint8Array(PNG.sync.write(out));
}

export function generateCrp({ spec, atlasPng, name, author, tags, mat }) {
  const atlas = decodeAtlas(atlasPng);
  const mesh = buildSignMesh(spec);
  const asset = safeName(name);
  const snapshotPng = makePreviewPng(atlas, ATLAS.faceV0, 400, 224);
  const steamPng = makePreviewPng(atlas, ATLAS.faceV0, 644, 360);
  const built = buildCrp({ name: asset, author, tags, mesh, atlas, faceV0: ATLAS.faceV0, mat, snapshotPng, steamPng });
  // Re-parse the freshly written bytes with the independent reader. If anything is off, fail loudly.
  const parsed = readCrp(built.bytes);
  return { fileName: `${asset}.crp`, bytes: built.bytes, summary: built.summary, validation: parsed };
}

export function generateKit({ spec, atlasPng, name, mat }) {
  const atlas = decodeAtlas(atlasPng);
  const mesh = buildSignMesh(spec);
  const asset = safeName(name);
  const maps = buildMaps(atlas.width, ATLAS.faceV0, mat);
  const png = (data) => { const p = new PNG({ width: atlas.width, height: atlas.height }); Buffer.from(data.buffer, data.byteOffset, data.length).copy(p.data); return PNG.sync.write(p); };
  const enc = new TextEncoder();
  const readme = [
    `${asset} - Asset Editor import kit`,
    '',
    'This is NOT a .crp. It is the same model and textures that the .crp contains, for manual import:',
    `  ${asset}.obj   model (metres, Y up). Convert to FBX (e.g. Blender) for the Cities: Skylines Asset Editor.`,
    `  ${asset}_d.png diffuse, ${asset}_s.png normal(XY)+specular (XYS), ${asset}_i.png alpha/colour/illumination (ACI)`,
    'In the Asset Editor, name the textures _d / _s / _i and use the Props shader.',
  ].join('\n');
  const zip = zipStore([
    { name: `${asset}.obj`, data: toObj(mesh, asset) },
    { name: `${asset}.mtl`, data: enc.encode(`newmtl ${asset}_mat\nKd 1 1 1\nmap_Kd ${asset}_d.png\n`) },
    { name: `${asset}_d.png`, data: png(atlas.data) },
    { name: `${asset}_s.png`, data: png(maps.xys) },
    { name: `${asset}_i.png`, data: png(maps.aci) },
    { name: 'README.txt', data: enc.encode(readme) },
  ]);
  return { fileName: `${asset}_import_kit.zip`, bytes: zip };
}
