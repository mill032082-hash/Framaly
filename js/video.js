/* FRAMALY — Videos MP4 (y WebM/MOV) en el editor.
   · Se suben a la biblioteca con miniatura y duración.
   · Su audio se extrae solo y queda como pista de voz (así funcionan los cortes de silencios del método Golden).
   · En la línea de tiempo un clip puede ser un video: `mediaId` apunta al video y `vstart` es el segundo del video donde empieza. */
(function () {
  'use strict';
  const M = F.media, R = F.R;
  const MAX_BYTES = 600 * 1024 * 1024;           // por seguridad del navegador
  M.VIDEO_RE = /\.(mp4|m4v|mov|webm)$/i;
  M.isVideoFile = (f) => (f.type || '').startsWith('video/') || M.VIDEO_RE.test(f.name || '');
  M.videos = () => M.list.filter((m) => m.type === 'video');

  const els = new Map();   // id → { el, ready }
  /** Elemento <video> (sin sonido: el audio va en su propia pista) */
  M.videoEl = (id) => {
    let e = els.get(id); if (e) return e.el;
    const m = M.byId(id), el = document.createElement('video');
    el.muted = true; el.defaultMuted = true; el.playsInline = true; el.preload = 'auto'; el.setAttribute('playsinline', ''); el.crossOrigin = 'anonymous';
    const ready = new Promise((res, rej) => {
      if (!m) return rej(new Error('Video no encontrado'));
      el.onloadeddata = () => { el.width = el.videoWidth; el.height = el.videoHeight; F.emit('imgload', id); res(el); };
      el.onerror = () => rej(new Error('Este navegador no puede reproducir ese video (prueba con MP4 H.264 o WebM).'));
      el.onseeked = () => F.emit('imgload', id);
      el.src = M.url(m);
    });
    ready.catch(() => {});
    els.set(id, { el, ready });
    return el;
  };
  M.videoReady = (id) => { M.videoEl(id); return els.get(id).ready; };
  M.dropVideo = (id) => { const e = els.get(id); if (e) { try { e.el.pause(); } catch (x) { /* nada */ } e.el.removeAttribute('src'); els.delete(id); } };
  /** Miniatura: la de la imagen o el primer fotograma del video */
  M.thumb = (m) => (typeof m === 'string' ? (m = M.byId(m)) : m) ? (m.type === 'video' ? (m.meta?.thumb || '') : M.url(m)) : '';

  /** Duración, tamaño y miniatura de un video */
  M.videoInfo = (blob) => new Promise((res, rej) => {
    const v = document.createElement('video'), u = URL.createObjectURL(blob);
    v.muted = true; v.preload = 'metadata'; v.playsInline = true;
    const done = (o) => { URL.revokeObjectURL(u); res(o); };
    v.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Este navegador no puede leer ese video. Usa MP4 (H.264), WebM o MOV.')); };
    v.onloadedmetadata = () => {
      const dur = v.duration, w = v.videoWidth, h = v.videoHeight;
      if (!isFinite(dur) || !w) return v.onerror();
      v.onseeked = () => {
        try { const c = document.createElement('canvas'), k = 180 / Math.max(1, h); c.width = Math.round(w * k); c.height = 180; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); done({ duration: dur, w, h, thumb: c.toDataURL('image/jpeg', 0.7) }); }
        catch (e) { done({ duration: dur, w, h, thumb: '' }); }
      };
      v.currentTime = Math.min(0.5, dur / 2);
    };
    v.src = u;
  });

  /** Saca el audio del video y lo guarda como audio de la biblioteca (WAV). Devuelve el audio o null si el video no tiene sonido. */
  M.extractAudio = async (vm) => {
    let buf; try { buf = await F.actx().decodeAudioData(await vm.blob.arrayBuffer()); } catch (e) { return null; }
    if (!buf || !buf.length) return null;
    const chs = [], n = Math.min(2, buf.numberOfChannels); for (let c = 0; c < n; c++) chs.push(buf.getChannelData(c));
    // silencio total = el video no tiene voz útil
    let peak = 0; const d = chs[0]; for (let i = 0; i < d.length; i += 97) peak = Math.max(peak, Math.abs(d[i])); if (peak < 0.0005) return null;
    const wav = (F.golden?.wav || wavBlob)(chs, buf.sampleRate);
    const a = await M.add({ type: 'audio', name: `Voz · ${vm.name}`, blob: wav, source: 'upload', meta: { fromVideo: vm.id } });
    vm.meta = { ...(vm.meta || {}), audioId: a.id }; vm.updated = Date.now(); await F.db.put('media', vm);
    return a;
  };
  function wavBlob(chs, sr) {
    const len = chs[0].length, nc = chs.length, out = new DataView(new ArrayBuffer(44 + len * nc * 2)), w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + len * nc * 2, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, nc, true);
    out.setUint32(24, sr, true); out.setUint32(28, sr * nc * 2, true); out.setUint16(32, nc * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, len * nc * 2, true);
    let o = 44; for (let i = 0; i < len; i++) for (let c = 0; c < nc; c++) { const v = Math.max(-1, Math.min(1, chs[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return new Blob([out], { type: 'audio/wav' });
  }

  /** Sube uno o varios videos: miniatura, duración y audio como pista aparte */
  M.addVideos = async (files, onProgress) => {
    const out = [];
    for (const f of files) {
      if (f.size > MAX_BYTES) { F.toast(`«${f.name}» pesa ${Math.round(f.size / 1048576)} MB. El máximo es ${Math.round(MAX_BYTES / 1048576)} MB: recórtalo o comprímelo antes.`, 'error', 7000); continue; }
      try {
        onProgress?.(`Leyendo ${f.name}…`);
        const info = await M.videoInfo(f);
        const blob = f.type ? f : new Blob([f], { type: 'video/mp4' });
        const m = await M.add({ type: 'video', name: f.name.replace(/\.[^.]+$/, ''), blob, source: 'upload', meta: { w: info.w, h: info.h, thumb: info.thumb }, duration: info.duration });
        onProgress?.('Extrayendo el audio…');
        const a = await M.extractAudio(m).catch(() => null);
        out.push({ video: m, audio: a });
      } catch (e) { F.toast(e.message || String(e), 'error', 7000); }
    }
    return out;
  };

  /* ---------- dibujo del video dentro del render ---------- */
  const touched = new Set();
  R.live = false;           // true mientras se reproduce o se exporta: los videos corren solos en vez de saltar a cada fotograma
  /** Elemento <video> listo para pintar el instante `lt` del clip, o null si todavía no cargó */
  R.videoFrame = (clip, lt) => {
    const v = M.videoEl(clip.mediaId); touched.add(v);
    if (v.readyState < 2) return null;
    const tt = Math.min((clip.vstart || 0) + lt, Math.max(0, (v.duration || 0) - 0.04));
    if (R.live) { if (v.paused) { v.currentTime = tt; v.play().catch(() => {}); } else if (Math.abs(v.currentTime - tt) > 0.4) v.currentTime = tt; }
    else { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - tt) > 0.03) v.currentTime = tt; }
    return v;
  };
  const baseDraw = R.drawClip;
  R.drawClip = (cx, clip, lt, W, H) => {
    const m = clip.mediaId && M.byId(clip.mediaId);
    if (m && m.type === 'video' && !clip._img) {
      const v = R.videoFrame(clip, lt);
      if (v) { clip._img = v; try { return baseDraw(cx, clip, lt, W, H); } finally { delete clip._img; } }
    }
    return baseDraw(cx, clip, lt, W, H);
  };
  const baseFrame = R.renderFrame;
  R.renderFrame = (...a) => {
    touched.clear();
    const r = baseFrame(...a);
    if (R.live) els.forEach((e) => { if (!touched.has(e.el) && !e.el.paused) e.el.pause(); });
    return r;
  };
  R.stopVideos = () => els.forEach((e) => { try { e.el.pause(); } catch (x) { /* nada */ } });

  /** La imagen de un clip de video es su elemento <video> (así «precargar» funciona igual que con las imágenes) */
  const baseImage = M.image.bind(M), baseSync = M.imgSync.bind(M);
  M.image = (id) => (M.byId(id)?.type === 'video' ? M.videoReady(id) : baseImage(id));
  M.imgSync = (id) => { const m = M.byId(id); if (m?.type === 'video') { const v = M.videoEl(id); return v.readyState >= 2 ? v : null; } return baseSync(id); };

  /* exportación: en tiempo real los videos corren solos */
  const Eng = F.Engine;
  if (Eng?.exportVideo) {
    const baseExport = Eng.exportVideo;
    Eng.exportVideo = async (p, o = {}) => {
      await Promise.all(p.clips.map((c) => (M.byId(c.mediaId)?.type === 'video' ? M.videoReady(c.mediaId) : null)));
      R.live = true;
      try { return await baseExport(p, o); } finally { R.live = false; R.stopVideos(); }
    };
  }
})();
