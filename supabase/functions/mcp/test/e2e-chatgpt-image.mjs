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

// ===== Transferencia de imágenes ChatGPT → FRAMALY (solo imágenes) =====
const TX = 'fmk_' + 'ab'.repeat(24);
DB.tokens[await sha(TX)] = { token_id: 'tkc', user_id: 'u_ana', scopes: ['read', 'write'], name: 'ChatGPT', exec_mode: 'external' };
const openaiCalls = () => calls.filter((c) => c.includes('api.openai.com')).length, usage = () => DB.tables.framaly_usage.length;
const o0 = openaiCalls(), u0 = usage();
const F = 'https://files.oaiusercontent.com/';
// formas reales en las que ChatGPT puede entregar el archivo
let c = await call('framaly_import_image', { image: { download_url: F + 'caballo.png', file_id: 'file-abc123' }, name: 'caballo_volador_andes.png' }, TX);
ok('MCP: campo image {download_url, file_id} (la forma que antes fallaba)', !c.isError && c.v.success === true && c.v.provider === 'chatgpt_external' && c.v.stored_in_library === true && c.v.credits_consumed === 0, c.v);
ok('resultado: media.id real, type image, mime image/png, nombre pedido', c.v.media.id && c.v.media.type === 'image' && c.v.media.mime_type === 'image/png' && c.v.media.name === 'caballo_volador_andes.png', c.v.media);
const id1 = c.v.media.id;
ok('la imagen quedó en framaly_media y su archivo en Storage', DB.tables.framaly_media.some((m) => m.id === id1 && m.type === 'image' && m.mime === 'image/png') && Object.keys(DB.storage).some((k) => k.endsWith('/' + id1)));
c = await call('framaly_list_media', { type: 'image' }, TX);
ok('framaly_list_media la muestra (id, nombre, mime_type, size_bytes)', c.v.archivos.some((m) => m.id === id1 && m.nombre === 'caballo_volador_andes.png' && m.mime_type === 'image/png' && m.size_bytes > 0), c.v);
c = await call('framaly_import_image', { images: [{ download_url: F + 'a1.png?x=1', file_id: 'file-1', name: 'uno.png' }, { download_url: F + 'a2.png?x=2', file_id: 'file-2', name: 'dos.png' }] }, TX);
ok('varias imágenes en images[] conservan nombre y orden', !c.isError && c.v.images.length === 2 && c.v.images[0].name === 'uno.png' && c.v.images[1].name === 'dos.png', c.v);
c = await call('framaly_import_image', { openaiFileIdRefs: [{ name: 'viejo.png', id: 'file-9', mime_type: 'image/png', download_link: F + 'v.png?x=3' }] }, TX);
ok('formato anterior (download_link) sigue funcionando', !c.isError && c.v.media.name === 'viejo.png', c.v);
c = await call('framaly_import_image', { openaiFileIdRefs: [{ name: 'otro.png', id: 'file-8', mime_type: 'image/png', download_url: F + 'o.png?x=4' }] }, TX);
ok('openaiFileIdRefs con download_url también (causa del fallo real)', !c.isError && c.v.media.name === 'otro.png', c.v);
c = await call('framaly_import_image', { image: { download_url: F + 'caballo.png', file_id: 'file-abc123' } }, TX);
ok('la misma imagen no se duplica (mismo media_id)', c.v.media.id === id1 && c.v.media.duplicate === true, c.v);
// errores reales, sin inventar
c = await call('framaly_import_image', { image: { file_id: 'file-solo-id' } }, TX);
ok('sin download_url: error real que dice qué se recibió (sin mostrar enlaces)', c.isError && /Recibí: image=objeto\{file_id\}/.test(c.v), c.v);
c = await call('framaly_import_image', { image: { download_url: 'https://evil.example.com/x.png', file_id: 'f' } }, TX);
ok('archivo que no es imagen → error claro', c.isError && /no es una imagen/.test(c.v), c.v);
c = await call('framaly_import_image', { image: { download_url: 'https://gone.example.com/x.png', file_id: 'f' } }, TX);
ok('enlace vencido (403) → informa el error real', c.isError && /403/.test(c.v), c.v);
c = await call('framaly_import_image', { image: { download_url: 'https://big.example.com/x.png', file_id: 'f' } }, TX);
ok('imagen demasiado grande → rechazada', c.isError && /pesa más/.test(c.v), c.v);
c = await call('framaly_import_image', { image: { download_url: 'http://files.oaiusercontent.com/x.png', file_id: 'f' } }, TX);
ok('http (no https) → rechazada', c.isError, c.v);
// descriptor MCP: ChatGPT necesita _meta["openai/fileParams"] para entregar archivos
let r = await rpc('tools/list', {}, TX); const t = r.body.result.tools.find((x) => x.name === 'framaly_import_image');
ok('tools/list declara _meta["openai/fileParams"] = [image]', JSON.stringify(t._meta?.['openai/fileParams']) === '["image"]' && t.inputSchema.properties.image.properties.download_url , t);
// subida base64 y formato de resultado
const b64 = (u8) => Buffer.from(u8).toString('base64');
c = await call('framaly_upload_media', { type: 'image', name: 'b64.png', data_base64: b64(PNG) }, TX);
ok('upload base64 con el mismo formato de resultado', !c.isError && c.v.success && c.v.provider === 'chatgpt_external' && c.v.media.mime_type === 'image/png' && c.v.credits_consumed === 0, c.v);
// compatibilidad: el media_id sirve directo en un proyecto
c = await call('framaly_create_video_project', { title: 'Reutiliza imagen', scenes: [{ narration: '', image_media_id: id1 }] }, TX);
ok('media_id devuelto → scenes[].image_media_id sin volver a subir', !c.isError && c.v.escenas === 1, c.v);
const pr = DB.tables.framaly_projects.find((p) => p.id === c.v.project_id);
ok('el clip del proyecto usa exactamente ese media_id', pr.data.clips[0].mediaId === id1);

// herramienta de diagnóstico y compatibilidad con el diseño anterior
c = await call('framaly_inspect_file', { file: { download_url: F + 'insp.png', file_id: 'file-x' } }, TX);
ok('inspect_file: puede descargar, dice tipo y tamaño y NO guarda nada', !c.isError && c.v.can_download === true && c.v.detected_mime === 'image/png' && c.v.size_bytes > 0 && c.v.stored === false && c.v.credits_consumed === 0, c.v);
c = await call('framaly_inspect_file', { file: { download_url: 'https://gone.example.com/x.png' } }, TX);
ok('inspect_file: enlace vencido → can_download false con el error real (403)', !c.isError && c.v.can_download === false && /403/.test(c.v.error), c.v);
ok('inspect_file no dejó el archivo en la biblioteca', !DB.tables.framaly_media.some((m) => m.name === 'insp.png'));
c = await call('framaly_import_image', { images: [{ download_url: F + 'leg1.png?x=7', file_id: 'f' }] }, TX);
ok('compatibilidad: images[] (oculto en el esquema) se sigue aceptando', !c.isError && c.v.media.id, c.v);
c = await call('framaly_import_image', { openaiFileIdRefs: [{ name: 'viejo2.png', id: 'f', mime_type: 'image/png', download_url: F + 'leg2.png?x=8' }] }, TX);
ok('compatibilidad: openaiFileIdRefs (oculto) se sigue aceptando', !c.isError && c.v.media.name === 'viejo2.png', c.v);
r = await rpc('tools/list', {}, TX); const ti = r.body.result.tools.find((x) => x.name === 'framaly_import_image');
ok('el esquema visible para ChatGPT NO contiene openaiFileIdRefs ni images', !('openaiFileIdRefs' in ti.inputSchema.properties) && !('images' in ti.inputSchema.properties) && ti.inputSchema.properties.image.required[0] === 'download_url', ti.inputSchema);
c = await call('framaly_import_image', { cosa_rara: 1 }, TX);
ok('argumento desconocido → error que dice lo recibido', c.isError && /desconocido/.test(c.v), c.v);


// Acciones de un GPT: el esquema OpenAPI SÍ declara openaiFileIdRefs (y el MCP no)
r = await handler(new Request('https://proj.supabase.co/functions/v1/mcp/openapi.json')); const spec = await r.json();
const sch = spec.paths['/api/framaly_import_image'].post.requestBody.content['application/json'].schema;
ok('OpenAPI (Acciones) declara openaiFileIdRefs con name, id, mime_type, download_link', sch.properties.openaiFileIdRefs?.items?.properties?.download_link && sch.properties.openaiFileIdRefs.type === 'array' && Object.keys(sch.properties)[0] === 'openaiFileIdRefs', sch.properties);
ok('OpenAPI: descripciones ≤ 300 caracteres', Object.values(spec.paths).every((p) => p.post.description.length <= 300));
const act = await handler(new Request('https://proj.supabase.co/functions/v1/mcp/api/framaly_import_image', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TX }, body: JSON.stringify({ openaiFileIdRefs: [{ name: 'caballo_volador_andes.png', id: 'file-AbC', mime_type: 'image/png', download_link: F + 'accion.png?x=1' }] }) }));
const aj = await act.json();
ok('REST con el cuerpo exacto de una Acción de GPT → guardada en la biblioteca', act.status === 200 && aj.success && aj.provider === 'chatgpt_external' && aj.media.name === 'caballo_volador_andes.png' && aj.media.mime_type === 'image/png' && aj.credits_consumed === 0 && DB.tables.framaly_media.some((m) => m.id === aj.media.id), aj);

// créditos y OpenAI
ok('FRAMALY no llamó a OpenAI', openaiCalls() === o0);
ok('no se descontó nada (framaly_usage intacto)', usage() === u0);
ok('auditoría: importaciones provider externo, coste 0', DB.tables.framaly_mcp_ledger.filter((l) => l.kind === 'importacion').every((l) => l.provider === 'externo' && Number(l.cost_usd) === 0));
console.log(bad ? `\n${bad} FALLOS` : '\nTODO OK'); process.exit(bad ? 1 : 0);
