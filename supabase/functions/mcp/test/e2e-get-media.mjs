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

// ===== Ver imágenes de la biblioteca desde ChatGPT (framaly_get_media) =====
const TA = 'fmk_' + 'c1'.repeat(24), TB = 'fmk_' + 'c2'.repeat(24);
DB.tokens[await sha(TA)] = { token_id: 'tka', user_id: 'u_ana', scopes: ['read', 'write'], name: 'ana', exec_mode: 'external' };
DB.tokens[await sha(TB)] = { token_id: 'tkb', user_id: 'u_beto', scopes: ['read'], name: 'beto', exec_mode: 'external' };
DB.tables.framaly_access.push({ user_id: 'u_beto', email: 'beto@x.com', status: 'approved', role: 'user', perms: {}, ai: {}, daily_usd: 1 });
const o0 = calls.filter((c) => c.includes('openai')).length, u0 = DB.tables.framaly_usage.length;
const F = 'https://files.oaiusercontent.com/';
let c = await call('framaly_import_image', { image: { download_url: F + 'ver.png', file_id: 'f1' }, name: 'ver.png' }, TA);
const id = c.v.media.id;
// resultado MCP completo: texto + contenido de imagen
let r = await rpc('tools/call', { name: 'framaly_get_media', arguments: { media_id: id } }, TA);
const content = r.body.result.content;
ok('MCP: devuelve contenido de tipo image con base64 y mimeType', r.body.result.isError === false && content.length === 2 && content[1].type === 'image' && content[1].mimeType === 'image/png' && content[1].data.length > 10, content.map((x) => x.type));
const meta = JSON.parse(content[0].text);
ok('texto: id, nombre, mime, tamaño y URL firmada con caducidad', meta.success && meta.media.id === id && meta.media.name === 'ver.png' && meta.media.mime_type === 'image/png' && meta.media.size_bytes === 14 && /^https:\/\/signed\.example\//.test(meta.signed_url) && meta.signed_url_expires_in_seconds === 600 && meta.image_returned_inline === true, meta);
ok('el texto NO incluye los bytes ni rutas internas con service_role', !content[0].text.includes(content[1].data) && !/service_role|svc/.test(content[0].text));
const back = Buffer.from(content[1].data, 'base64');
ok('los bytes devueltos son EXACTAMENTE los almacenados (PNG)', Buffer.compare(back, Buffer.from(DB.storage['framaly-media/u_ana/' + id].bytes)) === 0 && back[0] === 0x89 && back[1] === 0x50);
// REST: solo metadatos y URL (sin base64)
let rr = await post('/api/framaly_get_media', { media_id: id }, TA); const rj = await rr.json();
ok('REST: metadatos y URL firmada, sin los bytes en el JSON', rr.status === 200 && rj.success && rj.signed_url && !('__image' in rj) && !JSON.stringify(rj).includes(content[1].data), Object.keys(rj));
// seguridad
c = await call('framaly_get_media', { media_id: id }, TB);
ok('otra cuenta NO puede ver la imagen (responde como si no existiera)', c.isError && /No encontré/.test(c.v) && !/u_ana/.test(c.v), c.v);
c = await call('framaly_get_media', { media_id: 'no-existe-123' }, TA); ok('id inexistente → error claro', c.isError && /No encontré/.test(c.v), c.v);
c = await call('framaly_get_media', { media_id: '../../etc/passwd' }, TA); ok('id con caracteres raros → rechazado', c.isError && /no válido/.test(c.v), c.v);
c = await call('framaly_get_media', {}, TA); ok('sin media_id → error', c.isError && /Falta/.test(c.v), c.v);
// fila sin archivo en Storage
DB.tables.framaly_media.push({ user_id: 'u_ana', id: 'huerfano1', type: 'image', name: 'sin archivo', mime: 'image/png', size: 10, created: Date.now(), deleted: false, meta: {} });
c = await call('framaly_get_media', { media_id: 'huerfano1' }, TA); ok('registro sin archivo en Storage → error real', c.isError && /no se encontró en el almacenamiento/.test(c.v), c.v);
// borrado lógico
DB.tables.framaly_media.find((m) => m.id === id).deleted = true;
c = await call('framaly_get_media', { media_id: id }, TA); ok('archivo borrado → no se muestra', c.isError, c.v);
DB.tables.framaly_media.find((m) => m.id === id).deleted = false;
// imagen grande: no se adjunta, solo URL
const big = new Uint8Array(5 * 1024 * 1024); big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
DB.storage['framaly-media/u_ana/grande1'] = { size: big.length, type: 'image/png', bytes: big };
DB.tables.framaly_media.push({ user_id: 'u_ana', id: 'grande1', type: 'image', name: 'grande', mime: 'image/png', size: big.length, created: Date.now(), deleted: false, meta: {} });
r = await rpc('tools/call', { name: 'framaly_get_media', arguments: { media_id: 'grande1' } }, TA);
ok('imagen > 4 MB: sin adjuntar, con URL firmada y aviso', r.body.result.content.length === 1 && JSON.parse(r.body.result.content[0].text).image_returned_inline === false && /4 MB/.test(JSON.parse(r.body.result.content[0].text).note));
// herramienta de solo lectura (una clave read puede usarla) y sin gasto
r = await rpc('tools/list', {}, TB); ok('clave de solo lectura ve framaly_get_media', r.body.result.tools.some((t) => t.name === 'framaly_get_media'));
ok('no llama a OpenAI ni descuenta créditos', calls.filter((c) => c.includes('openai')).length === o0 && DB.tables.framaly_usage.length === u0);
const spec = await (await handler(new Request('https://proj.supabase.co/functions/v1/mcp/openapi.json'))).json();
ok('OpenAPI incluye framaly_get_media (descripción ≤ 300)', spec.paths['/api/framaly_get_media'].post.description.length <= 300 && spec.paths['/api/framaly_get_media'].post.requestBody.content['application/json'].schema.required[0] === 'media_id');
console.log(bad ? `\n${bad} FALLOS` : '\nTODO OK'); process.exit(bad ? 1 : 0);
