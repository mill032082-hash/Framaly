/* FRAMALY — Agentes y flujos: pipeline Idea → Guion → Imágenes → Voz → Montaje → SEO */
(function () {
  'use strict';
  const R = F.R, I = F.icon;

  F.STYLES = {
    cine: { name: 'Cinematográfico', p: 'cinematic film still, dramatic lighting, shallow depth of field, anamorphic lens, rich color grading, highly detailed' },
    foto: { name: 'Fotorrealista', p: 'photorealistic photograph, natural light, ultra detailed, sharp focus, professional photography' },
    ilustracion: { name: 'Ilustración', p: 'beautiful digital illustration, painterly, soft shading, storybook style, rich colors' },
    anime: { name: 'Anime', p: 'anime style illustration, vibrant colors, detailed background, dynamic composition' },
    '3d': { name: 'Animación 3D', p: '3D animated movie style render, soft global illumination, stylized characters, high quality' },
    acuarela: { name: 'Acuarela', p: 'watercolor painting, soft textures, delicate washes of color, paper texture' },
    epico: { name: 'Épico fantasía', p: 'epic fantasy concept art, grand scale, volumetric light, atmospheric, matte painting' },
    cyber: { name: 'Cyberpunk neón', p: 'cyberpunk aesthetic, neon lights, night city, reflections, moody atmosphere' },
    minimal: { name: 'Minimalista', p: 'minimalist composition, clean background, soft pastel colors, simple shapes' },
    documental: { name: 'Documental', p: 'documentary photography style, realistic, authentic, natural colors, National Geographic quality' },
    ninguno: { name: 'Sin estilo (solo prompt)', p: '' },
  };
  const styleOpts = () => Object.entries(F.STYLES).map(([k, v]) => [k, v.name]);
  const toOpts = (l) => l.map((o) => [o.id, o.name]);

  /* ======================== PIPELINE ======================== */
  const P = (F.pipeline = {});
  P.ORDER = ['idea', 'script', 'images', 'voice', 'music', 'montage', 'seo', 'output'];
  P.NAMES = { idea: 'Idea / Tema', script: 'Agente Guionista', images: 'Agente Director Visual', voice: 'Agente Locutor', music: 'Música de fondo', montage: 'Agente Editor', seo: 'Agente SEO YouTube', output: 'Salida' };
  P.sizeFor = (a) => (a === '16:9' ? '1536x1024' : a === '1:1' ? '1024x1024' : '1024x1536');
  P.sceneCount = (idea, sc) => (sc && +sc.scenes) || F.clamp(Math.round((+idea.duration || 60) / 7), 3, 30);

  P.writeScript = async (idea, sc = {}) => {
    const n = P.sceneCount(idea, sc);
    const words = Math.round((+idea.duration || 60) * 2.4);
    const system = 'Eres un guionista profesional de YouTube, experto en retención de audiencia, storytelling y videos narrados construidos con imágenes.';
    const prompt = `Escribe el guion de un video narrado sobre: "${idea.topic}".
- Idioma de la narración: ${idea.language || 'español'}
- Tono: ${idea.tone || 'informativo y entretenido'}
- Público: ${idea.audience || 'público general'}
- Duración aproximada: ${idea.duration} segundos (unas ${words} palabras de narración en total, repartidas entre las escenas)
- Exactamente ${n} escenas. La primera debe ser un gancho potente en los primeros 5 segundos; la última, un cierre con llamada a la acción (suscribirse / comentar).
${sc.extra ? '- Instrucciones extra: ' + sc.extra : ''}
Para cada escena entrega:
  "narration": el texto exacto que leerá el locutor (frases naturales, sin acotaciones ni emojis),
  "image_prompt": descripción visual detallada EN INGLÉS para generar una imagen (sujeto, entorno, composición, iluminación). Sin texto, letras ni logotipos dentro de la imagen. Mantén coherencia visual entre escenas (mismos personajes, época y estética).
  "on_screen_text": frase corta de 2 a 6 palabras para mostrar en pantalla.
Devuelve JSON con esta forma exacta:
{"title":"título atractivo para YouTube (máx. 70 caracteres)","scenes":[{"narration":"...","image_prompt":"...","on_screen_text":"..."}]}`;
    const j = await F.api.llmJSON({ system, prompt, provider: sc.provider, maxTokens: 8000 });
    if (!Array.isArray(j.scenes) || !j.scenes.length) throw new Error('El guion generado no contiene escenas.');
    return {
      title: String(j.title || idea.topic).slice(0, 100),
      scenes: j.scenes.map((s) => ({ narration: String(s.narration || ''), image_prompt: String(s.image_prompt || s.narration || ''), on_screen_text: String(s.on_screen_text || '') })),
    };
  };

  P.chapters = (p, script) => {
    const { items } = R.layout(p);
    return items.map((it, i) => `${F.fmtS(it.start)} ${script?.scenes?.[i]?.on_screen_text || it.clip.text?.slice(0, 40) || 'Parte ' + (i + 1)}`).join('\n');
  };

  P.seo = async ({ topic, script, keywords, language = 'español', provider }) => {
    const narr = script ? script.scenes.map((s) => s.narration).join(' ').slice(0, 6000) : '';
    const j = await F.api.llmJSON({
      provider, maxTokens: 2500,
      system: 'Eres un experto en SEO de YouTube y crecimiento de canales.',
      prompt: `Crea los metadatos optimizados para un video de YouTube en ${language}.
Tema: ${topic}
${script ? 'Título provisional: ' + script.title + '\nNarración: ' + narr : ''}
${keywords ? 'Palabras clave objetivo: ' + keywords : ''}
Devuelve JSON: {"title":"título con gancho, máx. 70 caracteres","description":"descripción de 3 párrafos: gancho, resumen con palabras clave y llamada a suscribirse. Incluye 3-5 hashtags al final.","tags":["15 a 25 etiquetas relevantes"]}`,
    });
    return { title: String(j.title || '').slice(0, 100), description: String(j.description || ''), tags: (Array.isArray(j.tags) ? j.tags : String(j.tags || '').split(',')).map((t) => String(t).trim()).filter(Boolean) };
  };

  /** Ejecuta el flujo completo. cfg = {idea, script, images, voice|null, music|null, montage, seo|null, output, presetScript?} */
  P.run = async (cfg, { step = () => {}, log = () => {} } = {}) => {
    const { idea, montage: mt } = cfg;
    // Validaciones previas
    if (!cfg.presetScript || cfg.seo) F.api.textProvider(cfg.script?.provider);
    if (!['openai', 'gemini', 'minimax'].some((p) => F.api.has(p))) throw new Error('El Agente Director Visual necesita una API de imágenes (OpenAI, Gemini o MiniMax). Ve a Integraciones API.');
    if (cfg.voice) {
      const vp = cfg.voice.provider || 'openai';
      if (!F.api.has(vp)) throw new Error('El Agente Locutor usa ' + ({ elevenlabs: 'ElevenLabs', gemini: 'Gemini', minimax: 'MiniMax', openai: 'OpenAI' })[vp] + ', pero no está disponible. Cámbialo en el nodo Voz o conéctalo en Integraciones API.');
      if ((vp === 'elevenlabs' || vp === 'minimax') && !cfg.voice.voiceId) throw new Error('Indica el Voice ID de ' + (vp === 'minimax' ? 'MiniMax' : 'ElevenLabs') + ' en el Agente Locutor.');
    }
    step('idea', 'done', idea.topic.slice(0, 50));

    // 1. Guion
    let script;
    if (cfg.presetScript) { script = cfg.presetScript; step('script', 'done', `${script.scenes.length} escenas (guion propio)`); }
    else {
      step('script', 'run', 'Escribiendo guion…'); log('Agente Guionista: escribiendo el guion…');
      script = await P.writeScript(idea, cfg.script);
      step('script', 'done', `${script.scenes.length} escenas`); log(`✓ Guion listo: "${script.title}" (${script.scenes.length} escenas)`, 'o');
    }
    const n = script.scenes.length;

    // 2. Imágenes
    step('images', 'run', `0/${n}`); log(`Agente Director Visual: generando ${n} imágenes…`);
    const size = P.sizeFor(idea.aspect); let ok = 0;
    const imgIds = await F.pool(script.scenes, 3, async (sc, i) => {
      const prompt = [sc.image_prompt, cfg.images.common, F.STYLES[cfg.images.style]?.p].filter(Boolean).join('. ');
      try {
        const [blob] = await F.api.image({ prompt, size, quality: cfg.images.quality, n: 1, provider: cfg.images.provider });
        const m = await F.media.add({ type: 'image', name: `${script.title.slice(0, 40)} · escena ${i + 1}`, blob, source: 'ai', meta: { prompt } });
        ok++; step('images', 'run', `${ok}/${n}`); log(`  · imagen ${i + 1}/${n} lista`);
        return m.id;
      } catch (e) {
        log(`  ✗ imagen ${i + 1}: ${e.message}`, 'e');
        if (/40[0-3]|key|billing|verif|quota/i.test(e.message)) throw e;
        return null;
      }
    });
    if (!imgIds.some(Boolean)) throw new Error('No se pudo generar ninguna imagen.');
    step('images', 'done', `${ok}/${n} imágenes`); log(`✓ ${ok} imágenes generadas`, 'o');

    // 3. Voz
    let voiceIds = [];
    if (cfg.voice) {
      step('voice', 'run', `0/${n}`); log('Agente Locutor: narrando escenas…');
      let vk = 0;
      voiceIds = await F.pool(script.scenes, 3, async (sc, i) => {
        if (!sc.narration.trim()) return null;
        try {
          const blob = await F.api.tts({ ...cfg.voice, text: sc.narration });
          const m = await F.media.add({ type: 'audio', name: `${script.title.slice(0, 32)} · voz ${i + 1}`, blob, source: 'ai', meta: { text: sc.narration } });
          vk++; step('voice', 'run', `${vk}/${n}`);
          return m.id;
        } catch (e) {
          log(`  ✗ voz ${i + 1}: ${e.message}`, 'e');
          if (/40[0-3]|key|quota/i.test(e.message)) throw e;
          return null;
        }
      });
      step('voice', 'done', `${vk} narraciones`); log(`✓ ${vk} narraciones generadas`, 'o');
    } else step('voice', 'skip', 'Desactivado');

    // 4. Música
    const mus = cfg.music && cfg.music.mediaId && F.media.byId(cfg.music.mediaId);
    if (cfg.music && !mus) { step('music', 'skip', 'Sin pista elegida'); log('Música: no se eligió ninguna pista, se omite', 'w'); }
    else if (mus) step('music', 'done', mus.name.slice(0, 30));
    else step('music', 'skip', 'Desactivado');

    // 5. Montaje
    step('montage', 'run', 'Montando…'); log('Agente Editor: montando el timeline…');
    const p = F.projects.blank(cfg.output?.name || script.title, idea.aspect);
    const TR = ['fade', 'slideL', 'zoom', 'circle', 'blur', 'wipe', 'black', 'slideU'];
    const MO = ['kenburns', 'zoomIn', 'panR', 'zoomOut', 'panL', 'panU'];
    let t = 0, lastImg = imgIds.find(Boolean);
    script.scenes.forEach((sc, i) => {
      const imgId = imgIds[i] || lastImg; lastImg = imgId;
      const vm = voiceIds[i] ? F.media.byId(voiceIds[i]) : null;
      const dur = F.round1(vm ? Math.max(2.5, (vm.duration || 3) + (+mt.padding || 0.7)) : Math.max(2.5, (+idea.duration || 60) / n));
      const text = mt.subtitles === 'narracion' ? sc.narration : mt.subtitles === 'pantalla' ? sc.on_screen_text : '';
      const textStyle = mt.subtitles === 'narracion' ? 'subtitulo' : i === 0 ? 'titulo' : mt.textStyle;
      p.clips.push(F.newClip(imgId, {
        duration: dur, filter: mt.filter,
        transition: mt.transition === 'auto' ? TR[i % TR.length] : mt.transition,
        motion: mt.motion === 'auto' ? MO[i % MO.length] : mt.motion,
        text, textStyle, textAnim: mt.subtitles === 'narracion' ? 'fade' : 'up',
      }));
      if (vm) p.audio.push({ id: F.uid(), mediaId: vm.id, start: F.round1(t + 0.2), volume: 1, loop: false, fadeOut: false, kind: 'voz' });
      t = F.round1(t + dur);
    });
    if (mus) p.audio.push({ id: F.uid(), mediaId: mus.id, start: 0, volume: +cfg.music.volume || 0.18, loop: true, fadeOut: true, kind: 'musica' });
    p.script = script;
    step('montage', 'done', `${p.clips.length} clips · ${F.fmtS(t)}`); log(`✓ Timeline montado: ${p.clips.length} clips, ${F.fmtS(t)}`, 'o');

    // 6. SEO
    p.meta = { title: script.title, description: '', tags: '' };
    if (cfg.seo) {
      step('seo', 'run', 'Optimizando…'); log('Agente SEO: creando título, descripción y etiquetas…');
      try {
        const s = await P.seo({ topic: idea.topic, script, keywords: cfg.seo.keywords, language: idea.language, provider: cfg.script?.provider });
        p.meta = { title: s.title || script.title, description: s.description + '\n\nCapítulos:\n' + P.chapters(p, script), tags: s.tags.join(', ') };
        step('seo', 'done', 'Metadatos listos'); log('✓ Metadatos SEO listos', 'o');
      } catch (e) { step('seo', 'err', 'Error'); log('  ✗ SEO: ' + e.message, 'e'); }
    } else step('seo', 'skip', 'Desactivado');

    // 7. Salida
    await F.projects.save(p);
    F.projects.setCurrent(p.id);
    step('output', 'done', 'Proyecto creado');
    return p;
  };

  /** Ejecuta el pipeline mostrando un modal de progreso */
  P.runModal = (cfg, opts = {}) => new Promise((resolve) => {
    const m = F.modal({ title: 'Agentes trabajando', locked: true,
      body: `<div class="steps">${P.ORDER.map((id) => `<div class="stp" data-s="${id}">${I(NT[id].icon)}<span>${P.NAMES[id]}</span><span class="s">En espera</span></div>`).join('')}</div><div class="logbox" id="rmLog"></div>`,
      actions: [{ label: 'Cerrar', onClick: () => resolve(null) }] });
    const btn = m.q('.modal-f .btn'); btn.disabled = true;
    const log = (t, c = '') => { const l = m.q('#rmLog'); l.insertAdjacentHTML('beforeend', `<div class="${c}">${F.esc(t)}</div>`); l.scrollTop = 1e9; };
    const step = (id, s, msg) => { const el = m.q(`[data-s="${id}"]`); if (!el) return; el.className = 'stp ' + s; el.querySelector('.s').innerHTML = (s === 'run' ? '<span class="spin"></span> ' : s === 'done' ? '✓ ' : s === 'err' ? '✗ ' : '') + F.esc(msg || ''); };
    P.run(cfg, { step, log }).then(async (p) => {
      btn.disabled = false;
      if (opts.autoExport) {
        log('▶ Exportando el MP4 automáticamente…', 'w');
        await F.sleep(700); m.close();
        F.toast(`Video "${p.name}" creado. Exportando MP4…`, 'ok');
        await F.exportProject(p, { format: 'mp4', quality: 'high', fps: p.fps || 30 });
        F.router.go('#/publicar');
        return resolve(p);
      }
      m.q('.modal-f').insertAdjacentHTML('beforeend', `<button class="btn primary" data-open>${I('film')} Abrir en el editor</button>`);
      m.q('[data-open]').onclick = () => { m.close(); F.router.go('#/editor'); };
      F.toast(`Video "${p.name}" creado`, 'ok'); resolve(p);
    }).catch((e) => { btn.disabled = false; log('✗ ' + e.message, 'e'); F.toast(e.message, 'error'); m.q('.stp.run')?.classList.replace('run', 'err'); resolve(null); });
  });

  /* ======================== EDITOR DE FLUJOS ======================== */
  const NT = {
    idea: { icon: 'zap', color: 'linear-gradient(135deg,#ffb23f,#ff8a00)', desc: 'Define de qué trata tu video' },
    script: { icon: 'script', color: 'linear-gradient(135deg,#ff8b3d,#ff5a1a)', desc: 'Escribe el guion y lo divide en escenas' },
    images: { icon: 'image', color: 'linear-gradient(135deg,#ff6a1a,#e8430c)', desc: 'Genera una imagen por escena' },
    voice: { icon: 'mic', color: 'linear-gradient(135deg,#ff5a36,#d63a1a)', desc: 'Narra cada escena con voz IA', toggle: true },
    music: { icon: 'music', color: 'linear-gradient(135deg,#ffc24a,#ff9a1a)', desc: 'Pista de fondo de tu biblioteca', toggle: true },
    montage: { icon: 'film', color: 'linear-gradient(135deg,#ff7a1a,#c2410c)', desc: 'Monta escenas, transiciones y textos' },
    seo: { icon: 'youtube', color: 'linear-gradient(135deg,#ff4d4d,#d61a1a)', desc: 'Título, descripción y etiquetas', toggle: true },
    output: { icon: 'send', color: 'linear-gradient(135deg,#3ccf91,#1f9e6a)', desc: 'Crea el proyecto listo para exportar' },
  };
  const FIELDS = {
    idea: [
      { k: 'topic', l: 'Tema del video', t: 'textarea', ph: 'Ej: 7 misterios sin resolver del océano profundo' },
      { k: 'duration', l: 'Duración objetivo (segundos)', t: 'number', min: 10, max: 900, step: 5 },
      { k: 'aspect', l: 'Formato', t: 'select', o: R.ASPECTS },
      { k: 'tone', l: 'Tono', t: 'text' },
      { k: 'audience', l: 'Público objetivo', t: 'text' },
      { k: 'language', l: 'Idioma de la narración', t: 'text' },
    ],
    script: [
      { k: 'scenes', l: 'Número de escenas (0 = automático)', t: 'number', min: 0, max: 40, step: 1 },
      { k: 'provider', l: 'Modelo de texto', t: 'select', o: [['auto', 'Según Integraciones'], ['anthropic', 'Claude (Anthropic)'], ['openai', 'OpenAI GPT'], ['gemini', 'Gemini (Google)'], ['minimax', 'MiniMax']] },
      { k: 'extra', l: 'Instrucciones extra para el guionista', t: 'textarea', ph: 'Ej: menciona mi canal @MiCanal al final, usa datos con fuentes…' },
    ],
    images: [
      { k: 'provider', l: 'Proveedor de imágenes', t: 'select', o: [['auto', 'Según Ajustes'], ['openai', 'OpenAI'], ['gemini', 'Gemini (Google)'], ['minimax', 'MiniMax']] },
      { k: 'style', l: 'Estilo visual', t: 'select', o: styleOpts },
      { k: 'quality', l: 'Calidad', t: 'select', o: [['low', 'Baja (rápida y económica)'], ['medium', 'Media (recomendada)'], ['high', 'Alta (máximo detalle)']] },
      { k: 'common', l: 'Descripción visual común (coherencia)', t: 'textarea', ph: 'Ej: protagonista: exploradora joven con chaqueta naranja; paleta cálida' },
    ],
    voice: [
      { k: 'provider', l: 'Proveedor de voz', t: 'select', o: [['openai', 'OpenAI TTS'], ['elevenlabs', 'ElevenLabs'], ['gemini', 'Gemini (Google)'], ['minimax', 'MiniMax']] },
      { k: 'voice', l: 'Voz (OpenAI o Gemini)', t: 'select', o: () => [...F.api.OPENAI_VOICES, ...F.api.GEMINI_VOICES].map((v) => [v, v]) },
      { k: 'voiceId', l: 'Voice ID (ElevenLabs o MiniMax)', t: 'text', ph: 'Cópialo desde la sección Voces' },
      { k: 'instructions', l: 'Dirección de voz (OpenAI)', t: 'textarea' },
      { k: 'speed', l: 'Velocidad', t: 'number', min: 0.5, max: 2, step: 0.05 },
    ],
    music: [
      { k: 'mediaId', l: 'Pista de música', t: 'select', o: () => [['', '— Elegir de la biblioteca —'], ...F.media.audios().map((m) => [m.id, m.name])] },
      { k: 'volume', l: 'Volumen (0 – 1)', t: 'number', min: 0, max: 1, step: 0.05 },
    ],
    montage: [
      { k: 'transition', l: 'Transiciones', t: 'select', o: () => [['auto', 'Automáticas (variadas)'], ...toOpts(R.TRANSITIONS)] },
      { k: 'motion', l: 'Movimiento de cámara', t: 'select', o: () => [['auto', 'Automático (variado)'], ...toOpts(R.MOTIONS)] },
      { k: 'filter', l: 'Filtro de color', t: 'select', o: () => toOpts(R.filters()) },
      { k: 'subtitles', l: 'Textos en pantalla', t: 'select', o: [['narracion', 'Subtítulos de la narración'], ['pantalla', 'Frase clave por escena'], ['ninguno', 'Sin textos']] },
      { k: 'textStyle', l: 'Estilo de la frase clave', t: 'select', o: () => toOpts(R.TEXT_STYLES) },
      { k: 'padding', l: 'Pausa extra al final de cada escena (s)', t: 'number', min: 0, max: 3, step: 0.1 },
    ],
    seo: [{ k: 'keywords', l: 'Palabras clave objetivo', t: 'text', ph: 'Ej: océano, misterios, ciencia' }],
    output: [
      { k: 'name', l: 'Nombre del proyecto', t: 'text', ph: '(se usa el título del guion)' },
      { k: 'autoExport', l: 'Exportar el MP4 automáticamente al terminar', t: 'checkbox' },
      { k: 'open', l: 'Abrir en el editor al terminar (si no se exporta)', t: 'checkbox' },
    ],
  };

  /** Formulario genérico a partir de un esquema */
  F.form = (fields, obj) => fields.map((f) => {
    const v = obj[f.k];
    if (f.t === 'checkbox') return `<label class="check"><input type="checkbox" data-f="${f.k}" ${v ? 'checked' : ''}> ${f.l}</label>`;
    let inp;
    if (f.t === 'textarea') inp = `<textarea data-f="${f.k}" rows="3" placeholder="${F.esc(f.ph || '')}">${F.esc(v ?? '')}</textarea>`;
    else if (f.t === 'select') { const o = typeof f.o === 'function' ? f.o() : f.o; inp = `<select data-f="${f.k}">${o.map(([a, b]) => `<option value="${F.esc(a)}" ${String(a) === String(v) ? 'selected' : ''}>${F.esc(b)}</option>`).join('')}</select>`; }
    else inp = `<input type="${f.t === 'number' ? 'number' : 'text'}" data-f="${f.k}" value="${F.esc(v ?? '')}" placeholder="${F.esc(f.ph || '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''}>`;
    return `<label class="lbl">${f.l}</label>${inp}`;
  }).join('');
  F.formRead = (el) => { const v = el.type === 'checkbox' ? el.checked : el.value; return el.type === 'number' ? (v === '' ? 0 : parseFloat(v)) : v; };

  const DEF = {
    idea: { topic: '', duration: 60, aspect: '16:9', tone: 'informativo y entretenido', audience: 'público general', language: 'español' },
    script: { scenes: 0, provider: 'auto', extra: '' },
    images: { style: 'cine', quality: 'medium', common: '' },
    voice: { provider: 'openai', voice: 'nova', voiceId: '', instructions: 'Narrador profesional de documental: voz cálida, clara y con ritmo dinámico.', speed: 1 },
    music: { mediaId: '', volume: 0.18 },
    montage: { transition: 'auto', motion: 'auto', filter: 'cine', subtitles: 'narracion', textStyle: 'inferior', padding: 0.7 },
    seo: { keywords: '' },
    output: { name: '', open: true, autoExport: true },
  };
  const POS = { idea: [40, 80], script: [330, 80], images: [620, 80], voice: [910, 80], music: [910, 330], montage: [620, 330], seo: [330, 330], output: [40, 330] };
  const TPL = {
    youtube: { name: 'Video YouTube narrado', desc: '90 s horizontal · voz + subtítulos', over: { idea: { duration: 90 } } },
    short: { name: 'Short / TikTok viral', desc: '30 s vertical · ritmo rápido', over: { idea: { duration: 30, aspect: '9:16', tone: 'enérgico, sorprendente y directo' }, voice: { instructions: 'Voz enérgica y rápida, estilo creador de contenido viral.', speed: 1.1 }, montage: { padding: 0.3 } } },
    historia: { name: 'Historia / cuento', desc: '2 min · ilustrado y emotivo', over: { idea: { duration: 120, tone: 'narrativo, emotivo y envolvente' }, images: { style: 'ilustracion' }, voice: { voice: 'fable', instructions: 'Narrador de cuentos: pausado, cálido y muy expresivo.' }, montage: { filter: 'calido', transition: 'fade', motion: 'kenburns', padding: 1 } } },
    top: { name: 'Top / Listado', desc: 'Top con frase clave por escena', over: { idea: { duration: 90, tone: 'dinámico, con datos sorprendentes' }, montage: { subtitles: 'pantalla', textStyle: 'inferior', transition: 'slideL' } } },
    documental: { name: 'Mini documental', desc: '3 min · estilo documental', over: { idea: { duration: 180, tone: 'documental, riguroso y fascinante' }, images: { style: 'documental' }, voice: { voice: 'onyx' }, montage: { filter: 'cine', transition: 'black', padding: 0.9 } } },
    slideshow: { name: 'Presentación con música', desc: 'Sin voz · imágenes + textos', over: { montage: { subtitles: 'pantalla', textStyle: 'titulo' } }, off: ['voice', 'seo'] },
  };
  const makeFlow = (tid) => {
    const t = TPL[tid];
    const cfg = {};
    for (const k of P.ORDER) cfg[k] = { ...DEF[k], ...((t.over || {})[k] || {}) };
    const on = { voice: true, music: false, seo: true };
    (t.off || []).forEach((k) => (on[k] = false));
    return { id: F.uid(), tpl: tid, name: t.name, cfg, on, pos: JSON.parse(JSON.stringify(POS)) };
  };
  P.makeFlow = makeFlow;
  P.cfgFrom = (fl) => ({
    idea: fl.cfg.idea, script: fl.cfg.script, images: fl.cfg.images, voice: fl.on.voice ? fl.cfg.voice : null,
    music: fl.on.music ? fl.cfg.music : null, montage: fl.cfg.montage, seo: fl.on.seo ? fl.cfg.seo : null, output: fl.cfg.output,
  });

  let flow = null, selNode = 'idea', states = {}, logLines = [], running = false, root = null;
  try { flow = JSON.parse(localStorage.getItem('framaly.flowDraft') || 'null'); } catch (e) {}
  if (!flow || !flow.cfg) flow = makeFlow('youtube');
  const saveDraft = F.debounce(() => { try { localStorage.setItem('framaly.flowDraft', JSON.stringify(flow)); } catch (e) {} }, 300);

  function summary(id) {
    const c = flow.cfg[id];
    switch (id) {
      case 'idea': return `${c.topic ? F.esc(c.topic.slice(0, 60)) : '<span style="color:var(--or2)">Escribe el tema…</span>'}<br><span class="dim">${c.duration}s · ${c.aspect}</span>`;
      case 'script': return `${c.scenes || 'Auto (' + P.sceneCount(flow.cfg.idea, c) + ')'} escenas · ${({ anthropic: 'Claude', openai: 'OpenAI', gemini: 'Gemini', minimax: 'MiniMax' })[c.provider === 'auto' ? F.settings.textProvider : c.provider] || 'IA'}`;
      case 'images': return `${F.STYLES[c.style]?.name || c.style} · calidad ${c.quality}`;
      case 'voice': return c.provider === 'elevenlabs' || c.provider === 'minimax' ? `${c.provider === 'minimax' ? 'MiniMax' : 'ElevenLabs'} · ${c.voiceId ? c.voiceId.slice(0, 10) + '…' : 'sin voz'}` : `${c.provider === 'gemini' ? 'Gemini' : 'OpenAI'} · ${c.voice}${c.provider === 'gemini' ? '' : ' · x' + c.speed}`;
      case 'music': { const m = F.media.byId(c.mediaId); return m ? F.esc(m.name.slice(0, 30)) : 'Elige una pista'; }
      case 'montage': return `${c.transition === 'auto' ? 'Transiciones variadas' : R.TRANSITIONS.find((t) => t.id === c.transition)?.name} · ${R.filter(c.filter).name}`;
      case 'seo': return c.keywords ? F.esc(c.keywords.slice(0, 40)) : 'Título, descripción, tags y capítulos';
      case 'output': return c.name ? F.esc(c.name) : 'Nombre: título del guion';
    }
  }
  function costEstimate() {
    const n = P.sceneCount(flow.cfg.idea, flow.cfg.script);
    const per = { low: 0.016, medium: 0.063, high: 0.25 }[flow.cfg.images.quality] || 0.06;
    const chars = (+flow.cfg.idea.duration || 60) * 15;
    const voice = flow.on.voice ? (flow.cfg.voice.provider === 'openai' ? chars * 0.000015 : 0) : 0;
    return `${n} imágenes · costo aprox. ≈ US$${(n * per + voice + 0.03).toFixed(2)}`;
  }

  function renderNodes() {
    if (!root) return;
    const area = root.querySelector('#fla'); if (!area) return;
    area.querySelectorAll('.node').forEach((n) => n.remove());
    for (const id of P.ORDER) {
      const t = NT[id], [x, y] = flow.pos[id] || POS[id], st = states[id];
      const off = t.toggle && !flow.on[id];
      area.insertAdjacentHTML('beforeend', `<div class="node ${selNode === id ? 'sel' : ''} ${off ? 'off' : ''} ${st ? st.s : ''}" data-n="${id}" style="left:${x}px;top:${y}px">
        <div class="nh"><div class="ic" style="background:${t.color}">${I(t.icon)}</div><b>${P.NAMES[id]}</b>${t.toggle ? `<button class="sw ${flow.on[id] ? 'on' : ''}" data-sw="${id}" title="Activar / desactivar"></button>` : ''}</div>
        <div class="nb">${t.desc}<div class="sum">${summary(id)}</div><div class="ns">${st ? (st.s === 'run' ? '<span class="spin"></span>' : st.s === 'done' ? I('check') : st.s === 'err' ? I('x') : '') + ' ' + F.esc(st.msg || '') : off ? 'Desactivado' : 'Listo'}</div></div></div>`);
    }
    renderEdges();
    const c = root.querySelector('#flCost'); if (c) c.textContent = costEstimate();
  }
  function renderEdges() {
    const svg = root.querySelector('#edges'); if (!svg) return;
    const box = (id) => { const el = root.querySelector(`[data-n="${id}"]`); const [x, y] = flow.pos[id]; return { x, y, w: el?.offsetWidth || 236, h: el?.offsetHeight || 120 }; };
    let h = '';
    for (let i = 0; i < P.ORDER.length - 1; i++) {
      const a = box(P.ORDER[i]), b = box(P.ORDER[i + 1]);
      const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      const dx = bc.x - ac.x, dy = bc.y - ac.y;
      let p1, p2, c1, c2;
      if (Math.abs(dx) >= Math.abs(dy)) {
        const s = Math.sign(dx) || 1;
        p1 = { x: ac.x + (s * a.w) / 2, y: ac.y }; p2 = { x: bc.x - (s * b.w) / 2, y: bc.y };
        const k = Math.max(40, Math.abs(p2.x - p1.x) / 2); c1 = { x: p1.x + s * k, y: p1.y }; c2 = { x: p2.x - s * k, y: p2.y };
      } else {
        const s = Math.sign(dy) || 1;
        p1 = { x: ac.x, y: ac.y + (s * a.h) / 2 }; p2 = { x: bc.x, y: bc.y - (s * b.h) / 2 };
        const k = Math.max(40, Math.abs(p2.y - p1.y) / 2); c1 = { x: p1.x, y: p1.y + s * k }; c2 = { x: p2.x, y: p2.y - s * k };
      }
      const sa = states[P.ORDER[i]]?.s, sb = states[P.ORDER[i + 1]]?.s;
      const cls = sb === 'run' ? 'on' : sa && sb && sb !== 'run' ? 'done' : '';
      h += `<path class="${cls}" d="M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}"/><circle cx="${p2.x}" cy="${p2.y}" r="5" fill="#0c0907" stroke="${cls ? '#ff6a1a' : '#4a382b'}" stroke-width="2.5"/>`;
    }
    svg.innerHTML = h;
  }
  function renderInsp() {
    const el = root?.querySelector('#fli'); if (!el) return;
    const t = NT[selNode];
    el.innerHTML = `<div class="row" style="gap:10px;margin-bottom:6px"><div class="ic" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;background:${t.color}">${I(t.icon)}</div><div><b>${P.NAMES[selNode]}</b><div class="muted small">${t.desc}</div></div></div>
      ${t.toggle ? `<label class="check"><input type="checkbox" data-on ${flow.on[selNode] ? 'checked' : ''}> Nodo activado</label>` : ''}
      <div id="fliForm">${F.form(FIELDS[selNode], flow.cfg[selNode])}</div>
      ${selNode === 'voice' ? `<p class="hint">Para elegir voces de ElevenLabs ve a <a href="#/voces">Voces</a> y copia el Voice ID.</p>` : ''}
      ${selNode === 'music' ? `<p class="hint">Sube música a la <a href="#/biblioteca">Biblioteca</a> para usarla aquí.</p>` : ''}
      ${selNode === 'images' || selNode === 'voice' || selNode === 'script' ? `<p class="hint">Requiere API keys en <a href="#/integraciones">Integraciones</a>.</p>` : ''}`;
  }
  function addLog(t, c = '') {
    logLines.push({ t: `[${new Date().toLocaleTimeString('es')}] ${t}`, c }); if (logLines.length > 300) logLines.shift();
    const l = root?.querySelector('#flLog'); if (!l || !l.isConnected) return;
    l.insertAdjacentHTML('beforeend', `<div class="${c}">${F.esc(logLines[logLines.length - 1].t)}</div>`); l.scrollTop = 1e9;
  }
  function renderList() {
    const sel = root.querySelector('#flTpl');
    if (sel) sel.innerHTML = `<option value="">Plantillas…</option>${Object.entries(TPL).map(([k, t]) => `<option value="tpl:${k}">${F.esc(t.name)}</option>`).join('')}${F.settings.flows.length ? `<optgroup label="Mis flujos">${F.settings.flows.map((f) => `<option value="fl:${f.id}">${F.esc(f.name)}</option>`).join('')}</optgroup>` : ''}`;
    const el = root.querySelector('#flList');
    el.innerHTML = `<div class="nav-sec">Plantillas</div>${Object.entries(TPL).map(([k, t]) => `<button class="it" data-tpl="${k}"><b>${t.name}</b><small>${t.desc}</small></button>`).join('')}
      <div class="nav-sec">Mis flujos</div>${F.settings.flows.length ? F.settings.flows.map((f) => `<button class="it ${f.id === flow.id ? 'on' : ''}" data-fl="${f.id}"><b>${F.esc(f.name)}</b><small>${F.esc(f.cfg.idea.topic.slice(0, 40) || 'Sin tema')}</small></button>`).join('') : '<div class="small dim" style="padding:4px 12px">Aún no guardaste flujos</div>'}`;
  }
  function setRunBtn() { const b = root?.querySelector('#flRun'); if (!b) return; b.disabled = running; b.innerHTML = running ? '<span class="spin"></span> Ejecutando…' : `${I('play')} Ejecutar flujo`; }

  async function run() {
    if (running) return;
    if (!flow.cfg.idea.topic.trim()) { selNode = 'idea'; renderNodes(); renderInsp(); root.querySelector('[data-f="topic"]')?.focus(); return F.toast('Escribe el tema del video en el nodo Idea'); }
    running = true; states = {}; setRunBtn(); renderNodes();
    addLog(`▶ Ejecutando flujo "${flow.name}"`, 'w');
    let cur = null;
    try {
      const p = await P.run(P.cfgFrom(flow), { step: (id, s, msg) => { states[id] = { s, msg }; if (s === 'run') cur = id; renderNodes(); }, log: addLog });
      addLog(`✓ Proyecto "${p.name}" creado. Ábrelo en el Editor para revisar y exportar.`, 'o');
      F.toast(`Video "${p.name}" creado`, 'ok');
      if (flow.cfg.output.autoExport !== false) {
        addLog('▶ Exportando el MP4 automáticamente…', 'w');
        const blob = await F.exportProject(p, { format: 'mp4', quality: 'high', fps: p.fps || 30 });
        if (blob) addLog(`✓ MP4 exportado (${F.bytes(blob.size)}). Revisa título y miniatura en Publicar.`, 'o');
        F.router.go('#/publicar');
      } else if (flow.cfg.output.open && location.hash.startsWith('#/flujos')) location.hash = '#/editor';
    } catch (e) {
      if (cur && states[cur]?.s === 'run') states[cur] = { s: 'err', msg: 'Error' };
      addLog('✗ ' + e.message, 'e'); F.toast(e.message, 'error'); renderNodes();
    }
    running = false; setRunBtn();
  }

  F.flows = {
    load(cfgOverride) { flow = makeFlow('youtube'); Object.assign(flow.cfg.idea, cfgOverride || {}); saveDraft(); },
    view(el) {
      root = el;
      el.innerHTML = `<div class="flows">
        <aside class="fl-list" id="flList"></aside>
        <div class="fl-canvas" id="flc" style="grid-column:2;grid-row:1">
          <div class="fl-bar"><input type="text" id="flName" title="Nombre del flujo"><select id="flTpl" class="fl-tpl" title="Cambiar de plantilla"></select><span class="pill">${I('bot')} 6 agentes</span><span class="grow"></span>
            <button class="btn sm ghost" id="flReset" title="Reordenar nodos">${I('grid')}</button>
            <button class="btn sm" id="flSave">${I('save')} Guardar</button><button class="btn primary" id="flRun"></button></div>
          <div class="fl-area" id="fla"><svg class="edges" id="edges"></svg></div>
        </div>
        <aside class="fl-insp" id="fli"></aside>
        <div class="fl-log"><div class="row"><b class="small">Registro de ejecución</b><span class="grow"></span><span id="flCost" class="muted small"></span><button class="btn sm ghost" id="flClear">Limpiar</button></div><div class="logbox" id="flLog"></div></div>
      </div>`;
      el.querySelector('#flName').value = flow.name;
      const lg = el.querySelector('#flLog');
      lg.innerHTML = logLines.length ? logLines.map((l) => `<div class="${l.c}">${F.esc(l.t)}</div>`).join('') : '<div>Listo. Selecciona un nodo para configurarlo y pulsa “Ejecutar flujo”. Cada agente pasa su resultado al siguiente.</div>';
      lg.scrollTop = 1e9;
      renderList(); renderNodes(); renderInsp(); setRunBtn();

      el.querySelector('#flName').addEventListener('input', (e) => { flow.name = e.target.value; saveDraft(); });
      el.querySelector('#flRun').onclick = run;
      el.querySelector('#flClear').onclick = () => { logLines = []; lg.innerHTML = ''; };
      el.querySelector('#flReset').onclick = () => { flow.pos = JSON.parse(JSON.stringify(POS)); saveDraft(); renderNodes(); };
      el.querySelector('#flSave').onclick = () => {
        const i = F.settings.flows.findIndex((f) => f.id === flow.id);
        const copy = JSON.parse(JSON.stringify(flow));
        if (i >= 0) F.settings.flows[i] = copy; else F.settings.flows.unshift(copy);
        F.saveSettings(); renderList(); F.toast('Flujo guardado', 'ok');
      };
      const loadFrom = (tpl, fl) => {
        if (running) { F.toast('Espera a que termine la ejecución'); return; }
        if (tpl) { const topic = flow.cfg.idea.topic; flow = makeFlow(tpl); flow.cfg.idea.topic = topic; }
        else if (fl) { const s = F.settings.flows.find((x) => x.id === fl); if (!s) return; flow = JSON.parse(JSON.stringify(s)); }
        else return;
        states = {}; saveDraft(); el.querySelector('#flName').value = flow.name; renderList(); renderNodes(); renderInsp();
      };
      el.querySelector('#flList').addEventListener('click', (e) => {
        const t = e.target.closest('[data-tpl]'), f = e.target.closest('[data-fl]');
        loadFrom(t?.dataset.tpl, f?.dataset.fl);
      });
      el.querySelector('#flTpl').addEventListener('change', (e) => {
        const [k, id] = e.target.value.split(':'); e.target.value = '';
        loadFrom(k === 'tpl' ? id : null, k === 'fl' ? id : null);
      });
      el.querySelector('#flList').addEventListener('contextmenu', async (e) => {
        const f = e.target.closest('[data-fl]'); if (!f) return; e.preventDefault();
        if (await F.confirm('Eliminar flujo', '¿Eliminar este flujo guardado?', 'Eliminar')) { F.settings.flows = F.settings.flows.filter((x) => x.id !== f.dataset.fl); F.saveSettings(); renderList(); }
      });

      const fli = el.querySelector('#fli');
      const onForm = (e) => {
        if (e.target.matches('[data-on]')) { flow.on[selNode] = e.target.checked; }
        else if (e.target.dataset.f) flow.cfg[selNode][e.target.dataset.f] = F.formRead(e.target);
        else return;
        saveDraft(); renderNodes();
      };
      fli.addEventListener('input', onForm);
      fli.addEventListener('change', onForm);

      const area = el.querySelector('#fla');
      area.addEventListener('click', (e) => {
        const sw = e.target.closest('[data-sw]');
        if (sw) { flow.on[sw.dataset.sw] = !flow.on[sw.dataset.sw]; saveDraft(); renderNodes(); if (selNode === sw.dataset.sw) renderInsp(); }
      });
      area.addEventListener('pointerdown', (e) => {
        const n = e.target.closest('[data-n]'); if (!n || e.target.closest('[data-sw]')) return;
        const id = n.dataset.n, x0 = e.clientX, y0 = e.clientY, [px, py] = flow.pos[id];
        let moved = false;
        const mv = (ev) => {
          const dx = ev.clientX - x0, dy = ev.clientY - y0;
          if (!moved && Math.hypot(dx, dy) < 4) return; moved = true;
          flow.pos[id] = [Math.max(0, px + dx), Math.max(0, py + dy)];
          n.style.left = flow.pos[id][0] + 'px'; n.style.top = flow.pos[id][1] + 'px'; n.style.cursor = 'grabbing';
          renderEdges();
        };
        const up = () => {
          window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
          if (moved) return saveDraft();
          if (selNode !== id) { selNode = id; renderNodes(); renderInsp(); }
          // En celular los ajustes del nodo están debajo del lienzo: llevar al usuario hasta ellos
          if (window.innerWidth <= 1000) root?.querySelector('#fli')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
      return () => { root = null; };
    },
  };

  /* ======================== MODO AUTOMÁTICO (un clic) ======================== */
  F.auto = {
    /** Qué falta para poder trabajar en automático */
    missing() {
      const m = [];
      if (!['openai', 'gemini', 'minimax'].some((p) => F.api.has(p))) m.push('OpenAI, Gemini o MiniMax (imágenes)');
      if (!['openai', 'gemini'].some((p) => F.api.has(p))) m.push('OpenAI o Gemini (voz)');
      if (!F.api.textReady()) m.push('Claude, OpenAI, Gemini o MiniMax (guiones)');
      return m;
    },
    async run({ topic, aspect = '16:9', duration = 60, style = 'cine', exportAfter = true }) {
      if (!String(topic || '').trim()) { F.toast('Escribe primero de qué trata tu video'); return null; }
      const miss = F.auto.missing();
      if (miss.length) {
        F.modal({ title: 'Conecta tus APIs para el modo automático',
          body: `<p class="muted" style="margin-top:0">Para crear videos solos, FRAMALY necesita:</p><ul>${miss.map((x) => `<li><b>${x}</b></li>`).join('')}</ul>
            <ol class="help-steps"><li>Entra a <b>platform.openai.com</b> → <b>API keys</b> → <b>Create new secret key</b>.</li><li>Copia la clave (empieza por <code>sk-</code>).</li><li>Pégala en <b>Integraciones API → OpenAI</b> y pulsa <b>Probar</b>.</li><li>Vuelve a Inicio y pulsa <b>Crear video automático</b>.</li></ol>`,
          actions: [{ label: 'Más tarde' }, { label: 'Ir a Integraciones', primary: true, onClick: () => F.router.go('#/integraciones') }] });
        return null;
      }
      const fl = makeFlow(aspect === '9:16' ? 'short' : 'youtube');
      Object.assign(fl.cfg.idea, { topic: topic.trim(), aspect, duration: +duration || 60 });
      fl.cfg.images.style = style;
      fl.cfg.voice.provider = F.api.has('openai') ? 'openai' : 'gemini';
      if (fl.cfg.voice.provider === 'gemini') fl.cfg.voice.voice = 'Kore';
      fl.on.voice = true; fl.on.seo = true;
      // Música automática: la última pista subida por el usuario
      const music = F.media.audios().find((m) => m.source === 'upload');
      if (music) { fl.on.music = true; fl.cfg.music.mediaId = music.id; }
      return P.runModal(P.cfgFrom(fl), { autoExport: exportAfter });
    },
  };
})();
