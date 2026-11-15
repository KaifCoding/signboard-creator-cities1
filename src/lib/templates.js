import { newText, newShape, newSymbol, canvasSize } from './elements.js';

export const HI = 'Noto Sans Devanagari';
export const EN = 'Roboto';
export const UR = 'Noto Nastaliq Urdu';
const SAFFRON = '#ff9933', GREEN_IN = '#138808', NAVY = '#000080';

export function defaultStructure(kind = 'board') {
  return {
    kind,
    board: {
      widthM: 4, heightM: 2, thicknessM: 0.08, cornerRadiusM: 0.12,
      bg: { type: 'solid', color: '#0b6e3a', color2: '#07502a', angle: 90 },
      border: { enabled: true, color: '#ffffff', width: 14, inset: 16, radius: 18 },
      frame: { enabled: true, widthM: 0.05, depthM: 0.03, color: '#aab1b8' },
      backColor: '#7d848b',
    },
    poles: { mode: 'double', radiusM: 0.06, mountHeightM: 2.2, inset: 0.18, color: '#9aa1a8' },
    flag: { poleHeightM: 8, poleRadiusM: 0.05, finial: true, waveAmpM: 0.25, waves: 1.5 },
    finish: { roughness: 0.45, metalness: 0.35, reflectivity: 0.5 },
    illuminated: false,
  };
}

const merge = (a, b) => {
  if (!b) return a;
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k];
  return out;
};

export const CATEGORIES = [
  { id: 'welcome', label: 'Welcome boards' },
  { id: 'highway', label: 'Highway information' },
  { id: 'km', label: 'Kilometre & distance' },
  { id: 'direction', label: 'Directional signs' },
  { id: 'route', label: 'National & state highway' },
  { id: 'municipal', label: 'Municipal & Nagar Palika' },
  { id: 'panchayat', label: 'Gram Panchayat' },
  { id: 'tourist', label: 'Tourist information' },
  { id: 'org', label: 'Organisation boards' },
  { id: 'flag', label: 'Flags' },
  { id: 'scratch', label: 'From scratch' },
];

const tricolor = (W, y, h, extra = {}) => [
  newShape('rect', { name: 'Saffron band', x: 0, y, width: W / 3, height: h, fill: SAFFRON, ...extra }),
  newShape('rect', { name: 'White band', x: W / 3, y, width: W / 3, height: h, fill: '#ffffff', ...extra }),
  newShape('rect', { name: 'Green band', x: (2 * W) / 3, y, width: W / 3, height: h, fill: GREEN_IN, ...extra }),
];

const T = (text, x, y, w, h, o = {}) => newText({ text, x, y, width: w, height: h, ...o });
const solid = (color, color2) => ({ board: { bg: { type: 'solid', color, color2: color2 || color } } });
const hi = { fontFamily: HI }, ur = { fontFamily: UR, lineHeight: 1.7 };

const defs = [];
const def = (id, category, name, desc, patch, build) => defs.push({ id, category, name, desc, patch, build });

// ---------------------------------------------------------------- welcome
def('village-welcome', 'welcome', 'Village welcome board', 'Hindi + English village greeting', { board: { widthM: 4, heightM: 2.2, bg: { type: 'solid', color: '#0b6e3a', color2: '#07502a' } } }, (W, H) => [
  T('स्वागतम्', W * 0.05, H * 0.07, W * 0.9, H * 0.3, { ...hi, fill: '#ffd400', autoFit: true, name: 'Hindi heading' }),
  T('आपके गाँव में आपका हार्दिक स्वागत है', W * 0.06, H * 0.38, W * 0.88, H * 0.16, { ...hi, autoFit: true, name: 'Hindi line' }),
  T('ग्राम राजपुर', W * 0.1, H * 0.56, W * 0.8, H * 0.16, { ...hi, fill: '#ffffff', autoFit: true, name: 'Village name' }),
  T('Welcome to Our Village', W * 0.1, H * 0.73, W * 0.8, H * 0.09, { fontFamily: EN, autoFit: true, name: 'English line' }),
  ...tricolor(W - 80, H * 0.9, H * 0.04).map((e) => ({ ...e, x: e.x + 40 })),
]);

def('city-welcome', 'welcome', 'City welcome board', 'Trilingual Hindi / English / Urdu', { board: { widthM: 5, heightM: 2.2, bg: { type: 'solid', color: '#0a4c9c', color2: '#06357a' } } }, (W, H) => [
  T('Welcome to Jaipur', W * 0.06, H * 0.08, W * 0.88, H * 0.26, { fontFamily: EN, fill: '#ffffff', autoFit: true, name: 'English heading' }),
  T('जयपुर में आपका स्वागत है', W * 0.06, H * 0.36, W * 0.88, H * 0.22, { ...hi, fill: '#ffd400', autoFit: true, name: 'Hindi heading' }),
  T('جے پور میں خوش آمدید', W * 0.06, H * 0.6, W * 0.88, H * 0.22, { ...ur, autoFit: true, name: 'Urdu heading' }),
  ...tricolor(W - 80, H * 0.88, H * 0.05).map((e) => ({ ...e, x: e.x + 40 })),
]);

def('district-border', 'welcome', 'District / state border board', 'Boundary greeting with chakra', { board: { widthM: 5, heightM: 2.4, bg: { type: 'solid', color: '#0b6e3a', color2: '#07502a' } } }, (W, H) => [
  newShape('chakra', { name: 'Ashoka Chakra', x: W * 0.06, y: H * 0.22, width: H * 0.56, height: H * 0.56, stroke: '#ffffff', strokeWidth: 5 }),
  T('उत्तर प्रदेश', W * 0.38, H * 0.1, W * 0.56, H * 0.3, { ...hi, fill: '#ffd400', autoFit: true, name: 'State Hindi' }),
  T('Uttar Pradesh', W * 0.38, H * 0.42, W * 0.56, H * 0.2, { fontFamily: EN, autoFit: true, name: 'State English' }),
  T('आपका स्वागत करता है  |  Welcomes You', W * 0.38, H * 0.68, W * 0.56, H * 0.14, { fontFamily: HI, autoFit: true, bold: false, name: 'Tagline' }),
]);

// ---------------------------------------------------------------- highway info
def('hw-fuel', 'highway', 'Fuel station ahead', 'Highway facility board (green)', { board: { widthM: 3, heightM: 1.6 } }, (W, H) => [
  newShape('rect', { name: 'Symbol plate', x: W * 0.05, y: H * 0.2, width: H * 0.56, height: H * 0.56, fill: '#ffffff', cornerRadius: 20 }),
  newSymbol('⛽', { x: W * 0.05 + H * 0.05, y: H * 0.25, width: H * 0.46, height: H * 0.46, fill: '#000000' }),
  T('पेट्रोल पंप', W * 0.38, H * 0.12, W * 0.57, H * 0.28, { ...hi, autoFit: true, align: 'left', name: 'Hindi' }),
  T('Fuel Station', W * 0.38, H * 0.42, W * 0.57, H * 0.22, { fontFamily: EN, autoFit: true, align: 'left', name: 'English' }),
  T('2 km  |  2 किमी', W * 0.38, H * 0.68, W * 0.57, H * 0.18, { fontFamily: EN, autoFit: true, align: 'left', fill: '#ffd400', name: 'Distance' }),
]);

def('hw-toll', 'highway', 'Toll plaza ahead', 'Toll notice in two languages', { board: { widthM: 4, heightM: 2 } }, (W, H) => [
  T('टोल प्लाज़ा', W * 0.06, H * 0.08, W * 0.88, H * 0.3, { ...hi, autoFit: true, name: 'Hindi' }),
  T('TOLL PLAZA', W * 0.06, H * 0.4, W * 0.88, H * 0.28, { fontFamily: EN, fill: '#ffd400', autoFit: true, name: 'English' }),
  T('500 m', W * 0.3, H * 0.72, W * 0.4, H * 0.2, { fontFamily: EN, autoFit: true, name: 'Distance' }),
]);

def('hw-gantry', 'highway', 'Expressway gantry sign', 'Wide overhead sign with exit arrows', { board: { widthM: 8, heightM: 2.6 }, poles: { mode: 'double', mountHeightM: 5.2, inset: 0.04 } }, (W, H) => [
  T('Delhi – Mumbai Expressway', W * 0.04, H * 0.07, W * 0.92, H * 0.2, { fontFamily: EN, autoFit: true, fill: '#ffd400', name: 'Title' }),
  newShape('arrow', { name: 'Arrow left', dir: 'left', x: W * 0.05, y: H * 0.38, width: W * 0.1, height: H * 0.42, fill: '#ffffff' }),
  T('Exit 14  |  निकास 14', W * 0.2, H * 0.34, W * 0.6, H * 0.22, { fontFamily: EN, autoFit: true, name: 'Exit' }),
  T('जयपुर  Jaipur  – 38 km', W * 0.2, H * 0.58, W * 0.6, H * 0.22, { fontFamily: HI, autoFit: true, name: 'Destination' }),
  newShape('arrow', { name: 'Arrow right', x: W * 0.85, y: H * 0.38, width: W * 0.1, height: H * 0.42, fill: '#ffffff' }),
]);

def('speed-limit', 'highway', 'Speed limit (circular)', 'Regulatory circular sign, 80 km/h', { board: { widthM: 1.2, heightM: 1.2, cornerRadiusM: 0.6, bg: { type: 'solid', color: '#ffffff', color2: '#ffffff' }, border: { enabled: false } }, poles: { mode: 'single', mountHeightM: 2.2 } }, (W, H) => [
  newShape('ellipse', { name: 'Red ring', x: W * 0.03, y: H * 0.03, width: W * 0.94, height: H * 0.94, fill: '#ffffff', stroke: '#d00000', strokeWidth: W * 0.1 }),
  T('80', W * 0.2, H * 0.25, W * 0.6, H * 0.5, { fontFamily: EN, fill: '#000000', autoFit: true, name: 'Limit' }),
]);

def('warning-school', 'highway', 'Warning – school ahead', 'Triangular warning sign', { board: { widthM: 1.2, heightM: 1.1, cornerRadiusM: 0, bg: { type: 'solid', color: '#ffffff', color2: '#ffffff' }, border: { enabled: false } }, poles: { mode: 'single', mountHeightM: 2.2 } }, (W, H) => [
  newShape('triangle', { name: 'Warning triangle', x: W * 0.02, y: H * 0.04, width: W * 0.96, height: H * 0.9, fill: '#ffffff', stroke: '#d00000', strokeWidth: W * 0.07 }),
  newSymbol('🚸', { x: W * 0.3, y: H * 0.4, width: W * 0.4, height: H * 0.4, fill: '#000000' }),
]);

// ---------------------------------------------------------------- km / distance
const kmStone = (id, label, top, topText, name) => def(id, 'km', name, 'Milestone with coloured top band', { board: { widthM: 1, heightM: 1.3, cornerRadiusM: 0.15, bg: { type: 'solid', color: '#ffffff', color2: '#ffffff' }, border: { enabled: true, color: '#000000', width: 8, inset: 8, radius: 24 } }, poles: { mode: 'single', radiusM: 0.05, mountHeightM: 0.5 } }, (W, H) => [
  newShape('rect', { name: 'Top band', x: 8, y: 8, width: W - 16, height: H * 0.33, fill: top, cornerRadius: 24 }),
  newShape('rect', { name: 'Band fill', x: 8, y: H * 0.2, width: W - 16, height: H * 0.14, fill: top }),
  T(topText, W * 0.08, H * 0.07, W * 0.84, H * 0.22, { fontFamily: EN, fill: '#000000', autoFit: true, name: 'Route' }),
  T('दिल्ली  45', W * 0.08, H * 0.4, W * 0.84, H * 0.2, { ...hi, fill: '#000000', autoFit: true, name: 'Dest 1' }),
  T('Agra  120', W * 0.08, H * 0.62, W * 0.84, H * 0.16, { fontFamily: EN, fill: '#000000', autoFit: true, name: 'Dest 2' }),
  T('KM ' + label, W * 0.08, H * 0.8, W * 0.84, H * 0.13, { fontFamily: EN, fill: '#000000', autoFit: true, name: 'Km marker' }),
]);
kmStone('km-nh', '45', '#f6c700', 'NH 48', 'Kilometre stone – National Highway');
kmStone('km-sh', '12', '#0b8a3c', 'SH 21', 'Kilometre stone – State Highway');
kmStone('km-rural', '3', '#f28c1a', 'ग्रामीण मार्ग', 'Kilometre stone – Rural road');

def('distance-board', 'km', 'Distance board', 'Next places with distances', { board: { widthM: 4, heightM: 2.2 } }, (W, H) => [
  T('आगे  |  Ahead', W * 0.05, H * 0.05, W * 0.9, H * 0.12, { fontFamily: HI, autoFit: true, fill: '#ffd400', name: 'Header' }),
  T('आगरा  Agra', W * 0.06, H * 0.22, W * 0.6, H * 0.18, { fontFamily: HI, autoFit: true, align: 'left', name: 'Place 1' }),
  T('45 km', W * 0.7, H * 0.22, W * 0.24, H * 0.18, { fontFamily: EN, autoFit: true, align: 'right', name: 'Dist 1' }),
  T('मथुरा  Mathura', W * 0.06, H * 0.46, W * 0.6, H * 0.18, { fontFamily: HI, autoFit: true, align: 'left', name: 'Place 2' }),
  T('80 km', W * 0.7, H * 0.46, W * 0.24, H * 0.18, { fontFamily: EN, autoFit: true, align: 'right', name: 'Dist 2' }),
  T('दिल्ली  Delhi', W * 0.06, H * 0.7, W * 0.6, H * 0.18, { fontFamily: HI, autoFit: true, align: 'left', name: 'Place 3' }),
  T('195 km', W * 0.7, H * 0.7, W * 0.24, H * 0.18, { fontFamily: EN, autoFit: true, align: 'right', name: 'Dist 3' }),
]);

// ---------------------------------------------------------------- directional
def('dir-split', 'direction', 'Left / right direction sign', 'Two destinations with arrows', { board: { widthM: 4, heightM: 2 } }, (W, H) => [
  newShape('arrow', { name: 'Arrow left', dir: 'left', x: W * 0.05, y: H * 0.1, width: W * 0.14, height: H * 0.3, fill: '#ffffff' }),
  T('जयपुर  Jaipur', W * 0.22, H * 0.1, W * 0.5, H * 0.3, { fontFamily: HI, autoFit: true, align: 'left', name: 'Left place' }),
  T('45', W * 0.76, H * 0.1, W * 0.2, H * 0.3, { fontFamily: EN, autoFit: true, align: 'right', name: 'Left km' }),
  newShape('line', { name: 'Divider', x: W * 0.04, y: H * 0.47, width: W * 0.92, height: 12, stroke: '#ffffff', strokeWidth: 5 }),
  T('अजमेर  Ajmer', W * 0.22, H * 0.58, W * 0.5, H * 0.3, { fontFamily: HI, autoFit: true, align: 'left', name: 'Right place' }),
  T('120', W * 0.76, H * 0.58, W * 0.2, H * 0.3, { fontFamily: EN, autoFit: true, align: 'right', name: 'Right km' }),
  newShape('arrow', { name: 'Arrow right', x: W * 0.05, y: H * 0.58, width: W * 0.14, height: H * 0.3, fill: '#ffffff' }),
]);

def('dir-ahead', 'direction', 'Straight-ahead sign', 'Up arrow with destination', { board: { widthM: 3, heightM: 2.4 } }, (W, H) => [
  newShape('arrow', { name: 'Arrow up', dir: 'up', x: W * 0.5 - H * 0.12, y: H * 0.08, width: H * 0.24, height: H * 0.5, fill: '#ffffff' }),
  T('कोटा', W * 0.1, H * 0.62, W * 0.8, H * 0.2, { ...hi, autoFit: true, name: 'Hindi' }),
  T('Kota  –  95 km', W * 0.1, H * 0.82, W * 0.8, H * 0.12, { fontFamily: EN, autoFit: true, name: 'English' }),
]);

def('dir-junction', 'direction', 'Junction sign (3 routes)', 'Three destinations', { board: { widthM: 5, heightM: 2.8 } }, (W, H) => [
  newShape('chevron', { name: 'Arrow 1', x: W * 0.04, y: H * 0.08, width: W * 0.08, height: H * 0.22, fill: '#ffffff' }),
  T('लखनऊ  Lucknow', W * 0.15, H * 0.08, W * 0.55, H * 0.22, { fontFamily: HI, autoFit: true, align: 'left', name: 'Place 1' }),
  T('NH 27', W * 0.74, H * 0.08, W * 0.22, H * 0.22, { fontFamily: EN, autoFit: true, fill: '#ffd400', name: 'Route 1' }),
  newShape('chevron', { name: 'Arrow 2', x: W * 0.04, y: H * 0.39, width: W * 0.08, height: H * 0.22, fill: '#ffffff' }),
  T('कानपुर  Kanpur', W * 0.15, H * 0.39, W * 0.55, H * 0.22, { fontFamily: HI, autoFit: true, align: 'left', name: 'Place 2' }),
  T('SH 25', W * 0.74, H * 0.39, W * 0.22, H * 0.22, { fontFamily: EN, autoFit: true, fill: '#ffd400', name: 'Route 2' }),
  newShape('chevron', { name: 'Arrow 3', x: W * 0.04, y: H * 0.7, width: W * 0.08, height: H * 0.22, fill: '#ffffff' }),
  T('उन्नाव  Unnao', W * 0.15, H * 0.7, W * 0.55, H * 0.22, { fontFamily: HI, autoFit: true, align: 'left', name: 'Place 3' }),
]);

// ---------------------------------------------------------------- national / state highway
def('nh-shield', 'route', 'NH route shield (stylised)', 'National highway number shield', { board: { widthM: 1.1, heightM: 1.3, cornerRadiusM: 0, bg: { type: 'solid', color: '#ffffff', color2: '#ffffff' }, border: { enabled: false } }, poles: { mode: 'single', mountHeightM: 2.2 } }, (W, H) => [
  newShape('shield', { name: 'Shield', x: W * 0.02, y: H * 0.02, width: W * 0.96, height: H * 0.96, fill: '#f6c700', stroke: '#000000', strokeWidth: 8 }),
  T('NH', W * 0.2, H * 0.14, W * 0.6, H * 0.22, { fontFamily: EN, fill: '#000000', autoFit: true, name: 'NH' }),
  T('48', W * 0.18, H * 0.38, W * 0.64, H * 0.36, { fontFamily: EN, fill: '#000000', autoFit: true, name: 'Number' }),
]);
def('sh-shield', 'route', 'SH route shield (stylised)', 'State highway number shield', { board: { widthM: 1.1, heightM: 1.3, cornerRadiusM: 0, bg: { type: 'solid', color: '#ffffff', color2: '#ffffff' }, border: { enabled: false } }, poles: { mode: 'single', mountHeightM: 2.2 } }, (W, H) => [
  newShape('shield', { name: 'Shield', x: W * 0.02, y: H * 0.02, width: W * 0.96, height: H * 0.96, fill: '#0b8a3c', stroke: '#ffffff', strokeWidth: 8 }),
  T('SH', W * 0.2, H * 0.14, W * 0.6, H * 0.22, { fontFamily: EN, autoFit: true, name: 'SH' }),
  T('21', W * 0.18, H * 0.38, W * 0.64, H * 0.36, { fontFamily: EN, autoFit: true, name: 'Number' }),
]);
def('nh-board', 'route', 'National highway name board', 'Route name with number', { board: { widthM: 4, heightM: 1.6 } }, (W, H) => [
  newShape('shield', { name: 'Shield', x: W * 0.04, y: H * 0.1, width: H * 0.72, height: H * 0.8, fill: '#f6c700', stroke: '#000000', strokeWidth: 6 }),
  T('NH 44', W * 0.04 + H * 0.06, H * 0.34, H * 0.6, H * 0.34, { fontFamily: EN, fill: '#000000', autoFit: true, name: 'NH number' }),
  T('राष्ट्रीय राजमार्ग', W * 0.36, H * 0.1, W * 0.6, H * 0.38, { ...hi, autoFit: true, name: 'Hindi' }),
  T('National Highway', W * 0.36, H * 0.52, W * 0.6, H * 0.3, { fontFamily: EN, autoFit: true, name: 'English' }),
]);

// ---------------------------------------------------------------- municipal
const civic = (id, name, hindi, english, sub) => def(id, 'municipal', name, 'Civic body signboard with emblem', { board: { widthM: 4, heightM: 2.2, bg: { type: 'solid', color: '#ffffff', color2: '#ffffff' }, border: { enabled: true, color: '#0a4c9c', width: 16, inset: 16, radius: 20 } } }, (W, H) => [
  newShape('chakra', { name: 'Emblem', x: W * 0.07, y: H * 0.14, width: H * 0.5, height: H * 0.5, stroke: NAVY, strokeWidth: 5 }),
  T(hindi, W * 0.38, H * 0.12, W * 0.56, H * 0.28, { ...hi, fill: '#0a4c9c', autoFit: true, name: 'Hindi title' }),
  T(english, W * 0.38, H * 0.42, W * 0.56, H * 0.2, { fontFamily: EN, fill: '#222222', autoFit: true, name: 'English title' }),
  ...tricolor(W - 120, H * 0.7, H * 0.04).map((e) => ({ ...e, x: e.x + 60 })),
  T(sub, W * 0.08, H * 0.78, W * 0.84, H * 0.14, { ...hi, fill: '#0a4c9c', autoFit: true, name: 'Subtitle' }),
]);
civic('mc-board', 'Municipal Corporation board', 'नगर निगम', 'Municipal Corporation', 'स्वच्छ शहर – सुंदर शहर');
civic('np-board', 'Nagar Palika Parishad board', 'नगर पालिका परिषद', 'Nagar Palika Parishad', 'आपकी सेवा में सदैव तत्पर');
def('ward-board', 'municipal', 'Ward information board', 'Ward number and councillor', { board: { widthM: 3, heightM: 2, bg: { type: 'solid', color: '#0a4c9c', color2: '#06357a' } } }, (W, H) => [
  T('वार्ड संख्या 12', W * 0.06, H * 0.08, W * 0.88, H * 0.3, { ...hi, fill: '#ffd400', autoFit: true, name: 'Ward' }),
  T('Ward No. 12', W * 0.06, H * 0.4, W * 0.88, H * 0.18, { fontFamily: EN, autoFit: true, name: 'Ward EN' }),
  T('पार्षद: श्री राम प्रसाद', W * 0.06, H * 0.64, W * 0.88, H * 0.2, { ...hi, autoFit: true, name: 'Councillor' }),
]);

// ---------------------------------------------------------------- gram panchayat
def('gp-info', 'panchayat', 'Gram Panchayat information board', 'Village details table', { board: { widthM: 4, heightM: 2.6, bg: { type: 'solid', color: '#fffbe6', color2: '#fff2b8' }, border: { enabled: true, color: '#0b6e3a', width: 14, inset: 14, radius: 16 } } }, (W, H) => [
  newShape('rect', { name: 'Header', x: 14, y: 14, width: W - 28, height: H * 0.2, fill: '#0b6e3a' }),
  T('ग्राम पंचायत राजपुर', W * 0.05, H * 0.04, W * 0.9, H * 0.14, { ...hi, autoFit: true, name: 'Title' }),
  T('ब्लॉक: सदर', W * 0.06, H * 0.26, W * 0.88, H * 0.1, { ...hi, fill: '#222222', autoFit: true, align: 'left', bold: false, name: 'Block' }),
  T('ज़िला: जयपुर', W * 0.06, H * 0.38, W * 0.88, H * 0.1, { ...hi, fill: '#222222', autoFit: true, align: 'left', bold: false, name: 'District' }),
  T('सरपंच: श्रीमती सीता देवी', W * 0.06, H * 0.5, W * 0.88, H * 0.1, { ...hi, fill: '#222222', autoFit: true, align: 'left', bold: false, name: 'Sarpanch' }),
  T('जनसंख्या: 3,420', W * 0.06, H * 0.62, W * 0.88, H * 0.1, { ...hi, fill: '#222222', autoFit: true, align: 'left', bold: false, name: 'Population' }),
  ...tricolor(W - 80, H * 0.82, H * 0.05).map((e) => ({ ...e, x: e.x + 40 })),
  T('स्वच्छ गाँव – समृद्ध गाँव', W * 0.06, H * 0.89, W * 0.88, H * 0.07, { ...hi, fill: '#0b6e3a', autoFit: true, name: 'Slogan' }),
]);
def('gp-entrance', 'panchayat', 'Gram Panchayat entrance board', 'Large gate board with tricolour', { board: { widthM: 5, heightM: 1.8, bg: { type: 'solid', color: '#ff9933', color2: '#e07b12' } } }, (W, H) => [
  T('ग्राम पंचायत  |  रामपुर', W * 0.04, H * 0.1, W * 0.92, H * 0.46, { ...hi, fill: '#0b1f5c', autoFit: true, name: 'Title' }),
  T('Gram Panchayat  Rampur', W * 0.04, H * 0.58, W * 0.92, H * 0.24, { fontFamily: EN, fill: '#0b1f5c', autoFit: true, name: 'English' }),
]);

// ---------------------------------------------------------------- tourist
def('tourist-info', 'tourist', 'Tourist information board', 'Heritage site notice (brown)', { board: { widthM: 4, heightM: 2.2, bg: { type: 'solid', color: '#6d3b1a', color2: '#522a11' } } }, (W, H) => [
  newSymbol('🏛️', { x: W * 0.05, y: H * 0.14, width: H * 0.46, height: H * 0.46 }),
  T('धरोहर स्थल', W * 0.36, H * 0.1, W * 0.59, H * 0.3, { ...hi, autoFit: true, align: 'left', name: 'Hindi' }),
  T('Heritage Site', W * 0.36, H * 0.42, W * 0.59, H * 0.2, { fontFamily: EN, autoFit: true, align: 'left', name: 'English' }),
  T('Open 9 am – 5 pm  |  Entry free', W * 0.06, H * 0.72, W * 0.88, H * 0.14, { fontFamily: EN, fill: '#ffd9a0', autoFit: true, bold: false, name: 'Timings' }),
]);
def('tourist-dir', 'tourist', 'Tourist direction sign', 'Monument direction with distance', { board: { widthM: 3.5, heightM: 1.6, bg: { type: 'solid', color: '#6d3b1a', color2: '#522a11' } } }, (W, H) => [
  newShape('arrow', { name: 'Arrow', x: W * 0.05, y: H * 0.28, width: W * 0.16, height: H * 0.44, fill: '#ffffff' }),
  T('लाल किला  Red Fort', W * 0.25, H * 0.12, W * 0.7, H * 0.4, { fontFamily: HI, autoFit: true, align: 'left', name: 'Place' }),
  T('2 km', W * 0.25, H * 0.56, W * 0.7, H * 0.3, { fontFamily: EN, fill: '#ffd9a0', autoFit: true, align: 'left', name: 'Distance' }),
]);

// ---------------------------------------------------------------- organisations
def('org-board', 'org', 'Organisation board', 'Logo + name, fully customisable', { board: { widthM: 4, heightM: 1.8, bg: { type: 'solid', color: '#0b1f5c', color2: '#08163f' } } }, (W, H) => [
  newShape('ellipse', { name: 'Logo slot', x: W * 0.05, y: H * 0.15, width: H * 0.7, height: H * 0.7, fill: '#ffffff', stroke: '#ffd400', strokeWidth: 8 }),
  T('LOGO', W * 0.05 + H * 0.1, H * 0.38, H * 0.5, H * 0.24, { fontFamily: EN, fill: '#0b1f5c', autoFit: true, name: 'Logo label' }),
  T('आपकी संस्था का नाम', W * 0.4, H * 0.14, W * 0.56, H * 0.36, { ...hi, autoFit: true, align: 'left', name: 'Org name HI' }),
  T('Your Organisation Name', W * 0.4, H * 0.54, W * 0.56, H * 0.26, { fontFamily: EN, fill: '#ffd400', autoFit: true, align: 'left', name: 'Org name EN' }),
]);
def('org-school', 'org', 'School board', 'Government school signboard', { board: { widthM: 4, heightM: 2, bg: { type: 'solid', color: '#ffffff', color2: '#ffffff' }, border: { enabled: true, color: '#d00000', width: 14, inset: 14, radius: 14 } } }, (W, H) => [
  T('राजकीय उच्च माध्यमिक विद्यालय', W * 0.05, H * 0.08, W * 0.9, H * 0.28, { ...hi, fill: '#d00000', autoFit: true, name: 'Hindi name' }),
  T('Government Senior Secondary School', W * 0.05, H * 0.4, W * 0.9, H * 0.18, { fontFamily: EN, fill: '#111111', autoFit: true, name: 'English name' }),
  T('विद्या ददाति विनयम्', W * 0.15, H * 0.64, W * 0.7, H * 0.18, { ...hi, fill: '#0b6e3a', autoFit: true, bold: false, name: 'Motto' }),
]);
def('org-hospital', 'org', 'Hospital board', 'Health centre signboard', { board: { widthM: 4, heightM: 2, bg: { type: 'solid', color: '#ffffff', color2: '#ffffff' }, border: { enabled: true, color: '#0b8a3c', width: 14, inset: 14, radius: 14 } } }, (W, H) => [
  newShape('cross', { name: 'Cross', x: W * 0.06, y: H * 0.2, width: H * 0.56, height: H * 0.56, fill: '#d00000' }),
  T('सामुदायिक स्वास्थ्य केंद्र', W * 0.38, H * 0.14, W * 0.57, H * 0.34, { ...hi, fill: '#0b6e3a', autoFit: true, align: 'left', name: 'Hindi' }),
  T('Community Health Centre', W * 0.38, H * 0.52, W * 0.57, H * 0.2, { fontFamily: EN, fill: '#111111', autoFit: true, align: 'left', name: 'English' }),
  T('24×7 आपातकालीन सेवा', W * 0.38, H * 0.76, W * 0.57, H * 0.12, { ...hi, fill: '#d00000', autoFit: true, align: 'left', name: 'Emergency' }),
]);

// ---------------------------------------------------------------- flags
const flagPatch = (extra = {}) => ({ kind: 'flag', board: { widthM: 3, heightM: 2, cornerRadiusM: 0, border: { enabled: false }, frame: { enabled: false }, ...extra }, illuminated: false, finish: { roughness: 0.85, metalness: 0, reflectivity: 0.05 } });
def('flag-india', 'flag', 'National flag of India', 'Tiranga 3:2 with 24-spoke Ashoka Chakra', flagPatch(), (W, H) => [
  newShape('rect', { name: 'Saffron', x: 0, y: 0, width: W, height: H / 3 + 1, fill: SAFFRON }),
  newShape('rect', { name: 'White', x: 0, y: H / 3, width: W, height: H / 3 + 1, fill: '#ffffff' }),
  newShape('rect', { name: 'Green', x: 0, y: (2 * H) / 3, width: W, height: H / 3, fill: GREEN_IN }),
  newShape('chakra', { name: 'Ashoka Chakra', x: W / 2 - H * 0.153, y: H / 2 - H * 0.153, width: H * 0.306, height: H * 0.306, stroke: NAVY, strokeWidth: H * 0.008 }),
]);
def('flag-hv', 'flag', 'Vertical tricolour', 'Three vertical bands (colours editable)', flagPatch(), (W, H) => [
  newShape('rect', { name: 'Band 1', x: 0, y: 0, width: W / 3 + 1, height: H, fill: '#0b8a3c' }),
  newShape('rect', { name: 'Band 2', x: W / 3, y: 0, width: W / 3 + 1, height: H, fill: '#ffffff' }),
  newShape('rect', { name: 'Band 3', x: (2 * W) / 3, y: 0, width: W / 3, height: H, fill: SAFFRON }),
]);
def('flag-h2', 'flag', 'Horizontal bicolour', 'Two horizontal bands with star', flagPatch(), (W, H) => [
  newShape('rect', { name: 'Top', x: 0, y: 0, width: W, height: H / 2 + 1, fill: '#0a4c9c' }),
  newShape('rect', { name: 'Bottom', x: 0, y: H / 2, width: W, height: H / 2, fill: '#ffd400' }),
  newShape('star', { name: 'Star', x: W / 2 - H * 0.18, y: H / 2 - H * 0.18, width: H * 0.36, height: H * 0.36, fill: '#ffffff' }),
]);
def('flag-saffron', 'flag', 'Saffron pennant (Om)', 'Plain saffron flag with symbol', flagPatch(), (W, H) => [
  newShape('rect', { name: 'Field', x: 0, y: 0, width: W, height: H, fill: SAFFRON }),
  newSymbol('🕉️', { x: W / 2 - H * 0.25, y: H / 2 - H * 0.25, width: H * 0.5, height: H * 0.5, fill: '#8a1c00' }),
]);
def('flag-cross', 'flag', 'Nordic-cross style flag', 'Custom cross design', flagPatch(), (W, H) => [
  newShape('rect', { name: 'Field', x: 0, y: 0, width: W, height: H, fill: '#0a4c9c' }),
  newShape('rect', { name: 'Cross vertical', x: W * 0.28, y: 0, width: W * 0.14, height: H, fill: '#ffffff' }),
  newShape('rect', { name: 'Cross horizontal', x: 0, y: H * 0.43, width: W, height: H * 0.14, fill: '#ffffff' }),
]);
def('flag-org', 'flag', 'Organisation / party flag', 'Solid field with centred emblem and text', flagPatch(), (W, H) => [
  newShape('rect', { name: 'Field', x: 0, y: 0, width: W, height: H, fill: '#0b1f5c' }),
  newShape('ellipse', { name: 'Emblem', x: W / 2 - H * 0.22, y: H * 0.14, width: H * 0.44, height: H * 0.44, fill: '#ffd400' }),
  T('संगठन का नाम', W * 0.1, H * 0.66, W * 0.8, H * 0.22, { ...hi, autoFit: true, name: 'Name' }),
]);
def('flag-blank', 'flag', 'Blank flag', 'Start your own flag design', flagPatch(), (W, H) => [
  newShape('rect', { name: 'Field', x: 0, y: 0, width: W, height: H, fill: '#ffffff' }),
]);

// ---------------------------------------------------------------- scratch
def('blank-board', 'scratch', 'Blank signboard', 'Empty green board', {}, () => []);
def('blank-white', 'scratch', 'Blank white board', 'Empty white board with blue border', { board: { bg: { type: 'solid', color: '#ffffff', color2: '#ffffff' }, border: { enabled: true, color: '#0a4c9c', width: 14, inset: 14, radius: 16 } } }, () => []);

export const TEMPLATES = defs;

export function instantiate(tpl) {
  const kind = tpl.patch.kind || 'board';
  let structure = merge(defaultStructure(kind), tpl.patch);
  structure.kind = kind;
  const { W, H } = canvasSize(structure.board.widthM, structure.board.heightM);
  if (kind === 'flag') structure.poles.color = '#c9ced4';
  return { structure, elements: tpl.build(W, H) };
}
export { merge as mergeDeep };
