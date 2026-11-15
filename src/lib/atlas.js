// Composes the texture atlas shared by the 3D preview and the CRP export.
// Face region (top 87.5%) = the design. Bottom strip = four flat swatches: frame | pole | back | extra.
import { ATLAS } from './geometry.js';

export function materialSpec(structure) {
  const fin = structure.finish;
  const metalSpec = Math.min(1, 0.35 + fin.metalness * 0.5);
  return {
    faceSpec: fin.reflectivity,
    frameSpec: metalSpec,
    poleSpec: metalSpec,
    backSpec: Math.min(1, 0.15 + fin.metalness * 0.3),
    illuminated: !!structure.illuminated,
  };
}

const mk = (n) => { const c = document.createElement('canvas'); c.width = n; c.height = n; return c; };

export function composeAtlas(designCanvas, structure, size) {
  const faceH = Math.round(size * (1 - ATLAS.faceV0));
  const stripH = size - faceH;
  const colors = [structure.board.frame.color, structure.poles.color, structure.board.backColor, '#ffffff'];

  const color = mk(size);
  let g = color.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, size, size);
  g.imageSmoothingQuality = 'high';
  g.drawImage(designCanvas, 0, 0, size, faceH);
  colors.forEach((c, i) => { g.fillStyle = c; g.fillRect((size / 4) * i, faceH, size / 4 + 1, stripH); });

  // preview-only PBR maps: G = roughness, B = metalness
  const mr = mk(64);
  g = mr.getContext('2d');
  const fin = structure.finish;
  const px = (r, m) => `rgb(0,${Math.round(255 * r)},${Math.round(255 * m)})`;
  const f64 = Math.round(64 * (1 - ATLAS.faceV0));
  g.fillStyle = px(fin.roughness, fin.metalness); g.fillRect(0, 0, 64, f64);
  const metalR = Math.max(0.25, fin.roughness), swatches = [px(0.35, 0.9), px(0.4, 0.9), px(0.6, 0.5), px(metalR, 0)];
  swatches.forEach((c, i) => { g.fillStyle = c; g.fillRect(16 * i, f64, 17, 64 - f64); });

  const emissive = mk(size);
  g = emissive.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  if (structure.illuminated) g.drawImage(designCanvas, 0, 0, size, faceH);
  return { color, mr, emissive };
}
