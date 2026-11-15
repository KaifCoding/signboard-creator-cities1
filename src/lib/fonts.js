// Font catalogue (English / Hindi / Urdu), Google Fonts loading, custom font uploads.
import { EMOJI_STACK } from './elements.js';

export const FONT_GROUPS = [
  { label: 'English', fonts: ['Roboto', 'Roboto Condensed', 'Open Sans', 'Oswald', 'Montserrat', 'Poppins', 'Playfair Display', 'Arial', 'Segoe UI', 'Times New Roman', 'Impact', 'Verdana'] },
  { label: 'Hindi / Devanagari', fonts: ['Noto Sans Devanagari', 'Mukta', 'Hind', 'Teko', 'Tiro Devanagari Hindi', 'Khand', 'Yatra One', 'Nirmala UI', 'Mangal'] },
  { label: 'Urdu / Arabic script', fonts: ['Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Amiri', 'Lateef', 'Scheherazade New', 'Urdu Typesetting', 'Arabic Typesetting'] },
];

const FALLBACK = '"Nirmala UI","Mangal","Noto Sans Devanagari","Segoe UI","Urdu Typesetting","Noto Naskh Arabic","Arial",sans-serif';

export const fontStack = (family) => (family === '__emoji__' ? EMOJI_STACK : `"${family}",${FALLBACK}`);

export const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?' + [
  'family=Roboto:ital,wght@0,400;0,700;1,400;1,700', 'family=Roboto+Condensed:wght@400;700', 'family=Open+Sans:wght@400;700', 'family=Oswald:wght@400;700',
  'family=Montserrat:wght@400;700', 'family=Poppins:wght@400;700', 'family=Playfair+Display:wght@400;700',
  'family=Noto+Sans+Devanagari:wght@400;700', 'family=Mukta:wght@400;700', 'family=Hind:wght@400;700', 'family=Teko:wght@400;700',
  'family=Tiro+Devanagari+Hindi', 'family=Khand:wght@400;700', 'family=Yatra+One',
  'family=Noto+Nastaliq+Urdu:wght@400;700', 'family=Noto+Naskh+Arabic:wght@400;700', 'family=Amiri:wght@400;700', 'family=Lateef', 'family=Scheherazade+New:wght@400;700',
].join('&') + '&display=swap';

export function injectGoogleFonts() {
  if (typeof document === 'undefined' || document.getElementById('gfonts')) return;
  const l = document.createElement('link');
  l.id = 'gfonts'; l.rel = 'stylesheet'; l.href = GOOGLE_FONTS_URL;
  document.head.appendChild(l);
}

// Make sure the glyphs we are about to draw are actually loaded (Google serves unicode-range subsets).
export async function ensureFonts(elements) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const jobs = [];
  for (const e of elements) {
    if (e.type !== 'text' || e.fontFamily === '__emoji__') continue;
    const w = e.bold ? 700 : 400, st = e.italic ? 'italic' : 'normal';
    jobs.push(document.fonts.load(`${st} ${w} 32px "${e.fontFamily}"`, e.text || 'A').catch(() => {}));
  }
  await Promise.all(jobs);
}

export async function registerFontFile(file) {
  const data = await file.arrayBuffer();
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]+/g, ' ').trim() || 'Custom Font';
  const face = new FontFace(name, data);
  await face.load();
  document.fonts.add(face);
  return { name, data };
}

export async function registerFontData(name, data) {
  const face = new FontFace(name, data);
  await face.load();
  document.fonts.add(face);
}
