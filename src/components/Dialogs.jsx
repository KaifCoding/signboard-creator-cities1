'use client';
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogActions, LinearProgress, Snackbar, Alert } from '@mui/material';
import { useStore } from '../store/useStore.js';
import { listProjectRecords, loadProjectRecord, deleteProjectRecord, saveProjectRecord } from '../lib/db.js';
import { saveCurrentProject } from '../lib/persist.js';
import { Btn } from './ui.jsx';
import { startCrpExport } from './TopBar.jsx';
import { runExport } from '../lib/exportClient.js';
import { uid } from '../lib/elements.js';

const paper = { sx: { backgroundColor: '#141820', backgroundImage: 'none', border: '1px solid #2b3342', color: '#e5e7eb' } };

export function ProjectsDialog() {
  const open = useStore((s) => s.projectsOpen);
  const currentId = useStore((s) => s.project.id);
  const [items, setItems] = useState([]);
  const refresh = async () => setItems(await listProjectRecords());
  useEffect(() => { if (open) { saveCurrentProject().then(refresh); } }, [open]);
  const st = useStore.getState();
  const close = () => st.set({ projectsOpen: false });
  const openIt = async (id) => { const rec = await loadProjectRecord(id); if (rec) { st.openProject(rec); close(); } };
  const del = async (id) => { if (!window.confirm('Delete this project permanently?')) return; await deleteProjectRecord(id); refresh(); };
  const dup = async (id) => { const rec = await loadProjectRecord(id); if (!rec) return; await saveProjectRecord({ ...rec, id: uid(), name: rec.name + ' copy', updatedAt: Date.now() }); refresh(); };
  return (
    <Dialog open={!!open} onClose={close} maxWidth="md" fullWidth PaperProps={paper}>
      <DialogTitle sx={{ fontSize: 15 }}>Projects saved in this browser</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#2b3342' }}>
        {!items.length && <div className="p-6 text-center text-[13px] text-slate-500">No saved projects yet.</div>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.map((p) => (
            <div key={p.id} className={`overflow-hidden rounded-md border bg-ink-900 ${p.id === currentId ? 'border-saffron' : 'border-ink-600'}`}>
              <div className="flex h-24 items-center justify-center bg-[#0d1015]">{p.thumb ? <img src={p.thumb} alt="" className="max-h-full max-w-full" /> : <span className="text-[11px] text-slate-600">no preview</span>}</div>
              <div className="p-2"><div className="truncate text-[12.5px] font-medium">{p.name}</div><div className="text-[10.5px] text-slate-500">{new Date(p.updatedAt).toLocaleString()} · {p.kind === 'flag' ? 'Flag' : 'Signboard'}</div>
                <div className="mt-2 flex gap-1"><Btn primary onClick={() => openIt(p.id)}>Open</Btn><Btn onClick={() => dup(p.id)}>Duplicate</Btn><Btn onClick={() => del(p.id)}>Delete</Btn></div></div>
            </div>
          ))}
        </div>
      </DialogContent>
      <DialogActions><Btn onClick={close}>Close</Btn></DialogActions>
    </Dialog>
  );
}

const STEPS = ['Loading fonts', 'Converting design to texture', 'Generating geometry, UVs, materials and packaging CRP', 'Validating package', 'Downloading'];
const STEP_LABEL = ['Load fonts', 'Convert design to texture', 'Generate geometry, UVs, materials; package CRP', 'Re-read & validate package', 'Download'];

export function ExportDialog() {
  const ex = useStore((s) => s.exportState);
  const st = useStore.getState();
  const close = () => st.set({ exportState: null });
  if (!ex) return null;
  const r = ex.result?.report;
  const failed = r?.checks?.filter((c) => !c.ok) || [];
  const kitFallback = async () => {
    st.set({ exportState: { running: true, step: 'Preparing import kit', stepIndex: 2, kit: true } });
    try { const k = await runExport(useStore.getState().project, { format: 'kit' }); st.set({ exportState: { done: true, kit: true, kitFile: k.fileName } }); } catch (e) { st.set({ exportState: { error: String(e.message || e) } }); }
  };
  return (
    <Dialog open onClose={ex.running ? undefined : close} maxWidth="sm" fullWidth PaperProps={paper}>
      <DialogTitle sx={{ fontSize: 15 }}>{ex.kit ? 'Asset Editor import kit' : 'CRP export'}</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#2b3342' }}>
        {ex.running && !ex.kit && (
          <div className="space-y-2">
            {STEP_LABEL.map((l, i) => (
              <div key={l} className={`flex items-center gap-2 text-[12.5px] ${i < ex.stepIndex ? 'text-green-400' : i === ex.stepIndex ? 'text-saffron' : 'text-slate-600'}`}>
                <span className="w-4 text-center">{i < ex.stepIndex ? '✓' : i === ex.stepIndex ? '●' : '○'}</span>{l}
              </div>
            ))}
            <LinearProgress sx={{ mt: 1.5, '& .MuiLinearProgress-bar': { backgroundColor: '#ff9933' }, backgroundColor: '#2b3342' }} />
          </div>
        )}
        {ex.running && ex.kit && <LinearProgress sx={{ '& .MuiLinearProgress-bar': { backgroundColor: '#ff9933' }, backgroundColor: '#2b3342' }} />}
        {ex.error && <Alert severity="error" variant="outlined" sx={{ whiteSpace: 'pre-wrap' }}>Export failed: {ex.error}</Alert>}
        {ex.done && ex.kit && <p className="text-[13px]">Downloaded <b>{ex.kitFile}</b>. This is a manual import kit (OBJ + PNG maps), not a CRP.</p>}
        {ex.done && !ex.kit && ex.result && (
          <div className="space-y-3 text-[12.5px]">
            <div className="rounded-md border border-green-700/50 bg-green-900/20 p-3">
              <div className="text-[13.5px] font-semibold text-green-300">Downloaded {ex.result.fileName} ({(ex.result.bytes / 1024).toFixed(0)} KB)</div>
              <div className="mt-1 text-slate-300">Put it in <code className="rounded bg-ink-900 px-1">%LOCALAPPDATA%\Colossal Order\Cities_Skylines\Addons\Assets\</code> and look for it in the Content Manager / Prop tool.</div>
            </div>
            {r && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-300">
                <span>Package format</span><span>CRAP v{r.summary.formatVersion}</span>
                <span>Mesh</span><span>{r.summary.vertices} vertices · {r.summary.triangles} triangles</span>
                <span>Textures</span><span>{(r.textures || []).map((t) => `${t.format} ${t.width}²`).join(', ')} (+mips)</span>
                <span>Shader</span><span>{r.shader}</span>
                <span>Assets inside</span><span>{r.summary.assets.length}</span>
                <span>Self-check</span><span className={failed.length ? 'text-red-400' : 'text-green-400'}>{failed.length ? `${failed.length} failed` : `${r.checks.length}/${r.checks.length} passed`}</span>
              </div>
            )}
            <div className="rounded-md border border-amber-700/50 bg-amber-900/15 p-3 text-[12px] leading-relaxed text-amber-100/90">
              <b>Compatibility note.</b> This file is a real CRAP package written to the published container layout and re-parsed by an independent reader. It was <b>not</b> loaded inside Cities: Skylines here, and a few metadata fields (CustomAssetMetaData, PropInfo defaults) follow the best publicly documented layout. If the game does not list the asset, use the import kit below (OBJ + textures) with the Asset Editor.
            </div>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        {ex.done && !ex.kit && <Btn onClick={kitFallback}>Get import kit (.zip)</Btn>}
        {ex.done && !ex.kit && <Btn onClick={startCrpExport}>Download again</Btn>}
        {!ex.running && <Btn primary onClick={close}>Close</Btn>}
      </DialogActions>
    </Dialog>
  );
}

export function Toast() {
  const t = useStore((s) => s.toast);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (t) setOpen(true); }, [t]);
  return (
    <Snackbar open={open} autoHideDuration={3500} onClose={() => setOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity={t?.severity || 'info'} variant="filled" onClose={() => setOpen(false)} sx={{ fontSize: 13 }}>{t?.msg}</Alert>
    </Snackbar>
  );
}
