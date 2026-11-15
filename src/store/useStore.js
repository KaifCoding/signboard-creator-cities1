import { create } from 'zustand';
import { uid, cloneElement, canvasSize } from '../lib/elements.js';
import { defaultStructure, instantiate, mergeDeep, TEMPLATES } from '../lib/templates.js';

export function newProject(templateId = 'village-welcome') {
  const tpl = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
  const { structure, elements } = instantiate(tpl);
  return {
    id: uid(), name: 'Untitled signboard', createdAt: Date.now(), updatedAt: Date.now(),
    structure, elements, assets: {},
    export: { assetName: '', author: '', resolution: 1024, tags: 'Prop, Signboard, India' },
  };
}

const HISTORY_LIMIT = 100;

export const useStore = create((set, get) => ({
  project: newProject(),
  selectedIds: [],
  leftTab: 'templates',
  rightTab: 'element',
  viewMode: 'split', // design | preview | split
  zoom: 0.6,
  fitRequest: 0,
  grid: { show: false, snap: false, size: 20 },
  past: [], future: [], lastKey: null, lastTime: 0,
  dirty: false,
  saveState: 'saved', // saved | saving | dirty
  atlasVersion: 0,
  fontsVersion: 0,
  customFonts: [],
  editRequest: 0,
  toast: null,
  exportState: null, // { step, steps[], error, report, done }
  projectsOpen: false,

  // ---- generic UI setters
  set: (patch) => set(patch),
  notify: (msg, severity = 'info') => set({ toast: { msg, severity, t: Date.now() } }),
  bumpAtlas: () => set((s) => ({ atlasVersion: s.atlasVersion + 1 })),
  bumpFonts: () => set((s) => ({ fontsVersion: s.fontsVersion + 1 })),

  // ---- history-aware mutation
  mutate(fn, key) {
    const { project, past, lastKey, lastTime } = get();
    const now = Date.now();
    const coalesce = key && key === lastKey && now - lastTime < 900;
    const snap = { structure: project.structure, elements: project.elements };
    const next = fn({ ...project });
    if (next === project) return;
    set({
      project: { ...next, updatedAt: now },
      past: coalesce ? past : [...past.slice(-(HISTORY_LIMIT - 1)), snap],
      future: [], lastKey: key || null, lastTime: now, dirty: true, saveState: 'dirty',
    });
  },
  undo() {
    const { past, project, future } = get();
    if (!past.length) return;
    const snap = past[past.length - 1];
    const cur = { structure: project.structure, elements: project.elements };
    const ids = new Set(snap.elements.map((e) => e.id));
    set((s) => ({ project: { ...project, ...snap }, past: past.slice(0, -1), future: [cur, ...future], lastKey: null, selectedIds: s.selectedIds.filter((i) => ids.has(i)), dirty: true, saveState: 'dirty' }));
  },
  redo() {
    const { future, project, past } = get();
    if (!future.length) return;
    const snap = future[0];
    const cur = { structure: project.structure, elements: project.elements };
    const ids = new Set(snap.elements.map((e) => e.id));
    set((s) => ({ project: { ...project, ...snap }, future: future.slice(1), past: [...past, cur], lastKey: null, selectedIds: s.selectedIds.filter((i) => ids.has(i)), dirty: true, saveState: 'dirty' }));
  },

  // ---- project lifecycle
  openProject(p) { set({ project: p, selectedIds: [], past: [], future: [], lastKey: null, dirty: false, saveState: 'saved', fitRequest: get().fitRequest + 1 }); },
  newFromTemplate(id) { get().openProject(newProject(id)); },
  applyTemplate(id) {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    const { structure, elements } = instantiate(tpl);
    get().mutate((p) => ({ ...p, structure, elements }));
    set({ selectedIds: [], fitRequest: get().fitRequest + 1 });
  },
  rename(name) { get().mutate((p) => ({ ...p, name }), 'rename'); },
  markSaved() { set({ dirty: false, saveState: 'saved' }); },

  // ---- elements
  select(ids) { set({ selectedIds: ids }); },
  addElement(el, select = true) {
    get().mutate((p) => ({ ...p, elements: [...p.elements, el] }));
    if (select) set({ selectedIds: [el.id] });
  },
  addAsset(asset) { set((s) => ({ project: { ...s.project, assets: { ...s.project.assets, [asset.id]: asset } } })); },
  updateElement(id, patch, key) {
    get().mutate((p) => ({ ...p, elements: p.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), key);
  },
  updateElements(ids, patchFn, key) {
    const set_ = new Set(ids);
    get().mutate((p) => ({ ...p, elements: p.elements.map((e) => (set_.has(e.id) ? { ...e, ...patchFn(e) } : e)) }), key);
  },
  removeElements(ids) {
    const s = new Set(ids);
    get().mutate((p) => ({ ...p, elements: p.elements.filter((e) => !s.has(e.id)) }));
    set({ selectedIds: [] });
  },
  duplicate(ids) {
    const { project } = get();
    const copies = project.elements.filter((e) => ids.includes(e.id)).map(cloneElement);
    if (!copies.length) return;
    get().mutate((p) => ({ ...p, elements: [...p.elements, ...copies] }));
    set({ selectedIds: copies.map((c) => c.id) });
  },
  reorder(id, dir) { // dir: 'up' | 'down' | 'top' | 'bottom'
    get().mutate((p) => {
      const arr = p.elements.slice();
      const i = arr.findIndex((e) => e.id === id);
      if (i < 0) return p;
      const [el] = arr.splice(i, 1);
      const j = dir === 'top' ? arr.length : dir === 'bottom' ? 0 : dir === 'up' ? Math.min(arr.length, i + 1) : Math.max(0, i - 1);
      arr.splice(j, 0, el);
      return { ...p, elements: arr };
    });
  },
  moveTo(id, targetIndex) {
    get().mutate((p) => {
      const arr = p.elements.slice();
      const i = arr.findIndex((e) => e.id === id);
      if (i < 0) return p;
      const [el] = arr.splice(i, 1);
      arr.splice(Math.max(0, Math.min(arr.length, targetIndex)), 0, el);
      return { ...p, elements: arr };
    });
  },
  align(ids, how) {
    const { project } = get();
    const { W, H } = canvasSize(project.structure.board.widthM, project.structure.board.heightM);
    get().updateElements(ids, (e) => {
      const w = e.width, h = e.height;
      switch (how) {
        case 'left': return { x: 0 };
        case 'center': return { x: (W - w) / 2 };
        case 'right': return { x: W - w };
        case 'top': return { y: 0 };
        case 'middle': return { y: (H - h) / 2 };
        case 'bottom': return { y: H - h };
        default: return {};
      }
    });
  },

  // ---- structure / board
  patchStructure(patch, key) {
    get().mutate((p) => ({ ...p, structure: mergeDeep(p.structure, patch) }), key);
  },
  setKind(kind) {
    get().mutate((p) => {
      const base = defaultStructure(kind);
      const st = mergeDeep(p.structure, { kind });
      if (kind === 'flag') {
        st.board = { ...st.board, cornerRadiusM: 0, border: { ...st.board.border, enabled: false }, frame: { ...st.board.frame, enabled: false } };
        st.finish = { roughness: 0.85, metalness: 0, reflectivity: 0.05 };
      } else {
        st.board = { ...base.board, widthM: st.board.widthM, heightM: st.board.heightM, bg: st.board.bg };
        st.finish = base.finish;
      }
      return { ...p, structure: st };
    });
  },
  patchExport(patch) { set((s) => ({ project: { ...s.project, export: { ...s.project.export, ...patch } }, dirty: true, saveState: 'dirty' })); },
}));
