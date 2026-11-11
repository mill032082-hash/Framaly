/* FRAMALY — Guiones: modo «Serie por capítulos».
   Con un solo tema: 1) planifica la serie (personajes, mundo, arco y capítulos con gancho y final en suspenso),
   2) escribe en automático el guion por escenas de CADA capítulo manteniendo la continuidad,
   3) produce cada capítulo como video (uno o todos seguidos). Todo se guarda al avanzar: si se corta, se continúa donde quedó. */
(function () {
  'use strict';
  const I = F.icon, esc = F.esc, V = F.views, P = F.pipeline, R = F.R;
  const K = 'framaly.series', TAB = 'framaly.guionTab';
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { F.toast('No hay espacio para guardar la serie en este navegador', 'error'); } };
  const X = (F.series = {});
  const DEF = { topic: '', chapters: 5, duration: 60, tone: 'épico y dramático', audience: 'público general', language: 'español', provider: 'auto', aspect: '9:16', style: 'anime', voice: 'onyx', subtitles: 'narracion', plan: null };
  const TONES = ['épico y dramático', 'misterioso e intrigante', 'terror y suspenso', 'emotivo y narrativo', 'humorístico y cercano', 'informativo y entretenido', 'educativo y claro', 'motivacional e inspirador'];
  const opt = (list, sel) => list.map(([v, n]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(n)}</option>`).join('');

  /** Plan de la serie: título, sinopsis, personajes, coherencia visual y capítulos */
  X.plan = async (s) => {
    const n = F.clamp(+s.chapters || 5, 2, 12);
    const j = await F.api.llmJSON({ provider: s.provider, maxTokens: 5000,
      system: 'Eres showrunner y guionista jefe de series narradas para YouTube, Shorts y TikTok. Diseñas historias por capítulos que enganchan: cada capítulo tiene su propio conflicto y termina en suspenso.',
      prompt: `Diseña una serie de ${n} capítulos sobre: "${s.topic}".
- Idioma: ${s.language} · Tono: ${s.tone} · Público: ${s.audience}
- Cada capítulo será un video narrado de unos ${s.duration} segundos, hecho con imágenes de estilo «${F.STYLES[s.style]?.name || s.style}».
Reglas: una sola historia con principio, nudo y desenlace repartida en los ${n} capítulos; la tensión sube de capítulo en capítulo; cada capítulo (menos el último) termina en una intriga concreta que el siguiente responde; el último resuelve todo. Si el tema es informativo y no una historia, reparte el contenido en ${n} partes que se construyen una sobre otra, cada una con su pregunta abierta. No uses personas reales ni marcas.
Devuelve SOLO este JSON:
{"title":"título de la serie (máx. 60 caracteres)","logline":"de qué va, en 1 o 2 frases","characters":[{"name":"nombre","description":"edad, pelo, ropa y rasgos que NO cambian, en 20 a 30 palabras"}],"visual_bible":"párrafo de 50 a 80 palabras que fija el aspecto de TODA la serie: los personajes que se repiten (con sus rasgos exactos), el lugar y la época, la paleta de colores y el tipo de luz","chapters":[{"title":"título del capítulo","summary":"qué pasa en este capítulo, en 2 o 3 frases","hook":"cómo arranca, en una frase","cliffhanger":"con qué intriga termina, en una frase"}]}
Exactamente ${n} capítulos y de 1 a 4 personajes.`,
    });
    if (!Array.isArray(j.chapters) || j.chapters.length < 2) throw new Error('La IA no devolvió los capítulos de la serie. Inténtalo de nuevo.');
    return { title: String(j.title || s.topic).slice(0, 80), logline: String(j.logline || ''), bible: String(j.visual_bible || '').slice(0, 900),
      characters: (Array.isArray(j.characters) ? j.characters : []).slice(0, 6).map((c) => ({ name: String(c.name || ''), description: String(c.description || '') })),
      chapters: j.chapters.slice(0, 12).map((c) => ({ title: String(c.title || 'Capítulo'), summary: String(c.summary || ''), hook: String(c.hook || ''), cliffhanger: String(c.cliffhanger || ''), script: null, recap: '', projectId: '' })) };
  };
  /** Guion por escenas del capítulo i, con lo que pasó antes como contexto */
  X.writeChapter = async (s, i) => {
    const pl = s.plan, sc = await P.writeScript({ topic: `${pl.title} — capítulo ${i + 1}: ${pl.chapters[i].title}`, duration: s.duration, tone: s.tone, audience: s.audience, language: s.language }, { provider: s.provider }, { series: pl, index: i });
    sc.title = `${pl.title} · Cap. ${i + 1}: ${pl.chapters[i].title}`.slice(0, 100);
    pl.chapters[i].script = sc; pl.chapters[i].recap = sc.recap || pl.chapters[i].summary;
    return sc;
  };
  /** Configuración de producción de un capítulo (mismo estilo, voz y formato en toda la serie) */
  X.cfgFor = (s, i) => {
    const g = /terror/.test(s.style + ' ' + s.tone) ? 'terror' : /anime|cyber|epico|comic/.test(s.style) || /épico/.test(s.tone) ? 'anime' : 'youtube';
    const fl = P.makeFlow(g), sc = s.plan.chapters[i].script;
    Object.assign(fl.cfg.idea, { topic: s.topic || s.plan.title, duration: s.duration, aspect: s.aspect, language: s.language, tone: s.tone, audience: s.audience });
    fl.cfg.images.style = s.style; fl.cfg.montage.subtitles = s.subtitles; fl.cfg.voice.voice = s.voice || 'nova'; fl.on.voice = !!s.voice; fl.on.seo = F.api.textReady(); fl.cfg.output.name = sc.title;
    return { ...P.cfgFrom(fl), script: { provider: s.provider }, presetScript: { title: sc.title, bible: s.plan.bible || sc.bible || '', scenes: sc.scenes.filter((x) => x.narration.trim() || x.image_prompt.trim()) } };
  };

  const view = (el) => {
    const st = { ...DEF, ...read(K, {}) }; let working = false, note = '';
    const save = () => write(K, st);
    const done = () => (st.plan ? st.plan.chapters.filter((c) => c.script).length : 0);
    const draw = () => {
      const pl = st.plan, nd = done(), tot = pl ? pl.chapters.length : 0;
      el.innerHTML = `<div class="split">
        <div class="card sticky"><h2>${I('layers')} Serie por capítulos</h2><p class="desc">Escribe la idea una vez. La IA planifica la serie y escribe las escenas de cada capítulo, con los mismos personajes y un final en suspenso que lleva al siguiente.</p>
          <label class="lbl">Historia o tema de la serie</label><textarea data-k="topic" rows="3" placeholder="Ej: Un chico descubre que su sombra tiene vida propia y quiere ocupar su lugar">${esc(st.topic)}</textarea>
          <div class="grid2"><div><label class="lbl">Capítulos</label><input type="number" data-k="chapters" min="2" max="12" value="${st.chapters}"></div><div><label class="lbl">Segundos por capítulo</label><input type="number" data-k="duration" min="20" max="600" step="5" value="${st.duration}"></div></div>
          <label class="lbl">Tono</label><select data-k="tone">${opt(TONES.map((t) => [t, t[0].toUpperCase() + t.slice(1)]), st.tone)}</select>
          <div class="grid2"><div><label class="lbl">Estilo de las imágenes</label><select data-k="style">${opt(Object.entries(F.STYLES).map(([k, v]) => [k, v.name]), st.style)}</select></div><div><label class="lbl">Formato</label><select data-k="aspect">${opt(R.ASPECTS, st.aspect)}</select></div>
            <div><label class="lbl">Voz</label><select data-k="voice">${opt([['', 'Sin voz'], ...F.api.OPENAI_VOICES.map((v) => [v, v])], st.voice)}</select></div><div><label class="lbl">Idioma</label><input type="text" data-k="language" value="${esc(st.language)}"></div></div>
          <label class="lbl">Modelo de texto</label><select data-k="provider">${opt([['auto', 'Según Integraciones'], ['anthropic', 'Claude (Anthropic)'], ['openai', 'OpenAI GPT'], ['gemini', 'Gemini (Google)'], ['minimax', 'MiniMax']], st.provider)}</select>
          <button class="btn primary block lg" id="srGo" style="margin-top:16px" ${working ? 'disabled' : ''}>${working ? `<span class="spin"></span> ${esc(note)}` : `${I('sparkles')} ${pl ? 'Crear una serie nueva' : 'Crear la serie completa'}`}</button>
          ${pl && nd < tot && !working ? `<button class="btn block" id="srCont" style="margin-top:8px">${I('play')} Continuar: faltan ${tot - nd} capítulos por escribir</button>` : ''}
          <p class="hint">Escribir la serie solo usa la IA de texto (centavos). Las imágenes y voces se generan después, cuando produces cada capítulo.</p>
        </div>
        <div id="srOut">${pl ? `
          <div class="card"><label class="lbl">Título de la serie</label><input type="text" data-p="title" value="${esc(pl.title)}" style="font-size:16px;font-weight:700"><p class="small muted" style="margin:8px 0">${esc(pl.logline)}</p>
            ${pl.characters.length ? `<div class="small"><b>Personajes:</b> ${pl.characters.map((c) => `<span title="${esc(c.description)}" class="tag">${esc(c.name)}</span>`).join(' ')}</div>` : ''}
            <label class="lbl">Coherencia visual de toda la serie (se añade a cada imagen)</label><textarea data-p="bible" rows="3">${esc(pl.bible)}</textarea>
            <div class="row" style="margin-top:10px;gap:6px;flex-wrap:wrap"><span class="tag or">${tot} capítulos</span><span class="tag">${nd}/${tot} guiones listos</span><span class="tag">${pl.chapters.filter((c) => c.projectId && F.projects.list.some((p) => p.id === c.projectId)).length} videos hechos</span><span class="grow"></span>
              <button class="btn sm" id="srCopy">${I('copy')} Copiar todo</button><button class="btn sm primary" id="srAll" ${nd && !working ? '' : 'disabled'}>${I('zap')} Producir todos los capítulos</button></div></div>
          ${pl.chapters.map((c, i) => { const has = !!c.script, made = c.projectId && F.projects.list.some((p) => p.id === c.projectId), w = has ? c.script.scenes.reduce((a, x) => a + x.narration.split(/\s+/).filter(Boolean).length, 0) : 0;
            return `<div class="card sr-ch" data-ch="${i}"><div class="row" style="gap:8px;align-items:flex-start"><span class="sr-n">${i + 1}</span><div style="flex:1;min-width:0"><input type="text" data-c="title" value="${esc(c.title)}" style="font-weight:700"><p class="small" style="margin:6px 0 2px">${esc(c.summary)}</p><p class="small muted" style="margin:0">${i < tot - 1 ? `<b>Termina en suspenso:</b> ${esc(c.cliffhanger)}` : '<b>Final de la serie</b>'}</p></div></div>
              <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px">${has ? `<span class="tag or">${c.script.scenes.length} escenas</span><span class="tag">≈ ${F.fmtS(w / 2.4)}</span>` : '<span class="tag">Guion pendiente</span>'}${made ? '<span class="tag" style="color:#22c55e">✓ Video hecho</span>' : ''}<span class="grow"></span>
                <button class="btn sm" data-a="write" ${working ? 'disabled' : ''}>${I('refresh')} ${has ? 'Reescribir' : 'Escribir'}</button>${has ? `<button class="btn sm primary" data-a="make" ${working ? 'disabled' : ''}>${I('film')} ${made ? 'Producir otra vez' : 'Producir video'}</button>` : ''}${made ? `<button class="btn sm" data-a="open">Abrir</button>` : ''}</div>
              ${has ? `<details class="sr-sc"><summary class="small muted" style="cursor:pointer;margin-top:8px">Ver y editar las ${c.script.scenes.length} escenas</summary>${c.script.scenes.map((x, k) => `<div class="scene" data-sc="${k}"><span class="n">${k + 1}</span><label class="lbl">Narración</label><textarea data-s="narration" rows="2">${esc(x.narration)}</textarea><div class="grid2"><div><label class="lbl">Imagen</label><textarea data-s="image_prompt" rows="2">${esc(x.image_prompt)}</textarea></div><div><label class="lbl">Texto en pantalla</label><textarea data-s="on_screen_text" rows="2">${esc(x.on_screen_text)}</textarea></div></div></div>`).join('')}</details>` : ''}</div>`; }).join('')}`
          : `<div class="empty" style="padding:70px 20px">${I('layers')}<p><b>Tu serie aparecerá aquí</b></p><p class="small">Escribe la idea, elige cuántos capítulos y pulsa «Crear la serie completa».</p></div>`}</div></div>`;
    };
    const busy = (t) => { working = !!t; note = t || ''; draw(); };
    /** Escribe los capítulos que falten, uno tras otro, guardando después de cada uno */
    const writeMissing = async () => {
      const pl = st.plan;
      for (let i = 0; i < pl.chapters.length; i++) {
        if (pl.chapters[i].script) continue;
        busy(`Escribiendo capítulo ${i + 1} de ${pl.chapters.length}…`);
        await X.writeChapter(st, i); save();
      }
    };
    const run = async (fn) => { try { await fn(); F.toast('Serie lista: revisa los capítulos y prodúcelos', 'ok', 5000); } catch (e) { F.toast(e.message + (st.plan ? ' · Lo ya escrito quedó guardado: pulsa «Continuar».' : ''), 'error', 9000); } finally { busy(''); } };
    const produce = async (i) => {
      document.querySelectorAll('.modal-bg').forEach((m) => m.remove());
      const p = await P.runModal(X.cfgFor(st, i), { autoExport: false });
      if (p) { st.plan.chapters[i].projectId = p.id; save(); }
      return p;
    };
    draw();
    el.addEventListener('input', (e) => {
      const t = e.target, pl = st.plan;
      if (t.dataset.k) { st[t.dataset.k] = t.type === 'number' ? +t.value : t.value; return save(); }
      if (!pl) return;
      if (t.dataset.p) { pl[t.dataset.p] = t.value; return save(); }
      const ch = t.closest('[data-ch]'); if (!ch) return; const c = pl.chapters[+ch.dataset.ch];
      if (t.dataset.c) { c[t.dataset.c] = t.value; return save(); }
      const sc = t.closest('[data-sc]'); if (sc && t.dataset.s && c.script) { c.script.scenes[+sc.dataset.sc][t.dataset.s] = t.value; save(); }
    });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b || working) return; const pl = st.plan;
      if (b.id === 'srGo') {
        if (st.topic.trim().length < 6) return F.toast('Escribe la historia o el tema de la serie');
        if (pl && !(await F.confirm('Crear una serie nueva', 'Se reemplaza la serie actual y sus guiones. Los videos ya producidos se quedan en tus proyectos.', 'Crear nueva', false))) return;
        return run(async () => { busy('Planificando la serie…'); st.plan = await X.plan(st); save(); await writeMissing(); });
      }
      if (b.id === 'srCont') return run(writeMissing);
      if (!pl) return;
      if (b.id === 'srCopy') { navigator.clipboard?.writeText(`${pl.title}\n${pl.logline}\n\n${pl.chapters.map((c, i) => `CAPÍTULO ${i + 1}: ${c.title}\n${c.summary}\n${c.script ? c.script.scenes.map((x, k) => `  Escena ${k + 1}: ${x.narration}\n  [Imagen: ${x.image_prompt}]`).join('\n') : '(guion pendiente)'}`).join('\n\n')}`); return F.toast('Serie copiada', 'ok'); }
      if (b.id === 'srAll') {
        const todo = pl.chapters.map((c, i) => i).filter((i) => pl.chapters[i].script && !(pl.chapters[i].projectId && F.projects.list.some((p) => p.id === pl.chapters[i].projectId)));
        if (!todo.length) return F.toast('Todos los capítulos con guion ya tienen su video');
        const imgs = todo.reduce((a, i) => a + pl.chapters[i].script.scenes.length, 0);
        if (!(await F.confirm('Producir todos los capítulos', `Se van a producir <b>${todo.length} videos</b> seguidos: unas <b>${imgs} imágenes</b>${st.voice ? ` y <b>${imgs} narraciones</b>` : ''} con tus IA. Puede tardar varios minutos y gasta créditos. Si se corta, lo ya hecho no se vuelve a pagar. ¿Continuar?`, 'Producir todos', false))) return;
        let ok = 0; for (const i of todo) { const p = await produce(i); if (!p) break; ok++; }
        document.querySelectorAll('.modal-bg').forEach((m) => m.remove()); draw();
        return F.toast(ok === todo.length ? `Listo: ${ok} capítulos producidos. Están en Proyectos.` : `Se produjeron ${ok} de ${todo.length}. El que se cortó quedó en «Proyectos a medias» (Inicio).`, ok === todo.length ? 'ok' : 'error', 9000);
      }
      const ch = b.closest('[data-ch]'); if (!ch) return; const i = +ch.dataset.ch, c = pl.chapters[i];
      if (b.dataset.a === 'write') return run(async () => { busy(`Escribiendo capítulo ${i + 1}…`); await X.writeChapter(st, i); save(); });
      if (b.dataset.a === 'make') { const p = await produce(i); if (p) draw(); return; }
      if (b.dataset.a === 'open') { F.projects.setCurrent(c.projectId); return F.router.go('#/editor'); }
    });
  };

  /** Qué IA de texto va a escribir: { claude: bool, other: nombre de la que se usará si Claude no está } */
  X.writer = async () => {
    const L = { openai: 'OpenAI', gemini: 'Gemini', minimax: 'MiniMax' }, other = L[['openai', 'gemini', 'minimax'].find((x) => F.api.has(x) && F.api.canUse(x, 'text'))] || '';
    let claude = !!(F.settings.keys.anthropic || '').trim();
    if (!claude && F.cloud?.configured?.() && F.cloud.user && F.api.has('anthropic')) { try { const st = await F.cloud.apiStatus(); const v = st?.anthropic; claude = !!v && v !== 'none' && v.state !== 'none' && v !== 'fail'; } catch (e) { return null; } }
    if (!F.api.canUse('anthropic', 'text')) claude = false;
    return { claude, other };
  };

  /* La página Guiones ahora tiene dos modos */
  const single = V.guiones;
  V.guiones = (el) => {
    let tab = read(TAB, 'uno');
    el.innerHTML = `<div class="page"><div class="seg" id="gMode" style="margin-bottom:14px"><button data-m="uno">${I('script')} Un video</button><button data-m="serie">${I('layers')} Serie por capítulos</button></div><div id="gIA" class="small muted" style="margin:-6px 0 12px"></div><div id="gInbox"></div><div id="gBody"></div></div>`;
    X.writer().then((w) => { const box = el.querySelector('#gIA'); if (box && w) box.innerHTML = w.claude ? `${I('sparkles')} Los guiones los escribe <b>Claude</b>.` : `${I('sparkles')} <b>Claude todavía no está conectado</b>: los guiones se escriben con <b>${esc(w.other || 'otra IA')}</b>. Para usar Claude, pega su clave en <a href="#/integraciones">Integraciones API → Claude</a>.`; });
    const body = el.querySelector('#gBody');
    const show = () => {
      el.querySelectorAll('#gMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === tab));
      const fresh = document.createElement('div'); body.replaceChildren(fresh);
      if (tab === 'serie') view(fresh); else { single(fresh); const pg = fresh.querySelector('.page'); if (pg) pg.classList.remove('page'); }
    };
    el.querySelector('#gMode').addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (!b) return; tab = b.dataset.m; write(TAB, tab); show(); });
    show();
    // guiones que envió ChatGPT u otra IA: se abren en el guionista de «Un video»
    F.inbox?.mount(el.querySelector('#gInbox'), { open: (script, row) => { const cur = read('framaly.script', {}); write('framaly.script', { ...cur, topic: row.data?.topic || script.title, aspect: row.data?.aspect || cur.aspect || '9:16', language: row.data?.language || cur.language || 'español', script }); tab = 'uno'; write(TAB, tab); show(); el.querySelector('#gBody').scrollIntoView({ behavior: 'smooth', block: 'start' }); F.toast('Guion abierto: revísalo y pulsa «Generar video completo»', 'ok'); } });
  };
})();
