// Supabase de mentira en memoria, solo para probar la lógica del servidor
export const DB = globalThis.__DB ??= { tables: { framaly_access: [], framaly_media: [], framaly_projects: [], framaly_api_calls: [], framaly_usage: [], framaly_errors: [], framaly_limits: [], framaly_notifications: [], framaly_mcp_ledger: [] }, storage: {}, tokens: {}, secrets: {} };
const get = (row, k) => k.includes('->') ? k.split(/->>?/).reduce((o, x) => (o == null ? o : o[x]), row) : row[k];
const match = (row, f) => f.every(([op, k, v]) => op === 'eq' ? get(row, k) === v : op === 'gte' ? String(row[k]) >= String(v) : op === 'in' ? v.includes(row[k]) : true);
class Q {
  constructor(t) { this.t = t; this.f = []; this.o = null; this.l = null; this.cnt = false; this.head = false; this.ins = null; this.single = false; }
  select(_c, opts) { if (opts?.count) { this.cnt = true; this.head = !!opts.head; } return this; }
  eq(k, v) { this.f.push(['eq', k, v]); return this; } gte(k, v) { this.f.push(['gte', k, v]); return this; } in(k, v) { this.f.push(['in', k, v]); return this; }
  order(k, o) { this.o = [k, o?.ascending !== false]; return this; } limit(n) { this.l = n; return this; }
  maybeSingle() { this.single = true; return this; }
  insert(r) { this.ins = r; return this; } upsert(r) { this.ins = r; return this; }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
  run() {
    const rows = DB.tables[this.t] ??= [];
    if (this.ins) { const list = Array.isArray(this.ins) ? this.ins : [this.ins]; list.forEach((r) => rows.push({ created_at: new Date().toISOString(), id: r.id ?? rows.length + 1, ...r })); return { data: null, error: null }; }
    let out = rows.filter((r) => match(r, this.f));
    if (this.o) out = [...out].sort((a, b) => (a[this.o[0]] > b[this.o[0]] ? 1 : -1) * (this.o[1] ? 1 : -1));
    if (this.l) out = out.slice(0, this.l);
    if (this.cnt) return { count: out.length, data: this.head ? null : out, error: null };
    if (this.single) return { data: out[0] ?? null, error: null };
    return { data: out, error: null };
  }
}
export const createClient = () => ({
  from: (t) => new Q(t),
  rpc: async (n, a) => {
    if (n === 'framaly_token_auth') { const t = DB.tokens[a.p_hash]; if (!t) return { data: null, error: null }; if (t.expires_at && new Date(t.expires_at) < new Date()) return { data: null, error: null }; if (t.grant_id && DB.oauth.grants.find((g) => g.id === t.grant_id)?.revoked_at) return { data: null, error: null }; return { data: t, error: null }; }
    const O = (DB.oauth ??= { clients: [], requests: [], codes: [], grants: [], refresh: [] }), sha = async (x) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)))].map((b) => b.toString(16).padStart(2, '0')).join(''), uid = () => crypto.randomUUID();
    if (n === 'framaly_oauth_register') { const id = 'fmc_' + uid().replace(/-/g, '').slice(0, 24); O.clients.push({ client_id: id, client_name: a.p_name, redirect_uris: a.p_redirects }); return { data: id, error: null }; }
    if (n === 'framaly_oauth_client') return { data: O.clients.find((c) => c.client_id === a.p_id) ?? null, error: null };
    if (n === 'framaly_oauth_start') { const c = O.clients.find((x) => x.client_id === a.p_client && x.redirect_uris.includes(a.p_redirect)); if (!c) return { data: null, error: { message: 'client' } }; const id = uid(); O.requests.push({ id, client_id: a.p_client, redirect_uri: a.p_redirect, code_challenge: a.p_challenge, state: a.p_state, scope: a.p_scope }); return { data: id, error: null }; }
    if (n === 'framaly_oauth_exchange') { const c = O.codes.find((x) => x.code_hash === a.p_code_hash); if (c && !c.used_at && new Date(c.expires_at) > new Date() && c.client_id === a.p_client && c.redirect_uri === a.p_redirect) { c.used_at = new Date().toISOString(); return { data: { user_id: c.user_id, code_challenge: c.code_challenge, scope: c.scope }, error: null }; } if (c && c.used_at) O.grants.filter((g) => g.client_id === a.p_client && g.user_id === c.user_id).forEach((g) => (g.revoked_at = new Date().toISOString())); return { data: null, error: null }; }
    if (n === 'framaly_oauth_issue') { let g = O.grants.filter((x) => x.user_id === a.p_user && x.client_id === a.p_client && !x.revoked_at).pop(); if (!g) { g = { id: uid(), user_id: a.p_user, client_id: a.p_client }; O.grants.push(g); } DB.tokens[a.p_access_hash] = { token_id: 'o' + uid().slice(0, 6), user_id: a.p_user, scopes: ['read', 'write'], name: 'oauth', grant_id: g.id, expires_at: new Date(Date.now() + a.p_ttl * 1000).toISOString() }; O.refresh.push({ token_hash: a.p_refresh_hash, grant_id: g.id, client_id: a.p_client, user_id: a.p_user }); return { data: { grant_id: g.id }, error: null }; }
    if (n === 'framaly_oauth_refresh') { const r = O.refresh.find((x) => x.token_hash === a.p_old_hash && x.client_id === a.p_client); if (!r) return { data: null, error: null }; const g = O.grants.find((x) => x.id === r.grant_id); if (r.used_at) { if (g) g.revoked_at = new Date().toISOString(); return { data: null, error: null }; } if (g?.revoked_at) return { data: null, error: null }; r.used_at = new Date().toISOString(); DB.tokens[a.p_access_hash] = { token_id: 'o' + uid().slice(0, 6), user_id: r.user_id, scopes: ['read', 'write'], name: 'oauth', grant_id: r.grant_id, expires_at: new Date(Date.now() + a.p_ttl * 1000).toISOString() }; O.refresh.push({ token_hash: a.p_refresh_hash, grant_id: r.grant_id, client_id: a.p_client, user_id: r.user_id }); return { data: { grant_id: r.grant_id }, error: null }; }
    if (n === 'test_decide') { const q = O.requests.find((x) => x.id === a.id); const code = uid().replace(/-/g, '') + uid().replace(/-/g, ''); O.codes.push({ code_hash: await sha(code), client_id: q.client_id, user_id: a.user, redirect_uri: q.redirect_uri, code_challenge: q.code_challenge, scope: q.scope, expires_at: new Date(Date.now() + (a.expired ? -1000 : 300000)).toISOString() }); return { data: { code, state: q.state }, error: null }; }

    if (n === 'framaly_get_secret') return { data: DB.secrets[a.p_provider] ?? null, error: null };
    if (n === 'framaly_cost_sum') { const s = DB.tables.framaly_usage.filter((u) => (!a.p_user || u.user_id === a.p_user) && (!a.p_provider || u.provider === a.p_provider)).reduce((x, u) => x + u.cost_usd, 0); return { data: s, error: null }; }
    return { data: null, error: { message: 'rpc ' + n } };
  },
  storage: { from: (b) => ({
    upload: async (p, bytes, o) => { DB.storage[b + '/' + p] = { size: bytes.length, type: o?.contentType, bytes }; return { data: {}, error: null }; },
    createSignedUrl: async (p) => ({ data: { signedUrl: 'https://signed.example/' + p + '?t=1' }, error: null }),
  }) },
});
