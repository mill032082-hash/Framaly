import { DB } from './fake-supabase.mjs';
import { webcrypto } from 'node:crypto';
let handler = null; const env = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
const sha = async (s) => [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
// proveedores simulados
const calls = []; const realFetch = globalThis.fetch;
const mp3 = new Uint8Array(417 * 40); for (let i = 0; i < 40; i++) mp3.set([0xff, 0xfb, 0x90, 0x00], i * 417);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6]);
const wavB = (secs, rate = 8000) => { const n = secs * rate * 2, b = new Uint8Array(44 + n), dv = new DataView(b.buffer); b.set([0x52, 0x49, 0x46, 0x46], 0); dv.setUint32(4, 36 + n, true); b.set([0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20], 8); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); b.set([0x64, 0x61, 0x74, 0x61], 36); dv.setUint32(40, n, true); return b; };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://files.oaiusercontent.com/musica.wav')) return new Response(wavB(10), { status: 200 });
  if (u.startsWith('https://files.oaiusercontent.com/voz1.wav')) return new Response(wavB(2), { status: 200 });
  if (u.startsWith('https://files.oaiusercontent.com/voz2.wav')) return new Response(wavB(4), { status: 200 });
  if (u.startsWith('https://files.oaiusercontent.com/voz.mp3')) return new Response(mp3, { status: 200 });
  if (u.startsWith('https://evil.example.com/audio')) return new Response('<html>no soy audio</html>', { status: 200 });
  if (u.startsWith('https://huge.example.com/')) return new Response(wavB(1), { status: 200, headers: { 'content-length': String(30 * 1024 * 1024) } });
  if (u.startsWith('https://files.oaiusercontent.com/')) return new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } });
  if (u.startsWith('https://cdn.example.com/redir')) return new Response(null, { status: 302, headers: { location: 'https://files.oaiusercontent.com/x.png' } });
  if (u.startsWith('https://evil.example.com/')) return new Response('<html>no soy imagen</html>', { status: 200, headers: { 'content-type': 'image/png' } });
  if (u.startsWith('https://gone.example.com/')) return new Response('x', { status: 403 });
  if (u.startsWith('https://big.example.com/')) return new Response(PNG, { status: 200, headers: { 'content-length': String(9 * 1024 * 1024) } });
  if (u.startsWith('https://loop.example.com/')) return new Response(null, { status: 302, headers: { location: 'https://loop.example.com/again' } }); calls.push(u.replace(/^https:\/\//, '').slice(0, 60));
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  if (u.includes('api.openai.com/v1/chat/completions')) return J({ choices: [{ message: { content: JSON.stringify({ title: 'Faros', scenes: [{ narration: 'Uno.', image_prompt: 'faro', on_screen_text: 'Faro' }, { narration: 'Dos.', image_prompt: 'mar', on_screen_text: 'Mar' }, { narration: 'Tres.', image_prompt: 'cielo', on_screen_text: 'Cielo' }] }) } }], usage: { prompt_tokens: 100, completion_tokens: 200 } });
  if (u.includes('api.openai.com/v1/images/generations')) return J({ data: [{ b64_json: 'iVBORw0KGgo=' }] });
  if (u.includes('api.openai.com/v1/audio/speech')) return new Response(mp3, { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  if (u.includes('api.anthropic.com')) return J({ error: { message: 'x-api-key inválida' } }, 401);
  return J({ error: { message: 'no simulado: ' + u } }, 404);
};
await import('/tmp/mcpe2e/bundle.mjs');
let bad = 0; const ok = (n, c, x = '') => { console.log((c ? 'OK  ' : 'FALLO ') + n + (c ? '' : '  ' + JSON.stringify(x))); if (!c) bad++; };
const TOKEN = 'fmk_' + 'a1'.repeat(24), TOKEN2 = 'fmk_' + 'b2'.repeat(24), REV = 'fmk_' + 'c3'.repeat(24);
DB.tokens[await sha(TOKEN)] = { token_id: 'tk1', user_id: 'u_ana', scopes: ['read', 'write'], name: 'ChatGPT', exec_mode: 'all' };
DB.tokens[await sha(TOKEN2)] = { token_id: 'tk2', user_id: 'u_ana', scopes: ['read'], name: 'solo lectura', exec_mode: 'all' };
DB.tables.framaly_access.push({ user_id: 'u_ana', email: 'ana@x.com', status: 'approved', role: 'user', perms: {}, ai: { openai: 'both', anthropic: 'own', gemini: 'off', elevenlabs: 'shared' }, daily_usd: 5 });
DB.tokens[await sha(REV)] = null;
DB.secrets.openai = 'sk-server-key'; DB.secrets.anthropic = 'sk-ant-x';
const post = (path, body, tok = TOKEN, hdr = {}) => handler(new Request('https://proj.supabase.co/functions/v1/mcp' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...hdr }, body: JSON.stringify(body) }));
const rpc = async (method, params, tok) => { const r = await post('', { jsonrpc: '2.0', id: 1, method, params }, tok); return { status: r.status, body: r.status === 202 ? null : await r.json() }; };
const call = async (name, args, tok) => { const r = await rpc('tools/call', { name, arguments: args }, tok); const t = r.body?.result?.content?.[0]?.text; let v = t; try { v = JSON.parse(t); } catch { /* texto */ } return { isError: r.body?.result?.isError, v, raw: r }; };


// ===== Guiones que llegan solos a FRAMALY (framaly_save_script) =====
const TA = 'fmk_' + 'c1'.repeat(24), TB = 'fmk_' + 'c2'.repeat(24);
DB.tokens[await sha(TA)] = { token_id: 'tka', user_id: 'u_ana', scopes: ['read', 'write'], name: 'ana', exec_mode: 'external' };
DB.tokens[await sha(TB)] = { token_id: 'tkb', user_id: 'u_beto', scopes: ['read', 'write'], name: 'beto', exec_mode: 'external' };
DB.tables.framaly_access.push({ user_id: 'u_beto', email: 'beto@x.com', status: 'approved', role: 'user', perms: {}, ai: {}, daily_usd: 1 });
DB.tables.framaly_scripts ??= [];
const S = () => DB.tables.framaly_scripts.filter((r) => !r.deleted);
const u0 = DB.tables.framaly_usage.length, o0 = calls.filter((x) => x.includes('openai')).length;
let c = await call('framaly_import_image', { image: { download_url: 'https://files.oaiusercontent.com/esc1.png', file_id: 'f1' }, name: 'esc1.png' }, TA);
const img = c.v.media.id;
c = await call('framaly_save_script', { title: 'La sombra', topic: 'un chico y su sombra', visual_bible: 'Kai, pelo blanco', aspect: '9:16', idempotency_key: 'k1',
  scenes: [{ narration: 'Uno.', image_prompt: 'calle', on_screen_text: 'Hola', image_media_id: img }, { narration: 'Dos.', image_prompt: 'casa', image_media_id: 'm_no_existe' }, { narration: '', image_prompt: '' }] }, TA);
ok('guarda el guion y dice dónde verlo', c.isError === false && c.v.success && /^s/.test(c.v.script_id) && /Guiones/.test(c.v.donde_verlo) && c.v.credits_consumed === 0, c.v);
ok('quedó en la tabla del usuario, con sus escenas', S().length === 1 && S()[0].user_id === 'u_ana' && S()[0].title === 'La sombra' && S()[0].data.scenes.length === 2 && S()[0].data.bible === 'Kai, pelo blanco' && S()[0].source === 'mcp', S());
ok('enlaza la imagen válida y avisa de la que no existe', S()[0].data.scenes[0].image_media_id === img && !S()[0].data.scenes[1].image_media_id && c.v.avisos.length === 1 && c.v.scenes_with_image === 1, c.v.avisos);
const sid = c.v.script_id;
c = await call('framaly_save_script', { title: 'La sombra', idempotency_key: 'k1', scenes: [{ narration: 'Uno.' }] }, TA);
ok('repetir con la misma clave no duplica', S().length === 1 && c.v.script_id === sid && c.v.updated_existing === true, S().length);
c = await call('framaly_save_script', { title: 'La sombra v2', script_id: sid, scenes: [{ narration: 'Nueva.' }, { narration: 'Otra.' }] }, TA);
ok('corregir con script_id actualiza el mismo guion', S().length === 1 && S()[0].title === 'La sombra v2' && S()[0].data.scenes.length === 2);
c = await call('framaly_save_script', { title: 'Ajeno', script_id: sid, scenes: [{ narration: 'x' }] }, TB);
ok('otra persona no puede tocar ese guion', c.isError === true && S().length === 1 && S()[0].title === 'La sombra v2', c.v);
c = await call('framaly_save_script', { title: 'Vacío', scenes: [{ narration: '  ' }] }, TA);
ok('rechaza un guion sin contenido', c.isError === true);
c = await call('framaly_list_scripts', {}, TA);
ok('lista solo los míos', c.v.guiones.length === 1 && c.v.guiones[0].script_id === sid && c.v.guiones[0].escenas === 2, c.v);
c = await call('framaly_list_scripts', {}, TB); ok('la otra persona no ve nada', c.v.guiones.length === 0);
ok('no gastó créditos ni llamó a OpenAI', DB.tables.framaly_usage.length === u0 && calls.filter((x) => x.includes('openai')).length === o0);
ok('queda en el registro como guion externo', DB.tables.framaly_mcp_ledger.some((l) => l.kind === 'guion' && l.provider === 'externo' && l.cost_usd === 0));
// el guion que escribe FRAMALY también queda guardado solo
c = await call('framaly_write_script', { topic: 'faros' });
ok('framaly_write_script guarda su guion en Guiones', c.isError === false && /^s/.test(c.v.script_id) && S().some((r) => r.id === c.v.script_id && r.title === 'Faros'), c.v);
// REST y OpenAPI
let r = await post('/api/framaly_save_script', { title: 'Por REST', scenes: [{ narration: 'Hola.' }] }, TA); let j = await r.json();
ok('REST: guarda igual', r.status === 200 && (j.script_id || j.result?.script_id), j);
r = await handler(new Request('https://proj.supabase.co/functions/v1/mcp/openapi.json')); j = await r.json();
ok('OpenAPI incluye guardar guion (para un GPT con Acciones)', !!j.paths['/api/framaly_save_script'] && j.paths['/api/framaly_save_script'].post.description.length <= 300, j.paths['/api/framaly_save_script']?.post?.description?.length);
r = await rpc('tools/list', {}, TA); ok('aparece en la lista de herramientas', r.body.result.tools.some((t) => t.name === 'framaly_save_script') && r.body.result.tools.some((t) => t.name === 'framaly_list_scripts'));
console.log(bad ? `\n${bad} FALLOS` : '\nTodo correcto'); process.exit(bad ? 1 : 0);
