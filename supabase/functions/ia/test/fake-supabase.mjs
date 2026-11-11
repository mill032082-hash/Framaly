// Supabase de mentira en memoria, solo para probar la lógica de la función «ia»
export const DB = (globalThis.__DB ??= { tables: { framaly_access: [], framaly_usage: [], framaly_errors: [], framaly_limits: [], framaly_notifications: [], framaly_balance: [] }, users: {} });
const get = (row, k) => (k.includes('->') ? k.split(/->>?/).reduce((o, x) => (o == null ? o : o[x]), row) : row[k]);
class Q {
  constructor(t) { this.t = t; this.f = []; }
  select() { return this; } eq(k, v) { this.f.push([k, v]); return this; } limit(n) { this.l = n; return this; } maybeSingle() { this.single = true; return this; }
  insert(r) { this.ins = r; return this; } upsert(r) { this.ins = r; return this; }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
  run() {
    const rows = (DB.tables[this.t] ??= []);
    if (this.ins) { rows.push({ id: rows.length + 1, ...this.ins }); return { data: null, error: null }; }
    let out = rows.filter((r) => this.f.every(([k, v]) => get(r, k) === v)); if (this.l) out = out.slice(0, this.l);
    return this.single ? { data: out[0] ?? null, error: null } : { data: out, error: null };
  }
}
export const createClient = () => ({
  auth: { getUser: async (t) => (DB.users[t] ? { data: { user: { id: DB.users[t] } }, error: null } : { data: null, error: { message: 'no' } }) },
  from: (t) => new Q(t),
  rpc: async (n, a) => (n === 'framaly_get_secret' ? { data: 'CLAVE-' + a.p_provider } : n === 'framaly_cost_sum' ? { data: DB.tables.framaly_usage.filter((r) => (!a.p_provider || r.provider === a.p_provider) && (!a.p_user || r.user_id === a.p_user)).reduce((s, r) => s + r.cost_usd, 0) } : { data: null }),
});
