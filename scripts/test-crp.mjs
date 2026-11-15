// End-to-end test of the CRP pipeline without the browser: build packages for several
// structures, re-read them with the independent validator, and fail on any problem.
import fs from 'node:fs';
import path from 'node:path';
import pngjs from 'pngjs';
import { generateCrp, generateKit } from '../src/lib/crp/pipeline.js';
import { readCrp } from '../src/lib/crp/reader.js';

const { PNG } = pngjs;
const out = process.argv[2] || path.join(process.cwd(), '.test-out');
fs.mkdirSync(out, { recursive: true });

function atlasPng(size) {
  const p = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = (y * size + x) * 4;
    const band = Math.floor((y / (size * 0.875)) * 3);
    const c = y >= size * 0.875 ? [150, 156, 162] : band === 0 ? [255, 153, 51] : band === 1 ? [255, 255, 255] : [19, 136, 8];
    p.data[o] = c[0]; p.data[o + 1] = c[1]; p.data[o + 2] = c[2]; p.data[o + 3] = 255;
  }
  return PNG.sync.write(p);
}

const base = {
  board: { widthM: 4, heightM: 2, thicknessM: 0.08, cornerRadiusM: 0.12, frame: { enabled: true, widthM: 0.05, depthM: 0.03 } },
  poles: { mode: 'double', radiusM: 0.06, mountHeightM: 2.2, inset: 0.18 },
  flag: { poleHeightM: 8, poleRadiusM: 0.05, finial: true, waveAmpM: 0.25, waves: 1.5 },
};
const mat = { faceSpec: 0.5, frameSpec: 0.5, poleSpec: 0.5, backSpec: 0.3, illuminated: false };
const cases = {
  board_double: { ...base, kind: 'board' },
  board_single_sharp: { ...base, kind: 'board', board: { ...base.board, cornerRadiusM: 0, frame: { enabled: false, widthM: 0, depthM: 0 } }, poles: { ...base.poles, mode: 'single' } },
  board_no_poles: { ...base, kind: 'board', poles: { ...base.poles, mode: 'none', mountHeightM: 0 } },
  flag: { ...base, kind: 'flag', board: { ...base.board, widthM: 3, heightM: 2, cornerRadiusM: 0 } },
};

let failed = 0;
for (const [label, spec] of Object.entries(cases)) {
  try {
    const r = generateCrp({ spec, atlasPng: atlasPng(256), name: `Test ${label}`, author: '', tags: ['Prop', 'Signboard'], mat });
    fs.writeFileSync(path.join(out, r.fileName), r.bytes);
    const again = readCrp(r.bytes);
    const bad = again.checks.filter((c) => !c.ok);
    console.log(`PASS ${label}: ${r.fileName} ${(r.bytes.length / 1024).toFixed(1)} KB, ${r.summary.vertices} verts, ${r.summary.triangles} tris, ${again.checks.length} checks`);
    if (bad.length) throw new Error('failed checks: ' + JSON.stringify(bad));
    if (Buffer.from(r.bytes.subarray(0, 4)).toString('ascii') !== 'CRAP') throw new Error('bad magic');
  } catch (e) { failed++; console.log(`FAIL ${label}: ${e.message}`); }
}
const kit = generateKit({ spec: cases.board_double, atlasPng: atlasPng(256), name: 'Kit', mat });
fs.writeFileSync(path.join(out, kit.fileName), kit.bytes);
console.log(`kit ${kit.fileName} ${kit.bytes.length} bytes`);
process.exit(failed ? 1 : 0);
