'use client';
import React, { useEffect, useRef } from 'react';
import { Tabs, Tab } from '@mui/material';
import FormatBold from '@mui/icons-material/FormatBold';
import FormatItalic from '@mui/icons-material/FormatItalic';
import FormatAlignLeft from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenter from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRight from '@mui/icons-material/FormatAlignRight';
import VerticalAlignTop from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignCenter from '@mui/icons-material/VerticalAlignCenter';
import VerticalAlignBottom from '@mui/icons-material/VerticalAlignBottom';
import { useStore } from '../store/useStore.js';
import { Section, Field, Num, Color, Sel, Check, IconBtn, Btn } from './ui.jsx';
import { FONT_GROUPS, registerFontFile } from '../lib/fonts.js';
import { SHAPES } from '../lib/shapes.js';
import { canvasSize } from '../lib/elements.js';
import { measureTextHeight } from './DesignCanvas.jsx';
import { saveFontRecord } from '../lib/db.js';
import { loadImageFile } from '../lib/images.js';
import { renderDesign } from '../lib/registry.js';
import { runExport, download } from '../lib/exportClient.js';

const BOARD_SIZES = [['Km stone 1 × 1.3 m', 1, 1.3], ['Circular 1.2 × 1.2 m', 1.2, 1.2], ['Small 3 × 1.5 m', 3, 1.5], ['Standard 4 × 2 m', 4, 2], ['Wide 5 × 2.2 m', 5, 2.2], ['Large 6 × 2.5 m', 6, 2.5], ['Gantry 8 × 2.6 m', 8, 2.6]];
const FLAG_SIZES = [['3 × 2 m (3:2)', 3, 2], ['2 × 1.33 m', 2, 1.333], ['1.5 × 1 m', 1.5, 1], ['4.5 × 3 m', 4.5, 3], ['6 × 4 m', 6, 4]];

const textarea = 'w-full resize-y rounded border border-ink-500 bg-ink-900 px-2 py-1.5 text-[13px] text-slate-100 outline-none focus:border-saffron';

function resizeBoard(widthM, heightM, scaleDesign) {
  const st = useStore.getState();
  const o = canvasSize(st.project.structure.board.widthM, st.project.structure.board.heightM);
  const n = canvasSize(widthM, heightM);
  st.mutate((p) => {
    let elements = p.elements;
    if (scaleDesign && (o.W !== n.W || o.H !== n.H)) {
      const sx = n.W / o.W, sy = n.H / o.H, sf = Math.min(sx, sy);
      elements = p.elements.map((e) => ({ ...e, x: e.x * sx, y: e.y * sy, width: e.width * sx, height: e.height * sy, fontSize: e.fontSize ? e.fontSize * sf : e.fontSize, strokeWidth: e.strokeWidth ? e.strokeWidth * sf : e.strokeWidth }));
    }
    const board = { ...p.structure.board, widthM, heightM };
    return { ...p, elements, structure: { ...p.structure, board } };
  }, 'boardsize');
  st.set({ fitRequest: st.fitRequest + 1 });
}

function AlignRow({ ids }) {
  const a = useStore.getState().align;
  const B = ({ k, children }) => <button onClick={() => a(ids, k)} className="h-6 flex-1 rounded bg-ink-700 text-[10.5px] text-slate-300 hover:bg-ink-600">{children}</button>;
  return (
    <div className="flex gap-1"><B k="left">Left</B><B k="center">Center</B><B k="right">Right</B><B k="top">Top</B><B k="middle">Middle</B><B k="bottom">Bottom</B></div>
  );
}

function ElementTab() {
  const selectedIds = useStore((s) => s.selectedIds);
  const elements = useStore((s) => s.project.elements);
  const assets = useStore((s) => s.project.assets);
  const customFonts = useStore((s) => s.customFonts);
  const editRequest = useStore((s) => s.editRequest);
  const st = useStore.getState();
  const taRef = useRef(null);
  const el = selectedIds.length === 1 ? elements.find((e) => e.id === selectedIds[0]) : null;

  useEffect(() => { if (editRequest && taRef.current) { taRef.current.focus(); taRef.current.select(); } }, [editRequest]);

  if (!selectedIds.length) return <div className="p-4 text-[12.5px] leading-relaxed text-slate-400">Select an element on the canvas or in Layers to edit it. Drag items from the left panel onto the canvas, or drop image files straight onto it.</div>;
  if (!el) {
    return (
      <div>
        <Section title={`${selectedIds.length} elements selected`}>
          <AlignRow ids={selectedIds} />
          <div className="flex gap-1">
            <Btn onClick={() => st.duplicate(selectedIds)}>Duplicate</Btn>
            <Btn onClick={() => st.removeElements(selectedIds)}>Delete</Btn>
          </div>
          <Num label="Opacity" value={Math.round((elements.find((e) => e.id === selectedIds[0])?.opacity ?? 1) * 100)} min={0} max={100} unit="%" onChange={(v) => st.updateElements(selectedIds, () => ({ opacity: v / 100 }), 'multi-opacity')} />
        </Section>
      </div>
    );
  }
  const u = (patch, key) => st.updateElement(el.id, patch, key || 'el:' + el.id + ':' + Object.keys(patch)[0]);
  const fontGroups = [...FONT_GROUPS.map((g) => ({ label: g.label, options: g.fonts })), ...(customFonts.length ? [{ label: 'Uploaded fonts', options: customFonts }] : [])];

  const onFontUpload = async (e) => {
    for (const f of Array.from(e.target.files || [])) {
      try {
        const rec = await registerFontFile(f);
        await saveFontRecord(rec);
        useStore.getState().set({ customFonts: [...new Set([...useStore.getState().customFonts, rec.name])] });
        useStore.getState().bumpFonts();
        u({ fontFamily: rec.name });
        st.notify(`Font "${rec.name}" added`, 'success');
      } catch (err) { st.notify('Could not load font: ' + (err.message || err), 'error'); }
    }
    e.target.value = '';
  };
  const replaceImage = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const a = await loadImageFile(f); st.addAsset(a); u({ assetId: a.id }); } catch (err) { st.notify(String(err.message || err), 'error'); }
    e.target.value = '';
  };
  const asset = el.type === 'image' ? assets[el.assetId] : null;
  const { W, H } = canvasSize(st.project.structure.board.widthM, st.project.structure.board.heightM);

  return (
    <div>
      <Section title="Layer" right={
        <span className="flex gap-0.5">
          <IconBtn title={el.visible ? 'Hide' : 'Show'} onClick={() => u({ visible: !el.visible }, 'vis')}><span className="text-[11px]">{el.visible ? '👁' : '—'}</span></IconBtn>
          <IconBtn title={el.locked ? 'Unlock' : 'Lock'} onClick={() => u({ locked: !el.locked }, 'lock')}><span className="text-[11px]">{el.locked ? '🔒' : '🔓'}</span></IconBtn>
        </span>}>
        <Field label="Name"><input className="h-7 w-full rounded border border-ink-500 bg-ink-900 px-2 text-[12px] outline-none focus:border-saffron" value={el.name} onChange={(e) => u({ name: e.target.value })} /></Field>
        <div className="flex gap-1">
          <Btn onClick={() => st.reorder(el.id, 'top')}>To front</Btn><Btn onClick={() => st.reorder(el.id, 'up')}>Forward</Btn>
          <Btn onClick={() => st.reorder(el.id, 'down')}>Back</Btn><Btn onClick={() => st.reorder(el.id, 'bottom')}>To back</Btn>
        </div>
        <div className="flex gap-1"><Btn onClick={() => st.duplicate([el.id])}>Duplicate</Btn><Btn onClick={() => st.removeElements([el.id])}>Delete</Btn></div>
      </Section>

      {el.type === 'text' && (
        <Section title="Text">
          <textarea ref={taRef} dir="auto" rows={3} className={textarea} value={el.text} onChange={(e) => u({ text: e.target.value }, 'text:' + el.id)} placeholder="Type English, हिन्दी or اردو" />
          <Sel label="Font" value={el.fontFamily === '__emoji__' ? 'Roboto' : el.fontFamily} groups={fontGroups} onChange={(v) => u({ fontFamily: v })} />
          <Field label="Quick script">
            <div className="flex gap-1">
              <Btn onClick={() => u({ fontFamily: 'Roboto' })}>English</Btn>
              <Btn onClick={() => u({ fontFamily: 'Noto Sans Devanagari' })}>हिन्दी</Btn>
              <Btn onClick={() => u({ fontFamily: 'Noto Nastaliq Urdu', lineHeight: Math.max(el.lineHeight, 1.6) })}>اردو</Btn>
            </div>
          </Field>
          <Field label="Upload font"><label className="inline-block cursor-pointer rounded border border-ink-500 bg-ink-700 px-2.5 py-1 text-[12px] hover:bg-ink-600">Choose .ttf / .otf / .woff<input type="file" accept=".ttf,.otf,.woff,.woff2" hidden multiple onChange={onFontUpload} /></label></Field>
          <Field label="Style">
            <div className="flex gap-0.5">
              <IconBtn title="Bold" active={el.bold} onClick={() => u({ bold: !el.bold })}><FormatBold fontSize="small" /></IconBtn>
              <IconBtn title="Italic" active={el.italic} onClick={() => u({ italic: !el.italic })}><FormatItalic fontSize="small" /></IconBtn>
              <span className="mx-1 w-px bg-ink-600" />
              <IconBtn title="Align left" active={el.align === 'left'} onClick={() => u({ align: 'left' })}><FormatAlignLeft fontSize="small" /></IconBtn>
              <IconBtn title="Align centre" active={el.align === 'center'} onClick={() => u({ align: 'center' })}><FormatAlignCenter fontSize="small" /></IconBtn>
              <IconBtn title="Align right (use for Urdu)" active={el.align === 'right'} onClick={() => u({ align: 'right' })}><FormatAlignRight fontSize="small" /></IconBtn>
              <span className="mx-1 w-px bg-ink-600" />
              <IconBtn title="Top" active={el.verticalAlign === 'top'} onClick={() => u({ verticalAlign: 'top' })}><VerticalAlignTop fontSize="small" /></IconBtn>
              <IconBtn title="Middle" active={el.verticalAlign === 'middle'} onClick={() => u({ verticalAlign: 'middle' })}><VerticalAlignCenter fontSize="small" /></IconBtn>
              <IconBtn title="Bottom" active={el.verticalAlign === 'bottom'} onClick={() => u({ verticalAlign: 'bottom' })}><VerticalAlignBottom fontSize="small" /></IconBtn>
            </div>
          </Field>
          <Check label="Auto-fit" checked={el.autoFit} onChange={(v) => u({ autoFit: v })} hint="Scale the text to fill its box" />
          {!el.autoFit && <Num label="Size" value={el.fontSize} min={6} max={400} unit="px" onChange={(v) => u({ fontSize: v })} />}
          <Num label="Line height" value={el.lineHeight} min={0.7} max={3} step={0.05} decimals={2} onChange={(v) => u({ lineHeight: v })} />
          <Num label="Letter space" value={el.letterSpacing} min={-5} max={60} step={0.5} onChange={(v) => u({ letterSpacing: v })} />
          <Color label="Colour" value={el.fill} onChange={(v) => u({ fill: v || '#000000' })} />
          <Color label="Outline" value={el.stroke} onChange={(v) => u({ stroke: v || '#000000' })} />
          <Num label="Outline px" value={el.strokeWidth} min={0} max={30} step={0.5} onChange={(v) => u({ strokeWidth: v })} />
          <Btn onClick={() => u({ height: Math.ceil(measureTextHeight(el)) })}>Fit box height to text</Btn>
        </Section>
      )}

      {el.type === 'shape' && (
        <Section title="Shape">
          <Sel label="Type" value={el.shape} options={SHAPES.map((s) => ({ value: s.type, label: s.label }))} onChange={(v) => u({ shape: v })} />
          {['arrow', 'chevron'].includes(el.shape) && <Sel label="Direction" value={el.dir || 'right'} options={['right', 'left', 'up', 'down']} onChange={(v) => u({ dir: v })} />}
          <Color label="Fill" value={el.fill} allowNone onChange={(v) => u({ fill: v })} />
          <Color label="Stroke" value={el.stroke} onChange={(v) => u({ stroke: v })} />
          <Num label="Stroke px" value={el.strokeWidth} min={0} max={80} step={0.5} onChange={(v) => u({ strokeWidth: v })} />
          {el.shape === 'rect' && <Num label="Corner radius" value={el.cornerRadius || 0} min={0} max={300} onChange={(v) => u({ cornerRadius: v })} />}
          {el.shape === 'star' && <><Num label="Points" value={el.points || 5} min={3} max={16} onChange={(v) => u({ points: v })} /><Num label="Inner" value={el.inner || 0.4} min={0.1} max={0.9} step={0.05} decimals={2} onChange={(v) => u({ inner: v })} /></>}
        </Section>
      )}

      {el.type === 'image' && (
        <Section title="Image">
          <div className="truncate text-[11.5px] text-slate-400">{asset ? `${asset.name} · ${asset.w}×${asset.h}${asset.svg ? ' · SVG' : ''}` : 'missing image'}</div>
          <div className="flex gap-1">
            <label className="cursor-pointer rounded border border-ink-500 bg-ink-700 px-2.5 py-1 text-[12px] hover:bg-ink-600">Replace…<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" hidden onChange={replaceImage} /></label>
            {asset && <Btn onClick={() => { const k = Math.min(W / asset.w, H / asset.h); u({ width: Math.round(asset.w * k), height: Math.round(asset.h * k), x: Math.round((W - asset.w * k) / 2), y: Math.round((H - asset.h * k) / 2) }); }}>Fit canvas</Btn>}
            {asset && <Btn onClick={() => u({ width: asset.w, height: asset.h })}>Original size</Btn>}
          </div>
        </Section>
      )}

      <Section title="Transform">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {[['X', 'x'], ['Y', 'y'], ['W', 'width'], ['H', 'height']].map(([l, k]) => (
            <label key={k} className="flex items-center gap-1.5 text-[11px] text-slate-400">{l}
              <input type="number" className="h-7 w-full rounded border border-ink-500 bg-ink-900 px-2 text-[12px] text-slate-100 outline-none focus:border-saffron" value={Math.round(el[k] * 10) / 10} onChange={(e) => { const x = parseFloat(e.target.value); if (Number.isFinite(x)) u({ [k]: k === 'width' || k === 'height' ? Math.max(4, x) : x }); }} />
            </label>
          ))}
        </div>
        <Num label="Rotation" value={el.rotation} min={-180} max={180} unit="°" onChange={(v) => u({ rotation: v })} />
        <Num label="Opacity" value={Math.round(el.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => u({ opacity: v / 100 })} />
        <AlignRow ids={[el.id]} />
      </Section>

      <Section title="Shadow" defaultOpen={false}>
        <Check label="Enabled" checked={el.shadow?.on} onChange={(v) => u({ shadow: { ...el.shadow, on: v } })} />
        {el.shadow?.on && <>
          <Color label="Colour" value={el.shadow.color} onChange={(v) => u({ shadow: { ...el.shadow, color: v || '#000000' } })} />
          <Num label="Blur" value={el.shadow.blur} min={0} max={60} onChange={(v) => u({ shadow: { ...el.shadow, blur: v } }, 'sh')} />
          <Num label="Offset X" value={el.shadow.offsetX} min={-40} max={40} onChange={(v) => u({ shadow: { ...el.shadow, offsetX: v } }, 'sh')} />
          <Num label="Offset Y" value={el.shadow.offsetY} min={-40} max={40} onChange={(v) => u({ shadow: { ...el.shadow, offsetY: v } }, 'sh')} />
        </>}
      </Section>
    </div>
  );
}

function BoardTab() {
  const s = useStore((x) => x.project.structure);
  const st = useStore.getState();
  const b = s.board;
  const ps = (patch, key) => st.patchStructure(patch, key);
  const sizes = s.kind === 'flag' ? FLAG_SIZES : BOARD_SIZES;
  const scaleRef = useRef(true);
  return (
    <div>
      <Section title="Object type">
        <div className="flex gap-1">
          {['board', 'flag'].map((k) => (
            <button key={k} onClick={() => st.setKind(k)} className={`h-8 flex-1 rounded text-[12px] font-medium ${s.kind === k ? 'bg-saffron text-black' : 'bg-ink-700 text-slate-300 hover:bg-ink-600'}`}>{k === 'board' ? 'Signboard' : 'Flag'}</button>
          ))}
        </div>
      </Section>
      <Section title="Dimensions">
        <Sel label="Preset" value="" options={[{ value: '', label: 'Choose preset…' }, ...sizes.map(([l, w, h]) => ({ value: `${w}x${h}`, label: l }))]} onChange={(v) => { if (!v) return; const [w, h] = v.split('x').map(Number); resizeBoard(w, h, scaleRef.current); }} />
        <Num label="Width" value={b.widthM} min={0.3} max={20} step={0.05} decimals={2} unit="m" onChange={(v) => resizeBoard(v, b.heightM, scaleRef.current)} />
        <Num label="Height" value={b.heightM} min={0.3} max={12} step={0.05} decimals={2} unit="m" onChange={(v) => resizeBoard(b.widthM, v, scaleRef.current)} />
        <Check label="Scale design" checked={true} onChange={(v) => { scaleRef.current = v; }} hint="Scale existing elements when the aspect ratio changes" />
        {s.kind === 'board' && <>
          <Num label="Thickness" value={b.thicknessM} min={0.01} max={0.5} step={0.01} decimals={2} unit="m" onChange={(v) => ps({ board: { thicknessM: v } }, 'thick')} />
          <Num label="Corner radius" value={b.cornerRadiusM} min={0} max={Math.min(b.widthM, b.heightM) / 2} step={0.01} decimals={2} unit="m" onChange={(v) => ps({ board: { cornerRadiusM: v } }, 'corner')} />
        </>}
      </Section>
      <Section title="Background">
        <Sel label="Type" value={b.bg.type} options={[{ value: 'solid', label: 'Solid colour' }, { value: 'gradient', label: 'Gradient' }]} onChange={(v) => ps({ board: { bg: { type: v } } })} />
        <Color label="Colour" value={b.bg.color} onChange={(v) => ps({ board: { bg: { color: v || '#000000' } } }, 'bg1')} />
        {b.bg.type === 'gradient' && <>
          <Color label="Colour 2" value={b.bg.color2} onChange={(v) => ps({ board: { bg: { color2: v || '#000000' } } }, 'bg2')} />
          <Num label="Angle" value={b.bg.angle} min={0} max={360} unit="°" onChange={(v) => ps({ board: { bg: { angle: v } } }, 'bga')} />
        </>}
      </Section>
      {s.kind === 'board' && <>
        <Section title="Printed border">
          <Check label="Border" checked={b.border.enabled} onChange={(v) => ps({ board: { border: { enabled: v } } })} />
          {b.border.enabled && <>
            <Color label="Colour" value={b.border.color} onChange={(v) => ps({ board: { border: { color: v || '#ffffff' } } }, 'bc')} />
            <Num label="Width" value={b.border.width} min={1} max={80} unit="px" onChange={(v) => ps({ board: { border: { width: v } } }, 'bw')} />
            <Num label="Inset" value={b.border.inset} min={0} max={120} unit="px" onChange={(v) => ps({ board: { border: { inset: v } } }, 'bi')} />
            <Num label="Radius" value={b.border.radius} min={0} max={200} unit="px" onChange={(v) => ps({ board: { border: { radius: v } } }, 'br')} />
          </>}
        </Section>
        <Section title="Metal frame">
          <Check label="Raised frame" checked={b.frame.enabled} onChange={(v) => ps({ board: { frame: { enabled: v } } })} />
          {b.frame.enabled && <>
            <Color label="Colour" value={b.frame.color} onChange={(v) => ps({ board: { frame: { color: v || '#999999' } } }, 'fc')} />
            <Num label="Width" value={b.frame.widthM} min={0.01} max={0.3} step={0.01} decimals={2} unit="m" onChange={(v) => ps({ board: { frame: { widthM: v } } }, 'fw')} />
            <Num label="Depth" value={b.frame.depthM} min={0.005} max={0.2} step={0.005} decimals={3} unit="m" onChange={(v) => ps({ board: { frame: { depthM: v } } }, 'fd')} />
          </>}
          <Color label="Back / edge" value={b.backColor} onChange={(v) => ps({ board: { backColor: v || '#777777' } }, 'back')} />
        </Section>
      </>}
    </div>
  );
}

function ModelTab() {
  const s = useStore((x) => x.project.structure);
  const st = useStore.getState();
  const ps = (patch, key) => st.patchStructure(patch, key);
  const fin = s.finish;
  const preset = (r, m, f) => ps({ finish: { roughness: r, metalness: m, reflectivity: f } });
  return (
    <div>
      {s.kind === 'board' ? (
        <Section title="Poles & mounting">
          <Sel label="Poles" value={s.poles.mode} options={[{ value: 'none', label: 'No poles (ground / wall mount)' }, { value: 'single', label: 'Single centre pole' }, { value: 'double', label: 'Double poles' }]} onChange={(v) => ps({ poles: { mode: v } })} />
          <Num label="Mount height" value={s.poles.mountHeightM} min={0} max={9} step={0.05} decimals={2} unit="m" onChange={(v) => ps({ poles: { mountHeightM: v } }, 'mh')} />
          {s.poles.mode !== 'none' && <>
            <Num label="Pole radius" value={s.poles.radiusM} min={0.015} max={0.3} step={0.005} decimals={3} unit="m" onChange={(v) => ps({ poles: { radiusM: v } }, 'pr')} />
            {s.poles.mode === 'double' && <Num label="Pole inset" value={s.poles.inset} min={0.02} max={0.45} step={0.01} decimals={2} onChange={(v) => ps({ poles: { inset: v } }, 'pi')} />}
          </>}
          <Color label="Pole colour" value={s.poles.color} onChange={(v) => ps({ poles: { color: v || '#999999' } }, 'pc')} />
        </Section>
      ) : (
        <Section title="Flagpole & cloth">
          <Num label="Pole height" value={s.flag.poleHeightM} min={2} max={30} step={0.1} decimals={1} unit="m" onChange={(v) => ps({ flag: { poleHeightM: v } }, 'fph')} />
          <Num label="Pole radius" value={s.flag.poleRadiusM} min={0.02} max={0.3} step={0.005} decimals={3} unit="m" onChange={(v) => ps({ flag: { poleRadiusM: v } }, 'fpr')} />
          <Check label="Finial ball" checked={s.flag.finial} onChange={(v) => ps({ flag: { finial: v } })} />
          <Num label="Wave amplitude" value={s.flag.waveAmpM} min={0} max={1} step={0.01} decimals={2} unit="m" onChange={(v) => ps({ flag: { waveAmpM: v } }, 'fwa')} />
          <Num label="Wave count" value={s.flag.waves} min={0.5} max={4} step={0.1} decimals={1} onChange={(v) => ps({ flag: { waves: v } }, 'fwc')} />
          <Color label="Pole colour" value={s.poles.color} onChange={(v) => ps({ poles: { color: v || '#c9ced4' } }, 'pc')} />
        </Section>
      )}
      <Section title="Surface finish">
        <div className="flex flex-wrap gap-1">
          <Btn onClick={() => preset(0.55, 0.1, 0.15)}>Matte paint</Btn>
          <Btn onClick={() => preset(0.4, 0.3, 0.45)}>Painted metal</Btn>
          <Btn onClick={() => preset(0.2, 0.25, 0.9)}>Reflective sheeting</Btn>
          <Btn onClick={() => preset(0.18, 0.9, 0.7)}>Polished metal</Btn>
          <Btn onClick={() => preset(0.9, 0, 0.05)}>Fabric</Btn>
        </div>
        <Num label="Roughness" value={fin.roughness} min={0.05} max={1} step={0.01} decimals={2} onChange={(v) => ps({ finish: { roughness: v } }, 'rough')} />
        <Num label="Metalness" value={fin.metalness} min={0} max={1} step={0.01} decimals={2} onChange={(v) => ps({ finish: { metalness: v } }, 'metal')} />
        <Num label="Reflectivity" value={fin.reflectivity} min={0} max={1} step={0.01} decimals={2} onChange={(v) => ps({ finish: { reflectivity: v } }, 'refl')} />
        <Check label="Self-lit at night" checked={s.illuminated} onChange={(v) => ps({ illuminated: v })} hint="Writes the illumination channel of the ACI map" />
        <p className="text-[11px] leading-snug text-slate-500">Roughness and metalness drive this preview. In the game, Reflectivity becomes the specular channel of the XYS map and self-lit becomes the illumination channel.</p>
      </Section>
    </div>
  );
}

function ExportTab() {
  const p = useStore((x) => x.project);
  const st = useStore.getState();
  const ex = p.export;
  const pe = (patch) => st.patchExport(patch);
  const pngExport = () => {
    try {
      const c = renderDesign(2048);
      c.toBlob((b) => download(b, (p.name || 'design').replace(/[^\w\-]+/g, '_') + '.png'));
    } catch (e) { st.notify(String(e.message || e), 'error'); }
  };
  const saveFile = () => {
    const blob = new Blob([JSON.stringify(p)], { type: 'application/json' });
    download(blob, (p.name || 'project').replace(/[^\w\-]+/g, '_') + '.sbproj.json');
  };
  const loadFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const j = JSON.parse(await f.text()); if (!j.structure || !j.elements) throw new Error('Not a Signboard Creator project'); j.id = j.id || Math.random().toString(36).slice(2); st.openProject(j); st.notify('Project loaded', 'success'); } catch (err) { st.notify('Could not open project: ' + err.message, 'error'); }
    e.target.value = '';
  };
  const kit = async () => {
    st.set({ exportState: { steps: [], step: 'Preparing import kit', running: true, kit: true } });
    try {
      const r = await runExport(useStore.getState().project, { format: 'kit', onStep: (s) => st.set({ exportState: { steps: [], step: s, running: true, kit: true } }) });
      st.set({ exportState: { running: false, done: true, kit: true, kitFile: r.fileName } });
    } catch (e) { st.set({ exportState: { running: false, error: String(e.message || e), kit: true } }); }
  };
  return (
    <div>
      <Section title="CRP asset">
        <Field label="Asset name"><input className="h-7 w-full rounded border border-ink-500 bg-ink-900 px-2 text-[12px] outline-none focus:border-saffron" placeholder={p.name} value={ex.assetName} onChange={(e) => pe({ assetName: e.target.value })} /></Field>
        <Field label="Author"><input className="h-7 w-full rounded border border-ink-500 bg-ink-900 px-2 text-[12px] outline-none focus:border-saffron" value={ex.author} onChange={(e) => pe({ author: e.target.value })} /></Field>
        <Field label="Tags"><input className="h-7 w-full rounded border border-ink-500 bg-ink-900 px-2 text-[12px] outline-none focus:border-saffron" value={ex.tags} onChange={(e) => pe({ tags: e.target.value })} /></Field>
        <Sel label="Texture size" value={String(ex.resolution)} options={[{ value: '512', label: '512 × 512 (small)' }, { value: '1024', label: '1024 × 1024 (recommended)' }, { value: '2048', label: '2048 × 2048 (sharp text)' }]} onChange={(v) => pe({ resolution: Number(v) })} />
        <p className="text-[11px] leading-snug text-slate-500">Output: DXT-compressed diffuse + XYS + ACI maps with mip-maps, a single-material Prop mesh, packaged as a CRAP v6 asset. Use the big button in the top bar.</p>
      </Section>
      <Section title="More exports">
        <div className="flex flex-wrap gap-1"><Btn onClick={pngExport}>Design as PNG</Btn><Btn onClick={kit}>Asset Editor import kit (.zip)</Btn></div>
        <p className="text-[11px] leading-snug text-slate-500">The import kit (OBJ + PNG maps) is a manual fallback only. It is not a CRP.</p>
      </Section>
      <Section title="Project file">
        <div className="flex gap-1"><Btn onClick={saveFile}>Save as file</Btn>
          <label className="inline-flex h-7 cursor-pointer items-center rounded border border-ink-500 bg-ink-700 px-2.5 text-[12px] text-slate-200 hover:bg-ink-600">Open file…<input type="file" accept=".json,.sbproj" hidden onChange={loadFile} /></label></div>
      </Section>
    </div>
  );
}

export default function PropertiesPanel() {
  const tab = useStore((s) => s.rightTab);
  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-850">
      <Tabs value={tab} onChange={(_, v) => useStore.getState().set({ rightTab: v })} variant="fullWidth" sx={{ minHeight: 38, borderBottom: '1px solid #2b3342', '& .MuiTab-root': { minHeight: 38, fontSize: 11.5, textTransform: 'none', minWidth: 0, px: 1 }, '& .Mui-selected': { color: '#ff9933 !important' }, '& .MuiTabs-indicator': { backgroundColor: '#ff9933' } }}>
        <Tab value="element" label="Element" /><Tab value="board" label="Board" /><Tab value="model" label="3D model" /><Tab value="export" label="Export" />
      </Tabs>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {tab === 'element' && <ElementTab />}
        {tab === 'board' && <BoardTab />}
        {tab === 'model' && <ModelTab />}
        {tab === 'export' && <ExportTab />}
      </div>
    </div>
  );
}
