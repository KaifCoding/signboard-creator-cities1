# Signboard / Flag Creator for Cities: Skylines 1

Design Indian-style signboards, welcome boards, kilometre stones, directional signs, municipal / Gram Panchayat boards and flags. Preview them in 3D and click **GENERATE & EXPORT CRP** to download a `.crp` asset.

## Run (Windows / macOS / Linux)

Requires Node.js 18.17+ (20 LTS recommended).

```
npm install
npm run dev        # http://localhost:3000
# or: npm run build && npm start
```

The CRP generator runs inside the app's own Node route (`/api/export-crp`). Nothing else to install: no Blender, Unity or Asset Editor.
Fonts (Hindi / Urdu / English) load from Google Fonts when online and fall back to Windows system fonts (Nirmala UI, Urdu Typesetting, Segoe UI) offline. You can also upload your own `.ttf/.otf/.woff`.

## How CRP generation works

`src/lib/crp/` is a from-scratch writer for Colossal Order's CRAP package container (no ZIP/OBJ/FBX renaming):

1. The Konva design layer is rendered to a texture atlas (design on top 7/8, flat swatches for frame / pole / back below).
2. `src/lib/geometry.js` builds the mesh (rounded board, optional raised frame, poles and clamps, or flagpole + waved two-sided cloth) with UVs, normals and tangents. The same code drives the 3D preview.
3. Geometry is converted right-handed -> Unity left-handed (Z mirrored).
4. Texture maps are written as DXT1 / DXT5 DDS with full mip chains: diffuse `_MainTex`, normal+specular `_XYSMap`, alpha/colour/illumination `_ACIMap`.
5. Material `Custom/Props/Prop/Default`, a `GameObject` with `Transform` + `MeshFilter` + `MeshRenderer` + `PropInfo`, and a `CustomAssetMetaData` main asset are serialised with .NET `BinaryWriter` string rules and packed with a header/asset table (format v6, MD5 checksums).
6. The bytes are **re-read by an independent parser** (`reader.js`) which checks container bounds, payload consumption, cross references (object -> mesh -> material -> 3 textures), vertex attribute counts and triangle winding. If any check fails the export fails; no file is returned.

`npm run test:crp` runs this pipeline for board / flag / pole variants without a browser.

## Known limitations (please read)

* **Not verified inside the game.** I had no copy of Cities: Skylines available, so the output has been validated against the published CRAP layout and an independent reader, not by loading it in the game. The container, Mesh / Material / Texture2D / GameObject serialisation and the type-name strings are cross-checked against public documentation. The metadata block, preview images, `UserAssetData` and the generated-info companion now mirror a genuine package (checked against a real .crp). Still inferred: the `CustomAssetMetaData.Type` value for "Prop" (`2`), the `PropInfo`/`PropInfoGen` member sets, the MeshFilter/MeshRenderer layout, and format version 6 (genuine files written by current game builds use 7). They are the most likely things to need adjustment (`src/lib/crp/writer.js`).
* **Author ID**: the game stores the author field AES-encrypted. The app copies it from any genuine .crp you choose in the Export tab (once per PC).
* If the game does not list the asset, use **Export tab -> Asset Editor import kit (.zip)** (OBJ + PNG maps). That is a manual fallback and is never named `.crp`.
* Textures are always a single square power-of-two atlas (512 / 1024 / 2048) and one material, which keeps the prop within normal Cities: Skylines limits.
* Templates are Indian-*style*, not official IRC:67 sign specifications.
* Front of the board faces Unity -Z; rotate in-game as needed.

Install location: `%LOCALAPPDATA%\Colossal Order\Cities_Skylines\Addons\Assets\`.

## Features

Templates (30) · Konva editor with drag & drop, resize/rotate, layers, undo/redo (Ctrl+Z / Ctrl+Y), grid & snap, align, auto text-fit, Hindi / English / Urdu text, font upload, PNG/JPG/WEBP/SVG upload, shapes, arrows, Ashoka Chakra, shadows · Three.js preview (PBR metal, reflective sheeting, frames, single / double poles, flagpole + cloth, self-lit, scale figure) · IndexedDB autosave with project browser, `.sbproj.json` import/export · one-click CRP export.
