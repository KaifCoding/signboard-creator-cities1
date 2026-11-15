'use client';
import React from 'react';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpen from '@mui/icons-material/FolderOpen';
import NoteAdd from '@mui/icons-material/NoteAdd';
import ViewSidebar from '@mui/icons-material/ViewSidebar';
import Crop from '@mui/icons-material/Crop32';
import ThreeD from '@mui/icons-material/ViewInAr';
import FileDownload from '@mui/icons-material/FileDownload';
import { useStore } from '../store/useStore.js';
import { IconBtn } from './ui.jsx';
import { saveCurrentProject } from '../lib/persist.js';
import { runExport } from '../lib/exportClient.js';

const STEPS = ['Loading fonts', 'Converting design to texture', 'Generating geometry, UVs, materials and packaging CRP', 'Validating package', 'Downloading'];

export async function startCrpExport() {
  const st = useStore.getState();
  if (st.exportState?.running) return;
  st.set({ exportState: { running: true, step: STEPS[0], stepIndex: 0 } });
  try {
    const project = useStore.getState().project;
    const r = await runExport(project, { onStep: (s) => useStore.getState().set({ exportState: { running: true, step: s, stepIndex: Math.max(0, STEPS.indexOf(s)) } }) });
    useStore.getState().set({ exportState: { running: false, done: true, result: r } });
  } catch (e) {
    useStore.getState().set({ exportState: { running: false, error: String(e.message || e) } });
  }
}

export default function TopBar() {
  const name = useStore((s) => s.project.name);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const saveState = useStore((s) => s.saveState);
  const view = useStore((s) => s.viewMode);
  const running = useStore((s) => s.exportState?.running);
  const st = useStore.getState();

  const V = ({ id, icon, label }) => (
    <button onClick={() => st.set({ viewMode: id, fitRequest: st.fitRequest + 1 })} className={`flex h-7 items-center gap-1 px-2.5 text-[11.5px] ${view === id ? 'bg-ink-600 text-saffron' : 'text-slate-400 hover:text-slate-100'}`}>{icon}{label}</button>
  );

  return (
    <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-ink-600 bg-ink-900 px-3">
      <div className="flex items-center gap-2 pr-1">
        <svg width="26" height="26" viewBox="0 0 26 26"><rect width="26" height="26" rx="6" fill="#141820" stroke="#3a4457" /><rect x="5" y="6" width="16" height="4" fill="#ff9933" /><rect x="5" y="10" width="16" height="4" fill="#fff" /><rect x="5" y="14" width="16" height="4" fill="#138808" /><circle cx="13" cy="12" r="1.6" fill="none" stroke="#000080" strokeWidth=".8" /><rect x="12.4" y="18" width="1.2" height="5" fill="#8b95a5" /></svg>
        <div className="leading-tight"><div className="text-[12.5px] font-semibold text-slate-100">Signboard / Flag Creator</div><div className="text-[9.5px] uppercase tracking-wider text-slate-500">for Cities: Skylines 1</div></div>
      </div>
      <span className="h-6 w-px bg-ink-600" />
      <input value={name} onChange={(e) => st.rename(e.target.value)} spellCheck={false} className="h-8 w-[220px] rounded border border-transparent bg-ink-850 px-2 text-[13px] font-medium text-slate-100 outline-none hover:border-ink-500 focus:border-saffron" title="Project name" />
      <div className="flex items-center gap-0.5">
        <IconBtn title="New project" onClick={() => { if (!useStore.getState().dirty || window.confirm('Start a new project? Unsaved changes in this one are already autosaved.')) { st.set({ leftTab: 'templates' }); st.newFromTemplate('blank-board'); } }}><NoteAdd sx={{ fontSize: 19 }} /></IconBtn>
        <IconBtn title="Open project…" onClick={() => st.set({ projectsOpen: true })}><FolderOpen sx={{ fontSize: 19 }} /></IconBtn>
        <IconBtn title="Save (Ctrl+S)" onClick={() => saveCurrentProject(true)}><SaveIcon sx={{ fontSize: 19 }} /></IconBtn>
        <span className="mx-1 h-5 w-px bg-ink-600" />
        <IconBtn title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => st.undo()}><UndoIcon sx={{ fontSize: 19 }} /></IconBtn>
        <IconBtn title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={() => st.redo()}><RedoIcon sx={{ fontSize: 19 }} /></IconBtn>
      </div>
      <span className={`text-[11px] ${saveState === 'saved' ? 'text-slate-500' : saveState === 'saving' ? 'text-saffron' : 'text-amber-300'}`}>{saveState === 'saved' ? 'Saved locally' : saveState === 'saving' ? 'Saving…' : 'Unsaved changes'}</span>
      <div className="mx-auto flex overflow-hidden rounded-md border border-ink-600 bg-ink-850">
        <V id="design" icon={<Crop sx={{ fontSize: 15 }} />} label="Design" />
        <V id="split" icon={<ViewSidebar sx={{ fontSize: 15 }} />} label="Split" />
        <V id="preview" icon={<ThreeD sx={{ fontSize: 15 }} />} label="3D" />
      </div>
      <button onClick={startCrpExport} disabled={running} data-testid="export-crp"
        className="flex h-9 items-center gap-2 rounded-md bg-gradient-to-b from-saffron to-saffron-600 px-5 text-[12.5px] font-extrabold tracking-wide text-black shadow-[0_0_0_1px_rgba(255,153,51,.6),0_6px_18px_rgba(255,153,51,.25)] transition hover:brightness-110 disabled:opacity-60">
        <FileDownload sx={{ fontSize: 19 }} />{running ? 'GENERATING…' : 'GENERATE & EXPORT CRP'}
      </button>
    </div>
  );
}
