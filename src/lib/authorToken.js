// Author ID copied from a real .crp; remembered per browser so every project can use it.
const KEY = 'sbc.authorToken';
export function getSavedToken() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } }
export function saveToken(t) { try { localStorage.setItem(KEY, t); } catch { /* storage unavailable */ } }
