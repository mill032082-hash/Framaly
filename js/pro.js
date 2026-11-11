/* FRAMALY — Editor PRO: modo AUTOMÁTICO y MANUAL (pestaña «Pro» del editor).
   Automático: pulido en un clic, color automático, igualar color, mezcla de audio, cortes al ritmo de la música y revisión técnica.
   Manual: corrección de color por clip, encuadre (zoom, posición, giro, espejo, opacidad), texto (tamaño y posición),
   velocidad de los videos, fundidos de audio, logo, fundido de entrada/salida, guías de zona segura, resolución de exportación y atajos. */
(function () {
  'use strict';
  const R = F.R, I = F.icon, esc = F.esc, Eng = F.Engine;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), r2 = (v) => Math.round(v * 100) / 100;
  const X = (F.pro = { mode: 'auto', guides: false, clip: null });
  try { X.mode = localStorage.getItem('framaly.proMode') || 'auto'; } catch (e) { /* sin memoria */ }

  const GR0 = { b: 0, c: 0, s: 0, t: 0, v: 0, bl: 0 };              // brillo, contraste, saturación, temperatura, viñeta, desenfoque
  const TF0 = { s: 1, x: 0, y: 0, r: 0, flip: false, op: 1 };       // zoom, posición, giro, espejo, opacidad
  const changed = (o, d) => !!o && Object.keys(d).some((k) => (o[k] ?? d[k]) !== d[k]);
  const isVid = (c) => F.media.byId(c.mediaId)?.type === 'video';

  /* =================== MOTOR: color, encuadre, texto, logo, fundidos, guías =================== */
  const prevDraw = R.drawClip;
  R.drawClip = (cx, clip, lt, W, H) => {
    const g = clip.grade, tf = clip.tf, hg = changed(g, GR0), ht = changed(tf, TF0);
    if (!hg && !ht) return prevDraw(cx, clip, lt, W, H);
    const text = clip.text, had = Object.prototype.hasOwnProperty.call(clip, '_filter'), pf = clip._filter;
    try {
      clip.text = '';
      if (hg) {
        const f = pf || R.filter(clip.filter), G = { ...GR0, ...g }, css = [f.css && f.css !== 'none' ? f.css : ''];
        if (G.b) css.push(`brightness(${r2(1 + G.b * 0.6)})`); if (G.c) css.push(`contrast(${r2(1 + G.c * 0.6)})`); if (G.s) css.push(`saturate(${r2(Math.max(0, 1 + G.s))})`);
        if (G.bl) css.push(`blur(${(G.bl * Math.min(W, H) * 0.02).toFixed(1)}px)`);
        clip._filter = { ...f, css: css.join(' ').trim() || 'none', vig: clamp((f.vig || 0) + (G.v || 0), 0, 0.95) };
      }
      if (ht) {
        const T = { ...TF0, ...tf };
        cx.save(); cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H); cx.globalAlpha = clamp(T.op, 0, 1);
        cx.translate(W / 2 + T.x * W, H / 2 + T.y * H); if (T.r) cx.rotate((T.r * Math.PI) / 180); cx.scale(T.s * (T.flip ? -1 : 1), T.s); cx.translate(-W / 2, -H / 2);
        prevDraw(cx, clip, lt, W, H); cx.restore();
      } else prevDraw(cx, clip, lt, W, H);
    } finally { clip.text = text; if (had) clip._filter = pf; else delete clip._filter; }
    if (hg && g.t) { cx.save(); cx.globalCompositeOperation = 'soft-light'; cx.globalAlpha = Math.min(0.6, Math.abs(g.t) * 0.55); cx.fillStyle = g.t > 0 ? '#ff8a1f' : '#2f8bff'; cx.fillRect(0, 0, W, H); cx.restore(); }
    if (text) R.drawText(cx, clip, lt, W, H);
  };

  const prevText = R.drawText;
  R.drawText = (cx, clip, lt, W, H) => {
    const s = clip.textSize || 1, dx = clip.textX || 0, dy = clip.textY || 0;
    if (s === 1 && !dx && !dy) return prevText(cx, clip, lt, W, H);
    const py = ['titulo', 'neon'].includes(clip.textStyle) ? H / 2 : H * 0.82;
    cx.save(); cx.translate(dx * W + W / 2, dy * H + py); cx.scale(s, s); cx.translate(-W / 2, -py);
    prevText(cx, { ...clip, textSize: 1, textX: 0, textY: 0 }, lt, W, H); cx.restore();
  };

  const prevOver = R.overlays;
  R.overlays = (cx, p, t, total, W, H) => {
    const L = p.logo;
    if (L?.mediaId) {
      const img = F.media.imgSync(L.mediaId);
      if (img && img.width) {
        const w = W * clamp(L.size ?? 0.16, 0.04, 0.6), h = (w * (img.naturalHeight || img.height)) / (img.naturalWidth || img.width), m = Math.min(W, H) * 0.04, pos = L.pos || 'tr';
        const x = pos.includes('l') ? m : pos.includes('c') ? (W - w) / 2 : W - w - m, y = pos.includes('t') ? m : pos.includes('m') ? (H - h) / 2 : H - h - m;
        cx.save(); cx.globalAlpha = clamp(L.op ?? 0.9, 0, 1); cx.drawImage(img, x, y, w, h); cx.restore();
      }
    }
    prevOver(cx, p, t, total, W, H);
    const fi = +p.fadeIn || 0, fo = +p.fadeOut || 0, a = Math.max(fi && t < fi ? 1 - t / fi : 0, fo && total - t < fo ? 1 - (total - t) / fo : 0);
    if (a > 0.003) { cx.save(); cx.globalAlpha = clamp(a, 0, 1); cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H); cx.restore(); }
  };

  const prevFrame = R.renderFrame;
  R.renderFrame = (cx, p, t, W, H, key = 'pv') => {
    const r = prevFrame(cx, p, t, W, H, key);
    if (key === 'pv' && X.guides) {   // solo en la vista previa: nunca salen en el video exportado
      cx.save(); cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = 1; cx.beginPath();
      for (const k of [1 / 3, 2 / 3]) { cx.moveTo(W * k, 0); cx.lineTo(W * k, H); cx.moveTo(0, H * k); cx.lineTo(W, H * k); } cx.stroke();
      const v = H > W, z = v ? [W * 0.06, H * 0.12, W * 0.8, H * 0.66] : [W * 0.05, H * 0.05, W * 0.9, H * 0.9];
      cx.setLineDash([8, 6]); cx.strokeStyle = '#ff6a1a'; cx.lineWidth = 2; cx.strokeRect(...z);
      cx.setLineDash([]); cx.fillStyle = '#ff6a1a'; cx.font = `600 ${Math.max(10, Math.min(W, H) * 0.028)}px Inter, sans-serif`; cx.textBaseline = 'bottom'; cx.fillText(v ? 'Zona segura (sin botones de TikTok / Reels)' : 'Zona segura de títulos', z[0] + 4, z[1] - 4);
      cx.restore();
    }
    return r;
  };

  /* exportación: resolución y calidad elegidas en el proyecto */
  const RES = { 720: 'HD 720p (rápido)', 1080: 'Full HD 1080p', 1440: '2K 1440p', 2160: '4K 2160p (exige un equipo potente)' };
  if (Eng?.exportVideo) {
    const base = Eng.exportVideo;
    Eng.exportVideo = async (p, o = {}) => {
      const res = +p.exportRes || 1080, orig = R.SIZES[p.aspect];
      if (p.logo?.mediaId) await F.media.image(p.logo.mediaId).catch(() => null);
      if (res !== 1080 && orig) { const k = res / 1080, ev = (n) => Math.round((n * k) / 2) * 2; R.SIZES[p.aspect] = [ev(orig[0]), ev(orig[1])]; }
      try { return await base(p, { ...o, quality: p.exportQ || o.quality }); } finally { if (orig) R.SIZES[p.aspect] = orig; }
    };
  }

  /* =================== AUTOMÁTICO =================== */
  const analyze = (img) => {
    const S = 48, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, S, S);
    const d = x.getImageData(0, 0, S, S).data, n = S * S, L = new Float32Array(n); let sat = 0, sr = 0, sb = 0, m = 0;
    for (let i = 0; i < n; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); L[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; m += L[i]; sat += mx ? (mx - mn) / mx : 0; sr += r; sb += b; }
    m /= n; let sd = 0; for (let i = 0; i < n; i++) sd += (L[i] - m) ** 2;
    return { luma: m, con: Math.sqrt(sd / n), sat: sat / n, warm: (sr - sb) / n / 255 };
  };
  const statsOf = async (p) => {
    const out = [];
    for (const c of p.clips) { let s = null; try { const img = await F.media.image(c.mediaId); if (img && (img.width || img.videoWidth)) s = analyze(img); } catch (e) { /* sin imagen */ } out.push(s); }
    return out;
  };
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

  /** Color automático. mode 'fix' = corrige cada clip · 'match' = además iguala todos al mismo tono */
  X.autoColor = async (E, mode = 'fix', quiet) => {
    const p = E.p; if (!p.clips.length) return F.toast('Añade primero imágenes o videos');
    const st = await statsOf(p), ok = st.filter(Boolean); if (!ok.length) return F.toast('No se pudieron leer las imágenes', 'error');
    const T = mode === 'match' ? { luma: clamp(med(ok.map((s) => s.luma)), 0.38, 0.58), con: clamp(med(ok.map((s) => s.con)), 0.18, 0.3), sat: clamp(med(ok.map((s) => s.sat)), 0.25, 0.5), warm: med(ok.map((s) => s.warm)) } : { luma: 0.48, con: 0.23, sat: 0.36 };
    if (!quiet) E.api.commit(); let n = 0;
    p.clips.forEach((c, i) => {
      const s = st[i]; if (!s) return;
      const g = { ...GR0, ...(c.grade || {}) };
      g.b = r2(clamp((T.luma - s.luma) * 1.3, -0.45, 0.45)); g.c = r2(clamp((T.con - s.con) * 2.2, -0.35, 0.5)); g.s = r2(clamp((T.sat - s.sat) * 1.2, -0.35, 0.45));
      if (mode === 'match') g.t = r2(clamp((T.warm - s.warm) * 2.2, -0.8, 0.8));
      c.grade = g; n++;
    });
    if (!quiet) { E.api.after({ insp: true }); E.api.renderBin(); F.toast(mode === 'match' ? `Color igualado en ${n} clips` : `Color corregido en ${n} clips`, 'ok'); }
    return n;
  };

  const rms = (buf) => { const d = buf.getChannelData(0); let s = 0, n = 0; for (let i = 0; i < d.length; i += 5) { const v = d[i]; if (Math.abs(v) > 0.012) { s += v * v; n++; } } return n ? Math.sqrt(s / n) : 0; };
  /** Mezcla automática: voz al mismo nivel, música de fondo con ducking y fundidos, efectos discretos */
  X.autoMix = async (E, quiet) => {
    const p = E.p; if (!p.audio.length) { if (!quiet) F.toast('No hay pistas de audio'); return null; }
    if (!quiet) E.api.commit(); const rep = { voz: 0, musica: 0, sfx: 0 };
    for (const a of p.audio) {
      if (a.kind === 'musica') { a.volume = 0.18; a.fadeOut = true; a.fadeIn = 1; rep.musica++; continue; }
      if (a.kind === 'sfx') { a.volume = Math.min(a.volume ?? 0.35, 0.35); rep.sfx++; continue; }
      try { const v = rms(await F.media.decode(a.mediaId)); if (v > 0) { a.volume = r2(clamp(0.13 / v, 0.4, 1.5)); rep.voz++; } } catch (e) { /* audio ilegible */ }
    }
    if (rep.musica && p.audio.some((a) => a.kind === 'voz')) p.duck = true;
    if (!quiet) { E.api.after({ insp: true }); F.toast(`Mezcla lista: ${rep.voz} voz, ${rep.musica} música${p.duck ? ' (baja 12 dB cuando hay voz)' : ''}`, 'ok', 4000); }
    return rep;
  };

  /** Detecta los pulsos de una canción (energía + autocorrelación). Devuelve { bpm, beats[] en segundos } */
  X.detectBeats = (buf) => {
    const d = buf.getChannelData(0), sr = buf.sampleRate, hop = Math.round(sr / 100), n = Math.floor(d.length / hop), env = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = i * hop, e = j + hop; j < e; j += 4) s += d[j] * d[j]; env[i] = Math.sqrt(s / (hop / 4)); }
    const on = new Float32Array(n); for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
    let best = 0, lag = 50; const N = Math.min(n, 100 * 60);
    for (let L = 33; L <= 86; L++) { let s = 0; for (let i = L; i < N; i++) s += on[i] * on[i - L]; s /= N - L; if (s > best) { best = s; lag = L; } }   // 70–180 pulsos/min
    if (!best) return { bpm: 0, beats: [] };
    let ph = 0, bs = -1; for (let o = 0; o < lag; o++) { let s = 0; for (let i = o; i < n; i += lag) s += on[i]; if (s > bs) { bs = s; ph = o; } }
    const beats = []; for (let i = ph; i < n; i += lag) beats.push(i / 100);
    return { bpm: Math.round(6000 / lag), beats };
  };
  /** Cortes al ritmo: cada cambio de clip cae en el pulso más cercano de la música */
  X.beatSync = async (E, quiet) => {
    const p = E.p, mus = p.audio.find((a) => a.kind === 'musica' && F.media.byId(a.mediaId));
    if (!mus) { if (!quiet) F.toast('Añade primero una pista de música (pestaña Audio)'); return null; }
    if (p.clips.length < 2) { if (!quiet) F.toast('Hacen falta al menos 2 clips'); return null; }
    const buf = await F.media.decode(mus.mediaId), { bpm, beats } = X.detectBeats(buf);
    if (beats.length < 4) { if (!quiet) F.toast('No encontré un ritmo claro en esa música', 'error'); return null; }
    const tot = R.layout(p).total, per = beats[1] - beats[0], s0 = mus.start || 0, grid = beats.map((b) => s0 + b).filter((t) => t < tot + per);
    for (let last = grid.length ? grid[grid.length - 1] : s0; last < tot && grid.length < 5000;) { last += per; grid.push(last); }   // si la música va en bucle, el pulso continúa
    if (!quiet) E.api.commit(); let t = 0, moved = 0;
    p.clips.forEach((c, i) => {
      if (i === p.clips.length - 1 || isVid(c) || c.capTimes) { t += c.duration; return; }   // los videos y los subtítulos sincronizados no se tocan
      const end = t + c.duration; let best = end, bd = 1e9; for (const b of grid) { const dd = Math.abs(b - end); if (dd < bd && b - t >= 0.6) { bd = dd; best = b; } }
      const nd = F.round1(best - t); if (Math.abs(nd - c.duration) >= 0.05 && nd >= 0.6) { c.duration = nd; moved++; }
      t += c.duration;
    });
    if (!quiet) { E.api.after({ insp: true }); F.toast(`Ritmo detectado: ${bpm} pulsos/min · ${moved} cortes movidos al pulso`, 'ok', 4500); }
    return { bpm, moved };
  };

  /** Revisión técnica antes de exportar */
  X.check = async (p) => {
    const out = [], add = (lv, t, d) => out.push({ lv, t, d }), { items, total } = R.layout(p), [W, H] = R.SIZES[p.aspect], k = (+p.exportRes || 1080) / 1080;
    if (!items.length) { add('bad', 'El proyecto no tiene clips', 'Añade imágenes o videos.'); return out; }
    const miss = p.clips.filter((c) => !F.media.byId(c.mediaId)).length; miss ? add('bad', `${miss} clip(s) sin imagen`, 'El archivo se borró de la Biblioteca. Elige otra imagen o quita el clip.') : add('ok', 'Todos los clips tienen su archivo');
    const low = []; for (const [i, c] of p.clips.entries()) { const m = F.media.byId(c.mediaId); if (!m || c.fit === 'black') continue; let w = m.meta?.w, h = m.meta?.h; if (!w) { try { const im = await F.media.image(c.mediaId); w = im.naturalWidth || im.videoWidth || im.width; h = im.naturalHeight || im.videoHeight || im.height; } catch (e) { continue; } } const z = c.tf?.s || 1; if (w && Math.max(w / (W * k), h / (H * k)) / z < 0.5) low.push(i + 1); }
    low.length ? add('warn', 'Imágenes de baja resolución', `Clips ${low.slice(0, 12).join(', ')}: se verán borrosas al exportar a ${Math.round(Math.min(W, H) * k)}p. Usa una imagen más grande o baja la resolución.`) : add('ok', 'Resolución suficiente en todos los clips');
    const fast = [], long = []; items.forEach((it, i) => { const c = it.clip, w = String(c.text || '').split(/\s+/).filter(Boolean).length; if (w && c.textAnim !== 'words' && w / c.duration > 3.6) fast.push(i + 1); if (!isVid(c) && c.duration > 8 && (c.motion || 'none') === 'none') long.push(i + 1); });
    fast.length ? add('warn', 'Texto demasiado largo para su duración', `Clips ${fast.slice(0, 12).join(', ')}: no da tiempo a leerlo (más de 3,5 palabras por segundo). Acorta el texto o alarga el clip.`) : add('ok', 'Los textos dan tiempo a leerse');
    long.length && add('warn', 'Planos largos sin movimiento', `Clips ${long.slice(0, 12).join(', ')}: más de 8 s quietos. Ponles un movimiento de cámara o divídelos.`);
    const off = p.clips.map((c, i) => (c.text && (Math.abs(c.textY || 0) > 0.3 || Math.abs(c.textX || 0) > 0.3 || (c.textSize || 1) > 1.8) ? i + 1 : 0)).filter(Boolean);
    off.length && add('warn', 'Texto cerca del borde', `Clips ${off.join(', ')}: activa las guías (tecla G) y comprueba que el texto queda dentro de la zona segura.`);
    let clip = 0; for (const a of p.audio) { try { const b = await F.media.decode(a.mediaId), d = b.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i += 11) pk = Math.max(pk, Math.abs(d[i])); if (pk * (a.volume ?? 1) > 1.02) clip++; } catch (e) { /* audio ilegible */ } }
    clip ? add('warn', 'Audio que satura', `${clip} pista(s) superan el máximo y pueden distorsionar. Baja su volumen o usa «Mezcla automática».`) : p.audio.length ? add('ok', 'Ninguna pista satura') : add('warn', 'Sin audio', 'El video no tiene voz ni música.');
    const voz = p.audio.some((a) => a.kind === 'voz'), mus = p.audio.some((a) => a.kind === 'musica');
    if (voz && mus && !p.duck) add('warn', 'La música puede tapar la voz', 'Activa «Bajar la música cuando habla la voz» (o pulsa «Mezcla automática»).');
    const aEnd = Math.max(0, ...p.audio.filter((a) => !a.loop).map((a) => (a.start || 0) + (F.media.byId(a.mediaId)?.duration || 0)));
    if (aEnd > total + 0.5) add('warn', 'El audio dura más que el video', `El audio termina en ${F.fmtS(aEnd)} y el video en ${F.fmtS(total)}: se cortará. Usa «Ajustar a narración» o añade clips.`);
    if (H > W && total > 180) add('warn', 'Largo para vertical', `Dura ${F.fmtS(total)}; Shorts y Reels funcionan mejor por debajo de 60–90 s.`);
    if (k > 1.4) add('warn', 'Exportación pesada', `Exportar a ${RES[p.exportRes] || p.exportRes} en tiempo real exige un equipo potente. Si el video sale a saltos, usa 1080p.`);
    return out;
  };
  X.openCheck = async (E) => {
    const list = await X.check(E.p), n = list.filter((x) => x.lv !== 'ok').length, ic = { ok: '✓', warn: '!', bad: '✗' };
    F.modal({ title: 'Revisión técnica', wide: true, body: `<p class="small ${n ? '' : 'muted'}">${n ? `<b>${n} punto(s) por revisar</b> antes de exportar.` : 'Todo en orden: listo para exportar.'}</p><div class="grev">${list.map((x) => `<div class="gr ${x.lv}"><span class="gi">${ic[x.lv]}</span><div><b>${esc(x.t)}</b>${x.d ? `<div class="small muted">${esc(x.d)}</div>` : ''}</div></div>`).join('')}</div>`, actions: [{ label: 'Cerrar', primary: true }] });
    return list;
  };

  /** Pulido automático: todo lo anterior en un clic (un solo «deshacer») */
  X.polish = async (E, b) => {
    const p = E.p; if (!p.clips.length) return F.toast('Añade primero imágenes o videos');
    b && F.busy(b, true, 'Puliendo…'); const done = [];
    try {
      E.api.commit();
      const nc = await X.autoColor(E, 'match', true); nc && done.push(`color igualado en ${nc} clips`);
      const mx = await X.autoMix(E, true); mx && done.push(`mezcla de audio (${mx.voz} voz, ${mx.musica} música)`);
      const hasVoice = p.audio.some((a) => a.kind === 'voz');
      if (!hasVoice) { const bs = await X.beatSync(E, true).catch(() => null); bs && done.push(`cortes al ritmo (${bs.bpm} pulsos/min)`); }
      if (!p.fadeIn) p.fadeIn = 0.4; if (!p.fadeOut) p.fadeOut = 0.6; done.push('fundido de entrada y salida');
      let still = 0; p.clips.forEach((c, i) => { if (!isVid(c) && c.fit !== 'black' && (c.motion || 'none') === 'none' && c.duration > 3) { c.motion = ['kenburns', 'zoomIn', 'panR', 'zoomOut'][i % 4]; still++; } }); still && done.push(`movimiento en ${still} planos quietos`);
      E.api.after({ insp: true }); E.api.renderBin();
    } finally { b && F.busy(b, false); }
    const list = await X.check(p), warn = list.filter((x) => x.lv !== 'ok');
    F.modal({ title: 'Pulido automático terminado', wide: true, body: `<p class="small"><b>Hecho:</b></p><ul class="small">${done.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>${warn.length ? `<p class="small"><b>Te queda revisar a mano:</b></p><div class="grev">${warn.map((x) => `<div class="gr ${x.lv}"><span class="gi">!</span><div><b>${esc(x.t)}</b><div class="small muted">${esc(x.d || '')}</div></div></div>`).join('')}</div>` : '<p class="small muted">La revisión técnica no encontró problemas.</p>'}<p class="hint">Un solo Ctrl+Z deshace todo el pulido.</p>`, actions: [{ label: 'Entendido', primary: true }] });
  };

  /* =================== MANUAL: herramientas =================== */
  const STYLE_KEYS = ['filter', 'grade', 'motion', 'motionAmt', 'transition', 'transDur', 'textStyle', 'textAnim', 'textColor', 'textSize', 'textX', 'textY', 'fit'];
  const sel = (E) => (E.selType === 'clip' ? E.p.clips.find((c) => c.id === E.sel) : null);
  const under = (E) => sel(E) || R.layout(E.p).items.find((it) => E.t >= it.start && E.t < it.end)?.clip || null;
  X.copyStyle = (E) => { const c = under(E); if (!c) return F.toast('Selecciona un clip'); X.clip = JSON.parse(JSON.stringify(Object.fromEntries(STYLE_KEYS.filter((k) => c[k] !== undefined).map((k) => [k, c[k]])))); F.toast('Estilo copiado. Selecciona otro clip y pulsa «Pegar estilo».', 'ok'); };
  X.pasteStyle = (E, all) => {
    if (!X.clip) return F.toast('Primero copia el estilo de un clip'); const tg = all ? E.p.clips : [under(E)].filter(Boolean); if (!tg.length) return F.toast('Selecciona un clip');
    E.api.commit(); tg.forEach((c) => { const s = JSON.parse(JSON.stringify(X.clip)); if (isVid(c)) { delete s.motion; delete s.motionAmt; } Object.assign(c, s); }); E.api.after({ insp: true }); E.api.renderBin(); F.toast(`Estilo pegado en ${tg.length} clip(s)`, 'ok');
  };
  /** Recorta el clip hasta el cursor: side 'start' quita lo de antes, 'end' quita lo de después */
  X.trim = (E, side) => {
    const p = E.p, it = R.layout(p).items.find((x) => E.t > x.start + 0.1 && E.t < x.end - 0.1); if (!it) return F.toast('Pon el cursor dentro de un clip');
    const c = it.clip, d1 = F.round1(E.t - it.start), rest = F.round1(c.duration - d1);
    if ((side === 'start' ? rest : d1) < 0.5) return F.toast('El clip quedaría demasiado corto (mínimo 0,5 s)');
    E.api.commit();
    if (side === 'start') { c.duration = rest; if (isVid(c)) c.vstart = F.round1((c.vstart || 0) + d1 * (c.speed || 1)); if (c.capTimes) c.capTimes = c.capTimes.map((x) => Math.max(0, F.round1(x - d1))); E.t = it.start; }
    else c.duration = d1;
    E.api.after({ insp: true }); F.toast(side === 'start' ? 'Inicio recortado hasta el cursor' : 'Final recortado hasta el cursor', 'ok', 1400);
  };
  X.step = (E, dir) => E.api.seek(clamp(E.t + dir / (E.p.fps || 30), 0, E.api.total()));
  X.selectNext = (E, dir) => { const p = E.p, cur = under(E), i = cur ? p.clips.indexOf(cur) : -1, n = p.clips[clamp(i + dir, 0, p.clips.length - 1)]; if (!n) return; E.api.select('clip', n.id); E.api.seek(R.layout(p).items.find((x) => x.clip === n).start + 0.01); };

  /* =================== PANEL =================== */
  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, path, v) => { const ks = path.split('.'), last = ks.pop(); let a = o; for (const k of ks) a = a[k] ||= {}; a[last] = v; };
  const DEF = { 'grade.b': 0, 'grade.c': 0, 'grade.s': 0, 'grade.t': 0, 'grade.v': 0, 'grade.bl': 0, 'tf.s': 1, 'tf.x': 0, 'tf.y': 0, 'tf.r': 0, 'tf.op': 1, textSize: 1, textX: 0, textY: 0, speed: 1, fadeIn: 0, fadeOut: 0, 'logo.size': 0.16, 'logo.op': 0.9 };
  const fmt = (k, v) => (/^grade|^tf\.[xy]$|text[XY]$/.test(k) ? (v > 0 ? '+' : '') + Math.round(v * 100) : k === 'tf.r' ? Math.round(v) + '°' : /fade/i.test(k) ? (+v).toFixed(1) + ' s' : /op$|size$/i.test(k) && k !== 'textSize' ? Math.round(v * 100) + '%' : '×' + (+v).toFixed(2));
  const sl = (o, k, label, min, max, step) => { const v = get(o, k) ?? DEF[k]; return `<label class="lbl">${label}</label><div class="rangeval"><input type="range" data-pk="${k}" min="${min}" max="${max}" step="${step}" value="${v}" title="Doble clic: restablecer"><span data-pv="${k}">${fmt(k, v)}</span></div>`; };
  const box = (t, inner, extra = '') => `<div class="pro-box"><div class="pro-t">${t}${extra}</div>${inner}</div>`;

  const autoHTML = (E) => {
    const p = E.p, hasM = p.audio.some((a) => a.kind === 'musica'), hasV = p.audio.some((a) => a.kind === 'voz');
    const bt = (a, ic, t, d, pri) => `<button class="pro-act ${pri ? 'pri' : ''}" data-pa2="${a}">${I(ic)}<span><b>${t}</b><small>${d}</small></span></button>`;
    return bt('polish', 'sparkles', 'Pulido automático', 'Color, audio, ritmo, fundidos y revisión: todo en un clic', true)
      + `<div class="pre-sub" style="grid-column:auto">Imagen</div>` + bt('color', 'wand', 'Color automático', 'Corrige brillo, contraste y saturación de cada clip') + bt('match', 'layers', 'Igualar color entre clips', 'Todos los clips con el mismo tono y temperatura')
      + `<div class="pre-sub" style="grid-column:auto">Sonido</div>` + bt('mix', 'volume', 'Mezcla automática', 'Voz nivelada, música de fondo y ducking de −12 dB') + bt('beat', 'music', 'Cortes al ritmo de la música', hasM ? (hasV ? 'Mueve cada corte al pulso más cercano (la voz no se toca)' : 'Mueve cada corte al pulso más cercano') : 'Necesita una pista de música')
      + `<div class="pre-sub" style="grid-column:auto">Antes de exportar</div>` + bt('check', 'check', 'Revisión técnica', 'Resolución, textos, audio saturado, duración y más')
      + (F.golden ? bt('golden', 'scissors', 'Método Golden completo', 'Corta silencios, subtitula, ilustra y sonoriza') : '');
  };
  const manualHTML = (E) => {
    const p = E.p, c = sel(E), a = E.selType === 'audio' ? p.audio.find((x) => x.id === E.sel) : null;
    if (c) {
      const i = p.clips.indexOf(c), vid = isVid(c);
      return `<div class="small"><b>Clip ${i + 1}</b> <span class="muted">· doble clic en un control lo restablece</span></div>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-pa2="copy">${I('copy')} Copiar estilo</button><button class="btn sm" data-pa2="paste" ${X.clip ? '' : 'disabled'}>Pegar estilo</button><button class="btn sm ghost" data-pa2="pasteAll" ${X.clip ? '' : 'disabled'}>Pegar en todos</button></div>
        ${box('Corrección de color', sl(c, 'grade.b', 'Brillo', -1, 1, 0.02) + sl(c, 'grade.c', 'Contraste', -1, 1, 0.02) + sl(c, 'grade.s', 'Saturación', -1, 1, 0.02) + sl(c, 'grade.t', 'Temperatura (frío ↔ cálido)', -1, 1, 0.02) + sl(c, 'grade.v', 'Viñeta', 0, 0.9, 0.02) + sl(c, 'grade.bl', 'Desenfoque', 0, 1, 0.02), `<button class="applyall" data-pa2="gradeAll">A todos</button><button class="applyall" data-pa2="gradeReset">Restablecer</button>`)}
        ${box('Encuadre', sl(c, 'tf.s', 'Zoom', 0.3, 3, 0.01) + sl(c, 'tf.x', 'Posición horizontal', -0.6, 0.6, 0.005) + sl(c, 'tf.y', 'Posición vertical', -0.6, 0.6, 0.005) + sl(c, 'tf.r', 'Giro', -180, 180, 1) + sl(c, 'tf.op', 'Opacidad', 0, 1, 0.02) + `<label class="check"><input type="checkbox" data-pk="tf.flip" ${c.tf?.flip ? 'checked' : ''}> Espejo horizontal</label>`, `<button class="applyall" data-pa2="tfReset">Restablecer</button>`)}
        ${box('Texto', (c.text ? '' : '<div class="small muted">Este clip no tiene texto (tecla T para escribirlo).</div>') + sl(c, 'textSize', 'Tamaño', 0.4, 2.5, 0.02) + sl(c, 'textX', 'Posición horizontal', -0.45, 0.45, 0.005) + sl(c, 'textY', 'Posición vertical', -0.8, 0.45, 0.005), `<button class="applyall" data-pa2="textAll">A todos</button><button class="applyall" data-pa2="textReset">Restablecer</button>`)}
        ${vid ? box('Velocidad del video', sl(c, 'speed', 'Velocidad', 0.25, 4, 0.05) + '<div class="hint">Cambia solo la imagen (cámara lenta o rápida). El audio extraído sigue a velocidad normal.</div>') : ''}
        ${box('Recorte rápido', `<div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-pa2="trimStart">Quitar antes del cursor <kbd>Q</kbd></button><button class="btn sm" data-pa2="trimEnd">Quitar después del cursor <kbd>W</kbd></button></div>`)}`;
    }
    if (a) return `<div class="small"><b>Pista de audio</b></div>${box('Fundidos', sl(a, 'fadeIn', 'Entrada suave', 0, 5, 0.1) + `<label class="check"><input type="checkbox" data-pk="fadeOut" ${a.fadeOut ? 'checked' : ''}> Desvanecer al final del video</label>`)}<div class="hint">Volumen, inicio y bucle están en el panel derecho.</div>`;
    const lm = p.logo?.mediaId && F.media.byId(p.logo.mediaId);
    return `<div class="small muted">Selecciona un clip para corregir color, encuadre, texto y velocidad. Sin selección, ajustas el video completo.</div>
      ${box('Fundido del video', sl(p, 'fadeIn', 'Entrada desde negro', 0, 3, 0.1) + sl(p, 'fadeOut', 'Salida a negro', 0, 3, 0.1))}
      ${box('Logo / marca', `<div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-pa2="logoPick">${I('image')} ${lm ? 'Cambiar logo' : 'Elegir logo (PNG)'}</button>${lm ? `<button class="btn sm ghost" data-pa2="logoDel">Quitar</button>` : ''}</div>${lm ? `<div class="small muted">${esc(lm.name)}</div><label class="lbl">Posición</label><select data-pk="logo.pos">${[['tr', 'Arriba derecha'], ['tl', 'Arriba izquierda'], ['br', 'Abajo derecha'], ['bl', 'Abajo izquierda'], ['tc', 'Arriba centro'], ['bc', 'Abajo centro'], ['mc', 'Centro']].map(([v, n]) => `<option value="${v}" ${(p.logo.pos || 'tr') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>` + sl(p, 'logo.size', 'Tamaño', 0.04, 0.6, 0.01) + sl(p, 'logo.op', 'Opacidad', 0.1, 1, 0.02) : ''}`)}
      ${box('Guías', `<label class="check"><input type="checkbox" data-px="guides" ${X.guides ? 'checked' : ''}> Mostrar tercios y zona segura <kbd>G</kbd></label><div class="hint">Solo se ven en la vista previa; nunca salen en el video.</div>`)}
      ${box('Exportación', `<label class="lbl">Resolución</label><select data-pk="exportRes">${Object.entries(RES).map(([v, n]) => `<option value="${v}" ${(+p.exportRes || 1080) === +v ? 'selected' : ''}>${n}</option>`).join('')}</select><label class="lbl">Calidad (peso del archivo)</label><select data-pk="exportQ">${[['high', 'Alta'], ['medium', 'Media'], ['low', 'Ligera']].map(([v, n]) => `<option value="${v}" ${(p.exportQ || 'high') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`)}
      ${box('Atajos pro', `<div class="small muted" style="line-height:2"><kbd>,</kbd> <kbd>.</kbd> avanzar / retroceder un fotograma<br><kbd>↑</kbd> <kbd>↓</kbd> clip anterior / siguiente<br><kbd>Q</kbd> quitar antes del cursor · <kbd>W</kbd> quitar después<br><kbd>Ctrl+Shift+C</kbd> copiar estilo · <kbd>Ctrl+Shift+V</kbd> pegar<br><kbd>G</kbd> guías · <kbd>+</kbd> <kbd>−</kbd> zoom de la línea de tiempo</div>`)}`;
  };

  let lastKey = '', lastAt = 0;
  X.panel = (bin, E) => {
    bin.innerHTML = `<div class="pro"><div class="seg pro-seg"><button data-pm="auto" class="${X.mode === 'auto' ? 'on' : ''}">${I('wand')} Automático</button><button data-pm="manual" class="${X.mode === 'manual' ? 'on' : ''}">${I('sliders')} Manual</button></div>${X.mode === 'auto' ? autoHTML(E) : manualHTML(E)}</div>`;
    if (bin.__pro) return; bin.__pro = true;
    const target = () => sel(E) || (E.selType === 'audio' ? E.p.audio.find((x) => x.id === E.sel) : null) || E.p;
    const redraw = () => E.api.renderBin();
    bin.addEventListener('click', async (e) => {
      if (E.binTab !== 'pro' || !E.p) return;
      const m = e.target.closest('[data-pm]'); if (m) { X.mode = m.dataset.pm; try { localStorage.setItem('framaly.proMode', X.mode); } catch (er) { /* sin memoria */ } return redraw(); }
      const b = e.target.closest('[data-pa2]'); if (!b) return; const a = b.dataset.pa2, p = E.p, c = sel(E), fail = (er) => F.toast(er.message || String(er), 'error');
      if (a === 'polish') return X.polish(E, b).catch(fail);
      if (a === 'color' || a === 'match') { F.busy(b, true, 'Analizando…'); return X.autoColor(E, a === 'match' ? 'match' : 'fix').catch(fail).finally(() => F.busy(b, false)); }
      if (a === 'mix') { F.busy(b, true, 'Midiendo…'); return X.autoMix(E).catch(fail).finally(() => F.busy(b, false)); }
      if (a === 'beat') { F.busy(b, true, 'Escuchando…'); return X.beatSync(E).catch(fail).finally(() => F.busy(b, false)); }
      if (a === 'check') return X.openCheck(E).catch(fail);
      if (a === 'golden') { E.binTab = 'golden'; document.querySelectorAll('#binTabs button').forEach((x) => x.classList.toggle('on', x.dataset.t === 'golden')); return redraw(); }
      if (a === 'copy') { X.copyStyle(E); return redraw(); }
      if (a === 'paste' || a === 'pasteAll') return X.pasteStyle(E, a === 'pasteAll');
      if (a === 'trimStart' || a === 'trimEnd') return X.trim(E, a === 'trimStart' ? 'start' : 'end');
      if (a === 'logoDel') { E.api.commit(); delete p.logo; E.api.after(); return redraw(); }
      if (a === 'logoPick') { const f = (await F.pickFiles('image/*', false))[0]; if (!f) return; const md = await F.media.add({ type: 'image', name: 'Logo · ' + f.name.replace(/\.[^.]+$/, ''), blob: f, source: 'upload' }); await F.media.image(md.id).catch(() => null); E.api.commit(); p.logo = { mediaId: md.id, pos: p.logo?.pos || 'tr', size: p.logo?.size ?? 0.16, op: p.logo?.op ?? 0.9 }; E.api.after(); return redraw(); }
      if (!c) return;
      E.api.commit();
      if (a === 'gradeReset') delete c.grade; else if (a === 'tfReset') delete c.tf; else if (a === 'textReset') { delete c.textSize; delete c.textX; delete c.textY; }
      else if (a === 'gradeAll') { p.clips.forEach((x) => { if (x !== c) x.grade = c.grade ? { ...c.grade } : undefined; }); F.toast('Color aplicado a todos los clips', 'ok'); }
      else if (a === 'textAll') { p.clips.forEach((x) => { x.textSize = c.textSize; x.textX = c.textX; x.textY = c.textY; }); F.toast('Tamaño y posición del texto aplicados a todos', 'ok'); }
      E.api.after(); redraw();
    });
    const onInput = (e) => {
      if (E.binTab !== 'pro' || !E.p) return; const el = e.target;
      if (el.dataset.px === 'guides') { X.guides = el.checked; return E.api.after(); }
      const k = el.dataset.pk; if (!k) return; const o = target();
      if (k !== lastKey || Date.now() - lastAt > 1200) E.api.commit(); lastKey = k; lastAt = Date.now();
      let v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? parseFloat(el.value) : el.value; if (k === 'exportRes') v = +v;
      set(o, k, v);
      const sp = bin.querySelector(`[data-pv="${k}"]`); if (sp) sp.textContent = fmt(k, v);
      E.api.after(k === 'fadeOut' ? { insp: true } : {});
    };
    bin.addEventListener('input', onInput); bin.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') return; lastKey = ''; });
    bin.addEventListener('dblclick', (e) => { const el = e.target.closest('input[type=range][data-pk]'); if (!el || E.binTab !== 'pro') return; el.value = DEF[el.dataset.pk] ?? 0; el.dispatchEvent(new Event('input', { bubbles: true })); });
  };

  /* =================== ATAJOS PRO =================== */
  document.addEventListener('keydown', (e) => {
    const E = F.editor; if (!E?.p || !E.api || !location.hash.startsWith('#/editor')) return;
    const tag = (e.target.tagName || '').toLowerCase(); if (['input', 'textarea', 'select'].includes(tag) || document.querySelector('.modal-bg')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (ctrl && e.shiftKey && k === 'c') { e.preventDefault(); X.copyStyle(E); }
    else if (ctrl && e.shiftKey && k === 'v') { e.preventDefault(); X.pasteStyle(E); }
    else if (ctrl || e.altKey) return;
    else if (e.key === ',') { e.preventDefault(); X.step(E, -1); }
    else if (e.key === '.') { e.preventDefault(); X.step(E, 1); }
    else if (k === 'q') { e.preventDefault(); X.trim(E, 'start'); }
    else if (k === 'w') { e.preventDefault(); X.trim(E, 'end'); }
    else if (k === 'g') { e.preventDefault(); X.guides = !X.guides; E.api.after(); if (E.binTab === 'pro') E.api.renderBin(); F.toast(X.guides ? 'Guías activadas' : 'Guías ocultas', '', 1200); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); X.selectNext(E, -1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); X.selectNext(E, 1); }
    else if (e.key === '+' || e.key === '-') { const z = document.querySelector('#tlZoom'); if (!z) return; e.preventDefault(); z.value = clamp(+z.value + (e.key === '+' ? 15 : -15), +z.min, +z.max); z.dispatchEvent(new Event('input', { bubbles: true })); }
  });
})();
