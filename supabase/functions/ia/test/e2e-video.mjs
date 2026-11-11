// Prueba de las rutas de video de la función «ia» con proveedores simulados. Ver LEEME: se compila con esbuild.
import { DB } from './fake-supabase.mjs';
let handler; const calls = [];
globalThis.Deno = { serve: (h) => (handler = h), env: { get: () => 'x' } };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : null });
  const u = String(url), J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  if (/:predictLongRunning$/.test(u)) return J({ name: 'models/veo-3.0-fast-generate-001/operations/op123' });
  if (/operations\/op123$/.test(u)) return J(globalThis.__veoDone ? { done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://generativelanguage.googleapis.com/v1beta/files/veofile1:download?alt=media' } }] } } } : { done: false });
  if (/files\/veofile1:download\?alt=media$/.test(u)) return new Response(new Uint8Array([1, 2, 3, 4]), { headers: { 'content-type': 'video/mp4' } });
  if (/\/v1\/video_generation$/.test(u)) return J({ task_id: 'task9', base_resp: { status_code: 0 } });
  if (/query\/video_generation\?task_id=task9$/.test(u)) return J({ status: 'Success', file_id: 'file77', base_resp: { status_code: 0 } });
  if (/files\/retrieve\?file_id=file77$/.test(u)) return J({ file: { download_url: 'https://cdn.example.com/v.mp4' }, base_resp: { status_code: 0 } });
  if (u === 'https://cdn.example.com/v.mp4') return new Response(new Uint8Array([9, 9, 9]), { headers: { 'content-type': 'video/mp4' } });
  return J({ error: { message: 'ruta no simulada ' + u } }, 404);
};
await import(process.argv[2]);
DB.users.tok = 'u1'; DB.tables.framaly_access.push({ user_id: 'u1', status: 'approved', role: 'user', perms: {}, ai: { gemini: 'shared', minimax: 'shared' }, daily_usd: 5, email: 'a@b.c' });
const call = (b) => handler(new Request('http://x/ia', { method: 'POST', headers: { Authorization: 'Bearer tok', 'content-type': 'application/json' }, body: JSON.stringify(b) }));
let ok = 0, bad = 0; const t = (name, cond, extra = '') => { cond ? ok++ : bad++; console.log((cond ? '✓ ' : '✗ ') + name + (cond ? '' : ' ' + JSON.stringify(extra))); };
const usage = () => DB.tables.framaly_usage;

let r = await call({ provider: 'gemini', method: 'POST', path: '/v1beta/models/veo-3.0-fast-generate-001:predictLongRunning', body: { instances: [{ prompt: 'a' }, { prompt: 'b' }], parameters: { aspectRatio: '9:16', sampleCount: 4 } } });
let j = await r.json(); const sent = calls.at(-1);
t('Veo: crear devuelve la operación', r.status === 200 && j.name?.endsWith('op123'), j);
t('Veo: el cuerpo NO lleva generationConfig/contents y limita a 1 video', !sent.body.generationConfig && !sent.body.contents && sent.body.instances.length === 1 && sent.body.parameters.sampleCount === 1, sent.body);
t('Veo: la clave va en el servidor', sent.headers['x-goog-api-key'] === 'CLAVE-gemini');
t('Veo: crear no anota gasto', usage().length === 0);
r = await call({ provider: 'gemini', method: 'GET', path: '/v1beta/models/veo-3.0-fast-generate-001/operations/op123' }); j = await r.json();
t('Veo: estado en curso, sin gasto', j.done === false && usage().length === 0);
globalThis.__veoDone = true;
r = await call({ provider: 'gemini', method: 'GET', path: '/v1beta/models/veo-3.0-fast-generate-001/operations/op123' }); j = await r.json();
t('Veo: al terminar anota 8 s × 0,15', j.done === true && usage().length === 1 && Math.abs(usage()[0].cost_usd - 1.2) < 1e-9 && usage()[0].kind === 'video', usage());
await call({ provider: 'gemini', method: 'GET', path: '/v1beta/models/veo-3.0-fast-generate-001/operations/op123' });
t('Veo: consultar otra vez NO cobra doble', usage().length === 1);
r = await call({ provider: 'gemini', method: 'GET', path: '/v1beta/files/veofile1:download?alt=media' });
{ const n = (await r.clone().arrayBuffer()).byteLength; t('Veo: baja el archivo binario', r.status === 200 && r.headers.get('content-type') === 'video/mp4' && n === 4, [r.status, r.headers.get('content-type'), n, calls.at(-1).url]); }

r = await call({ provider: 'minimax', method: 'POST', path: '/v1/video_generation', body: { model: 'MiniMax-Hailuo-02', prompt: 'x', duration: 6 } }); j = await r.json();
t('MiniMax: crear devuelve la tarea', j.task_id === 'task9' && calls.at(-1).headers.Authorization === 'Bearer CLAVE-minimax');
r = await call({ provider: 'minimax', method: 'GET', path: '/v1/query/video_generation?task_id=task9' }); j = await r.json();
t('MiniMax: al terminar anota el gasto una vez', j.status === 'Success' && usage().length === 2 && usage()[1].provider === 'minimax');
await call({ provider: 'minimax', method: 'GET', path: '/v1/query/video_generation?task_id=task9' }); t('MiniMax: sin cobro doble', usage().length === 2);
r = await call({ provider: 'minimax', method: 'GET', path: '/v1/files/retrieve?file_id=file77&download=1' });
t('MiniMax: download=1 reenvía el archivo', r.headers.get('content-type') === 'video/mp4' && (await r.arrayBuffer()).byteLength === 3 && !calls.some((c) => /download=1/.test(c.url)));
r = await call({ provider: 'minimax', method: 'GET', path: '/v1/files/retrieve?file_id=file77' }); j = await r.json(); t('MiniMax: sin download devuelve el JSON', !!j.file?.download_url);

r = await call({ provider: 'gemini', method: 'GET', path: '/v1beta/files/veofile1:download?alt=media&key=robada' }); t('Rechaza parámetros no permitidos', r.status === 400);
r = await call({ provider: 'gemini', method: 'POST', path: '/v1beta/models/gemini-pro:predictLongRunning', body: {} }); t('Rechaza predictLongRunning que no sea Veo', r.status === 400);
r = await call({ provider: 'gemini', method: 'GET', path: '/v1beta/files/../models' }); t('Rechaza rutas raras', r.status === 400);
// texto normal de Gemini sigue igual (regresión)
globalThis.fetch = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(init.body) }); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hola' }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }), { headers: { 'content-type': 'application/json' } }); };
r = await call({ provider: 'gemini', method: 'POST', path: '/v1beta/models/gemini-2.5-flash:generateContent', body: { contents: [{ parts: [{ text: 'hi' }] }] } });
t('Texto de Gemini sigue funcionando y anotando', r.status === 200 && calls.at(-1).body.generationConfig && usage().at(-1).kind === 'texto');
// límite mensual: bloquea crear, pero deja consultar y bajar lo ya pagado
DB.tables.framaly_limits.push({ provider: 'minimax', monthly_usd: 0.1, alert_pct: 80 });
globalThis.fetch = async () => new Response(JSON.stringify({ status: 'Processing', base_resp: { status_code: 0 } }), { headers: { 'content-type': 'application/json' } });
r = await call({ provider: 'minimax', method: 'POST', path: '/v1/video_generation', body: { prompt: 'x' } }); t('Con el límite alcanzado no deja crear', r.status === 429);
r = await call({ provider: 'minimax', method: 'GET', path: '/v1/query/video_generation?task_id=task9' }); t('…pero sí consultar lo que ya está en marcha', r.status === 200);
console.log(`\n${ok} correctas, ${bad} fallidas`); process.exit(bad ? 1 : 0);
