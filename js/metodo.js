/* FRAMALY — Sección «Método Golden»: plantillas listas + edición automática en un solo lugar.
   Reutiliza el motor de js/golden*.js (no duplica lógica): aquí solo se elige proyecto y plantilla y se lanza el automático. */
(function () {
  'use strict';
  const I = F.icon, esc = F.esc, V = F.views;

  /* ---------- Plantillas listas (formato, duración objetivo y look) ---------- */
  const TPLS = [
    { id: 'cod', n: 'Anuncio COD · Meta / TikTok', d: 'Anuncio de venta contra entrega. Gancho en los primeros 3 s y oferta clara.', destino: 'meta', aspect: '9:16', target: 35, filter: 'vivo', transition: 'none', textStyle: 'subtitulo', textAnim: 'words', duck: true },
    { id: 'oferta', n: 'Oferta / lanzamiento', d: 'Corto e impactante: precio, promesa y llamada a la acción.', destino: 'meta', aspect: '9:16', target: 25, filter: 'drama', transition: 'zoom', textStyle: 'titulo', textAnim: 'pop', duck: true },
    { id: 'producto', n: 'Producto con b-roll', d: 'El producto real y objetos sobre negro donde se nombra algo.', destino: 'meta', aspect: '9:16', target: 40, filter: 'vivo', transition: 'slideL', textStyle: 'subtitulo', textAnim: 'words', duck: true },
    { id: 'ugc', n: 'Testimonio / UGC', d: 'Persona hablando a cámara, con cortes limpios y subtítulos grandes.', destino: 'meta', aspect: '9:16', target: 30, filter: 'suave', transition: 'none', textStyle: 'subtitulo', textAnim: 'words', duck: false },
    { id: 'reel', n: 'Reel orgánico', d: 'Contenido orgánico vertical con ritmo natural.', destino: 'reel', aspect: '9:16', target: 30, filter: 'cine', transition: 'fade', textStyle: 'subtitulo', textAnim: 'words', duck: true },
    { id: 'yt', n: 'Video YouTube narrado', d: 'Horizontal, ritmo pausado y cambios de encuadre cada idea.', destino: 'yt', aspect: '16:9', target: 0, filter: 'cine', transition: 'fade', textStyle: 'subtitulo', textAnim: 'fade', duck: true },
  ];
  const STEPS = [
    ['scissors', 'Cortar', 'Quita silencios, muletillas y tomas repetidas. El corte cae en el silencio más cercano.'],
    ['type', 'Subtitular', 'Palabra por palabra, máximo 3 en pantalla y sin signos de apertura.'],
    ['image', 'Ilustrar', 'B-roll donde se nombra algo y encuadres por ideas (frontal, lateral, closeup).'],
    ['volume', 'Sonorizar', 'Efectos separados del corte y música que baja 12 dB cuando habla la voz.'],
  ];
  const RULES = ['El audio define el 80 % del resultado: graba con micrófono, no a 3 metros.', 'Si dudas entre cortar o dejar, deja.', 'Nunca cortes la primera ni la última palabra de una frase.', 'El producto siempre real: la IA no lo redibuja.', 'Revisa los claims prohibidos antes de escribir cualquier texto en pantalla.', 'El primer resultado se itera: nadie acierta a la primera.'];

  const tplName = (id) => TPLS.find((t) => t.id === id)?.n || '';
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento: no pasa nada */ } };
  const filterName = (id) => F.R.filter(id).name;

  /** Aplica una plantilla a un proyecto: formato, destino, duración objetivo, ducking y look de los clips que ya existan */
  function applyTpl(p, t) {
    const g = F.golden.gd(p);
    p.aspect = t.aspect; p.duck = !!t.duck;
    g.destino = t.destino; g.target = t.target; g.destinoSet = true; g.tpl = t.id;
    let n = 0;
    p.clips.forEach((c, i) => {
      if (c.fit === 'black') return;   // el b-roll conserva su look propio
      c.filter = t.filter; c.textStyle = t.textStyle; c.textAnim = t.textAnim;
      if (i < p.clips.length - 1) c.transition = t.transition;
      n++;
    });
    return n;
  }

  /** Abre el editor y pulsa «Automático» cuando ya está montado */
  async function launchAuto(p) {
    if (!p.clips.length) {
      F.toast('Primero añade tus imágenes o tu video (y tu voz) en el editor; después pulsa «Editar automático».', 'info', 6000);
      F.editor.binTab = 'golden'; F.projects.setCurrent(p.id); F.router.go('#/editor'); return;
    }
    F.projects.setCurrent(p.id); F.router.go('#/editor');
    for (let i = 0; i < 50; i++) {
      await F.sleep(100);
      const b = document.querySelector('#bAuto');
      if (b && F.editor.p && F.editor.p.id === p.id) { b.click(); return; }
    }
    F.toast('No se pudo iniciar el automático. Pulsa «Automático» en el editor.', 'error');
  }

  V.golden = (el) => {
    let tplId = lsGet('framaly.golden.tpl') || '';
    if (!TPLS.some((t) => t.id === tplId)) tplId = '';
    const cur = () => F.projects.current();
    const chips = (t) => `<span class="gm-chip">${t.aspect}</span><span class="gm-chip">${t.target ? '~' + t.target + ' s' : 'sin límite'}</span><span class="gm-chip">${esc(filterName(t.filter))}</span>`;

    const draw = () => {
      const ps = F.projects.list, p = cur(), g = p ? F.golden.gd(p) : null;
      const tot = p ? F.R.layout(p).total : 0, hasVoice = p?.audio.some((a) => a.kind === 'voz' && !a.loop);
      el.innerHTML = `<div class="page gm">
        <div class="card gm-hero">
          <div class="gm-hero-t"><span class="gm-ic">${I('wand')}</span><div><h2>Método Golden</h2><p class="desc" style="margin:0">Edita tus videos con el método completo: cortar, subtitular, ilustrar y sonorizar. Elige una plantilla y pulsa un botón.</p></div></div>
          <div class="gm-ctl">
            <div><label class="lbl">Proyecto</label>
              <select id="gmProj">${ps.length ? ps.map((x) => `<option value="${x.id}" ${p && x.id === p.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('') : '<option value="">(aún no tienes proyectos)</option>'}</select></div>
            <div><label class="lbl">Plantilla</label>
              <select id="gmTpl"><option value="">— sin plantilla —</option>${TPLS.map((t) => `<option value="${t.id}" ${t.id === tplId ? 'selected' : ''}>${esc(t.n)}</option>`).join('')}</select></div>
            <button class="btn primary gm-go" id="gmAuto">${I('wand')} Editar automático<small>Todo el método en un clic</small></button>
          </div>
          ${p ? `<div class="gm-stat"><span class="gm-chip ${p.clips.length ? 'ok' : ''}">${p.clips.length} clips</span><span class="gm-chip ${hasVoice ? 'ok' : ''}">${hasVoice ? 'Con voz' : 'Sin voz'}</span><span class="gm-chip">${tot.toFixed(0)} s${g.target ? ' de ~' + g.target + ' s objetivo' : ''}</span>${g.tpl ? `<span class="gm-chip ok">Plantilla: ${esc(tplName(g.tpl))}</span>` : ''}</div>` : '<div class="gm-stat"><span class="gm-chip">Crea un proyecto con una plantilla para empezar</span></div>'}
        </div>

        <h3 class="gm-h">Plantillas listas</h3>
        <div class="gm-grid">${TPLS.map((t) => `<div class="card gm-tpl ${t.id === tplId ? 'on' : ''}" data-t="${t.id}">
          <b>${esc(t.n)}</b><p class="small muted">${esc(t.d)}</p><div class="gm-chips">${chips(t)}</div>
          <div class="row" style="gap:6px;margin-top:10px"><button class="btn sm primary" data-new="${t.id}">${I('plus')} Proyecto nuevo</button><button class="btn sm" data-apply="${t.id}" ${p ? '' : 'disabled'}>Aplicar al actual</button></div></div>`).join('')}</div>

        <h3 class="gm-h">Qué hace el automático</h3>
        <div class="gm-steps">${STEPS.map(([ic, n, d], i) => `<div class="card gm-step"><span class="gm-n">${i + 1}</span><b>${I(ic)} ${n}</b><p class="small muted">${d}</p></div>`).join('')}</div>
        <div class="row" style="gap:8px;margin:14px 0 4px;flex-wrap:wrap"><button class="btn" id="gmEd">${I('film')} Abrir el editor (pestaña Golden)</button><span class="small muted">Si prefieres hacerlo paso a paso, a mano.</span></div>

        <h3 class="gm-h">Reglas de oro</h3>
        <div class="card"><ul class="gm-rules">${RULES.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>
      </div>`;
    };

    const onClick = async (e) => {
      const nw = e.target.closest('[data-new]'), ap = e.target.closest('[data-apply]'), card = e.target.closest('.gm-tpl');
      if (nw) {
        const t = TPLS.find((x) => x.id === nw.dataset.new);
        const name = await F.prompt('Nombre del proyecto', t.n, 'Por ejemplo: Anuncio crema facial');
        if (!name) return;
        const p = await F.projects.create(name.trim() || t.n, t.aspect);
        applyTpl(p, t); await F.projects.save(p); tplId = t.id; lsSet('framaly.golden.tpl', tplId);
        F.toast(`Proyecto «${p.name}» creado con la plantilla. Añade tus imágenes o video y pulsa «Editar automático».`, 'ok', 5000); draw(); return;
      }
      if (ap) {
        const p = cur(), t = TPLS.find((x) => x.id === ap.dataset.apply); if (!p || !t) return;
        const n = applyTpl(p, t); await F.projects.save(p); tplId = t.id; lsSet('framaly.golden.tpl', tplId);
        F.toast(`Plantilla aplicada: ${t.aspect}, ${t.target ? '~' + t.target + ' s' : 'sin límite'}${n ? ', look en ' + n + ' clips' : ''}.`, 'ok', 4500); draw(); return;
      }
      if (e.target.closest('#gmEd')) { F.editor.binTab = 'golden'; F.router.go('#/editor'); return; }
      if (e.target.closest('#gmAuto')) {
        const p = cur(); if (!p) return F.toast('Crea primero un proyecto con una plantilla', 'info');
        const t = TPLS.find((x) => x.id === tplId);
        if (t && F.golden.gd(p).tpl !== t.id) { applyTpl(p, t); await F.projects.save(p); }
        launchAuto(p); return;
      }
      if (card && !e.target.closest('button')) { tplId = card.dataset.t === tplId ? '' : card.dataset.t; lsSet('framaly.golden.tpl', tplId); draw(); }
    };
    const onChange = (e) => {
      if (e.target.id === 'gmProj') { F.projects.setCurrent(e.target.value); draw(); }
      if (e.target.id === 'gmTpl') { tplId = e.target.value; lsSet('framaly.golden.tpl', tplId); draw(); }
    };
    el.addEventListener('click', onClick); el.addEventListener('change', onChange);
    const off = F.on('projects', () => { if (el.isConnected) draw(); });
    draw();
    return () => { el.removeEventListener('click', onClick); el.removeEventListener('change', onChange); if (typeof off === 'function') off(); };
  };
})();
