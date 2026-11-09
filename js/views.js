/* FRAMALY — Secciones: Inicio, Guiones, Imágenes, Voces, Efectos, Biblioteca, Publicar, Integraciones */
(function () {
  'use strict';
  const R = F.R, I = F.icon;
  const V = (F.views = {});
  const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem('framaly.' + k) || '{}') }; } catch (e) { return { ...d }; } };
  const store = (k, v) => { try { localStorage.setItem('framaly.' + k, JSON.stringify(v)); } catch (e) {} };
  const opt = (pairs, sel) => pairs.map(([v, n]) => `<option value="${F.esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${F.esc(n)}</option>`).join('');

  /* ---------- piezas compartidas ---------- */
  V.tile = (m, wide = true) => `<div class="tile ${wide ? 'wide' : ''}" data-id="${m.id}"><img src="${F.media.thumb(m)}" alt="" loading="lazy">${m.type === 'video' ? `<span class="tag or">${F.fmtS(m.duration)}</span>` : ''}${m.source === 'ai' ? '<span class="tag or ai">IA</span>' : ''}
    <div class="ov"><div class="nm">${F.esc(m.name)}</div><div class="row"><button class="btn sm primary" data-add="${m.id}" title="Añadir al editor">${I('plus')} Editor</button><button class="btn sm" data-view="${m.id}" title="Ver">${I('eye')}</button><button class="btn sm" data-dl="${m.id}" title="Descargar">${I('download')}</button><button class="btn sm danger" data-del="${m.id}" title="Eliminar">${I('trash')}</button></div></div></div>`;
  V.audioItem = (m) => `<div class="aitem" data-id="${m.id}"><div class="ic">${I(m.source === 'ai' ? 'mic' : 'music')}</div><div class="meta"><b>${F.esc(m.name)}</b><small>${F.fmtS(m.duration)} · ${F.bytes(m.size || m.blob?.size || 0)} · ${m.source === 'ai' ? 'Voz IA' : 'Subido'}</small></div>
    <audio controls preload="none" src="${F.media.url(m)}"></audio>
    <div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm" data-addv="${m.id}" title="Añadir como voz">${I('plus')} Voz</button><button class="btn sm" data-addm="${m.id}" title="Añadir como música">${I('plus')} Música</button><button class="icon-btn" data-ren="${m.id}" title="Renombrar">${I('edit')}</button><button class="icon-btn" data-dl="${m.id}" title="Descargar">${I('download')}</button><button class="icon-btn" data-del="${m.id}" title="Eliminar">${I('trash')}</button></div></div>`;
  V.mediaActions = (container) => container.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-add],[data-addv],[data-addm],[data-dl],[data-del],[data-view],[data-ren]'); if (!b) return;
    const id = b.dataset.add || b.dataset.addv || b.dataset.addm || b.dataset.dl || b.dataset.del || b.dataset.view || b.dataset.ren;
    const m = F.media.byId(id); if (!m) return;
    if (b.dataset.add) F.addToEditor(id);
    else if (b.dataset.addv) F.addToEditor(id, 'voz');
    else if (b.dataset.addm) F.addToEditor(id, 'musica');
    else if (b.dataset.dl) F.download(m.blob, F.safeName(m.name) + (m.type === 'image' ? '.png' : m.type === 'video' ? '.mp4' : '.mp3'));
    else if (b.dataset.ren) { const n = await F.prompt('Renombrar', m.name, 'Nuevo nombre'); if (n) F.media.rename(id, n); }
    else if (b.dataset.del) { if (await F.confirm('Eliminar archivo', `¿Eliminar "${F.esc(m.name)}" de la biblioteca? Si se usa en un proyecto dejará de verse.`, 'Eliminar')) { await F.media.remove(id); F.toast('Eliminado'); } }
    else if (b.dataset.view) F.modal({ title: m.name, wide: true, body: `${m.type === 'video' ? `<video src="${F.media.url(m)}" controls playsinline style="width:100%;border-radius:12px;display:block;max-height:70vh;background:#000"></video>` : `<img src="${F.media.url(m)}" style="width:100%;border-radius:12px;display:block">`}${m.meta?.prompt ? `<p class="hint" style="margin-top:12px"><b>Prompt:</b> ${F.esc(m.meta.prompt)}</p>` : ''}`, actions: [{ label: `${I('plus')} Añadir al editor`, primary: true, onClick: () => F.addToEditor(id) }] });
  });

  /* ---------- Nuevo proyecto ---------- */
  V.newProject = () => {
    let aspect = '16:9';
    const sh = { '16:9': [44, 25], '9:16': [22, 38], '1:1': [32, 32], '4:5': [30, 37] };
    const m = F.modal({ title: 'Nuevo proyecto',
      body: `<label class="lbl">Nombre</label><input type="text" id="npName" value="Nuevo video"><label class="lbl">Formato</label>
      <div class="fmt-pick">${R.ASPECTS.map(([v, n]) => `<div class="fmt-opt ${v === aspect ? 'on' : ''}" data-v="${v}"><div class="shape" style="width:${sh[v][0]}px;height:${sh[v][1]}px"></div><b>${v}</b><small>${n.split(' ')[0]}</small></div>`).join('')}</div>`,
      actions: [{ label: 'Cancelar' }, { label: 'Crear proyecto', primary: true, onClick: async (w) => { await F.projects.create(w.querySelector('#npName').value.trim() || 'Nuevo video', aspect); F.router.go('#/editor'); } }] });
    m.el.addEventListener('click', (e) => { const o = e.target.closest('.fmt-opt'); if (o) { aspect = o.dataset.v; m.el.querySelectorAll('.fmt-opt').forEach((x) => x.classList.toggle('on', x === o)); } });
    const n = m.q('#npName'); n.focus(); n.select();
  };

  /* =================== INICIO =================== */
  V.inicio = (el) => {
    const ps = F.projects.list;
    const au = load('auto', { topic: '', aspect: '16:9', duration: 60, style: 'cine', exportAfter: true });
    const mods = [
      ['editor', 'film', 'Editor de video', 'Timeline profesional con transiciones, movimiento y textos'],
      ['flujos', 'workflow', 'Flujos y agentes', 'Idea → guion → imágenes → voz → video, en automático'],
      ['guiones', 'script', 'Guiones IA', 'Guiones por escenas con Claude o GPT'],
      ['imagenes', 'image', 'Imágenes IA', 'Escenas, fondos y miniaturas con IA'],
      ['voces', 'mic', 'Voces IA', 'Narraciones naturales con OpenAI y ElevenLabs'],
      ['efectos', 'layers', 'Efectos', '14 transiciones, filtros de color y animaciones'],
      ['biblioteca', 'folder', 'Biblioteca', 'Tus imágenes, voces y música en un lugar'],
      ['publicar', 'youtube', 'Publicar', 'Exporta en MP4 y sube a YouTube con SEO'],
    ];
    const mods2 = mods.filter(([id]) => F.cloud?.can(id) !== false);
    const canInt = F.cloud?.can('integraciones') !== false;
    el.innerHTML = `<div class="page">
      <section class="hero"><div>
        <span class="pill">${I('sparkles')} Estudio de video con IA</span>
        <h1>Convierte ideas en videos <span class="grad-t">listos para YouTube</span></h1>
        <p>Escribe tu idea y pulsa un botón: los agentes escriben el guion, crean las imágenes, narran, montan con transiciones y exportan el MP4. Todo en automático.</p>
        <div class="auto-box">
          <div class="row" style="margin-bottom:8px"><b>${I('zap')} Modo automático</b><span class="grow"></span><span class="small muted" id="aState"></span></div>
          <textarea id="aTopic" rows="2" placeholder="¿De qué trata tu video? Ej: 5 curiosidades increíbles sobre los pulpos">${F.esc(au.topic)}</textarea>
          <div class="auto-row">
            <select id="aFmt" title="Formato">${opt(R.ASPECTS, au.aspect)}</select>
            <select id="aDur" title="Duración">${opt([[30, '30 segundos'], [60, '1 minuto'], [90, '1,5 minutos'], [120, '2 minutos'], [180, '3 minutos'], [300, '5 minutos']], au.duration)}</select>
            <select id="aSty" title="Estilo visual">${opt(Object.entries(F.STYLES).filter(([k]) => k !== 'ninguno').map(([k, v]) => [k, v.name]), au.style)}</select>
          </div>
          <label class="check"><input type="checkbox" id="aExp" ${au.exportAfter ? 'checked' : ''}> Exportar el MP4 automáticamente al terminar</label>
          <div class="row"><button class="btn primary lg" id="aGo">${I('zap')} Crear video automático</button><span class="small muted" id="aCost"></span></div>
        </div>
        <div class="small muted" style="margin-top:12px">¿Prefieres control total? <a href="#/flujos">Flujos y agentes</a> · <a href="#" data-new>Proyecto manual</a></div>
      </div>
      <div class="flowviz">${[['zap', 'Idea', 'Tu tema en una frase'], ['script', 'Guion', 'Escenas con gancho y llamada a la acción'], ['image', 'Imágenes', 'Una por escena, con estilo coherente'], ['mic', 'Voz', 'Narración natural sincronizada'], ['film', 'Montaje', 'Transiciones, movimiento y subtítulos'], ['youtube', 'YouTube', 'MP4 + SEO + miniatura']].map(([ic, b, s], i) => `<div class="fv-step" style="animation-delay:${i * 0.08}s"><div class="ic">${I(ic)}</div><div><b>${b}</b><small>${s}</small></div><span class="st">${I('check')}</span></div>`).join('')}</div></section>
      <div class="stats">${[['film', ps.length, 'Proyectos'], ['image', F.media.images().length, 'Imágenes'], ['mic', F.media.audios().length, 'Audios'], ['sparkles', F.media.list.filter((m) => m.source === 'ai').length, 'Creados con IA']].map(([ic, n, l]) => `<div class="stat"><div class="ic">${I(ic)}</div><div><b>${n}</b><span>${l}</span></div></div>`).join('')}</div>
      ${canInt && !F.api.textReady() ? `<div class="notice" style="margin-top:18px">${I('key')}<div><b>Conecta tus APIs para activar la IA.</b> Añade tu key de OpenAI (imágenes y voz) y de Anthropic o OpenAI (guiones). El editor funciona sin ellas con tus propias imágenes. <a href="#/integraciones">Configurar ahora →</a></div></div>` : ''}
      <h2 class="sec-t">Módulos <span class="line"></span></h2>
      <div class="mods">${mods2.map(([id, ic, b, p]) => `<a class="mod" href="#/${id}"><div class="ic">${I(ic)}</div><b>${b}</b><p>${p}</p></a>`).join('')}</div>
      <h2 class="sec-t">Proyectos recientes <span class="line"></span><button class="btn sm" data-new>${I('plus')} Nuevo</button></h2>
      <div class="projs">${ps.length ? ps.map((p) => { const th = F.projects.thumb(p); return `<div class="pcard" data-open="${p.id}"><div class="th" style="${th ? `background-image:url('${th}')` : ''}">${th ? '' : I('film')}<span class="tag or fmt">${p.aspect}</span><span class="dur">${F.fmtS(F.projects.duration(p))}</span></div><div class="bd"><div style="min-width:0;flex:1"><b>${F.esc(p.name)}</b><small>${p.clips.length} clips · ${F.ago(p.updated)}</small></div><button class="icon-btn" data-delp="${p.id}" title="Eliminar proyecto">${I('trash')}</button></div></div>`; }).join('') : `<div class="empty" style="grid-column:1/-1">${I('film')}<p>Todavía no tienes proyectos.</p><div class="row" style="justify-content:center"><button class="btn" data-demo>${I('eye')} Cargar proyecto de ejemplo</button><button class="btn primary" data-new>${I('plus')} Crear el primero</button></div></div>`}</div>
    </div>`;
    const q = (s) => el.querySelector(s);
    const autoInfo = () => {
      const miss = F.auto.missing();
      q('#aState').innerHTML = miss.length ? `<span class="dot"></span>Falta conectar APIs` : `<span class="dot ok"></span>Listo para crear`;
      const n = F.clamp(Math.round(au.duration / 7), 3, 30);
      q('#aCost').textContent = `${n} escenas · ≈ US$${(n * 0.063 + au.duration * 15 * 0.000015 + 0.03).toFixed(2)}`;
    };
    autoInfo();
    q('#aTopic').addEventListener('input', (e) => { au.topic = e.target.value; store('auto', au); });
    for (const [id, k] of [['#aFmt', 'aspect'], ['#aDur', 'duration'], ['#aSty', 'style']]) q(id).addEventListener('change', (e) => { au[k] = k === 'duration' ? +e.target.value : e.target.value; store('auto', au); autoInfo(); });
    q('#aExp').addEventListener('change', (e) => { au.exportAfter = e.target.checked; store('auto', au); });
    q('#aGo').onclick = () => F.auto.run(au);
    q('#aTopic').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) F.auto.run(au); });
    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-new]')) { e.preventDefault(); return V.newProject(); }
      if (e.target.closest('[data-demo]')) { await F.seedDemo(); F.toast('Proyecto de ejemplo cargado', 'ok'); return F.router.go('#/editor'); }
      const d = e.target.closest('[data-delp]');
      if (d) { e.stopPropagation(); const p = F.projects.get(d.dataset.delp); if (p && (await F.confirm('Eliminar proyecto', `¿Eliminar "${F.esc(p.name)}"? Las imágenes y audios seguirán en la biblioteca.`, 'Eliminar'))) { await F.projects.remove(p.id); F.router.reload(); } return; }
      const o = e.target.closest('[data-open]');
      if (o) { F.projects.setCurrent(o.dataset.open); F.router.go('#/editor'); }
    });
  };

  /* =================== GUIONES =================== */
  V.guiones = (el) => {
    const st = load('script', { topic: '', duration: 90, scenes: 0, tone: 'informativo y entretenido', audience: 'público general', language: 'español', provider: 'auto', aspect: '16:9', style: 'cine', voice: 'nova', subtitles: 'narracion', script: null });
    const save = () => store('script', st);
    const tones = ['informativo y entretenido', 'misterioso e intrigante', 'motivacional e inspirador', 'humorístico y cercano', 'educativo y claro', 'épico y dramático', 'emotivo y narrativo', 'enérgico estilo viral'];
    el.innerHTML = `<div class="page"><div class="split">
      <div class="card sticky"><h2>${I('script')} Agente Guionista</h2><p class="desc">Escribe guiones con estructura de retención: gancho, desarrollo por escenas y cierre con llamada a la acción.</p>
        <label class="lbl">Tema del video</label><textarea id="gTopic" rows="3" placeholder="Ej: La historia secreta del chocolate">${F.esc(st.topic)}</textarea>
        <div class="grid2"><div><label class="lbl">Duración (segundos)</label><input type="number" id="gDur" min="10" max="900" step="5" value="${st.duration}"></div><div><label class="lbl">Escenas (0 = auto)</label><input type="number" id="gSc" min="0" max="40" value="${st.scenes}"></div></div>
        <label class="lbl">Tono</label><select id="gTone">${opt(tones.map((t) => [t, t[0].toUpperCase() + t.slice(1)]), st.tone)}</select>
        <div class="grid2"><div><label class="lbl">Público</label><input type="text" id="gAud" value="${F.esc(st.audience)}"></div><div><label class="lbl">Idioma</label><input type="text" id="gLang" value="${F.esc(st.language)}"></div></div>
        <label class="lbl">Modelo de texto</label><select id="gProv">${opt([['auto', 'Según Integraciones'], ['anthropic', 'Claude (Anthropic)'], ['openai', 'OpenAI GPT'], ['gemini', 'Gemini (Google)'], ['minimax', 'MiniMax']], st.provider)}</select>
        <button class="btn primary block lg" id="gGo" style="margin-top:18px">${I('sparkles')} Escribir guion</button>
      </div>
      <div id="gOut"></div></div></div>`;
    const out = el.querySelector('#gOut');
    const bindForm = () => {
      const map = { gTopic: 'topic', gDur: 'duration', gSc: 'scenes', gTone: 'tone', gAud: 'audience', gLang: 'language', gProv: 'provider' };
      for (const [id, k] of Object.entries(map)) el.querySelector('#' + id).addEventListener('input', (e) => { st[k] = e.target.type === 'number' ? +e.target.value : e.target.value; save(); });
    };
    bindForm();
    const renderOut = () => {
      const s = st.script;
      if (!s) { out.innerHTML = `<div class="empty" style="padding:70px 20px">${I('script')}<p><b>Tu guion aparecerá aquí</b></p><p class="small">Escribe un tema y pulsa “Escribir guion”. Podrás editar cada escena antes de producir el video.</p></div>`; return; }
      const words = s.scenes.reduce((a, x) => a + x.narration.split(/\s+/).filter(Boolean).length, 0);
      out.innerHTML = `<div class="card"><label class="lbl">Título</label><input type="text" id="sTitle" value="${F.esc(s.title)}" style="font-size:16px;font-weight:700">
        <div class="row" style="margin:12px 0 4px"><span class="tag or">${s.scenes.length} escenas</span><span class="tag">${words} palabras</span><span class="tag">≈ ${F.fmtS(words / 2.4)} de narración</span><span class="grow"></span>
        <button class="btn sm" id="sCopy">${I('copy')} Copiar</button><button class="btn sm" id="sVoice">${I('mic')} Enviar a Voces</button></div></div>
        <div class="card" id="sScenes">${s.scenes.map((x, i) => `<div class="scene" data-i="${i}"><span class="n">${i + 1}</span><button class="icon-btn" data-rm="${i}" style="position:absolute;right:8px;top:8px" title="Quitar escena">${I('x')}</button>
          <label class="lbl">Narración</label><textarea data-k="narration" rows="3">${F.esc(x.narration)}</textarea>
          <div class="grid2"><div><label class="lbl">Prompt de imagen</label><textarea data-k="image_prompt" rows="2">${F.esc(x.image_prompt)}</textarea></div><div><label class="lbl">Texto en pantalla</label><textarea data-k="on_screen_text" rows="2">${F.esc(x.on_screen_text)}</textarea></div></div></div>`).join('')}
          <button class="btn sm" id="sAdd" style="margin-top:12px">${I('plus')} Añadir escena</button></div>
        <div class="card"><h3>${I('film')} Producir video con este guion</h3><p class="desc">Los agentes generarán una imagen y una narración por escena y montarán el timeline con transiciones.</p>
          <div class="grid2"><div><label class="lbl">Formato</label><select id="pAsp">${opt(R.ASPECTS, st.aspect)}</select></div><div><label class="lbl">Estilo visual</label><select id="pSty">${opt(Object.entries(F.STYLES).map(([k, v]) => [k, v.name]), st.style)}</select></div>
          <div><label class="lbl">Voz (OpenAI)</label><select id="pVoice">${opt([['', 'Sin voz'], ...F.api.OPENAI_VOICES.map((v) => [v, v])], st.voice)}</select></div><div><label class="lbl">Textos</label><select id="pSub">${opt([['narracion', 'Subtítulos de la narración'], ['pantalla', 'Frase clave por escena'], ['ninguno', 'Sin textos']], st.subtitles)}</select></div></div>
          <button class="btn primary lg block" id="pGo" style="margin-top:16px">${I('zap')} Generar video completo</button><p class="hint">Para más control (ElevenLabs, música, SEO) usa <a href="#/flujos">Flujos y agentes</a>.</p></div>`;
      out.querySelector('#sTitle').addEventListener('input', (e) => { s.title = e.target.value; save(); });
      out.querySelector('#sScenes').addEventListener('input', (e) => { const sc = e.target.closest('[data-i]'); if (sc && e.target.dataset.k) { s.scenes[+sc.dataset.i][e.target.dataset.k] = e.target.value; save(); } });
      out.querySelector('#sScenes').addEventListener('click', (e) => {
        const rm = e.target.closest('[data-rm]'); if (rm) { s.scenes.splice(+rm.dataset.rm, 1); save(); renderOut(); }
        if (e.target.closest('#sAdd')) { s.scenes.push({ narration: '', image_prompt: '', on_screen_text: '' }); save(); renderOut(); }
      });
      const full = () => s.scenes.map((x) => x.narration).join('\n\n');
      out.querySelector('#sCopy').onclick = () => { navigator.clipboard.writeText(`${s.title}\n\n${s.scenes.map((x, i) => `ESCENA ${i + 1}\n${x.narration}\n[Imagen: ${x.image_prompt}]`).join('\n\n')}`); F.toast('Guion copiado', 'ok'); };
      out.querySelector('#sVoice').onclick = () => { sessionStorage.setItem('framaly.voiceText', full()); F.router.go('#/voces'); };
      for (const [id, k] of [['pAsp', 'aspect'], ['pSty', 'style'], ['pVoice', 'voice'], ['pSub', 'subtitles']]) out.querySelector('#' + id).addEventListener('change', (e) => { st[k] = e.target.value; save(); });
      out.querySelector('#pGo').onclick = () => {
        const s2 = { title: s.title, scenes: s.scenes.filter((x) => x.narration.trim() || x.image_prompt.trim()) };
        if (!s2.scenes.length) return F.toast('El guion no tiene escenas');
        const fl = F.pipeline.makeFlow('youtube');
        Object.assign(fl.cfg.idea, { topic: st.topic || s.title, duration: st.duration, aspect: st.aspect, language: st.language });
        fl.cfg.images.style = st.style; fl.cfg.montage.subtitles = st.subtitles;
        fl.cfg.voice.voice = st.voice || 'nova'; fl.on.voice = !!st.voice; fl.on.seo = F.api.textReady();
        F.pipeline.runModal({ ...F.pipeline.cfgFrom(fl), script: { provider: st.provider }, presetScript: s2 }, { autoExport: true });
      };
    };
    renderOut();
    el.querySelector('#gGo').onclick = async (e) => {
      if (!st.topic.trim()) return F.toast('Escribe el tema del video');
      const b = e.currentTarget; F.busy(b, true, 'Escribiendo guion…');
      try { st.script = await F.pipeline.writeScript({ topic: st.topic, duration: st.duration, tone: st.tone, audience: st.audience, language: st.language }, { scenes: st.scenes, provider: st.provider }); save(); renderOut(); F.toast('Guion listo', 'ok'); }
      catch (err) { F.toast(err.message, 'error'); }
      F.busy(b, false);
    };
  };

  /* =================== IMÁGENES =================== */
  V.imagenes = (el) => {
    const st = load('img', { prompt: '', style: 'cine', size: '1536x1024', quality: 'medium', n: 1, provider: 'openai' });
    const save = () => store('img', st);
    el.innerHTML = `<div class="page"><div class="split">
      <div class="card sticky"><h2>${I('image')} Generador de imágenes</h2><p class="desc">Crea escenas, fondos y recursos para tus videos con <b id="iModel"></b>.</p>
        <label class="lbl">Describe la imagen</label><textarea id="iPrompt" rows="5" placeholder="Ej: un faro solitario en un acantilado durante una tormenta al atardecer">${F.esc(st.prompt)}</textarea>
        <div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap"><button class="btn sm outline" id="iEnh">${I('wand')} Mejorar prompt con IA</button><select id="iEnhP" style="width:auto" title="IA que mejora el prompt">${opt([['auto', 'IA: según Integraciones'], ['anthropic', 'IA: Claude'], ['openai', 'IA: OpenAI (ChatGPT)'], ['gemini', 'IA: Gemini'], ['minimax', 'IA: MiniMax']], st.enhProvider || 'auto')}</select></div>
        <label class="lbl">Generador</label><div class="seg" id="iProv">${[['openai', 'OpenAI'], ['gemini', 'Gemini'], ['minimax', 'MiniMax']].map(([k, n]) => `<button data-p="${k}" class="${k === st.provider ? 'on' : ''}">${n}</button>`).join('')}</div>
        <label class="lbl">Modelo de imagen</label><select id="iM"></select>
        <label class="lbl">Estilo</label><div class="chips" id="iSty">${Object.entries(F.STYLES).map(([k, v]) => `<button class="chip ${k === st.style ? 'on' : ''}" data-s="${k}">${v.name}</button>`).join('')}</div>
        <div class="grid3"><div><label class="lbl">Formato</label><select id="iSize">${opt([['1536x1024', 'Horizontal'], ['1024x1536', 'Vertical'], ['1024x1024', 'Cuadrado']], st.size)}</select></div>
        <div><label class="lbl">Calidad</label><select id="iQ">${opt([['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta']], st.quality)}</select></div>
        <div><label class="lbl">Cantidad</label><select id="iN">${opt([[1, '1'], [2, '2'], [3, '3'], [4, '4']], st.n)}</select></div></div>
        <button class="btn primary block lg" id="iGo" style="margin-top:18px">${I('sparkles')} Generar imágenes</button>
        <p class="hint" id="iCost"></p>
      </div>
      <div><div class="card"><h3>${I('sparkles')} Resultados</h3><div class="img-grid" id="iRes"><div class="empty" style="grid-column:1/-1">${I('image')}<p class="small">Las imágenes nuevas aparecerán aquí y se guardan automáticamente en la biblioteca.</p></div></div></div>
      <div class="card"><h3>${I('grid')} Galería IA <span class="grow"></span><a class="btn sm ghost" href="#/biblioteca">Ver biblioteca</a></h3><div class="img-grid" id="iGal"></div></div></div>
    </div></div>`;
    const IMG_KEY = { openai: 'image', gemini: 'geminiImage', minimax: 'minimaxImage' }, IMG_NAME = { openai: 'OpenAI', gemini: 'Gemini', minimax: 'MiniMax' };
    const IMG_LIST = { openai: ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini', 'dall-e-3', 'dall-e-2'], gemini: ['gemini-2.5-flash-image', 'gemini-2.0-flash-preview-image-generation'], minimax: ['image-01', 'image-01-live'] };
    // US$ por imagen [cuadrada, horizontal/vertical] según calidad. Son precios de referencia: pueden variar.
    const IMG_PRICE = {
      'gpt-image-2': { low: [0.009, 0.013], medium: [0.034, 0.05], high: [0.133, 0.2], est: true },
      'gpt-image-1.5': { low: [0.009, 0.013], medium: [0.034, 0.05], high: [0.133, 0.2] },
      'gpt-image-1': { low: [0.011, 0.016], medium: [0.042, 0.063], high: [0.167, 0.25] },
      'gpt-image-1-mini': { low: [0.005, 0.006], medium: [0.011, 0.015], high: [0.036, 0.052] },
      'dall-e-3': { flat: [0.04, 0.08] }, 'dall-e-2': { flat: [0.02, 0.02] },
    };
    const curModel = () => F.settings.models[IMG_KEY[st.provider] || 'image'];
    const fillModels = () => { const list = IMG_LIST[st.provider] || [], cur = curModel(), sel = el.querySelector('#iM'); sel.innerHTML = (list.includes(cur) ? list : [cur, ...list]).map((m) => `<option value="${F.esc(m)}" ${m === cur ? 'selected' : ''}>${F.esc(m)}</option>`).join(''); };
    const modelLine = () => { el.querySelector('#iModel').textContent = `${IMG_NAME[st.provider] || 'OpenAI'} · ${curModel()}`; };
    const unit = () => {
      if (st.provider === 'gemini') return { per: 0.039, note: 'Gemini' };
      if (st.provider === 'minimax') return { per: 0.0035, note: 'MiniMax' };
      const m = F.settings.models.image, t = IMG_PRICE[m] || IMG_PRICE['gpt-image-1'], big = st.size !== '1024x1024';
      const per = t.flat ? t.flat[big ? 1 : 0] : t[st.quality][big ? 1 : 0];
      return { per, note: `${m}${t.flat ? '' : ', calidad ' + ({ low: 'baja', medium: 'media', high: 'alta' }[st.quality])}`, est: t.est || !IMG_PRICE[m] };
    };
    const cost = () => {
      modelLine();
      const u = unit(), tot = u.per * st.n;
      el.querySelector('#iCost').innerHTML = `<b>Costo: US$${tot.toFixed(tot < 0.1 ? 3 : 2)}</b> (${st.n} × US$${u.per.toFixed(u.per < 0.01 ? 4 : 3)} · ${F.esc(u.note)})${u.est ? ' · precio estimado' : ''} · se guardan en tu biblioteca`;
      const q = el.querySelector('#iQ'); if (q) q.disabled = st.provider !== 'openai' || !!IMG_PRICE[F.settings.models.image]?.flat;
    };
    const gal = () => { const ai = F.media.images().filter((m) => m.source === 'ai').slice(0, 24); el.querySelector('#iGal').innerHTML = ai.length ? ai.map((m) => V.tile(m)).join('') : '<div class="small dim">Aún no generaste imágenes.</div>'; };
    fillModels(); cost(); gal();
    const off = F.on('media', gal);
    V.mediaActions(el);
    el.querySelector('#iPrompt').addEventListener('input', (e) => { st.prompt = e.target.value; save(); });
    el.querySelector('#iSty').addEventListener('click', (e) => { const c = e.target.closest('[data-s]'); if (!c) return; st.style = c.dataset.s; save(); el.querySelectorAll('#iSty .chip').forEach((x) => x.classList.toggle('on', x === c)); });
    el.querySelector('#iProv').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; st.provider = b.dataset.p; save(); el.querySelectorAll('#iProv button').forEach((x) => x.classList.toggle('on', x === b)); fillModels(); cost(); });
    el.querySelector('#iM').addEventListener('change', (e) => { F.settings.models[IMG_KEY[st.provider] || 'image'] = e.target.value; F.saveSettings(); cost(); });
    for (const [id, k] of [['iSize', 'size'], ['iQ', 'quality'], ['iN', 'n']]) el.querySelector('#' + id).addEventListener('change', (e) => { st[k] = k === 'n' ? +e.target.value : e.target.value; save(); cost(); });
    el.querySelector('#iEnhP').addEventListener('change', (e) => { st.enhProvider = e.target.value; save(); });
    el.querySelector('#iEnh').onclick = async (e) => {
      if (!st.prompt.trim()) return F.toast('Escribe primero una idea');
      const b = e.currentTarget; F.busy(b, true, 'Mejorando…');
      try {
        const t = await F.api.llm({ provider: st.enhProvider || 'auto', system: 'Eres un experto en prompts para generación de imágenes. Escribes SIEMPRE en español, nunca en inglés.', prompt: `Convierte esta idea en un prompt de imagen excelente, escrito totalmente en español (nada en inglés), de 40-70 palabras: sujeto, entorno, composición, iluminación, lente y atmósfera. Sin texto ni letras en la imagen. Devuelve SOLO el prompt.\nIdea: ${st.prompt}`, maxTokens: 400 });
        st.prompt = t.trim().replace(/^"|"$/g, ''); el.querySelector('#iPrompt').value = st.prompt; save(); F.toast('Prompt mejorado', 'ok');
      } catch (err) { F.toast(err.message, 'error'); }
      F.busy(b, false);
    };
    el.querySelector('#iGo').onclick = async (e) => {
      if (!st.prompt.trim()) return F.toast('Describe la imagen que quieres');
      const res = el.querySelector('#iRes'); res.querySelector('.empty')?.remove();
      const b = e.currentTarget; F.busy(b, true, 'Generando…');
      const sk = Array.from({ length: st.n }, () => { const d = document.createElement('div'); d.className = 'tile wide skel'; d.innerHTML = '<span><span class="spin"></span> Creando…</span>'; res.prepend(d); return d; });
      try {
        const prompt = [st.prompt, F.STYLES[st.style]?.p].filter(Boolean).join('. ');
        const blobs = await F.api.image({ prompt, size: st.size, quality: st.quality, n: st.n, provider: st.provider });
        for (let i = 0; i < sk.length; i++) {
          if (!blobs[i]) { sk[i].remove(); continue; }
          const m = await F.media.add({ type: 'image', name: st.prompt.slice(0, 48), blob: blobs[i], source: 'ai', meta: { prompt } });
          sk[i].outerHTML = V.tile(m);
        }
        F.toast('Imágenes listas y guardadas en la biblioteca', 'ok');
      } catch (err) { sk.forEach((s) => s.remove()); F.toast(err.message, 'error'); }
      F.busy(b, false);
    };
    return off;
  };

  /* =================== VOCES =================== */
  V.voces = (el) => {
    const st = load('voice', { provider: 'openai', text: '', voice: 'nova', instructions: 'Narrador profesional: voz cálida, clara, con ritmo dinámico y entonación natural.', speed: 1, elevenId: '', stability: 0.5, similarity: 0.75, name: '', geminiVoice: 'Kore', minimaxId: '' });
    const tx = sessionStorage.getItem('framaly.voiceText'); if (tx) { st.text = tx; sessionStorage.removeItem('framaly.voiceText'); }
    const save = () => store('voice', st);
    let elevenList = null, minimaxList = null;
    el.innerHTML = `<div class="page"><div class="split">
      <div class="card sticky"><h2>${I('mic')} Estudio de voz</h2><p class="desc">Convierte texto en narraciones naturales para tus videos.</p>
        <div class="seg" id="vProv"><button data-p="openai">OpenAI</button><button data-p="elevenlabs">ElevenLabs</button><button data-p="gemini">Gemini</button><button data-p="minimax">MiniMax</button><button data-p="browser">Navegador (gratis)</button></div>
        <label class="lbl">Texto a narrar</label><textarea id="vText" rows="7" placeholder="Escribe o pega la narración de tu video…">${F.esc(st.text)}</textarea><div class="hint" id="vCount"></div>
        <div id="vOpts"></div>
        <label class="lbl">Nombre del audio</label><input type="text" id="vName" placeholder="Narración" value="${F.esc(st.name)}">
        <button class="btn primary block lg" id="vGo" style="margin-top:18px">${I('mic')} Generar voz</button>
        <audio id="vPrev" controls class="hidden" style="width:100%;margin-top:12px"></audio>
      </div>
      <div class="card"><h3>${I('music')} Voces y audios <span class="grow"></span><button class="btn sm" id="vUp">${I('upload')} Subir música / audio</button></h3><div class="audio-list" id="vList"></div></div>
    </div></div>`;
    const q = (s) => el.querySelector(s);
    const count = () => { const n = st.text.length; q('#vCount').textContent = `${n} caracteres · ≈ ${F.fmtS(n / 15)} de audio${n > 4000 ? ' · se generará por partes' : ''}`; };
    const list = () => { const a = F.media.audios(); q('#vList').innerHTML = a.length ? a.map(V.audioItem).join('') : `<div class="empty">${I('mic')}<p class="small">Aquí aparecerán tus narraciones y la música que subas.</p></div>`; };
    const opts = () => {
      q('#vProv').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.p === st.provider));
      const o = q('#vOpts');
      if (st.provider === 'openai') o.innerHTML = `<label class="lbl">Voz</label><div class="chips" id="vVoices">${F.api.OPENAI_VOICES.map((v) => `<button class="chip ${v === st.voice ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
        <label class="lbl">Dirección de voz (tono, emoción, ritmo)</label><textarea id="vIns" rows="2">${F.esc(st.instructions)}</textarea>
        <label class="lbl">Velocidad</label><div class="rangeval"><input type="range" id="vSpd" min="0.5" max="2" step="0.05" value="${st.speed}"><span>${(+st.speed).toFixed(2)}x</span></div>`;
      else if (st.provider === 'elevenlabs') o.innerHTML = `<label class="lbl">Voz de ElevenLabs</label><div class="keyrow"><select id="vEl">${elevenList ? opt(elevenList.map((v) => [v.id, `${v.name}${v.labels.accent ? ' · ' + v.labels.accent : ''}`]), st.elevenId) : `<option value="${F.esc(st.elevenId)}">${st.elevenId ? 'Voice ID: ' + F.esc(st.elevenId) : '— Carga tus voces —'}</option>`}</select><button class="btn" id="vElLoad">Cargar</button></div>
        <div class="hint">Voice ID: <code id="vElId">${F.esc(st.elevenId || '—')}</code> <button class="applyall" id="vElCopy">copiar</button></div>
        <div class="grid2"><div><label class="lbl">Estabilidad</label><input type="range" id="vStab" min="0" max="1" step="0.05" value="${st.stability}"></div><div><label class="lbl">Similitud</label><input type="range" id="vSim" min="0" max="1" step="0.05" value="${st.similarity}"></div></div>
        <label class="lbl">Velocidad</label><div class="rangeval"><input type="range" id="vSpd" min="0.7" max="1.2" step="0.05" value="${F.clamp(st.speed, 0.7, 1.2)}"><span>${(+st.speed).toFixed(2)}x</span></div>`;
      else if (st.provider === 'gemini') o.innerHTML = `<label class="lbl">Voz de Gemini</label><div class="chips" id="vGem">${F.api.GEMINI_VOICES.map((v) => `<button class="chip ${v === st.geminiVoice ? 'on' : ''}" data-g="${v}">${v}</button>`).join('')}</div>
        <p class="hint">Gemini no permite cambiar la velocidad. Los textos largos se generan por partes y se unen solos.</p>`;
      else if (st.provider === 'minimax') o.innerHTML = `<label class="lbl">Voz de MiniMax</label><div class="keyrow"><input type="text" id="vMm" list="vMmList" value="${F.esc(st.minimaxId)}" placeholder="Pulsa Cargar y elige una voz"><datalist id="vMmList">${(minimaxList || []).map((v) => `<option value="${F.esc(v.id)}">${F.esc(v.name)}</option>`).join('')}</datalist><button class="btn" id="vMmLoad">${minimaxList ? 'Recargar' : 'Cargar'}</button></div>
        <label class="lbl">Velocidad</label><div class="rangeval"><input type="range" id="vSpd" min="0.5" max="2" step="0.05" value="${st.speed}"><span>${(+st.speed).toFixed(2)}x</span></div>`;
      else {
        const vs = speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang));
        o.innerHTML = `<div class="notice" style="margin:14px 0 0">${I('zap')}<div>La voz del navegador es gratuita y sirve para <b>escuchar una prueba</b>, pero no se puede guardar ni exportar. Para tus videos usa OpenAI o ElevenLabs.</div></div>
          <label class="lbl">Voz del sistema</label><select id="vBr">${vs.length ? vs.map((v) => `<option value="${F.esc(v.name)}">${F.esc(v.name)} (${v.lang})</option>`).join('') : '<option>Voz predeterminada</option>'}</select>`;
      }
      q('#vGo').innerHTML = st.provider === 'browser' ? `${I('play')} Escuchar prueba` : `${I('mic')} Generar voz`;
    };
    count(); list(); opts();
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => st.provider === 'browser' && opts();
    const off = F.on('media', list);
    V.mediaActions(q('#vList'));
    q('#vUp').onclick = async () => F.media.addFiles(await F.pickFiles('audio/*'));
    q('#vText').addEventListener('input', (e) => { st.text = e.target.value; save(); count(); });
    q('#vName').addEventListener('input', (e) => { st.name = e.target.value; save(); });
    q('#vProv').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; st.provider = b.dataset.p; save(); opts(); });
    q('#vOpts').addEventListener('click', async (e) => {
      const c = e.target.closest('[data-v]'); if (c) { st.voice = c.dataset.v; save(); q('#vOpts').querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === c)); }
      if (e.target.closest('#vElCopy') && st.elevenId) { navigator.clipboard.writeText(st.elevenId); F.toast('Voice ID copiado. Pégalo en el Agente Locutor de tus flujos.', 'ok'); }
      const gv = e.target.closest('[data-g]'); if (gv) { st.geminiVoice = gv.dataset.g; save(); q('#vOpts').querySelectorAll('[data-g]').forEach((x) => x.classList.toggle('on', x === gv)); }
      if (e.target.closest('#vMmLoad')) {
        const b = e.target.closest('#vMmLoad'); F.busy(b, true, '');
        try { minimaxList = await F.api.minimaxVoices(); if (!st.minimaxId && minimaxList[0]) st.minimaxId = minimaxList[0].id; save(); opts(); F.toast(`${minimaxList.length} voces cargadas`, 'ok'); } catch (err) { F.toast(err.message, 'error'); F.busy(b, false); }
      }
      if (e.target.closest('#vElLoad')) {
        const b = e.target.closest('#vElLoad'); F.busy(b, true, '');
        try { elevenList = await F.api.elevenVoices(); if (!st.elevenId && elevenList[0]) st.elevenId = elevenList[0].id; save(); opts(); F.toast(`${elevenList.length} voces cargadas`, 'ok'); } catch (err) { F.toast(err.message, 'error'); F.busy(b, false); }
      }
    });
    q('#vOpts').addEventListener('input', (e) => {
      const id = e.target.id;
      if (id === 'vIns') st.instructions = e.target.value;
      if (id === 'vSpd') { st.speed = +e.target.value; e.target.nextElementSibling.textContent = st.speed.toFixed(2) + 'x'; }
      if (id === 'vStab') st.stability = +e.target.value;
      if (id === 'vSim') st.similarity = +e.target.value;
      if (id === 'vEl') { st.elevenId = e.target.value; q('#vElId').textContent = st.elevenId; }
      if (id === 'vMm') st.minimaxId = e.target.value.trim();
      save();
    });
    const chunks = (text, max) => {
      const parts = []; let cur = '';
      for (const s of text.match(/[^.!?¿¡\n]+[.!?\n]*|\S+/g) || []) { if ((cur + s).length > max && cur) { parts.push(cur.trim()); cur = ''; } cur += s; }
      if (cur.trim()) parts.push(cur.trim());
      return parts;
    };
    q('#vGo').onclick = async (e) => {
      const text = st.text.trim(); if (!text) return F.toast('Escribe el texto a narrar');
      if (st.provider === 'browser') {
        speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'es-ES';
        const v = speechSynthesis.getVoices().find((x) => x.name === q('#vBr')?.value); if (v) u.voice = v;
        speechSynthesis.speak(u); return;
      }
      const b = e.currentTarget; F.busy(b, true, 'Generando voz…');
      try {
        const parts = chunks(text, st.provider === 'openai' ? 3800 : st.provider === 'gemini' ? 900 : 4500);
        const blobs = [];
        for (const [i, t] of parts.entries()) {
          if (parts.length > 1) b.innerHTML = `<span class="spin"></span> Parte ${i + 1} de ${parts.length}…`;
          blobs.push(await F.api.tts({ provider: st.provider, text: t, voice: st.provider === 'gemini' ? st.geminiVoice : st.voice, instructions: st.instructions, speed: st.speed, voiceId: st.provider === 'minimax' ? st.minimaxId : st.elevenId, stability: st.stability, similarity: st.similarity }));
        }
        const blob = await F.api.joinAudio(blobs);
        const m = await F.media.add({ type: 'audio', name: st.name.trim() || `Voz · ${text.slice(0, 30)}`, blob, source: 'ai', meta: { text } });
        const a = q('#vPrev'); a.src = F.media.url(m); a.classList.remove('hidden'); a.play().catch(() => {});
        F.toast('Voz generada y guardada en la biblioteca', 'ok');
      } catch (err) { F.toast(err.message, 'error'); }
      F.busy(b, false);
    };
    return () => { off(); try { speechSynthesis.cancel(); } catch (e) {} };
  };

  /* =================== EFECTOS =================== */
  V.efectos = (el) => {
    let tab = 'trans', raf = 0, specs = [];
    const PW = 384, PH = 216;
    const mk = (i) => { const c = document.createElement('canvas'); c.width = PW; c.height = PH; R.drawClip(c.getContext('2d'), { _img: R.demo(i), duration: 4, motion: 'none' }, 0, PW, PH); return c; };
    const A = mk(0), B = mk(1);
    const cf = load('cfilter', { b: 1, c: 1.1, s: 1.2, h: 0, se: 0, g: 0, bl: 0, vig: 0.3, name: 'Mi filtro' });
    const cssOf = (f) => `brightness(${f.b}) contrast(${f.c}) saturate(${f.s}) hue-rotate(${f.h}deg) sepia(${f.se}) grayscale(${f.g})${f.bl > 0 ? ` blur(${f.bl}px)` : ''}`;
    const TABS = [['trans', 'Transiciones'], ['filter', 'Filtros de color'], ['motion', 'Movimientos'], ['text', 'Textos animados'], ['custom', 'Crear filtro']];
    el.innerHTML = `<div class="page">
      <div class="row" style="margin-bottom:18px"><div class="seg" id="fxTabs">${TABS.map(([k, n]) => `<button data-t="${k}">${n}</button>`).join('')}</div><span class="grow"></span><span class="muted small" id="fxTarget"></span></div>
      <div id="fxBody"></div></div>`;
    const target = () => {
      const p = F.projects.current(); const ed = F.editor;
      const sel = p && ed.selType === 'clip' && p.clips.find((c) => c.id === ed.sel);
      el.querySelector('#fxTarget').innerHTML = p ? `Proyecto: <b>${F.esc(p.name)}</b> · ${sel ? 'clip ' + (p.clips.indexOf(sel) + 1) + ' seleccionado' : 'sin clip seleccionado (se aplica a todos)'}` : 'Sin proyecto abierto';
      return { p, sel };
    };
    const items = () => {
      if (tab === 'trans') return R.TRANSITIONS.filter((t) => t.id !== 'none').map((t) => ({ ...t, key: 'transition' }));
      if (tab === 'filter') return R.filters().map((f) => ({ ...f, key: 'filter' }));
      if (tab === 'motion') return R.MOTIONS.map((m) => ({ ...m, key: 'motion' }));
      if (tab === 'text') return [...R.TEXT_STYLES.map((s) => ({ ...s, key: 'textStyle', name: 'Estilo: ' + s.name })), ...R.TEXT_ANIMS.filter((a) => a.id !== 'none').map((a) => ({ ...a, key: 'textAnim', name: 'Animación: ' + a.name }))];
      return [];
    };
    const drawSpec = (s, t) => {
      const x = s.cv.getContext('2d');
      if (s.key === 'transition') {
        const ph = t % 2.6;
        if (ph < 0.7) x.drawImage(A, 0, 0); else if (ph < 1.9) R.composite(x, A, B, s.id, (ph - 0.7) / 1.2, PW, PH); else x.drawImage(B, 0, 0);
      } else if (s.key === 'motion') R.drawClip(x, { _img: R.demo(2), motion: s.id, motionAmt: 0.25, duration: 4 }, t % 4, PW, PH);
      else if (s.key === 'textStyle') R.drawClip(x, { _img: R.demo(0), motion: 'none', duration: 3.5, text: s.id === 'titulo' ? 'Tu gran título' : 'Así se verá tu texto en pantalla', textStyle: s.id, textAnim: 'fade' }, t % 3.5, PW, PH);
      else if (s.key === 'textAnim') R.drawClip(x, { _img: R.demo(1), motion: 'none', duration: 3.5, text: 'Texto con animación', textStyle: 'titulo', textAnim: s.id }, t % 3.5, PW, PH);
    };
    const loop = (ts) => { const t = ts / 1000; specs.forEach((s) => s.anim && drawSpec(s, t)); raf = requestAnimationFrame(loop); };
    const render = () => {
      el.querySelectorAll('#fxTabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
      target();
      const body = el.querySelector('#fxBody');
      specs = [];
      if (tab === 'custom') {
        const sl = [['b', 'Brillo', 0.4, 1.6, 0.01], ['c', 'Contraste', 0.4, 2, 0.01], ['s', 'Saturación', 0, 2.5, 0.01], ['h', 'Tono (°)', -180, 180, 1], ['se', 'Sepia', 0, 1, 0.01], ['g', 'Escala de grises', 0, 1, 0.01], ['bl', 'Desenfoque (px)', 0, 4, 0.1], ['vig', 'Viñeta', 0, 0.9, 0.01]];
        body.innerHTML = `<div class="split" style="grid-template-columns:1fr 380px"><div class="card"><canvas id="cfCv" width="960" height="540" class="thumb-cv"></canvas>
          <div class="row" style="margin-top:12px">${[0, 1, 2].map((i) => `<button class="btn sm" data-img="${i}">Escena ${i + 1}</button>`).join('')}</div>
          <h3 style="margin-top:22px">Mis filtros</h3><div class="chips" id="cfList">${(F.settings.customFilters || []).map((f) => `<span class="chip on">${F.esc(f.name)} <button class="applyall" data-cdel="${f.id}" style="margin-left:6px">✕</button></span>`).join('') || '<span class="small dim">Aún no creaste filtros</span>'}</div></div>
          <div class="card"><h3>${I('wand')} Ajustes del filtro</h3>${sl.map(([k, n, a, b, s]) => `<label class="lbl">${n}</label><div class="rangeval"><input type="range" data-cf="${k}" min="${a}" max="${b}" step="${s}" value="${cf[k]}"><span>${cf[k]}</span></div>`).join('')}
          <label class="lbl">Nombre</label><input type="text" id="cfName" value="${F.esc(cf.name)}"><button class="btn primary block" id="cfSave" style="margin-top:14px">${I('save')} Guardar filtro</button><p class="hint">Aparecerá en el inspector del editor y en los flujos.</p></div></div>`;
        let di = 0;
        const draw = () => R.drawClip(body.querySelector('#cfCv').getContext('2d'), { _img: R.demo(di), _filter: { css: cssOf(cf), vig: cf.vig }, motion: 'none', duration: 1 }, 0, 960, 540);
        draw();
        body.addEventListener('input', (e) => { const k = e.target.dataset.cf; if (k) { cf[k] = +e.target.value; e.target.nextElementSibling.textContent = cf[k]; store('cfilter', cf); draw(); } if (e.target.id === 'cfName') { cf.name = e.target.value; store('cfilter', cf); } });
        body.addEventListener('click', (e) => {
          const im = e.target.closest('[data-img]'); if (im) { di = +im.dataset.img; draw(); }
          const d = e.target.closest('[data-cdel]'); if (d) { F.settings.customFilters = F.settings.customFilters.filter((f) => f.id !== d.dataset.cdel); F.saveSettings(); render(); }
          if (e.target.closest('#cfSave')) { F.settings.customFilters.push({ id: 'c_' + F.uid(), name: cf.name || 'Mi filtro', css: cssOf(cf), vig: cf.vig }); F.saveSettings(); F.toast('Filtro guardado', 'ok'); render(); }
        });
        return;
      }
      const its = items();
      body.innerHTML = `<div class="fx-grid">${its.map((s, i) => `<div class="fx"><canvas width="${PW}" height="${PH}" data-i="${i}"></canvas><div class="bd"><b>${F.esc(s.name)}</b><button class="btn sm" data-sel="${i}" title="Aplicar al clip seleccionado">Clip</button><button class="btn sm primary" data-all="${i}" title="Aplicar a todos los clips">Todos</button></div></div>`).join('')}</div>`;
      specs = its.map((s, i) => ({ ...s, cv: body.querySelector(`canvas[data-i="${i}"]`), anim: s.key !== 'filter' }));
      specs.filter((s) => s.key === 'filter').forEach((s) => R.drawClip(s.cv.getContext('2d'), { _img: R.demo(0), _filter: R.filter(s.id), motion: 'none', duration: 1 }, 0, PW, PH));
      body.querySelector('.fx-grid').addEventListener('click', async (e) => {
        const b = e.target.closest('[data-sel],[data-all]'); if (!b) return;
        const s = its[+(b.dataset.sel ?? b.dataset.all)];
        const { p, sel } = target();
        if (!p || !p.clips.length) return F.toast('Abre un proyecto con clips en el Editor primero');
        const list = b.dataset.all != null ? p.clips : sel ? [sel] : null;
        if (!list) return F.toast('Selecciona un clip en el Editor o usa “Todos”');
        list.forEach((c) => (c[s.key] = s.id));
        await F.projects.save(p);
        F.toast(`${s.name} aplicado a ${list.length} clip(s)`, 'ok');
      });
    };
    el.querySelector('#fxTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; render(); } });
    render(); raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  };

  /* =================== BIBLIOTECA =================== */
  V.biblioteca = (el) => {
    let filt = 'all', search = '';
    el.innerHTML = `<div class="page">
      <div class="row" style="margin-bottom:18px"><div class="seg" id="bF">${[['all', 'Todo'], ['image', 'Imágenes'], ['video', 'Videos'], ['audio', 'Audio'], ['ai', 'Creado con IA'], ['upload', 'Subido']].map(([k, n]) => `<button data-f="${k}">${n}</button>`).join('')}</div>
      <input type="search" id="bS" placeholder="Buscar…" style="max-width:240px"><span class="grow"></span><span class="muted small" id="bUse"></span><button class="btn primary" id="bUp">${I('upload')} Subir archivos</button></div>
      <div id="bDrop" class="card" style="border-style:dashed"><div id="bBody"></div></div></div>`;
    const render = () => {
      el.querySelectorAll('#bF button').forEach((b) => b.classList.toggle('on', b.dataset.f === filt));
      let l = F.media.list;
      if (filt === 'image' || filt === 'audio' || filt === 'video') l = l.filter((m) => m.type === filt);
      if (filt === 'ai' || filt === 'upload') l = l.filter((m) => m.source === filt);
      if (search) l = l.filter((m) => m.name.toLowerCase().includes(search));
      const imgs = l.filter((m) => m.type === 'image'), auds = l.filter((m) => m.type === 'audio'), vids = l.filter((m) => m.type === 'video');
      el.querySelector('#bBody').innerHTML = !l.length ? `<div class="empty" style="border:0">${I('folder')}<p><b>No hay archivos</b></p><p class="small">Arrastra imágenes, videos MP4 o audios aquí, o pulsa “Subir archivos”.</p></div>`
        : `${vids.length ? `<h3>${I('film')} Videos <span class="tag">${vids.length}</span></h3><div class="img-grid">${vids.map((m) => V.tile(m)).join('')}</div>` : ''}${imgs.length ? `<h3>${I('image')} Imágenes <span class="tag">${imgs.length}</span></h3><div class="img-grid">${imgs.map((m) => V.tile(m)).join('')}</div>` : ''}
           ${auds.length ? `<h3 style="margin-top:${imgs.length || vids.length ? 26 : 0}px">${I('music')} Audio <span class="tag">${auds.length}</span></h3><div class="audio-list">${auds.map(V.audioItem).join('')}</div>` : ''}`;
    };
    render();
    navigator.storage?.estimate?.().then((e) => { el.querySelector('#bUse').textContent = `Almacenamiento: ${F.bytes(e.usage || 0)} usados`; }).catch(() => {});
    const off = F.on('media', render);
    V.mediaActions(el.querySelector('#bBody'));
    el.querySelector('#bF').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b) { filt = b.dataset.f; render(); } });
    el.querySelector('#bS').addEventListener('input', (e) => { search = e.target.value.toLowerCase().trim(); render(); });
    el.querySelector('#bUp').onclick = async () => F.media.addFiles(await F.pickFiles('image/*,video/*,.mp4,.mov,.m4v,.webm,audio/*'));
    const dz = el.querySelector('#bDrop');
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.style.borderColor = 'var(--or)'; });
    dz.addEventListener('dragleave', () => (dz.style.borderColor = ''));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.style.borderColor = ''; if (e.dataTransfer.files.length) F.media.addFiles([...e.dataTransfer.files]); });
    return off;
  };

  /* =================== PUBLICAR =================== */
  V.publicar = (el) => {
    const p = F.projects.current();
    if (!p) { el.innerHTML = `<div class="page"><div class="empty" style="padding:80px">${I('youtube')}<p><b>No hay ningún proyecto abierto</b></p><button class="btn primary" data-new>${I('plus')} Crear proyecto</button></div></div>`; el.querySelector('[data-new]').onclick = V.newProject; return; }
    p.meta ||= { title: '', description: '', tags: '' };
    const st = load('pub', { format: F.Engine.supportsMp4() ? 'mp4' : 'webm', quality: 'high', privacy: 'private', category: '22', thumbStyle: 'impacto', thumbUpload: true });
    const save = () => store('pub', st), saveP = F.debounce(() => F.projects.save(p), 400);
    let thumbImg = p.clips[0]?.mediaId || F.media.images()[0]?.id || null, thumbBlob = null;
    const PLAT = [['youtube', 'YouTube', '16:9', 'Horizontal 1920×1080. Ideal 8–15 min para monetizar; usa capítulos y miniatura llamativa.'], ['shorts', 'YouTube Shorts', '9:16', 'Vertical 1080×1920, máximo 60 s (hasta 3 min). Gancho en el primer segundo.'], ['tiktok', 'TikTok', '9:16', 'Vertical 1080×1920. 15–60 s funciona mejor; subtítulos grandes.'], ['reels', 'Instagram Reels', '9:16', 'Vertical 1080×1920, hasta 90 s.'], ['feed', 'Instagram / Facebook feed', '4:5', 'Vertical 1080×1350, ocupa más pantalla en el feed.']];
    const tot = F.projects.duration(p), [W, H] = R.SIZES[p.aspect];
    el.innerHTML = `<div class="page"><div class="split even">
      <div>
        <div class="card"><h3>${I('film')} Proyecto</h3><select id="uProj">${opt(F.projects.list.map((x) => [x.id, x.name]), p.id)}</select>
          <div class="row" style="margin-top:12px"><span class="tag or">${p.aspect}</span><span class="tag">${W}×${H}</span><span class="tag">${F.fmtS(tot)}</span><span class="tag">${p.clips.length} clips</span><span class="grow"></span><a class="btn sm" href="#/editor">${I('edit')} Abrir en editor</a></div></div>
        <div class="card"><h3>${I('send')} Plataforma de destino</h3><div class="chips" id="uPlat">${PLAT.map(([k, n, a]) => `<button class="chip ${a === p.aspect ? 'on' : ''}" data-pl="${k}">${n}</button>`).join('')}</div><div id="uPlatInfo" class="hint" style="margin-top:12px"></div></div>
        <div class="card"><h3>${I('download')} Exportar video</h3>
          <div class="grid3"><div><label class="lbl">Formato</label><select id="uFmt">${opt([['mp4', 'MP4' + (F.Engine.supportsMp4() ? '' : ' (no compatible)')], ['webm', 'WebM']], st.format)}</select></div>
          <div><label class="lbl">Calidad</label><select id="uQ">${opt([['high', 'Alta'], ['medium', 'Media'], ['low', 'Ligera']], st.quality)}</select></div>
          <div><label class="lbl">FPS</label><select id="uFps">${opt([[24, '24'], [30, '30'], [60, '60']], p.fps || 30)}</select></div></div>
          <button class="btn primary lg block" id="uExp" style="margin-top:16px">${I('download')} Exportar ${W}×${H}</button>
          <p class="hint">YouTube acepta MP4 y WebM. La exportación dura lo mismo que el video (${F.fmtS(tot)}).</p><div id="uRes"></div></div>
      </div>
      <div>
        <div class="card"><h3>${I('sparkles')} SEO y metadatos <span class="grow"></span><button class="btn sm outline" id="uSeo">${I('wand')} Generar con IA</button></h3>
          <label class="lbl">Título <span class="dim" id="uTc"></span></label><input type="text" id="uTitle" maxlength="100" value="${F.esc(p.meta.title || p.name)}">
          <label class="lbl">Descripción</label><textarea id="uDesc" rows="8">${F.esc(p.meta.description)}</textarea>
          <label class="lbl">Etiquetas (separadas por comas) <span class="dim" id="uGc"></span></label><input type="text" id="uTags" value="${F.esc(p.meta.tags)}">
          <div class="row" style="margin-top:12px"><button class="btn sm" id="uChap">${I('clock')} Insertar capítulos</button><button class="btn sm" id="uCopy">${I('copy')} Copiar todo</button></div></div>
        <div class="card"><h3>${I('image')} Miniatura <span class="grow"></span><button class="btn sm outline" id="uThAi">${I('sparkles')} Fondo con IA</button></h3>
          <canvas id="uThumb" class="thumb-cv"></canvas>
          <div class="pick-row" id="uPick" style="margin-top:12px"></div>
          <label class="lbl">Texto de la miniatura</label><input type="text" id="uThText" value="${F.esc((p.meta.title || p.name).slice(0, 40))}">
          <div class="row" style="margin-top:12px"><div class="seg" id="uThSty">${[['impacto', 'Impacto'], ['limpio', 'Limpio'], ['lateral', 'Lateral']].map(([k, n]) => `<button data-s="${k}" class="${k === st.thumbStyle ? 'on' : ''}">${n}</button>`).join('')}</div><span class="grow"></span><button class="btn sm" id="uThDl">${I('download')} PNG 1280×720</button></div></div>
        <div class="card"><h3>${I('youtube')} Subir a YouTube</h3>
          <div class="grid2"><div><label class="lbl">Visibilidad</label><select id="uPriv">${opt([['private', 'Privado'], ['unlisted', 'No listado'], ['public', 'Público']], st.privacy)}</select></div>
          <div><label class="lbl">Categoría</label><select id="uCat">${opt([['22', 'Personas y blogs'], ['27', 'Educación'], ['24', 'Entretenimiento'], ['28', 'Ciencia y tecnología'], ['26', 'Consejos y estilo'], ['19', 'Viajes y eventos'], ['10', 'Música'], ['20', 'Videojuegos'], ['25', 'Noticias y política']], st.category)}</select></div></div>
          <label class="check"><input type="checkbox" id="uThUp" ${st.thumbUpload ? 'checked' : ''}> Subir también la miniatura (requiere canal verificado)</label>
          <div id="uChk" class="small" style="line-height:1.9;margin:6px 0 12px"></div>
          <button class="btn primary block" id="uYt">${I('youtube')} Conectar y subir</button><div id="uYtRes" style="margin-top:12px"></div></div>
      </div></div></div>`;
    const q = (s) => el.querySelector(s);
    const counts = () => { q('#uTc').textContent = `${q('#uTitle').value.length}/100`; q('#uGc').textContent = `${q('#uTags').value.length}/500`; };
    const syncMeta = () => { p.meta.title = q('#uTitle').value; p.meta.description = q('#uDesc').value; p.meta.tags = q('#uTags').value; counts(); saveP(); };
    ['#uTitle', '#uDesc', '#uTags'].forEach((s) => q(s).addEventListener('input', syncMeta)); counts();
    const checklist = () => {
      const ex = F.lastExport && F.lastExport.projectId === p.id;
      const items = [[F.api.has('googleClientId'), 'OAuth Client ID de Google configurado', '#/integraciones'], [location.protocol !== 'file:', 'App abierta desde http://localhost (Iniciar FRAMALY.bat)'], [ex, 'Video exportado en esta sesión'], [!!p.meta.title, 'Título escrito']];
      q('#uChk').innerHTML = items.map(([ok, t, l]) => `<div><span class="dot ${ok ? 'ok' : ''}"></span>${l && !ok ? `<a href="${l}">${t}</a>` : t}</div>`).join('');
    };
    const showRes = () => {
      const ex = F.lastExport && F.lastExport.projectId === p.id ? F.lastExport : null;
      q('#uRes').innerHTML = ex ? `<div class="aitem" style="margin-top:14px"><div class="ic">${I('check')}</div><div class="meta"><b>${F.esc(ex.name)}</b><small>${F.bytes(ex.blob.size)} · ${F.ago(ex.created)}</small></div><button class="btn sm" id="uDl">${I('download')} Descargar</button></div>` : '';
      q('#uDl')?.addEventListener('click', () => F.download(ex.blob, ex.name));
      checklist();
    };
    showRes();
    const offEx = F.on('exported', showRes);
    const platInfo = (k) => { const x = PLAT.find((y) => y[0] === k); if (!x) return; q('#uPlatInfo').innerHTML = `${x[3]}${x[2] !== p.aspect ? ` <button class="applyall" id="uAsp">Cambiar el proyecto a ${x[2]}</button>` : ' ✓ Tu proyecto ya tiene este formato.'}`; q('#uAsp')?.addEventListener('click', async () => { p.aspect = x[2]; await F.projects.save(p); F.router.reload(); }); };
    platInfo(PLAT.find((x) => x[2] === p.aspect)?.[0] || 'youtube');
    q('#uPlat').addEventListener('click', (e) => { const c = e.target.closest('[data-pl]'); if (!c) return; q('#uPlat').querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c)); platInfo(c.dataset.pl); });
    q('#uProj').addEventListener('change', (e) => { F.projects.setCurrent(e.target.value); F.router.reload(); });
    for (const [id, k] of [['#uFmt', 'format'], ['#uQ', 'quality'], ['#uPriv', 'privacy'], ['#uCat', 'category']]) q(id).addEventListener('change', (e) => { st[k] = e.target.value; save(); });
    q('#uThUp').addEventListener('change', (e) => { st.thumbUpload = e.target.checked; save(); });
    q('#uFps').addEventListener('change', (e) => { p.fps = +e.target.value; saveP(); });
    q('#uExp').onclick = () => { if (!p.clips.length) return F.toast('El proyecto no tiene clips'); F.exportProject(p, { format: st.format, quality: st.quality, fps: p.fps || 30 }); };
    q('#uChap').onclick = () => { const d = q('#uDesc'); d.value = d.value.replace(/\n*Capítulos:[\s\S]*$/, '') + '\n\nCapítulos:\n' + F.pipeline.chapters(p, p.script); syncMeta(); F.toast('Capítulos insertados', 'ok'); };
    q('#uCopy').onclick = () => { navigator.clipboard.writeText(`${p.meta.title}\n\n${p.meta.description}\n\nEtiquetas: ${p.meta.tags}`); F.toast('Metadatos copiados', 'ok'); };
    q('#uSeo').onclick = async (e) => {
      const b = e.currentTarget; F.busy(b, true, 'Optimizando…');
      try {
        const s = await F.pipeline.seo({ topic: p.script?.title || p.name, script: p.script || { title: p.name, scenes: p.clips.filter((c) => c.text).map((c) => ({ narration: c.text })) }, keywords: '' });
        q('#uTitle').value = s.title; q('#uDesc').value = s.description + '\n\nCapítulos:\n' + F.pipeline.chapters(p, p.script); q('#uTags').value = s.tags.join(', ');
        syncMeta(); F.toast('Metadatos SEO generados', 'ok');
      } catch (err) { F.toast(err.message, 'error'); }
      F.busy(b, false);
    };

    /* miniatura */
    const cvT = q('#uThumb');
    const drawThumb = async () => {
      const Wt = 1280, Ht = 720; cvT.width = Wt; cvT.height = Ht; const x = cvT.getContext('2d');
      x.fillStyle = '#120c08'; x.fillRect(0, 0, Wt, Ht);
      const img = thumbImg ? await F.media.image(thumbImg).catch(() => null) : null;
      if (img) { const ir = img.width / img.height; let dw = Wt, dh = Wt / ir; if (dh < Ht) { dh = Ht; dw = Ht * ir; } x.drawImage(img, (Wt - dw) / 2, (Ht - dh) / 2, dw, dh); }
      const text = q('#uThText').value.trim().toUpperCase(), sty = st.thumbStyle;
      x.textBaseline = 'top';
      if (sty === 'impacto') {
        const g = x.createLinearGradient(0, 0, Wt * 0.75, 0); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, Wt, Ht);
        let fs = 130; x.font = `900 ${fs}px Inter, Arial Black, sans-serif`; let lines = R.wrap(x, text, Wt * 0.62);
        while (lines.length > 3 && fs > 70) { fs -= 10; x.font = `900 ${fs}px Inter, Arial Black, sans-serif`; lines = R.wrap(x, text, Wt * 0.62); }
        const lh = fs * 1.02, y0 = (Ht - lines.length * lh) / 2;
        lines.forEach((l, i) => { x.lineWidth = fs * 0.12; x.strokeStyle = '#000'; x.lineJoin = 'round'; x.strokeText(l, 60, y0 + i * lh); x.fillStyle = i === lines.length - 1 && lines.length > 1 ? '#ffb23f' : '#fff'; x.fillText(l, 60, y0 + i * lh); });
        x.fillStyle = '#ff6a1a'; x.fillRect(60, y0 + lines.length * lh + 10, 180, 14);
      } else if (sty === 'limpio') {
        const g = x.createLinearGradient(0, Ht * 0.45, 0, Ht); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.9)'); x.fillStyle = g; x.fillRect(0, 0, Wt, Ht);
        const fs = 86; x.font = `800 ${fs}px Inter, sans-serif`; x.textAlign = 'center'; const lines = R.wrap(x, text, Wt * 0.86).slice(0, 2);
        lines.forEach((l, i) => { x.fillStyle = '#fff'; x.fillText(l, Wt / 2, Ht - 70 - (lines.length - i) * fs * 1.05); });
        x.fillStyle = '#ff6a1a'; x.fillRect(Wt / 2 - 90, Ht - 56, 180, 10); x.textAlign = 'left';
      } else {
        x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 0, Wt, Ht);
        x.save(); x.beginPath(); x.moveTo(Wt * 0.52, 0); x.lineTo(Wt, 0); x.lineTo(Wt, Ht); x.lineTo(Wt * 0.42, Ht); x.closePath();
        const g = x.createLinearGradient(Wt * 0.5, 0, Wt, Ht); g.addColorStop(0, '#ff4d00'); g.addColorStop(1, '#ffb23f'); x.fillStyle = g; x.globalAlpha = 0.94; x.fill(); x.restore();
        let fs = 100; x.font = `900 ${fs}px Inter, sans-serif`; let lines = R.wrap(x, text, Wt * 0.44);
        while (lines.length > 4 && fs > 60) { fs -= 8; x.font = `900 ${fs}px Inter, sans-serif`; lines = R.wrap(x, text, Wt * 0.44); }
        const y0 = (Ht - lines.length * fs * 1.05) / 2;
        lines.forEach((l, i) => { x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 12; x.fillText(l, Wt * 0.53, y0 + i * fs * 1.05); });
        x.shadowColor = 'transparent';
      }
      thumbBlob = null;
    };
    const pick = () => {
      const ids = [...new Set([...p.clips.map((c) => c.mediaId), ...F.media.images().map((m) => m.id)])].filter((id) => F.media.byId(id)).slice(0, 30);
      q('#uPick').innerHTML = ids.length ? ids.map((id) => `<img src="${F.media.url(id)}" data-pk="${id}" class="${id === thumbImg ? 'on' : ''}" alt="">`).join('') : '<span class="small dim">Sin imágenes en la biblioteca</span>';
    };
    pick(); drawThumb();
    q('#uPick').addEventListener('click', (e) => { const i = e.target.closest('[data-pk]'); if (!i) return; thumbImg = i.dataset.pk; pick(); drawThumb(); });
    q('#uThText').addEventListener('input', drawThumb);
    q('#uThSty').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) return; st.thumbStyle = b.dataset.s; save(); q('#uThSty').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); drawThumb(); });
    const thumbToBlob = () => new Promise((r) => cvT.toBlob(r, 'image/png'));
    q('#uThDl').onclick = async () => F.download(await thumbToBlob(), F.safeName(p.meta.title || p.name) + '-miniatura.png');
    q('#uThAi').onclick = async (e) => {
      const b = e.currentTarget; F.busy(b, true, 'Generando…');
      try {
        const [blob] = await F.api.image({ prompt: `YouTube thumbnail background about "${p.meta.title || p.name}". Bold, high contrast, dramatic lighting, vivid colors, clear focal subject on the right side, empty space on the left for text. No text, no letters.`, size: '1536x1024', quality: 'medium' });
        const m = await F.media.add({ type: 'image', name: 'Miniatura · ' + (p.meta.title || p.name).slice(0, 30), blob, source: 'ai' });
        thumbImg = m.id; pick(); drawThumb(); F.toast('Fondo generado', 'ok');
      } catch (err) { F.toast(err.message, 'error'); }
      F.busy(b, false);
    };

    /* YouTube */
    q('#uYt').onclick = async (e) => {
      const ex = F.lastExport && F.lastExport.projectId === p.id ? F.lastExport : null;
      if (!ex) return F.toast('Primero exporta el video (botón “Exportar”)');
      if (!p.meta.title.trim()) return F.toast('Escribe un título');
      const b = e.currentTarget; F.busy(b, true, 'Conectando…');
      const res = q('#uYtRes'); res.innerHTML = `<div class="progress"><div id="uYtBar"></div></div><div class="hint" id="uYtTxt">Autorizando…</div>`;
      try {
        const v = await F.api.youtubeUpload(ex.blob, { title: p.meta.title, description: p.meta.description, tags: p.meta.tags.split(',').map((t) => t.trim()).filter(Boolean), privacy: st.privacy, categoryId: st.category }, (f) => { const bar = q('#uYtBar'); if (bar) bar.style.width = f * 100 + '%'; const t = q('#uYtTxt'); if (t) t.textContent = `Subiendo… ${Math.round(f * 100)}%`; });
        if (st.thumbUpload) { try { await F.api.youtubeThumbnail(v.id, await thumbToBlob()); } catch (err) { F.toast('Video subido, pero la miniatura falló: ' + err.message, 'error'); } }
        res.innerHTML = `<div class="notice" style="margin:0">${I('check')}<div><b>¡Video subido!</b> <a href="https://youtu.be/${v.id}" target="_blank" rel="noopener">https://youtu.be/${v.id}</a><br><span class="small">Visibilidad: ${st.privacy}. Revísalo en YouTube Studio.</span></div></div>`;
        F.toast('Video subido a YouTube', 'ok');
      } catch (err) { res.innerHTML = `<div class="hint" style="color:var(--err)">${F.esc(err.message)}</div>`; F.toast(err.message, 'error'); }
      F.busy(b, false);
    };
    return offEx;
  };
})();
