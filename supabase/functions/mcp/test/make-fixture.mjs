// Crea, con el servidor MCP real (modo externo), un proyecto con archivos de verdad y lo guarda en FX_DIR/fixture.json
// para exportarlo después en un navegador (Prueba F). Uso: FX_DIR=/tmp/fx node make-fixture.mjs
import { DB } from './fake-supabase.mjs';
import { webcrypto } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const FX = process.env.FX_DIR || '/tmp/fx';
let handler = null; const env = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
const sha = async (s) => [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
let openai = 0;
globalThis.fetch = async (url) => {
  const u = String(url); if (u.includes('api.openai.com')) openai++;
  const m = u.match(/^https:\/\/files\.oaiusercontent\.com\/([a-z0-9]+\.(png|wav))/);
  if (m) return new Response(readFileSync(`${FX}/${m[1]}`), { status: 200, headers: { 'content-type': m[2] === 'png' ? 'image/png' : 'audio/wav' } });
  return new Response('{}', { status: 404 });
};
await import('/tmp/mcpe2e/bundle.mjs');
const T = 'fmk_' + '9a'.repeat(24);
DB.tokens[await sha(T)] = { token_id: 'tkf', user_id: 'u_ana', scopes: ['read', 'write'], name: 'ChatGPT', exec_mode: 'external' };
DB.tables.framaly_access.push({ user_id: 'u_ana', email: 'ana@x.com', status: 'approved', role: 'user', perms: {}, ai: { openai: 'shared' }, daily_usd: 5 });
DB.secrets.openai = 'sk-server-key';
const call = async (name, args) => { const r = await handler(new Request('https://proj.supabase.co/functions/v1/mcp/api/' + name, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + T }, body: JSON.stringify(args) })); return { s: r.status, v: await r.json() }; };
const P = 'https://files.oaiusercontent.com/';
const r = await call('framaly_create_video_project', { title: 'Faros del mundo', aspect: '16:9', music_url: P + 'musica.wav', scenes: [
  { narration: 'Los faros guían a los barcos.', image_url: P + 'a.png', voice_url: P + 'voz1.wav', sfx_url: P + 'sfx.wav', sfx_offset: 0.3, on_screen_text: 'Faros' },
  { narration: 'Cada uno tiene su historia.', image_url: P + 'b.png', voice_url: P + 'voz2.wav' },
  { narration: 'Gracias por ver.', image_url: P + 'c.png', voice_url: P + 'voz3.wav' }] });
if (r.s !== 200) { console.error('FALLO', r); process.exit(1); }
const proj = DB.tables.framaly_projects.find((p) => p.id === r.v.project_id).data;
const ids = new Set([...proj.clips.map((c) => c.mediaId), ...proj.audio.map((a) => a.mediaId)]);
const media = DB.tables.framaly_media.filter((m) => ids.has(m.id)).map((m) => ({ id: m.id, type: m.type, name: m.name, mime: m.mime, duration: m.duration, b64: Buffer.from(DB.storage['framaly-media/' + m.user_id + '/' + m.id].bytes).toString('base64') }));
writeFileSync(`${FX}/fixture.json`, JSON.stringify({ project: proj, media, openaiCalls: openai, usageRows: DB.tables.framaly_usage.length, result: r.v }));
console.log('fixture ok:', r.v.escenas, 'escenas,', r.v.duracion_segundos, 's,', media.length, 'archivos · llamadas a OpenAI:', openai);
