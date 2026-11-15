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

export function generateCrp({ spec, atlasPng, name, author, tags, mat }) {
  const atlas = decodeAtlas(atlasPng);
  const mesh = buildSignMesh(spec);
  const asset = safeName(name);
  const built = buildCrp({ name: asset, author, tags, mesh, atlas, faceV0: ATLAS.faceV0, mat });
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
