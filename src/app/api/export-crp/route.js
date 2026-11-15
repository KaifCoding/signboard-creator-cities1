import { generateCrp, generateKit } from '../../../lib/crp/pipeline.js';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const form = await req.formData();
    const payload = JSON.parse(form.get('payload'));
    const tex = form.get('texture');
    if (!tex || typeof tex === 'string') return Response.json({ error: 'texture missing' }, { status: 400 });
    const atlasPng = Buffer.from(await tex.arrayBuffer());
    const args = { spec: payload.spec, atlasPng, name: payload.name, author: payload.author, tags: payload.tags || [], mat: payload.mat };

    if (payload.format === 'kit') {
      const kit = generateKit(args);
      return new Response(kit.bytes, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${kit.fileName}"`, 'X-File-Name': kit.fileName } });
    }
    const out = generateCrp(args);
    const report = { fileName: out.fileName, summary: out.summary, checks: out.validation.checks, textures: out.validation.textures, shader: out.validation.shader };
    return new Response(out.bytes, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${out.fileName}"`,
        'X-File-Name': out.fileName,
        'X-CRP-Report': encodeURIComponent(JSON.stringify(report)),
        'Access-Control-Expose-Headers': 'X-CRP-Report, X-File-Name',
      },
    });
  } catch (e) {
    return Response.json({ error: String(e?.message || e), checks: e?.checks || [] }, { status: 500 });
  }
}
