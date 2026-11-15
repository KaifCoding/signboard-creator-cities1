// Shared mesh generator. Used by the 3D preview (browser) AND the CRP exporter (server),
// so what you see in the preview is exactly the geometry that gets packaged.
// Coordinates: right-handed, Y up, +Z is the front of the board, 1 unit = 1 metre.

export const ATLAS = {
  faceV0: 0.125, // face texture occupies v in [faceV0, 1]; the bottom strip holds flat-colour swatches
  swatch: {
    frame: [0.125, 0.0625],
    pole: [0.375, 0.0625],
    back: [0.625, 0.0625],
    extra: [0.875, 0.0625],
  },
};

class MeshBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  v(p, n, uv) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.uv.push(uv[0], uv[1]); return this.p.length / 3 - 1; }
  // Adds a triangle and flips winding if it disagrees with the vertex normals (CCW = front face).
  tri(a, b, c) {
    const P = this.p, N = this.n;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const e1 = [P[b * 3] - ax, P[b * 3 + 1] - ay, P[b * 3 + 2] - az];
    const e2 = [P[c * 3] - ax, P[c * 3 + 1] - ay, P[c * 3 + 2] - az];
    const cx = e1[1] * e2[2] - e1[2] * e2[1];
    const cy = e1[2] * e2[0] - e1[0] * e2[2];
    const cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * cx + cy * cy + cz * cz < 1e-14) return; // degenerate
    const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
    if (cx * nx + cy * ny + cz * nz >= 0) this.i.push(a, b, c); else this.i.push(a, c, b);
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
}

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// Rounded-rectangle outline, CCW seen from +Z. Point count depends only on (r > 0), so an
// outline and its offset copy (frame) always have matching vertex counts.
export function outline(w, h, r, seg = 6) {
  const pts = [];
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2 - 1e-4));
  const hw = w / 2, hh = h / 2;
  if (r <= 1e-5) return [[hw, -hh], [hw, hh], [-hw, hh], [-hw, -hh]];
  const corners = [[hw - r, hh - r, 0], [-hw + r, hh - r, 90], [-hw + r, -hh + r, 180], [hw - r, -hh + r, 270]];
  for (const [cx, cy, a0] of corners) {
    for (let k = 0; k <= seg; k++) {
      const a = ((a0 + (90 * k) / seg) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
}

function edgeNormals(pts) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    out.push([dy / l, -dx / l]);
  }
  return out;
}

function addWall(mb, pts, z0, z1, uv, inward = false) {
  const n = pts.length, en = edgeNormals(pts);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const eN = en[i], pN = en[(i - 1 + n) % n], nN = en[j];
    const sm = (o) => (eN[0] * o[0] + eN[1] * o[1] > 0.9 ? norm([eN[0] + o[0], eN[1] + o[1], 0]) : [eN[0], eN[1], 0]);
    let n0 = sm(pN), n1 = sm(nN);
    if (inward) { n0 = [-n0[0], -n0[1], 0]; n1 = [-n1[0], -n1[1], 0]; }
    const a = mb.v([pts[i][0], pts[i][1], z0], n0, uv);
    const b = mb.v([pts[j][0], pts[j][1], z0], n1, uv);
    const c = mb.v([pts[j][0], pts[j][1], z1], n1, uv);
    const d = mb.v([pts[i][0], pts[i][1], z1], n0, uv);
    mb.quad(a, b, c, d);
  }
}

function addCylinder(mb, cx, cz, r, y0, y1, uv, seg = 16, capTop = true, capBottom = false) {
  const ring0 = [], ring1 = [];
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    const nx = Math.cos(a), nz = Math.sin(a);
    ring0.push(mb.v([cx + r * nx, y0, cz + r * nz], [nx, 0, nz], uv));
    ring1.push(mb.v([cx + r * nx, y1, cz + r * nz], [nx, 0, nz], uv));
  }
  for (let k = 0; k < seg; k++) { const j = (k + 1) % seg; mb.quad(ring0[k], ring0[j], ring1[j], ring1[k]); }
  const cap = (y, ny, flip) => {
    const c = mb.v([cx, y, cz], [0, ny, 0], uv);
    const ids = [];
    for (let k = 0; k < seg; k++) { const a = (k / seg) * Math.PI * 2; ids.push(mb.v([cx + r * Math.cos(a), y, cz + r * Math.sin(a)], [0, ny, 0], uv)); }
    for (let k = 0; k < seg; k++) mb.tri(c, ids[k], ids[(k + 1) % seg]);
  };
  if (capTop) cap(y1, 1);
  if (capBottom) cap(y0, -1);
}

function addSphere(mb, cx, cy, cz, r, uv, lat = 6, lon = 12) {
  const rows = [];
  for (let i = 0; i <= lat; i++) {
    const th = (i / lat) * Math.PI;
    const row = [];
    for (let j = 0; j < lon; j++) {
      const ph = (j / lon) * Math.PI * 2;
      const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      row.push(mb.v([cx + r * n[0], cy + r * n[1], cz + r * n[2]], n, uv));
    }
    rows.push(row);
  }
  for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) {
    const k = (j + 1) % lon;
    mb.quad(rows[i][j], rows[i][k], rows[i + 1][k], rows[i + 1][j]);
  }
}

const faceUV = (u, v, texel = 0.002) => {
  const v0 = ATLAS.faceV0;
  return [texel + u * (1 - 2 * texel), v0 + texel + v * (1 - v0 - 2 * texel)];
};

function buildBoard(mb, s) {
  const { widthM: w, heightM: h, thicknessM: t, cornerRadiusM: r } = s.board;
  const fr = s.board.frame || {};
  const fw = fr.enabled ? fr.widthM : 0;
  const fd = fr.enabled ? fr.depthM : 0;
  const poles = s.poles;
  const bottom = Math.max(0, poles.mountHeightM) + fw;
  const cy = bottom + h / 2;
  const sw = ATLAS.swatch;

  const pts = outline(w, h, r).map(([x, y]) => [x, y + cy]);
  const hz = t / 2;
  // front face (design texture)
  const front = [];
  const c = mb.v([0, cy, hz], [0, 0, 1], faceUV(0.5, 0.5));
  for (const [x, y] of pts) front.push(mb.v([x, y, hz], [0, 0, 1], faceUV(x / w + 0.5, (y - cy) / h + 0.5)));
  for (let i = 0; i < pts.length; i++) mb.tri(c, front[i], front[(i + 1) % pts.length]);
  // back face
  const cb = mb.v([0, cy, -hz], [0, 0, -1], sw.back);
  const back = pts.map(([x, y]) => mb.v([x, y, -hz], [0, 0, -1], sw.back));
  for (let i = 0; i < pts.length; i++) mb.tri(cb, back[i], back[(i + 1) % pts.length]);
  // edge wall
  addWall(mb, pts, -hz, hz, sw.back);

  if (fr.enabled && fw > 0) {
    const outer = outline(w + 2 * fw, h + 2 * fw, r > 0 ? r + fw : 0).map(([x, y]) => [x, y + cy]);
    const zf = hz + fd;
    const n = pts.length;
    const inF = pts.map(([x, y]) => mb.v([x, y, zf], [0, 0, 1], sw.frame));
    const outF = outer.map(([x, y]) => mb.v([x, y, zf], [0, 0, 1], sw.frame));
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; mb.quad(inF[i], outF[i], outF[j], inF[j]); }
    const inB = pts.map(([x, y]) => mb.v([x, y, -hz], [0, 0, -1], sw.frame));
    const outB = outer.map(([x, y]) => mb.v([x, y, -hz], [0, 0, -1], sw.frame));
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; mb.quad(inB[i], outB[j], outB[i], inB[j]); }
    addWall(mb, outer, -hz, zf, sw.frame);
    addWall(mb, pts, hz, zf, sw.frame, true);
  }

  if (poles.mode !== 'none') {
    const pr = poles.radiusM;
    const z = -(hz + pr);
    const top = cy + h / 2 - Math.min(0.12, h * 0.1);
    const xs = poles.mode === 'single' ? [0] : [-(w / 2 - w * poles.inset), w / 2 - w * poles.inset];
    for (const x of xs) {
      addCylinder(mb, x, z, pr, 0, Math.max(top, 0.2), sw.pole, 16, true, false);
      // mounting clamps
      for (const yy of [cy - h * 0.3, cy + h * 0.3]) {
        if (yy > 0.1 && yy < top) addCylinder(mb, x, z, pr * 1.35, yy - 0.04, yy + 0.04, sw.pole, 16, true, true);
      }
    }
  }
}

function buildFlag(mb, s) {
  const { widthM: w, heightM: h } = s.board;
  const f = s.flag;
  const sw = ATLAS.swatch;
  const pr = f.poleRadiusM;
  addCylinder(mb, 0, 0, 0.28, 0, 0.06, sw.pole, 20, true, false); // base plate
  addCylinder(mb, 0, 0, pr, 0.06, f.poleHeightM, sw.pole, 14, f.finial ? false : true, false);
  if (f.finial) addSphere(mb, 0, f.poleHeightM + pr * 1.6, 0, pr * 2.1, sw.pole);
  const top = f.poleHeightM - 0.15;
  const nx = 28, ny = 14;
  const z = (u, v) => f.waveAmpM * u * Math.sin(u * Math.PI * 2 * f.waves + v * 1.2);
  const pos = (u, v) => [pr + u * w, top - v * h, z(u, v)];
  const fv = [], bv = [];
  const eps = 1e-3;
  for (let j = 0; j <= ny; j++) {
    const rowF = [], rowB = [];
    for (let i = 0; i <= nx; i++) {
      const u = i / nx, v = j / ny;
      const p = pos(u, v);
      const pu = pos(Math.min(1, u + eps), v), pu0 = pos(Math.max(0, u - eps), v);
      const pv = pos(u, Math.min(1, v + eps)), pv0 = pos(u, Math.max(0, v - eps));
      const du = [pu[0] - pu0[0], pu[1] - pu0[1], pu[2] - pu0[2]], dv = [pv[0] - pv0[0], pv[1] - pv0[1], pv[2] - pv0[2]];
      let nrm = norm([du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]]);
      if (nrm[2] < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
      rowF.push(mb.v(p, nrm, faceUV(u, 1 - v)));
      rowB.push(mb.v(p, [-nrm[0], -nrm[1], -nrm[2]], faceUV(1 - u, 1 - v)));
    }
    fv.push(rowF); bv.push(rowB);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    mb.quad(fv[j][i], fv[j + 1][i], fv[j + 1][i + 1], fv[j][i + 1]);
    mb.quad(bv[j][i], bv[j + 1][i], bv[j + 1][i + 1], bv[j][i + 1]);
  }
}

export function computeTangents(pos, nrm, uv, idx) {
  const n = pos.length / 3;
  const tan1 = new Float32Array(n * 3), tan2 = new Float32Array(n * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
    const x1 = pos[i1 * 3] - pos[i0 * 3], y1 = pos[i1 * 3 + 1] - pos[i0 * 3 + 1], z1 = pos[i1 * 3 + 2] - pos[i0 * 3 + 2];
    const x2 = pos[i2 * 3] - pos[i0 * 3], y2 = pos[i2 * 3 + 1] - pos[i0 * 3 + 1], z2 = pos[i2 * 3 + 2] - pos[i0 * 3 + 2];
    const s1 = uv[i1 * 2] - uv[i0 * 2], s2 = uv[i2 * 2] - uv[i0 * 2];
    const t1 = uv[i1 * 2 + 1] - uv[i0 * 2 + 1], t2 = uv[i2 * 2 + 1] - uv[i0 * 2 + 1];
    const d = s1 * t2 - s2 * t1;
    if (Math.abs(d) < 1e-12) continue;
    const r = 1 / d;
    const sx = (t2 * x1 - t1 * x2) * r, sy = (t2 * y1 - t1 * y2) * r, sz = (t2 * z1 - t1 * z2) * r;
    const tx = (s1 * x2 - s2 * x1) * r, ty = (s1 * y2 - s2 * y1) * r, tz = (s1 * z2 - s2 * z1) * r;
    for (const i of [i0, i1, i2]) {
      tan1[i * 3] += sx; tan1[i * 3 + 1] += sy; tan1[i * 3 + 2] += sz;
      tan2[i * 3] += tx; tan2[i * 3 + 1] += ty; tan2[i * 3 + 2] += tz;
    }
  }
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const N = [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]];
    let T = [tan1[i * 3], tan1[i * 3 + 1], tan1[i * 3 + 2]];
    const d = N[0] * T[0] + N[1] * T[1] + N[2] * T[2];
    T = [T[0] - N[0] * d, T[1] - N[1] * d, T[2] - N[2] * d];
    if (Math.hypot(...T) < 1e-8) {
      // degenerate (flat-colour swatches): any vector perpendicular to the normal
      T = Math.abs(N[1]) < 0.9 ? [N[2], 0, -N[0]] : [1, 0, 0];
    }
    T = norm(T);
    const B = [N[1] * T[2] - N[2] * T[1], N[2] * T[0] - N[0] * T[2], N[0] * T[1] - N[1] * T[0]];
    const w = B[0] * tan2[i * 3] + B[1] * tan2[i * 3 + 1] + B[2] * tan2[i * 3 + 2] < 0 ? -1 : 1;
    out[i * 4] = T[0]; out[i * 4 + 1] = T[1]; out[i * 4 + 2] = T[2]; out[i * 4 + 3] = w;
  }
  return out;
}

export function buildSignMesh(spec) {
  const mb = new MeshBuilder();
  if (spec.kind === 'flag') buildFlag(mb, spec); else buildBoard(mb, spec);
  const positions = new Float32Array(mb.p);
  const normals = new Float32Array(mb.n);
  const uvs = new Float32Array(mb.uv);
  const indices = new Uint32Array(mb.i);
  const tangents = computeTangents(positions, normals, uvs, indices);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], positions[i + k]); max[k] = Math.max(max[k], positions[i + k]);
  }
  return { positions, normals, uvs, indices, tangents, bbox: { min, max }, vertexCount: positions.length / 3, triangleCount: indices.length / 3 };
}

// Right-handed (three.js) -> Unity left-handed: mirror Z. Index order stays the same because the
// mirror flips apparent winding from CCW to CW, which is Unity's front-face convention.
export function toUnity(mesh) {
  const n = mesh.vertexCount;
  const positions = new Float32Array(n * 3), normals = new Float32Array(n * 3), tangents = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = mesh.positions[i * 3]; positions[i * 3 + 1] = mesh.positions[i * 3 + 1]; positions[i * 3 + 2] = -mesh.positions[i * 3 + 2];
    normals[i * 3] = mesh.normals[i * 3]; normals[i * 3 + 1] = mesh.normals[i * 3 + 1]; normals[i * 3 + 2] = -mesh.normals[i * 3 + 2];
    tangents[i * 4] = mesh.tangents[i * 4]; tangents[i * 4 + 1] = mesh.tangents[i * 4 + 1]; tangents[i * 4 + 2] = -mesh.tangents[i * 4 + 2]; tangents[i * 4 + 3] = -mesh.tangents[i * 4 + 3];
  }
  // Mirroring Z keeps the screen-space winding counter-clockwise, but Unity front faces are clockwise:
  // reverse every triangle. Unity also reads DDS rows bottom-up, so flip V.
  const indices = mesh.indices.slice();
  for (let i = 0; i + 2 < indices.length; i += 3) { const t = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = t; }
  const uvs = new Float32Array(mesh.uvs.length);
  for (let i = 0; i < uvs.length; i += 2) { uvs[i] = mesh.uvs[i]; uvs[i + 1] = 1 - mesh.uvs[i + 1]; }
  return { ...mesh, positions, normals, tangents, indices, uvs };
}
