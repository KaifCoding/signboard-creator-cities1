// All vector shapes are SVG path strings generated for a (w,h) box. The same path feeds
// Konva.Path (editor/texture) and <svg> (template thumbnails).
const f = (n) => Math.round(n * 100) / 100;

export const SHAPES = [
  { type: 'rect', label: 'Rectangle' },
  { type: 'ellipse', label: 'Circle / Ellipse' },
  { type: 'triangle', label: 'Triangle' },
  { type: 'diamond', label: 'Diamond' },
  { type: 'hexagon', label: 'Hexagon' },
  { type: 'octagon', label: 'Octagon' },
  { type: 'star', label: 'Star' },
  { type: 'arrow', label: 'Block arrow' },
  { type: 'chevron', label: 'Chevron' },
  { type: 'arrowline', label: 'Line arrow' },
  { type: 'line', label: 'Line' },
  { type: 'cross', label: 'Plus / Cross' },
  { type: 'shield', label: 'Highway shield' },
  { type: 'chakra', label: 'Ashoka Chakra' },
];

export const STROKE_ONLY = new Set(['line', 'arrowline', 'chakra']);

const poly = (pts) => 'M' + pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' L') + ' Z';
const ngon = (n, w, h, rot = -90) => poly(Array.from({ length: n }, (_, k) => {
  const a = ((rot + (360 / n) * k) * Math.PI) / 180;
  return [w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)];
}));

export function shapePath(type, w, h, o = {}) {
  w = Math.max(1, w); h = Math.max(1, h);
  switch (type) {
    case 'rect': {
      const r = Math.max(0, Math.min(o.cornerRadius || 0, Math.min(w, h) / 2));
      if (!r) return `M0,0 L${f(w)},0 L${f(w)},${f(h)} L0,${f(h)} Z`;
      return `M${r},0 L${f(w - r)},0 A${r},${r} 0 0 1 ${f(w)},${r} L${f(w)},${f(h - r)} A${r},${r} 0 0 1 ${f(w - r)},${f(h)} L${r},${f(h)} A${r},${r} 0 0 1 0,${f(h - r)} L0,${r} A${r},${r} 0 0 1 ${r},0 Z`;
    }
    case 'ellipse': return `M0,${f(h / 2)} A${f(w / 2)},${f(h / 2)} 0 1 1 ${f(w)},${f(h / 2)} A${f(w / 2)},${f(h / 2)} 0 1 1 0,${f(h / 2)} Z`;
    case 'triangle': return poly([[w / 2, 0], [w, h], [0, h]]);
    case 'diamond': return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'hexagon': return ngon(6, w, h, 0);
    case 'octagon': return ngon(8, w, h, -67.5);
    case 'star': {
      const n = o.points || 5, inner = o.inner || 0.4, pts = [];
      for (let k = 0; k < n * 2; k++) {
        const a = ((-90 + (180 / n) * k) * Math.PI) / 180, rr = k % 2 ? inner : 1;
        pts.push([w / 2 + (w / 2) * rr * Math.cos(a), h / 2 + (h / 2) * rr * Math.sin(a)]);
      }
      return poly(pts);
    }
    case 'arrow': {
      const d = o.dir || 'right';
      if (d === 'left') return poly([[w, h * 0.3], [w * 0.4, h * 0.3], [w * 0.4, 0], [0, h / 2], [w * 0.4, h], [w * 0.4, h * 0.7], [w, h * 0.7]]);
      if (d === 'up') return poly([[w * 0.3, h], [w * 0.3, h * 0.4], [0, h * 0.4], [w / 2, 0], [w, h * 0.4], [w * 0.7, h * 0.4], [w * 0.7, h]]);
      if (d === 'down') return poly([[w * 0.3, 0], [w * 0.3, h * 0.6], [0, h * 0.6], [w / 2, h], [w, h * 0.6], [w * 0.7, h * 0.6], [w * 0.7, 0]]);
      return poly([[0, h * 0.3], [w * 0.6, h * 0.3], [w * 0.6, 0], [w, h / 2], [w * 0.6, h], [w * 0.6, h * 0.7], [0, h * 0.7]]);
    }
    case 'chevron': {
      const d = o.dir || 'right';
      if (d === 'left') return poly([[w, 0], [w * 0.38, 0], [0, h / 2], [w * 0.38, h], [w, h], [w * 0.62, h / 2]]);
      if (d === 'up') return poly([[0, h], [0, h * 0.38], [w / 2, 0], [w, h * 0.38], [w, h], [w / 2, h * 0.62]]);
      if (d === 'down') return poly([[0, 0], [0, h * 0.62], [w / 2, h], [w, h * 0.62], [w, 0], [w / 2, h * 0.38]]);
      return poly([[0, 0], [w * 0.62, 0], [w, h / 2], [w * 0.62, h], [0, h], [w * 0.38, h / 2]]);
    }
    case 'arrowline': return `M0,${f(h / 2)} L${f(w)},${f(h / 2)} M${f(w * 0.68)},${f(h * 0.08)} L${f(w)},${f(h / 2)} L${f(w * 0.68)},${f(h * 0.92)}`;
    case 'line': return `M0,${f(h / 2)} L${f(w)},${f(h / 2)}`;
    case 'cross': { const t = 0.34; return poly([[w * t, 0], [w * (1 - t), 0], [w * (1 - t), h * t], [w, h * t], [w, h * (1 - t)], [w * (1 - t), h * (1 - t)], [w * (1 - t), h], [w * t, h], [w * t, h * (1 - t)], [0, h * (1 - t)], [0, h * t], [w * t, h * t]]); }
    case 'shield': return `M${f(w / 2)},0 C${f(w * 0.72)},${f(h * 0.07)} ${f(w * 0.88)},${f(h * 0.08)} ${f(w)},${f(h * 0.1)} L${f(w)},${f(h * 0.55)} C${f(w)},${f(h * 0.8)} ${f(w * 0.7)},${f(h * 0.92)} ${f(w / 2)},${f(h)} C${f(w * 0.3)},${f(h * 0.92)} 0,${f(h * 0.8)} 0,${f(h * 0.55)} L0,${f(h * 0.1)} C${f(w * 0.12)},${f(h * 0.08)} ${f(w * 0.28)},${f(h * 0.07)} ${f(w / 2)},0 Z`;
    case 'chakra': {
      const R = Math.min(w, h) / 2, cx = w / 2, cy = h / 2, hub = R * 0.12;
      let d = `M${f(cx - R)},${f(cy)} A${f(R)},${f(R)} 0 1 1 ${f(cx + R)},${f(cy)} A${f(R)},${f(R)} 0 1 1 ${f(cx - R)},${f(cy)} Z`;
      d += ` M${f(cx - hub)},${f(cy)} A${f(hub)},${f(hub)} 0 1 1 ${f(cx + hub)},${f(cy)} A${f(hub)},${f(hub)} 0 1 1 ${f(cx - hub)},${f(cy)} Z`;
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2, b = a + Math.PI / 24;
        d += ` M${f(cx + hub * Math.cos(a))},${f(cy + hub * Math.sin(a))} L${f(cx + R * Math.cos(a))},${f(cy + R * Math.sin(a))}`;
        const dr = R * 0.9, rr = R * 0.045, dx = cx + dr * Math.cos(b), dy = cy + dr * Math.sin(b);
        d += ` M${f(dx - rr)},${f(dy)} A${f(rr)},${f(rr)} 0 1 1 ${f(dx + rr)},${f(dy)} A${f(rr)},${f(rr)} 0 1 1 ${f(dx - rr)},${f(dy)} Z`;
      }
      return d;
    }
    default: return `M0,0 L${f(w)},0 L${f(w)},${f(h)} L0,${f(h)} Z`;
  }
}
