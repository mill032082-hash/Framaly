/* FRAMALY — Método Golden del editor de video (sin IA, todo corre en el navegador).
   Reúne el conocimiento de la skill golden-video-editor: ley de orden, intake con claims,
   limpieza de silencios por análisis de audio, multicámara, subtítulos por palabra,
   ducking, revisión Golden y reporte de cortes. */
(function () {
  'use strict';
  const R = F.R, I = F.icon;
  const G = (F.golden = {});

  /* ---------- datos del intake (guardados dentro del proyecto) ---------- */
  const DESTINOS = {
    meta: { n: 'Anuncio Meta / TikTok (9:16)', aspect: '9:16', target: 35, ad: true },
    yt: { n: 'YouTube (16:9)', aspect: '16:9', target: 0, ad: false },
    reel: { n: 'Reel orgánico (9:16)', aspect: '9:16', target: 30, ad: false },
  };
  const GD0 = { destino: 'meta', destinoSet: false, target: 35, producto: '', claimsNo: '', claimsOk: '', script: '', lastCut: null };
  const gd = (p) => { const o = p.golden || (p.golden = {}); for (const k in GD0) if (!(k in o)) o[k] = GD0[k]; return o; };   // siempre el mismo objeto
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const terms = (s) => String(s || '').split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
  const wordsOf = (s) => String(s || '').split(/\s+/).filter(Boolean);
  const EN_CTA = /\b(buy now|shop now|order now|click here|learn more|sign up|swipe up|get yours|limited time|free shipping)\b/i;
  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

  /* =========================================================
     1 · CORTAR — silencios, multicámara, duración objetivo
     ========================================================= */
  /** Analiza un AudioBuffer y devuelve los tramos de silencio (en segundos). */
  G.findSilences = (buf, { minSil = 0.6, win = 0.02 } = {}) => {
    const ch = buf.getChannelData(0), sr = buf.sampleRate, n = Math.floor(win * sr), rms = [];
    for (let i = 0; i + n <= ch.length; i += n) { let s = 0; for (let k = i; k < i + n; k++) s += ch[k] * ch[k]; rms.push(Math.sqrt(s / n)); }
    if (!rms.length) return { sil: [], thr: 0 };
    const sorted = [...rms].sort((a, b) => a - b);
    const floor = sorted[Math.floor(sorted.length * 0.1)] || 0, peak = sorted[Math.floor(sorted.length * 0.98)] || 0;
    const thr = Math.max(floor * 2.5, peak * 0.04, 0.003);   // umbral adaptativo al ruido de fondo
    const sil = []; let st = -1;
    rms.forEach((v, i) => {
      if (v < thr) { if (st < 0) st = i; }
      else if (st >= 0) { if ((i - st) * win >= minSil) sil.push([st * win, i * win]); st = -1; }
    });
    if (st >= 0 && (rms.length - st) * win >= minSil) sil.push([st * win, rms.length * win]);
    return { sil, thr, noise: floor };
  };

  function wavBlob(chs, sr) {
    const len = chs[0].length, nc = chs.length, out = new DataView(new ArrayBuffer(44 + len * nc * 2));
    const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + len * nc * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
    out.setUint16(22, nc, true); out.setUint32(24, sr, true); out.setUint32(28, sr * nc * 2, true); out.setUint16(32, nc * 2, true); out.setUint16(34, 16, true);
    w(36, 'data'); out.setUint32(40, len * nc * 2, true);
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < nc; c++) { const v = F.clamp(chs[c][i], -1, 1); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return new Blob([out], { type: 'audio/wav' });
  }

  /** Aplica cortes [[ini,fin],...] (segundos del audio) a una pista: crea una voz nueva, conserva la original y reubica la transcripción. */
  async function applyCuts(E, a, buf, cuts, info = {}) {
    const p = E.p, sr = buf.sampleRate, keep = []; let pos = 0;
    cuts = cuts.filter(([s, e]) => e - s >= 0.12).sort((x, y) => x[0] - y[0]);
    for (const [s, e] of cuts) { if (s > pos) keep.push([pos, s]); pos = Math.max(pos, e); }
    if (pos < buf.duration) keep.push([pos, buf.duration]);
    const total = keep.reduce((t, [s, e]) => t + Math.round((e - s) * sr), 0), out = [];
    for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) {
      const src = buf.getChannelData(c), dst = new Float32Array(total); let o = 0;
      for (const [s, e] of keep) {
        const i0 = Math.round(s * sr), i1 = Math.round(e * sr); dst.set(src.subarray(i0, i1), o);
        const f = Math.min(Math.round(0.005 * sr), (i1 - i0) >> 1);   // microfundido anti-clic
        for (let k = 0; k < f; k++) { dst[o + k] *= k / f; dst[o + (i1 - i0) - 1 - k] *= k / f; }
        o += i1 - i0;
      }
      out.push(dst);
    }
    const old = F.media.byId(a.mediaId);
    const m = await F.media.add({ type: 'audio', name: `${old?.name || 'Voz'} (editada)`, blob: wavBlob(out, sr), source: old?.source || 'upload' });
    const g = gd(p), tr = (g.tr ||= {});
    if (tr[a.mediaId]) {   // reubica las palabras que se quedan
      const shift = (t) => t - cuts.reduce((d, [s, e]) => d + (t >= e ? e - s : t > s ? t - s : 0), 0);
      tr[m.id] = tr[a.mediaId].filter((w) => !cuts.some(([s, e]) => w.s >= s - 0.01 && w.e <= e + 0.01)).map((w) => ({ ...w, s: shift(w.s), e: shift(w.e) }));
    }
    E.api.commit(); a.mediaId = m.id;
    const removed = cuts.reduce((t, [s, e]) => t + (e - s), 0);
    g.lastCut = { audio: old?.name || 'voz', cuts: cuts.map(([s, e]) => [F.round1(s), F.round1(e)]), removed: F.round1(removed), before: F.round1(buf.duration), after: F.round1(buf.duration - removed), dropped: info.dropped || [] };
    E.api.after({ insp: true });
    F.toast(`${cuts.length} cortes · ${F.round1(removed)} s menos. Revisa el reporte de cortes.`, 'ok', 4000);
  }

  /** Quita silencios por energía del audio: deja 200 ms de aire y no toca el inicio/fin de una palabra. */
  G.cleanSilence = async (E, audioId, minSil) => {
    const a = E.p.audio.find((x) => x.id === audioId);
    if (!a) return F.toast('Selecciona una pista de voz en el timeline');
    const buf = await F.media.decode(a.mediaId), { sil } = G.findSilences(buf, { minSil }), AIR = 0.2, cuts = [];
    for (const [s, e] of sil) {
      const lead = s < 0.05, tail = e >= buf.duration - 0.05, air = lead ? 0.1 : tail ? 0.3 : AIR;
      const a0 = lead ? s : s + air / 2, a1 = lead ? e - air : tail ? e : e - air / 2;
      if (a1 - a0 >= 0.15) cuts.push([a0, a1]);
    }
    if (!cuts.length) return F.toast(`No se encontraron silencios de más de ${minSil} s. Si el audio tiene ruido de fondo, no se pueden detectar.`);
    await applyCuts(E, a, buf, cuts);
  };

  /* ---------- con transcripción: pausas exactas, muletillas y tomas repetidas ---------- */
  const FILLER = /^(eh+|em+|mm+|hm+|ah+|uh+|um+|ehm+)$/;
  const wkey = (w) => norm(w).replace(/[^a-z0-9ñ]/g, '');
  function mergeCuts(c) { c.sort((a, b) => a[0] - b[0]); const o = []; for (const x of c) { const l = o[o.length - 1]; if (l && x[0] <= l[1] + 0.02) l[1] = Math.max(l[1], x[1]); else o.push([...x]); } return o; }
  G.cutsFromWords = (words, minSil = 0.6) => {
    const cuts = [], dropped = [], AIR = 0.2, n = words.length, gone = new Array(n).fill(false);
    words.forEach((w, i) => { if (FILLER.test(wkey(w.w))) gone[i] = true; });
    /* toma repetida: frase de 3+ palabras dicha dos veces seguidas -> te quedas con la SEGUNDA */
    for (let len = 6; len >= 3; len--) for (let i = 0; i + 2 * len <= n; i++) {
      if (gone.slice(i, i + len).some(Boolean)) continue;
      let same = true; for (let k = 0; k < len; k++) if (wkey(words[i + k].w) !== wkey(words[i + len + k].w)) { same = false; break; }
      if (same) for (let k = 0; k < len; k++) gone[i + k] = true;
    }
    let i = 0;
    while (i < n) {      // tramos de palabras descartadas -> corte
      if (!gone[i]) { i++; continue; }
      let j = i; while (j < n && gone[j]) j++;
      const s = words[i].s, e = j < n ? words[j].s : words[j - 1].e;
      if (e - s > 0.12) { cuts.push([s, Math.max(s, e - 0.05)]); dropped.push(words.slice(i, j).map((x) => x.w).join(' ')); }
      i = j;
    }
    for (let k = 0; k + 1 < n; k++) {      // pausas largas entre palabras (deja 200 ms de aire)
      const a0 = words[k].e, a1 = words[k + 1].s;
      if (!gone[k] && !gone[k + 1] && a1 - a0 >= minSil) cuts.push([a0 + AIR / 2, a1 - AIR / 2]);
    }
    return { cuts: mergeCuts(cuts), dropped };
  };

  G.transcribe = async (E, audioId, onProgress) => {
    const a = E.p.audio.find((x) => x.id === audioId); if (!a) return F.toast('Selecciona una pista de voz');
    const words = await F.transcribe.run(a.mediaId, onProgress);
    (gd(E.p).tr ||= {})[a.mediaId] = words; E.api.save();
    F.toast(`Transcripción lista: ${words.length} palabras`, 'ok'); return words;
  };
  G.cleanByTranscript = async (E, audioId, minSil, onProgress) => {
    const a = E.p.audio.find((x) => x.id === audioId); if (!a) return F.toast('Selecciona una pista de voz');
    const words = gd(E.p).tr?.[a.mediaId] || await G.transcribe(E, audioId, onProgress); if (!words) return;
    const { cuts, dropped } = G.cutsFromWords(words, minSil);
    if (!cuts.length) return F.toast('Nada que cortar: no hay muletillas, repeticiones ni pausas largas.');
    await applyCuts(E, a, await F.media.decode(a.mediaId), cuts, { dropped });
  };

  /** Subtítulos desde el audio: cada clip recibe las palabras que se dicen mientras está en pantalla, con tiempos exactos. */
  G.captionsFromAudio = async (E, audioId, onProgress) => {
    const p = E.p, a = p.audio.find((x) => x.id === audioId); if (!a) return F.toast('Selecciona una pista de voz');
    if (!p.clips.length) return F.toast('Añade imágenes al timeline');
    const words = gd(p).tr?.[a.mediaId] || await G.transcribe(E, audioId, onProgress); if (!words) return;
    const { items } = R.layout(p); E.api.commit();
    items.forEach((it) => {
      const ws = words.filter((w) => { const mid = (a.start || 0) + (w.s + w.e) / 2; return mid >= it.start && mid < it.end; });
      const c = it.clip; if (!ws.length) return;   // sin voz en este clip: se respeta su texto
      c.text = G.cleanText(ws.map((w) => w.w).join(' ')); c.textStyle = 'subtitulo'; c.textAnim = 'words';
      c.capTimes = [];
      for (let k = 0; k < ws.length; k += 3) c.capTimes.push(Math.max(0, (a.start || 0) + ws[k].s - it.start));
    });
    E.api.after({ insp: true }); F.toast('Subtítulos sincronizados con la voz: máx. 3 palabras', 'ok');
  };


  /* =========================================================
     EDITAR AUTOMÁTICO — todo el método con un solo botón
     Orden de la skill: Cortar → Ajustar → Ritmo → Subtitular → Sonorizar → Revisar
     ========================================================= */
  G.splitLong = (E, maxLen = 4) => {
    const p = E.p; let n = 0;
    for (let i = 0; i < p.clips.length; i++) {
      const c = p.clips[i];
      if (c.duration <= maxLen * 1.25) continue;
      const k = Math.ceil(c.duration / maxLen), part = F.round1(c.duration / k), last = c.transition;
      const extra = [];
      for (let j = 1; j < k; j++) extra.push({ ...c, id: F.uid(), duration: j === k - 1 ? Math.max(0.5, F.round1(c.duration - part * (k - 1))) : part, transition: j === k - 1 ? last : 'none', text: '' });
      c.duration = part; c.transition = 'none';
      p.clips.splice(i + 1, 0, ...extra); i += extra.length; n += extra.length;
    }
    return n;
  };

  G.auto = async (E) => {
    const p = E.p, g = gd(p);
    if (!p.clips.length) return F.toast('Añade al menos una imagen (y tu voz grabada) para editar en automático');
    const voice = () => p.audio.find((a) => a.kind !== 'musica' && !a.loop);
    const steps = [['cut', 'Cortar silencios, muletillas y repeticiones'], ['fit', 'Ajustar las imágenes a la voz'], ['rhythm', 'Ritmo y encuadres'], ['subs', 'Subtítulos (máx. 3 palabras)'], ['sound', 'Sonido'], ['review', 'Revisión Golden']];
    const undoStart = E.undo.length; let cancelled = false;
    const m = F.modal({ title: 'Editando en automático', wide: true, locked: true,
      body: `<div class="auto-steps">${steps.map(([k, t]) => `<div class="as" id="as-${k}"><span class="si">·</span><div><b>${t}</b><div class="small muted" data-n></div></div></div>`).join('')}</div>`,
      actions: [{ label: 'Detener', danger: true, onClick: () => { cancelled = true; return false; } }] });
    const set = (k, st, note = '') => { const el = m.q('#as-' + k); if (!el) return; el.querySelector('.si').textContent = { run: '⏳', ok: '✅', skip: '➖', warn: '⚠️', bad: '❌' }[st]; el.querySelector('[data-n]').textContent = note; el.className = 'as ' + st; };
    const run = async (k, fn) => {
      if (cancelled) return set(k, 'skip', 'Detenido');
      set(k, 'run', 'Trabajando…');
      try { const r = await fn((t) => set(k, 'run', t)); set(k, r?.st || 'ok', r?.note || ''); }
      catch (e) { set(k, 'bad', e.message || String(e)); }
    };
    const vid = () => voice()?.id;

    await run('cut', async (prog) => {
      if (!voice()) return { st: 'skip', note: 'No hay voz. Sube tu grabación en Audio para cortar silencios.' };
      const before = voice().mediaId;
      try { await G.cleanByTranscript(E, vid(), G.minSil || 0.6, prog); }
      catch (e) {
        prog('La transcripción no está disponible; corto por volumen…');
        await G.cleanSilence(E, vid(), G.minSil || 0.6);
        return { st: voice().mediaId === before ? 'warn' : 'ok', note: voice().mediaId === before ? 'Sin silencios que cortar. (' + e.message + ')' : 'Cortado por volumen. ' + e.message };
      }
      return voice().mediaId === before ? { st: 'ok', note: 'La voz ya estaba limpia.' } : { note: `${g.lastCut.cuts.length} cortes · ${g.lastCut.removed} s menos` + (g.lastCut.dropped?.length ? ` · descartado: «${g.lastCut.dropped.join('», «')}»` : '') };
    });
    await run('fit', async () => {
      const v = voice(); if (!v) return { st: 'skip', note: 'Sin voz: se respetan las duraciones actuales.' };
      const end = (v.start || 0) + (F.media.byId(v.mediaId)?.duration || 0) + 0.5, tot = E.api.total();
      if (!end || !tot) return { st: 'skip' };
      E.api.commit(); const f = end / tot; p.clips.forEach((c) => (c.duration = Math.max(0.5, F.round1(c.duration * f))));
      E.api.after({ insp: true }); return { note: `Imágenes ajustadas a ${F.fmtS(end)} de voz` };
    });
    await run('rhythm', async () => {
      E.api.commit(); const n = G.splitLong(E, 4); G.multicamQuiet(p); E.api.after({ insp: true });
      return { note: (n ? `${n} ${n === 1 ? 'corte nuevo' : 'cortes nuevos'} (planos de ~4 s) · ` : '') + 'encuadres alternados: general, 113 %, 125 %' };
    });
    await run('subs', async (prog) => {
      const v = voice();
      if (v) { try { await G.captionsFromAudio(E, v.id, prog); G.cleanQuiet(p); return { note: 'Sincronizados con la voz' }; } catch (e) { if (!g.script) return { st: 'warn', note: e.message + ' Pega el guion en la pestaña Golden para subtitular sin transcripción.' }; } }
      if (g.script) { G.scriptToCaptions(E, g.script); return { st: v ? 'warn' : 'ok', note: 'Repartidos desde el guion pegado' }; }
      return { st: 'skip', note: 'Sin voz ni guion. Escribe textos con el botón «Texto».' };
    });
    await run('sound', async () => {
      const mus = p.audio.some((a) => a.kind === 'musica'), v = !!voice();
      if (mus && v) { E.api.commit(); p.duck = true; E.api.after({ insp: true }); return { note: 'La música baja 12 dB cuando habla la voz' }; }
      return { st: 'skip', note: mus ? 'Sin voz: la música queda igual.' : 'No hay música. Súbela en Audio para activar el ducking.' };
    });
    let res = [];
    await run('review', async () => {
      res = G.review(p); const bad = res.filter((x) => x.lvl === 'bad').length, warn = res.filter((x) => x.lvl === 'warn').length;
      return { st: bad ? 'bad' : warn ? 'warn' : 'ok', note: bad ? `${bad} por corregir, ${warn} avisos` : warn ? `${warn} avisos` : 'Todo en orden' };
    });
    E.api.seek?.(0);
    m.q('.modal-f').innerHTML = `<button class="btn" data-undo>Deshacer todo</button><button class="btn" data-rev>Ver revisión y reporte</button><button class="btn primary" data-done>Listo</button>`;
    m.q('.modal-f').addEventListener('click', (e) => {
      if (e.target.closest('[data-undo]')) { while (E.undo.length > undoStart) E.api.undo(); F.toast('Edición automática deshecha', 'ok'); m.close(); }
      if (e.target.closest('[data-rev]')) { m.close(); G.openReview(E); }
      if (e.target.closest('[data-done]')) m.close();
    });
  };
  /* versiones sin avisos para usar dentro del automático */
  G.multicamQuiet = (p) => p.clips.forEach((c, i) => { const k = i % 3; if (k === 0) { c.motion = 'none'; c.motionAmt = 0.15; } else if (k === 1) { c.motion = 'zoomIn'; c.motionAmt = 0.13; } else { c.motion = i % 2 ? 'panL' : 'panR'; c.motionAmt = 0.25; } });
  G.cleanQuiet = (p) => p.clips.forEach((c) => (c.text = G.cleanText(c.text)));


  /* =========================================================
     BIBLIOTECA DE PRODUCTOS (claims) y ESTILOS POR CLIENTE (Paso 6)
     Se guardan en este dispositivo, junto a los ajustes de la app.
     ========================================================= */
  const prods = () => (F.settings.goldenProducts ||= []);
  const styles = () => (F.settings.goldenStyles ||= []);
  G.saveProduct = async (E) => {
    const g = gd(E.p); let name = g.producto.trim();
    if (!name) { name = await F.prompt('Nombre del producto', '', 'Para reutilizar sus claims en otros videos'); if (!name) return; g.producto = name; }
    if (!terms(g.claimsNo).length && !terms(g.claimsOk).length) return F.toast('Escribe primero los claims prohibidos o permitidos del producto');
    const ex = prods().find((x) => norm(x.name) === norm(name)), data = { name, claimsNo: g.claimsNo, claimsOk: g.claimsOk };
    if (ex) Object.assign(ex, data); else prods().push({ id: F.uid(), ...data });
    F.saveSettings(); E.api.save(); F.toast(`Producto «${name}» guardado con sus claims`, 'ok');
  };
  G.loadProduct = (E, id) => {
    const x = prods().find((y) => y.id === id), g = gd(E.p); if (!x) return;
    g.producto = x.name; g.claimsNo = x.claimsNo; g.claimsOk = x.claimsOk; E.api.save(); E.api.renderBin();
    F.toast(`Claims de «${x.name}» cargados`, 'ok', 1800);
  };
  G.delProduct = (id) => { F.settings.goldenProducts = prods().filter((x) => x.id !== id); F.saveSettings(); };

  /** Foto del estilo actual: lo que se repite en el proyecto (look, texto, transición, encuadres, extras) */
  G.captureStyle = (p) => {
    const c = p.clips[0] || {}, mot = new Set(p.clips.map((x) => x.motion));
    return { filter: c.filter || 'none', transition: c.transition || 'none', transDur: c.transDur || 0.8, fit: c.fit || 'cover', textStyle: c.textStyle || 'subtitulo', textAnim: c.textAnim || 'words', textColor: c.textColor || '#ffffff',
      multicam: mot.size >= 3, motion: c.motion || 'none', motionAmt: c.motionAmt ?? 0.15, letterbox: !!p.letterbox, progressBar: !!p.progressBar, watermark: p.watermark || '', duck: !!p.duck };
  };
  G.saveStyle = async (E) => {
    if (!E.p.clips.length) return F.toast('Termina primero un video con el estilo que te gusta');
    const name = await F.prompt('Nombre del estilo', '', 'Por ejemplo el nombre del cliente. La próxima vez es un solo clic.'); if (!name) return;
    const s = G.captureStyle(E.p), ex = styles().find((x) => norm(x.name) === norm(name));
    if (ex) ex.style = s; else styles().push({ id: F.uid(), name, style: s });
    F.saveSettings(); E.api.renderBin(); F.toast(`Estilo «${name}» guardado`, 'ok');
  };
  G.applyStyle = (E, id) => {
    const x = styles().find((y) => y.id === id), p = E.p; if (!x) return F.toast('Elige un estilo guardado');
    if (!p.clips.length) return F.toast('Añade imágenes al timeline');
    const s = x.style; E.api.commit();
    p.clips.forEach((c) => { Object.assign(c, { filter: s.filter, transition: s.transition, transDur: s.transDur, fit: s.fit, textStyle: s.textStyle, textAnim: s.textAnim, textColor: s.textColor }); if (!s.multicam) { c.motion = s.motion; c.motionAmt = s.motionAmt; } });
    if (s.multicam) G.multicamQuiet(p);
    p.letterbox = s.letterbox; p.progressBar = s.progressBar; p.duck = s.duck; if (s.watermark) p.watermark = s.watermark;
    E.api.after({ insp: true }); E.api.renderBin(); F.toast(`Estilo «${x.name}» aplicado`, 'ok');
  };
  G.delStyle = (id) => { F.settings.goldenStyles = styles().filter((x) => x.id !== id); F.saveSettings(); };

  /** Multicámara con una sola imagen: alterna encuadres (general, punch-in 113 %, punch-in 125 % tope). */
  G.multicam = (E) => {
    const p = E.p; if (!p.clips.length) return F.toast('Añade imágenes al timeline');
    E.api.commit();
    p.clips.forEach((c, i) => {
      const k = i % 3;
      if (k === 0) { c.motion = 'none'; c.motionAmt = 0.15; }
      else if (k === 1) { c.motion = 'zoomIn'; c.motionAmt = 0.13; }
      else { c.motion = i % 2 ? 'panL' : 'panR'; c.motionAmt = 0.25; }   // tope duro: 125 %
    });
    E.api.after({ insp: true }); F.toast('Encuadres alternados: general · 113 % · 125 % (tope)', 'ok');
  };

  G.fitTarget = (E, target) => {
    const p = E.p, tot = E.api.total();
    if (!p.clips.length || !target) return F.toast('Indica una duración objetivo y añade clips');
    E.api.commit(); const f = target / tot;
    p.clips.forEach((c) => (c.duration = Math.max(0.5, F.round1(c.duration * f))));
    E.api.after({ insp: true }); F.toast(`Duración ajustada a ~${F.fmtS(E.api.total())}`, 'ok');
  };

  /* =========================================================
     2 · SUBTITULAR — reparte el guion; limpia el texto
     ========================================================= */
  G.scriptToCaptions = (E, script) => {
    const p = E.p, ws = wordsOf(script);
    if (!ws.length) return F.toast('Pega primero el guion tal como lo grabaste');
    if (!p.clips.length) return F.toast('Añade imágenes al timeline');
    E.api.commit();
    const tot = E.api.total(); let wi = 0, acc = 0;
    p.clips.forEach((c, i) => {
      acc += c.duration;
      let end = i === p.clips.length - 1 ? ws.length : Math.round((acc / tot) * ws.length);
      for (let k = end; k > wi + 1 && k > end - 3; k--) if (/[.!?…]$/.test(ws[k - 1])) { end = k; break; }   // corta en fin de frase si está cerca
      end = Math.max(end, Math.min(wi + 1, ws.length));
      c.text = G.cleanText(ws.slice(wi, end).join(' ')); wi = end;
      c.textStyle = 'subtitulo'; c.textAnim = 'words';
    });
    E.api.after({ insp: true }); F.toast('Subtítulos repartidos: máx. 3 palabras en pantalla', 'ok');
  };
  G.cleanText = (s) => String(s || '').replace(/[¿¡]/g, '').replace(/\s+/g, ' ').trim();
  G.cleanAll = (E) => {
    const p = E.p; E.api.commit();
    p.clips.forEach((c) => (c.text = G.cleanText(c.text)));
    p.watermark = G.cleanText(p.watermark); E.api.after({ insp: true });
    F.toast('Sin signos de apertura (¿ ¡), solo de cierre', 'ok');
  };

  /* =========================================================
     5 · REVISIÓN GOLDEN (checklist del Paso 5)
     ========================================================= */
  G.review = (p) => {
    const g = gd(p), D = DESTINOS[g.destino] || DESTINOS.meta, { items, total } = R.layout(p), res = [];
    const add = (lvl, t, d) => res.push({ lvl, t, d });   // lvl: ok | warn | bad
    const texts = p.clips.map((c, i) => ({ i, t: c.text || '' })).filter((x) => x.t);
    const alltxt = [...texts.map((x) => ({ w: `clip ${x.i + 1}`, t: x.t })), ...(p.watermark ? [{ w: 'marca de agua', t: p.watermark }] : []), ...(p.meta?.title ? [{ w: 'título', t: p.meta.title }] : [])];

    if (!p.clips.length) { add('bad', 'Timeline vacío', 'Añade imágenes para poder revisar.'); return res; }
    /* claims */
    const no = terms(g.claimsNo);
    if (!no.length) add('warn', 'Sin claims prohibidos declarados', 'Nunca se edita a ciegas: escribe los claims prohibidos del producto en la pestaña Golden.');
    else {
      const hits = []; alltxt.forEach(({ w, t }) => no.forEach((c) => { if (norm(t).includes(norm(c))) hits.push(`«${c}» en ${w}`); }));
      hits.length ? add('bad', 'Claim prohibido en pantalla', hits.join(' · ')) : add('ok', 'Ningún claim prohibido en los textos', `${no.length} claims revisados.`);
    }
    /* puntuación, idioma */
    const open = alltxt.filter(({ t }) => /[¿¡]/.test(t)).map((x) => x.w);
    open.length ? add('bad', 'Signos de apertura (¿ ¡)', `Quítalos en: ${open.join(', ')}. Botón «Limpiar textos».`) : add('ok', 'Sin signos de apertura');
    const en = alltxt.filter(({ t }) => EN_CTA.test(t)).map((x) => x.w);
    en.length ? add('bad', 'CTA en inglés', `Revisa: ${en.join(', ')}. Todo va en español de Colombia.`) : add('ok', 'Sin CTA en inglés');
    /* subtítulos */
    const long = p.clips.map((c, i) => ({ c, i })).filter(({ c }) => c.text && c.textStyle !== 'titulo' && c.textAnim !== 'words' && wordsOf(c.text).length > 3);
    long.length ? add('warn', 'Más de 3 palabras a la vez', `Clips ${long.map((x) => x.i + 1).join(', ')}: usa la animación «Palabra por palabra (máx. 3)».`) : add('ok', 'Subtítulos de máx. 3 palabras');
    /* sonido apagado */
    const withText = p.clips.filter((c) => c.text).length, ratio = withText / p.clips.length;
    ratio < 0.5 ? add('warn', 'Prueba del sonido apagado', `Solo ${Math.round(ratio * 100)}% de los clips tiene texto. El 85% ve sin sonido: si hace falta el audio, faltan subtítulos o b-roll.`) : add('ok', 'Prueba del sonido apagado', `${Math.round(ratio * 100)}% de los clips lleva texto.`);
    /* gancho */
    const hook = items.filter((it) => it.start < 3).some((it) => it.clip.text);
    hook ? add('ok', 'Gancho en los primeros 3 s') : add('warn', 'Sin gancho en los primeros 3 s', 'Pon un texto fuerte en el primer clip: el primer segundo debe frenar el scroll.');
    /* formato y duración */
    if (!g.destinoSet) add('warn', 'Destino sin elegir', 'Elígelo en Intake (Golden) para revisar formato y duración: anuncio Meta/TikTok, YouTube o reel.');
    else p.aspect === D.aspect ? add('ok', 'Formato correcto para el destino', `${p.aspect} · ${D.n}`) : add('bad', 'Formato no coincide con el destino', `${D.n} pide ${D.aspect}; el proyecto es ${p.aspect}.`);
    if (!g.destinoSet) { /* sin destino no se juzga la duración */ }
    else if (D.ad) (total >= 25 && total <= 40) ? add('ok', 'Duración de anuncio COD', `${F.fmtS(total)} (ideal 25–40 s)`) : add('warn', 'Duración fuera de 25–40 s', `Dura ${F.fmtS(total)}. Usa «Ajustar a duración objetivo».`);
    else if (g.target) Math.abs(total - g.target) <= g.target * 0.15 ? add('ok', 'Duración cerca del objetivo', F.fmtS(total)) : add('warn', 'Duración lejos del objetivo', `Dura ${F.fmtS(total)} y el objetivo es ${g.target} s.`);
    /* ritmo */
    const slow = p.clips.map((c, i) => ({ c, i })).filter(({ c }) => c.duration > 6);
    slow.length ? add('warn', 'Planos largos', `Clips ${slow.map((x) => x.i + 1).join(', ')} duran más de 6 s: divídelos (S) o cambia el encuadre. Cada 10 s no es ritmo, es ruido.`) : add('ok', 'Ritmo de cortes correcto');
    const hi = p.clips.filter((c) => (c.motionAmt || 0) > 0.25 && c.motion !== 'none');
    hi.length && add('warn', 'Punch-in sobre el tope de 125 %', `${hi.length} clip(s) con intensidad mayor a 25%.`);
    /* audio */
    const voz = p.audio.filter((a) => a.kind !== 'musica'), mus = p.audio.filter((a) => a.kind === 'musica');
    !voz.length ? add('warn', 'Sin voz ni narración', 'El audio de cámara define el 80% del resultado.') : add('ok', 'Hay pista de voz');
    voz.length && mus.length && !p.duck ? add('warn', 'La música puede tapar la voz', 'Activa «Bajar la música cuando habla la voz» (−12 dB).') : mus.length && add('ok', 'Música con ducking');
    return res;
  };

  /** Reporte de cortes: en qué segundo quedó cada clip + silencios descartados. */
  G.cutReport = (p) => {
    const { items } = R.layout(p), g = gd(p);
    let h = `<table class="gtab"><tr><th>#</th><th>Entra</th><th>Sale</th><th>Texto</th></tr>${items.map((it, i) => `<tr><td>${i + 1}</td><td>${fmt(it.start)}</td><td>${fmt(it.end)}</td><td>${F.esc(it.clip.text || '—')}</td></tr>`).join('')}</table>`;
    if (g.lastCut) h += `<p class="small" style="margin-top:10px"><b>Silencios quitados de «${F.esc(g.lastCut.audio)}»</b>: ${g.lastCut.cuts.length} cortes · ${g.lastCut.removed} s menos (de ${g.lastCut.before} s a ~${g.lastCut.after} s).</p><div class="small muted">${g.lastCut.cuts.map(([s, e]) => `${fmt(s)}–${fmt(e)}`).join(' · ')}</div>${g.lastCut.dropped?.length ? `<p class="small" style="margin-top:8px"><b>Frases descartadas:</b> ${g.lastCut.dropped.map((x) => '«' + F.esc(x) + '»').join(' · ')}</p>` : ''}`;
    else h += `<p class="small muted" style="margin-top:10px">No se han cortado silencios de la voz todavía.</p>`;
    return h;
  };

  G.openReview = (E) => {
    const res = G.review(E.p), ic = { ok: '✅', warn: '⚠️', bad: '❌' }, bad = res.filter((x) => x.lvl === 'bad').length, warn = res.filter((x) => x.lvl === 'warn').length;
    F.modal({
      title: 'Revisión Golden', wide: true,
      body: `<div class="pill" style="margin-bottom:10px">${bad ? `${bad} por corregir` : warn ? `${warn} avisos` : 'Todo en orden'}</div>
      <div class="grev">${res.map((x) => `<div class="gr ${x.lvl}"><span>${ic[x.lvl]}</span><div><b>${F.esc(x.t)}</b>${x.d ? `<div class="small muted">${F.esc(x.d)}</div>` : ''}</div></div>`).join('')}</div>
      <h4 style="margin:16px 0 6px">Reporte de cortes</h4><div class="small muted" style="margin-bottom:6px">Antes de exportar mira en qué segundo quedó cada corte y qué se descartó.</div>${G.cutReport(E.p)}
      <p class="hint" style="margin-top:12px">Falta lo que la máquina no decide: si lo que dices merece existir, y dónde va el silencio que incomoda. Mira el video entero con el sonido apagado antes de publicar.</p>` ,
    });
  };

  G.openGuide = () => F.modal({
    title: 'Guía Golden del editor', wide: true,
    body: `<div class="gguide">
    <h4>Ley de orden: Cortar → Subtitular → Ilustrar → Sonorizar</h4>
    <ol><li><b>Cortar</b> fija la línea de tiempo; todo lo demás se ubica contra esos cortes.</li><li><b>Subtitular</b> va contra el video ya cortado. Al revés se rehace el trabajo y los subtítulos quedan desfasados (el error más caro).</li><li><b>Ilustrar (b-roll)</b> donde se NOMBRA algo: escena de objeto, no stock genérico, menos de 1 s.</li><li><b>Sonorizar</b> al final: el sonido reacciona a lo ya montado y no cae justo donde cae el corte.</li></ol>
    <h4>Antes de editar</h4><ul><li>Audio de cámara o micrófono, no de celular a 3 metros: define el 80% del resultado.</li><li>El guion <b>como se grabó</b>, no el que se escribió.</li><li>Look fijado (color, tipografía, color del resaltado) para que la grilla no se vea desprolija.</li><li>Truco al grabar: 3 segundos de silencio al inicio para medir el ruido ambiente.</li><li>Claims permitidos y prohibidos del producto: jamás se edita a ciegas. Un claim malo tumba el anuncio en Meta.</li></ul>
    <h4>Reglas de corte</h4><ul><li>El corte cae en el silencio; si no hay silencio, no se corta.</li><li>Nunca cortes la primera ni la última palabra de una frase.</li><li>Deja 200 ms de aire entre frases (cortar de más suena robótico).</li><li>Si dudas entre cortar o dejar, deja. De las tomas repetidas, quédate con la segunda.</li><li>Un crudo de 1:40 baja a ~58 s. Si queda en 1:20, el ruido de fondo impidió detectar silencios.</li><li>Plano fijo largo: cambia el encuadre cuando cambia la idea (punch-in al 113%, tope 125%). Cada 10 s no es ritmo, es ruido.</li></ul>
    <h4>Subtítulos</h4><ul><li>Palabra por palabra, máximo 3 palabras en pantalla, mayúsculas, alto contraste.</li><li>Español de Colombia. Sin signos de apertura (¿ ¡), solo de cierre. Sin CTA en inglés.</li></ul>
    <h4>Sonido</h4><ul><li>Música con ducking: 12 dB abajo cuando hay voz.</li><li>Efectos desacoplados del corte.</li></ul>
    <h4>Verificación (botón «Revisión Golden»)</h4><ul><li>Prueba del sonido apagado: el 85% ve sin sonido. Si necesitas el audio para entender, faltan cortes o b-roll.</li><li>El primer segundo frena el scroll; el gancho pega en los primeros 3 s.</li><li>Ningún claim prohibido en subtítulos ni textos. Formato y duración correctos (anuncio COD: 25–40 s).</li></ul>
    <h4>Lo que la máquina no decide</h4><p>Qué se dice y en qué orden, dónde va el silencio que incomoda y si la pieza merecía existir. La herramienta baja el costo de producir, no el de tener algo que decir.</p></div>`,
  });

  /* =========================================================
     Panel de la pestaña «Golden» del editor
     ========================================================= */
  G.panel = (bin, E) => {
    const p = E.p, g = gd(p), D = DESTINOS[g.destino] || DESTINOS.meta;
    const vozSel = E.selType === 'audio' ? p.audio.find((a) => a.id === E.sel) : p.audio.find((a) => a.kind !== 'musica');
    const step = (n, t, inner) => `<div class="gstep"><div class="gh"><span class="gn">${n}</span><b>${t}</b></div>${inner}</div>`;
    bin.innerHTML = `<div class="gold">
      <button class="btn primary auto-btn" data-g="auto">${I('wand')} Editar automático<small>Corta, subtitula, da ritmo y revisa con un clic</small></button>
      <div class="small muted" style="text-align:center">o hazlo a mano, paso a paso:</div>
      <div class="row" style="gap:6px;margin-bottom:8px"><button class="btn sm primary" data-g="review" style="flex:1">${I('check')} Revisión Golden</button><button class="btn sm" data-g="guide" title="Reglas y método">${I('eye')} Guía</button></div>
      ${step('0', 'Intake', `<label class="lbl">Productos guardados</label><div class="row" style="gap:6px"><select data-gf="prodPick" id="gProd" style="flex:1"><option value="">— elegir producto —</option>${prods().map((x) => `<option value="${x.id}">${F.esc(x.name)}</option>`).join('')}</select><button class="btn sm" data-g="prodDel" title="Borrar el producto elegido">${I('trash')}</button></div>
        <label class="lbl">Destino</label><select data-gf="destino">${Object.entries(DESTINOS).map(([k, v]) => `<option value="${k}" ${g.destino === k ? 'selected' : ''}>${v.n}</option>`).join('')}</select>
        <label class="lbl">Producto</label><input type="text" data-gf="producto" value="${F.esc(g.producto)}" placeholder="Nombre del producto">
        <label class="lbl">Claims prohibidos (uno por línea)</label><textarea rows="3" data-gf="claimsNo" placeholder="Ej: cura, garantizado, elimina la calvicie">${F.esc(g.claimsNo)}</textarea>
        <button class="btn sm" data-g="prodSave">${I('save')} Guardar producto y sus claims</button>
        <label class="lbl">Claims permitidos</label><textarea rows="2" data-gf="claimsOk" placeholder="Lo que sí se puede decir">${F.esc(g.claimsOk)}</textarea>
        <label class="lbl">Duración objetivo (s)</label><input type="number" min="0" step="1" data-gf="target" value="${g.target || ''}">`)}
      ${step('1', 'Cortar', `<label class="lbl">Motor de transcripción</label><select data-gf="engine" id="gEng"><option value="local">Local en el navegador (gratis, sin claves)</option><option value="openai">Whisper de OpenAI (clave propia)</option></select>
        <button class="btn sm primary" data-g="tcut" ${vozSel ? '' : 'disabled'}>${I('scissors')} Cortar con transcripción (pausas, muletillas, repetidas)</button>
        <button class="btn sm" data-g="silence" ${vozSel ? '' : 'disabled'}>${I('scissors')} Solo silencios (por volumen)</button>
        <div class="small muted">${vozSel ? 'Voz: ' + F.esc(F.media.byId(vozSel.mediaId)?.name || '') : 'Añade una pista de voz'} · deja 200 ms de aire</div>
        <label class="lbl">Silencio mínimo a cortar</label><select data-gf="minSil" id="gMinSil"><option value="0.4">0,4 s (agresivo)</option><option value="0.6">0,6 s (recomendado)</option><option value="1">1 s (suave)</option></select>
        <button class="btn sm" data-g="multicam">${I('film')} Multicámara (alternar encuadres)</button>
        <button class="btn sm" data-g="fit">${I('clock')} Ajustar a duración objetivo</button>`)}
      ${step('2', 'Subtitular', `<button class="btn sm primary" data-g="acap" ${vozSel ? '' : 'disabled'}>${I('type')} Subtítulos desde el audio (sincronizados)</button><div class="small muted">O sin audio, desde el guion:</div><label class="lbl">Guion como se grabó</label><textarea rows="4" data-gf="script" placeholder="Pega aquí el guion tal como lo dijiste">${F.esc(g.script)}</textarea>
        <button class="btn sm" data-g="captions">${I('type')} Repartir como subtítulos (máx. 3 palabras)</button>
        <button class="btn sm" data-g="clean">${I('wand')} Limpiar textos (sin ¿ ¡)</button>`)}
      ${step('3', 'Ilustrar', `<div class="small muted" style="line-height:1.5">Pon una imagen cada vez que el guion NOMBRE algo: objeto sobre fondo negro, no stock, menos de 1 s. Usa el producto real, nunca redibujado. Arrastra la imagen al timeline y divide con <kbd>S</kbd>.</div>`)}
      ${step('4', 'Sonorizar', `<label class="check"><input type="checkbox" data-gf="duck" ${p.duck ? 'checked' : ''}> Bajar la música 12 dB cuando habla la voz</label><div class="small muted">Los efectos van desacoplados del corte.</div>`)}
      ${step('6', 'Empaquetar el estilo', `<div class="small muted">Cuando el resultado te guste, guárdalo con el nombre del cliente. La próxima vez, un clic.</div>
        <button class="btn sm" data-g="styleSave">${I('save')} Guardar el estilo de este video</button>
        <div class="row" style="gap:6px"><select id="gStyle" style="flex:1"><option value="">— estilos guardados —</option>${styles().map((x) => `<option value="${x.id}">${F.esc(x.name)}</option>`).join('')}</select><button class="btn sm" data-g="styleDel" title="Borrar el estilo elegido">${I('trash')}</button></div>
        <button class="btn sm primary" data-g="styleApply">${I('wand')} Aplicar el estilo elegido</button>`)}
    </div>`;
    G.afterPanel(bin); G.bind(bin, E);
  };

  G.afterPanel = (bin) => { const s = bin.querySelector('#gMinSil'); if (s) s.value = String(G.minSil || 0.6); const en = bin.querySelector('#gEng'); if (en) en.value = F.transcribe?.engine() || 'local'; };
  G.bind = (bin, E) => {
    if (bin._gb) return; bin._gb = true;
    bin.addEventListener('change', (e) => {
      const f = e.target.dataset.gf; if (!f || !E.p) return;
      const p = E.p, g = gd(p);
      if (f === 'minSil') return void (G.minSil = +e.target.value);
      if (f === 'engine') return void F.transcribe.setEngine(e.target.value);
      if (f === 'prodPick') return void (e.target.value && G.loadProduct(E, e.target.value));
      if (f === 'duck') { E.api.commit(); p.duck = e.target.checked; E.api.after({ insp: true }); return; }
      g[f] = f === 'target' ? +e.target.value || 0 : e.target.value;
      if (f === 'destino') {
        const D = DESTINOS[g.destino]; g.target = D.target; g.destinoSet = true; E.api.commit();
        p.aspect = D.aspect; E.api.setAspect?.(); E.api.after({ insp: true }); E.api.renderBin();
      }
      E.api.save();
    });
    bin.addEventListener('click', (e) => {
      const b = e.target.closest('[data-g]'); if (!b || !E.p) return; const a = b.dataset.g, p = E.p, g = gd(p);
      const sel = (id) => bin.querySelector(id)?.value || '';
      if (a === 'auto') G.auto(E);
      else if (a === 'prodSave') G.saveProduct(E).then(() => E.api.renderBin());
      else if (a === 'prodDel') { const v = sel('#gProd'); if (!v) return F.toast('Elige un producto guardado'); G.delProduct(v); E.api.renderBin(); }
      else if (a === 'styleSave') G.saveStyle(E);
      else if (a === 'styleApply') G.applyStyle(E, sel('#gStyle'));
      else if (a === 'styleDel') { const v = sel('#gStyle'); if (!v) return F.toast('Elige un estilo guardado'); G.delStyle(v); E.api.renderBin(); }
      else if (a === 'review') G.openReview(E);
      else if (a === 'guide') G.openGuide();
      else if (a === 'silence') { const v = E.selType === 'audio' ? E.sel : p.audio.find((x) => x.kind !== 'musica')?.id; b.disabled = true; G.cleanSilence(E, v, G.minSil || 0.6).catch((er) => F.toast('No se pudo analizar el audio: ' + er.message, 'error')).finally(() => (b.disabled = false)); }
      else if (a === 'tcut' || a === 'acap') {
        const v = E.selType === 'audio' ? E.sel : p.audio.find((x) => x.kind !== 'musica')?.id, label = b.innerHTML; b.disabled = true;
        const prog = (t) => { b.textContent = t; };
        (a === 'tcut' ? G.cleanByTranscript(E, v, G.minSil || 0.6, prog) : G.captionsFromAudio(E, v, prog))
          .catch((er) => F.toast(er.message || String(er), 'error', 6000)).finally(() => { b.innerHTML = label; b.disabled = false; });
      }
      else if (a === 'multicam') G.multicam(E);
      else if (a === 'fit') G.fitTarget(E, g.target);
      else if (a === 'captions') G.scriptToCaptions(E, g.script);
      else if (a === 'clean') G.cleanAll(E);
    });
  };
})();
