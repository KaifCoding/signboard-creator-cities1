// Cities: Skylines 1 "CRAP" (.crp) package writer.
//
// Container layout (from the public CRAP documentation and the open-source readers):
//   "CRAP" | u16 formatVersion | str packageName | str author | u32 packageVersion | str mainAssetName
//   | i32 assetCount | i64 contentStart | { str name, str checksum, i32 type, i64 offset, i64 size } * assetCount
//   | asset payloads (offsets are relative to contentStart)
// Every payload starts with: bool isNull(false) | str assemblyQualifiedTypeName | str objectName | type-specific data.
// Strings are .NET BinaryWriter strings (7-bit length prefix + UTF-8).
//
// The type-name strings below were cross-checked against the first-byte table published with crp-extract
// (0x54 Mesh, 0x58 Material, 0x59 Texture2D, 0x5A GameObject, 0x5B CustomAssetMetaData) - their lengths match.

import crypto from 'node:crypto';
import { ByteWriter } from './binary.js';
import { encodeDDS } from './dds.js';
import { toUnity } from '../geometry.js';

export const CRP_FORMAT_VERSION = 6;

const U = (n) => `${n}, UnityEngine, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null`;
const A = (n) => `${n}, Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null`;
const S = (n) => `${n}, mscorlib, Version=2.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089`;

export const TYPES = {
  Mesh: U('UnityEngine.Mesh'),
  Material: U('UnityEngine.Material'),
  Texture2D: U('UnityEngine.Texture2D'),
  GameObject: U('UnityEngine.GameObject'),
  Transform: U('UnityEngine.Transform'),
  MeshFilter: U('UnityEngine.MeshFilter'),
  MeshRenderer: U('UnityEngine.MeshRenderer'),
  PropInfo: A('PropInfo'),
  CustomAssetMetaData: A('CustomAssetMetaData'),
  MetaType: A('CustomAssetMetaData+Type'),
  ItemClass: A('ItemClass'),
  PackageAsset: 'ColossalFramework.Packaging.Package+Asset, ColossalManaged, Version=0.3.0.0, Culture=neutral, PublicKeyToken=null',
  Image: 'ColossalFramework.Importers.Image, ColossalManaged, Version=0.3.0.0, Culture=neutral, PublicKeyToken=null',
  PropInfoGen: A('PropInfoGen'),
  Vector3: U('UnityEngine.Vector3'),
  ModInfoArray: A('ModInfo[]'),
  Level: A('ItemClass+Level'),
  Service: A('ItemClass+Service'),
  SubService: A('ItemClass+SubService'),
  VehicleType: A('VehicleInfo+VehicleType'),
  DlcMask: A('SteamHelper+DLC_BitMask'),
  Single: S('System.Single'),
  Boolean: S('System.Boolean'),
  Int32: S('System.Int32'),
  String: S('System.String'),
  StringArray: S('System.String[]'),
  DateTime: S('System.DateTime'),
};

export const ASSET_TYPE = { Object: 1, Material: 2, Texture: 3, StaticMesh: 4, UserMetaData: 103 };

export const SHADER = 'Custom/Props/Prop/Default';
// CustomAssetMetaData.Type ordinal for "Prop" (best available knowledge - see README limitations)
export const META_TYPE_PROP = 2;

const md5 = (bytes) => crypto.createHash('md5').update(bytes).digest('hex');

function meshAsset(name, m) {
  const w = new ByteWriter(m.vertexCount * 60 + 4096);
  w.bool(false).str(TYPES.Mesh).str(name);
  const n = m.vertexCount;
  w.i32(n); for (let i = 0; i < n; i++) w.v3(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]);
  w.i32(0); // vertex colours (none)
  w.i32(n); for (let i = 0; i < n; i++) w.v2(m.uvs[i * 2], m.uvs[i * 2 + 1]);
  w.i32(n); for (let i = 0; i < n; i++) w.v3(m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2]);
  w.i32(n); for (let i = 0; i < n; i++) w.v4(m.tangents[i * 4], m.tangents[i * 4 + 1], m.tangents[i * 4 + 2], m.tangents[i * 4 + 3]);
  w.i32(0); // bone weights
  w.i32(0); // bind poses
  w.i32(1); // sub-mesh count
  w.i32(m.indices.length); for (let i = 0; i < m.indices.length; i++) w.i32(m.indices[i]);
  return w.result();
}

function textureAsset(name, dds, forceLinear) {
  const w = new ByteWriter(dds.length + 256);
  w.bool(false).str(TYPES.Texture2D).str(name);
  w.bool(forceLinear);
  w.i32(1); // anisoLevel (format version >= 6)
  w.u32(dds.length).bytes(dds);
  return w.result();
}

function materialAsset(name, shader, colors, textures) {
  const w = new ByteWriter(2048);
  w.bool(false).str(TYPES.Material).str(name).str(shader);
  w.i32(colors.length + textures.length);
  for (const [k, v] of colors) w.i32(0).str(k).v4(...v);
  for (const [k, checksum] of textures) w.i32(3).str(k).bool(false).str(checksum);
  return w.result();
}

function prop(w, type, name, writeValue) { w.bool(false).str(type).str(name); writeValue(w); }

function gameObjectAsset(name, meshChecksum, materialChecksum, genChecksum, propParams) {
  const w = new ByteWriter(4096);
  w.bool(false).str(TYPES.GameObject).str(name);
  w.str('Untagged').i32(0).bool(false);
  w.i32(4); // components
  w.bool(false).str(TYPES.Transform).v3(0, 0, 0).v4(0, 0, 0, 1).v3(1, 1, 1);
  w.bool(false).str(TYPES.MeshFilter).str(meshChecksum);
  w.bool(false).str(TYPES.MeshRenderer).i32(1).str(materialChecksum);
  w.bool(false).str(TYPES.PropInfo);
  const fields = [
    [TYPES.ItemClass, 'm_class', (x) => x.str(propParams.itemClass)],
    [TYPES.Single, 'm_minScale', (x) => x.f32(1)],
    [TYPES.Single, 'm_maxScale', (x) => x.f32(1)],
    [TYPES.Boolean, 'm_isDecal', (x) => x.bool(false)],
    [TYPES.Boolean, 'm_isMarker', (x) => x.bool(false)],
    [TYPES.Boolean, 'm_hasRenderer', (x) => x.bool(true)],
    [TYPES.Single, 'm_lodRenderDistance', (x) => x.f32(propParams.lodDistance)],
    [TYPES.PropInfoGen, 'm_generatedInfo', (x) => x.str(genChecksum)],
  ];
  w.i32(fields.length);
  for (const [t, n, fn] of fields) prop(w, t, n, fn);
  return w.result();
}

// Member list copied from a genuine package (CustomAssetMetaData, 24 members) - the game reads members by name.
function metadataAsset(name, refs, tags, when, extra) {
  const w = new ByteWriter(4096);
  w.bool(false).str(TYPES.CustomAssetMetaData).str(name);
  const I = (v) => (x) => x.i32(v);
  const fields = [
    [TYPES.String, 'name', (x) => x.str(name)],
    [TYPES.DateTime, 'timeStamp', (x) => x.str(when)],
    [TYPES.PackageAsset, 'imageRef', (x) => x.str(refs.snapshot)],
    [TYPES.PackageAsset, 'steamPreviewRef', (x) => x.str(refs.steamPreview)],
    [TYPES.StringArray, 'steamTags', (x) => { x.i32(tags.length); for (const t of tags) x.str(t); }],
    [TYPES.String, 'guid', (x) => x.str(extra.guid)],
    [TYPES.MetaType, 'type', I(META_TYPE_PROP)],
    [TYPES.ModInfoArray, 'mods', I(0)],
    [TYPES.Int32, 'width', I(0)],
    [TYPES.Int32, 'length', I(0)],
    [TYPES.Level, 'level', I(0)],
    [TYPES.Service, 'service', I(0)],
    [TYPES.SubService, 'subService', I(0)],
    [TYPES.VehicleType, 'vehicleType', I(0)],
    [TYPES.DlcMask, 'dlcMask', I(0)],
    [TYPES.Int32, 'triangles', I(extra.triangles)],
    [TYPES.Int32, 'lodTriangles', I(0)],
    [TYPES.Int32, 'textureHeight', I(extra.textureSize)],
    [TYPES.Int32, 'textureWidth', I(extra.textureSize)],
    [TYPES.Int32, 'lodTextureHeight', I(0)],
    [TYPES.Int32, 'lodTextureWidth', I(0)],
    [TYPES.String, 'templateName', (x) => x.str('')],
    [TYPES.PackageAsset, 'userDataRef', (x) => x.str(refs.userData)],
    [TYPES.PackageAsset, 'assetRef', (x) => x.str(refs.object)],
  ];
  w.i32(fields.length);
  for (const [t, n, fn] of fields) prop(w, t, n, fn);
  return w.result();
}

// Preview images are stored as ColossalFramework.Importers.Image: bool, i32 (1), u32 length, PNG bytes.
function imageAsset(name, png) {
  const w = new ByteWriter(png.length + 256);
  w.bool(false).str(TYPES.Image).str(name);
  w.bool(false).i32(1).u32(png.length).bytes(png);
  return w.result();
}

// Constant asset present in every package (copied byte-for-byte from a genuine package: empty UserAssetData dictionary).
const USER_ASSET_DATA = Uint8Array.from(Buffer.from('AGZBc3NldERhdGFXcmFwcGVyK1VzZXJBc3NldERhdGEsIEFzc2VtYmx5LUNTaGFycCwgVmVyc2lvbj0wLjAuMC4wLCBDdWx0dXJlPW5ldXRyYWwsIFB1YmxpY0tleVRva2VuPW51bGwNVXNlckFzc2V0RGF0YQEAAAAArwJTeXN0ZW0uQ29sbGVjdGlvbnMuR2VuZXJpYy5EaWN0aW9uYXJ5YDJbW1N5c3RlbS5TdHJpbmcsIG1zY29ybGliLCBWZXJzaW9uPTIuMC4wLjAsIEN1bHR1cmU9bmV1dHJhbCwgUHVibGljS2V5VG9rZW49Yjc3YTVjNTYxOTM0ZTA4OV0sW1N5c3RlbS5CeXRlW10sIG1zY29ybGliLCBWZXJzaW9uPTIuMC4wLjAsIEN1bHR1cmU9bmV1dHJhbCwgUHVibGljS2V5VG9rZW49Yjc3YTVjNTYxOTM0ZTA4OV1dLCBtc2NvcmxpYiwgVmVyc2lvbj0yLjAuMC4wLCBDdWx0dXJlPW5ldXRyYWwsIFB1YmxpY0tleVRva2VuPWI3N2E1YzU2MTkzNGUwODkLbV9Bc3NldERhdGEAAAAA', 'base64'));

// PropInfoGen: size and surface areas of the mesh (used by the game for LOD / generated data).
function genAsset(name, g) {
  const w = new ByteWriter(1024);
  w.bool(false).str(TYPES.PropInfoGen).str(name);
  const fields = [
    [TYPES.Vector3, 'm_size', (x) => x.v3(g.size[0], g.size[1], g.size[2])],
    [TYPES.Single, 'm_triangleArea', (x) => x.f32(g.triangleArea)],
    [TYPES.Single, 'm_uvmapArea', (x) => x.f32(g.uvmapArea)],
  ];
  w.i32(fields.length);
  for (const [t, n, fn] of fields) prop(w, t, n, fn);
  return w.result();
}

function meshStats(m) {
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], tri = 0, uv = 0;
  for (let i = 0; i < m.vertexCount; i++) for (let k = 0; k < 3; k++) { const v = m.positions[i * 3 + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  for (let i = 0; i < m.indices.length; i += 3) {
    const a = m.indices[i] * 3, b = m.indices[i + 1] * 3, c = m.indices[i + 2] * 3;
    const e1 = [m.positions[b] - m.positions[a], m.positions[b + 1] - m.positions[a + 1], m.positions[b + 2] - m.positions[a + 2]];
    const e2 = [m.positions[c] - m.positions[a], m.positions[c + 1] - m.positions[a + 1], m.positions[c + 2] - m.positions[a + 2]];
    tri += 0.5 * Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]);
    const ua = m.indices[i] * 2, ub = m.indices[i + 1] * 2, uc = m.indices[i + 2] * 2;
    uv += 0.5 * Math.abs((m.uvs[ub] - m.uvs[ua]) * (m.uvs[uc + 1] - m.uvs[ua + 1]) - (m.uvs[uc] - m.uvs[ua]) * (m.uvs[ub + 1] - m.uvs[ua + 1]));
  }
  return { size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], triangleArea: tri, uvmapArea: uv };
}

// ---- texture maps ------------------------------------------------------------------------------
// Atlas layout: face = rows [0, (1-faceV0)*size); bottom strip = 4 equal swatches
// (frame | pole | back | extra). The same layout drives the diffuse, XYS (normal+specular) and ACI maps.
function regionMap(size, faceV0, faceFn, swatchFns) {
  const data = new Uint8Array(size * size * 4);
  const faceRows = Math.round(size * (1 - faceV0));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = y < faceRows ? faceFn : swatchFns[Math.min(3, Math.floor((x / size) * 4))];
    const o = (y * size + x) * 4;
    data[o] = px[0]; data[o + 1] = px[1]; data[o + 2] = px[2]; data[o + 3] = px[3];
  }
  return data;
}

export function buildMaps(size, faceV0, mat) {
  const spec = (v) => Math.round(255 * (1 - Math.max(0, Math.min(1, v)))); // XYS.B is stored inverted
  const xys = regionMap(size, faceV0, [128, 128, spec(mat.faceSpec), 255], [
    [128, 128, spec(mat.frameSpec), 255], [128, 128, spec(mat.poleSpec), 255], [128, 128, spec(mat.backSpec), 255], [128, 128, 255, 255],
  ]);
  const lit = mat.illuminated ? 255 : 0;
  // ACI: R = inverted alpha (0 = opaque), G = colour-variation mask (0 = none), B = illumination.
  const aci = regionMap(size, faceV0, [0, 0, lit, 255], [[0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255]]);
  return { xys, aci };
}

export function buildCrp({ name, author = '', tags = [], mesh, atlas, faceV0, mat, whenIso, snapshotPng, steamPng }) {
  if (!name) throw new Error('asset name required');
  if (!snapshotPng || !steamPng) throw new Error('preview images required');
  const size = atlas.width;
  if (atlas.width !== atlas.height || (size & (size - 1)) !== 0) throw new Error('atlas must be a square power-of-two texture');
  const unity = toUnity(mesh);
  const maps = buildMaps(size, faceV0, mat);

  const parts = [];
  const add = (assetName, type, bytes) => { const rec = { assetName, type, bytes, checksum: md5(bytes) }; parts.push(rec); return rec; };

  const steam = add(`${name}_SteamPreview`, ASSET_TYPE.Texture, imageAsset(`${name}_SteamPreview`, steamPng));
  const snap = add(`${name}_Snapshot`, ASSET_TYPE.Texture, imageAsset(`${name}_Snapshot`, snapshotPng));
  const dMain = add(`${name}_d`, ASSET_TYPE.Texture, textureAsset(`${name}_d`, encodeDDS({ width: size, height: size, rgba: atlas.data, format: 'DXT1' }), false));
  const dXys = add(`${name}_s`, ASSET_TYPE.Texture, textureAsset(`${name}_s`, encodeDDS({ width: size, height: size, rgba: maps.xys, format: 'DXT5' }), true));
  const dAci = add(`${name}_i`, ASSET_TYPE.Texture, textureAsset(`${name}_i`, encodeDDS({ width: size, height: size, rgba: maps.aci, format: 'DXT1' }), true));
  const mat_ = add(`${name}_Material`, ASSET_TYPE.Material, materialAsset(`${name}_Material`, SHADER, [['_Color', [1, 1, 1, 1]]], [
    ['_MainTex', dMain.checksum], ['_XYSMap', dXys.checksum], ['_ACIMap', dAci.checksum],
  ]));
  const meshRec = add(`${name}_Mesh`, ASSET_TYPE.StaticMesh, meshAsset(`${name}_Mesh`, unity));
  // generated-info companion: its entry name carries its own checksum, like genuine packages ("<name>_Data - <md5>")
  const genBytes = genAsset(`${name}_Data`, meshStats(unity));
  const genChecksum = md5(genBytes);
  const genRec = { assetName: `${name}_Data - ${genChecksum}`, type: ASSET_TYPE.Object, bytes: genBytes, checksum: genChecksum }; parts.push(genRec);
  const objRec = add(`${name}_Data`, ASSET_TYPE.Object, gameObjectAsset(`${name}_Data`, meshRec.checksum, mat_.checksum, genChecksum, { itemClass: 'Beautification Item', lodDistance: 1000 }));
  const userRec = add('UserAssetData', ASSET_TYPE.Object, USER_ASSET_DATA);
  const when = (whenIso || new Date().toISOString()).replace('Z', '0000+00:00');
  const metaRec = add(name, ASSET_TYPE.UserMetaData, metadataAsset(name,
    { snapshot: snap.checksum, steamPreview: steam.checksum, userData: userRec.checksum, object: objRec.checksum },
    tags, when, { guid: crypto.randomUUID(), triangles: mesh.triangleCount, textureSize: size }));

  // same order as genuine packages: previews, dependencies, prefab, user data, then the main metadata asset
  const ordered = [steam, snap, dMain, dXys, dAci, mat_, meshRec, genRec, objRec, userRec, metaRec];
  const writeHeader = (contentStart, offsets) => {
    const h = new ByteWriter(4096);
    h.ascii('CRAP').u16(CRP_FORMAT_VERSION).str(name).str(author).u32(0).str(name);
    h.i32(ordered.length).i64(contentStart);
    ordered.forEach((p, i) => h.str(p.assetName).str(p.checksum).i32(p.type).i64(offsets[i]).i64(p.bytes.length));
    return h;
  };
  const dummy = writeHeader(0, ordered.map(() => 0)).pos;
  const offsets = [];
  let off = 0;
  for (const p of ordered) { offsets.push(off); off += p.bytes.length; }
  const header = writeHeader(dummy, offsets).result();
  const out = new Uint8Array(header.length + off);
  out.set(header, 0);
  ordered.forEach((p, i) => out.set(p.bytes, header.length + offsets[i]));
  return {
    bytes: out,
    summary: {
      formatVersion: CRP_FORMAT_VERSION, assets: ordered.map((p) => ({ name: p.assetName, type: p.type, size: p.bytes.length, checksum: p.checksum })),
      vertices: mesh.vertexCount, triangles: mesh.triangleCount, textureSize: size, totalBytes: out.length,
    },
  };
}
