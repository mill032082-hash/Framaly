/* FRAMALY — motor de render: movimiento, filtros, textos, transiciones, reproducción y exportación */
(function () {
  'use strict';
  const R = (F.R = {});

  R.SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
  R.ASPECTS = [['16:9', 'YouTube 16:9'], ['9:16', 'Shorts / TikTok 9:16'], ['1:1', 'Cuadrado 1:1'], ['4:5', 'Instagram 4:5']];
  R.previewSize = (aspect, max = 960) => { const [w, h] = R.SIZES[aspect] || R.SIZES['16:9']; const s = max / Math.max(w, h); return [Math.round(w * s), Math.round(h * s)]; };

  R.TRANSITIONS = [
    { id: 'none', name: 'Corte directo' }, { id: 'fade', name: 'Disolver' }, { id: 'black', name: 'Fundido a negro' },
    { id: 'flash', name: 'Destello blanco' }, { id: 'slideL', name: 'Deslizar ←' }, { id: 'slideR', name: 'Deslizar →' },
    { id: 'slideU', name: 'Deslizar ↑' }, { id: 'zoom', name: 'Zoom de impacto' }, { id: 'wipe', name: 'Barrido' },
    { id: 'circle', name: 'Círculo' }, { id: 'blur', name: 'Desenfoque' }, { id: 'spin', name: 'Giro' },
    { id: 'blinds', name: 'Persianas' }, { id: 'glitch', name: 'Glitch' },
  ];
  R.MOTIONS = [
    { id: 'none', name: 'Estático' }, { id: 'kenburns', name: 'Ken Burns' }, { id: 'zoomIn', name: 'Acercar' },
    { id: 'zoomOut', name: 'Alejar' }, { id: 'panL', name: 'Paneo ←' }, { id: 'panR', name: 'Paneo →' },
    { id: 'panU', name: 'Paneo ↑' }, { id: 'panD', name: 'Paneo ↓' },
  ];
  R.BASE_FILTERS = [
    { id: 'none', name: 'Original', css: 'none', vig: 0 },
    { id: 'cine', name: 'Cinemático', css: 'contrast(1.15) saturate(1.1) brightness(.97)', vig: 0.45 },
    { id: 'calido', name: 'Cálido', css: 'sepia(.25) saturate(1.3) hue-rotate(-8deg)', vig: 0.25 },
    { id: 'frio', name: 'Frío', css: 'saturate(.9) hue-rotate(12deg) brightness(1.04)', vig: 0.2 },
    { id: 'vivo', name: 'Vívido', css: 'saturate(1.6) contrast(1.08)', vig: 0.1 },
    { id: 'drama', name: 'Dramático', css: 'contrast(1.4) brightness(.88) saturate(.8)', vig: 0.6 },
    { id: 'vintage', name: 'Vintage', css: 'sepia(.5) contrast(.92) brightness(1.05) saturate(.9)', vig: 0.5 },
    { id: 'suave', name: 'Suave', css: 'brightness(1.08) contrast(.9) saturate(.9)', vig: 0 },
    { id: 'bn', name: 'Blanco y negro', css: 'grayscale(1) contrast(1.2)', vig: 0.35 },
    { id: 'noir', name: 'Noir', css: 'grayscale(1) contrast(1.6) brightness(.85)', vig: 0.7 },
  ];
  R.filters = () => [...R.BASE_FILTERS, ...(F.settings.customFilters || [])];
  R.filter = (id) => R.filters().find((f) => f.id === id) || R.BASE_FILTERS[0];
  R.TEXT_STYLES = [{ id: 'subtitulo', name: 'Subtítulo' }, { id: 'titulo', name: 'Título central' }, { id: 'inferior', name: 'Rótulo inferior' }];
  R.TEXT_ANIMS = [{ id: 'fade', name: 'Aparecer' }, { id: 'up', name: 'Subir' }, { id: 'type', name: 'Máquina de escribir' }, { id: 'pop', name: 'Rebote' }, { id: 'none', name: 'Sin animación' }];
  R.opts = (list, sel) => list.map((o) => `<option value="${o.id}" ${o.id === sel ? 'selected' : ''}>${F.esc(o.name)}</option>`).join('');

  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  R.ease = ease;

  R.layout = (p) => {
    let t = 0;
    const items = p.clips.map((c) => { const it = { clip: c, start: t, end: t + c.duration }; t += c.duration; return it; });
    return { items, total: t };
  };

  const offs = {};
  function off(key, W, H) {
    let c = offs[key];
    if (!c) c = offs[key] = document.createElement('canvas');
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    return c;
  }

  /* ---------- texto ---------- */
  R.wrap = (cx, text, maxW) => {
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const test = line ? line + ' ' + w : w;
        if (cx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
      }
      out.push(line);
    }
    return out;
  };
  function rr(cx, x, y, w, h, r) { cx.beginPath(); if (cx.roundRect) cx.roundRect(x, y, w, h, r); else cx.rect(x, y, w, h); }

  R.drawText = (cx, clip, lt, W, H) => {
    const base = Math.min(W, H);
    const st = clip.textStyle || 'subtitulo', an = clip.textAnim || 'fade';
    const p = an === 'none' ? 1 : F.clamp(lt / 0.6, 0, 1);
    const e = easeOut(p);
    const color = clip.textColor || '#ffffff';
    const font = (w, s) => `${w} ${s}px Inter, "Segoe UI", Arial, sans-serif`;
    cx.save();
    if (an !== 'type') cx.globalAlpha = e;
    const oy = an === 'up' ? (1 - e) * base * 0.06 : 0;
    const typeCut = (lines) => {
      if (an !== 'type') return lines;
      let n = Math.floor(lt * 30);
      return lines.map((l) => { const s = l.slice(0, Math.max(0, n)); n -= l.length + 1; return s; });
    };
    const popScale = (cxp, cyp) => {
      if (an !== 'pop') return;
      const q = p - 1, back = 1 + 2.70158 * q * q * q + 1.70158 * q * q;
      const s = 0.6 + 0.4 * back;
      cx.translate(cxp, cyp); cx.scale(s, s); cx.translate(-cxp, -cyp);
    };

    if (st === 'titulo') {
      const fs = base * (W > H ? 0.085 : 0.075);
      cx.font = font(800, fs); cx.textAlign = 'center'; cx.textBaseline = 'middle';
      const all = R.wrap(cx, clip.text, W * 0.84); const lines = typeCut(all); const lh = fs * 1.14;
      const y0 = H / 2 - ((all.length - 1) * lh) / 2 + oy;
      popScale(W / 2, H / 2);
      cx.shadowColor = 'rgba(0,0,0,.65)'; cx.shadowBlur = fs * 0.45; cx.shadowOffsetY = fs * 0.06;
      cx.fillStyle = color;
      lines.forEach((l, i) => cx.fillText(l, W / 2, y0 + i * lh));
      cx.shadowColor = 'transparent';
      const bw = W * 0.1 * e;
      cx.fillStyle = '#ff6a1a';
      rr(cx, W / 2 - bw / 2, y0 + (all.length - 1) * lh + fs * 0.75, bw, fs * 0.09, fs * 0.05); cx.fill();
    } else if (st === 'inferior') {
      const fs = base * 0.05; const pad = fs * 0.55;
      cx.font = font(700, fs); cx.textAlign = 'left'; cx.textBaseline = 'top';
      const all = R.wrap(cx, clip.text, W * 0.62); const lines = typeCut(all); const lh = fs * 1.22;
      const maxW = Math.max(...all.map((l) => cx.measureText(l).width));
      const bh = all.length * lh + pad * 2 - (lh - fs);
      const x = W * 0.05, y = H * 0.86 - bh + oy;
      const bw = (maxW + pad * 2 + fs * 0.3) * (an === 'none' ? 1 : e);
      cx.fillStyle = 'rgba(12,9,7,.78)'; rr(cx, x, y, bw, bh, fs * 0.15); cx.fill();
      cx.fillStyle = '#ff6a1a'; cx.fillRect(x, y, fs * 0.18, bh);
      cx.save(); cx.beginPath(); cx.rect(x, y, bw, bh); cx.clip();
      cx.fillStyle = color;
      lines.forEach((l, i) => cx.fillText(l, x + pad + fs * 0.3, y + pad + i * lh));
      cx.restore();
    } else {
      const fs = base * 0.047; const pad = fs * 0.35;
      cx.font = font(700, fs); cx.textAlign = 'center'; cx.textBaseline = 'middle';
      const all = R.wrap(cx, clip.text, W * 0.86); const lines = typeCut(all); const lh = fs * 1.42;
      const yb = H * (W > H ? 0.9 : 0.8) + oy;
      popScale(W / 2, yb);
      all.forEach((full, i) => {
        const y = yb - (all.length - 1 - i) * lh;
        const tw = cx.measureText(full).width;
        cx.fillStyle = 'rgba(0,0,0,.62)'; rr(cx, W / 2 - tw / 2 - pad * 1.6, y - fs / 2 - pad, tw + pad * 3.2, fs + pad * 2, fs * 0.22); cx.fill();
        cx.fillStyle = color; cx.fillText(lines[i], W / 2 - (an === 'type' ? (tw - cx.measureText(lines[i]).width) / 2 : 0), y);
      });
    }
    cx.restore();
  };

  /* ---------- un clip (imagen + movimiento + filtro + texto) ---------- */
  R.drawClip = (cx, clip, lt, W, H) => {
    const img = clip._img || F.media.imgSync(clip.mediaId);
    const f = clip._filter || R.filter(clip.filter);
    const pr = clip.duration ? F.clamp(lt / clip.duration, 0, 1) : 0;
    cx.save();
    cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
    if (img && img.width) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const ir = iw / ih, cr = W / H, k = clip.motionAmt ?? 0.15, m = clip.motion || 'none';
      const cover = clip.fit !== 'contain';
      if (!cover) {
        let bw, bh; if (ir > cr) { bh = H; bw = H * ir; } else { bw = W; bh = W / ir; }
        cx.filter = `blur(${Math.round(Math.min(W, H) * 0.035)}px) brightness(.55)`;
        cx.drawImage(img, (W - bw * 1.15) / 2, (H - bh * 1.15) / 2, bw * 1.15, bh * 1.15);
        cx.filter = 'none';
      }
      let dw, dh;
      if ((ir > cr) === cover) { dh = H; dw = H * ir; } else { dw = W; dh = W / ir; }
      let s = 1;
      if (m === 'zoomIn') s = 1 + k * pr;
      else if (m === 'zoomOut') s = 1 + k * (1 - pr);
      else if (m === 'kenburns') s = 1 + k * (0.25 + 0.75 * pr);
      else if (m.startsWith('pan')) s = 1 + k;
      dw *= s; dh *= s;
      const ovx = Math.max(0, dw - W), ovy = Math.max(0, dh - H);
      let dx = 0, dy = 0;
      if (m === 'panL') dx = (ovx / 2) * (1 - 2 * pr);
      else if (m === 'panR') dx = -(ovx / 2) * (1 - 2 * pr);
      else if (m === 'panU') dy = (ovy / 2) * (1 - 2 * pr);
      else if (m === 'panD') dy = -(ovy / 2) * (1 - 2 * pr);
      else if (m === 'kenburns') { dx = (pr - 0.5) * ovx * 0.6; dy = (0.5 - pr) * ovy * 0.4; }
      cx.filter = f.css && f.css !== 'none' ? f.css : 'none';
      cx.drawImage(img, (W - dw) / 2 + dx, (H - dh) / 2 + dy, dw, dh);
      cx.filter = 'none';
    } else {
      const g = cx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a1d14'); g.addColorStop(1, '#120c08');
      cx.fillStyle = g; cx.fillRect(0, 0, W, H);
      cx.fillStyle = 'rgba(255,255,255,.35)'; cx.font = `600 ${Math.min(W, H) * 0.04}px Inter, sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(clip.mediaId && !F.media.byId(clip.mediaId) ? 'Imagen no encontrada' : 'Cargando…', W / 2, H / 2);
    }
    if (f.vig) {
      const g = cx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${f.vig})`);
      cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    }
    if (clip.text) R.drawText(cx, clip, lt, W, H);
    cx.restore();
  };

  /* ---------- transiciones ---------- */
  R.composite = (cx, A, B, type, p, W, H) => {
    const e = ease(F.clamp(p, 0, 1));
    cx.save();
    switch (type) {
      case 'fade': cx.drawImage(A, 0, 0); cx.globalAlpha = e; cx.drawImage(B, 0, 0); break;
      case 'black': case 'flash': {
        cx.drawImage(p < 0.5 ? A : B, 0, 0);
        cx.globalAlpha = p < 0.5 ? ease(p * 2) : 1 - ease((p - 0.5) * 2);
        cx.fillStyle = type === 'black' ? '#000' : '#fff'; cx.fillRect(0, 0, W, H); break;
      }
      case 'slideL': cx.drawImage(A, -e * W, 0); cx.drawImage(B, W - e * W, 0); break;
      case 'slideR': cx.drawImage(A, e * W, 0); cx.drawImage(B, -W + e * W, 0); break;
      case 'slideU': cx.drawImage(A, 0, -e * H); cx.drawImage(B, 0, H - e * H); break;
      case 'zoom': {
        cx.drawImage(B, 0, 0); cx.globalAlpha = 1 - e;
        const s = 1 + e * 0.6; cx.translate(W / 2, H / 2); cx.scale(s, s); cx.drawImage(A, -W / 2, -H / 2); break;
      }
      case 'wipe': {
        cx.drawImage(A, 0, 0); const x = e * W;
        cx.save(); cx.beginPath(); cx.rect(0, 0, x, H); cx.clip(); cx.drawImage(B, 0, 0); cx.restore();
        cx.fillStyle = '#ff6a1a'; cx.globalAlpha = Math.sin(p * Math.PI); cx.fillRect(x - 3, 0, 6, H); break;
      }
      case 'circle': cx.drawImage(A, 0, 0); cx.beginPath(); cx.arc(W / 2, H / 2, Math.max(0.1, e * Math.hypot(W, H) / 2), 0, Math.PI * 2); cx.clip(); cx.drawImage(B, 0, 0); break;
      case 'blur': {
        const b = Math.sin(p * Math.PI) * Math.min(W, H) * 0.02;
        cx.filter = `blur(${b.toFixed(1)}px)`; cx.drawImage(A, 0, 0); cx.globalAlpha = e; cx.drawImage(B, 0, 0); cx.filter = 'none'; break;
      }
      case 'spin': {
        cx.drawImage(A, 0, 0); cx.globalAlpha = e; cx.translate(W / 2, H / 2); cx.rotate((1 - e) * -Math.PI / 3);
        const s = 0.3 + 0.7 * e; cx.scale(s, s); cx.drawImage(B, -W / 2, -H / 2); break;
      }
      case 'blinds': {
        cx.drawImage(A, 0, 0); const n = 8, sh = H / n; cx.beginPath();
        for (let i = 0; i < n; i++) cx.rect(0, i * sh, W, sh * e + 0.5);
        cx.clip(); cx.drawImage(B, 0, 0); break;
      }
      case 'glitch': {
        const src = p < 0.5 ? A : B; cx.drawImage(src, 0, 0);
        const amp = Math.sin(p * Math.PI); let seed = Math.floor(p * 24) + 7;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (let i = 0; i < 12; i++) { const y = rnd() * H, h = rnd() * H * 0.08 + 2, o = (rnd() - 0.5) * W * 0.16 * amp; cx.drawImage(src, 0, y, W, h, o, y, W, h); }
        cx.globalCompositeOperation = 'screen'; cx.globalAlpha = amp * 0.18; cx.fillStyle = '#ff5a00'; cx.fillRect(0, 0, W, H); break;
      }
      default: cx.drawImage(p < 0.5 ? A : B, 0, 0);
    }
    cx.restore();
  };

  R.overlays = (cx, p, t, total, W, H) => {
    const base = Math.min(W, H);
    if (p.letterbox) {
      const bh = W > H ? Math.max(0, (H - W / 2.39) / 2) : H * 0.08;
      cx.fillStyle = '#000'; cx.fillRect(0, 0, W, bh); cx.fillRect(0, H - bh, W, bh);
    }
    if (p.watermark) {
      cx.save(); cx.globalAlpha = 0.75; cx.font = `700 ${base * 0.03}px Inter, sans-serif`; cx.textAlign = 'right'; cx.textBaseline = 'top';
      cx.shadowColor = 'rgba(0,0,0,.6)'; cx.shadowBlur = base * 0.01; cx.fillStyle = '#fff';
      cx.fillText(p.watermark, W - base * 0.04, base * 0.04); cx.restore();
    }
    if (p.progressBar && total) {
      const h = Math.max(3, base * 0.008);
      cx.fillStyle = 'rgba(255,255,255,.18)'; cx.fillRect(0, H - h, W, h);
      cx.fillStyle = '#ff6a1a'; cx.fillRect(0, H - h, (W * t) / total, h);
    }
  };

  /** Dibuja el fotograma del proyecto p en el instante t */
  R.renderFrame = (cx, p, t, W, H, key = 'pv') => {
    const { items, total } = R.layout(p);
    cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
    if (!items.length) return;
    t = F.clamp(t, 0, Math.max(0, total - 1e-3));
    let i = items.findIndex((it) => t < it.end); if (i < 0) i = items.length - 1;
    const it = items[i], c = it.clip, lt = t - it.start, nx = items[i + 1];
    const td = nx && c.transition && c.transition !== 'none' ? Math.min(c.transDur || 0.8, c.duration * 0.9, nx.clip.duration * 0.9) : 0;
    const A = off(key + 'A', W, H);
    R.drawClip(A.getContext('2d'), c, lt, W, H);
    if (td && lt > c.duration - td) {
      const B = off(key + 'B', W, H);
      R.drawClip(B.getContext('2d'), nx.clip, 0, W, H);
      R.composite(cx, A, B, c.transition, (lt - (c.duration - td)) / td, W, H);
    } else cx.drawImage(A, 0, 0);
    R.overlays(cx, p, t, total, W, H);
  };

  /* ---------- imágenes de demostración (para previsualizar efectos) ---------- */
  R.demo = (() => {
    const cache = {};
    return (i) => {
      if (cache[i]) return cache[i];
      const c = document.createElement('canvas'); c.width = 640; c.height = 360; const x = c.getContext('2d');
      const pals = [['#ff7a1a', '#7a1f4d', '#1b0f2e'], ['#3aa7ff', '#1d3b6e', '#0b1022'], ['#ffd36b', '#e0603a', '#3a1420']];
      const [a, b, d] = pals[i % 3];
      const g = x.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, d); g.addColorStop(0.55, b); g.addColorStop(1, a);
      x.fillStyle = g; x.fillRect(0, 0, 640, 360);
      x.fillStyle = 'rgba(255,240,200,.9)'; x.beginPath(); x.arc(i === 1 ? 470 : 200, 170, 46, 0, Math.PI * 2); x.fill();
      const ridge = (y, col, amp, seed) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, 360); for (let k = 0; k <= 640; k += 20) x.lineTo(k, y + Math.sin(k / 60 + seed) * amp + Math.sin(k / 23 + seed * 2) * amp * 0.4); x.lineTo(640, 360); x.fill(); };
      ridge(250, 'rgba(20,10,20,.55)', 26, i); ridge(290, 'rgba(10,5,10,.8)', 18, i + 3);
      for (let k = 0; k < 40; k++) { x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect((k * 97 + i * 31) % 640, (k * 53) % 140, 2, 2); }
      return (cache[i] = c);
    };
  })();

  /* =========================================================
     Motor: audio sincronizado, reproducción y exportación
     ========================================================= */
  const Eng = (F.Engine = {});
  Eng.prepareAudio = async (p) => {
    const out = [];
    for (const a of p.audio || []) {
      if (!F.media.byId(a.mediaId)) continue;
      try { out.push({ a, buf: await F.media.decode(a.mediaId) }); } catch (e) { console.warn('audio', e); }
    }
    return out;
  };
  Eng.scheduleAudio = (tracks, fromT, total, dest, when) => {
    const ac = F.actx(), nodes = [];
    const endAt = when + (total - fromT);
    for (const { a, buf } of tracks) {
      const rel = fromT - (a.start || 0);
      if (!a.loop && rel >= buf.duration) continue;
      if (rel < 0 && when - rel >= endAt) continue;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = !!a.loop;
      const g = ac.createGain(); const vol = a.volume ?? 1; g.gain.value = vol;
      src.connect(g).connect(dest);
      if (rel < 0) src.start(when - rel, 0); else src.start(when, a.loop ? rel % buf.duration : rel);
      if (a.fadeOut) { const fo = Math.min(2, total * 0.2); g.gain.setValueAtTime(vol, Math.max(ac.currentTime, endAt - fo)); g.gain.linearRampToValueAtTime(0.0001, endAt); }
      try { src.stop(endAt + 0.05); } catch (e) {}
      nodes.push(src);
    }
    return nodes;
  };
  Eng.pickMime = (format) => {
    const mp4 = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'];
    const webm = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const list = format === 'webm' ? [...webm, ...mp4] : [...mp4, ...webm];
    return list.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  };
  Eng.supportsMp4 = () => /mp4/.test(Eng.pickMime('mp4'));

  /** Exporta el proyecto a un video (tiempo real, con audio). */
  Eng.exportVideo = async (p, { format = 'mp4', fps = 30, quality = 'high', canvas, onProgress, signal } = {}) => {
    if (!window.MediaRecorder) throw new Error('Tu navegador no permite grabar video. Usa Chrome o Edge actualizados.');
    const [W, H] = R.SIZES[p.aspect] || R.SIZES['16:9'];
    const { total } = R.layout(p);
    if (!total) throw new Error('El proyecto no tiene clips. Añade imágenes en el editor.');
    await Promise.all(p.clips.map((c) => F.media.image(c.mediaId).catch(() => null)));
    canvas.width = W; canvas.height = H;
    const cx = canvas.getContext('2d');
    R.renderFrame(cx, p, 0, W, H, 'ex');
    const ac = F.actx(); await ac.resume();
    const dest = ac.createMediaStreamDestination();
    const tracks = await Eng.prepareAudio(p);
    const vs = canvas.captureStream(fps);
    const stream = new MediaStream([...vs.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const mime = Eng.pickMime(format);
    const vbr = { high: (W * H > 2e6 ? 16e6 : 12e6), medium: 7e6, low: 3.5e6 }[quality] || 10e6;
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: vbr, audioBitsPerSecond: 192000 } : {});
    const chunks = [];
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    const stopped = new Promise((r) => (rec.onstop = r));
    rec.start(1000);
    const when = ac.currentTime + 0.2;
    const nodes = Eng.scheduleAudio(tracks, 0, total, dest, when);
    await new Promise((resolve) => {
      const tick = () => {
        if (signal?.aborted) return resolve();
        const t = Math.max(0, ac.currentTime - when);
        R.renderFrame(cx, p, Math.min(t, total), W, H, 'ex');
        onProgress?.(Math.min(1, t / total), t, total);
        if (t >= total + 0.15) return resolve();
        requestAnimationFrame(tick);
      };
      tick();
    });
    nodes.forEach((n) => { try { n.stop(); } catch (e) {} });
    rec.stop(); await stopped;
    vs.getTracks().forEach((t) => t.stop());
    if (signal?.aborted) return null;
    const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
    return new Blob(chunks, { type });
  };

  /** Modal de exportación reutilizable */
  F.exportProject = (p, opts = {}) => new Promise((resolve) => {
    const ctrl = new AbortController();
    const m = F.modal({
      title: 'Exportando video', locked: true, wide: true,
      body: `<div style="display:grid;grid-template-columns:1fr 240px;gap:18px;align-items:center">
        <canvas id="exCv" style="width:100%;max-height:52vh;object-fit:contain;border-radius:10px;background:#000;border:1px solid var(--line2)"></canvas>
        <div><div class="pill" id="exSt"><span class="spin"></span> Grabando</div>
        <h2 style="margin:14px 0 4px;font-size:28px" id="exPct">0%</h2><div class="muted small" id="exT">Preparando…</div>
        <div class="progress" style="margin:14px 0"><div id="exBar"></div></div>
        <p class="hint">La exportación es en tiempo real para mantener el audio sincronizado. <b>No cambies de pestaña ni minimices</b> la ventana mientras se graba.</p>
        <div id="exDone"></div></div></div>`,
      actions: [{ label: 'Cancelar', danger: true, onClick: () => { ctrl.abort(); resolve(null); } }],
    });
    const cv = m.q('#exCv');
    Eng.exportVideo(p, { ...opts, canvas: cv, signal: ctrl.signal, onProgress: (f, t, tot) => {
      m.q('#exPct').textContent = Math.round(f * 100) + '%';
      m.q('#exBar').style.width = f * 100 + '%';
      m.q('#exT').textContent = `${F.fmtS(t)} de ${F.fmtS(tot)}`;
    } }).then((blob) => {
      if (!blob) return;
      const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm';
      const name = F.safeName(p.meta?.title || p.name) + '.' + ext;
      F.lastExport = { blob, name, projectId: p.id, created: Date.now() };
      F.emit('exported', F.lastExport);
      m.q('#exSt').innerHTML = F.icon('check') + ' Listo';
      m.q('#exT').textContent = `${ext.toUpperCase()} · ${F.bytes(blob.size)}`;
      m.q('.modal-f').innerHTML = `<button class="btn" data-close>Cerrar</button><a class="btn" href="#/publicar" data-close>${F.icon('youtube')} Publicar</a><button class="btn primary" data-dl>${F.icon('download')} Descargar ${ext.toUpperCase()}</button>`;
      m.q('.modal-f').addEventListener('click', (e) => {
        if (e.target.closest('[data-dl]')) F.download(blob, name);
        if (e.target.closest('[data-close]')) m.close();
      });
      F.download(blob, name);
      resolve(blob);
    }).catch((err) => { F.toast(err.message, 'error'); m.close(); resolve(null); });
  });
})();
