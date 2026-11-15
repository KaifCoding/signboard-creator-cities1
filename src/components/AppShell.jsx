'use client';
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { useStore } from '../store/useStore.js';
import TopBar from './TopBar.jsx';
import LeftSidebar from './LeftSidebar.jsx';
import PropertiesPanel from './PropertiesPanel.jsx';
import DesignCanvas from './DesignCanvas.jsx';
import { ProjectsDialog, ExportDialog, Toast } from './Dialogs.jsx';
import { injectGoogleFonts, registerFontData } from '../lib/fonts.js';
import { listFontRecords } from '../lib/db.js';
import { saveCurrentProject, restoreLastProject } from '../lib/persist.js';
import { registry, renderDesign } from '../lib/registry.js';

const Preview3D = dynamic(() => import('./Preview3D.jsx'), { ssr: false });

const theme = createTheme({
  palette: { mode: 'dark', primary: { main: '#ff9933' }, background: { default: '#0b0d11', paper: '#141820' } },
  typography: { fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif', fontSize: 12 },
  shape: { borderRadius: 6 },
});

export default function AppShell() {
  const view = useStore((s) => s.viewMode);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    window.__sbc = { registry, renderDesign, useStore };
    injectGoogleFonts();
    (async () => {
      try {
        const fonts = await listFontRecords();
        for (const f of fonts) { try { await registerFontData(f.name, f.data); } catch { /* skip broken font */ } }
        useStore.getState().set({ customFonts: fonts.map((f) => f.name) });
      } catch { /* IndexedDB unavailable */ }
      await restoreLastProject();
      setReady(true);
      document.fonts?.addEventListener?.('loadingdone', () => useStore.getState().bumpFonts());
    })();
  }, []);

  // autosave
  useEffect(() => {
    let t;
    const unsub = useStore.subscribe((s, prev) => {
      if (s.project !== prev.project && s.dirty) { clearTimeout(t); t = setTimeout(() => saveCurrentProject(false), 1500); }
    });
    return () => { unsub(); clearTimeout(t); };
  }, []);

  // shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      const st = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveCurrentProject(true); return; }
      if (typing) return;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? st.redo() : st.undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); st.redo(); }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); st.duplicate(st.selectedIds); }
      else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); st.select(st.project.elements.map((x) => x.id)); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedIds.length) { e.preventDefault(); st.removeElements(st.selectedIds); }
      else if (e.key === 'Escape') st.select([]);
      else if (e.key.startsWith('Arrow') && st.selectedIds.length) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
        st.updateElements(st.selectedIds, (el) => ({ x: el.x + dx, y: el.y + dy }), 'nudge');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const warn = (e) => { if (useStore.getState().saveState === 'dirty') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-ink-950 text-slate-200">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <div className="w-[330px] shrink-0 border-r border-ink-600"><LeftSidebar /></div>
          <div className="flex min-w-0 flex-1">
            {/* both panes stay mounted: the design layer must exist for texture generation */}
            <div className={`${view === 'preview' ? 'pointer-events-none absolute -left-[9999px] h-[600px] w-[900px]' : 'flex'} min-w-0 flex-1 flex-col ${view === 'split' ? 'border-r border-ink-600' : ''}`}>
              <DesignCanvas active={view !== 'preview'} />
            </div>
            {view !== 'design' && <div className="flex min-w-0 flex-1 flex-col"><Preview3D active /></div>}
          </div>
          <div className="w-[330px] shrink-0 border-l border-ink-600"><PropertiesPanel /></div>
        </div>
      </div>
      <ProjectsDialog /><ExportDialog /><Toast />
      {!ready && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950 text-slate-400">Loading…</div>}
    </ThemeProvider>
  );
}
