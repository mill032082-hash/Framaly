/* FRAMALY — Método Golden · complementos del editor de video.
   Completa lo que faltaba de la skill «Millora · Editor de video»:
   lista de bloqueantes del Intake, número de control del corte, ajuste rápido del primer corte,
   contexto del proyecto (memoria del editor), revisión ampliada y guía completa. */
(function () {
  'use strict';
  if (!F.golden) return;
  const G = F.golden, R = F.R, I = F.icon;
  const gd = (p) => G.gd(p);
  const terms = (s) => String(s || '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);

  /* ---------- 1 · Bloqueantes del Intake: sin esto no se edita ---------- */
  G.intakeCheck = (p) => {
    const g = gd(p), hasVoice = p.audio.some((a) => a.kind === 'voz' && !a.loop);
    const rows = [
      [hasVoice, 'Video o voz de la grabación', 'Con audio de cámara o micrófono: define el 80 % del resultado.'],
      [terms(g.claimsNo).length > 0, 'Claims prohibidos del producto', 'Un claim malo tumba el anuncio en Meta y el render se paga dos veces.'],
      [String(g.script || '').trim().length > 20, 'Guion tal como se grabó', 'Sin él, el b-roll cae donde no va. Pégalo abajo (no el que escribiste: el que dijiste).'],
      [!!g.destinoSet, 'Destino y duración', 'Meta / TikTok 9:16 (25–40 s), YouTube 16:9 o reel.'],
    ];
    const ready = rows.every((r) => r[0]);
    return `<details class="gchk ${ready ? 'ok' : ''}" ${ready ? '' : 'open'}><summary>${ready ? '✅ Listo para editar' : `⛔ Faltan ${rows.filter((r) => !r[0]).length} bloqueante(s) antes de editar`}</summary>
      ${rows.map(([ok, t, d]) => `<div class="gc ${ok ? 'on' : ''}"><span>${ok ? '✅' : '⬜'}</span><div><b>${F.esc(t)}</b><div class="small muted">${F.esc(d)}</div></div></div>`).join('')}
      <div class="small muted" style="margin-top:6px">Truco al grabar: deja <b>3 segundos en silencio</b> al inicio; sirven para medir el ruido ambiente y limpiarlo.</div></details>`;
  };
  const baseStatus = G.status;
  G.status = (p) => (baseStatus ? baseStatus(p) : '') + G.intakeCheck(p);

  /* ---------- 2 · Contexto del proyecto: la memoria del editor ---------- */
  G.contextText = (p) => {
    const g = gd(p), D = { meta: 'Anuncio Meta / TikTok (9:16)', yt: 'YouTube (16:9)', reel: 'Reel orgánico (9:16)' }[g.destino] || g.destino;
    const st = (F.settings.goldenStyles || [])[0];
    return `# Contexto del video · ${p.meta?.title || p.name}
Producto: ${g.producto || '(sin definir)'}
Destino: ${D} · formato ${p.aspect} · duración objetivo ${g.target || '—'} s
Claims PERMITIDOS: ${terms(g.claimsOk).join('; ') || '(sin definir)'}
Claims PROHIBIDOS: ${terms(g.claimsNo).join('; ') || '(sin definir)'}
${st ? `Estilo guardado: ${st.name}\n` : ''}Reglas fijas: español de Colombia · sin ¿ ¡ · máx. 3 palabras por subtítulo · b-roll de objeto sobre negro, menos de 1 s · el producto siempre con foto real · música −12 dB cuando habla la voz.
Orden: Cortar → Subtitular → Ilustrar → Sonorizar.

## Guion tal como se grabó
${String(g.script || '(pégalo aquí)').trim()}
`;
  };

  /* ---------- 3 · Ajustar el primer corte (casi nunca queda a la primera) ---------- */
  const wrapCut = (name, kind) => {
    const orig = G[name]; if (!orig) return;
    G[name] = async function (E, audioId, ...rest) {
      const n0 = E.undo.length, r = await orig.call(this, E, audioId, ...rest), g = gd(E.p);
      if (E.undo.length > n0) { g.cutUndo = n0; g.cutKind = kind; g.cutAudio = audioId; }
      return r;
    };
  };
  wrapCut('cleanSilence', 'silence');
  wrapCut('cleanByTranscript', 'tcut');
  G.recut = async (E, minSil, b) => {
    const p = E.p, g = gd(p);
    if (g.cutUndo == null || !g.cutKind) return F.toast('Primero corta los silencios (arriba); luego puedes ajustar el corte.');
    const voice = p.audio.find((x) => x.kind === 'voz' && !x.loop);
    const kind = g.cutKind, undoTo = g.cutUndo;
    while (E.undo.length > undoTo) E.api.undo();           // vuelve al crudo, sin tocar nada de lo anterior
    const a = (voice && voice.id) || g.cutAudio;
    G.minSil = minSil; const s = document.querySelector('#gMinSil'); if (s) s.value = String(minSil);
    if (b) b.disabled = true;
    try { await (kind === 'tcut' ? G.cleanByTranscript(E, a, minSil, (t) => b && (b.textContent = t)) : G.cleanSilence(E, a, minSil)); }
    finally { if (b) b.disabled = false; E.api.renderBin(); }
  };
  const basePlusExtra = G.plusExtra;
  G.plusExtra = () => `<div class="small muted" style="line-height:1.5">El primer corte casi nunca queda: se ajusta. Deshace el corte y lo repite con otra sensibilidad.</div>
    <div class="row" style="gap:6px"><button class="btn sm" data-g="recutMore" style="flex:1">${I('scissors')} Reducir más los silencios</button><button class="btn sm" data-g="recutLess" style="flex:1">${I('scissors')} No tan estricto</button></div>
    <button class="btn sm" data-g="ctxCopy">${I('save')} Copiar el contexto del proyecto</button>` + (basePlusExtra ? basePlusExtra() : '');
  const basePlusClick = G.plusClick;
  G.plusClick = (a, b, E) => {
    if (a === 'recutMore') { G.recut(E, 0.4, b).catch((er) => F.toast(er.message || String(er), 'error', 6000)); return true; }
    if (a === 'recutLess') { G.recut(E, 1, b).catch((er) => F.toast(er.message || String(er), 'error', 6000)); return true; }
    if (a === 'ctxCopy') {
      const t = G.contextText(E.p);
      (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => F.toast('Contexto copiado. Pégalo en tu IA o guárdalo con el proyecto.', 'ok', 3500)).catch(() => F.modal({ title: 'Contexto del proyecto', wide: true, body: `<textarea rows="16" style="width:100%" readonly onclick="this.select()">${F.esc(t)}</textarea>` }));
      return true;
    }
    return basePlusClick ? basePlusClick(a, b, E) : false;
  };

  /* ---------- 4 · Revisión ampliada ---------- */
  const baseReview = G.review;
  G.review = (p) => {
    const res = baseReview(p), g = gd(p), add = (lvl, t, d) => res.push({ lvl, t, d });
    if (!p.clips.length) return res;
    /* número de control: un crudo de 1:40 baja a ~58 s; si apenas baja, los silencios no se cortaron */
    const lc = g.lastCut;
    if (lc && lc.before > 20) {
      const r = lc.after / lc.before;
      r > 0.85 ? add('warn', 'Casi no se cortó nada', `De ${lc.before} s quedaron ${lc.after} s (${Math.round(r * 100)} %). Un crudo de 1:40 baja a ~58 s con ~40 cortes: si apenas baja, el ruido de fondo impidió detectar los silencios. Usa «Reducir más los silencios» o limpia con la muestra de los 3 s iniciales.`)
        : add('ok', 'Número de control del corte', `De ${lc.before} s a ${lc.after} s (${Math.round(r * 100)} %) con ${lc.cuts.length} cortes. Referencia: 1:40 → ~58 s con ~40 cortes.`);
    }
    /* intake */
    if (!String(g.script || '').trim()) add('warn', 'Sin el guion tal como se grabó', 'Sin él no se sabe en qué segundo se nombra cada cosa y el b-roll cae donde no va. Pégalo en la pestaña Golden.');
    /* música sin ducking y marcas ajenas */
    if (p.audio.some((a) => a.kind === 'musica') && p.audio.some((a) => a.kind === 'voz') && !p.duck) add('warn', 'La música puede tapar la voz', 'Activa «Bajar la música 12 dB cuando habla la voz» (Sonorizar).');
    if (p.watermark) add('warn', 'Marca de agua puesta', `«${p.watermark}». Confirma que es la tuya: nunca una marca ajena.`);
    /* trampa de montaje 2: zoom sobre zoom ya se revisa arriba; recuerda lo que la máquina no decide */
    return res;
  };


  /* ---------- 6 · Videos reales (MP4): los cortes de silencio también cortan el video ---------- */
  const isVid = (c) => F.media.byId(c.mediaId)?.type === 'video';
  G.hasVideo = (p) => p.clips.some(isVid);
  /** Parte el clip que cruza el instante t (en la línea de tiempo); la segunda parte sigue donde terminó la primera */
  const splitAt = (p, t) => {
    const it = R.layout(p).items.find((x) => t > x.start + 0.03 && t < x.end - 0.03); if (!it) return;
    const c = it.clip, lt = t - it.start, n = { ...c, id: F.uid(), duration: F.round1(c.duration - lt), text: '', capTimes: undefined, vstart: F.round1((c.vstart || 0) + lt) };
    c.duration = F.round1(lt); c.transition = 'none'; delete c.capTimes; p.clips.splice(p.clips.indexOf(c) + 1, 0, n);
  };
  /** Quita de la línea de tiempo los tramos [ini, fin] (segundos de la voz) */
  G.cutTimeline = (p, cuts, offset) => {
    cuts.slice().sort((a, b) => b[0] - a[0]).forEach(([s, e]) => {
      s += offset; e += offset; splitAt(p, e); splitAt(p, s);
      const { items } = R.layout(p), drop = new Set(items.filter((x) => x.start >= s - 0.04 && x.end <= e + 0.04).map((x) => x.clip.id));
      p.clips = p.clips.filter((c) => !drop.has(c.id));
    });
    p.clips.forEach((c, i) => { if (i < p.clips.length - 1 && isVid(c) && isVid(p.clips[i + 1])) c.transition = 'none'; });
  };
  ['cleanSilence', 'cleanByTranscript'].forEach((name) => {
    const orig = G[name]; if (!orig) return;
    G[name] = async function (E, audioId, ...rest) {
      const p = E.p, g = gd(p), prev = g.lastCut, r = await orig.call(this, E, audioId, ...rest);
      if (G.hasVideo(p) && g.lastCut && g.lastCut !== prev) {
        const v = p.audio.find((x) => x.id === audioId) || p.audio.find((x) => x.kind === 'voz');
        const before = R.layout(p).total; G.cutTimeline(p, g.lastCut.cuts, v?.start || 0);
        E.api.after({ insp: true }); F.toast(`El video también se cortó: ${F.round1(before)} s → ${F.round1(R.layout(p).total)} s`, 'ok', 4500);
      }
      return r;
    };
  });

  /* ---------- 5 · Guía completa del método ---------- */
  G.openGuide = () => {
    const sec = (t, inner) => `<details class="gg" open><summary><b>${t}</b></summary>${inner}</details>`;
    F.modal({
      title: 'Método del editor de video', wide: true,
      body: `<div class="gguide">
      ${sec('Ley de orden: Cortar → Subtitular → Ilustrar → Sonorizar', `<ol><li><b>Cortar</b> fija la línea de tiempo; todo se ubica contra esos cortes.</li><li><b>Subtitular</b> va contra el video YA cortado. Al revés se rehace todo: es el error más caro.</li><li><b>Ilustrar</b> donde se NOMBRA algo.</li><li><b>Sonorizar</b> al final, porque el sonido reacciona a lo montado.</li></ol>`)}
      ${sec('Antes de editar (bloqueantes)', `<ul><li>Video con <b>buen audio</b> (cámara o micrófono, no celular a 3 metros): define el 80 %.</li><li><b>Claims permitidos y prohibidos</b> del producto.</li><li>El guion <b>tal como se grabó</b>.</li><li>Destino, duración (anuncio de venta: <b>25–40 s</b>) y look fijo (color, tipografía, resaltado).</li><li>Al grabar: <b>3 s en silencio</b> al inicio para medir el ruido.</li></ul>`)}
      ${sec('Cortes', `<ul><li>Quita silencios largos, muletillas y <b>tomas repetidas: te quedas con la SEGUNDA</b>.</li><li><b>Si dudas entre cortar o dejar, DEJA.</b></li><li>Nunca cortes la primera ni la última palabra de una frase.</li><li>Deja <b>200 ms de aire</b> entre frases.</li><li>El corte cae en el silencio más cercano (ventana de 1,5 s). <b>Sin silencio, no se corta.</b></li><li><b>Número de control:</b> 1:40 → ~58 s con ~40 cortes. Si sale 1:20, no se cortaron los silencios.</li><li>El primer corte casi nunca queda: usa «Reducir más los silencios» o «No tan estricto».</li></ul>`)}
      ${sec('Multicámara con una sola cámara', `<ul><li>Frontal = hook, promesa y CTA (el frontal se guarda para cuando le hablas al espectador). Lateral = la narración, nunca mira al lente. Closeup = la frase corta; uno cada ~3 min.</li><li>La prueba de que la cámara se movió no es la distancia: <b>cambia la pared que se ve y entran o salen objetos</b>.</li><li>Cambia la posición, no el mundo: misma luz, mismos muebles, un solo color de acento.</li><li>Cambio de encuadre cada ~1 min 30 s (cada 10 s es ruido). Punch-in al 113 %, tope 125 %.</li><li><b>Trampas:</b> nunca un cutaway a pantalla completa encima de un cambio de cámara; y si el editor ya hace zoom, apaga el otro.</li><li>Fondos con IA: repite el mismo bloque en los 3 prompts y declara <b>«vacío de personas»</b>.</li></ul>`)}
      ${sec('Subtítulos', `<ul><li>Palabra por palabra, <b>máx. 3 palabras</b>, mayúsculas, alto contraste, a la altura del pecho, con la palabra clave más grande y en color.</li><li>Español de Colombia. Sin ¿ ¡ (solo los de cierre). Sin CTA en inglés.</li><li>Palabras dudosas de la transcripción: corrígelas a mano (la herramienta no marca la confianza).</li></ul>`)}
      ${sec('Ilustrar (b-roll)', `<ul><li>Donde el guion nombra algo; objeto sobre negro, <b>menos de 1 s</b>, nunca stock.</li><li>Técnicas: imágenes IA (producto con <b>foto real como base</b>, nunca redibujado), mockups HTML/CSS, texto grande, iconos y logos, animación del motor del editor.</li><li>Un visual refuerza la voz, no compite con ella.</li></ul>`)}
      ${sec('Sonido', `<ul><li>Efectos (pop, whoosh, ding) <b>desacoplados del corte</b>: caen un poco después del tijeretazo.</li><li>Música con <b>ducking de −12 dB</b> cuando habla la voz.</li><li>Voz en off opcional: el video no se bloquea por ella.</li></ul>`)}
      ${sec('Antes de exportar (botón «Revisión Golden»)', `<ul><li>Pide el <b>reporte de cortes</b>: en qué segundo quedó cada corte y qué se descartó.</li><li><b>Sonido apagado:</b> el 85 % ve sin sonido; si hace falta el audio, faltan subtítulos o b-roll.</li><li>El primer segundo frena el scroll; el gancho pega en los primeros 3 s.</li><li>Sin claims prohibidos, sin marcas ajenas, formato y duración correctos.</li></ul>`)}
      ${sec('Si algo falla', `<table class="gtab"><tr><th>Síntoma</th><th>Arreglo</th></tr>
        <tr><td>Transcripción vacía</td><td>Verifica que haya pista de audio; si es ruidosa, prueba otro motor.</td></tr>
        <tr><td>Cortes secos, palabras pisadas</td><td>Falta el aire de 200 ms entre frases.</td></tr>
        <tr><td>Subtítulos desfasados</td><td>Se sincronizaron contra el crudo: vuelve a generarlos después de cortar.</td></tr>
        <tr><td>B-roll fuera de lugar</td><td>Pega el guion tal como se grabó.</td></tr>
        <tr><td>La música tapa la voz</td><td>Activa el ducking de −12 dB.</td></tr>
        <tr><td>Sale largo (1:20 en vez de ~58 s)</td><td>El ruido impidió detectar silencios: «Reducir más los silencios».</td></tr>
        <tr><td>Render roto</td><td>Revisa pistas solapadas y texto desbordado.</td></tr></table>`)}
      ${sec('Replicar un estilo y empaquetarlo', `<ul><li>Toma 3–5 capturas de la referencia (gancho, un visual, un subtítulo, el cierre). <b>Se destila, no se clona</b>: paleta, tipografía, ritmo y animación; nunca la marca ajena.</li><li>Cuando el resultado te guste, <b>guarda el estilo con el nombre del cliente</b>: la próxima vez es un clic.</li></ul>`)}
      ${sec('Reglas de oro', `<ol><li>Foto y video <b>reales</b> del producto.</li><li>Revisa los claims antes de escribir cualquier texto.</li><li>Español de Colombia, sin traducción automática ni CTA en inglés.</li><li>El primer resultado se itera: nadie acierta a la primera.</li><li><b>Nunca se entrega sin ver el render.</b></li></ol><p class="hint">Lo que la máquina no decide: qué se dice, dónde va el silencio que incomoda y si la pieza merecía existir. La IA baja el costo de producir; no el de tener algo que decir.</p>`)}
      </div>`,
    });
  };
})();
