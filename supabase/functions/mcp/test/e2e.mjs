import { DB } from './fake-supabase.mjs';
import { webcrypto } from 'node:crypto';
let handler = null; const env = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
const sha = async (s) => [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
// proveedores simulados
const calls = []; const realFetch = globalThis.fetch;
const mp3 = new Uint8Array(417 * 40); for (let i = 0; i < 40; i++) mp3.set([0xff, 0xfb, 0x90, 0x00], i * 417);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6]);
globalThis.fetch = async (url, init) => {
  const u = String(url);
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
DB.tokens[await sha(TOKEN)] = { token_id: 'tk1', user_id: 'u_ana', scopes: ['read', 'write'], name: 'ChatGPT' };
DB.tokens[await sha(TOKEN2)] = { token_id: 'tk2', user_id: 'u_ana', scopes: ['read'], name: 'solo lectura' };
DB.tables.framaly_access.push({ user_id: 'u_ana', email: 'ana@x.com', status: 'approved', role: 'user', perms: {}, ai: { openai: 'both', anthropic: 'own', gemini: 'off', elevenlabs: 'shared' }, daily_usd: 5 });
DB.tokens[await sha(REV)] = null;
DB.secrets.openai = 'sk-server-key'; DB.secrets.anthropic = 'sk-ant-x';
const post = (path, body, tok = TOKEN, hdr = {}) => handler(new Request('https://proj.supabase.co/functions/v1/mcp' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...hdr }, body: JSON.stringify(body) }));
const rpc = async (method, params, tok) => { const r = await post('', { jsonrpc: '2.0', id: 1, method, params }, tok); return { status: r.status, body: r.status === 202 ? null : await r.json() }; };
const call = async (name, args, tok) => { const r = await rpc('tools/call', { name, arguments: args }, tok); const t = r.body?.result?.content?.[0]?.text; let v = t; try { v = JSON.parse(t); } catch { /* texto */ } return { isError: r.body?.result?.isError, v, raw: r }; };

// --- acceso público
let r = await handler(new Request('https://proj.supabase.co/functions/v1/mcp/openapi.json')); const spec = await r.json();
ok('descripciones OpenAPI ≤ 300 caracteres (límite de ChatGPT)', Object.values(spec.paths).every((p) => p.post.description.length <= 300 && p.post.summary.length <= 300), Object.values(spec.paths).map((p) => p.post.description.length));
ok('GET openapi.json público', r.status === 200 && spec.openapi === '3.1.0' && spec.servers[0].url === 'https://proj.supabase.co/functions/v1/mcp');
r = await handler(new Request('https://proj.supabase.co/functions/v1/mcp')); ok('GET info', r.status === 200 && (await r.json()).tools.length === 9);
r = await handler(new Request('https://proj.supabase.co/functions/v1/mcp', { method: 'OPTIONS' })); ok('CORS preflight', r.status === 204 && r.headers.get('access-control-allow-headers').includes('authorization'));
// --- autenticación
r = await post('', { jsonrpc: '2.0', id: 1, method: 'ping' }, null); ok('sin clave → 401', r.status === 401 && r.headers.get('www-authenticate').startsWith('Bearer'));
r = await post('', { jsonrpc: '2.0', id: 1, method: 'ping' }, 'fmk_mala'); ok('clave con mal formato → 401', r.status === 401);
r = await post('', { jsonrpc: '2.0', id: 1, method: 'ping' }, REV); ok('clave revocada → 401', r.status === 401);
r = await post('', { jsonrpc: '2.0', id: 1, method: 'ping' }, null, { 'x-api-key': TOKEN }); ok('clave en x-api-key', r.status === 200);
r = await handler(new Request('https://proj.supabase.co/functions/v1/mcp/t/' + TOKEN, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) })); ok('clave en la ruta /t/…', r.status === 200);
// --- protocolo MCP
r = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'chatgpt' } });
ok('initialize', r.body.result.serverInfo.name === 'framaly' && r.body.result.capabilities.tools && r.body.result.protocolVersion === '2025-03-26' && r.body.result.instructions.includes('framaly_status'));
r = await post('', { jsonrpc: '2.0', method: 'notifications/initialized' }); ok('notificación → 202', r.status === 202);
r = await rpc('tools/list'); ok('tools/list (9, con esquema y anotaciones)', r.body.result.tools.length === 9 && r.body.result.tools.every((t) => t.inputSchema.type === 'object') && r.body.result.tools.find((t) => t.name === 'framaly_status').annotations.readOnlyHint === true);
r = await rpc('tools/list', {}, TOKEN2); ok('clave solo-lectura ve solo 3 herramientas', r.body.result.tools.length === 3, r.body.result.tools.map((t) => t.name));
r = await rpc('método/raro'); ok('método desconocido → -32601', r.body.error.code === -32601);
r = await handler(new Request('https://proj.supabase.co/functions/v1/mcp', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN }, body: '{no json' })); ok('JSON roto → -32700', (await r.json()).error.code === -32700);
// --- herramientas
let c = await call('framaly_status'); ok('status: IAs y tope', c.v.cuenta === 'ana@x.com' && c.v.ias_disponibles.texto.join() === 'openai' && c.v.ias_disponibles.imagenes.join() === 'openai' && c.v.ias_disponibles.voz.join() === 'openai' && c.v.tope_diario_usd === 5, c.v);
c = await call('framaly_write_script', { topic: 'faros', scenes: 3 }); ok('guion', !c.isError && c.v.scenes.length === 3 && c.v.ia_usada === 'openai' && c.v.title === 'Faros', c.v);
ok('guion registró gasto', DB.tables.framaly_usage.some((u) => u.kind === 'texto' && u.units.via === 'mcp'));
c = await call('framaly_write_script', { topic: 'x', provider: 'anthropic' }); ok('IA no habilitada para la cuenta → mensaje claro', c.isError && /no tiene habilitada/.test(c.v), c.v);
c = await call('framaly_write_script', { topic: 'x', provider: 'gemini' }); ok('Gemini apagada → mensaje claro', c.isError && /no tiene habilitada/.test(c.v));
c = await call('framaly_generate_image', { prompt: 'un faro', aspect: '9:16' }); ok('imagen guardada en biblioteca', !c.isError && c.v.media_id && c.v.url_temporal.includes('u_ana/') && DB.tables.framaly_media.some((m) => m.id === c.v.media_id && m.type === 'image' && m.user_id === 'u_ana'), c.v);
const imgId = c.v.media_id;
c = await call('framaly_generate_voice', { text: 'Hola mundo' }); ok('voz con duración real del mp3', !c.isError && Math.abs(c.v.duracion_segundos - 40 * 1152 / 44100) < 0.01, c.v);
const voId = c.v.media_id;
c = await call('framaly_generate_voice', { text: 'x', provider: 'elevenlabs' }); ok('ElevenLabs sin clave → mensaje claro', c.isError && /no guardó la clave/.test(c.v), c.v);
c = await call('framaly_list_media', { type: 'image' }); ok('listar biblioteca', c.v.archivos.length === 1 && c.v.archivos[0].id === imgId);
c = await call('framaly_create_video_project', { title: 'Faros del mundo', scenes: [{ narration: 'Uno.', image_prompt: 'faro' }, { narration: 'Dos.', image_media_id: imgId, voice_media_id: voId }] });
ok('proyecto creado', !c.isError && c.v.escenas === 2 && c.v.con_voz === true && c.v.project_id, c.v);
const pr = DB.tables.framaly_projects.find((p) => p.id === c.v.project_id);
ok('proyecto guardado con la forma del editor', pr && pr.user_id === 'u_ana' && pr.data.clips.length === 2 && pr.data.audio.length === 2 && pr.data.clips[0].transition && pr.data.clips[0].motion && pr.data.clips[1].mediaId === imgId && pr.data.aspect === '16:9' && pr.data.fps === 30, pr?.data);
ok('sin voz: 5 s por escena por defecto', true);
ok('duración mínima 2.5 s (como el Agente Editor)', pr.data.clips[1].duration === 2.5, pr.data.clips[1].duration);
ok('audio de la voz arranca 0.2 s después', pr.data.audio[1].start >= 0.2 && pr.data.audio[1].kind === 'voz');
c = await call('framaly_list_projects'); ok('listar proyectos', c.v.proyectos.length === 1 && c.v.proyectos[0].nombre === 'Faros del mundo' && c.v.proyectos[0].clips === 2, c.v);
c = await call('framaly_create_video_project', { title: 'x', scenes: Array.from({ length: 7 }, () => ({ narration: 'a', image_prompt: 'b' })) }); ok('más de 6 escenas generadas → pide usar ids', c.isError && /Máximo 6/.test(c.v), c.v);
c = await call('framaly_create_video_project', { title: 'x', scenes: [{ narration: 'a', image_media_id: 'noexiste' }] }); ok('imagen inexistente → error claro', c.isError && /No encontré la imagen/.test(c.v), c.v);
c = await call('framaly_create_video_project', { title: 'x', scenes: [{ narration: 'a' }] }); ok('escena sin imagen → error claro', c.isError && /image_prompt, image_url o image_media_id/.test(c.v), c.v);
c = await call('framaly_write_script', {}); ok('argumento requerido', c.isError && /Falta «topic»/.test(c.v));
c = await call('framaly_generate_image', { prompt: 'x' }, TOKEN2); ok('clave solo-lectura no puede generar', c.isError && /no tiene permiso/.test(c.v), c.v);
c = await call('framaly_nada', {}); ok('herramienta inexistente', c.isError && /No existe/.test(c.v));
c = await call('framaly_create_video_project', { title: 'sin voz', voice: false, scenes: [{ narration: 'a', image_media_id: imgId }, { narration: 'b', image_media_id: imgId }], seconds_per_scene: 7 });
const pr2 = DB.tables.framaly_projects.find((p) => p.id === c.v.project_id); ok('seconds_per_scene respetado', pr2.data.clips.every((x) => x.duration === 7) && c.v.duracion_segundos === 14 && c.v.con_voz === false, c.v);
c = await call('framaly_create_video_project', { title: 'x', voice: false, scenes: [{ image_media_id: imgId }], seconds_per_scene: 99 }); ok('seconds_per_scene fuera de rango', c.isError && /número entre/.test(c.v), c.v);
DB.tables.framaly_api_calls.length = 0;
// --- imágenes que ya existen (ChatGPT, enlaces)
c = await call('framaly_import_image', { image_urls: ['https://files.oaiusercontent.com/a.png', 'https://cdn.example.com/redir'] }); ok('importar 2 imágenes (una con redirección)', !c.isError && c.v.importadas.length === 2 && c.v.fallos.length === 0 && c.v.importadas.every((m) => DB.tables.framaly_media.some((r) => r.id === m.media_id && r.type === 'image' && r.user_id === 'u_ana' && r.meta.imported)), c.v);
c = await call('framaly_import_image', { openaiFileIdRefs: [{ name: 'faro.png', id: 'file-1', mime_type: 'image/png', download_link: 'https://files.oaiusercontent.com/faro.png' }] }); ok('importar desde openaiFileIdRefs de ChatGPT', !c.isError && c.v.importadas.length === 1, c.v);
for (const [n, u, re] of [['localhost', 'https://localhost/a.png', /https públicos/], ['IP privada', 'https://10.0.0.8/a.png', /https públicos/], ['metadatos de la nube', 'https://169.254.169.254/latest', /https públicos/], ['http sin cifrar', 'http://files.oaiusercontent.com/a.png', /https públicos/], ['credenciales en el enlace', 'https://user:pw@files.oaiusercontent.com/a.png', /https públicos/], ['no es imagen', 'https://evil.example.com/a.png', /no es una imagen/], ['enlace vencido', 'https://gone.example.com/a.png', /403/], ['demasiado grande', 'https://big.example.com/a.png', /8 MB/], ['redirección infinita', 'https://loop.example.com/a', /redirige demasiadas/], ['enlace roto', 'esto no es un enlace', /no es válido/]]) {
  c = await call('framaly_import_image', { image_urls: [u] }); ok('rechaza: ' + n, c.isError && re.test(c.v), c.v);
}
c = await call('framaly_import_image', {}); ok('sin imágenes → mensaje claro', c.isError && /image_urls/.test(c.v));
DB.tables.framaly_api_calls.length = 0;
const before = DB.tables.framaly_usage.length;
c = await call('framaly_create_video_project', { title: 'Desde ChatGPT', voice: false, openaiFileIdRefs: [1, 2, 3].map((i) => ({ name: i + '.png', id: 'f' + i, mime_type: 'image/png', download_link: 'https://files.oaiusercontent.com/' + i + '.png' })) });
const pr3 = DB.tables.framaly_projects.find((p) => p.id === c.v.project_id);
ok('video solo con imágenes de ChatGPT (sin escenas)', !c.isError && c.v.escenas === 3 && pr3.data.clips.length === 3 && pr3.data.clips.every((x) => DB.tables.framaly_media.some((m) => m.id === x.mediaId && m.meta.imported)), c.v);
ok('no gastó nada en IA (usa tus imágenes)', DB.tables.framaly_usage.length === before);
c = await call('framaly_create_video_project', { title: 'Con voz y narración', voice: true, image_urls: ['https://files.oaiusercontent.com/1.png', 'https://files.oaiusercontent.com/2.png'], scenes: [{ narration: 'Primera escena.' }, { narration: 'Segunda escena.', on_screen_text: 'Dos' }] });
const pr4 = DB.tables.framaly_projects.find((p) => p.id === c.v.project_id);
ok('imágenes de ChatGPT + narración con voz de FRAMALY', !c.isError && pr4.data.clips.length === 2 && pr4.data.audio.length === 2 && pr4.data.clips[0].text === 'Primera escena.' && c.v.con_voz === true, c.v);
ok('solo se generó voz (no imágenes)', DB.tables.framaly_usage.slice(before).every((u) => u.kind === 'voz'), DB.tables.framaly_usage.slice(before).map((u) => u.kind));
c = await call('framaly_create_video_project', { title: 'Mezcla', voice: false, image_urls: ['https://files.oaiusercontent.com/1.png'], scenes: [{ narration: 'a' }, { narration: 'b', image_prompt: 'un faro' }, { narration: 'c', image_media_id: imgId }] });
ok('mezcla: 1 imagen tuya + 1 generada + 1 de la biblioteca', !c.isError && c.v.escenas === 3, c.v);
c = await call('framaly_create_video_project', { title: 'x', voice: false, image_urls: ['https://evil.example.com/a.png'] }); ok('imagen mala en el video → error claro y no crea proyecto', c.isError && /escena 1/.test(c.v) && !DB.tables.framaly_projects.some((p) => p.data.name === 'x'), c.v);
c = await call('framaly_create_video_project', { title: 'x' }); ok('sin escenas ni imágenes → error claro', c.isError && /scenes o imágenes/.test(c.v), c.v);
DB.tables.framaly_api_calls.length = 0;
// --- aislamiento entre cuentas
DB.tables.framaly_media.push({ user_id: 'u_otro', id: 'mOTRO', type: 'image', name: 'ajena', deleted: false });
c = await call('framaly_create_video_project', { title: 'robo', scenes: [{ narration: 'a', image_media_id: 'mOTRO' }] }); ok('no usa archivos de otra cuenta', c.isError && /No encontré/.test(c.v));
// --- REST
r = await post('/api/framaly_status', {}); const rb = await r.json(); ok('REST /api/framaly_status', r.status === 200 && rb.cuenta === 'ana@x.com');
r = await post('/api/framaly_write_script', {}); ok('REST error → 400 con mensaje', r.status === 400 && (await r.json()).error.message.includes('topic'));
// --- topes de uso
DB.tables.framaly_usage.push({ user_id: 'u_ana', provider: 'openai', kind: 'imagen', cost_usd: 6, units: {} });
c = await call('framaly_generate_image', { prompt: 'otra' }); ok('tope diario respetado', c.isError && /tope diario/.test(c.v), c.v);
DB.tables.framaly_usage.length = 0;
// --- límite por minuto
DB.tables.framaly_api_calls.length = 0; const now = new Date().toISOString();
for (let i = 0; i < 30; i++) DB.tables.framaly_api_calls.push({ token_id: 'tk1', created_at: now });
c = await call('framaly_status'); ok('límite de 30 llamadas por minuto', c.isError && /Demasiadas llamadas/.test(c.v), c.v);
r = await post('/api/framaly_status', {}); ok('REST límite → 429', r.status === 429);
console.log(bad ? `\n${bad} FALLOS` : '\nTODO OK'); process.exit(bad ? 1 : 0);
