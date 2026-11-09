// Pruebas del inicio de sesión OAuth (descubrimiento, registro, permiso, token, renovación y revocación)
import { DB } from './fake-supabase.mjs';
import { webcrypto, randomBytes, createHash } from 'node:crypto';
let handler = null; const env = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
await import('/tmp/mcpe2e/bundle.mjs');
let bad = 0; const ok = (n, c, x = '') => { console.log((c ? 'OK  ' : 'FALLO ') + n + (c ? '' : '  ' + JSON.stringify(x))); if (!c) bad++; };
const BASE = 'https://proj.supabase.co/functions/v1/mcp', REDIR = 'https://chatgpt.com/connector_platform_oauth_redirect';
DB.tables.framaly_access.push({ user_id: 'u_ana', email: 'ana@x.com', status: 'approved', role: 'user', perms: {}, ai: { openai: 'shared' }, daily_usd: 5 });
const get = (p, h = {}) => handler(new Request(BASE + p, { headers: h, redirect: 'manual' }));
const post = (p, body, type = 'application/json', h = {}) => handler(new Request(BASE + p, { method: 'POST', headers: { 'content-type': type, ...h }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const form = (o) => new URLSearchParams(o).toString();
const b64u = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const verifier = () => b64u(randomBytes(32)), challenge = (v) => b64u(createHash('sha256').update(v).digest());
const registerClient = async () => (await (await post('/register', { client_name: 'ChatGPT', redirect_uris: [REDIR] })).json());
const authorize = async (c, v, extra = {}) => get('/authorize?' + form({ response_type: 'code', client_id: c.client_id, redirect_uri: REDIR, code_challenge: challenge(v), code_challenge_method: 'S256', state: 'xyz', scope: 'framaly', ...extra }));
const approve = async (loc, user = 'u_ana', expired = false) => { const id = new URL(loc.replace('/#/', '/')).searchParams.get('req'); const r = await handler.__fake?.() ?? null; return (await (globalThis.__DB_RPC('test_decide', { id, user, expired }))).data; };
// acceso directo al RPC simulado (hace las veces de la pantalla «Permitir» de FRAMALY)
const { createClient } = await import('./fake-supabase.mjs'); const fake = createClient(); globalThis.__DB_RPC = (n, a) => fake.rpc(n, a);
const tokenReq = (o, h = {}) => post('/token', form(o), 'application/x-www-form-urlencoded', h);
const mcp = (tok, method = 'tools/list') => post('', { jsonrpc: '2.0', id: 1, method }, 'application/json', tok ? { authorization: 'Bearer ' + tok } : {});

// --- descubrimiento
let r = await get('/.well-known/oauth-protected-resource'); let j = await r.json();
ok('recurso protegido (RFC 9728)', r.status === 200 && j.resource === BASE && j.authorization_servers[0] === BASE && j.bearer_methods_supported[0] === 'header', j);
for (const p of ['/.well-known/oauth-authorization-server', '/.well-known/openid-configuration', '/.well-known/oauth-authorization-server/functions/v1/mcp']) {
  r = await get(p); j = await r.json();
  ok('metadatos del servidor: ' + p, r.status === 200 && j.issuer === BASE && j.authorization_endpoint === BASE + '/authorize' && j.token_endpoint === BASE + '/token' && j.registration_endpoint === BASE + '/register' && j.code_challenge_methods_supported.join() === 'S256' && j.grant_types_supported.includes('refresh_token'), j);
}
r = await mcp(null); ok('401 anuncia dónde está OAuth (resource_metadata)', r.status === 401 && r.headers.get('www-authenticate').includes(`resource_metadata="${BASE}/.well-known/oauth-protected-resource"`), r.headers.get('www-authenticate'));

// --- registro
r = await post('/register', { client_name: 'ChatGPT', redirect_uris: [REDIR] }); j = await r.json();
ok('registro de cliente', r.status === 201 && /^fmc_/.test(j.client_id) && j.token_endpoint_auth_method === 'none' && j.redirect_uris[0] === REDIR, j);
for (const [n, body] of [['sin redirect_uris', { client_name: 'x' }], ['http sin cifrar', { redirect_uris: ['http://evil.com/cb'] }], ['javascript:', { redirect_uris: ['javascript:alert(1)'] }], ['con fragmento', { redirect_uris: ['https://x.com/cb#a'] }], ['con credenciales', { redirect_uris: ['https://u:p@x.com/cb'] }], ['demasiadas', { redirect_uris: Array(6).fill('https://x.com/cb') }]]) {
  r = await post('/register', body); j = await r.json(); ok('registro rechaza: ' + n, r.status === 400 && j.error === 'invalid_redirect_uri', j);
}
r = await post('/register', { redirect_uris: ['http://localhost:3000/cb'] }); ok('registro acepta http://localhost (clientes de escritorio)', r.status === 201);

// --- /authorize
const c = await registerClient(); const v = verifier();
r = await authorize(c, v); let loc = r.headers.get('location');
ok('authorize → pantalla de permiso de FRAMALY', r.status === 302 && /^https:\/\/framaly\.vercel\.app\/#\/conectar\?req=[0-9a-f-]{36}$/.test(loc), loc);
r = await authorize({ client_id: 'fmc_nope' }, v); ok('cliente desconocido: error, SIN redirigir', r.status === 400 && !r.headers.get('location') && (await r.json()).error === 'invalid_request');
r = await get('/authorize?' + form({ response_type: 'code', client_id: c.client_id, redirect_uri: 'https://evil.com/steal', code_challenge: challenge(v), code_challenge_method: 'S256' })); ok('redirect_uri distinta: error, SIN redirigir', r.status === 400 && !r.headers.get('location'));
r = await authorize(c, v, { code_challenge: undefined }); ok('sin PKCE: vuelve con error', r.status === 302 && new URL(r.headers.get('location')).searchParams.get('error') === 'invalid_request' && new URL(r.headers.get('location')).searchParams.get('state') === 'xyz', r.headers.get('location'));
r = await authorize(c, v, { code_challenge_method: 'plain' }); ok('PKCE «plain» rechazado', r.status === 302 && new URL(r.headers.get('location')).searchParams.get('error') === 'invalid_request');
r = await authorize(c, v, { response_type: 'token' }); ok('flujo implícito rechazado', r.status === 302 && new URL(r.headers.get('location')).searchParams.get('error') === 'unsupported_response_type');

// --- flujo completo
const v2 = verifier(); r = await authorize(c, v2); const req2 = new URL(r.headers.get('location').replace('/#/', '/')).searchParams.get('req');
let code = (await fake.rpc('test_decide', { id: req2, user: 'u_ana' })).data.code;
r = await tokenReq({ grant_type: 'authorization_code', code, redirect_uri: REDIR, client_id: c.client_id, code_verifier: v2 }); j = await r.json();
ok('canje de código por tokens', r.status === 200 && /^fmk_[0-9a-f]{48}$/.test(j.access_token) && /^fmr_[0-9a-f]{48}$/.test(j.refresh_token) && j.token_type === 'Bearer' && j.expires_in === 3600 && r.headers.get('cache-control') === 'no-store', j);
const T1 = j.access_token, R1 = j.refresh_token;
r = await mcp(T1); j = await r.json(); ok('el token de acceso abre el MCP (13 herramientas)', r.status === 200 && j.result.tools.length === 13, j);
r = await mcp(T1, 'initialize'); ok('initialize con token OAuth', (await r.json()).result.serverInfo.name === 'framaly');
r = await tokenReq({ grant_type: 'authorization_code', code, redirect_uri: REDIR, client_id: c.client_id, code_verifier: v2 }); j = await r.json();
ok('un código usado no sirve otra vez', r.status === 400 && j.error === 'invalid_grant', j);
r = await mcp(T1); ok('…y reutilizarlo revoca lo que nació de él', r.status === 401);

// --- PKCE y validaciones
const v3 = verifier(); r = await authorize(c, v3); const req3 = new URL(r.headers.get('location').replace('/#/', '/')).searchParams.get('req'); const code3 = (await fake.rpc('test_decide', { id: req3, user: 'u_ana' })).data.code;
r = await tokenReq({ grant_type: 'authorization_code', code: code3, redirect_uri: REDIR, client_id: c.client_id, code_verifier: verifier() }); j = await r.json(); ok('verificador PKCE incorrecto → invalid_grant', r.status === 400 && j.error === 'invalid_grant', j);
const v4 = verifier(); r = await authorize(c, v4); const code4 = (await fake.rpc('test_decide', { id: new URL(r.headers.get('location').replace('/#/', '/')).searchParams.get('req'), user: 'u_ana' })).data.code;
r = await tokenReq({ grant_type: 'authorization_code', code: code4, redirect_uri: 'https://otra.com/cb', client_id: c.client_id, code_verifier: v4 }); ok('redirect_uri distinta al canjear → invalid_grant', r.status === 400);
r = await tokenReq({ grant_type: 'authorization_code', code: code4, redirect_uri: REDIR, client_id: 'fmc_otro', code_verifier: v4 }); ok('cliente distinto al canjear → invalid_grant', r.status === 400);
const v5 = verifier(); r = await authorize(c, v5); const code5 = (await fake.rpc('test_decide', { id: new URL(r.headers.get('location').replace('/#/', '/')).searchParams.get('req'), user: 'u_ana', expired: true })).data.code;
r = await tokenReq({ grant_type: 'authorization_code', code: code5, redirect_uri: REDIR, client_id: c.client_id, code_verifier: v5 }); ok('código vencido → invalid_grant', r.status === 400);
r = await tokenReq({ grant_type: 'authorization_code', code: 'x', redirect_uri: REDIR, client_id: c.client_id, code_verifier: 'corto' }); ok('verificador demasiado corto → invalid_request', (await r.json()).error === 'invalid_request');
r = await tokenReq({ grant_type: 'password', client_id: c.client_id }); ok('grant_type no soportado', (await r.json()).error === 'unsupported_grant_type');
r = await tokenReq({ grant_type: 'authorization_code' }); ok('sin client_id → invalid_client (401)', r.status === 401);

// --- formularios, JSON y Basic
const v6 = verifier(); r = await authorize(c, v6); const code6 = (await fake.rpc('test_decide', { id: new URL(r.headers.get('location').replace('/#/', '/')).searchParams.get('req'), user: 'u_ana' })).data.code;
r = await post('/token', { grant_type: 'authorization_code', code: code6, redirect_uri: REDIR, code_verifier: v6 }, 'application/json', { authorization: 'Basic ' + Buffer.from(c.client_id + ':').toString('base64') }); j = await r.json();
ok('token con cuerpo JSON y cliente en cabecera Basic', r.status === 200 && j.access_token, j);
const T2 = j.access_token, R2 = j.refresh_token;

// --- renovación
r = await tokenReq({ grant_type: 'refresh_token', refresh_token: R2, client_id: c.client_id }); j = await r.json();
ok('renovar con el token de renovación', r.status === 200 && j.access_token !== T2 && j.refresh_token !== R2, j);
const T3 = j.access_token, R3 = j.refresh_token;
r = await mcp(T3); ok('el token nuevo funciona', r.status === 200);
r = await tokenReq({ grant_type: 'refresh_token', refresh_token: R2, client_id: c.client_id }); ok('el token de renovación viejo ya no sirve (se rota)', r.status === 400 && (await r.json()).error === 'invalid_grant');
r = await mcp(T3); ok('…y reutilizarlo revoca el permiso entero', r.status === 401);
r = await tokenReq({ grant_type: 'refresh_token', refresh_token: R3, client_id: c.client_id }); ok('el permiso revocado no se puede renovar', r.status === 400);
r = await tokenReq({ grant_type: 'refresh_token', refresh_token: 'fmr_nope', client_id: c.client_id }); ok('token de renovación con mal formato', r.status === 400);

// --- vencimiento y revocación por la persona
const v7 = verifier(); r = await authorize(c, v7); const code7 = (await fake.rpc('test_decide', { id: new URL(r.headers.get('location').replace('/#/', '/')).searchParams.get('req'), user: 'u_ana' })).data.code;
r = await tokenReq({ grant_type: 'authorization_code', code: code7, redirect_uri: REDIR, client_id: c.client_id, code_verifier: v7 }); j = await r.json(); const T7 = j.access_token;
r = await mcp(T7); ok('nuevo permiso funciona', r.status === 200);
const hash = createHash('sha256').update(T7).digest('hex'); DB.tokens[hash].expires_at = new Date(Date.now() - 1000).toISOString();
r = await mcp(T7); ok('un token de acceso vencido da 401', r.status === 401);
DB.tokens[hash].expires_at = new Date(Date.now() + 3600e3).toISOString(); r = await mcp(T7); ok('(vigente otra vez)', r.status === 200);
DB.oauth.grants.forEach((g) => { if (g.id === DB.tokens[hash].grant_id) g.revoked_at = new Date().toISOString(); }); r = await mcp(T7); ok('revocar «Aplicaciones conectadas» corta el acceso al instante', r.status === 401);

// --- no se mezclan con las claves manuales ni se aceptan inventadas
r = await mcp('fmk_' + 'ab'.repeat(24)); ok('token inventado → 401', r.status === 401);
console.log(bad ? `\n${bad} FALLOS` : '\nTODO OK'); process.exit(bad ? 1 : 0);
