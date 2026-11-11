/* FRAMALY — Bandeja de lo que envía otra IA (ChatGPT, Claude…) por MCP o API.
   · Cada 25 s (con la pestaña visible) mira si llegaron imágenes, audios, proyectos o guiones nuevos.
   · Los archivos y proyectos se bajan solos (sin pulsar «Actualizar») y quedan en Biblioteca, Imágenes y el Editor.
   · Los guiones aparecen en Guiones → «Recibidos de tu IA», listos para abrir o producir. */
(function () {
  'use strict';
  const I = F.icon, esc = F.esc, P = F.pipeline;
  const CK = 'framaly.aiScripts', SK = 'framaly.aiSeen', BK = 'framaly.aiBase';
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin memoria */ } };
  const X = (F.inbox = { scripts: read(CK, []), busy: false, ready: true });
  const C = () => F.cloud;
  const on = () => C()?.configured?.() && C().user && C().approved();
  X.unseen = () => { const s = +read(SK, 0); return X.scripts.filter((r) => r.updated > s).length; };

  /** Mira qué llegó. quiet = sin avisos (primera vez). Devuelve { scripts, files } nuevos */
  X.check = async ({ force = false } = {}) => {
    if (X.busy || !on() || (!force && document.hidden) || C().status === 'syncing') return null;
    X.busy = true; const got = { scripts: 0, files: 0, projects: 0 };
    try {
      const s = await C().client(), uid = C().user.id, base = read(BK, null);
      // 1) guiones
      const q = await s.from('framaly_scripts').select('id,title,data,source,created,updated').eq('user_id', uid).eq('deleted', false).order('updated', { ascending: false }).limit(40);
      if (q.error) X.ready = !/does not exist|schema cache|PGRST205|42P01/i.test(q.error.message || q.error.code || '');   // la tabla aún no se creó
      else {
        X.ready = true; const rows = q.data || [], max = rows.reduce((a, r) => Math.max(a, +r.updated || 0), 0), known = base?.scripts ?? null;
        const fresh = known === null ? [] : rows.filter((r) => +r.updated > known);
        if (JSON.stringify(rows) !== JSON.stringify(X.scripts)) { X.scripts = rows; write(CK, rows); F.emit('inbox'); }
        if (known === null) write(SK, max);   // primera vez: lo que ya había no cuenta como nuevo
        if (fresh.length) { got.scripts = fresh.length; F.toast(fresh.length === 1 ? `Llegó un guion desde tu IA: «${fresh[0].title}». Está en Guiones.` : `Llegaron ${fresh.length} guiones desde tu IA. Están en Guiones.`, 'ok', 8000); }
        write(BK, { ...(read(BK, {}) || {}), scripts: Math.max(max, known || 0) });
      }
      // 2) archivos y proyectos enviados por la IA que este navegador aún no tiene
      const m = await s.from('framaly_media').select('id,type').eq('user_id', uid).eq('deleted', false).eq('meta->>via', 'mcp').order('created', { ascending: false }).limit(60);
      const pr = await s.from('framaly_projects').select('id').eq('user_id', uid).eq('deleted', false).order('updated', { ascending: false }).limit(30);
      const tomb = new Set((F.settings.cloud?.tomb || []).map((t) => t.id));
      const missM = (m.data || []).filter((r) => !F.media.byId(r.id) && !tomb.has(r.id)), missP = (pr.data || []).filter((r) => !F.projects.list.some((p) => p.id === r.id) && !tomb.has(r.id));
      if (missM.length || missP.length) {
        await C().sync();
        const okM = missM.filter((r) => F.media.byId(r.id)), img = okM.filter((r) => r.type === 'image').length, aud = okM.length - img, okP = missP.filter((r) => F.projects.list.some((p) => p.id === r.id)).length;
        got.files = okM.length; got.projects = okP;
        const parts = []; if (img) parts.push(img > 1 ? `${img} imágenes` : '1 imagen'); if (aud) parts.push(`${aud} audio${aud > 1 ? 's' : ''}`); if (okP) parts.push(`${okP} proyecto${okP > 1 ? 's' : ''}`);
        if (parts.length) { F.toast(`Llegó desde tu IA: ${parts.join(', ')}. ${img ? 'Las imágenes están en Imágenes y Biblioteca. ' : ''}${okP ? 'El proyecto está en el Editor → Proyectos.' : ''}`, 'ok', 9000); F.emit('inbox'); }
      }
    } catch (e) { /* sin conexión: se intenta en la siguiente vuelta */ } finally { X.busy = false; }
    return got;
  };
  setInterval(() => X.check(), 25000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => X.check(), 1200); });
  F.on('cloud', () => { if (on() && !X.started) { X.started = true; setTimeout(() => X.check({ force: true }), 3000); } });

  X.remove = async (id) => {
    const s = await C().client(), { error } = await s.from('framaly_scripts').update({ deleted: true, updated: Date.now() }).eq('user_id', C().user.id).eq('id', id);
    if (error) throw new Error(error.message);
    X.scripts = X.scripts.filter((r) => r.id !== id); write(CK, X.scripts); F.emit('inbox');
  };
  const toScript = (r) => ({ title: r.title, bible: r.data?.bible || '', scenes: (r.data?.scenes || []).map((s) => ({ narration: String(s.narration || ''), image_prompt: String(s.image_prompt || s.narration || ''), on_screen_text: String(s.on_screen_text || '') })) });
  const linked = (r, k) => (r.data?.scenes || []).map((s) => (s[k] && F.media.byId(s[k]) ? s[k] : null));

  /** Produce el video de un guion recibido: usa las imágenes y voces que la IA ya envió (esas no se pagan otra vez) */
  X.produce = async (r) => {
    const need = (r.data?.scenes || []).some((s) => (s.image_media_id && !F.media.byId(s.image_media_id)) || (s.voice_media_id && !F.media.byId(s.voice_media_id)));
    if (need) { F.toast('Bajando las imágenes que envió tu IA…', '', 3000); await C().sync().catch(() => {}); }
    const sc = toScript(r), n = sc.scenes.length, imgs = linked(r, 'image_media_id'), vox = linked(r, 'voice_media_id'), ni = imgs.filter(Boolean).length, nv = vox.filter(Boolean).length;
    const pref = read('framaly.script', {}), voice = pref.voice ?? 'nova', words = sc.scenes.reduce((a, s) => a + s.narration.split(/\s+/).filter(Boolean).length, 0);
    const txt = `Guion «${esc(r.title)}» de ${n} escenas.<br>· Imágenes: <b>${ni} ya enviadas por tu IA</b>${n - ni ? ` y <b>${n - ni} que generará FRAMALY</b> (gasta créditos)` : ' (no se genera ninguna)'}.<br>· Voz: ${nv === n ? '<b>la que envió tu IA</b>' : voice ? `${nv ? `${nv} enviadas y ` : ''}<b>${n - nv} narraciones con FRAMALY</b> (gasta créditos)` : 'sin voz'}.`;
    if (!(await F.confirm('Producir video', txt + '<br>¿Continuar?', 'Producir', false))) return null;
    const fl = P.makeFlow('youtube');
    Object.assign(fl.cfg.idea, { topic: r.data?.topic || r.title, duration: Math.max(15, Math.round(words / 2.4)), aspect: r.data?.aspect || pref.aspect || '9:16', language: r.data?.language || 'español' });
    fl.cfg.images.style = pref.style || 'cine'; fl.cfg.voice.voice = voice || 'nova'; fl.on.voice = nv === n || !!voice; fl.on.seo = F.api.textReady(); fl.cfg.output.name = r.title;
    return P.runModal({ ...P.cfgFrom(fl), script: { provider: 'auto' }, presetScript: sc }, { autoExport: false, resume: { id: F.uid(), created: Date.now(), imgIds: imgs, voiceIds: vox } });
  };

  /** Pinta la bandeja dentro de Guiones. open(script, row) abre el guion en el guionista */
  X.mount = (box, { open }) => {
    const draw = () => {
      if (!box.isConnected) return off();
      const l = X.scripts, seen = +read(SK, 0);
      if (!on()) { box.innerHTML = ''; return; }
      box.innerHTML = l.length ? `<div class="card inbox"><div class="row" style="gap:8px"><h3 style="margin:0">${I('bot')} Recibidos de tu IA</h3><span class="tag or">${l.length}</span><span class="grow"></span><button class="btn sm ghost" data-ib="refresh" title="Buscar ahora">${I('refresh')}</button></div>
        <p class="small muted" style="margin:4px 0 8px">Guiones que te envió ChatGPT u otra IA conectada. Llegan solos.</p>
        ${l.map((r) => { const sc = r.data?.scenes || [], n = sc.length, ni = sc.filter((s) => s.image_media_id).length, nv = sc.filter((s) => s.voice_media_id).length;
          return `<div class="pend" data-sid="${esc(r.id)}"><div class="row" style="gap:6px"><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.title)}</b>${r.updated > seen ? '<span class="tag or">Nuevo</span>' : ''}</div>
            <div class="pend-row"><span>${n} escenas</span>${ni ? `<span class="pend-st ok">✓ ${ni}/${n} imágenes enviadas</span>` : ''}${nv ? `<span class="pend-st ok">✓ ${nv}/${n} voces enviadas</span>` : ''}<span class="pend-st">${new Date(+r.updated).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
            <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-ib="open">${I('script')} Abrir en el guionista</button><button class="btn sm primary" data-ib="make">${I('film')} Producir video</button><button class="btn sm ghost" data-ib="del" title="Quitar de la lista">${I('trash')}</button></div></div>`; }).join('')}</div>`
        : X.ready ? '' : '';
      if (l.length) setTimeout(() => write(SK, Math.max(seen, ...l.map((r) => +r.updated || 0))), 4000);   // al verlos dejan de ser «nuevos»
    };
    const off = F.on('inbox', draw);
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ib]'); if (!b) return; const a = b.dataset.ib;
      if (a === 'refresh') { F.busy(b, true, ''); await X.check({ force: true }); F.busy(b, false); return draw(); }
      const r = X.scripts.find((x) => x.id === b.closest('[data-sid]')?.dataset.sid); if (!r) return;
      try {
        if (a === 'open') open(toScript(r), r);
        else if (a === 'make') { b.disabled = true; await X.produce(r); b.disabled = false; }
        else if (a === 'del' && (await F.confirm('Quitar guion', `¿Quitar «${esc(r.title)}» de los recibidos?`, 'Quitar'))) await X.remove(r.id);
      } catch (er) { F.toast(er.message, 'error', 7000); b.disabled = false; }
    });
    draw(); X.check({ force: true });
  };
})();
