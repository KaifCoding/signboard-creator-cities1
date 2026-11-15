'use client';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Stage, Layer, Rect, Text, Path, Image as KImage, Transformer, Line, Shape } from 'react-konva';
import { useStore } from '../store/useStore.js';
import { registry } from '../lib/registry.js';
import { canvasSize, newText, newShape, newSymbol, newImage, uid } from '../lib/elements.js';
import { shapePath, STROKE_ONLY } from '../lib/shapes.js';
import { fontStack, ensureFonts } from '../lib/fonts.js';
import { loadImageFile } from '../lib/images.js';

let atlasTimer = null;
export function scheduleAtlas(delay = 140) {
  clearTimeout(atlasTimer);
  atlasTimer = setTimeout(() => useStore.getState().bumpAtlas(), delay);
}

// ---- image cache -------------------------------------------------------------------------------
const imgCache = new Map();
function useLoadedImage(src) {
  const [img, setImg] = useState(() => imgCache.get(src) || null);
  useEffect(() => {
    if (!src) return;
    if (imgCache.has(src)) { setImg(imgCache.get(src)); return; }
    const i = new window.Image();
    i.onload = () => { imgCache.set(src, i); setImg(i); scheduleAtlas(60); };
    i.src = src;
  }, [src]);
  return img;
}

// ---- auto text fitting ---------------------------------------------------------------------------
const fitCache = new Map();
export function fitFontSize(el, fv) {
  const key = [el.text, el.fontFamily, el.bold, el.italic, el.width, el.height, el.lineHeight, el.letterSpacing, fv].join('|');
  if (fitCache.has(key)) return fitCache.get(key);
  const style = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold' : 'normal'}`.trim();
  const words = String(el.text || '').split(/\s+/).filter(Boolean);
  const mk = (fs) => new Konva.Text({ text: el.text || ' ', fontFamily: fontStack(el.fontFamily), fontSize: fs, fontStyle: style, width: el.width, lineHeight: el.lineHeight, letterSpacing: el.letterSpacing, wrap: 'word', align: el.align });
  const fits = (fs) => {
    const t = mk(fs);
    if (t.height() > el.height + 0.5) return false;
    for (const w of words) if (t.measureSize(w).width > el.width + 0.5) return false;
    return true;
  };
  let lo = 4, hi = Math.max(8, Math.min(900, el.height * 1.4));
  for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  const r = Math.floor(lo * 10) / 10;
  if (fitCache.size > 800) fitCache.clear();
  fitCache.set(key, r);
  return r;
}

export function measureTextHeight(el) {
  const style = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold' : 'normal'}`.trim();
  return new Konva.Text({ text: el.text || ' ', fontFamily: fontStack(el.fontFamily), fontSize: el.fontSize, fontStyle: style, width: el.width, lineHeight: el.lineHeight, letterSpacing: el.letterSpacing, wrap: 'word' }).height();
}

const shadowProps = (s) => (s?.on ? { shadowColor: s.color, shadowBlur: s.blur, shadowOffsetX: s.offsetX, shadowOffsetY: s.offsetY, shadowOpacity: 0.9, shadowEnabled: true } : {});

function ElementNode({ el, assets, fontsVersion, handlers }) {
  const common = {
    id: el.id, name: 'el', x: el.x, y: el.y, rotation: el.rotation, opacity: el.opacity, visible: el.visible,
    draggable: !el.locked, listening: !el.locked,
    onMouseDown: (e) => handlers.onSelect(el, e), onTap: (e) => handlers.onSelect(el, e),
    onDblClick: () => handlers.onEdit(el), onDblTap: () => handlers.onEdit(el),
    onDragMove: handlers.onDragMove, onDragEnd: (e) => handlers.onDragEnd(el, e), onTransformEnd: (e) => handlers.onTransformEnd(el, e),
    ...shadowProps(el.shadow),
  };
  if (el.type === 'text') {
    const fs = el.autoFit ? fitFontSize(el, fontsVersion) : el.fontSize;
    const style = `${el.italic ? 'italic ' : ''}${el.bold ? 'bold' : 'normal'}`.trim();
    return (
      <Text key={el.id + ':' + fontsVersion} {...common} width={el.width} height={el.height} text={el.text} fontFamily={fontStack(el.fontFamily)} fontSize={fs}
        fontStyle={style} fill={el.fill} align={el.align} verticalAlign={el.verticalAlign} letterSpacing={el.letterSpacing} lineHeight={el.lineHeight} wrap="word"
        stroke={el.strokeWidth > 0 ? el.stroke : undefined} strokeWidth={el.strokeWidth || 0} fillAfterStrokeEnabled perfectDrawEnabled={false} />
    );
  }
  if (el.type === 'image') {
    return <ImageNode el={el} common={common} src={assets[el.assetId]?.dataUrl} />;
  }
  const hit = (ctx, shape) => { ctx.beginPath(); ctx.rect(0, 0, el.width, el.height); ctx.closePath(); ctx.fillStrokeShape(shape); };
  return (
    <Path {...common} data={shapePath(el.shape, el.width, el.height, el)} fill={el.fill || undefined} stroke={el.strokeWidth > 0 ? el.stroke : undefined}
      strokeWidth={el.strokeWidth || 0} lineJoin="round" lineCap={STROKE_ONLY.has(el.shape) ? 'round' : 'butt'} hitFunc={hit} perfectDrawEnabled={false} />
  );
}

function ImageNode({ el, common, src }) {
  const img = useLoadedImage(src);
  return <KImage {...common} image={img || undefined} width={el.width} height={el.height} perfectDrawEnabled={false} />;
}

const bgProps = (bg, W, H) => {
  if (bg.type !== 'gradient') return { fill: bg.color };
  const a = ((bg.angle ?? 90) * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
  const L = Math.abs(W * dx) + Math.abs(H * dy);
  return {
    fillLinearGradientStartPoint: { x: W / 2 - (dx * L) / 2, y: H / 2 - (dy * L) / 2 },
    fillLinearGradientEndPoint: { x: W / 2 + (dx * L) / 2, y: H / 2 + (dy * L) / 2 },
    fillLinearGradientColorStops: [0, bg.color, 1, bg.color2],
  };
};

export default function DesignCanvas({ active }) {
  const project = useStore((s) => s.project);
  const selectedIds = useStore((s) => s.selectedIds);
  const zoom = useStore((s) => s.zoom);
  const fitRequest = useStore((s) => s.fitRequest);
  const grid = useStore((s) => s.grid);
  const fontsVersion = useStore((s) => s.fontsVersion);
  const { structure, elements, assets } = project;
  const { W, H } = useMemo(() => canvasSize(structure.board.widthM, structure.board.heightM), [structure.board.widthM, structure.board.heightM]);
  const wrapRef = useRef(null), layerRef = useRef(null), trRef = useRef(null), stageRef = useRef(null);
  const [manualZoom, setManualZoom] = useState(false);

  // register the design layer so 3D preview / export / thumbnails can read pixels
  useEffect(() => { registry.layer = layerRef.current; registry.size = { W, H }; });

  // texture refresh whenever visual content changes
  useEffect(() => {
    let dead = false;
    ensureFonts(elements).then(() => { if (!dead) { useStore.getState().bumpFonts(); scheduleAtlas(); } });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, structure.board.bg, structure.board.border, W, H, assets]);

  // fit to window
  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el || el.clientWidth < 50) return;
    const z = Math.max(0.1, Math.min((el.clientWidth - 64) / W, (el.clientHeight - 64) / H, 2));
    useStore.getState().set({ zoom: z });
  }, [W, H]);
  useEffect(() => { setManualZoom(false); fit(); }, [fitRequest, fit]);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => { if (!manualZoom) fit(); });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [fit, manualZoom, active]);

  // attach transformer
  useEffect(() => {
    const tr = trRef.current, layer = layerRef.current;
    if (!tr || !layer) return;
    const byId = new Set(selectedIds);
    const nodes = layer.find('.el').filter((n) => byId.has(n.id()) && n.listening());
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, elements, fontsVersion, W, H]);

  const handlers = useMemo(() => ({
    onSelect: (el, e) => {
      const st = useStore.getState();
      if (e.evt && e.evt.shiftKey) st.select(st.selectedIds.includes(el.id) ? st.selectedIds.filter((i) => i !== el.id) : [...st.selectedIds, el.id]);
      else if (!st.selectedIds.includes(el.id)) st.select([el.id]);
    },
    onEdit: () => useStore.getState().set({ rightTab: 'element', editRequest: useStore.getState().editRequest + 1 }),
    onDragMove: (e) => {
      const g = useStore.getState().grid;
      if (g.snap) { e.target.x(Math.round(e.target.x() / g.size) * g.size); e.target.y(Math.round(e.target.y() / g.size) * g.size); }
    },
    onDragEnd: (el, e) => useStore.getState().updateElement(el.id, { x: Math.round(e.target.x() * 10) / 10, y: Math.round(e.target.y() * 10) / 10 }),
    onTransformEnd: (el, e) => {
      const n = e.target, sx = Math.abs(n.scaleX()), sy = Math.abs(n.scaleY());
      n.scaleX(1); n.scaleY(1);
      useStore.getState().updateElement(el.id, {
        x: Math.round(n.x() * 10) / 10, y: Math.round(n.y() * 10) / 10, rotation: Math.round(n.rotation() * 10) / 10,
        width: Math.max(6, Math.round(el.width * sx)), height: Math.max(6, Math.round(el.height * sy)),
      });
    },
  }), []);

  const pointerToCanvas = (clientX, clientY) => {
    const r = stageRef.current.container().getBoundingClientRect();
    return { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom };
  };

  const onDrop = async (e) => {
    e.preventDefault();
    const st = useStore.getState();
    const pt = pointerToCanvas(e.clientX, e.clientY);
    const raw = e.dataTransfer.getData('application/x-sbc-item');
    if (raw) {
      const item = JSON.parse(raw);
      let el;
      if (item.kind === 'text') el = newText({ ...item.props });
      else if (item.kind === 'shape') el = newShape(item.shape, { ...item.props });
      else if (item.kind === 'symbol') el = newSymbol(item.glyph);
      else if (item.kind === 'image' && st.project.assets[item.assetId]) el = newImage(st.project.assets[item.assetId]);
      if (el) { el.x = Math.round(pt.x - el.width / 2); el.y = Math.round(pt.y - el.height / 2); st.addElement(el); }
      return;
    }
    for (const f of Array.from(e.dataTransfer.files || [])) {
      if (!/^image\//.test(f.type) && !/\.(svg|png|jpe?g|webp)$/i.test(f.name)) continue;
      try {
        const asset = await loadImageFile(f);
        st.addAsset(asset);
        const el = newImage(asset);
        el.x = Math.round(pt.x - el.width / 2); el.y = Math.round(pt.y - el.height / 2);
        st.addElement(el);
      } catch (err) { st.notify(String(err.message || err), 'error'); }
    }
  };

  const onWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setManualZoom(true);
    const z = Math.max(0.1, Math.min(4, zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
    useStore.getState().set({ zoom: z });
  };

  const bg = structure.board.bg, br = structure.board.border;
  const radiusPx = Math.min(W, H) * Math.min(0.5, structure.board.cornerRadiusM / Math.min(structure.board.widthM, structure.board.heightM));
  const cornerMask = (ctx) => {
    const r = (structure.kind === 'flag' ? 0 : (structure.board.cornerRadiusM / structure.board.widthM) * W);
    ctx.beginPath(); ctx.rect(-2, -2, W + 4, H + 4);
    const rr = Math.min(r, Math.min(W, H) / 2);
    ctx.moveTo(rr, 0); ctx.arcTo(W, 0, W, H, rr); ctx.arcTo(W, H, 0, H, rr); ctx.arcTo(0, H, 0, 0, rr); ctx.arcTo(0, 0, W, 0, rr); ctx.closePath();
    ctx._context.fillStyle = 'rgba(8,10,14,0.78)';
    ctx._context.fill('evenodd');
  };
  const gridLines = [];
  if (grid.show) {
    for (let x = grid.size; x < W; x += grid.size) gridLines.push(<Line key={'gx' + x} points={[x, 0, x, H]} stroke="rgba(255,255,255,0.12)" strokeWidth={1 / zoom} listening={false} />);
    for (let y = grid.size; y < H; y += grid.size) gridLines.push(<Line key={'gy' + y} points={[0, y, W, y]} stroke="rgba(255,255,255,0.12)" strokeWidth={1 / zoom} listening={false} />);
  }
  const single = selectedIds.length === 1 ? elements.find((e) => e.id === selectedIds[0]) : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div ref={wrapRef} onDrop={onDrop} onDragOver={(e) => e.preventDefault()} onWheel={onWheel}
        className="canvas-bg relative min-h-0 flex-1 overflow-auto">
        <div style={{ width: W * zoom + 64, height: H * zoom + 64, padding: 32 }} className="mx-auto">
          <div style={{ width: W * zoom, height: H * zoom, boxShadow: '0 10px 40px rgba(0,0,0,.55)' }} className="relative">
            <div style={{ width: W, height: H, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
              <Stage ref={stageRef} width={W} height={H}
                onMouseDown={(e) => { if (e.target === e.target.getStage() || e.target.name() === 'bg') useStore.getState().select([]); }}
                onTouchStart={(e) => { if (e.target === e.target.getStage() || e.target.name() === 'bg') useStore.getState().select([]); }}>
                <Layer ref={layerRef}>
                  <Rect name="bg" x={0} y={0} width={W} height={H} {...bgProps(bg, W, H)} />
                  {elements.map((el) => <ElementNode key={el.id} el={el} assets={assets} fontsVersion={fontsVersion} handlers={handlers} />)}
                  {br.enabled && (
                    <Rect x={br.inset} y={br.inset} width={W - 2 * br.inset} height={H - 2 * br.inset} stroke={br.color} strokeWidth={br.width} cornerRadius={br.radius} listening={false} />
                  )}
                </Layer>
                <Layer>
                  {gridLines}
                  <Shape sceneFunc={cornerMask} listening={false} />
                  <Transformer ref={trRef} flipEnabled={false} rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]} rotationSnapTolerance={5}
                    keepRatio={!!single && single.type !== 'text'} anchorSize={Math.max(8, 11 / zoom)} borderStrokeWidth={Math.max(1, 1.5 / zoom)} anchorStrokeWidth={Math.max(1, 1.5 / zoom)}
                    rotateAnchorOffset={Math.max(24, 34 / zoom)} borderStroke="#ff9933" anchorStroke="#ff9933" anchorFill="#14181f" anchorCornerRadius={2}
                    boundBoxFunc={(o, n) => (n.width < 8 || n.height < 8 ? o : n)} />
                </Layer>
              </Stage>
            </div>
          </div>
        </div>
      </div>
      <div className="flex h-8 shrink-0 items-center gap-3 border-t border-ink-600 bg-ink-850 px-3 text-[11px] text-slate-400">
        <span>Design {W}×{H}px · {structure.board.widthM}×{structure.board.heightM} m</span>
        <span className="ml-auto flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={grid.show} onChange={(e) => useStore.getState().set({ grid: { ...grid, show: e.target.checked } })} /> Grid</label>
          <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={grid.snap} onChange={(e) => useStore.getState().set({ grid: { ...grid, snap: e.target.checked } })} /> Snap</label>
          <button className="rounded px-2 py-0.5 hover:bg-ink-600" onClick={() => useStore.getState().set({ zoom: Math.max(0.1, zoom / 1.2) }) || setManualZoom(true)}>−</button>
          <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button className="rounded px-2 py-0.5 hover:bg-ink-600" onClick={() => useStore.getState().set({ zoom: Math.min(4, zoom * 1.2) }) || setManualZoom(true)}>+</button>
          <button className="rounded px-2 py-0.5 hover:bg-ink-600" onClick={() => { setManualZoom(false); fit(); }}>Fit</button>
        </span>
      </div>
    </div>
  );
}
