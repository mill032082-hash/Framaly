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
  ];
  const viewFn = (id) => (id === 'editor' ? F.editor.view : id === 'flujos' ? F.flows.view : F.views[id]);
  let destroy = null, rendering = false;

  function sidebar() {
    const sb = F.$('#sidebar');
    sb.innerHTML = `<a class="brand" href="#/inicio"><div class="logo"><svg class="i" viewBox="0 0 24 24"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg></div><div><b>FRAMALY</b><small>Studio de video IA</small></div></a>
      <nav class="nav">${ROUTES.map((r) => (r.sec ? `<div class="nav-sec">${r.sec}</div>` : `<a href="#/${r.id}" data-r="${r.id}">${I(r.icon)}<span>${r.name}</span>${r.badge ? `<span class="badge">${r.badge}</span>` : ''}</a>`)).join('')}</nav>
      <div class="side-foot"><b style="color:var(--text);font-size:12px">Conexiones</b><div class="apis" id="apiDots"></div></div>`;
    dots();
  }
  function dots() {
    const el = F.$('#apiDots'); if (!el) return;
    el.innerHTML = [['anthropic', 'Claude'], ['openai', 'OpenAI'], ['elevenlabs', 'ElevenLabs'], ['googleClientId', 'YouTube']].map(([k, n]) => `<a href="#/integraciones" style="color:var(--muted);text-decoration:none"><span class="dot ${F.api.has(k) ? 'ok' : ''}"></span>${n}</a>`).join('');
  }
  function topbar(r) {
    const p = F.projects.current();
    F.$('#topbar').innerHTML = `<button class="icon-btn menu" id="mMenu">${I('menu')}</button><div><h1>${r.name}</h1></div><span class="sub">${r.sub || ''}</span><span class="grow"></span>
      ${p ? `<a class="proj-chip" href="#/editor" title="Proyecto actual">${I('film')}<span>${F.esc(p.name)}</span></a>` : ''}
      ${window.FRAMALY_DEMO ? '<span class="tag or" title="Vista de demostración: la IA y las descargas funcionan en la app instalada en tu PC">Vista demo</span>' : ''}
      <button class="btn sm" id="tbHelp" title="Instrucciones de esta sección">${I('script')} Instrucciones</button>
      <button class="btn primary sm" id="tbNew">${I('plus')} Nuevo proyecto</button>`;
    F.$('#tbNew').onclick = () => F.views.newProject();
    F.$('#tbHelp').onclick = () => F.showHelp(r.id);
    F.$('#mMenu').onclick = () => F.$('#sidebar').classList.toggle('open');
  }

  let pending = false;
  async function render() {
    if (rendering) { pending = true; return; }
    rendering = true; pending = false;
    try {
      const id = (location.hash.replace(/^#\/?/, '') || 'inicio').split('?')[0];
      const r = ROUTES.find((x) => x.id === id) || ROUTES[1];
      if (destroy) { try { destroy(); } catch (e) { console.error(e); } destroy = null; }
      F.$$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.r === r.id));
      F.$('#sidebar').classList.remove('open');
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
    F.on('settings', dots);
    F.on('projects', () => { const r = ROUTES.find((x) => x.id === (location.hash.replace(/^#\/?/, '') || 'inicio')); if (r && !r.sec) { const chip = F.$('.proj-chip span'); const p = F.projects.current(); if (chip && p) chip.textContent = p.name; } });
    window.addEventListener('hashchange', render);
    // Pedir almacenamiento persistente para que el navegador no borre la biblioteca
    navigator.storage?.persist?.().catch(() => {});
    await render();
    if (!localStorage.getItem('framaly.onboarded')) F.onboarding();
  }
  init();
})();
