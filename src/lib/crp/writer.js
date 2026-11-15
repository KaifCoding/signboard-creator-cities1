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
  PackageAsset: `ColossalFramework.Packaging.Package+Asset, ICities, Version=0.3.0.0, Culture=neutral, PublicKeyToken=null`,
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

function gameObjectAsset(name, meshChecksum, materialChecksum, propParams) {
  const w = new ByteWriter(4096);
  w.bool(false).str(TYPES.GameObject).str(name);
  w.str('Untagged').i32(0).bool(true);
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
  ];
  w.i32(fields.length);
  for (const [t, n, fn] of fields) prop(w, t, n, fn);
  return w.result();
}

function metadataAsset(name, objectChecksum, tags, when) {
  const w = new ByteWriter(2048);
  w.bool(false).str(TYPES.CustomAssetMetaData).str(name);
  const fields = [
    [TYPES.String, 'name', (x) => x.str(name)],
    [TYPES.DateTime, 'timeStamp', (x) => x.str(when)],
    [TYPES.MetaType, 'type', (x) => x.i32(META_TYPE_PROP)],
    [TYPES.StringArray, 'steamTags', (x) => { x.i32(tags.length); for (const t of tags) x.str(t); }],
    [TYPES.PackageAsset, 'assetRef', (x) => x.str(objectChecksum)],
  ];
  w.i32(fields.length);
  for (const [t, n, fn] of fields) prop(w, t, n, fn);
  return w.result();
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

export function buildCrp({ name, author = '', tags = [], mesh, atlas, faceV0, mat, whenIso }) {
  if (!name) throw new Error('asset name required');
  const size = atlas.width;
  if (atlas.width !== atlas.height || (size & (size - 1)) !== 0) throw new Error('atlas must be a square power-of-two texture');
  const unity = toUnity(mesh);
  const maps = buildMaps(size, faceV0, mat);

  const parts = [];
  const add = (assetName, type, bytes) => { const rec = { assetName, type, bytes, checksum: md5(bytes) }; parts.push(rec); return rec; };

  const dMain = add(`${name}_d`, ASSET_TYPE.Texture, textureAsset(`${name}_d`, encodeDDS({ width: size, height: size, rgba: atlas.data, format: 'DXT1' }), false));
  const dXys = add(`${name}_s`, ASSET_TYPE.Texture, textureAsset(`${name}_s`, encodeDDS({ width: size, height: size, rgba: maps.xys, format: 'DXT5' }), true));
  const dAci = add(`${name}_i`, ASSET_TYPE.Texture, textureAsset(`${name}_i`, encodeDDS({ width: size, height: size, rgba: maps.aci, format: 'DXT1' }), true));
  const mat_ = add(`${name}_Material`, ASSET_TYPE.Material, materialAsset(`${name}_Material`, SHADER, [['_Color', [1, 1, 1, 1]]], [
    ['_MainTex', dMain.checksum], ['_XYSMap', dXys.checksum], ['_ACIMap', dAci.checksum],
  ]));
  const meshRec = add(`${name}_Mesh`, ASSET_TYPE.StaticMesh, meshAsset(`${name}_Mesh`, unity));
  const objRec = add(`${name}_Data`, ASSET_TYPE.Object, gameObjectAsset(`${name}_Data`, meshRec.checksum, mat_.checksum, { itemClass: 'Beautification Item', lodDistance: 1000 }));
  const metaRec = add(name, ASSET_TYPE.UserMetaData, metadataAsset(name, objRec.checksum, tags, whenIso || new Date().toISOString().replace('Z', '')));

  // order like real packages: main metadata first, then object, then dependencies
  const ordered = [metaRec, objRec, meshRec, mat_, dMain, dXys, dAci];
  const writeHeader = (contentStart, offsets) => {
    const h = new ByteWriter(4096);
    h.ascii('CRAP').u16(CRP_FORMAT_VERSION).str(name).str(author).u32(2).str(name);
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
