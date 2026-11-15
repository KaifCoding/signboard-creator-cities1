// Browser side of "GENERATE & EXPORT CRP": render design -> atlas -> POST to the local Node
// service -> receive a validated .crp -> download it.
import { registry, renderDesign } from './registry.js';
import { composeAtlas, materialSpec } from './atlas.js';
import { ensureFonts } from './fonts.js';

export function buildSpec(structure) {
  return { kind: structure.kind, board: structure.board, poles: structure.poles, flag: structure.flag };
}

const toBlob = (canvas) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'));

export function download(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function runExport(project, { format = 'crp', onStep = () => {} } = {}) {
  const { structure, export: ex } = project;
  const size = ex.resolution || 1024;
  onStep('Loading fonts');
  await ensureFonts(project.elements);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  onStep('Converting design to texture');
  const design = renderDesign(size);
  const atlas = composeAtlas(design, structure, size);
  const png = await toBlob(atlas.color);
  onStep('Generating geometry, UVs, materials and packaging CRP');
  const fd = new FormData();
  fd.append('texture', png, 'atlas.png');
  fd.append('payload', JSON.stringify({
    format, name: ex.assetName || project.name, author: ex.author || '',
    tags: (ex.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
    spec: buildSpec(structure), mat: materialSpec(structure),
  }));
  const res = await fetch('/api/export-crp', { method: 'POST', body: fd });
  if (!res.ok) {
    let msg = `Export failed (${res.status})`;
    try { const j = await res.json(); msg = j.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  onStep('Validating package');
  const blob = await res.blob();
  const fileName = res.headers.get('X-File-Name') || (format === 'kit' ? 'signboard_import_kit.zip' : 'Signboard.crp');
  let report = null;
  const h = res.headers.get('X-CRP-Report');
  if (h) { try { report = JSON.parse(decodeURIComponent(h)); } catch { /* ignore */ } }
  onStep('Downloading');
  download(blob, fileName);
  return { fileName, bytes: blob.size, report };
}
