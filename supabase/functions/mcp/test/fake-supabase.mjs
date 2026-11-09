// Supabase de mentira en memoria, solo para probar la lógica del servidor
export const DB = globalThis.__DB ??= { tables: { framaly_access: [], framaly_media: [], framaly_projects: [], framaly_api_calls: [], framaly_usage: [], framaly_errors: [], framaly_limits: [], framaly_notifications: [] }, storage: {}, tokens: {}, secrets: {} };
const match = (row, f) => f.every(([op, k, v]) => op === 'eq' ? row[k] === v : op === 'gte' ? String(row[k]) >= String(v) : op === 'in' ? v.includes(row[k]) : true);
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
    if (n === 'framaly_token_auth') return { data: DB.tokens[a.p_hash] ?? null, error: null };
    if (n === 'framaly_get_secret') return { data: DB.secrets[a.p_provider] ?? null, error: null };
    if (n === 'framaly_cost_sum') { const s = DB.tables.framaly_usage.filter((u) => (!a.p_user || u.user_id === a.p_user) && (!a.p_provider || u.provider === a.p_provider)).reduce((x, u) => x + u.cost_usd, 0); return { data: s, error: null }; }
    return { data: null, error: { message: 'rpc ' + n } };
  },
  storage: { from: (b) => ({
    upload: async (p, bytes, o) => { DB.storage[b + '/' + p] = { size: bytes.length, type: o?.contentType }; return { data: {}, error: null }; },
    createSignedUrl: async (p) => ({ data: { signedUrl: 'https://signed.example/' + p + '?t=1' }, error: null }),
  }) },
});
