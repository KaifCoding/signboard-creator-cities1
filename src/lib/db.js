// IndexedDB persistence: projects (with embedded image assets) and uploaded fonts.
const DB = 'signboard-creator';
const VERSION = 1;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('fonts')) db.createObjectStore('fonts', { keyPath: 'name' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    const r = fn(s);
    if (r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => { db.close(); resolve(result); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  });
}

export const saveProjectRecord = (p) => tx('projects', 'readwrite', (s) => s.put(p));
export const loadProjectRecord = (id) => tx('projects', 'readonly', (s) => s.get(id));
export const deleteProjectRecord = (id) => tx('projects', 'readwrite', (s) => s.delete(id));
export async function listProjectRecords() {
  const all = (await tx('projects', 'readonly', (s) => s.getAll())) || [];
  return all.map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, thumb: p.thumb, kind: p.structure?.kind })).sort((a, b) => b.updatedAt - a.updatedAt);
}
export const saveFontRecord = (f) => tx('fonts', 'readwrite', (s) => s.put(f));
export const listFontRecords = async () => (await tx('fonts', 'readonly', (s) => s.getAll())) || [];
export const deleteFontRecord = (name) => tx('fonts', 'readwrite', (s) => s.delete(name));

export const LAST_KEY = 'sbc:lastProject';
