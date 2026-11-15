// Independent CRP reader/validator. It mirrors the structure checks of the open-source
// OfflineCrpConverter reader (container bounds, per-type payload parsing, checksum cross references),
// so every exported package is re-parsed before it is handed to the user.

import crypto from 'node:crypto';
import { ByteReader } from './binary.js';
import { readDDSInfo } from './dds.js';

const typeName = (s) => s.split(',')[0];

function readValue(r, t) {
  if (t.endsWith('[]')) { const el = t.slice(0, -2); return r.array(() => readValue(r, el)); }
  switch (t) {
    case 'System.String': case 'System.DateTime': case 'ItemClass': case 'ColossalFramework.Packaging.Package+Asset': case 'PropInfoGen': return r.str();
    case 'UnityEngine.Vector3': return r.v3();
    case 'ItemClass+Level': case 'ItemClass+Service': case 'ItemClass+SubService': case 'VehicleInfo+VehicleType': case 'SteamHelper+DLC_BitMask': return r.i32();
    case 'System.Single': return r.f32();
    case 'System.Int32': case 'CustomAssetMetaData+Type': return r.i32();
    case 'System.Boolean': return r.bool();
    default: throw new Error('unsupported serialized type ' + t);
  }
}

export function readCrp(bytes) {
  const r = new ByteReader(bytes);
  const checks = [];
  const ok = (cond, msg) => { checks.push({ ok: !!cond, msg }); if (!cond) throw Object.assign(new Error(msg), { checks }); };
  ok(r.ascii(4) === 'CRAP', 'magic "CRAP"');
  const version = r.u16();
  ok(version >= 3 && version <= 10, `format version ${version} in supported range`);
  const pkgName = r.str(); r.str(); r.u32();
  const mainAsset = r.str();
  const count = r.i32();
  const contentStart = r.i64();
  ok(count > 0 && contentStart > 0 && contentStart < bytes.length, 'asset count and content offset plausible');
  const headers = [];
  for (let i = 0; i < count; i++) {
    const h = { name: r.str(), checksum: r.str(), type: r.i32(), offset: r.i64(), size: r.i64() };
    ok(h.offset >= 0 && h.size > 0 && contentStart + h.offset + h.size <= bytes.length, `asset "${h.name}" range inside file`);
    headers.push(h);
  }
  ok(r.pos === contentStart, 'header length equals declared content start');

  const meshes = {}, textures = {}, materials = {}, objects = {}, metas = {}, images = {}, gens = {}, userData = {};
  for (const h of headers) {
    r.pos = contentStart + h.offset;
    const end = r.pos + h.size;
    const md5 = crypto.createHash('md5').update(bytes.subarray(r.pos, end)).digest('hex');
    ok(md5 === h.checksum, `asset "${h.name}" checksum matches its payload`);
    if (r.bool()) continue;
    const t = typeName(r.str());
    const objName = r.str();
    if (t === 'UnityEngine.Mesh') {
      const pos = r.array((x) => x.v3()), col = r.array((x) => x.v4()), uv = r.array((x) => x.v2()), nrm = r.array((x) => x.v3()), tan = r.array((x) => x.v4());
      r.array((x) => { for (let k = 0; k < 4; k++) { x.i32(); x.f32(); } return 0; });
      r.array((x) => { for (let k = 0; k < 16; k++) x.f32(); return 0; });
      const sm = r.i32();
      const tris = []; for (let k = 0; k < sm; k++) tris.push(r.array((x) => x.i32()));
      ok(nrm.length === pos.length && uv.length === pos.length && tan.length === pos.length, `mesh "${objName}" attribute counts match vertex count`);
      ok(tris.every((a) => a.length % 3 === 0 && a.every((i) => i >= 0 && i < pos.length)), `mesh "${objName}" indices valid`);
      ok(r.pos === end, `mesh "${objName}" payload consumed exactly`);
      meshes[h.checksum] = { vertices: pos.length, triangles: tris.reduce((a, b) => a + b.length / 3, 0), subMeshes: sm, positions: pos, normals: nrm, indices: tris };
    } else if (t === 'UnityEngine.Texture2D') {
      const forceLinear = r.bool(); if (version >= 6) r.i32();
      const len = r.u32();
      const data = r.bytes(len);
      const dds = readDDSInfo(data);
      ok(r.pos === end, `texture "${objName}" payload consumed exactly`);
      textures[h.checksum] = { forceLinear, ...dds, name: objName };
    } else if (t === 'UnityEngine.Material') {
      const shader = r.str(); const n = r.i32(); const tex = {};
      for (let k = 0; k < n; k++) {
        const pt = r.i32(); const pn = r.str();
        if (pt === 0 || pt === 1) r.v4(); else if (pt === 2) r.f32(); else if (pt === 3) tex[pn] = r.bool() ? '' : r.str(); else throw new Error('bad material property type');
      }
      ok(r.pos === end, `material "${objName}" payload consumed exactly`);
      materials[h.checksum] = { shader, textures: tex };
    } else if (t === 'UnityEngine.GameObject') {
      r.str(); r.i32(); r.bool();
      const n = r.i32(); const o = { name: objName, mesh: null, mats: [], prefab: null, props: {} };
      for (let k = 0; k < n; k++) {
        if (r.bool()) continue;
        const ct = typeName(r.str());
        if (ct === 'UnityEngine.Transform') { r.v3(); r.v4(); r.v3(); }
        else if (ct === 'UnityEngine.MeshFilter') o.mesh = r.str();
        else if (ct === 'UnityEngine.MeshRenderer') o.mats = r.array((x) => x.str());
        else if (ct === 'PropInfo') {
          o.prefab = ct; const pc = r.i32();
          for (let q = 0; q < pc; q++) { if (r.bool()) continue; const vt = typeName(r.str()); const vn = r.str(); o.props[vn] = readValue(r, vt); }
        } else throw new Error('unknown component ' + ct);
      }
      ok(r.pos === end, `game object "${objName}" payload consumed exactly`);
      objects[h.checksum] = o;
    } else if (t === 'ColossalFramework.Importers.Image') {
      r.bool(); r.i32(); const len = r.u32(); const data = r.bytes(len);
      ok(data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47, `image "${objName}" is a PNG`);
      ok(r.pos === end, `image "${objName}" payload consumed exactly`);
      images[h.checksum] = { name: objName, width: (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19], height: (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23] };
    } else if (t === 'AssetDataWrapper+UserAssetData') {
      userData[h.checksum] = true;
    } else if (t === 'PropInfoGen') {
      const pc = r.i32(); const g = {};
      for (let q = 0; q < pc; q++) { if (r.bool()) continue; const vt = typeName(r.str()); const vn = r.str(); g[vn] = readValue(r, vt); }
      ok(r.pos === end, `generated info "${objName}" payload consumed exactly`);
      gens[h.checksum] = g;
    } else if (t === 'CustomAssetMetaData') {
      const pc = r.i32(); const m = {};
      for (let q = 0; q < pc; q++) { if (r.bool()) continue; const vt = typeName(r.str()); const vn = r.str(); m[vn] = readValue(r, vt); }
      ok(r.pos === end, `metadata "${objName}" payload consumed exactly`);
      metas[h.checksum] = m;
    }
  }
  // cross references
  const objs = Object.values(objects);
  ok(objs.length === 1 && objs[0].prefab === 'PropInfo', 'exactly one PropInfo prefab object');
  const o = objs[0];
  ok(meshes[o.mesh], 'prefab MeshFilter references an existing mesh');
  ok(o.mats.length === 1 && materials[o.mats[0]], 'prefab MeshRenderer references an existing material');
  const mat = materials[o.mats[0]];
  for (const slot of ['_MainTex', '_XYSMap', '_ACIMap']) ok(textures[mat.textures[slot]], `material slot ${slot} references an existing texture`);
  const meta = Object.values(metas)[0];
  ok(meta && objects[meta.assetRef], 'metadata assetRef references the prefab object');
  ok(images[meta.imageRef] && images[meta.steamPreviewRef], 'metadata imageRef / steamPreviewRef reference existing preview images');
  ok(userData[meta.userDataRef], 'metadata userDataRef references the UserAssetData asset');
  ok(gens[o.props.m_generatedInfo], 'prefab m_generatedInfo references an existing PropInfoGen');
  ok(Object.keys(meta).length === 24, 'metadata carries all 24 members of a genuine package');
  const mesh = meshes[o.mesh];
  // winding / normal agreement (catches a wrong handedness conversion)
  let agree = 0, total = 0;
  for (const tri of mesh.indices) for (let i = 0; i < tri.length; i += 3) {
    const a = mesh.positions[tri[i]], b = mesh.positions[tri[i + 1]], c = mesh.positions[tri[i + 2]];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    // Unity (left-handed) front faces are clockwise => the numeric cross product points along the vertex normal
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    const n = mesh.normals[tri[i]];
    const d = cx * n[0] + cy * n[1] + cz * n[2];
    if (Math.hypot(cx, cy, cz) > 1e-9) { total++; if (d > 0) agree++; }
  }
  ok(total > 0 && agree / total > 0.995, `triangle winding is Unity-clockwise for ${(100 * agree / Math.max(1, total)).toFixed(1)}% of faces`);
  return {
    version, packageName: pkgName, mainAsset, assetCount: count, mesh: { vertices: mesh.vertices, triangles: mesh.triangles },
    textures: Object.values(textures).map((t) => ({ name: t.name, width: t.width, height: t.height, mips: t.mips, format: t.fourCC, linear: t.forceLinear })),
    shader: mat.shader, checks,
  };
}
