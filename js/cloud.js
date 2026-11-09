/* FRAMALY — conector de nube con Supabase: cuenta, sincronización de proyectos y biblioteca.
   Lo local (IndexedDB) sigue siendo la fuente de verdad; la nube es una copia que une tus dispositivos.
   Las API keys de OpenAI/Claude/ElevenLabs NO se suben nunca. */
(function () {
  'use strict';
  const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  const BUCKET = 'framaly-media';
  const C = F.settings.cloud;
  const LS_LAST = 'framaly.cloud.last', LS_UID = 'framaly.cloud.uid';
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; };

  const st = (F.cloud = {
    status: 'off', // off | signedout | idle | syncing | error
    user: null, error: '', progress: '', last: Number(ls(LS_LAST)) || 0,
    access: null, pendingCount: 0, // permiso de esta persona: { status: pending|approved|blocked, role: admin|user }
  });
  const set = (p) => { Object.assign(st, p); F.emit('cloud'); };
  /* La conexión viene de js/config.js: la persona usuaria no ve ni toca nada técnico */
  const cfg = () => ({
    url: String(window.FRAMALY_CLOUD?.url || '').trim().replace(/\/+$/, ''),
    key: String(window.FRAMALY_CLOUD?.anonKey || '').trim(),
  });
  st.configured = () => { const c = cfg(); return /^https:\/\/.+/.test(c.url) && c.key.length > 20; };
  st.signedIn = () => !!st.user;
  st.google = () => !!window.FRAMALY_CLOUD?.google;

  let client = null, clientSig = '', syncing = false, applying = false, timer = null, entering = '';

  /* ---------- librería y cliente ---------- */
  function loadLib() {
    if (window.supabase?.createClient) return Promise.resolve();
    return (loadLib.p ||= new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = LIB; s.async = true;
      s.onload = () => (window.supabase?.createClient ? res() : rej(new Error('No se pudo iniciar la librería de Supabase.')));
      s.onerror = () => { loadLib.p = null; rej(new Error('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.')); };
      document.head.appendChild(s);
    }));
  }
  async function sb() {
    if (!st.configured()) throw new Error('La nube no está configurada en esta plataforma.');
    await loadLib();
    const c = cfg(), sig = c.url + '|' + c.key;
    if (client && sig === clientSig) return client;
    client = window.supabase.createClient(c.url, c.key, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'framaly.supabase.auth' },
    });
    clientSig = sig;
    client.auth.onAuthStateChange((ev, session) => {
      const u = session?.user || null;
      if (!u) { entering = ''; st.access = null; set({ user: null, status: 'signedout', error: '' }); return; }
      if (u.id === st.user?.id || u.id === entering) return;
      setTimeout(() => enter(u), 0);
    });
    return client;
  }

  /** Traduce errores técnicos a algo que el usuario pueda resolver */
  function explain(e) {
    const m = String(e?.message || e || ''), code = e?.code || '';
    if (code === '42P01' || code === 'PGRST205' || /schema cache|does not exist|relation .* not exist/i.test(m)) return 'La base de datos todavía no está preparada. Avisa a quien administra la plataforma.';
    if (/bucket not found/i.test(m)) return 'El almacenamiento de archivos todavía no está preparado. Avisa a quien administra la plataforma.';
    if (/invalid api key|invalid jwt|apikey/i.test(m)) return 'La conexión con la base de datos no está bien configurada. Avisa a quien administra la plataforma.';
    if (/framaly_access/i.test(m) && /does not exist|schema cache/i.test(m)) return 'El control de acceso todavía no está preparado. Avisa a quien administra la plataforma.';
    if (/provider is not enabled|unsupported provider/i.test(m)) return 'El acceso con Google todavía no está activado. Avisa a quien administra la plataforma.';
    if (/invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/email not confirmed/i.test(m)) return 'Confirma tu correo: te enviamos un enlace al registrarte.';
    if (/already registered|already been registered/i.test(m)) return 'Ese correo ya tiene cuenta. Usa “Entrar”.';
    if (/password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
    if (/failed to fetch|networkerror|load failed/i.test(m)) return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.';
    if (/payload too large|exceeded the maximum allowed size/i.test(m)) return 'Un archivo es demasiado grande para guardarlo en la nube.';
    return m || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }
  const fail = (e) => { console.error(e); const msg = explain(e); set({ status: st.user ? 'error' : 'signedout', error: msg, progress: '' }); throw new Error(msg); };

  /* ---------- aprobación: quién puede usar la plataforma ---------- */
  st.approved = () => st.access?.status === 'approved';
  st.isAdmin = () => st.approved() && st.access?.role === 'admin';
  /** ¿Esta persona puede usar la sección? Sin nube todo está permitido; el administrador siempre puede. */
  st.can = (section) => !st.configured() || !st.user || st.isAdmin() || st.access?.perms?.[section] !== false;
  async function loadAccess(s, uid) {
    const { data, error } = await s.from('framaly_access').select('status,role,perms').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    st.access = data || { status: 'pending', role: 'user', perms: { integraciones: false } };
  }
  /** Entra una sesión: primero se consulta su permiso, después se muestra la app */
  async function enter(u) {
    entering = u.id;
    try {
      const s = await sb(); await loadAccess(s, u.id);
      set({ user: u, status: 'idle', error: '' });
      if (st.approved()) setTimeout(() => st.sync(), 300);
    } catch (e) { st.access = null; set({ user: u, status: 'error', error: explain(e) }); }
  }
  st.recheck = async () => {
    const s = await sb(); await loadAccess(s, st.user.id); set({ error: '' });
    if (st.approved()) setTimeout(() => st.sync(), 300);
  };
  /** Solo administradores: lista de personas y sus permisos */
  st.people = async () => {
    const s = await sb();
    const { data, error } = await s.from('framaly_access').select('user_id,email,status,role,perms,created_at').order('created_at', { ascending: false });
    if (error) throw new Error(explain(error));
    const n = data.filter((p) => p.status === 'pending').length;
    if (n !== st.pendingCount) { st.pendingCount = n; F.emit('cloud'); }
    return data;
  };
  st.setPerms = async (userId, perms) => {
    const s = await sb();
    const { error } = await s.from('framaly_access').update({ perms }).eq('user_id', userId);
    if (error) throw new Error(explain(error));
  };
  st.decide = async (userId, status) => {
    const s = await sb();
    const { error } = await s.from('framaly_access').update({ status, decided_at: new Date().toISOString() }).eq('user_id', userId);
    if (error) throw new Error(explain(error));
  };

  /* ---------- cuenta ---------- */
  st.init = async () => {
    if (!st.configured()) { set({ status: 'off' }); return; }
    try {
      const s = await sb();
      const { data, error } = await s.auth.getSession();
      if (error) throw error;
      if (/[?&]code=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
      const u = data.session?.user || null;
      if (u) await enter(u); else set({ user: null, status: 'signedout', error: '' });
    } catch (e) { set({ status: 'error', error: explain(e) }); }
  };
  st.signUp = async (email, password) => {
    const s = await sb();
    const { data, error } = await s.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) return fail(error);
    if (!data.session) return 'Cuenta creada. Revisa tu correo y confirma el enlace; luego pulsa “Entrar”.';
    return 'Cuenta creada y sesión iniciada.';
  };
  st.signIn = async (email, password) => {
    const s = await sb();
    const { error } = await s.auth.signInWithPassword({ email, password });
    if (error) return fail(error);
    return 'Sesión iniciada.';
  };
  st.signInGoogle = async () => {
    const s = await sb();
    const { error } = await s.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    if (error) return fail(error);
  };
  st.signOut = async () => {
    const s = await sb();
    await s.auth.signOut();
    entering = ''; st.access = null;
    set({ user: null, status: 'signedout', progress: '' });
  };

  /* ---------- borrados pendientes ---------- */
  st.tomb = (kind, id) => {
    if (applying || !st.configured()) return;
    (C.tomb ||= []).push({ k: kind, id, t: Date.now() });
    F.saveSettings();
    schedule();
  };

  /* ---------- sincronización ---------- */
  const mTime = (m) => m.updated || m.created || 0;
  const strip = (m) => ({ id: m.id, type: m.type, name: m.name, source: m.source || 'upload', meta: m.meta || {}, size: m.size || m.blob?.size || 0, duration: m.duration ?? null, mime: m.blob?.type || '', created: m.created || 0, updated: mTime(m) });

  async function pending(s, uid) {
    const left = [];
    for (const t of C.tomb || []) {
      const now = Date.now();
      const tbl = t.k === 'projects' ? 'framaly_projects' : 'framaly_media';
      const { error } = await s.from(tbl).upsert({ user_id: uid, id: t.id, updated: now, deleted: true }, { onConflict: 'user_id,id' });
      if (error) { left.push(t); continue; }
      if (t.k === 'media') await s.storage.from(BUCKET).remove([uid + '/' + t.id]).catch(() => {});
    }
    C.tomb = left; F.saveSettings();
  }

  async function syncMedia(s, uid, log) {
    const { data: rows, error } = await s.from('framaly_media').select('*').eq('user_id', uid);
    if (error) throw error;
    const remote = new Map(rows.map((r) => [r.id, r]));
    const local = new Map(F.media.list.map((m) => [m.id, m]));
    const up = [], down = [], meta = [], drop = [];
    for (const m of local.values()) {
      const r = remote.get(m.id);
      if (!r) up.push(m);
      else if (r.deleted) { if (mTime(m) > r.updated) up.push(m); else drop.push(m); }
      else if (mTime(m) > r.updated) meta.push(m);
      else if (r.updated > mTime(m)) { m.name = r.name; m.meta = r.meta || m.meta; m.updated = r.updated; applying = true; await F.db.put('media', m); }
    }
    for (const r of remote.values()) if (!r.deleted && !local.has(r.id)) down.push(r);

    let n = 0; const total = up.length + down.length;
    const tick = (what) => { n++; set({ progress: `${what} ${n}/${total} archivo(s)…` }); };
    await F.pool(up, 3, async (m) => {
      const up1 = await s.storage.from(BUCKET).upload(uid + '/' + m.id, m.blob, { upsert: true, contentType: m.blob.type || 'application/octet-stream' });
      if (up1.error) throw up1.error;
      const { error: e2 } = await s.from('framaly_media').upsert({ user_id: uid, ...strip(m), deleted: false }, { onConflict: 'user_id,id' });
      if (e2) throw e2;
      tick('Subiendo'); log.up++;
    });
    for (const m of meta) {
      const { error: e3 } = await s.from('framaly_media').upsert({ user_id: uid, ...strip(m), deleted: false }, { onConflict: 'user_id,id' });
      if (e3) throw e3;
    }
    await F.pool(down, 3, async (r) => {
      const d = await s.storage.from(BUCKET).download(uid + '/' + r.id);
      if (d.error) throw d.error;
      const m = { id: r.id, type: r.type, name: r.name, source: r.source, meta: r.meta || {}, size: r.size, duration: r.duration ?? undefined, created: r.created, updated: r.updated, blob: d.data };
      applying = true;
      await F.db.put('media', m); F.media.list.push(m);
      tick('Bajando'); log.down++;
    });
    applying = true;
    for (const m of drop) { await F.media.remove(m.id); log.down++; }
    if (log.down || drop.length || meta.length) { F.media.list.sort((a, b) => b.created - a.created); F.emit('media'); }
  }

  async function syncProjects(s, uid, log) {
    const { data: rows, error } = await s.from('framaly_projects').select('id,updated,deleted').eq('user_id', uid);
    if (error) throw error;
    const remote = new Map(rows.map((r) => [r.id, r]));
    const local = new Map(F.projects.list.map((p) => [p.id, p]));
    const up = [], down = [], drop = [];
    for (const p of local.values()) {
      const r = remote.get(p.id);
      if (!r) up.push(p);
      else if (r.deleted) { if (p.updated > r.updated) up.push(p); else drop.push(p); }
      else if (p.updated > r.updated) up.push(p);
      else if (r.updated > p.updated) down.push(r.id);
    }
    for (const r of remote.values()) if (!r.deleted && !local.has(r.id)) down.push(r.id);

    for (const p of up) {
      const { error: e } = await s.from('framaly_projects').upsert({ user_id: uid, id: p.id, data: JSON.parse(JSON.stringify(p)), updated: p.updated, deleted: false }, { onConflict: 'user_id,id' });
      if (e) throw e;
      log.up++;
    }
    if (down.length) {
      const { data: full, error: e } = await s.from('framaly_projects').select('id,data,updated').eq('user_id', uid).in('id', down);
      if (e) throw e;
      applying = true;
      for (const r of full) { await F.db.put('projects', { ...r.data, id: r.id, updated: r.updated }); log.down++; }
    }
    applying = true;
    for (const p of drop) { await F.projects.remove(p.id); log.down++; }
    if (down.length || drop.length) { await F.projects.load(); F.emit('projects'); F.emit('project-changed', F.settings.currentProject); }
  }

  /** Sincroniza ahora. manual=true muestra errores al llamador. */
  st.sync = async ({ manual = false } = {}) => {
    if (syncing || !st.user || !st.approved()) return;
    syncing = true; clearTimeout(timer);
    const log = { up: 0, down: 0 };
    set({ status: 'syncing', error: '', progress: 'Conectando…' });
    try {
      const s = await sb();
      const uid = st.user.id;
      const prev = ls(LS_UID);
      if (prev && prev !== uid && (F.media.list.length || F.projects.list.length)) {
        syncing = false;
        const ok = await F.confirm('Datos de otra cuenta', 'Este navegador tiene proyectos y archivos que se sincronizaron con otra cuenta. Si continúas, se subirán también a esta cuenta.', 'Continuar', false);
        if (!ok) { await st.signOut(); return; }
        syncing = true;
      }
      ls(LS_UID, uid);
      await pending(s, uid);
      await syncMedia(s, uid, log);
      await syncProjects(s, uid, log);
      st.last = Date.now(); ls(LS_LAST, String(st.last));
      set({ status: 'idle', progress: '', error: '' });
      if (manual) F.toast(log.up || log.down ? `Sincronizado: ${log.up} subido(s), ${log.down} descargado(s)` : 'Todo está al día', 'ok');
    } catch (e) {
      set({ status: 'error', progress: '', error: explain(e) });
      if (manual) throw new Error(explain(e)); else console.error(e);
    } finally { syncing = false; applying = false; }
  };

  function schedule() {
    if (!st.user || !st.approved() || syncing || applying) return;
    clearTimeout(timer);
    timer = setTimeout(() => st.sync(), 5000);
  }
  F.on('projects', schedule);
  F.on('media', schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && st.user && st.approved() && Date.now() - st.last > 60000) st.sync(); });

  st.label = () => ({ off: 'Sin configurar', signedout: 'Sin sesión', idle: 'Conectado', syncing: 'Sincronizando…', error: 'Error' }[st.status]);
  st.ready = st.init();
})();
