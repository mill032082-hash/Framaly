/* FRAMALY — «Videos con IA»: genera clips de video a partir de texto (y, si quieres, una imagen de partida)
   con Veo 3 (usa la clave de Gemini) o MiniMax Hailuo. El trabajo se guarda mientras se genera:
   si cierras la página, al volver se retoma sin pagar otra vez. El resultado va a la Biblioteca como video. */
(function () {
  'use strict';
  const I = F.icon, esc = F.esc, V = F.views;
  const JK = 'framaly.videoJobs', FK = 'framaly.videoForm';
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin memoria */ } };
  const X = (F.videoAI = { busy: new Set() });
  X.jobs = () => read(JK, []);
  const saveJob = (j) => { const l = X.jobs().filter((x) => x.id !== j.id); l.unshift(j); write(JK, l.slice(0, 20)); F.emit('videojobs'); };
  const dropJob = (id) => { write(JK, X.jobs().filter((x) => x.id !== id)); F.emit('videojobs'); };

  /* costo aproximado en US$ (el real depende de tu plan con el proveedor) */
  X.cost = (prov, o = {}) => {
    if (prov === 'minimax') return (/1080/.test(o.resolution || '') ? 0.49 : 0.28) * (o.duration >= 10 ? 2 : 1);
    const m = F.settings.models.veo || ''; return (o.duration || 8) * (/fast/i.test(m) ? 0.15 : /lite/i.test(m) ? 0.1 : 0.4);
  };

  const toImage = async (src) => {   // imagen de partida → JPEG de máx. 1280 px en base64
    const blob = src instanceof Blob ? src : F.media.byId(src)?.blob; if (!blob) return null;
    const u = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo leer la imagen de partida.')); i.src = u; });
      const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return { mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.88).split(',')[1] };
    } finally { URL.revokeObjectURL(u); }
  };

  /** Empieza a generar. o: { provider, prompt, aspect, duration, resolution, negative, imageId | imageBlob } */
  X.start = async (o) => {
    const image = o.imageBlob || o.imageId ? await toImage(o.imageBlob || o.imageId) : null;
    const job = await F.api.videoStart({ ...o, image });
    const j = { ...job, prompt: o.prompt, aspect: o.aspect, duration: o.duration, resolution: o.resolution, created: Date.now(), status: 'running', note: 'En cola' };
    saveJob(j); X.watch(); return j;
  };

  /** Guarda el video terminado en la Biblioteca */
  const finish = async (j) => {
    const blob = await F.api.videoFetch(j, j.file);
    const name = (j.prompt || 'Video IA').replace(/\s+/g, ' ').slice(0, 48);
    const res = await F.media.addVideos([new File([blob], name + '.mp4', { type: 'video/mp4' })]);
    const m = res[0]?.video; if (!m) throw new Error('El navegador no pudo leer el video generado.');
    m.source = 'ai'; m.meta = { ...(m.meta || {}), prompt: j.prompt, provider: j.provider, model: j.model }; m.updated = Date.now(); await F.db.put('media', m); F.emit('media');
    return m;
  };

  /** Revisa los trabajos pendientes (una sola revisión a la vez por trabajo) */
  X.poll = async () => {
    for (const j of X.jobs()) {
      if (X.busy.has(j.id) || j.status === 'error') continue;
      X.busy.add(j.id);
      try {
        if (j.status === 'running') {
          const s = await F.api.videoStatus(j);
          if (s.status === 'running') { if (s.note !== j.note) saveJob({ ...j, note: s.note }); continue; }
          if (s.status === 'error') { saveJob({ ...j, status: 'error', error: s.error }); F.toast(s.error, 'error', 8000); continue; }
          j.status = 'ready'; j.file = s.file; j.note = 'Descargando'; saveJob(j);
        }
        if (j.status === 'ready') { const m = await finish(j); dropJob(j.id); F.toast(`Video listo: «${m.name}». Está en tu Biblioteca.`, 'ok', 7000); }
      } catch (e) {
        const fatal = /40[0134]|no está habilitado|Falta la API key|no válida/i.test(e.message);
        j.fails = (j.fails || 0) + 1;
        if (fatal || j.fails >= 6) { saveJob({ ...j, status: j.status === 'ready' ? 'ready' : 'error', error: e.message, stuck: true }); if (j.fails === 6 || fatal) F.toast('Video: ' + e.message, 'error', 8000); }
        else saveJob(j);
      } finally { X.busy.delete(j.id); }
    }
  };
  let timer = 0;
  X.watch = () => { if (timer) return; const tick = async () => { timer = 0; const act = X.jobs().filter((j) => (j.status === 'running' || j.status === 'ready') && !j.stuck); if (!act.length) return; await X.poll(); if (X.jobs().some((j) => (j.status === 'running' || j.status === 'ready') && !j.stuck)) timer = setTimeout(tick, 9000); }; timer = setTimeout(tick, 1500); };
  X.retry = (id) => { const j = X.jobs().find((x) => x.id === id); if (!j) return; saveJob({ ...j, status: j.file ? 'ready' : 'running', error: '', stuck: false, fails: 0 }); X.watch(); };
  setTimeout(() => X.watch(), 4000);   // retoma lo que quedó a medias al abrir la app

  const IDEAS = ['Un colibrí bebiendo de una flor roja en cámara lenta, luz dorada del amanecer, fondo desenfocado', 'Toma aérea de un dron sobre un valle con niebla al amanecer, movimiento lento hacia adelante, estilo documental',
    'Primer plano de café cayendo en una taza blanca, vapor, luz cálida de estudio, cámara lenta', 'Una persona camina por una calle con luces de neón bajo la lluvia, de noche, estilo cinematográfico, cámara siguiéndola'];

  V.videosia = (el) => {
    const st = { provider: '', prompt: '', aspect: '9:16', duration: 6, resolution: '', negative: '', imageId: '', ...read(FK, {}) }; let imageBlob = null;
    const save = () => write(FK, { ...st });
    const draw = () => {
      const provs = F.api.videoProviders(), imgs = F.media.images().slice(0, 60);
      if (!provs.some((p) => p.id === st.provider)) st.provider = provs[0]?.id || '';
      const veo = st.provider === 'veo', v31 = /3\.1/.test(F.settings.models.veo || ''), durs = veo ? (v31 ? [4, 6, 8] : [8]) : [6, 10];
      if (!durs.includes(+st.duration)) st.duration = durs[durs.length - 1];
      const cost = st.provider ? X.cost(st.provider, st) : 0;
      el.innerHTML = `<div class="page"><div class="split">
        <div class="card sticky"><h2>${I('film')} Generador de video con IA</h2><p class="desc">Describe la escena y la IA crea un clip de video. Se guarda en tu Biblioteca y lo puedes usar en el editor.</p>
          ${provs.length ? '' : `<div class="hint" style="border:1px solid rgba(245,158,11,.5);border-radius:10px;padding:10px;margin-bottom:10px"><b>Falta conectar una IA de video.</b> Conecta <b>Gemini</b> (para Veo 3) o <b>MiniMax</b> en <a href="#/integraciones">Integraciones API</a>.</div>`}
          <label class="lbl">¿Qué se ve en el video?</label><textarea id="vPrompt" rows="5" placeholder="Ej: ${esc(IDEAS[0])}">${esc(st.prompt)}</textarea>
          <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><button class="btn sm" id="vBetter" title="Reescribe tu idea como una descripción cinematográfica detallada">${I('wand')} Mejorar descripción con IA</button><button class="btn sm ghost" id="vIdea">${I('sparkles')} Dame una idea</button></div>
          <div class="grid2"><div><label class="lbl">IA de video</label><select id="vProv">${provs.map((p) => `<option value="${p.id}" ${p.id === st.provider ? 'selected' : ''}>${esc(p.name)}</option>`).join('') || '<option value="">(ninguna conectada)</option>'}</select></div>
            <div><label class="lbl">Formato</label><select id="vAspect"><option value="9:16" ${st.aspect === '9:16' ? 'selected' : ''}>Vertical 9:16</option><option value="16:9" ${st.aspect === '16:9' ? 'selected' : ''}>Horizontal 16:9</option></select></div></div>
          <div class="grid2"><div><label class="lbl">Duración</label><select id="vDur">${durs.map((d) => `<option value="${d}" ${+st.duration === d ? 'selected' : ''}>${d} segundos</option>`).join('')}</select></div>
            <div><label class="lbl">Calidad</label><select id="vRes">${(veo ? [['', '720p (normal)'], ['1080p', '1080p']] : [['', '768p (normal)'], ['1080P', '1080p (más cara)']]).map(([v, n]) => `<option value="${v}" ${st.resolution === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
          <label class="lbl">Imagen de partida (opcional): el video empieza desde esta imagen</label>
          <div class="row" style="gap:6px;flex-wrap:wrap"><select id="vImg" style="flex:1;min-width:140px"><option value="">— sin imagen (solo texto) —</option>${imgs.map((m) => `<option value="${m.id}" ${st.imageId === m.id ? 'selected' : ''}>${esc(m.name.slice(0, 40))}</option>`).join('')}</select><button class="btn sm" id="vUp">${I('upload')} Subir</button></div>
          <div class="small muted" id="vImgInfo">${imageBlob ? 'Imagen subida lista.' : ''}</div>
          ${veo ? `<label class="lbl">Qué NO quieres ver (opcional)</label><input type="text" id="vNeg" value="${esc(st.negative)}" placeholder="texto, logos, marcas de agua">` : `<div class="hint">MiniMax elige el formato solo: sale horizontal salvo que le des una imagen de partida vertical.</div>`}
          <button class="btn primary block lg" id="vGo" style="margin-top:16px" ${provs.length ? '' : 'disabled'}>${I('sparkles')} Generar video</button>
          <p class="hint">Costo aproximado: <b>US$ ${cost.toFixed(2)}</b> por video${veo ? ` (${esc(F.settings.models.veo)})` : ''}. Tarda de 1 a 6 minutos; puedes seguir trabajando mientras tanto. Cada video cuenta contra el límite mensual de esa IA.</p>
        </div>
        <div><div id="vJobs"></div><div class="card"><h3 style="margin-top:0">Videos generados</h3><div class="tiles" id="vOut"></div></div></div></div></div>`;
      jobs(); out();
    };
    const jobs = () => {
      const box = el.querySelector('#vJobs'); if (!box) return; const l = X.jobs();
      box.innerHTML = l.length ? `<div class="card" style="margin-bottom:14px"><h3 style="margin-top:0">En proceso</h3>${l.map((j) => {
        const min = Math.max(0, Math.round((Date.now() - j.created) / 60000)), bad = j.status === 'error' || j.stuck;
        return `<div class="pend" data-job="${esc(j.id)}"><b>${esc((j.prompt || '').slice(0, 90))}</b><div class="small muted">${j.provider === 'veo' ? 'Veo' : 'MiniMax'} · ${j.aspect} · hace ${min} min</div>
          <div class="small" style="color:${bad ? '#ef4444' : 'inherit'}">${bad ? esc(j.error || 'Se detuvo') : `<span class="spin"></span> ${esc(j.note || 'Generando')}…`}</div>
          <div class="row" style="gap:6px">${bad && (j.file || !/bloque|no pudo generar|filtros/i.test(j.error || '')) ? `<button class="btn sm primary" data-jr="1">${I('refresh')} ${j.file ? 'Reintentar descarga' : 'Volver a consultar'}</button>` : ''}<button class="btn sm ghost" data-jd="1" title="${bad ? 'Quitar de la lista' : 'Dejar de esperar este video (no devuelve el costo)'}">${I('trash')}</button></div></div>`;
      }).join('')}</div>` : '';
    };
    const out = () => {
      const box = el.querySelector('#vOut'); if (!box) return; const vids = F.media.videos().filter((m) => m.source === 'ai');
      box.innerHTML = vids.length ? vids.map((m) => V.tile(m)).join('') : `<div class="empty" style="grid-column:1/-1;padding:50px 20px">${I('film')}<p><b>Tus videos aparecerán aquí</b></p><p class="small">Describe una escena y pulsa «Generar video».</p></div>`;
    };
    draw(); V.mediaActions(el);
    el.addEventListener('input', (e) => { const t = e.target; if (t.id === 'vPrompt') { st.prompt = t.value; save(); } else if (t.id === 'vNeg') { st.negative = t.value; save(); } });
    el.addEventListener('change', (e) => {
      const t = e.target, map = { vProv: 'provider', vAspect: 'aspect', vDur: 'duration', vRes: 'resolution', vImg: 'imageId' }, k = map[t.id]; if (!k) return;
      st[k] = k === 'duration' ? +t.value : t.value; if (k === 'imageId') imageBlob = null; if (k === 'provider') st.resolution = ''; save(); draw();
    });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const jb = b.closest('[data-job]');
      if (jb && b.dataset.jr) { X.retry(jb.dataset.job); return jobs(); }
      if (jb && b.dataset.jd) { const j = X.jobs().find((x) => x.id === jb.dataset.job), live = j && !j.stuck && j.status !== 'error'; if (live && !(await F.confirm('Dejar de esperar', 'El video ya se está generando y el proveedor lo cobra igual. Si lo quitas, no se guardará en tu Biblioteca.', 'Quitar'))) return; return dropJob(jb.dataset.job); }
      if (b.id === 'vIdea') { st.prompt = IDEAS[Math.floor(Math.random() * IDEAS.length)]; save(); el.querySelector('#vPrompt').value = st.prompt; return; }
      if (b.id === 'vUp') { const f = (await F.pickFiles('image/*', false))[0]; if (!f) return; imageBlob = f; st.imageId = ''; save(); el.querySelector('#vImg').value = ''; el.querySelector('#vImgInfo').textContent = `Imagen subida: ${f.name}`; return; }
      if (b.id === 'vBetter') {
        if (!st.prompt.trim()) return F.toast('Escribe primero tu idea, aunque sea corta');
        F.busy(b, true, 'Mejorando…');
        try {
          const t = await F.api.llm({ system: 'Eres director de fotografía. Reescribe la idea del usuario como una descripción para un generador de video con IA: un solo plano de pocos segundos, con sujeto, acción, entorno, luz, movimiento de cámara y estilo visual. Máximo 70 palabras, en español, sin comillas ni explicaciones. No inventes marcas, textos en pantalla ni personas reales.', prompt: st.prompt, maxTokens: 400 });
          if (t.trim()) { st.prompt = t.trim().replace(/^["«]|["»]$/g, ''); save(); el.querySelector('#vPrompt').value = st.prompt; }
        } catch (er) { F.toast(er.message, 'error', 6000); } finally { F.busy(b, false); }
        return;
      }
      if (b.id === 'vGo') {
        if (st.prompt.trim().length < 8) { el.querySelector('#vPrompt').focus(); return F.toast('Describe la escena con un poco más de detalle'); }
        const cost = X.cost(st.provider, st);
        if (!(await F.confirm('Generar video', `Se va a generar un video de ${st.duration} s con ${st.provider === 'veo' ? 'Veo' : 'MiniMax'}. Costo aproximado: <b>US$ ${cost.toFixed(2)}</b>. ¿Continuar?`, 'Generar', false))) return;
        F.busy(b, true, 'Enviando…');
        try { await X.start({ ...st, prompt: st.prompt.trim(), imageBlob }); F.toast('Video en proceso. Te aviso cuando esté listo (1 a 6 minutos).', 'ok', 6000); }
        catch (er) { F.toast(er.message, 'error', 9000); } finally { F.busy(b, false); }
      }
    });
    const offs = [F.on('videojobs', () => (el.isConnected ? jobs() : offs.forEach((o) => o()))), F.on('media', () => el.isConnected && out())];
    const iv = setInterval(() => (el.isConnected ? jobs() : clearInterval(iv)), 30000);
    X.watch();
    return () => { offs.forEach((o) => o()); clearInterval(iv); };
  };
})();
