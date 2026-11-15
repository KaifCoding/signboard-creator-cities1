'use client';
import React, { useMemo, useState } from 'react';
import TemplateIcon from '@mui/icons-material/ViewQuilt';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ImageIcon from '@mui/icons-material/Image';
import CategoryIcon from '@mui/icons-material/Category';
import FlagIcon from '@mui/icons-material/Flag';
import LayersIcon from '@mui/icons-material/Layers';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Lock from '@mui/icons-material/Lock';
import LockOpen from '@mui/icons-material/LockOpen';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ContentCopy from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import { useStore } from '../store/useStore.js';
import { TEMPLATES, CATEGORIES, instantiate, HI, EN, UR } from '../lib/templates.js';
import { SHAPES, shapePath } from '../lib/shapes.js';
import { newText, newShape, newSymbol, newImage, canvasSize, SYMBOLS } from '../lib/elements.js';
import { fontStack } from '../lib/fonts.js';
import { loadImageFile } from '../lib/images.js';
import { IconBtn } from './ui.jsx';

const RAIL = [
  ['templates', 'Templates', TemplateIcon], ['text', 'Text', TextFieldsIcon], ['images', 'Images', ImageIcon],
  ['shapes', 'Shapes', CategoryIcon], ['flags', 'Flags', FlagIcon], ['layers', 'Layers', LayersIcon],
];

const dragData = (e, obj) => { e.dataTransfer.setData('application/x-sbc-item', JSON.stringify(obj)); e.dataTransfer.effectAllowed = 'copy'; };

function centerOf(el) {
  const { structure } = useStore.getState().project;
  const { W, H } = canvasSize(structure.board.widthM, structure.board.heightM);
  return { ...el, x: Math.round((W - el.width) / 2), y: Math.round((H - el.height) / 2) };
}

// ------------------------------------------------------------------------ template thumbnail (SVG)
function Thumb({ tpl }) {
  const data = useMemo(() => instantiate(tpl), [tpl]);
  const { structure, elements } = data;
  const { W, H } = canvasSize(structure.board.widthM, structure.board.heightM);
  const bg = structure.board.bg, br = structure.board.border;
  const gid = 'g' + tpl.id;
  const r = structure.kind === 'flag' ? 0 : Math.min(W / 2, (structure.board.cornerRadiusM / structure.board.widthM) * W);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ aspectRatio: `${W}/${H}`, maxHeight: 120 }}>
      <defs>
        {bg.type === 'gradient' && <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={bg.color} /><stop offset="1" stopColor={bg.color2} /></linearGradient>}
        <clipPath id={'c' + tpl.id}><rect width={W} height={H} rx={r} /></clipPath>
      </defs>
      <g clipPath={`url(#c${tpl.id})`}>
        <rect width={W} height={H} fill={bg.type === 'gradient' ? `url(#${gid})` : bg.color} />
        {elements.map((e) => {
          const tf = `translate(${e.x} ${e.y}) rotate(${e.rotation || 0})`;
          if (e.type === 'shape') return <path key={e.id} transform={tf} d={shapePath(e.shape, e.width, e.height, e)} fill={e.fill || 'none'} stroke={e.strokeWidth > 0 ? e.stroke : 'none'} strokeWidth={e.strokeWidth} strokeLinejoin="round" />;
          if (e.type === 'text') {
            const fs = e.autoFit ? Math.min(e.height * 0.82, (e.width / Math.max(1, [...e.text].length)) * 1.7) : e.fontSize;
            const anchor = e.align === 'left' ? 'start' : e.align === 'right' ? 'end' : 'middle';
            const tx = e.align === 'left' ? 0 : e.align === 'right' ? e.width : e.width / 2;
            return <text key={e.id} transform={tf} x={tx} y={e.height / 2} dominantBaseline="central" textAnchor={anchor} fill={e.fill} fontSize={fs} fontWeight={e.bold ? 700 : 400} fontFamily={fontStack(e.fontFamily)}>{e.text}</text>;
          }
          return null;
        })}
        {br.enabled && <rect x={br.inset} y={br.inset} width={W - 2 * br.inset} height={H - 2 * br.inset} rx={br.radius} fill="none" stroke={br.color} strokeWidth={br.width} />}
      </g>
    </svg>
  );
}

function TemplatesPanel({ only }) {
  const [cat, setCat] = useState(only ? only : 'all');
  const [q, setQ] = useState('');
  const list = TEMPLATES.filter((t) => (only ? t.category === only : cat === 'all' || t.category === cat) && (!q || (t.name + t.desc).toLowerCase().includes(q.toLowerCase())));
  const apply = (id) => {
    const st = useStore.getState();
    if (st.project.elements.length && !window.confirm('Replace the current design with this template? (You can undo.)')) return;
    st.applyTemplate(id);
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-ink-600 p-2.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…" className="h-7 w-full rounded border border-ink-500 bg-ink-900 px-2 text-[12px] outline-none focus:border-saffron" />
        {!only && (
          <div className="flex flex-wrap gap-1">
            {[{ id: 'all', label: 'All' }, ...CATEGORIES].map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`rounded px-1.5 py-0.5 text-[10.5px] ${cat === c.id ? 'bg-saffron text-black' : 'bg-ink-700 text-slate-300 hover:bg-ink-600'}`}>{c.label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
        {list.map((t) => (
          <button key={t.id} onClick={() => apply(t.id)} className="group block w-full overflow-hidden rounded-md border border-ink-600 bg-ink-900 text-left transition hover:border-saffron">
            <div className="flex items-center justify-center bg-[#0d1015] p-2"><div className="w-full"><Thumb tpl={t} /></div></div>
            <div className="px-2.5 py-1.5"><div className="text-[12px] font-medium text-slate-100">{t.name}</div><div className="text-[10.5px] text-slate-500">{t.desc}</div></div>
          </button>
        ))}
        {!list.length && <div className="p-4 text-center text-[12px] text-slate-500">No templates match.</div>}
      </div>
    </div>
  );
}

const TEXT_PRESETS = [
  ['Heading (English)', { text: 'Heading', fontFamily: EN, fontSize: 110, height: 150, width: 700 }],
  ['हिन्दी शीर्षक', { text: 'हिन्दी शीर्षक', fontFamily: HI, fontSize: 110, height: 150, width: 700 }],
  ['اردو عنوان', { text: 'اردو عنوان', fontFamily: UR, lineHeight: 1.7, fontSize: 90, height: 170, width: 700 }],
  ['Sub-text', { text: 'Sub-text line', fontFamily: EN, fontSize: 52, bold: false, height: 80, width: 600 }],
  ['Auto-fit text', { text: 'Fits its box', fontFamily: EN, autoFit: true, height: 120, width: 500 }],
  ['Distance  45 km', { text: '45 km', fontFamily: EN, fontSize: 80, height: 110, width: 300 }],
];

function TextPanel() {
  return (
    <div className="scroll-thin h-full space-y-3 overflow-y-auto p-2.5">
      <p className="text-[11.5px] leading-snug text-slate-500">Click to add at the centre, or drag onto the canvas. Edit text, font, colour and script in the Element tab.</p>
      <div className="space-y-1.5">
        {TEXT_PRESETS.map(([label, props]) => (
          <button key={label} draggable onDragStart={(e) => dragData(e, { kind: 'text', props })} onClick={() => useStore.getState().addElement(centerOf(newText(props)))}
            className="block w-full rounded border border-ink-600 bg-ink-900 px-3 py-2 text-left text-[14px] text-slate-100 hover:border-saffron" style={{ fontFamily: fontStack(props.fontFamily), fontWeight: props.bold === false ? 400 : 700 }}>{label}</button>
        ))}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Symbols</div>
      <div className="grid grid-cols-6 gap-1">
        {SYMBOLS.map((g) => (
          <button key={g} draggable onDragStart={(e) => dragData(e, { kind: 'symbol', glyph: g })} onClick={() => useStore.getState().addElement(centerOf(newSymbol(g)))}
            className="flex h-9 items-center justify-center rounded border border-ink-600 bg-ink-900 text-[18px] hover:border-saffron">{g}</button>
        ))}
      </div>
    </div>
  );
}

function ImagesPanel() {
  const assets = useStore((s) => s.project.assets);
  const upload = async (e) => {
    const st = useStore.getState();
    for (const f of Array.from(e.target.files || [])) {
      try { const a = await loadImageFile(f); st.addAsset(a); st.addElement(centerOf(newImage(a))); } catch (err) { st.notify(String(err.message || err), 'error'); }
    }
    e.target.value = '';
  };
  const list = Object.values(assets);
  return (
    <div className="scroll-thin h-full space-y-3 overflow-y-auto p-2.5">
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-ink-500 bg-ink-900 p-5 text-center text-[12px] text-slate-300 hover:border-saffron">
        <ImageIcon sx={{ fontSize: 28 }} className="text-slate-500" />
        <span className="font-medium">Upload images, logos or flags</span>
        <span className="text-[10.5px] text-slate-500">PNG · JPG · WEBP · SVG — or drop files onto the canvas</span>
        <input type="file" hidden multiple accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" onChange={upload} />
      </label>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Project images ({list.length})</div>
      <div className="grid grid-cols-3 gap-1.5">
        {list.map((a) => (
          <button key={a.id} title={a.name} draggable onDragStart={(e) => dragData(e, { kind: 'image', assetId: a.id })} onClick={() => useStore.getState().addElement(centerOf(newImage(a)))}
            className="flex aspect-square items-center justify-center overflow-hidden rounded border border-ink-600 bg-[repeating-conic-gradient(#222_0_25%,#2b2b2b_0_50%)] bg-[length:12px_12px] hover:border-saffron">
            <img src={a.dataUrl} alt={a.name} className="max-h-full max-w-full object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ShapesPanel() {
  return (
    <div className="scroll-thin h-full space-y-3 overflow-y-auto p-2.5">
      <div className="grid grid-cols-3 gap-1.5">
        {SHAPES.map((s) => {
          const el = newShape(s.type);
          const strokeOnly = !el.fill;
          return (
            <button key={s.type} title={s.label} draggable onDragStart={(e) => dragData(e, { kind: 'shape', shape: s.type })} onClick={() => useStore.getState().addElement(centerOf(el))}
              className="flex flex-col items-center gap-1 rounded border border-ink-600 bg-ink-900 p-2 hover:border-saffron">
              <svg viewBox="0 0 100 100" className="h-10 w-10"><path d={shapePath(s.type, 100, 100, { cornerRadius: 12 })} fill={strokeOnly ? 'none' : '#e5e7eb'} stroke={strokeOnly ? '#e5e7eb' : 'none'} strokeWidth="5" strokeLinecap="round" /></svg>
              <span className="text-[10px] text-slate-400">{s.label}</span>
            </button>
          );
        })}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Direction arrows</div>
      <div className="grid grid-cols-4 gap-1.5">
        {['left', 'right', 'up', 'down'].map((d) => (
          <button key={d} onClick={() => useStore.getState().addElement(centerOf(newShape('arrow', { dir: d, width: d === 'up' || d === 'down' ? 140 : 240, height: d === 'up' || d === 'down' ? 240 : 140, name: `Arrow ${d}` })))}
            className="flex h-10 items-center justify-center rounded border border-ink-600 bg-ink-900 text-[18px] text-slate-200 hover:border-saffron">{{ left: '⬅', right: '➡', up: '⬆', down: '⬇' }[d]}</button>
        ))}
      </div>
    </div>
  );
}

function LayersPanel() {
  const elements = useStore((s) => s.project.elements);
  const selectedIds = useStore((s) => s.selectedIds);
  const [dragId, setDragId] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const st = useStore.getState();
  const rows = [...elements].reverse();
  const icon = (e) => (e.type === 'text' ? 'T' : e.type === 'image' ? '▣' : '◆');
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-0.5 border-b border-ink-600 px-2 py-1.5">
        <span className="px-1 text-[11px] text-slate-500">{elements.length} layers</span>
        <span className="ml-auto flex">
          <IconBtn title="Bring forward" disabled={selectedIds.length !== 1} onClick={() => st.reorder(selectedIds[0], 'up')}><ArrowUpward sx={{ fontSize: 16 }} /></IconBtn>
          <IconBtn title="Send backward" disabled={selectedIds.length !== 1} onClick={() => st.reorder(selectedIds[0], 'down')}><ArrowDownward sx={{ fontSize: 16 }} /></IconBtn>
          <IconBtn title="Duplicate" disabled={!selectedIds.length} onClick={() => st.duplicate(selectedIds)}><ContentCopy sx={{ fontSize: 15 }} /></IconBtn>
          <IconBtn title="Delete" disabled={!selectedIds.length} onClick={() => st.removeElements(selectedIds)}><DeleteIcon sx={{ fontSize: 16 }} /></IconBtn>
        </span>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">
        {rows.map((e) => {
          const sel = selectedIds.includes(e.id);
          return (
            <div key={e.id} draggable onDragStart={() => setDragId(e.id)} onDragOver={(ev) => ev.preventDefault()}
              onDrop={() => { if (dragId && dragId !== e.id) { const target = elements.findIndex((x) => x.id === e.id); st.moveTo(dragId, target); } setDragId(null); }}
              onClick={(ev) => st.select(ev.shiftKey ? [...new Set([...selectedIds, e.id])] : [e.id])}
              className={`mb-0.5 flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[12px] ${sel ? 'bg-saffron/20 text-slate-50 ring-1 ring-saffron/60' : 'text-slate-300 hover:bg-ink-700'}`}>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-ink-700 text-[10px] text-slate-400">{icon(e)}</span>
              {renaming === e.id ? (
                <input autoFocus defaultValue={e.name} className="h-5 min-w-0 flex-1 rounded border border-saffron bg-ink-900 px-1 text-[12px] outline-none" onClick={(ev) => ev.stopPropagation()}
                  onBlur={(ev) => { st.updateElement(e.id, { name: ev.target.value || e.name }); setRenaming(null); }} onKeyDown={(ev) => { if (ev.key === 'Enter') ev.target.blur(); if (ev.key === 'Escape') setRenaming(null); }} />
              ) : (
                <span className="min-w-0 flex-1 truncate" onDoubleClick={() => setRenaming(e.id)} title="Double-click to rename">{e.type === 'text' && e.name === 'Text' ? e.text.slice(0, 24) : e.name}</span>
              )}
              <button className="text-slate-500 hover:text-slate-200" title={e.visible ? 'Hide' : 'Show'} onClick={(ev) => { ev.stopPropagation(); st.updateElement(e.id, { visible: !e.visible }); }}>{e.visible ? <Visibility sx={{ fontSize: 15 }} /> : <VisibilityOff sx={{ fontSize: 15 }} />}</button>
              <button className="text-slate-500 hover:text-slate-200" title={e.locked ? 'Unlock' : 'Lock'} onClick={(ev) => { ev.stopPropagation(); st.updateElement(e.id, { locked: !e.locked }); }}>{e.locked ? <Lock sx={{ fontSize: 14 }} /> : <LockOpen sx={{ fontSize: 14 }} />}</button>
            </div>
          );
        })}
        {!elements.length && <div className="p-4 text-center text-[12px] text-slate-500">No layers yet. Add text, images or shapes.</div>}
      </div>
    </div>
  );
}

export default function LeftSidebar() {
  const tab = useStore((s) => s.leftTab);
  return (
    <div className="flex h-full min-h-0 bg-ink-850">
      <div className="flex w-[58px] shrink-0 flex-col items-stretch gap-0.5 border-r border-ink-600 bg-ink-900 py-1.5">
        {RAIL.map(([id, label, Icon]) => (
          <button key={id} onClick={() => useStore.getState().set({ leftTab: id })} className={`flex flex-col items-center gap-0.5 border-l-2 py-2 text-[10px] ${tab === id ? 'border-saffron bg-ink-800 text-saffron' : 'border-transparent text-slate-400 hover:text-slate-100'}`}>
            <Icon sx={{ fontSize: 20 }} />{label}
          </button>
        ))}
      </div>
      <div className="min-h-0 min-w-0 flex-1">
        {tab === 'templates' && <TemplatesPanel />}
        {tab === 'text' && <TextPanel />}
        {tab === 'images' && <ImagesPanel />}
        {tab === 'shapes' && <ShapesPanel />}
        {tab === 'flags' && <TemplatesPanel only="flag" />}
        {tab === 'layers' && <LayersPanel />}
      </div>
    </div>
  );
}
