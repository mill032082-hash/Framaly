/* FRAMALY — navegación y arranque */
(function () {
  'use strict';
  const I = F.icon;
  const ROUTES = [
    { sec: 'Estudio' },
    { id: 'inicio', name: 'Inicio', icon: 'home', sub: 'Tu estudio de video con IA' },
    { id: 'editor', name: 'Editor de video', icon: 'film', full: true, sub: 'Timeline, transiciones y exportación' },
    { id: 'flujos', name: 'Flujos y agentes', icon: 'workflow', full: true, badge: 'IA', sub: 'Automatiza la creación de videos de principio a fin' },
    { sec: 'Creación con IA' },
    { id: 'guiones', name: 'Guiones', icon: 'script', sub: 'Guiones por escenas listos para producir' },
    { id: 'imagenes', name: 'Imágenes', icon: 'image', sub: 'Genera escenas y recursos visuales' },
    { id: 'voces', name: 'Voces', icon: 'mic', sub: 'Narraciones y locuciones con IA' },
    { id: 'efectos', name: 'Efectos y transiciones', icon: 'layers', sub: 'Transiciones, filtros, movimientos y textos' },
    { sec: 'Gestión' },
    { id: 'biblioteca', name: 'Biblioteca', icon: 'folder', sub: 'Todas tus imágenes, voces y música' },
    { id: 'publicar', name: 'Publicar', icon: 'youtube', sub: 'Exporta, optimiza y sube a YouTube' },
    { id: 'integraciones', name: 'Integraciones API', icon: 'plug', sub: 'Conecta OpenAI, Claude, ElevenLabs y YouTube' },
    { id: 'ajustes', name: 'Ajustes', icon: 'sliders', sub: 'Cuenta, videos y datos' },
  ];
  const viewFn = (id) => (id === 'editor' ? F.editor.view : id === 'flujos' ? F.flows.view : F.views[id]);
  let destroy = null, rendering = false;

  function sidebar() {
    const sb = F.$('#sidebar');
    sb.innerHTML = `<a class="brand" href="#/inicio"><div class="logo"><svg class="i" viewBox="0 0 24 24"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg></div><div><b>FRAMALY</b><small>Studio de video IA</small></div></a>
      <nav class="nav" id="nav"></nav>
      <div class="acct" id="acct"></div>
      <div class="side-foot"><b style="color:var(--text);font-size:12px">Conexiones</b><div class="apis" id="apiDots"></div></div>`;
    nav(); dots(); acct();
  }
  /** Menú: solo las secciones que esta persona puede usar (y sin títulos vacíos) */
  function nav() {
    const el = F.$('#nav'); if (!el) return;
    const ok = ROUTES.filter((r) => r.sec || !F.cloud || F.cloud.can(r.id));
    const list = ok.filter((r, i) => !r.sec || (ok[i + 1] && !ok[i + 1].sec));
    el.innerHTML = list.map((r) => (r.sec ? `<div class="nav-sec">${r.sec}</div>` : `<a href="#/${r.id}" data-r="${r.id}">${I(r.icon)}<span>${r.name}</span>${r.badge ? `<span class="badge">${r.badge}</span>` : ''}</a>`)).join('');
    const cur = (location.hash.replace(/^#\/?/, '') || 'inicio').split('?')[0];
    F.$$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === cur));
  }
  /** Bloque de cuenta en el menú lateral (solo si la plataforma tiene base de datos) */
  function acct() {
    const el = F.$('#acct'); if (!el) return;
    const C = F.cloud;
    if (!C?.configured() || !C.user) { el.innerHTML = ''; return; }
    const msg = C.status === 'syncing' ? (C.progress || 'Sincronizando…') : C.status === 'error' ? C.error : C.last ? 'Guardado en la nube · ' + F.ago(C.last) : 'Conectado';
    const pend = C.isAdmin() && C.pendingCount ? `<a class="pend" href="#/ajustes">${C.pendingCount} persona${C.pendingCount > 1 ? 's' : ''} por aprobar</a>` : '';
    el.innerHTML = pend + `<div class="who"><span class="av">${F.esc((C.user.email || '?')[0].toUpperCase())}</span><div style="min-width:0"><b>${F.esc(C.user.email || 'Mi cuenta')}</b><small class="${C.status === 'error' ? 'bad' : ''}">${F.esc(msg)}</small></div></div>
      <div class="row" style="gap:6px;margin-top:8px"><button class="btn sm" data-sync ${C.status === 'syncing' ? 'disabled' : ''}>Sincronizar</button><button class="btn sm" data-out>Cerrar sesión</button></div>`;
  }
  /** Pantalla de inicio de sesión: se muestra mientras la plataforma tenga base de datos y no haya sesión */
  let gateEl = null;
  const gate = { keep: { e: '', p: '' }, mode: 'in' };
  const needGate = () => !!F.cloud?.configured() && (!F.cloud.user || !F.cloud.approved());
  function drawGate(err = '', info = '') {
    const C = F.cloud, el = gateEl, k = gate.keep, up = gate.mode === 'up';
    gate.view = C.user ? 'pending' : 'login';
    if (C.user) {
      const blocked = C.access?.status === 'blocked';
      el.innerHTML = `<div class="gate-card">
        <div class="brand" style="justify-content:center;padding-bottom:6px"><div class="logo"><svg class="i" viewBox="0 0 24 24"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg></div><div><b>FRAMALY</b><small>Studio de video IA</small></div></div>
        <h1>${blocked ? 'Acceso no autorizado' : 'Esperando aprobación'}</h1>
        <p class="muted" style="margin:0 0 6px">${blocked ? 'Quien administra FRAMALY no autorizó esta cuenta.' : 'Tu cuenta ya está creada. Quien administra FRAMALY debe aprobarla antes de que puedas entrar. Esta pantalla se actualiza sola.'}</p>
        <p class="small" style="text-align:center;margin:0 0 6px"><b>${F.esc(C.user.email || '')}</b></p>
        ${err || C.error ? `<div class="gate-msg bad">${F.esc(err || C.error)}</div>` : ''}
        <button class="btn primary lg block" id="gRecheck" type="button" style="margin-top:14px">Comprobar de nuevo</button>
        <button class="btn lg block" id="gOut" type="button" style="margin-top:8px">Cerrar sesión</button></div>`;
      return;
    }
    el.innerHTML = `<form class="gate-card" novalidate>
      <div class="brand" style="justify-content:center;padding-bottom:6px"><div class="logo"><svg class="i" viewBox="0 0 24 24"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg></div><div><b>FRAMALY</b><small>Studio de video IA</small></div></div>
      <h1>${up ? 'Crea tu cuenta' : 'Inicia sesión'}</h1><p class="muted" style="margin:0 0 14px">${up ? 'Solo necesitas un correo y una contraseña.' : 'Entra para abrir tu estudio. Tus proyectos te esperan en cualquier dispositivo.'}</p>
      ${C.google() ? `<button class="btn lg block gbtn" id="gGoogle" type="button"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg><span>Continuar con Google</span></button><div class="or-line"><span>o con tu correo</span></div>` : ''}
      <div class="seg"><button type="button" data-m="in" class="${up ? '' : 'on'}">Entrar</button><button type="button" data-m="up" class="${up ? 'on' : ''}">Crear cuenta</button></div>
      <label class="lbl">Correo</label><input type="text" inputmode="email" id="gEmail" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="tu@correo.com" value="${F.esc(k.e)}">
      <label class="lbl">Contraseña</label><input type="password" id="gPass" autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="Mínimo 6 caracteres">
      ${err ? `<div class="gate-msg bad">${F.esc(err)}</div>` : ''}${info ? `<div class="gate-msg ok">${F.esc(info)}</div>` : ''}
      <button class="btn primary lg block" id="gGo" type="submit" style="margin-top:14px">${up ? 'Crear cuenta' : 'Entrar'}</button>
</form>`;
    el.querySelector(k.e ? '#gPass' : '#gEmail').focus();
  }
  function openGate() {
    if (gateEl) return;
    gateEl = document.createElement('div'); gateEl.className = 'gate';
    const read = () => { gate.keep.e = gateEl.querySelector('#gEmail').value.trim(); gate.keep.p = gateEl.querySelector('#gPass').value; };
    gate.timer = setInterval(() => { if (F.cloud.user && !F.cloud.approved()) F.cloud.recheck().catch(() => {}); }, 15000);
    gateEl.addEventListener('click', async (ev) => {
      if (ev.target.closest('#gOut')) return F.cloud.signOut();
      if (ev.target.closest('#gRecheck')) { const b = ev.target.closest('#gRecheck'); F.busy(b, true, 'Comprobando…'); try { await F.cloud.recheck(); } catch (e) { drawGate(e.message); } if (b.isConnected) F.busy(b, false); return; }
      const m = ev.target.closest('[data-m]'); if (m) { read(); gate.mode = m.dataset.m; drawGate(); }
      if (ev.target.closest('#gGoogle')) F.cloud.signInGoogle().catch((e) => drawGate(e.message));
    });
    gateEl.addEventListener('submit', async (ev) => {
      ev.preventDefault(); read();
      if (!gate.keep.e || !gate.keep.p) return drawGate('Escribe tu correo y tu contraseña.');
      const b = gateEl.querySelector('#gGo'); F.busy(b, true, gate.mode === 'in' ? 'Entrando…' : 'Creando…');
      try {
        const m = gate.mode === 'in' ? await F.cloud.signIn(gate.keep.e, gate.keep.p) : await F.cloud.signUp(gate.keep.e, gate.keep.p);
        if (!F.cloud.user) { gate.mode = 'in'; drawGate('', m); }
      } catch (e) { drawGate(e.message); }
    });
    document.body.appendChild(gateEl); drawGate(F.cloud.error);
  }
  function closeGate() { clearInterval(gate.timer); gateEl?.remove(); gateEl = null; gate.keep.p = ''; }
  function dots() {
    const el = F.$('#apiDots'); if (!el) return;
    el.innerHTML = [['anthropic', 'Claude'], ['openai', 'OpenAI'], ['elevenlabs', 'ElevenLabs'], ['googleClientId', 'YouTube']].map(([k, n]) => `<a href="#/integraciones" style="color:var(--muted);text-decoration:none"><span class="dot ${F.api.has(k) ? 'ok' : ''}"></span>${n}</a>`).join('');
  }
  /** Menú lateral deslizable en celular */
  function menu(open) {
    F.$('#sidebar').classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
  }
  function topbar(r) {
    const p = F.projects.current();
    F.$('#topbar').innerHTML = `<button class="icon-btn menu" id="mMenu" aria-label="Abrir menú">${I('menu')}</button><h1>${r.name}</h1><span class="sub">${r.sub || ''}</span><span class="grow"></span>
      ${p ? `<a class="proj-chip" href="#/editor" title="Proyecto actual">${I('film')}<span>${F.esc(p.name)}</span></a>` : ''}
      ${window.FRAMALY_DEMO ? '<span class="tag or" title="Vista de demostración: la IA y las descargas funcionan en la app instalada en tu PC">Vista demo</span>' : ''}
      <button class="btn sm" id="tbHelp" title="Instrucciones de esta sección">${I('script')}<span class="bt">Instrucciones</span></button>
      <button class="btn primary sm" id="tbNew" title="Nuevo proyecto">${I('plus')}<span class="bt">Nuevo proyecto</span></button>`;
    F.$('#tbNew').onclick = () => F.views.newProject();
    F.$('#tbHelp').onclick = () => F.showHelp(r.id);
    F.$('#mMenu').onclick = () => menu(true);
  }

  let pending = false;
  async function render() {
    if (rendering) { pending = true; return; }
    rendering = true; pending = false;
    try {
      const id = (location.hash.replace(/^#\/?/, '') || 'inicio').split('?')[0];
      let r = ROUTES.find((x) => x.id === id) || ROUTES[1];
      if (F.cloud && !F.cloud.can(r.id)) { F.toast('No tienes acceso a esta sección. Pídeselo a quien administra FRAMALY.', 'error'); r = ROUTES[1]; if (location.hash !== '#/inicio') history.replaceState(null, '', '#/inicio'); }
      if (destroy) { try { destroy(); } catch (e) { console.error(e); } destroy = null; }
      F.$$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === r.id));
      menu(false);
      topbar(r);
      const view = F.$('#view');
      view.className = 'view' + (r.full ? ' full' : '');
      view.innerHTML = '';
      const el = document.createElement('div');
      if (r.full) el.style.height = '100%';
      view.appendChild(el);
      view.scrollTop = 0;
      const d = await viewFn(r.id)(el);
      destroy = typeof d === 'function' ? d : null;
      // Instrucciones: tarjeta en las secciones normales, ventana la primera vez en editor/flujos
      if (!r.full) F.helpCard(r.id, el.querySelector('.page'));
      else if (!localStorage.getItem('framaly.seenHelp.' + r.id) && localStorage.getItem('framaly.onboarded')) {
        localStorage.setItem('framaly.seenHelp.' + r.id, '1'); F.showHelp(r.id);
      }
    } catch (e) {
      console.error(e); F.toast('Error al abrir la sección: ' + e.message, 'error');
    } finally { rendering = false; if (pending) render(); }
  }

  F.router = {
    reload: render,
    go(hash) { if (location.hash === hash) render(); else location.hash = hash; },
  };

  /** Proyecto de ejemplo: 3 escenas, textos, transiciones y música, para ver la app funcionando */
  F.seedDemo = async () => {
    const toBlob = (c) => new Promise((r) => c.toBlob(r, 'image/png'));
    const imgs = [];
    const names = ['Atardecer en la montaña', 'Noche estrellada', 'Desierto dorado'];
    for (let i = 0; i < 3; i++) imgs.push(await F.media.add({ type: 'image', name: names[i], blob: await toBlob(F.R.demo(i)), source: 'ai', meta: { prompt: 'ejemplo' } }));
    // Música de ejemplo: acorde suave de 12 s
    const sr = 22050, n = sr * 12, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]];
    for (let i = 0; i < n; i++) {
      const t = i / sr, ch = chords[Math.floor(t / 3) % 4], env = Math.min(1, t / 1.5, (12 - t) / 1.5);
      const s = ch.reduce((a, f) => a + Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t), 0);
      v.setInt16(44 + i * 2, s * 1800 * env * (0.85 + 0.15 * Math.sin(t * 2)), true);
    }
    const mus = await F.media.add({ type: 'audio', name: 'Música de ejemplo', blob: new Blob([buf], { type: 'audio/wav' }), source: 'upload' });
    const p = F.projects.blank('Ejemplo · Paisajes del mundo', '16:9');
    p.watermark = '@FramalyStudio'; p.progressBar = true;
    p.clips = [
      F.newClip(imgs[0].id, { duration: 4, text: 'Paisajes del mundo', textStyle: 'titulo', textAnim: 'pop', transition: 'circle', motion: 'zoomIn', filter: 'cine' }),
      F.newClip(imgs[1].id, { duration: 4, text: 'Las noches más claras están lejos de las ciudades', textStyle: 'subtitulo', transition: 'slideL', motion: 'panR', filter: 'frio' }),
      F.newClip(imgs[2].id, { duration: 4, text: 'Desierto de Atacama, Chile', textStyle: 'inferior', textAnim: 'up', transition: 'fade', motion: 'kenburns', filter: 'calido' }),
    ];
    p.audio = [{ id: F.uid(), mediaId: mus.id, start: 0, volume: 0.6, loop: true, fadeOut: true, kind: 'musica' }];
    p.meta = { title: 'Paisajes del mundo que tienes que ver', description: 'Un recorrido por tres paisajes increíbles.\n\nCapítulos:\n00:00 Montaña\n00:04 Noche estrellada\n00:08 Desierto', tags: 'paisajes, viajes, naturaleza' };
    await F.projects.save(p);
    F.projects.setCurrent(p.id);
    return p;
  };

  async function init() {
    try { await F.db.open(); } catch (e) { F.toast('No se pudo abrir el almacenamiento local del navegador', 'error'); }
    await Promise.all([F.media.load(), F.projects.load()]).catch((e) => console.error(e));
    if (window.FRAMALY_DEMO && !F.projects.list.length) { try { await F.seedDemo(); } catch (e) { console.error(e); } }
    sidebar();
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.onclick = () => menu(false); document.body.appendChild(scrim);
    F.on('settings', dots);
    F.on('projects', () => { const r = ROUTES.find((x) => x.id === (location.hash.replace(/^#\/?/, '') || 'inicio')); if (r && !r.sec) { const chip = F.$('.proj-chip span'); const p = F.projects.current(); if (chip && p) chip.textContent = p.name; } });
    window.addEventListener('hashchange', () => { if (!needGate()) render(); });
    // Pedir almacenamiento persistente para que el navegador no borre la biblioteca
    navigator.storage?.persist?.().catch(() => {});
    // Cuenta: sin sesión se muestra solo la pantalla de inicio de sesión
    F.$('#acct')?.addEventListener('click', async (e) => {
      if (e.target.closest('[data-out]')) { await F.cloud.signOut(); }
      if (e.target.closest('[data-sync]')) { try { await F.cloud.sync({ manual: true }); } catch (err) { F.toast(err.message, 'error'); } }
    });
    let started = false;
    const sync = () => {
      acct(); nav();
      if (needGate()) { openGate(); if (gate.view !== (F.cloud.user ? 'pending' : 'login')) drawGate(); F.$('#view').innerHTML = ''; return; }
      if (gateEl) closeGate();
      if (F.cloud?.isAdmin()) F.cloud.people().catch(() => {});
      if (!started) { started = true; render().then(() => { if (!localStorage.getItem('framaly.onboarded')) F.onboarding(); }); }
      else if (F.cloud.user && gateOpened) { gateOpened = false; render(); }
    };
    // el administrador ve las solicitudes nuevas; los demás reciben sus permisos actualizados
    setInterval(() => { const C = F.cloud; if (!C?.user) return; if (C.isAdmin()) C.people().catch(() => {}); else if (C.approved()) C.recheck().catch(() => {}); }, 60000);
    let gateOpened = false;
    F.on('cloud', () => { if (needGate()) gateOpened = true; sync(); });
    if (F.cloud?.configured()) await F.cloud.ready.catch(() => {});
    sync();
  }
  init();
})();
