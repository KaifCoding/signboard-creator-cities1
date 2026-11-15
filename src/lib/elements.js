import { STROKE_ONLY } from './shapes.js';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

const base = () => ({ id: uid(), x: 100, y: 100, rotation: 0, opacity: 1, visible: true, locked: false, shadow: { on: false, color: '#000000', blur: 8, offsetX: 3, offsetY: 3 } });

export const EMOJI_STACK = '"Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji","Apple Color Emoji",sans-serif';

export function newText(o = {}) {
  return {
    ...base(), type: 'text', name: o.name || 'Text', text: 'Text', width: 400, height: 120,
    fontFamily: 'Roboto', fontSize: 64, bold: true, italic: false, fill: '#ffffff', align: 'center', verticalAlign: 'middle',
    letterSpacing: 0, lineHeight: 1.15, autoFit: false, stroke: '#000000', strokeWidth: 0, ...o,
  };
}

export function newShape(shape, o = {}) {
  const lineLike = STROKE_ONLY.has(shape);
  return {
    ...base(), type: 'shape', shape, name: o.name || shape[0].toUpperCase() + shape.slice(1), width: 200, height: shape === 'line' ? 20 : 200,
    fill: lineLike ? '' : '#ffffff', stroke: lineLike ? '#ffffff' : '#000000', strokeWidth: lineLike ? 10 : 0,
    cornerRadius: 0, points: 5, inner: 0.4, dir: 'right', ...o,
  };
}

export function newSymbol(glyph, o = {}) {
  return newText({ name: `Symbol ${glyph}`, text: glyph, width: 160, height: 160, fontSize: 140, autoFit: true, bold: false, fontFamily: '__emoji__', ...o });
}

export function newImage(asset, o = {}) {
  const max = 360;
  const k = Math.min(1, max / Math.max(asset.w, asset.h));
  return { ...base(), type: 'image', name: asset.name || 'Image', assetId: asset.id, width: Math.round(asset.w * k), height: Math.round(asset.h * k), ...o };
}

export const SYMBOLS = ['⛽', '🏥', '🅿️', '🚻', '🍽️', '☕', '🛏️', '🚉', '✈️', '🚌', '⚠️', '☎️', '🕉️', '☸️', '🚩', '🏛️', '🛕', '🕌', '⛪', '🏫', '🌳', '⛰️', '🏖️', '🐅'];

export const ARROW_GLYPHS = ['⬅', '➡', '⬆', '⬇', '↖', '↗', '↙', '↘'];

export function cloneElement(el) {
  return { ...JSON.parse(JSON.stringify(el)), id: uid(), name: el.name + ' copy', x: el.x + 30, y: el.y + 30 };
}

export function canvasSize(widthM, heightM) {
  const L = 1200;
  const a = widthM / heightM;
  return a >= 1 ? { W: L, H: Math.max(120, Math.round(L / a)) } : { W: Math.max(120, Math.round(L * a)), H: L };
}
