/* FRAMALY — Editor de video (timeline, inspector, vista previa) */
(function () {
  'use strict';
  const R = F.R;
  const I = F.icon;
  const E = (F.editor = { sel: null, selType: null, t: 0, playing: false, pps: 40, undo: [], redo: [], binTab: 'image' });
  let p, root, cv, cx, PW, PH, nodes = [], raf = 0, unsub = [], lastCommit = 0;

  const saveSoon = F.debounce(() => p && F.projects.save(p), 350);
  const q = (s) => root.querySelector(s);
  const clipById = (id) => p.clips.find((c) => c.id === id);
  const audById = (id) => p.audio.find((a) => a.id === id);
  const total = () => R.layout(p).total;

  /* ---------- montaje de la vista ---------- */
  E.view = async (el) => {
    root = el;
    p = await F.projects.ensureCurrent();
    E.p = p; E.undo = []; E.redo = []; E.sel = null; E.selType = null; E.t = 0;
    el.innerHTML = tpl();
    cv = q('#pv'); cx = cv.getContext('2d');
    sizeCanvas();
    bind();
    p.clips.forEach((c) => F.media.image(c.mediaId).catch(() => {}));
    unsub.push(F.on('imgload', () => draw()));
    unsub.push(F.on('media', () => { renderBin(); renderTimeline(); }));
    renderAll();
    const onKey = (e) => keys(e);
    const onResize = () => renderTimeline();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      stop(); unsub.forEach((u) => u()); unsub = [];
      document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize);
      if (p) F.projects.save(p);
    };
  };

  /* pestañas del panel izquierdo: archivos y herramientas para editar */
  const TABS = [['image', 'Imágenes'], ['audio', 'Audio'], ['motion', 'Animaciones'], ['fx', 'Efectos'], ['trans', 'Transiciones'], ['text', 'Texto'], ['golden', 'Golden'], ['more', 'Más']];
  const GLYPH = { none: '■', kenburns: '⤢', zoomIn: '⊕', zoomOut: '⊖', panL: '←', panR: '→', panU: '↑', panD: '↓', fade: '◐', black: '●', flash: '✦', slideL: '⇠', slideR: '⇢', slideU: '⇡', zoom: '⌖', wipe: '▌', circle: '◯', blur: '≋', spin: '↻', blinds: '☰', glitch: '▚' };

  function tpl() {
    return `
<div class="editor">
  <aside class="panel ed-bin">
    <div class="panel-h"><div class="seg" id="binTabs">${TABS.map(([k, n]) => `<button data-t="${k}" class="${E.binTab === k ? 'on' : ''}">${n}</button>`).join('')}</div><span class="grow"></span><button class="icon-btn" id="binUp" title="Subir archivos">${I('upload')}</button></div>
    <div class="bin-grid" id="bin"></div>
    <div class="bin-foot">Arrastra al timeline o pulsa <b>+</b><br><a href="#/imagenes">Generar imágenes</a> · <a href="#/voces">Crear voces</a></div>
  </aside>
  <section class="ed-stage">
    <div class="stage-bar">
      <input class="title-in" id="pName" type="text" title="Nombre del proyecto">
      <select id="pAspect" title="Formato">${R.ASPECTS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>
      <span class="grow"></span>
      <button class="icon-btn" id="bUndo" title="Deshacer (Ctrl+Z)">${I('undo')}</button>
      <button class="icon-btn" id="bRedo" title="Rehacer (Ctrl+Y)">${I('redo')}</button>
      <button class="btn sm" id="bProj" title="Proyectos">${I('folder')}<span class="bt">Proyectos</span></button>
      <button class="btn sm auto-top" id="bAuto" title="Editar todo en automático">${I('wand')}<span class="bt">Automático</span></button>
      <button class="btn primary sm" id="bExport">${I('download')} Exportar</button>
    </div>
    <div class="stage" id="stage"><canvas id="pv"></canvas>
      <div class="stage-empty hidden" id="stEmpty"><div><b>Tu timeline está vacío</b><p class="muted small">Añade imágenes de la biblioteca, súbelas desde tu PC, o deja que los agentes creen el video completo.</p>
      <div class="row" style="justify-content:center"><button class="btn sm" id="eUp">${I('upload')} Subir imágenes</button><a class="btn primary sm" href="#/flujos">${I('bot')} Crear con agentes</a></div></div></div>
    </div>
    <div class="transport">
      <button class="icon-btn" id="tStart" title="Ir al inicio">${I('skip')}</button>
      <button class="icon-btn" id="tMute" title="Prueba del sonido apagado: reproduce sin audio">${I('volume')}</button>
      <button class="play" id="tPlay" title="Reproducir (Espacio)">${I('play')}</button>
      <span class="tc"><b id="tCur">00:00.0</b> / <span id="tTot">00:00.0</span></span>
      <span class="grow"></span><span class="muted small" id="tInfo"></span>
    </div>
  </section>
  <aside class="panel ed-insp" id="insp"></aside>
  <section class="panel ed-tl">
    <div class="tl-bar">
      <button class="btn sm" id="bAddImg">${I('plus')} Imágenes</button>
      <button class="btn sm" id="bAddAud">${I('music')} Audio</button>
      <button class="btn sm" id="bText" title="Escribir un texto en el clip">${I('type')}<span class="bt">Texto</span></button>
      <button class="btn sm" id="bDup" title="Duplicar el clip (Ctrl+D)">${I('copy')}<span class="bt">Duplicar</span></button>
      <button class="btn sm" id="bSplit" title="Dividir el clip en el cursor (S)">${I('scissors')}<span class="bt">Dividir</span></button>
      <button class="btn sm ghost" id="bFit" title="Ajustar a narración: los clips duran lo mismo que la voz">${I('clock')}<span class="bt">Ajustar a narración</span></button>
      <button class="btn sm ghost" id="bUni" title="Duración uniforme">${I('scissors')}<span class="bt">Duración uniforme</span></button>
      <span class="grow"></span>
      <span class="muted small bt">Zoom</span><input type="range" id="tlZoom" min="10" max="160" value="${E.pps}">
      <button class="icon-btn" id="bDel" title="Eliminar seleccionado (Supr)">${I('trash')}</button>
    </div>
    <div class="tl-body">
      <div class="tl-heads"><div class="h-r"></div><div class="h-v">${I('film')} VIDEO</div><div class="h-a">${I('mic')} VOZ</div><div class="h-a">${I('music')} MÚSICA</div></div>
      <div class="tl-scroll" id="tlScroll"><div class="tl-inner" id="tlInner">
        <div class="tl-ruler" id="ruler"></div>
        <div class="tl-track v" id="trackV"></div>
        <div class="tl-track a" id="trackA" data-kind="voz"></div>
        <div class="tl-track a" id="trackM" data-kind="musica"></div>
        <div class="playhead" id="ph"></div>
      </div></div>
    </div>
  </section>
</div>`;
  }

  function sizeCanvas() { [PW, PH] = R.previewSize(p.aspect, 960); cv.width = PW; cv.height = PH; }
  function draw() { if (!cv || !p) return; R.renderFrame(cx, p, E.t, PW, PH, 'pv'); }
  function renderAll() {
    q('#pName').value = p.name; q('#pAspect').value = p.aspect;
    renderBin(); renderTimeline(); renderInspector(); draw(); updateTime();
  }

  /* ---------- historial ---------- */
  const snap = () => JSON.stringify({ name: p.name, aspect: p.aspect, fps: p.fps, clips: p.clips, audio: p.audio, watermark: p.watermark, letterbox: p.letterbox, progressBar: p.progressBar, duck: !!p.duck });
  function commit(soft) {
    if (soft && Date.now() - lastCommit < 900) return;
    lastCommit = Date.now();
    E.undo.push(snap()); if (E.undo.length > 80) E.undo.shift(); E.redo = [];
    updUndo();
  }
  function restore(s) { Object.assign(p, JSON.parse(s)); if (E.sel && !clipById(E.sel) && !audById(E.sel)) E.sel = E.selType = null; sizeCanvas(); renderAll(); saveSoon(); updUndo(); }
  function undo() { if (!E.undo.length) return; E.redo.push(snap()); restore(E.undo.pop()); }
  function redo() { if (!E.redo.length) return; E.undo.push(snap()); restore(E.redo.pop()); }
  function updUndo() { if (!root) return; q('#bUndo').disabled = !E.undo.length; q('#bRedo').disabled = !E.redo.length; }
  function after(o = {}) { E.t = F.clamp(E.t, 0, total()); saveSoon(); renderTimeline(); draw(); updateTime(); if (o.insp) renderInspector(); }

  /* API interna para el módulo Golden */
  E.api = { undo: () => undo(), seek: (t) => seek(t), commit, after, total, save: () => p && F.projects.save(p), renderBin: () => renderBin(), setAspect: () => sizeCanvas() };

  /* ---------- biblioteca lateral ---------- */
  function renderBin() {
    const bin = q('#bin'); if (!bin) return;
    const up = q('#binUp'); if (up) up.style.display = ['image', 'audio'].includes(E.binTab) ? '' : 'none';
    if (!['image', 'audio'].includes(E.binTab)) return renderTools(bin);
    const list = E.binTab === 'image' ? F.media.images() : F.media.audios();
    if (!list.length) {
      bin.innerHTML = `<div class="empty" style="grid-column:span 2;padding:24px 10px">${I(E.binTab === 'image' ? 'image' : 'music')}<p class="small">Sin ${E.binTab === 'image' ? 'imágenes' : 'audios'} todavía</p><button class="btn sm" data-up>${I('upload')} Subir</button></div>`;
      return;
    }
    bin.innerHTML = list.map((m) => m.type === 'image'
      ? `<div class="bin-item" draggable="true" data-m="${m.id}" title="${F.esc(m.name)}" style="background-image:url('${F.media.url(m)}')"><button class="add" data-add="${m.id}" title="Añadir al final">${I('plus')}</button></div>`
      : `<div class="bin-item aud" draggable="true" data-m="${m.id}" title="${F.esc(m.name)}">${I(m.source === 'ai' ? 'mic' : 'music')}<span>${F.esc(m.name)}<br><small>${F.fmtS(m.duration)}</small></span><button class="add" data-add="${m.id}" title="Añadir">${I('plus')}</button></div>`).join('');
  }

  /* ---------- herramientas: animaciones, efectos, transiciones, texto y más ---------- */
  function renderTools(bin) {
    if (E.binTab === 'golden' && F.golden) return F.golden.panel(bin, E);
    const c = E.selType === 'clip' ? clipById(E.sel) : null, i = c ? p.clips.indexOf(c) : -1, tab = E.binTab;
    const cur = (k) => (c ? c[k] : null);
    const item = (k, o, glyph, extra = '') => `<button class="pre-item ${cur(k) === o.id ? 'on' : ''}" data-pre="${k}:${o.id}" title="${F.esc(o.name)}">${extra || `<span class="g">${glyph}</span>`}<span class="n">${F.esc(o.name)}</span></button>`;
    const head = `<div class="pre-head"><span class="small ${c ? '' : 'muted'}">${c ? `Se aplica al <b>clip ${i + 1}</b>` : 'Selecciona un clip en la línea de tiempo'}</span><label class="check"><input type="checkbox" id="preAll" ${E.applyAll ? 'checked' : ''}> A todos los clips</label></div>`;
    let body = '';
    if (tab === 'motion') body = R.MOTIONS.map((o) => item('motion', o, GLYPH[o.id] || '•')).join('');
    else if (tab === 'trans') body = R.TRANSITIONS.map((o) => item('transition', o, GLYPH[o.id] || '•')).join('');
    else if (tab === 'fx') {
      const m = c ? F.media.byId(c.mediaId) : F.media.images()[0], bg = m ? `background-image:url('${F.media.url(m)}')` : 'background:linear-gradient(135deg,#f59e0b,#7c3aed)';
      body = R.filters().map((o) => item('filter', o, '', `<span class="fxp" style="${bg};filter:${o.css === 'none' ? 'none' : o.css}"></span>`)).join('');
    } else if (tab === 'text') {
      body = `<div class="pre-sub">Estilo del texto</div>${R.TEXT_STYLES.map((o) => item('textStyle', o, 'Aa')).join('')}<div class="pre-sub">Animación del texto</div>${R.TEXT_ANIMS.map((o) => item('textAnim', o, '✦')).join('')}
        <button class="btn sm primary" data-pre="text:add" style="grid-column:1/-1">${I('type')} Añadir texto al clip</button>`;
    } else {
      body = `<div class="pre-sub">Sobre todo el video</div>
        <label class="check" style="grid-column:1/-1"><input type="checkbox" data-proj="letterbox" ${p.letterbox ? 'checked' : ''}> Barras de cine</label>
        <label class="check" style="grid-column:1/-1"><input type="checkbox" data-proj="progressBar" ${p.progressBar ? 'checked' : ''}> Barra de progreso naranja</label>
        <label class="lbl" style="grid-column:1/-1">Marca de agua / nombre del canal</label><input type="text" data-proj="watermark" value="${F.esc(p.watermark || '')}" placeholder="@TuCanal" style="grid-column:1/-1">
        <div class="pre-sub">Más herramientas</div>
        <a class="btn sm" href="#/efectos" style="grid-column:1/-1">${I('wand')} Crear un filtro propio</a>
        <a class="btn sm" href="#/imagenes" style="grid-column:1/-1">${I('image')} Generar imágenes con IA</a>
        <a class="btn sm" href="#/voces" style="grid-column:1/-1">${I('mic')} Crear una voz</a>`;
    }
    bin.innerHTML = (tab === 'more' ? '' : head) + body;
  }
  const PRE_NAME = { motion: 'Animación', transition: 'Transición', filter: 'Efecto', textStyle: 'Estilo de texto', textAnim: 'Animación de texto' };
  function applyPreset(k, v) {
    const c = E.selType === 'clip' ? clipById(E.sel) : null, targets = E.applyAll ? p.clips : c ? [c] : [];
    if (!targets.length) return F.toast('Selecciona un clip en la línea de tiempo o marca «A todos los clips»');
    commit();
    targets.forEach((t) => {
      if (k === 'text') { if (!t.text) t.text = 'Tu texto aquí'; return; }
      t[k] = v;
      if (k === 'motion' && v !== 'none' && !t.motionAmt) t.motionAmt = 0.15;
      if (k === 'transition' && v !== 'none' && !t.transDur) t.transDur = 0.8;
    });
    after({ insp: true }); renderBin();
    F.toast(k === 'text' ? 'Texto añadido: edítalo a la derecha' : `${PRE_NAME[k]} aplicada${targets.length > 1 ? ` a ${targets.length} clips` : ''}`, 'ok', 1500);
  }

  function addMedia(id, index, kind, start) {
    const m = F.media.byId(id); if (!m) return;
    commit();
    if (m.type === 'image') {
      const prev = p.clips[p.clips.length - 1];
      const c = F.newClip(id, prev ? { transition: prev.transition, filter: prev.filter, transDur: prev.transDur } : {});
      if (index == null || index > p.clips.length) p.clips.push(c); else p.clips.splice(index, 0, c);
      F.media.image(id).catch(() => {});
      select('clip', c.id, false);
    } else {
      const k = kind || (m.source === 'ai' ? 'voz' : 'musica');
      const a = { id: F.uid(), mediaId: id, start: start ?? (k === 'voz' ? F.round1(E.t) : 0), volume: k === 'musica' ? 0.25 : 1, loop: k === 'musica', fadeOut: k === 'musica', kind: k };
      p.audio.push(a);
      select('audio', a.id, false);
    }
    after({ insp: true });
  }

  async function upload(toTimeline = true, dropped) {
    const files = dropped || await F.pickFiles('image/*,audio/*');
    if (!files.length) return;
    const added = await F.media.addFiles(files);
    if (!toTimeline || !added.length) return;
    commit();
    for (const m of added) {
      if (m.type === 'image') p.clips.push(F.newClip(m.id));
      else p.audio.push({ id: F.uid(), mediaId: m.id, start: 0, volume: 0.25, loop: true, fadeOut: true, kind: 'musica' });
    }
    after({ insp: true });
  }

  /* ---------- timeline ---------- */
  function renderTimeline() {
    if (!root || !q('#tlInner')) return;
    const { items, total: tot } = R.layout(p);
    const sc = q('#tlScroll'), inner = q('#tlInner'), pps = E.pps;
    const W = Math.max(sc.clientWidth, (tot + 8) * pps);
    inner.style.width = W + 'px';
    const step = pps >= 80 ? 1 : pps >= 40 ? 2 : pps >= 20 ? 5 : 10, minor = step / 2, maxT = W / pps;
    let h = '';
    for (let k = 0; k * minor <= maxT; k++) { const s = k * minor, big = k % 2 === 0; h += `<div class="tick ${big ? 'big' : ''}" style="left:${s * pps}px">${big ? `<span>${F.fmtS(s)}</span>` : ''}</div>`; }
    q('#ruler').innerHTML = h;
    q('#trackV').innerHTML = items.map((it, i) => {
      const c = it.clip, m = F.media.byId(c.mediaId);
      const tr = R.TRANSITIONS.find((t) => t.id === c.transition);
      return `<div class="clip ${E.selType === 'clip' && E.sel === c.id ? 'sel' : ''}" draggable="true" data-c="${c.id}" style="left:${it.start * pps}px;width:${Math.max(6, c.duration * pps - 2)}px;${m ? `background-image:url('${F.media.url(m)}')` : ''}">
        <div class="clip-lbl">${i + 1} · ${c.duration.toFixed(1)}s</div>${c.text ? `<div class="clip-txt">${F.esc(c.text)}</div>` : ''}
        <div class="clip-handle" data-h="${c.id}" title="Arrastra para cambiar la duración"></div>
        ${i < items.length - 1 && c.transition !== 'none' ? `<div class="clip-tr" title="${F.esc(tr?.name || '')}"></div>` : ''}</div>`;
    }).join('') + (items.length ? '' : `<div class="muted small" style="position:absolute;left:16px;top:32px">Arrastra imágenes aquí desde la biblioteca</div>`);
    const aDur = (a) => { const m = F.media.byId(a.mediaId); return a.loop ? Math.max(0.5, tot - a.start) : m?.duration || 2; };
    const row = (music) => p.audio.filter((a) => (a.kind === 'musica') === music).map((a) => {
      const m = F.media.byId(a.mediaId);
      return `<div class="aclip ${a.kind === 'musica' ? 'musica' : ''} ${E.selType === 'audio' && E.sel === a.id ? 'sel' : ''}" data-a="${a.id}" style="left:${a.start * pps}px;width:${Math.max(24, aDur(a) * pps - 2)}px" title="${F.esc(m?.name || '')}"><div class="wave"></div>${I(music ? 'music' : 'mic')}<span>${F.esc(m ? m.name : '(audio eliminado)')}</span></div>`;
    }).join('');
    q('#trackA').innerHTML = row(false);
    q('#trackM').innerHTML = row(true);
    q('#ph').style.left = E.t * pps + 'px';
  }

  function updateTime() {
    if (!root) return;
    const tot = total();
    q('#tCur').textContent = F.fmt(E.t); q('#tTot').textContent = F.fmt(tot);
    q('#ph').style.left = E.t * E.pps + 'px';
    const [W, H] = R.SIZES[p.aspect];
    q('#tInfo').textContent = `${W}×${H} · ${p.fps || 30} fps · ${p.clips.length} clips`;
    q('#stEmpty').classList.toggle('hidden', p.clips.length > 0);
  }
  function followScroll() {
    const sc = q('#tlScroll'), x = E.t * E.pps;
    if (x > sc.scrollLeft + sc.clientWidth - 60 || x < sc.scrollLeft) sc.scrollLeft = Math.max(0, x - 80);
  }

  /* ---------- reproducción ---------- */
  let starting = false;
  async function play() {
    if (E.playing) return stop();
    if (starting) return;
    starting = true;
    try { await play0(); } finally { starting = false; }
  }
  async function play0() {
    const tot = total(); if (!tot) return F.toast('Añade imágenes al timeline primero');
    if (E.t >= tot - 0.05) E.t = 0;
    const ac = F.actx(); await ac.resume();
    await Promise.all(p.clips.map((c) => F.media.image(c.mediaId).catch(() => null)));
    const tracks = await F.Engine.prepareAudio(p);
    const when = ac.currentTime + 0.06, t0 = E.t;
    nodes = E.muted ? [] : F.Engine.scheduleAudio(tracks, t0, tot, ac.destination, when, p.duck);
    E.playing = true; setPlayIcon();
    const loop = () => {
      if (!E.playing) return;
      const t = t0 + Math.max(0, ac.currentTime - when);
      E.t = Math.min(t, tot); draw(); updateTime(); followScroll();
      if (t >= tot) { stop(); return; }
      raf = requestAnimationFrame(loop);
    };
    loop();
  }
  function stop() {
    E.playing = false; cancelAnimationFrame(raf);
    nodes.forEach((n) => { try { n.stop(); } catch (e) {} }); nodes = [];
    setPlayIcon();
  }
  function setPlayIcon() { const b = root && q('#tPlay'); if (b) b.innerHTML = I(E.playing ? 'pause' : 'play', E.playing ? 'fill' : ''); }
  function seek(t) {
    const was = E.playing; if (was) stop();
    E.t = F.clamp(t, 0, total()); draw(); updateTime();
    if (was) play();
  }

  /* ---------- selección e inspector ---------- */
  function select(type, id, render = true) {
    E.selType = id ? type : null; E.sel = id || null;
    if (render) { renderTimeline(); renderInspector(); if (!['image', 'audio'].includes(E.binTab)) renderBin(); }
  }
  const sec = (t, inner, all) => `<div class="insp-sec"><div class="t">${t}${all ? `<button class="applyall" data-all="${all}">Aplicar a todos</button>` : ''}</div>${inner}</div>`;
  const rangeTxt = (k, v) => k === 'motionAmt' ? Math.round(v * 100) + '%' : k === 'transDur' ? (+v).toFixed(1) + 's' : k === 'volume' ? Math.round(v * 100) + '%' : v;

  function renderInspector() {
    const el = q('#insp'); if (!el) return;
    let obj = null;
    if (E.selType === 'clip' && (obj = clipById(E.sel))) {
      const c = obj, i = p.clips.indexOf(c), m = F.media.byId(c.mediaId);
      el.innerHTML = `<h4>${I('film')} Clip ${i + 1}</h4><div class="muted small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${F.esc(m?.name || 'Sin imagen')}</div>
        <div class="insp-thumb" style="${m ? `background-image:url('${F.media.url(m)}')` : ''}"></div>
        <div class="row" style="margin-top:10px;gap:6px"><button class="btn sm" data-act="left" title="Mover a la izquierda" ${i === 0 ? 'disabled' : ''}>←</button><button class="btn sm" data-act="right" title="Mover a la derecha" ${i === p.clips.length - 1 ? 'disabled' : ''}>→</button><button class="btn sm" data-act="dup">${I('copy')} Duplicar</button><button class="btn sm" data-act="replace">${I('image')} Cambiar</button><span class="grow"></span><button class="btn sm danger" data-act="del" title="Eliminar">${I('trash')}</button></div>
        ${sec('Tiempo y encuadre', `<label class="lbl">Duración (segundos)</label><input type="number" step="0.1" min="0.5" data-k="duration">
          <label class="lbl">Encuadre</label><select data-k="fit"><option value="cover">Rellenar (recorta bordes)</option><option value="contain">Ajustar + fondo desenfocado</option><option value="black">Objeto sobre fondo negro (b-roll)</option></select>`, 'duration,fit')}
        ${sec('Movimiento de cámara', `<select data-k="motion">${R.opts(R.MOTIONS)}</select><label class="lbl">Intensidad</label><div class="rangeval"><input type="range" min="0.02" max="0.45" step="0.01" data-k="motionAmt"><span data-v="motionAmt"></span></div>`, 'motion,motionAmt')}
        ${sec('Filtro de color', `<select data-k="filter">${R.opts(R.filters())}</select><div class="hint"><a href="#/efectos">Crear filtro personalizado →</a></div>`, 'filter')}
        ${sec('Transición al siguiente clip', `<select data-k="transition">${R.opts(R.TRANSITIONS)}</select><label class="lbl">Duración de la transición</label><div class="rangeval"><input type="range" min="0.2" max="2" step="0.1" data-k="transDur"><span data-v="transDur"></span></div>`, 'transition,transDur')}
        ${sec('Texto en pantalla', `<textarea data-k="text" rows="3" placeholder="Título, subtítulo o frase clave…"></textarea>
          <div class="grid2"><div><label class="lbl">Estilo</label><select data-k="textStyle">${R.opts(R.TEXT_STYLES)}</select></div><div><label class="lbl">Animación</label><select data-k="textAnim">${R.opts(R.TEXT_ANIMS)}</select></div></div>
          <div class="row" style="margin-top:10px"><input type="color" data-k="textColor"><span class="muted small">Color del texto</span></div>`, 'textStyle,textAnim,textColor')}`;
    } else if (E.selType === 'audio' && (obj = audById(E.sel))) {
      const a = obj, m = F.media.byId(a.mediaId);
      el.innerHTML = `<h4>${I(a.kind === 'musica' ? 'music' : 'mic')} Pista de audio</h4><div class="muted small">${F.esc(m?.name || '(eliminado)')} · ${F.fmtS(m?.duration)}</div>
        ${m ? `<audio controls src="${F.media.url(m)}" style="width:100%;margin-top:12px;height:36px"></audio>` : ''}
        ${sec('Ajustes', `<label class="lbl">Tipo de pista</label><select data-k="kind"><option value="voz">Voz / narración</option><option value="musica">Música de fondo</option><option value="sfx">Efecto de sonido</option></select>
          <label class="lbl">Volumen</label><div class="rangeval"><input type="range" min="0" max="1.5" step="0.05" data-k="volume"><span data-v="volume"></span></div>
          <label class="lbl">Empieza en (segundos)</label><input type="number" min="0" step="0.1" data-k="start">
          <label class="check"><input type="checkbox" data-k="loop"> Repetir en bucle hasta el final</label>
          <label class="check"><input type="checkbox" data-k="fadeOut"> Desvanecer al final del video</label>`)}
        <div class="row" style="margin-top:16px"><button class="btn sm danger" data-act="del">${I('trash')} Quitar pista</button></div>`;
    } else {
      obj = p;
      const tot = total(), [W, H] = R.SIZES[p.aspect];
      el.innerHTML = `<h4>${I('film')} Proyecto</h4><div class="muted small">Selecciona un clip o pista para editarlo</div>
        <div class="grid2" style="margin-top:12px;gap:8px">
          <div class="stat" style="padding:10px 12px"><div><b style="font-size:16px">${F.fmtS(tot)}</b><span>Duración</span></div></div>
          <div class="stat" style="padding:10px 12px"><div><b style="font-size:16px">${p.clips.length}</b><span>Clips</span></div></div>
        </div>
        ${sec('General', `<label class="lbl">Nombre</label><input type="text" data-k="name"><label class="lbl">FPS de exportación</label><select data-k="fps"><option value="24">24 fps (cine)</option><option value="30">30 fps (estándar)</option><option value="60">60 fps (fluido)</option></select><div class="hint">Resolución de salida: ${W}×${H}</div>`)}
        ${sec('Superposiciones', `<label class="lbl">Marca de agua / nombre del canal</label><input type="text" data-k="watermark" placeholder="@TuCanal">
          <label class="check"><input type="checkbox" data-k="letterbox"> Barras de cine</label>
          <label class="check"><input type="checkbox" data-k="progressBar"> Barra de progreso naranja</label>
          <label class="check"><input type="checkbox" data-k="duck"> Bajar la música cuando habla la voz</label>`)}
        ${sec('Atajos', `<div class="small muted" style="line-height:2"><kbd>Espacio</kbd> reproducir/pausar<br><kbd>S</kbd> dividir clip en el cursor<br><kbd>T</kbd> escribir texto en el clip<br><kbd>Ctrl+D</kbd> duplicar clip<br><kbd>Inicio</kbd> / <kbd>Fin</kbd> ir al principio / final<br><kbd>Supr</kbd> eliminar seleccionado<br><kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd> deshacer / rehacer<br><kbd>←</kbd> <kbd>→</kbd> mover 1 s (<kbd>Shift</kbd> 5 s)</div>`)}`;
    }
    el.querySelectorAll('[data-k]').forEach((inp) => {
      const v = obj[inp.dataset.k];
      if (inp.type === 'checkbox') inp.checked = !!v; else inp.value = v ?? '';
    });
    el.querySelectorAll('[data-v]').forEach((s) => (s.textContent = rangeTxt(s.dataset.v, obj[s.dataset.v])));
  }
  function inspTarget() {
    if (E.selType === 'clip') return clipById(E.sel);
    if (E.selType === 'audio') return audById(E.sel);
    return p;
  }

  async function pickImage() {
    const imgs = F.media.images();
    if (!imgs.length) { F.toast('No hay imágenes en la biblioteca'); return null; }
    return new Promise((res) => {
      const m = F.modal({ title: 'Elegir imagen', wide: true, onClose: () => res(null),
        body: `<div class="img-grid">${imgs.map((x) => `<div class="tile wide" data-pick="${x.id}" style="cursor:pointer"><img src="${F.media.url(x)}" alt=""></div>`).join('')}</div>` });
      m.el.addEventListener('click', (e) => { const t = e.target.closest('[data-pick]'); if (t) { res(t.dataset.pick); m.close(); } });
    });
  }

  async function splitAtPlayhead() {
    let t = E.t; const v = p.audio.find((x) => x.kind === 'voz' && !x.loop);
    if (v && F.golden?.pausePoints) {   // regla de la skill: el corte cae en el silencio más cercano (1,5 s)
      try {
        const snap = F.golden.nearestPause(await F.golden.pausePoints(E, v), t, 1.5);
        if (snap !== null) t = F.round1(snap);
        else if (!(await F.confirm('Aquí hay voz', 'No hay un silencio a menos de 1,5 s. Un corte a mitad de palabra se oye aunque la imagen sea impecable. ¿Cortar igual?', 'Cortar igual', false))) return;
      } catch (err) { /* sin análisis: se corta donde está el cursor */ }
    }
    const { items } = R.layout(p);
    const it = items.find((x) => t > x.start + 0.25 && t < x.end - 0.25);
    if (!it) return F.toast('Coloca el cursor dentro de un clip (a más de 0,25 s de sus bordes) para dividirlo');
    commit();
    const c = it.clip, d1 = F.round1(t - it.start), d2 = Math.max(0.5, F.round1(c.duration - d1));
    const n = { ...c, id: F.uid(), duration: d2, text: '' };
    n.transition = c.transition; c.duration = d1; c.transition = 'none'; delete c.capTimes; delete n.capTimes;
    p.clips.splice(p.clips.indexOf(c) + 1, 0, n);
    select('clip', n.id, false); after({ insp: true });
    F.toast(t !== E.t ? 'Clip dividido en el silencio más cercano' : 'Clip dividido', 'ok', 1400);
  }

  /** clip seleccionado o, si no hay, el que está bajo el cursor */
  function targetClip() {
    if (E.selType === 'clip' && clipById(E.sel)) return clipById(E.sel);
    const it = R.layout(p).items.find((x) => E.t >= x.start && E.t < x.end); return it?.clip || p.clips[0];
  }
  async function quickText() {
    const c = targetClip(); if (!c) return F.toast('Añade una imagen primero');
    const v = await F.prompt('Texto en pantalla', c.text || '', 'Escribe el texto. Déjalo vacío para quitarlo.'); if (v === null) return;
    commit(); c.text = F.golden ? F.golden.cleanText(v) : v;
    if (c.text) { c.textStyle = c.textStyle || 'subtitulo'; if (!c.textAnim || c.textAnim === 'none') c.textAnim = 'words'; }
    select('clip', c.id, false); after({ insp: true });
  }

  function deleteSelected() {
    if (E.selType === 'clip') { commit(); p.clips = p.clips.filter((c) => c.id !== E.sel); }
    else if (E.selType === 'audio') { commit(); p.audio = p.audio.filter((a) => a.id !== E.sel); }
    else return;
    select(null, null, false); after({ insp: true });
  }

  E.openProjects = () => {
    const list = F.projects.list;
    const m = F.modal({ title: 'Proyectos', wide: true,
      body: `<div class="row" style="margin-bottom:14px"><button class="btn primary sm" data-new>${I('plus')} Nuevo proyecto</button></div>
      <div class="projs">${list.map((x) => { const th = F.projects.thumb(x); return `<div class="pcard" data-open="${x.id}" style="${x.id === p.id ? 'border-color:var(--or)' : ''}"><div class="th" style="${th ? `background-image:url('${th}')` : ''}">${th ? '' : I('film')}<span class="tag or fmt">${x.aspect}</span><span class="dur">${F.fmtS(F.projects.duration(x))}</span></div><div class="bd"><div style="min-width:0;flex:1"><b>${F.esc(x.name)}</b><small>${F.ago(x.updated)}</small></div></div></div>`; }).join('')}</div>` });
    m.el.addEventListener('click', (e) => {
      const o = e.target.closest('[data-open]');
      if (o) { F.projects.setCurrent(o.dataset.open); m.close(); F.router.reload(); }
      if (e.target.closest('[data-new]')) { m.close(); F.views.newProject(); }
    });
  };

  /* ---------- eventos ---------- */
  function bind() {
    q('#binTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; E.binTab = b.dataset.t; q('#binTabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); renderBin(); });
    q('#binUp').onclick = () => upload(false);
    q('#eUp').onclick = () => upload(true);
    q('#bAddImg').onclick = () => upload(true);
    q('#bAddAud').onclick = async () => { const f = await F.pickFiles('audio/*'); if (!f.length) return; const added = await F.media.addFiles(f); added.forEach((m) => addMedia(m.id, null, 'musica', 0)); };
    const bin = q('#bin');
    bin.addEventListener('click', (e) => { const a = e.target.closest('[data-add]'); if (a) addMedia(a.dataset.add); if (e.target.closest('[data-up]')) upload(false); });
    bin.addEventListener('click', (e) => { const b = e.target.closest('[data-pre]'); if (b) { const [k, v] = b.dataset.pre.split(':'); applyPreset(k, v); } });
    bin.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'preAll') { E.applyAll = t.checked; return; }
      const k = t.dataset.proj; if (!k) return;
      commit(); p[k] = t.type === 'checkbox' ? t.checked : t.value.trim(); after({ insp: true });
    });
    bin.addEventListener('dblclick', (e) => { const a = e.target.closest('[data-m]'); if (a) addMedia(a.dataset.m); });
    bin.addEventListener('dragstart', (e) => { const a = e.target.closest('[data-m]'); if (!a) return; e.dataTransfer.setData('text/media', a.dataset.m); e.dataTransfer.effectAllowed = 'copy'; });

    q('#pName').addEventListener('change', (e) => { commit(); p.name = e.target.value.trim() || 'Proyecto sin título'; after({ insp: true }); F.emit('projects'); });
    q('#pAspect').addEventListener('change', (e) => { commit(); p.aspect = e.target.value; sizeCanvas(); after(); });
    q('#bUndo').onclick = undo; q('#bRedo').onclick = redo; updUndo();
    q('#bExport').onclick = async () => { stop(); await F.projects.save(p); F.exportProject(p, { fps: p.fps || 30, format: 'mp4', quality: 'high' }); };
    q('#bProj').onclick = () => E.openProjects();
    q('#tPlay').onclick = play;
    q('#tMute').onclick = () => { E.muted = !E.muted; q('#tMute').classList.toggle('on', E.muted); q('#tMute').style.opacity = E.muted ? '1' : ''; F.toast(E.muted ? 'Sonido apagado: mira si se entiende sin audio (el 85 % ve sin sonido)' : 'Sonido encendido', 'ok', 2200); if (E.playing) seek(E.t); };
    q('#tStart').onclick = () => { seek(0); q('#tlScroll').scrollLeft = 0; };
    q('#tlZoom').addEventListener('input', (e) => { E.pps = +e.target.value; renderTimeline(); });
    q('#bDel').onclick = deleteSelected;
    q('#bSplit').onclick = splitAtPlayhead;
    q('#bText').onclick = quickText;
    q('#bDup').onclick = () => { const c = targetClip(); if (!c) return; commit(); const d = { ...c, id: F.uid() }; p.clips.splice(p.clips.indexOf(c) + 1, 0, d); select('clip', d.id, false); after({ insp: true }); };
    q('#bAuto').onclick = () => { stop(); if (F.golden) F.golden.auto(E); };
    /* arrastrar imágenes o audios desde el escritorio a cualquier parte del editor */
    const ed = q('.editor'), hasFiles = (ev) => [...(ev.dataTransfer?.types || [])].includes('Files');
    ed.addEventListener('dragover', (ev) => { if (hasFiles(ev)) { ev.preventDefault(); ed.classList.add('dropping'); } });
    ed.addEventListener('dragleave', (ev) => { if (!ed.contains(ev.relatedTarget)) ed.classList.remove('dropping'); });
    ed.addEventListener('drop', (ev) => { ed.classList.remove('dropping'); if (!hasFiles(ev)) return; ev.preventDefault(); ev.stopPropagation(); upload(true, [...ev.dataTransfer.files]); });
    q('#bFit').onclick = () => {
      const voices = p.audio.filter((a) => a.kind === 'voz' && !a.loop);
      if (!voices.length) return F.toast('Añade primero una pista de voz / narración');
      if (!p.clips.length) return F.toast('Añade imágenes al timeline');
      const end = Math.max(...voices.map((a) => a.start + (F.media.byId(a.mediaId)?.duration || 0))) + 0.5;
      const f = end / total();
      commit(); p.clips.forEach((c) => (c.duration = Math.max(0.5, F.round1(c.duration * f))));
      after({ insp: true }); F.toast(`Clips ajustados a ${F.fmtS(end)} de narración`, 'ok');
    };
    q('#bUni').onclick = async () => {
      if (!p.clips.length) return;
      const v = await F.prompt('Duración uniforme', '4', 'Segundos por clip'); const n = parseFloat(String(v).replace(',', '.'));
      if (!n || n < 0.5) return;
      commit(); p.clips.forEach((c) => (c.duration = F.round1(n))); after({ insp: true });
    };

    /* inspector */
    const insp = q('#insp');
    insp.addEventListener('focusin', (e) => { if (e.target.dataset.k) commit(true); });
    insp.addEventListener('input', (e) => {
      const k = e.target.dataset.k; if (!k) return;
      const obj = inspTarget(); if (!obj) return;
      let v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (e.target.type === 'number' || e.target.type === 'range' || k === 'fps') { v = parseFloat(v); if (isNaN(v)) return; }
      if (k === 'duration') v = Math.max(0.5, v);
      if (k === 'start') v = Math.max(0, v);
      obj[k] = v;
      const sv = insp.querySelector(`[data-v="${k}"]`); if (sv) sv.textContent = rangeTxt(k, v);
      if (k === 'name') q('#pName').value = v;
      after();
    });
    insp.addEventListener('click', async (e) => {
      const all = e.target.closest('[data-all]');
      if (all) {
        const c = clipById(E.sel); if (!c) return;
        const ks = all.dataset.all.split(',');
        commit(); p.clips.forEach((x) => ks.forEach((k) => (x[k] = c[k]))); after();
        F.toast('Aplicado a todos los clips', 'ok'); return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'del') deleteSelected();
      if (act === 'left' || act === 'right') {
        const c = clipById(E.sel); if (!c) return;
        const i = p.clips.indexOf(c), j = i + (act === 'left' ? -1 : 1);
        if (j < 0 || j >= p.clips.length) return;
        commit(); p.clips.splice(i, 1); p.clips.splice(j, 0, c); after({ insp: true });
      }
      if (act === 'dup') { const c = clipById(E.sel); if (!c) return; commit(); const d = { ...c, id: F.uid() }; p.clips.splice(p.clips.indexOf(c) + 1, 0, d); select('clip', d.id, false); after({ insp: true }); }
      if (act === 'replace') { const id = await pickImage(); const c = clipById(E.sel); if (id && c) { commit(); c.mediaId = id; F.media.image(id).catch(() => {}); after({ insp: true }); } }
    });

    /* timeline */
    const inner = q('#tlInner'), tv = q('#trackV');
    const xOf = (e) => e.clientX - inner.getBoundingClientRect().left;
    let ind = null, resizing = false;
    const showInd = (x) => { if (!ind) { ind = document.createElement('div'); ind.className = 'drop-ind'; } ind.style.left = x - 1 + 'px'; tv.appendChild(ind); };
    const hideInd = () => ind?.remove();
    const indexAt = (x) => { const { items } = R.layout(p); for (let i = 0; i < items.length; i++) if (x < (items[i].start + items[i].clip.duration / 2) * E.pps) return i; return items.length; };
    const indX = (i) => { const { items, total: tot } = R.layout(p); return (i < items.length ? items[i].start : tot) * E.pps; };

    tv.addEventListener('click', (e) => {
      if (e.target.closest('.clip-handle')) return;
      const c = e.target.closest('[data-c]');
      if (c) { select('clip', c.dataset.c); const it = R.layout(p).items.find((x) => x.clip.id === c.dataset.c); if (it && !E.playing) seek(it.start + 0.01); }
      else { select(null, null); seek(xOf(e) / E.pps); }
    });
    tv.addEventListener('pointerdown', (e) => {
      const h = e.target.closest('[data-h]'); if (!h) return;
      e.preventDefault(); e.stopPropagation();
      const c = clipById(h.dataset.h); if (!c) return;
      commit(); resizing = true;
      const x0 = e.clientX, d0 = c.duration;
      const mv = (ev) => { c.duration = Math.max(0.5, F.round1(d0 + (ev.clientX - x0) / E.pps)); renderTimeline(); draw(); updateTime(); };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); setTimeout(() => (resizing = false), 0); saveSoon(); if (E.sel === c.id) renderInspector(); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    tv.addEventListener('dragstart', (e) => {
      if (resizing || e.target.closest('.clip-handle')) { e.preventDefault(); return; }
      const c = e.target.closest('[data-c]'); if (!c) return;
      e.dataTransfer.setData('text/clip', c.dataset.c); e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => c.classList.add('dragging'), 0);
    });
    tv.addEventListener('dragend', () => { hideInd(); tv.querySelectorAll('.dragging').forEach((x) => x.classList.remove('dragging')); });
    tv.addEventListener('dragover', (e) => { e.preventDefault(); showInd(indX(indexAt(xOf(e)))); });
    tv.addEventListener('dragleave', (e) => { if (!tv.contains(e.relatedTarget)) hideInd(); });
    tv.addEventListener('drop', (e) => {
      e.preventDefault(); hideInd();
      const idx = indexAt(xOf(e));
      const mid = e.dataTransfer.getData('text/media'), cid = e.dataTransfer.getData('text/clip');
      if (mid) { const m = F.media.byId(mid); if (m?.type === 'image') addMedia(mid, idx); else if (m) addMedia(mid, null, 'voz', F.round1(xOf(e) / E.pps)); }
      else if (cid) {
        const from = p.clips.findIndex((c) => c.id === cid); if (from < 0) return;
        let to = idx; if (to > from) to--; if (to === from) return;
        commit(); const [c] = p.clips.splice(from, 1); p.clips.splice(to, 0, c); after();
      }
    });

    for (const tr of [q('#trackA'), q('#trackM')]) {
      tr.addEventListener('dragover', (e) => e.preventDefault());
      tr.addEventListener('drop', (e) => {
        e.preventDefault(); const mid = e.dataTransfer.getData('text/media'); const m = F.media.byId(mid);
        if (m?.type === 'audio') addMedia(mid, null, tr.dataset.kind, F.round1(Math.max(0, xOf(e) / E.pps)));
        else if (m) F.toast('Suelta las imágenes en la pista de VIDEO');
      });
      tr.addEventListener('pointerdown', (e) => {
        const el = e.target.closest('[data-a]');
        if (!el) { select(null, null); seek(xOf(e) / E.pps); return; }
        const a = audById(el.dataset.a); if (!a) return;
        select('audio', a.id);
        const x0 = e.clientX, s0 = a.start; let moved = false;
        const mv = (ev) => { const dx = ev.clientX - x0; if (!moved && Math.abs(dx) < 4) return; if (!moved) { commit(); moved = true; } a.start = Math.max(0, F.round1(s0 + dx / E.pps)); renderTimeline(); };
        const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) { saveSoon(); renderInspector(); } };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
    }
    q('#ruler').addEventListener('pointerdown', (e) => {
      seek(xOf(e) / E.pps);
      const mv = (ev) => seek(xOf(ev) / E.pps);
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
  }

  function keys(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || document.querySelector('.modal-bg')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.code === 'Space') { e.preventDefault(); play(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
    else if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (ctrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
    else if (e.key.toLowerCase() === 't' && !ctrl) { e.preventDefault(); quickText(); }
    else if (e.key.toLowerCase() === 's' && !ctrl) { e.preventDefault(); splitAtPlayhead(); }
    else if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); const b = root.querySelector('[data-act="dup"]'); if (b) b.click(); }
    else if (e.key === 'Home') { e.preventDefault(); seek(0); }
    else if (e.key === 'End') { e.preventDefault(); seek(total()); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); seek(E.t + (e.shiftKey ? 5 : 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(E.t - (e.shiftKey ? 5 : 1)); }
  }
})();
