import { useStore } from '../store/useStore.js';
import { saveProjectRecord, loadProjectRecord, LAST_KEY } from './db.js';
import { registry } from './registry.js';

function thumbnail() {
  try {
    if (!registry.layer) return null;
    const { W } = registry.size;
    return registry.layer.toCanvas({ x: 0, y: 0, width: registry.size.W, height: registry.size.H, pixelRatio: 220 / W }).toDataURL('image/jpeg', 0.7);
  } catch { return null; }
}

export async function saveCurrentProject(manual = false) {
  const st = useStore.getState();
  st.set({ saveState: 'saving' });
  try {
    const p = st.project;
    // only keep assets that are still referenced, plus the ones the user has in the library
    await saveProjectRecord({ ...p, updatedAt: Date.now(), thumb: thumbnail() });
    try { localStorage.setItem(LAST_KEY, p.id); } catch { /* ignore */ }
    useStore.getState().markSaved();
    if (manual) useStore.getState().notify('Project saved to this browser', 'success');
  } catch (e) {
    useStore.getState().set({ saveState: 'dirty' });
    useStore.getState().notify('Save failed: ' + (e.message || e), 'error');
  }
}

export async function restoreLastProject() {
  try {
    const id = localStorage.getItem(LAST_KEY);
    if (!id) return false;
    const rec = await loadProjectRecord(id);
    if (!rec) return false;
    useStore.getState().openProject(rec);
    return true;
  } catch { return false; }
}
