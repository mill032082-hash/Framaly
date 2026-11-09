/* FRAMALY — Sección «Plantillas» (debajo de Editor de video).
   Todas las combinaciones que salen de la skill «Millora · Editor de video»:
   recetas completas por destino, matrices (cámara × bloque, b-roll, instrucciones), combinaciones prohibidas
   y un armador propio. Una receta crea un proyecto ya configurado y su texto de contexto. */
(function () {
  'use strict';
  const I = F.icon, esc = F.esc, V = F.views;

  /* ---- Las piezas del método (cada una con su regla) ---- */
  const CUT = { vol: 'Cortar por volumen (200 ms de aire, sin tocar inicio/fin de palabra)', trans: 'Cortar con transcripción (muletillas, pausas, tomas repetidas: se queda la segunda)' };
  const CAM = {
    none: 'Sin reparto de cámaras (plano único)',
    fl: 'Frontal → lateral → frontal: hook y promesa de frente, historia en lateral, CTA de frente',
    fl3: 'Frontal + lateral + closeup (uno cada ~3 min) con punch-in 113 % y tope 125 %',
  };
  const SUB = 'Subtítulos palabra por palabra, máx. 3 palabras, mayúsculas, sin ¿ ¡, contra el video YA cortado';
  const BROLL = {
    obj: 'Imagen del objeto sobre negro, menos de 1 s, con foto real del producto como semilla',
    mock: 'Mockups HTML/CSS (chat de WhatsApp, notificaciones, interfaces)',
    txt: 'Texto grande: la palabra clave a pantalla completa, resaltada',
    ico: 'Iconos y logos (apps, banderas, sellos de garantía)',
    anim: 'Animación hecha con el motor del editor',
  };
  const SND = { duck: 'Música con ducking −12 dB cuando habla la voz', sfx: 'Efectos (pop, whoosh, ding) desacoplados del corte (caen 0,18 s después)', vo: 'Voz en off (opcional)' };

  /* ---- Recetas completas ---- */
  const RECETAS = [
    { id: 'cod', n: 'Anuncio de venta COD', tag: 'Meta / TikTok', aspect: '9:16', dest: 'meta', target: 35, dur: '25–40 s', cut: 'trans', cam: 'none', broll: ['obj', 'mock', 'txt', 'ico'], snd: ['duck', 'sfx'],
      why: 'El primer segundo frena el scroll y el gancho pega en los primeros 3 s. Sin claims prohibidos, sin CTA en inglés.', hook: 'Gancho en 3 s → problema → producto real → prueba → oferta → CTA' },
    { id: 'reel', n: 'Reel orgánico', tag: 'Instagram / TikTok', aspect: '9:16', dest: 'reel', target: 30, dur: '~30 s', cut: 'trans', cam: 'fl', broll: ['obj', 'txt', 'anim'], snd: ['duck', 'sfx'],
      why: 'Mismo método, menos presión de oferta. Se ve sin sonido (el 85 % lo mira así): subtítulos y b-roll cargan el mensaje.', hook: 'Gancho → una idea por bloque → cierre que invita a seguir' },
    { id: 'yt', n: 'Video de YouTube con una cámara', tag: 'YouTube', aspect: '16:9', dest: 'yt', target: 0, dur: 'según el guion', cut: 'trans', cam: 'fl3', broll: ['txt', 'ico', 'anim'], snd: ['duck', 'vo'],
      why: 'Un solo encuadre se cae: el encuadre cambia cuando cambia la idea (~cada 1 min 30 s), no cuando el editor se aburre.', hook: 'bloque 1-2 frontal (hook, promesa) · 3-5 lateral (historia, giro) · 6 frontal (CTA)' },
    { id: 'camara', n: 'Multicámara con una sola cámara', tag: 'Reparto por ideas', aspect: '9:16', dest: 'reel', target: 40, dur: '30–60 s', cut: 'trans', cam: 'fl3', broll: ['obj', 'txt'], snd: ['duck'],
      why: 'Sin fotos por cámara no hay cambio de cámara: hay reencuadre, y se dice así. El frontal se guarda para cuando le hablas al espectador.', hook: 'frontal = hook/promesa/CTA · lateral = narración · closeup = la frase que quieres que repitan' },
    { id: 'ref', n: 'Replicar un estilo de referencia', tag: '3–5 capturas', aspect: '9:16', dest: 'meta', target: 35, dur: 'la de la referencia', cut: 'vol', cam: 'none', broll: ['obj', 'txt'], snd: ['duck', 'sfx'],
      why: 'Se destila, no se clona: paleta, tipografía, ritmo y animación; identidad propia, nunca la marca ajena. Luego se guarda con el nombre del cliente.', hook: 'Capturas: gancho · un visual · un subtítulo · el cierre → «Replicar estilo desde capturas»' },
    { id: 'limpio', n: 'Solo limpiar el crudo', tag: 'Cortes + subtítulos', aspect: '9:16', dest: 'reel', target: 0, dur: 'la del crudo', cut: 'vol', cam: 'none', broll: [], snd: ['duck'],
      why: 'La base limpia: cortes y subtítulos. Un crudo de 1:40 baja a ~58 s con ~40 cortes; si sale en 1:20 no se cortaron los silencios.', hook: 'Cortar → Subtitular (no ilustra ni sonoriza)' },
  ];

  const recipeText = (r, c) => {
    const cut = CUT[c.cut], cam = CAM[c.cam], br = c.broll.map((k) => BROLL[k]), sn = c.snd.map((k) => SND[k]);
    return `RECETA · ${r.n} (${r.tag})
Formato: ${c.aspect} · duración objetivo: ${c.target ? c.target + ' s' : r.dur}
Orden fijo: Cortar → Subtitular → Ilustrar → Sonorizar
1. CORTAR: ${cut}. Si dudas, deja. Nunca cortes la primera ni la última palabra de una frase. El corte cae en el silencio más cercano (ventana 1,5 s); sin silencio, no se corta.
2. SUBTITULAR: ${SUB}.
3. ILUSTRAR: ${br.length ? br.map((b) => '\n   · ' + b).join('') : 'no aplica en esta receta'}
4. SONORIZAR: ${sn.length ? sn.map((b) => '\n   · ' + b).join('') : 'no aplica'}
CÁMARAS: ${cam}
${r.hook ? 'ESTRUCTURA: ' + r.hook + '\n' : ''}ANTES DE EXPORTAR: reporte de cortes · prueba del sonido apagado · sin claims prohibidos · formato y duración del destino.`;
  };

  /** Crea el proyecto con la receta aplicada */
  const crear = async (r, c, name) => {
    const p = await F.projects.create(name || r.n, c.aspect);
    const g = (p.golden = p.golden || {}); Object.assign(g, { destino: r.dest, destinoSet: true, target: c.target || 0, receta: recipeText(r, c) });
    if (c.snd.includes('duck')) p.duck = true;
    await F.projects.save(p); F.toast(`Proyecto «${p.name}» creado con la receta`, 'ok'); F.router.go('#/editor');
  };

  /* La receta entra al archivo de contexto del proyecto */
  const baseCtx = F.golden?.contextText;
  if (baseCtx) F.golden.contextText = (p) => baseCtx(p) + (p.golden?.receta ? `\n## Receta elegida\n${p.golden.receta}\n` : '');

  /* ---- Matrices (todas las combinaciones de la skill) ---- */
  const MATRICES = [
    ['Cámara × bloque del guion', ['Cámara', 'Cómo se ve', 'Va en…', 'Número'],
      [['Frontal', 'Ojo al lente, altura de ojos, plano medio', 'Hook, promesa, CTA (cuando le hablas al espectador)', 'Se guarda para el CTA'],
       ['Lateral', 'Tres cuartos, más lejos, nunca mira al lente, se ve la pared del costado', 'La narración: historia y giro', 'Cambio cuando cambia la idea (~1:30)'],
       ['Closeup', 'Más bajo y cerca, fondo desenfocado', 'La frase corta que quieres que repitan', 'Uno cada ~3 min · punch-in 113 %, tope 125 %']]],
    ['Técnica de b-roll × cuándo usarla', ['Técnica', 'Úsala cuando…', 'Regla'],
      [['Imagen IA del objeto', 'El guion nombra un objeto', 'Producto con foto real como semilla; objeto sobre negro; < 1 s'],
       ['Mockup HTML/CSS', 'Se habla de un chat, notificación o interfaz', 'Nítido y sin costo'],
       ['Texto grande', 'Hay una palabra clave', 'A pantalla completa, resaltada'],
       ['Iconos y logos', 'Se nombra una app, país o garantía', 'Banderas, sellos'],
       ['Animación del editor', 'Necesitas dinamismo', 'Motor del editor, no clips de video IA']]],
    ['Instrucción × resultado', ['Instrucción', 'Qué hace', 'Detalle'],
      [['«Corta los silencios»', 'Ritmo natural sin que se note el corte', '200 ms de aire entre frases'],
       ['«Subtítulos por palabra»', 'Altura del pecho; palabra clave grande y en color', 'Máx. 3 palabras'],
       ['«B-roll donde nombro algo»', 'Objeto sobre negro, no stock', '< 1 s cada pieza'],
       ['«Sfx desacoplado del corte»', 'El sonido no cae donde cae el tijeretazo', '0,18 s después del corte'],
       ['«Reduce más los silencios»', 'Rehace el corte más agresivo', 'El primer corte casi nunca queda'],
       ['«No seas tan estricto»', 'Rehace el corte más suave', 'Si dudas, deja']]],
    ['Destino × formato × duración', ['Destino', 'Formato', 'Duración'],
      [['Anuncio Meta / TikTok', '9:16', '25–40 s (COD)'], ['Reel orgánico', '9:16', '~30 s'], ['YouTube', '16:9', 'según el guion']]],
    ['Síntoma × arreglo', ['Síntoma', 'Causa y arreglo'],
      [['Transcripción vacía', 'Verifica la pista de audio; con ruido usa un modelo más grande'],
       ['Cortes secos, palabras que se pisan', 'Falta aire: 200 ms entre frases'],
       ['Subtítulos desfasados', 'Se sincronizaron contra el crudo: rehacer desde el corte'],
       ['B-roll fuera de lugar', 'No se entregó el guion como se grabó'],
       ['La música tapa la voz', 'Ducking de −12 dB'],
       ['El video sale largo (1:20 en vez de ~58 s)', 'Ruido de fondo: limpiar con la muestra de los 3 s iniciales y recortar'],
       ['Render roto', 'Revisar pistas solapadas y texto desbordado']]],
  ];

  const PROHIBIDAS = [
    ['Subtitular antes de cortar', 'Es el error más caro: se rehace el trabajo dos veces.'],
    ['Cutaway a pantalla completa encima de un cambio de cámara', 'El espectador ve el gráfico, no el cambio. El cambio va detrás de los gráficos.'],
    ['Zoom encima de zoom', 'Dos sistemas acercándose sobre el mismo metraje se pelean: apaga uno.'],
    ['Punch-in por encima de 125 %', 'Se ve el grano de la ampliación y el truco se descubre.'],
    ['Cambio de encuadre cada 10 s', 'No es ritmo, es ruido.'],
    ['Efectos de sonido justo en el corte', 'El sonido va desacoplado del tijeretazo.'],
    ['Más de 3 palabras de subtítulo en pantalla', 'Se pierde el ritmo palabra por palabra.'],
    ['B-roll de más de 1 s o stock genérico', 'Escena de objeto sobre negro, menos de 1 s.'],
    ['Redibujar el producto con IA', 'Siempre foto real como semilla.'],
    ['Claims prohibidos o CTA en inglés en pantalla', 'Tumban el anuncio en Meta y el render se paga dos veces.'],
    ['Signos de apertura ¿ ¡', 'Solo los de cierre.'],
    ['Cortar en duda o cortar sin silencio en la ventana', 'Si dudas, deja; sin silencio en 1,5 s no se corta.'],
  ];

  V.plantillasSkill = (el) => {
    const sel = {};   // elecciones del armador
    const cfg0 = { cut: 'trans', cam: 'none', broll: ['obj'], snd: ['duck'], dest: 'meta' };
    Object.assign(sel, cfg0, { broll: [...cfg0.broll], snd: [...cfg0.snd] });
    const D = { meta: ['9:16', 35, 'Anuncio Meta / TikTok'], reel: ['9:16', 30, 'Reel orgánico'], yt: ['16:9', 0, 'YouTube'] };
    const chips = (r) => `<span class="tag or">${r.aspect}</span><span class="tag">${esc(r.dur)}</span><span class="tag">${r.cut === 'vol' ? 'Corte por volumen' : 'Corte con transcripción'}</span><span class="tag">${r.cam === 'none' ? 'Plano único' : r.cam === 'fl' ? '2 cámaras' : '3 cámaras'}</span>${r.broll.length ? `<span class="tag">B-roll ×${r.broll.length}</span>` : ''}${r.snd.map((k) => `<span class="tag">${k === 'duck' ? 'Ducking' : k === 'sfx' ? 'Sfx' : 'Voz en off'}</span>`).join('')}`;
    el.innerHTML = `<div>
      <h2 class="pl-h">1 · Recetas completas</h2><div class="pl-grid">${RECETAS.map((r) => `<div class="pl-rec"><b>${esc(r.n)}</b><span class="small muted">${esc(r.tag)}</span><div class="pl-tags">${chips(r)}</div><p class="small">${esc(r.why)}</p><p class="small"><b>Estructura:</b> ${esc(r.hook)}</p>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm primary" data-use="${r.id}">${I('film')} Crear proyecto con esta receta</button><button class="btn sm" data-cp="${r.id}">${I('save')} Copiar</button></div></div>`).join('')}</div>
      <h2 class="pl-h">2 · Arma tu propia combinación</h2><div class="pl-build card">
        <label class="lbl">Destino</label><select id="bDest">${Object.entries(D).map(([k, v]) => `<option value="${k}">${v[2]} · ${v[0]}</option>`).join('')}</select>
        <label class="lbl">Cortes</label><select id="bCut">${Object.entries(CUT).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
        <label class="lbl">Cámaras</label><select id="bCam">${Object.entries(CAM).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
        <label class="lbl">B-roll (puedes marcar varios)</label>${Object.entries(BROLL).map(([k, v]) => `<label class="check"><input type="checkbox" data-b="broll:${k}" ${sel.broll.includes(k) ? 'checked' : ''}> ${esc(v)}</label>`).join('')}
        <label class="lbl">Sonido</label>${Object.entries(SND).map(([k, v]) => `<label class="check"><input type="checkbox" data-b="snd:${k}" ${sel.snd.includes(k) ? 'checked' : ''}> ${esc(v)}</label>`).join('')}
        <pre class="codebox pl-txt" id="bOut"></pre>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm primary" id="bMake">${I('film')} Crear proyecto con mi combinación</button><button class="btn sm" id="bCopy">${I('save')} Copiar</button></div></div>
      <h2 class="pl-h">3 · Cómo se combinan las piezas</h2>${MATRICES.map(([t, h, rows]) => `<details class="pl-card" open><summary><b>${esc(t)}</b></summary><div class="table-wrap"><table class="gtab"><tr>${h.map((x) => `<th>${esc(x)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</table></div></details>`).join('')}
      <h2 class="pl-h">4 · Combinaciones que NO se hacen</h2><div class="pl-card"><table class="gtab"><tr><th>No combines</th><th>Por qué</th></tr>${PROHIBIDAS.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table></div>
      <p class="hint" style="margin-top:14px">Fuente: skill «Millora · Editor de video» y el método de multicámara con una sola cámara. <a href="#/editor" id="plSkill">Abrir el editor</a>${F.golden?.openSkill ? ' · <a href="#" id="plFull">Todo el conocimiento de la skill</a>' : ''}</p></div>`;
    const mk = (id) => RECETAS.find((r) => r.id === id);
    const mine = () => ({ ...{ id: 'mia', n: 'Mi combinación', tag: D[sel.dest][2], aspect: D[sel.dest][0], dest: sel.dest, target: D[sel.dest][1], dur: D[sel.dest][1] ? D[sel.dest][1] + ' s' : 'según el guion', hook: '' }, cut: sel.cut, cam: sel.cam, broll: sel.broll, snd: sel.snd });
    const draw = () => { const r = mine(); el.querySelector('#bOut').textContent = recipeText(r, r); };
    const copy = (t) => (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => F.toast('Receta copiada', 'ok'), () => F.toast('No se pudo copiar: selecciona el texto a mano', 'error'));
    el.addEventListener('click', (e) => {
      const u = e.target.closest('[data-use]'), c = e.target.closest('[data-cp]');
      if (u) { const r = mk(u.dataset.use); crear(r, r).catch((er) => F.toast(er.message, 'error')); }
      else if (c) { const r = mk(c.dataset.cp); copy(recipeText(r, r)); }
      else if (e.target.closest('#bMake')) { const r = mine(); crear(r, r, 'Mi combinación').catch((er) => F.toast(er.message, 'error')); }
      else if (e.target.closest('#bCopy')) { const r = mine(); copy(recipeText(r, r)); }
      else if (e.target.closest('#plFull')) { e.preventDefault(); F.golden.openSkill(); }
    });
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'bDest') sel.dest = t.value; else if (t.id === 'bCut') sel.cut = t.value; else if (t.id === 'bCam') sel.cam = t.value;
      else if (t.dataset.b) { const [k, v] = t.dataset.b.split(':'); sel[k] = t.checked ? [...new Set([...sel[k], v])] : sel[k].filter((x) => x !== v); }
      draw();
    });
    draw();
  };
  V.plantillasSkill.recipeText = recipeText;
})();
