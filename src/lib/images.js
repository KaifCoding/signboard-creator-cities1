import { uid } from './elements.js';

const readAsDataURL = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not decode this image')); i.src = src; });

// Reads PNG / JPG / WEBP / SVG. Very large rasters are downscaled to keep projects light.
export async function loadImageFile(file) {
  const okType = /^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type) || /\.(png|jpe?g|webp|svg)$/i.test(file.name);
  if (!okType) throw new Error(`Unsupported image type: ${file.name}. Use PNG, JPG, WEBP or SVG.`);
  let dataUrl = await readAsDataURL(file);
  const isSvg = /svg/.test(file.type) || /\.svg$/i.test(file.name);
  const img = await loadImg(dataUrl);
  let w = img.naturalWidth || 512, h = img.naturalHeight || 512;
  if (isSvg && (!img.naturalWidth || !img.naturalHeight)) { w = 512; h = 512; }
  if (!isSvg && Math.max(w, h) > 2048) {
    const k = 2048 / Math.max(w, h);
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    dataUrl = c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92);
    w = c.width; h = c.height;
  }
  return { id: uid(), name: file.name.replace(/\.[^.]+$/, ''), dataUrl, w, h, svg: isSvg };
}
