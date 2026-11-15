'use client';
import React, { useState } from 'react';
import { Slider, Switch, Tooltip } from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';

export function Section({ title, children, defaultOpen = true, right }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-ink-600">
      <div className="flex cursor-pointer select-none items-center px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200" onClick={() => setOpen(!open)}>
        <ExpandMore sx={{ fontSize: 16, transform: open ? 'none' : 'rotate(-90deg)', transition: '.15s', mr: 0.5 }} />
        {title}
        <span className="ml-auto" onClick={(e) => e.stopPropagation()}>{right}</span>
      </div>
      {open && <div className="space-y-2.5 px-3 pb-3">{children}</div>}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[84px] shrink-0 text-[11.5px] text-slate-400" title={hint}>{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const inputCls = 'h-7 w-full rounded border border-ink-500 bg-ink-900 px-2 text-[12px] text-slate-100 outline-none focus:border-saffron';

export function Num({ label, value, onChange, min = 0, max = 100, step = 1, unit, slider = true, decimals }) {
  const v = Number.isFinite(value) ? value : 0;
  const show = decimals != null ? Number(v.toFixed(decimals)) : v;
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        {slider && <Slider size="small" min={min} max={max} step={step} value={Math.min(max, Math.max(min, v))} onChange={(_, x) => onChange(x)} sx={{ flex: 1, py: 0.5, color: '#ff9933', '& .MuiSlider-thumb': { width: 12, height: 12 } }} />}
        <div className="flex items-center">
          <input type="number" className={inputCls + ' !w-[62px] text-right'} value={show} min={min} step={step} onChange={(e) => { const x = parseFloat(e.target.value); if (Number.isFinite(x)) onChange(x); }} />
          {unit && <span className="ml-1 w-4 text-[10px] text-slate-500">{unit}</span>}
        </div>
      </div>
    </Field>
  );
}

export function Color({ label, value, onChange, allowNone }) {
  const none = !value;
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={none ? '#ffffff' : value} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-ink-500 bg-transparent p-0.5" />
        <input className={inputCls + ' font-mono uppercase'} value={value || ''} placeholder={none ? 'none' : ''} onChange={(e) => { const x = e.target.value; if (/^#?[0-9a-fA-F]{0,8}$/.test(x)) onChange(x ? (x.startsWith('#') ? x : '#' + x) : ''); }} />
        {allowNone && <button className="rounded px-1.5 py-1 text-[10px] text-slate-400 hover:bg-ink-600" onClick={() => onChange('')}>none</button>}
      </div>
    </Field>
  );
}

export function Sel({ label, value, onChange, options, groups }) {
  return (
    <Field label={label}>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {groups ? groups.map((g) => (
          <optgroup key={g.label} label={g.label}>{g.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</optgroup>
        )) : options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    </Field>
  );
}

export function Check({ label, checked, onChange, hint }) {
  return (
    <Field label={label} hint={hint}>
      <Switch size="small" checked={!!checked} onChange={(e) => onChange(e.target.checked)} sx={{ '& .Mui-checked': { color: '#ff9933' }, '& .Mui-checked + .MuiSwitch-track': { backgroundColor: '#ff9933' } }} />
    </Field>
  );
}

export function IconBtn({ title, onClick, children, active, disabled, className = '' }) {
  return (
    <Tooltip title={title} arrow enterDelay={400}>
      <span>
        <button disabled={disabled} onClick={onClick} className={`flex h-7 w-7 items-center justify-center rounded text-slate-300 transition hover:bg-ink-600 disabled:opacity-30 ${active ? 'bg-ink-600 text-saffron' : ''} ${className}`}>{children}</button>
      </span>
    </Tooltip>
  );
}

export function Btn({ children, onClick, primary, className = '', disabled }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`h-7 rounded px-2.5 text-[12px] font-medium transition disabled:opacity-40 ${primary ? 'bg-saffron text-black hover:bg-saffron-600' : 'border border-ink-500 bg-ink-700 text-slate-200 hover:bg-ink-600'} ${className}`}>{children}</button>
  );
}
