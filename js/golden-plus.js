/* FRAMALY — Método Golden, parte 2: lo que completa la skill del editor de video.
   Reparto de cámaras por ideas, corte en el silencio más cercano, b-roll por palabra,
   efectos de sonido desacoplados, estilo desde capturas, prompts de fondos y trampas de montaje.
   Todo local, sin IA. */
(function () {
  'use strict';
  const R = F.R, I = F.icon, G = F.golden;
  if (!G) return;
  const key = (s) => G.norm(s).replace(/[^a-z0-9ñ]/g, '');
  const voiceOf = (p) => p.audio.find((a) => a.kind === 'voz' && !a.loop);
  const hex = (r, g, b) => '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  const cat = (c) => !c ? 'otro' : c.motion === 'none' ? 'frontal' : ['panL', 'panR', 'panU', 'panD'].includes(c.motion) ? 'lateral' : c.motion === 'zoomIn' && (c.motionAmt || 0) >= 0.2 ? 'closeup' : 'otro';

  /* =========================================================
     Silencios candidatos (para que el corte caiga en una pausa)
     ========================================================= */
  const silCache = {};
  /** puntos de pausa en segundos del TIMELINE: [{t, len}] */
  G.pausePoints = async (E, a) => {
    const g = G.gd(E.p), words = g.tr?.[a.mediaId], off = a.start || 0, out = [];
    if (words && words.length) {
      for (let i = 0; i + 1 < words.length; i++) { const gap = words[i + 1].s - words[i].e; if (gap >= 0.1) out.push({ t: off + words[i].e + gap / 2, len: gap }); }
      return out;
    }
    if (!silCache[a.mediaId]) silCache[a.mediaId] = G.findSilences(await F.media.decode(a.mediaId), { minSil: 0.2 }).sil;
    return silCache[a.mediaId].map(([s, e]) => ({ t: off + (s + e) / 2, len: e - s }));
  };
  /** Regla de la skill: el corte cae en el silencio más cercano dentro de 1,5 s; si no hay, NO se corta. */
  G.nearestPause = (pts, t, win = 1.5) => {
    let best = null; for (const x of pts) { const d = Math.abs(x.t - t); if (d <= win && (!best || d < best.d)) best = { t: x.t, d }; }
    return best ? best.t : null;
  };

  /* =========================================================
     Cortar un clip en un instante (sin perder duración total)
     ========================================================= */
  G.splitClipAt = (p, t, minEdge = 0.5) => {
    const it = R.layout(p).items.find((x) => t > x.start + minEdge && t < x.end - minEdge); if (!it) return false;
    const c = it.clip, n = { ...c, id: F.uid(), duration: F.round1(it.end - t), text: '', capTimes: undefined };
    n.transition = c.transition; c.duration = F.round1(t - it.start); c.transition = 'none'; delete c.capTimes;
    p.clips.splice(p.clips.indexOf(c) + 1, 0, n); return true;
  };

  /* =========================================================
     REPARTO DE CÁMARAS POR IDEAS
     bloque = una idea · frontal: hook, promesa, CTA · lateral: narración · closeup: la frase corta
     ========================================================= */
  G.ideaBlocks = (E) => {
    const p = E.p, g = G.gd(p), v = voiceOf(p), total = E.api.total(), words = v && g.tr?.[v.mediaId], off = v?.start || 0;
    let cuts = [];   // instantes del timeline donde cambia la idea
    if (words && words.length) {
      G.markBreaks(words);
      for (let i = 1; i < words.length; i++) if (words[i].brk) cuts.push(off + words[i - 1].e + Math.max(0, words[i].s - words[i - 1].e) / 2);
    } else if (g.script && g.script.trim()) {
      const ss = g.script.split(/(?<=[.!?…])\s+/).filter(Boolean), len = ss.reduce((t, s) => t + s.length, 0); let acc = 0;
      ss.slice(0, -1).forEach((s) => { acc += s.length; cuts.push((acc / len) * total); });
    } else { const step = Math.max(6, total / 5); for (let t = step; t < total - 3; t += step) cuts.push(t); }
    const minLen = total > 120 ? 20 : total > 45 ? 4 : 2.5;   // en videos largos el cambio es cada ~1:30; en un anuncio, cada idea
    const edges = [0]; cuts.sort((a, b) => a - b).forEach((t) => { if (t - edges[edges.length - 1] >= minLen && total - t >= minLen * 0.6) edges.push(t); });
    edges.push(total);
    return edges.slice(0, -1).map((s, i) => ({ s, e: edges[i + 1], words: words ? words.filter((w) => off + w.s >= s && off + w.s < edges[i + 1]).length : 0 }));
  };
  G.cameraRoles = (blocks, total) => {
    const n = blocks.length, roles = blocks.map((b, i) => (i === 0 || (i === 1 && n >= 4) || (i === n - 1 && n >= 2)) ? 'frontal' : 'lateral');
    const cand = blocks.map((b, i) => ({ i, d: b.e - b.s, w: b.words })).filter((x) => roles[x.i] === 'lateral' && (x.d <= 3 || (x.w && x.w <= 4)));
    cand.sort((a, b) => a.d - b.d); cand.slice(0, Math.max(1, Math.floor(total / 180))).forEach((x) => (roles[x.i] = 'closeup'));   // el closeup no se reparte: se pide
    return roles;
  };
  G.assignCameras = async (E) => {
    const p = E.p, v = voiceOf(p); if (!p.clips.length) throw new Error('Añade imágenes al timeline');
    const total = E.api.total(), blocks = G.ideaBlocks(E), pts = v ? await G.pausePoints(E, v) : null;
    E.api.commit();
    for (let i = 1; i < blocks.length; i++) {   // parte los clips donde cambia la idea, en el silencio más cercano
      let t = blocks[i].s;
      if (pts) { const snap = G.nearestPause(pts, t, 1.5); if (snap === null) continue; t = snap; }   // sin silencio cerca: NO se corta
      G.splitClipAt(p, F.round1(t), 0.5);
    }
    const roles = G.cameraRoles(blocks, total), items = R.layout(p).items, latIdx = {}; let latN = 0;
    const blockOf = (t) => Math.max(0, blocks.findIndex((b) => t >= b.s && t < b.e));
    items.forEach((it) => {
      const bi = blockOf((it.start + it.end) / 2), role = roles[bi] || 'frontal', c = it.clip;
      if (role === 'frontal') { c.motion = 'none'; c.motionAmt = 0.15; }
      else if (role === 'closeup') { c.motion = 'zoomIn'; c.motionAmt = 0.25; }            // tope duro: 125 %
      else { if (!(bi in latIdx)) latIdx[bi] = latN++; c.motion = latIdx[bi] % 2 ? 'panL' : 'panR'; c.motionAmt = 0.13; }   // entra al 113 %
    });
    G.gd(p).cameraPlan = true; E.api.after({ insp: true });
    return { blocks: blocks.length, closeups: roles.filter((r) => r === 'closeup').length, source: v && G.gd(p).tr?.[v.mediaId] ? 'la transcripción' : G.gd(p).script ? 'el guion' : 'el tiempo' };
  };

  /* =========================================================
     B-ROLL donde se nombra algo (objeto sobre negro, <1 s)
     ========================================================= */
  G.overlay = (p, t, dur, mediaId) => {
    const it = R.layout(p).items.find((x) => t >= x.start && t < x.end - 0.05); if (!it) return false;
    const c = it.clip, t0 = Math.max(it.start, t), t1 = Math.min(it.end, t0 + dur), M = 0.3;
    let before = t0 - it.start, mid = t1 - t0, after = it.end - t1;
    if (before < M) { mid += before; before = 0; } if (after < M) { mid += after; after = 0; }
    const mk = (d, o = {}) => ({ ...c, id: F.uid(), duration: F.round1(d), transition: 'none', capTimes: undefined, ...o });
    const segs = [];
    if (before) segs.push(mk(before, { text: c.text }));
    segs.push(mk(mid, { mediaId, fit: 'black', motion: 'none', text: '' }));
    if (after) segs.push(mk(after, { text: '' }));
    segs[segs.length - 1].transition = c.transition;
    if (!before) segs[0].id = c.id;   // conserva la identidad del clip original
    p.clips.splice(p.clips.indexOf(c), 1, ...segs); F.media.image(mediaId).catch(() => {}); return true;
  };
  G.brollRun = async (E, prog) => {
    const p = E.p, g = G.gd(p), list = g.broll || [], v = voiceOf(p);
    if (!list.length) return { st: 'skip', note: 'No hay palabras de b-roll. Agrégalas en Ilustrar.' };
    if (!v) return { st: 'skip', note: 'Sin voz: no se sabe cuándo se nombra cada cosa.' };
    const words = g.tr?.[v.mediaId] || await G.transcribe(E, v.id, prog); if (!words) return { st: 'skip' };
    E.api.commit(); let n = 0, last = -9;
    for (const w of words) {
      const e = list.find((x) => { const a = key(x.word), b = key(w.w); return a.length >= 3 && (a === b || (b.startsWith(a) && b.length <= a.length + 2)); });
      const t = (v.start || 0) + w.s; if (!e || t - last < 1.5) continue;
      if (G.overlay(p, t, 0.8, e.mediaId)) { n++; last = t; }
    }
    E.api.after({ insp: true });
    return n ? { note: `${n} b-roll de menos de 1 s donde se nombra algo` } : { st: 'warn', note: 'Ninguna de tus palabras aparece en la voz.' };
  };
  function pickImage() {
    const imgs = F.media.images(); if (!imgs.length) { F.toast('No hay imágenes en la biblioteca'); return Promise.resolve(null); }
    return new Promise((res) => {
      const m = F.modal({ title: 'Elegir imagen del objeto', wide: true, onClose: () => res(null), body: `<div class="img-grid">${imgs.map((x) => `<div class="tile wide" data-pick="${x.id}" style="cursor:pointer"><img src="${F.media.url(x)}" alt=""></div>`).join('')}</div>` });
      m.el.addEventListener('click', (e) => { const t = e.target.closest('[data-pick]'); if (t) { res(t.dataset.pick); m.close(); } });
    });
  }

  /* =========================================================
     EFECTOS DE SONIDO — generados aquí, desacoplados del corte
     ========================================================= */
  async function synth(kind) {
    const sr = 44100, len = { pop: 0.18, whoosh: 0.5, ding: 1.1 }[kind], oc = new OfflineAudioContext(1, Math.ceil(sr * len), sr), g = oc.createGain();
    g.connect(oc.destination);
    if (kind === 'pop') {
      const o = oc.createOscillator(); o.frequency.setValueAtTime(900, 0); o.frequency.exponentialRampToValueAtTime(260, 0.09);
      g.gain.setValueAtTime(0.7, 0); g.gain.exponentialRampToValueAtTime(0.001, 0.12); o.connect(g); o.start(0); o.stop(0.18);
    } else if (kind === 'whoosh') {
      const b = oc.createBuffer(1, Math.ceil(sr * 0.5), sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = oc.createBufferSource(), f = oc.createBiquadFilter(); s.buffer = b; f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(300, 0); f.frequency.exponentialRampToValueAtTime(3500, 0.35);
      g.gain.setValueAtTime(0.001, 0); g.gain.linearRampToValueAtTime(0.6, 0.18); g.gain.linearRampToValueAtTime(0.001, 0.48); s.connect(f).connect(g); s.start(0);
    } else {
      g.gain.setValueAtTime(0.6, 0); g.gain.exponentialRampToValueAtTime(0.001, 1.0);
      [[1318.5, 1], [2637, 0.35]].forEach(([fr, v]) => { const o = oc.createOscillator(), h = oc.createGain(); o.frequency.value = fr; h.gain.value = v; o.connect(h).connect(g); o.start(0); o.stop(1.1); });
    }
    return G.wav([(await oc.startRendering()).getChannelData(0)], sr);
  }
  const NAMES = { pop: 'Efecto · pop', whoosh: 'Efecto · whoosh', ding: 'Efecto · ding' };
  async function sfxMedia(kind) {
    return F.media.list.find((m) => m.source === 'sfx' && m.meta?.sfx === kind) || await F.media.add({ type: 'audio', name: NAMES[kind], blob: await synth(kind), source: 'sfx', meta: { sfx: kind } });
  }
  G.placeSfx = async (E) => {
    const p = E.p; if (!p.clips.length) throw new Error('Añade imágenes al timeline');
    const { items } = R.layout(p), DEC = 0.18, ev = [];   // DEC: el efecto cae un poco DESPUÉS del corte, no sobre el tijeretazo
    items.forEach((it, i) => {
      const c = it.clip, last = i === items.length - 1;
      if (c.fit === 'black') ev.push(['pop', it.start + 0.12]);
      else if (c.text && !last) ev.push(['pop', it.start + 0.2]);
      if (last && c.text) ev.push(['ding', it.start + 0.4]);
      if (!last && c.transition && c.transition !== 'none') ev.push(['whoosh', it.end + DEC]);
    });
    ev.sort((a, b) => a[1] - b[1]); const keep = []; let lastT = -9;
    for (const e of ev) if (e[1] - lastT >= 1) { keep.push(e); lastT = e[1]; }
    const media = {}; for (const k of new Set(keep.map((e) => e[0]))) media[k] = await sfxMedia(k);
    E.api.commit(); p.audio = p.audio.filter((a) => a.kind !== 'sfx');
    keep.forEach(([k, t]) => p.audio.push({ id: F.uid(), mediaId: media[k].id, start: F.round1(t), volume: k === 'ding' ? 0.3 : 0.35, loop: false, fadeOut: false, kind: 'sfx' }));
    E.api.after({ insp: true }); return keep.length;
  };

  /* =========================================================
     ESTILO DE REFERENCIA desde capturas (se destila, no se clona)
     ========================================================= */
  G.analyzeImage = (img) => {
    const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, S, S); const d = cx.getImageData(0, 0, S, S).data, n = S * S, L = new Float32Array(n);
    let sr = 0, sg = 0, sb = 0, sat = 0; const buckets = {};
    for (let i = 0; i < n; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      L[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; sr += r; sg += g; sb += b; sat += mx ? (mx - mn) / mx : 0;
      const k = [r >> 5, g >> 5, b >> 5].join(','); (buckets[k] ||= { c: 0, r: 0, g: 0, b: 0 }); const bk = buckets[k]; bk.c++; bk.r += r; bk.g += g; bk.b += b;
    }
    const mean = L.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(L.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const rowAvg = (y0, y1) => { let s = 0, c = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < S; x++) { s += L[y * S + x]; c++; } return s / c; };
    const center = (() => { let s = 0, c = 0; for (let y = 22; y < 42; y++) for (let x = 22; x < 42; x++) { s += L[y * S + x]; c++; } return s / c; })();
    const corners = (() => { let s = 0, c = 0; for (const [x0, y0] of [[0, 0], [54, 0], [0, 54], [54, 54]]) for (let y = y0; y < y0 + 10; y++) for (let x = x0; x < x0 + 10; x++) { s += L[y * S + x]; c++; } return s / c; })();
    const sw = Object.values(buckets).sort((a, b) => b.c - a.c).slice(0, 8).map((b) => [b.r / b.c, b.g / b.c, b.b / b.c]);
    return { luma: mean, contrast: sd, sat: sat / n, warm: (sr - sb) / n / 255, vig: Math.max(0, center - corners), bars: rowAvg(0, 5) < 0.04 && rowAvg(S - 5, S) < 0.04, swatches: sw };
  };
  G.styleFromStats = (all) => {
    const m = (k) => all.reduce((a, x) => a + x[k], 0) / all.length, luma = m('luma'), con = m('contrast'), sat = m('sat'), warm = m('warm'), vig = m('vig');
    let filter = 'cine';
    if (sat < 0.08) filter = con > 0.28 ? 'noir' : 'bn';
    else if (warm > 0.12 && sat > 0.3) filter = 'calido';
    else if (warm < -0.1) filter = 'frio';
    else if (sat > 0.55) filter = 'vivo';
    else if (luma < 0.32 && con > 0.25) filter = 'drama';
    else if (con < 0.14 && luma > 0.55) filter = 'suave';
    else if (vig < 0.04 && con < 0.2) filter = 'none';
    const all8 = all.flatMap((x) => x.swatches).filter(([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx > 40 && mn < 235 && (mx - mn) / mx > 0.25; });
    const accent = all8.sort((a, b) => (Math.max(...b) - Math.min(...b)) - (Math.max(...a) - Math.min(...a)))[0];
    const palette = [...new Set(all.flatMap((x) => x.swatches.slice(0, 3)).map(([r, g, b]) => hex(r, g, b)))].slice(0, 6);
    return { filter, textColor: accent ? hex(...accent) : '#ffffff', letterbox: all.filter((x) => x.bars).length > all.length / 2, palette, stats: { luma, con, sat, warm } };
  };
  G.referenceStyle = async (E) => {
    const files = await F.pickFiles('image/*'); if (!files.length) return;
    const stats = [];
    for (const f of files.slice(0, 6)) {
      const url = URL.createObjectURL(f);
      try { const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); stats.push(G.analyzeImage(img)); } catch (e) { /* captura ilegible */ }
      URL.revokeObjectURL(url);
    }
    if (!stats.length) return F.toast('No se pudieron leer las capturas', 'error');
    const st = G.styleFromStats(stats), fname = R.filters().find((x) => x.id === st.filter)?.name || st.filter;
    const m = F.modal({ title: 'Estilo de la referencia', wide: true,
      body: `<div class="row" style="gap:6px;margin-bottom:10px">${st.palette.map((c) => `<span title="${c}" style="width:42px;height:42px;border-radius:8px;background:${c};border:1px solid var(--line)"></span>`).join('')}</div>
      <p class="small">Filtro más parecido: <b>${F.esc(fname)}</b> · Color de texto: <b style="color:${st.textColor}">${st.textColor}</b> · Barras de cine: <b>${st.letterbox ? 'sí' : 'no'}</b></p>
      <p class="hint">Se destila, no se clona: solo se toma la paleta y el look. Tu video sale con identidad propia, nunca con la marca ajena. El ritmo de cortes no se puede leer de capturas fijas.</p>`,
      actions: [{ label: 'Cancelar' }, { label: 'Aplicar al proyecto', onClick: () => { G.applyLook(E, st); } }, { label: 'Aplicar y guardar estilo', primary: true, onClick: () => { G.applyLook(E, st); G.saveStyle(E); } }] });
    return m;
  };
  G.applyLook = (E, st) => {
    const p = E.p; if (!p.clips.length) return F.toast('Añade imágenes al timeline');
    E.api.commit(); p.clips.forEach((c) => { c.filter = st.filter; c.textColor = st.textColor; }); p.letterbox = st.letterbox;
    E.api.after({ insp: true }); F.toast('Look de la referencia aplicado', 'ok');
  };

  /* =========================================================
     PROMPTS de fondos para las tres cámaras (generador de imágenes)
     ========================================================= */
  G.bgPrompts = (room, accent) => {
    const block = `Photoreal interior of ${room || 'a [tu cuarto]'}, EMPTY of people.\nONE dominant light source enters from a side window or an overhead LED panel,\nwarm temperature (~3200K), with a second, dim fill light that never competes.\nONE accent color only: ${accent || '[hex]'}. It appears on no more than two objects in the room.\nSame room, same furniture, same light in every shot.\nNo text, no logos, no on-screen graphics.`;
    return [
      ['Frontal', 'Camera: FRONTAL, at eye height, medium shot, looking straight into the lens position. Centered composition, neutral background wall.'],
      ['Lateral', 'Camera: LATERAL, three-quarter view, farther from the subject position. The side wall is visible (it appears in neither of the other two shots) and one new object enters the frame: a door, the edge of a window or a piece of furniture. Subject position never looks at the lens.'],
      ['Closeup', 'Camera: CLOSE-UP, lower and closer than the frontal. Background softly out of focus (shallow depth of field).'],
    ].map(([n, extra]) => [n, `${block}\n${extra}`]);
  };
  G.openBgPrompts = () => {
    const m = F.modal({ title: 'Fondos para las 3 cámaras', wide: true,
      body: `<div class="grid2"><div><label class="lbl">Tu cuarto</label><input type="text" id="bgRoom" placeholder="a home office with a desk"></div><div><label class="lbl">Color de acento (hex)</label><input type="text" id="bgHex" placeholder="#ff6a1a"></div></div>
      <div id="bgOut" style="margin-top:10px"></div><p class="hint">El mismo bloque va idéntico arriba de los tres prompts: hace que el generador repita la misma habitación. «EMPTY of people» es el detalle que todos se saltan. Genera las imágenes en <a href="#/imagenes">Imágenes</a>.</p>` });
    const draw = () => { m.q('#bgOut').innerHTML = G.bgPrompts(m.q('#bgRoom').value.trim(), m.q('#bgHex').value.trim()).map(([n, t]) => `<label class="lbl">${n}</label><textarea rows="8" readonly onclick="this.select()">${F.esc(t)}</textarea>`).join(''); };
    m.el.addEventListener('input', draw); draw();
  };

  /* =========================================================
     Revisión: trampas de montaje y reglas del b-roll / closeup
     ========================================================= */
  G.plusReview = (p, add) => {
    const full = (c) => c.fit === 'black' || (c.text && c.textStyle === 'titulo'), bad1 = [], bad2 = [];
    p.clips.forEach((c, i) => {
      const a = p.clips[i - 1], b = p.clips[i + 1];
      if (full(c) && a && b && !full(a) && !full(b) && cat(a) !== cat(b) && cat(a) !== 'otro' && cat(b) !== 'otro') bad1.push(i + 1);
      if (b && c.transition === 'zoom' && ['zoomIn', 'kenburns'].includes(b.motion)) bad2.push(i + 1);
      if (G.gd(p).cameraPlan && ['kenburns', 'zoomOut'].includes(c.motion)) bad2.push(i + 1);
    });
    bad1.length ? add('warn', 'Cutaway encima de un cambio de cámara', `Clips ${bad1.join(', ')}: el espectador ve el gráfico y no el cambio. El cambio de encuadre debe verse con el sujeto en pantalla.`) : add('ok', 'Ningún cutaway a pantalla completa tapa un cambio de cámara');
    bad2.length ? add('warn', 'Zoom encima de zoom', `Clips ${[...new Set(bad2)].join(', ')}: dos sistemas acercándose se pelean. Apaga el movimiento propio o la transición de zoom.`) : add('ok', 'Sin zooms duplicados');
    let groups = 0, prev = false; p.clips.forEach((c) => { const cl = cat(c) === 'closeup'; if (cl && !prev) groups++; prev = cl; });
    const tot = R.layout(p).total;
    groups > Math.max(1, Math.floor(tot / 180)) && add('warn', 'Demasiados closeups', `Hay ${groups}. El closeup se pide, no se reparte: uno cada ~3 minutos.`);
    const longB = p.clips.map((c, i) => ({ c, i })).filter(({ c }) => c.fit === 'black' && c.duration > 1.2);
    longB.length && add('warn', 'B-roll de más de 1 s', `Clips ${longB.map((x) => x.i + 1).join(', ')}: el b-roll va en piezas de menos de un segundo.`);
  };

  /* =========================================================
     Piezas del panel y sus botones
     ========================================================= */
  G.plusCam = () => `<button class="btn sm primary" data-g="cams">${I('film')} Reparto de cámaras por ideas</button><div class="small muted">Frontal: hook, promesa y CTA · lateral: la narración · closeup: la frase corta. El encuadre cambia cuando cambia la idea.</div>`;
  G.plusBroll = (p) => {
    const list = G.gd(p).broll || [];
    return `${list.map((x, i) => { const m = F.media.byId(x.mediaId); return `<div class="row" style="gap:8px"><span class="bthumb" style="${m ? `background-image:url('${F.media.url(m)}')` : ''}"></span><b class="small" style="flex:1">${F.esc(x.word)}</b><button class="btn sm" data-g="brollDel" data-i="${i}">✕</button></div>`; }).join('')}
      <button class="btn sm" data-g="brollAdd">${I('plus')} Palabra + imagen del objeto</button>
      <button class="btn sm primary" data-g="brollRun" ${list.length ? '' : 'disabled'}>${I('image')} Insertar b-roll donde se nombra</button>
      <button class="btn sm" data-g="brollHere">${I('image')} B-roll aquí (en el cursor)</button>
      <div class="small muted" style="line-height:1.5">Objeto sobre fondo negro, menos de 1 s, nunca stock. Reemplaza ese instante sin mover la voz.</div>`;
  };
  G.plusSfx = () => `<button class="btn sm" data-g="sfx">${I('volume')} Colocar efectos de sonido</button><div class="small muted">Pop, whoosh y ding generados aquí. Caen un poco DESPUÉS del corte, no sobre el tijeretazo. Prueba el video con el botón de sonido apagado del reproductor.</div>`;
  G.plusExtra = () => `<button class="btn sm" data-g="refStyle">${I('eye')} Replicar estilo desde capturas</button><button class="btn sm" data-g="bgPrompts">${I('image')} Prompts de fondos para 3 cámaras</button>`;

  G.plusClick = (a, b, E) => {
    const p = E.p, g = G.gd(p), fail = (er) => F.toast(er.message || String(er), 'error', 6000), done = () => E.api.renderBin();
    if (a === 'cams') { b.disabled = true; G.assignCameras(E).then((r) => F.toast(`${r.blocks} ideas repartidas (desde ${r.source}). Frontal al inicio y al final, lateral en la narración${r.closeups ? ', 1 closeup' : ''}.`, 'ok', 5000)).catch(fail).finally(() => (b.disabled = false)); }
    else if (a === 'brollAdd') (async () => { const w = await F.prompt('Palabra que se nombra', '', 'Por ejemplo: producto, frasco, whatsapp'); if (!w) return; const id = await pickImage(); if (!id) return; (g.broll ||= []).push({ word: w.trim(), mediaId: id }); E.api.save(); done(); })();
    else if (a === 'brollDel') { (g.broll || []).splice(+b.dataset.i, 1); E.api.save(); done(); }
    else if (a === 'brollRun') { b.disabled = true; G.brollRun(E, (t) => (b.textContent = t)).then((r) => F.toast(r.note, r.st || 'ok', 4500)).catch(fail).finally(() => { b.disabled = false; done(); }); }
    else if (a === 'brollHere') (async () => { const id = await pickImage(); if (!id) return; E.api.commit(); if (!G.overlay(p, E.t, 0.8, id)) return F.toast('Coloca el cursor dentro de un clip'); E.api.after({ insp: true }); F.toast('B-roll puesto (0,8 s)', 'ok'); })();
    else if (a === 'sfx') { b.disabled = true; G.placeSfx(E).then((n) => F.toast(`${n} efectos colocados, desacoplados del corte`, 'ok')).catch(fail).finally(() => (b.disabled = false)); }
    else if (a === 'refStyle') G.referenceStyle(E).catch(fail);
    else if (a === 'bgPrompts') G.openBgPrompts();
    else return false;
    return true;
  };
})();
