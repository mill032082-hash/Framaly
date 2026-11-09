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

// ===== modo de ejecución: ChatGPT externo / sin OpenAI / todo =====
const TX = 'fmk_' + 'd4'.repeat(24), TN = 'fmk_' + 'e5'.repeat(24);
DB.tokens[await sha(TX)] = { token_id: 'tkx', user_id: 'u_ana', scopes: ['read', 'write'], name: 'ChatGPT externo', exec_mode: 'external' };
DB.tokens[await sha(TN)] = { token_id: 'tkn', user_id: 'u_ana', scopes: ['read', 'write'], name: 'sin openai', exec_mode: 'no_openai' };
DB.tokens[await sha('fmk_' + 'f6'.repeat(24))] = { token_id: 'tkd', user_id: 'u_ana', scopes: ['read', 'write'], name: 'sin modo' };   // sin exec_mode → debe ser externo
const TD = 'fmk_' + 'f6'.repeat(24);
const openaiCalls = () => calls.filter((c) => c.includes('api.openai.com')).length;
const usage = () => DB.tables.framaly_usage.length;
const ledger = () => DB.tables.framaly_mcp_ledger;
const u0 = usage(), o0 = openaiCalls();

// estado
let c = await call('framaly_status', {}, TX);
ok('status: modo externo, OpenAI de FRAMALY bloqueado, sin IAs de generación', c.v.modo === 'external' && c.v.openai_de_framaly_blocked !== true && c.v.openai_de_framaly_bloqueado === true && c.v.ias_disponibles.imagenes.length === 0 && c.v.ias_disponibles.voz.length === 0, c.v);
c = await call('framaly_status', {}, TD); ok('token sin modo → externo (lo más seguro)', c.v.modo === 'external', c.v);
c = await call('framaly_status', {}, TN); ok('status no_openai: sin openai en ninguna lista', c.v.modo === 'no_openai' && ![...c.v.ias_disponibles.texto, ...c.v.ias_disponibles.imagenes, ...c.v.ias_disponibles.voz].includes('openai'), c.v);
c = await call('framaly_status', {}, TOKEN); ok('status modo all: openai disponible', c.v.modo === 'all' && c.v.ias_disponibles.imagenes.includes('openai'), c.v);

// D/E: en modo externo ninguna generación llega a OpenAI ni descuenta nada
for (const [tool, args, what] of [['framaly_generate_image', { prompt: 'un faro' }, 'imagen'], ['framaly_generate_image', { prompt: 'un faro', provider: 'openai' }, 'imagen openai'], ['framaly_generate_voice', { text: 'Hola mundo' }, 'voz'], ['framaly_generate_voice', { text: 'Hola', provider: 'openai' }, 'voz openai'], ['framaly_write_script', { topic: 'faros' }, 'guion'], ['framaly_seo_metadata', { topic: 'faros' }, 'seo']]) {
  c = await call(tool, args, TX); ok(`D externo bloquea ${what}`, c.isError === true && /Modo ChatGPT externo/.test(c.v), c.v);
}
ok('D: 0 llamadas a OpenAI en modo externo', openaiCalls() === o0, calls.filter((x) => x.includes('openai')));
ok('E: 0 consumo registrado en framaly_usage (créditos de FRAMALY intactos)', usage() === u0);
ok('auditoría: los 6 intentos quedan bloqueados con coste 0', ledger().filter((l) => l.blocked && l.mode === 'external').length === 6 && ledger().every((l) => Number(l.cost_usd) === 0), ledger());
ok('auditoría: intento con openai registra provider openai', ledger().some((l) => l.blocked && l.provider === 'openai'));

// no_openai: OpenAI bloqueado aunque se pida; elevenlabs/gemini sin clave → falla sin tocar OpenAI
c = await call('framaly_generate_image', { prompt: 'x', provider: 'openai' }, TN); ok('no_openai bloquea provider=openai', c.isError && /OpenAI está bloqueado/.test(c.v), c.v);
c = await call('framaly_generate_voice', { text: 'hola', provider: 'openai' }, TN); ok('no_openai bloquea voz openai', c.isError && /OpenAI está bloqueado/.test(c.v), c.v);
c = await call('framaly_generate_image', { prompt: 'x' }, TN); ok('no_openai sin proveedor alterno: error claro, sin caer en OpenAI', c.isError && !/api\.openai/.test(JSON.stringify(calls)), c.v);
c = await call('framaly_write_script', { topic: 'faros' }, TN); ok('no_openai: el guion tampoco cae en OpenAI', c.isError === true, c.v);
ok('D: sigue sin haber llamadas a OpenAI', openaiCalls() === o0);

// A: proyecto con imagen externa (url) ; B: narración mp3 externa ; C: varias escenas
const PX = 'https://files.oaiusercontent.com/';
c = await call('framaly_create_video_project', { title: 'Prueba A', image_urls: [PX + 'a.png'] }, TX);
ok('A: proyecto con una imagen externa (sin voz, sin generar)', !c.isError && c.v.escenas === 1 && c.v.modo === 'external' && DB.tables.framaly_projects.length >= 1, c.v);
const pA = DB.tables.framaly_projects.find((p) => p.id === c.v.project_id);
ok('A: la imagen quedó registrada en la biblioteca y asignada al clip', pA && DB.tables.framaly_media.some((m) => m.id === pA.data.clips[0].mediaId && m.type === 'image') && pA.data.meta.exec_mode === 'external');
c = await call('framaly_create_video_project', { title: 'Prueba A', image_urls: [PX + 'a.png'] }, TX);
ok('anti-duplicado: repetir la llamada no crea otro proyecto', c.v.duplicado === true && DB.tables.framaly_projects.filter((p) => p.data.name === 'Prueba A').length === 1, c.v);
c = await call('framaly_create_video_project', { title: 'Prueba B', scenes: [{ narration: 'Hola', image_url: PX + 'b.png', voice_url: PX + 'voz.mp3' }] }, TX);
ok('B: narración MP3 externa incorporada como voz de la escena', !c.isError && c.v.con_voz === true && c.v.duracion_segundos >= 2.5, c.v);
const pB = DB.tables.framaly_projects.find((p) => p.id === c.v.project_id);
ok('B: audio de voz del proyecto apunta a un audio de la biblioteca', pB.data.audio.some((a) => a.kind === 'voz' && DB.tables.framaly_media.some((m) => m.id === a.mediaId && m.type === 'audio')));
c = await call('framaly_create_video_project', { title: 'Prueba C', scenes: [
  { narration: 'Uno', image_url: PX + 'c1.png', voice_url: PX + 'voz1.wav', sfx_url: PX + 'voz2.wav', sfx_offset: 0.5, sfx_volume: 0.6 },
  { narration: 'Dos', image_url: PX + 'c2.png?x=2', voice_url: PX + 'voz2.wav' },
  { narration: 'Tres', image_url: PX + 'c3.png?x=3', voice_url: PX + 'voz.mp3' }], music_url: PX + 'musica.wav', aspect: '9:16' }, TX);
ok('C: proyecto con 3 escenas, voz, efecto y música', !c.isError && c.v.escenas === 3 && c.v.con_voz && c.v.con_efectos && c.v.con_musica, c.v);
const pC = DB.tables.framaly_projects.find((p) => p.id === c.v.project_id);
ok('C: orden y correspondencia imagen↔voz por escena', pC.data.clips.length === 3 && pC.data.audio.filter((a) => a.kind === 'voz').length === 3 && pC.data.audio.filter((a) => a.kind === 'voz').every((a, i) => a.start >= pC.data.clips.slice(0, i).reduce((s, x) => s + x.duration, 0)), pC.data);
ok('C: efecto dentro de su escena (a +0.5 s) con volumen 0.6; música en bucle a 0.18', pC.data.audio.some((a) => a.kind === 'efecto' && a.start === 0.5 && a.volume === 0.6) && pC.data.audio.some((a) => a.kind === 'musica' && a.loop && a.volume === 0.18), pC.data.audio);
ok('C: formato 9:16 y duración = suma de clips', pC.data.aspect === '9:16' && Math.abs(c.v.duracion_segundos - pC.data.clips.reduce((s, x) => s + x.duration, 0)) < 0.11);
c = await call('framaly_create_video_project', { title: 'Sin imagen', scenes: [{ narration: 'x', image_prompt: 'un faro' }] }, TX);
ok('externo: falta imagen → error que pide el recurso, no genera', c.isError && /faltan las imágenes de las escenas 1/.test(c.v) && openaiCalls() === o0, c.v);
c = await call('framaly_create_video_project', { title: 'Sin voz', scenes: [{ narration: 'Hola', image_url: PX + 'v.png?x=9' }] }, TX);
ok('externo: falta la voz → proyecto creado + advertencia, sin generar', !c.isError && c.v.con_voz === false && c.v.advertencias.length === 1 && openaiCalls() === o0, c.v);
c = await call('framaly_create_video_project', { title: 'Voz obligatoria', voice: true, scenes: [{ narration: 'Hola', image_url: PX + 'v.png?x=9' }] }, TX);
ok('externo + voice:true sin audio → error', c.isError && /faltan los audios/.test(c.v), c.v);

// subida directa en base64 (PNG, MP3, WAV) y deduplicación
const b64 = (u8) => Buffer.from(u8).toString('base64');
c = await call('framaly_upload_media', { type: 'image', data_base64: b64(PNG), name: 'faro' }, TX);
ok('subir PNG en base64', !c.isError && c.v.mime === 'image/png' && DB.tables.framaly_media.some((m) => m.id === c.v.media_id), c.v);
const up1 = c.v.media_id;
c = await call('framaly_upload_media', { type: 'image', data_base64: 'data:image/png;base64,' + b64(PNG) }, TX);
ok('subir el mismo archivo no lo duplica', c.v.media_id === up1 && c.v.duplicado === true, c.v);
c = await call('framaly_upload_media', { type: 'audio', data_base64: b64(mp3) }, TX); ok('subir MP3', !c.isError && c.v.mime.includes('audio') && c.v.duracion_segundos > 1, c.v);
c = await call('framaly_upload_media', { type: 'audio', data_base64: b64(wavB(3)) }, TX); ok('subir WAV (3 s)', !c.isError && Math.abs(c.v.duracion_segundos - 3) < 0.05, c.v);
c = await call('framaly_upload_media', { type: 'image', data_base64: b64(new TextEncoder().encode('<html>hola</html>')) }, TX); ok('rechaza archivo que no es imagen', c.isError && /no es una imagen/.test(c.v), c.v);
c = await call('framaly_upload_media', { type: 'audio', data_base64: b64(PNG) }, TX); ok('rechaza imagen enviada como audio', c.isError && /no es un audio/.test(c.v), c.v);
c = await call('framaly_upload_media', { type: 'image', data_base64: '@@@no-base64@@@' }, TX); ok('rechaza base64 inválido', c.isError, c.v);
c = await call('framaly_create_video_project', { title: 'Con subidas', scenes: [{ narration: 'x', image_media_id: up1, voice_media_id: (await call('framaly_upload_media', { type: 'audio', data_base64: b64(wavB(3)) }, TX)).v.media_id }] }, TX);
ok('reutilizar archivos subidos por media_id en otro proyecto', !c.isError && c.v.con_voz, c.v);

// F (lógica): ninguna llamada de generación; todo con consumo cero de proveedores
ok('E: tras todas las pruebas externas, framaly_usage no cambió', usage() === u0);
ok('auditoría: importaciones registradas como provider externo, coste 0', ledger().filter((l) => l.kind === 'importacion').length >= 6 && ledger().filter((l) => l.kind === 'importacion').every((l) => l.provider === 'externo' && Number(l.cost_usd) === 0));
ok('auditoría: montajes con proyecto asociado', ledger().filter((l) => l.kind === 'montaje').every((l) => l.project_id && l.mode === 'external') && ledger().filter((l) => l.kind === 'montaje').length >= 4);

// modo all sigue funcionando como antes (genera con OpenAI y lo audita con coste)
c = await call('framaly_generate_image', { prompt: 'un faro', provider: 'openai' }, TOKEN);
ok('modo all: genera con OpenAI y lo registra en el libro con coste > 0', !c.isError && openaiCalls() === o0 + 1 && ledger().some((l) => l.provider === 'openai' && !l.blocked && Number(l.cost_usd) > 0 && l.mode === 'all' && l.kind === 'imagen'), c.v);
// una clave con exec_mode raro
DB.tokens[await sha('fmk_' + '07'.repeat(24))] = { token_id: 'tkz', user_id: 'u_ana', scopes: ['read', 'write'], name: 'raro', exec_mode: 'cualquier-cosa' };
c = await call('framaly_generate_image', { prompt: 'x' }, 'fmk_' + '07'.repeat(24)); ok('modo desconocido → se trata como externo', c.isError && /Modo ChatGPT externo/.test(c.v), c.v);
console.log(bad ? `\n${bad} FALLOS` : '\nTODO OK'); process.exit(bad ? 1 : 0);
