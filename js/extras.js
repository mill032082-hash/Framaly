/* FRAMALY — Paquete de efectos extra (se carga justo después de render.js).
   · 16 transiciones nuevas · 7 movimientos de cámara · 12 filtros (varios con grano, líneas VHS o fugas de luz)
   · 3 estilos de texto y 4 animaciones de texto · «Estilos en un clic» y «Sorpréndeme» para todo el video. */
(function () {
  'use strict';
  const R = F.R, TAU = Math.PI * 2;
  const ease = R.ease, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const backOut = (p) => { const q = p - 1; return 1 + 2.70158 * q * q * q + 1.70158 * q * q; };
  const tmp = document.createElement('canvas');

  /* =================== TRANSICIONES =================== */
  const TR = {
    slideD: (cx, A, B, e, p, W, H) => { cx.drawImage(A, 0, e * H); cx.drawImage(B, 0, -H + e * H); },
    zoomOut: (cx, A, B, e, p, W, H) => { cx.drawImage(B, 0, 0); cx.globalAlpha = 1 - e; const s = 1 - e * 0.55; cx.translate(W / 2, H / 2); cx.scale(s, s); cx.drawImage(A, -W / 2, -H / 2); },
    wipeU: (cx, A, B, e, p, W, H) => { cx.drawImage(A, 0, 0); cx.beginPath(); cx.rect(0, H - e * H, W, e * H + 1); cx.clip(); cx.drawImage(B, 0, 0); },
    wipeDiag: (cx, A, B, e, p, W, H) => { cx.drawImage(A, 0, 0); const x = e * (W + H); cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(x, 0); cx.lineTo(x - H, H); cx.lineTo(0, H); cx.closePath(); cx.clip(); cx.drawImage(B, 0, 0); },
    diamond: (cx, A, B, e, p, W, H) => { cx.drawImage(A, 0, 0); const r = Math.max(0.1, e * (W + H) / 2); cx.beginPath(); cx.moveTo(W / 2 - r, H / 2); cx.lineTo(W / 2, H / 2 - r); cx.lineTo(W / 2 + r, H / 2); cx.lineTo(W / 2, H / 2 + r); cx.closePath(); cx.clip(); cx.drawImage(B, 0, 0); },
    doors: (cx, A, B, e, p, W, H) => { cx.drawImage(B, 0, 0); const h = W / 2, o = e * h; cx.drawImage(A, 0, 0, h, H, -o, 0, h, H); cx.drawImage(A, h, 0, h, H, h + o, 0, h, H); },
    pixel: (cx, A, B, e, p, W, H) => {
      const amp = Math.sin(p * Math.PI), src = p < 0.5 ? A : B, block = 1 + amp * Math.min(W, H) * 0.06;
      const w = Math.max(1, Math.round(W / block)), h = Math.max(1, Math.round(H / block));
      tmp.width = w; tmp.height = h; tmp.getContext('2d').drawImage(src, 0, 0, w, h);
      cx.imageSmoothingEnabled = false; cx.drawImage(tmp, 0, 0, w, h, 0, 0, W, H); cx.imageSmoothingEnabled = true;
    },
    whip: (cx, A, B, e, p, W, H) => {
      const amp = Math.sin(p * Math.PI), x = e * W;
      cx.drawImage(A, -x, 0); cx.drawImage(B, W - x, 0);
      if (amp < 0.02) return; cx.globalAlpha = 0.22; for (let k = 1; k <= 5; k++) { const o = k * amp * W * 0.035; cx.drawImage(A, -x + o, 0); cx.drawImage(B, W - x + o, 0); }
    },
    leak: (cx, A, B, e, p, W, H) => {
      cx.drawImage(A, 0, 0); cx.globalAlpha = e; cx.drawImage(B, 0, 0);
      const amp = Math.sin(p * Math.PI), gx = -W * 0.3 + p * W * 1.6, g = cx.createRadialGradient(gx, H * 0.4, 0, gx, H * 0.4, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(255,225,160,1)'); g.addColorStop(0.35, 'rgba(255,120,40,.75)'); g.addColorStop(1, 'rgba(255,60,0,0)');
      cx.globalCompositeOperation = 'screen'; cx.globalAlpha = amp * 0.9; cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    },
    clock: (cx, A, B, e, p, W, H) => { cx.drawImage(A, 0, 0); cx.beginPath(); cx.moveTo(W / 2, H / 2); cx.arc(W / 2, H / 2, Math.hypot(W, H), -Math.PI / 2, -Math.PI / 2 + Math.max(0.001, e) * TAU); cx.closePath(); cx.clip(); cx.drawImage(B, 0, 0); },
    mosaic: (cx, A, B, e, p, W, H) => {
      cx.drawImage(A, 0, 0); const cols = W >= H ? 10 : 6, sz = W / cols, rows = Math.ceil(H / sz); cx.beginPath();
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const th = ((c * 73 + r * 151 + c * r * 17) % 97) / 97 * 0.85; if (e > th) cx.rect(c * sz - 0.5, r * sz - 0.5, sz + 1, sz + 1); }
      cx.clip(); cx.drawImage(B, 0, 0);
    },
    flip: (cx, A, B, e, p, W, H) => {
      cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
      const first = p < 0.5, s = Math.max(0.001, first ? 1 - ease(p * 2) : ease((p - 0.5) * 2));
      cx.translate(W / 2, H / 2); cx.scale(s, 1 - (1 - s) * 0.12); cx.drawImage(first ? A : B, -W / 2, -H / 2);
      cx.fillStyle = '#000'; cx.globalAlpha = (1 - s) * 0.45; cx.fillRect(-W / 2, -H / 2, W, H);
    },
    fall: (cx, A, B, e, p, W, H) => { cx.drawImage(B, 0, 0); if (e >= 0.999) return; cx.translate(W / 2, H / 2 + e * e * H * 1.9); cx.rotate(e * 0.45); cx.drawImage(A, -W / 2, -H / 2); },
    stripes: (cx, A, B, e, p, W, H) => {
      cx.drawImage(A, 0, 0); const n = W >= H ? 8 : 5, sw = W / n;
      for (let i = 0; i < n; i++) { const q = clamp(e * 1.5 - (i / n) * 0.5, 0, 1); cx.save(); cx.beginPath(); cx.rect(i * sw, 0, sw + 0.5, H); cx.clip(); cx.drawImage(B, 0, (i % 2 ? 1 : -1) * (1 - q) * H); cx.restore(); }
    },
    dreamy: (cx, A, B, e, p, W, H) => { const b = Math.sin(p * Math.PI); cx.filter = `blur(${(b * Math.min(W, H) * 0.03).toFixed(1)}px) brightness(${(1 + b * 0.7).toFixed(2)})`; cx.drawImage(A, 0, 0); cx.globalAlpha = e; cx.drawImage(B, 0, 0); cx.filter = 'none'; },
    tv: (cx, A, B, e, p, W, H) => {
      cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
      const first = p < 0.5, q = first ? 1 - ease(p * 2) : ease((p - 0.5) * 2), h = Math.max(3, H * q), w = q < 0.08 ? W * Math.max(0.05, q / 0.08) : W;
      cx.drawImage(first ? A : B, (W - w) / 2, (H - h) / 2, w, h);
      cx.globalAlpha = (1 - q) * 0.9; cx.fillStyle = '#fff'; cx.fillRect((W - w) / 2, (H - h) / 2, w, h);
    },
    shake: (cx, A, B, e, p, W, H) => {
      const amp = Math.sin(p * Math.PI), dx = Math.sin(p * 47) * amp * W * 0.035, dy = Math.cos(p * 39) * amp * H * 0.03, s = 1 + 0.1 * amp;
      cx.translate(W / 2 + dx, H / 2 + dy); cx.scale(s, s); cx.drawImage(A, -W / 2, -H / 2); cx.globalAlpha = e; cx.drawImage(B, -W / 2, -H / 2);
    },
  };
  R.TRANSITIONS.push(
    { id: 'slideD', name: 'Deslizar ↓' }, { id: 'zoomOut', name: 'Zoom hacia atrás' }, { id: 'wipeU', name: 'Barrido ↑' }, { id: 'wipeDiag', name: 'Barrido diagonal' },
    { id: 'diamond', name: 'Rombo' }, { id: 'doors', name: 'Puertas' }, { id: 'pixel', name: 'Pixelado' }, { id: 'whip', name: 'Latigazo (whip)' },
    { id: 'leak', name: 'Fuga de luz' }, { id: 'clock', name: 'Reloj' }, { id: 'mosaic', name: 'Mosaico' }, { id: 'flip', name: 'Voltear' },
    { id: 'fall', name: 'Caída' }, { id: 'stripes', name: 'Franjas' }, { id: 'dreamy', name: 'Sueño' }, { id: 'tv', name: 'Apagado de TV' }, { id: 'shake', name: 'Sacudida' },
  );
  const baseComposite = R.composite;
  R.composite = (cx, A, B, type, p, W, H) => {
    const f = TR[type]; if (!f) return baseComposite(cx, A, B, type, p, W, H);
    p = clamp(p, 0, 1); cx.save(); try { f(cx, A, B, ease(p), p, W, H); } finally { cx.restore(); }
  };

  /* =================== MOVIMIENTOS DE CÁMARA =================== */
  /* devuelve [escala, dx, dy, rotación] para el instante pr (0..1) del clip; k = intensidad; lt = segundos */
  const MO = {
    pulse: (pr, k, lt) => [1 + k * 0.5 + Math.sin(lt * 2.4) * k * 0.3, 0, 0, 0],
    handheld: (pr, k, lt) => [1 + k * 0.7, Math.sin(lt * 1.9) * k * 0.12 + Math.sin(lt * 4.3) * k * 0.05, Math.cos(lt * 2.3) * k * 0.1 + Math.sin(lt * 5.1) * k * 0.04, Math.sin(lt * 1.3) * k * 0.05],
    tilt: (pr, k) => [1 + k * 1.1, 0, 0, (pr - 0.5) * k * 0.55],
    diag: (pr, k) => [1 + k * 1.2, (pr - 0.5) * k * 0.9, (pr - 0.5) * k * 0.9, 0],
    punch: (pr, k, lt) => [1 + k * 0.35 + k * 1.1 * Math.pow(1 - clamp(lt / 0.45, 0, 1), 3), 0, 0, 0],
    float: (pr, k, lt) => [1 + k * 0.6, 0, Math.sin(lt * 1.2) * k * 0.22, 0],
    dolly: (pr, k) => [1 + k * 2.2 * ease(pr), 0, 0, (pr - 0.5) * k * 0.2],
  };
  R.MOTIONS.push({ id: 'pulse', name: 'Latido' }, { id: 'handheld', name: 'Cámara en mano' }, { id: 'tilt', name: 'Inclinación' }, { id: 'diag', name: 'Diagonal' },
    { id: 'punch', name: 'Golpe de zoom' }, { id: 'float', name: 'Flotar' }, { id: 'dolly', name: 'Travelling (dolly)' });

  /* =================== FILTROS (con efectos sobre la imagen) =================== */
  R.BASE_FILTERS.push(
    { id: 'hdr', name: 'HDR', css: 'contrast(1.3) saturate(1.35) brightness(1.03)', vig: 0.2 },
    { id: 'atardecer', name: 'Atardecer', css: 'sepia(.35) saturate(1.5) hue-rotate(-18deg) contrast(1.05)', vig: 0.3, fx: { tint: ['rgba(255,120,40,.22)', 'rgba(120,30,90,.2)'] } },
    { id: 'tealorange', name: 'Teal & Orange', css: 'contrast(1.18) saturate(1.25)', vig: 0.35, fx: { tint: ['rgba(0,150,170,.2)', 'rgba(255,130,40,.2)'] } },
    { id: 'pastel', name: 'Pastel', css: 'saturate(.75) brightness(1.12) contrast(.88)', vig: 0, fx: { tint: ['rgba(255,190,220,.14)', 'rgba(170,210,255,.14)'] } },
    { id: 'neon', name: 'Neón', css: 'saturate(1.9) contrast(1.25) brightness(.95) hue-rotate(-12deg)', vig: 0.5, fx: { tint: ['rgba(255,0,170,.16)', 'rgba(0,220,255,.16)'] } },
    { id: 'matrix', name: 'Matrix', css: 'grayscale(.6) sepia(.5) hue-rotate(70deg) saturate(1.6) contrast(1.15)', vig: 0.5, fx: { scan: 0.12 } },
    { id: 'pelicula', name: 'Película 35 mm', css: 'contrast(1.1) saturate(.92) sepia(.12)', vig: 0.45, fx: { grain: 0.16 } },
    { id: 'vhs', name: 'VHS retro', css: 'saturate(1.35) contrast(1.1) brightness(1.04) hue-rotate(-6deg)', vig: 0.3, fx: { scan: 0.2, grain: 0.1, rgb: 1 } },
    { id: 'sepia', name: 'Sepia antiguo', css: 'sepia(.9) contrast(1.05) brightness(.98)', vig: 0.55, fx: { grain: 0.18, dust: 1 } },
    { id: 'fugaluz', name: 'Fuga de luz', css: 'saturate(1.15) brightness(1.05)', vig: 0.15, fx: { leak: 0.55 } },
    { id: 'terror', name: 'Terror', css: 'grayscale(.55) contrast(1.5) brightness(.72) hue-rotate(-10deg)', vig: 0.85, fx: { grain: 0.14, tint: ['rgba(120,0,0,.14)', 'rgba(0,20,40,.2)'] } },
    { id: 'ensueno', name: 'Ensueño', css: 'brightness(1.12) saturate(1.2) contrast(.92)', vig: 0, fx: { glow: 0.35 } },
  );
  const glowC = document.createElement('canvas'), scanC = document.createElement('canvas');
  let noise = null;
  const noiseTile = () => {
    if (noise) return noise; noise = document.createElement('canvas'); noise.width = noise.height = 192;
    const x = noise.getContext('2d'), d = x.createImageData(192, 192); let s = 9973;
    for (let i = 0; i < d.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = s % 256; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); return noise;
  };
  function applyFx(cx, fx, lt, W, H) {
    const base = Math.min(W, H); cx.save();
    if (fx.tint) { const g = cx.createLinearGradient(0, 0, W, H); g.addColorStop(0, fx.tint[0]); g.addColorStop(1, fx.tint[1]); cx.globalCompositeOperation = 'soft-light'; cx.fillStyle = g; cx.fillRect(0, 0, W, H); cx.globalCompositeOperation = 'source-over'; cx.fillRect(0, 0, W, H); }
    if (fx.glow) { const w = Math.max(8, Math.round(W / 12)), h = Math.max(8, Math.round(H / 12)); if (glowC.width !== w || glowC.height !== h) { glowC.width = w; glowC.height = h; } glowC.getContext('2d').drawImage(cx.canvas, 0, 0, w, h); cx.globalCompositeOperation = 'screen'; cx.globalAlpha = fx.glow; cx.imageSmoothingQuality = 'high'; cx.drawImage(glowC, 0, 0, w, h, 0, 0, W, H); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; }
    if (fx.leak) {
      const gx = W * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(lt * 0.7))), g = cx.createRadialGradient(gx, 0, 0, gx, 0, Math.max(W, H) * 0.8);
      g.addColorStop(0, 'rgba(255,210,140,.9)'); g.addColorStop(0.4, 'rgba(255,110,40,.45)'); g.addColorStop(1, 'rgba(255,60,0,0)');
      cx.globalCompositeOperation = 'screen'; cx.globalAlpha = fx.leak * (0.75 + 0.25 * Math.sin(lt * 1.7)); cx.fillStyle = g; cx.fillRect(0, 0, W, H); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    }
    if (fx.rgb) { const o = Math.max(1, Math.round(base * 0.004)); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.16; cx.drawImage(cx.canvas, o, 0, W, H); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; }
    if (fx.scan) { const st = Math.max(2, Math.round(H / 240)); if (scanC.height !== st * 2) { scanC.width = 4; scanC.height = st * 2; const x = scanC.getContext('2d'); x.clearRect(0, 0, 4, st * 2); x.fillStyle = '#000'; x.fillRect(0, 0, 4, st); } cx.globalAlpha = fx.scan; cx.fillStyle = cx.createPattern(scanC, 'repeat'); cx.fillRect(0, 0, W, H); cx.globalAlpha = 1; }
    if (fx.grain) { const n = noiseTile(), f = Math.floor(lt * 24), k = Math.max(1, base / 540); cx.globalCompositeOperation = 'overlay'; cx.globalAlpha = fx.grain; const ox = (f * 53) % 192, oy = (f * 97) % 192; for (let y = -oy * k; y < H; y += 192 * k) for (let x = -ox * k; x < W; x += 192 * k) cx.drawImage(n, x, y, 192 * k, 192 * k); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; }
    if (fx.dust) { let s = Math.floor(lt * 12) * 7919 + 13; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = Math.max(1, base * 0.0016); for (let i = 0; i < 3; i++) if (rnd() > 0.55) { const x = rnd() * W; cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x + (rnd() - 0.5) * 6, H); cx.stroke(); } }
    cx.restore();
  }

  const baseDraw = R.drawClip;
  R.drawClip = (cx, clip, lt, W, H) => {
    const mo = MO[clip.motion], f = clip._filter || R.filter(clip.filter), fx = f && f.fx;
    if (!mo && !fx) return baseDraw(cx, clip, lt, W, H);
    const text = clip.text, motion = clip.motion;
    try {
      clip.text = '';
      if (mo) {
        const k = clip.motionAmt ?? 0.15, pr = clip.duration ? clamp(lt / clip.duration, 0, 1) : 0, [s, dx, dy, rot] = mo(pr, k, lt);
        clip.motion = 'none'; cx.save(); cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
        cx.translate(W / 2 + dx * W, H / 2 + dy * H); if (rot) cx.rotate(rot); cx.scale(s, s); cx.translate(-W / 2, -H / 2);
        baseDraw(cx, clip, lt, W, H); cx.restore();
      } else baseDraw(cx, clip, lt, W, H);
    } finally { clip.text = text; clip.motion = motion; }
    if (fx) applyFx(cx, fx, lt, W, H);
    if (text) R.drawText(cx, clip, lt, W, H);
  };

  /* =================== TEXTOS =================== */
  R.TEXT_STYLES.push({ id: 'meme', name: 'Impacto (borde negro)' }, { id: 'neon', name: 'Neón brillante' }, { id: 'caja', name: 'Caja de color' });
  R.TEXT_ANIMS.splice(R.TEXT_ANIMS.length - 1, 0, { id: 'slide', name: 'Entrar de lado' }, { id: 'zoom', name: 'Zoom de entrada' }, { id: 'drop', name: 'Caer con rebote' }, { id: 'flicker', name: 'Parpadeo neón' });
  const MY_ANIM = { slide: 1, zoom: 1, drop: 1, flicker: 1 }, MY_STYLE = { meme: 1, neon: 1, caja: 1 };
  const font = (w, s) => `${w} ${s}px Inter, "Segoe UI", Arial, sans-serif`;
  function drawStyle(cx, clip, lt, W, H) {
    const base = Math.min(W, H), st = clip.textStyle, an = clip.textAnim || 'fade', color = clip.textColor || '#ffffff';
    const p = an === 'none' || an === 'type' ? 1 : clamp(lt / 0.6, 0, 1), e = easeOut(p);
    cx.save(); cx.globalAlpha *= e; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    const cut = (lines) => { if (an !== 'type') return lines; let n = Math.floor(lt * 30); return lines.map((l) => { const s = l.slice(0, Math.max(0, n)); n -= l.length + 1; return s; }); };
    const pivot = (x, y) => { if (an === 'up') cx.translate(0, (1 - e) * base * 0.06); if (an === 'pop') { const s = 0.6 + 0.4 * backOut(p); cx.translate(x, y); cx.scale(s, s); cx.translate(-x, -y); } };
    if (st === 'meme') {
      const fs = base * 0.082, lh = fs * 1.12; cx.font = `900 ${fs}px Impact, "Arial Black", Inter, sans-serif`;
      const all = R.wrap(cx, String(clip.text).toUpperCase(), W * 0.9), lines = cut(all), y0 = H * (W > H ? 0.84 : 0.76) - (all.length - 1) * lh;
      pivot(W / 2, y0 + ((all.length - 1) * lh) / 2); cx.lineJoin = 'round'; cx.lineWidth = fs * 0.2; cx.strokeStyle = '#000'; cx.fillStyle = color;
      lines.forEach((l, i) => { cx.strokeText(l, W / 2, y0 + i * lh); cx.fillText(l, W / 2, y0 + i * lh); });
    } else if (st === 'neon') {
      const fs = base * 0.07, lh = fs * 1.2; cx.font = font(800, fs);
      const all = R.wrap(cx, clip.text, W * 0.84), lines = cut(all), y0 = H * 0.5 - ((all.length - 1) * lh) / 2;
      pivot(W / 2, H / 2); const glow = color.toLowerCase() === '#ffffff' ? '#ff3df2' : color;
      for (const b of [0.9, 0.45, 0.18]) { cx.shadowColor = glow; cx.shadowBlur = fs * b; cx.fillStyle = b === 0.18 ? '#ffffff' : glow; lines.forEach((l, i) => cx.fillText(l, W / 2, y0 + i * lh)); }
    } else {
      const fs = base * 0.055, lh = fs * 1.5, pad = fs * 0.4; cx.font = font(800, fs);
      const all = R.wrap(cx, clip.text, W * 0.82), lines = cut(all), yb = H * (W > H ? 0.86 : 0.78);
      pivot(W / 2, yb); const bg = color.toLowerCase() === '#ffffff' ? '#ffd400' : color;
      all.forEach((full, i) => {
        const y = yb - (all.length - 1 - i) * lh, tw = cx.measureText(full).width;
        cx.save(); cx.translate(W / 2, y); cx.rotate(-0.012); cx.fillStyle = bg; cx.beginPath(); if (cx.roundRect) cx.roundRect(-tw / 2 - pad * 1.5, -fs / 2 - pad, tw + pad * 3, fs + pad * 2, fs * 0.16); else cx.rect(-tw / 2 - pad * 1.5, -fs / 2 - pad, tw + pad * 3, fs + pad * 2); cx.fill();
        cx.fillStyle = '#111'; cx.fillText(lines[i], 0, fs * 0.04); cx.restore();
      });
    }
    cx.restore();
  }
  const baseText = R.drawText;
  R.drawText = (cx, clip, lt, W, H) => {
    const an = clip.textAnim || 'fade';
    if (an === 'words') return baseText(cx, clip, lt, W, H);   // reparte los grupos y vuelve a entrar aquí con «pop»
    const inner = (c) => (MY_STYLE[c.textStyle] ? drawStyle(cx, c, lt, W, H) : baseText(cx, c, lt, W, H));
    if (!MY_ANIM[an]) return inner(clip);
    const base = Math.min(W, H), p = clamp(lt / 0.6, 0, 1), e = easeOut(p), py = clip.textStyle === 'titulo' || clip.textStyle === 'neon' ? H / 2 : H * 0.82;
    cx.save();
    if (an === 'slide') { cx.globalAlpha = e; cx.translate(-(1 - e) * W * 0.5, 0); }
    else if (an === 'zoom') { cx.globalAlpha = e; const s = 1 + (1 - e) * 1.4; cx.translate(W / 2, py); cx.scale(s, s); cx.translate(-W / 2, -py); }
    else if (an === 'drop') { const b = clamp(lt / 0.75, 0, 1), y = b < 0.55 ? -(1 - b / 0.55) * H * 0.5 : -Math.abs(Math.sin((b - 0.55) / 0.45 * Math.PI * 2)) * (1 - b) * base * 0.12; cx.globalAlpha = clamp(lt / 0.2, 0, 1); cx.translate(0, y); }
    else if (an === 'flicker') { const on = lt > 0.7 || [1, 0, 1, 1, 0, 1, 0, 1][Math.floor(lt * 12) % 8]; cx.globalAlpha = on ? 1 : 0.15; }
    inner({ ...clip, textAnim: 'none' });
    cx.restore();
  };

  R.GLYPHS = { slideD: '⇣', zoomOut: '⊝', wipeU: '▀', wipeDiag: '◢', diamond: '◆', doors: '◫', pixel: '▦', whip: '≫', leak: '☀', clock: '◔', mosaic: '▩', flip: '⇋', fall: '⤵', stripes: '▥', dreamy: '☁', tv: '▬', shake: '≈',
    pulse: '♥', handheld: '✋', tilt: '⟲', diag: '⤡', punch: '✸', float: '∿', dolly: '⇲' };

  /* =================== ESTILOS EN UN CLIC =================== */
  const L = (id, n, d, o) => ({ id, n, d, tdur: 0.6, tstyle: 'subtitulo', tanim: 'fade', color: '#ffffff', letterbox: false, bar: false, ...o });
  const LOOKS = [
    L('cine', 'Cine', 'Barras de cine, color cinematográfico y fundidos lentos', { filter: 'cine', trans: ['fade', 'black', 'dreamy'], motion: ['kenburns', 'dolly', 'zoomOut'], tdur: 1, tstyle: 'inferior', letterbox: true }),
    L('viral', 'Viral / Shorts', 'Ritmo rápido, golpes de zoom y subtítulos palabra por palabra', { filter: 'vivo', trans: ['whip', 'zoom', 'flash', 'shake'], motion: ['punch', 'zoomIn', 'pulse'], tdur: 0.35, tanim: 'words', color: '#ffd400', bar: true }),
    L('docu', 'Documental', 'Sobrio, con paneos suaves y rótulos', { filter: 'pelicula', trans: ['fade', 'black'], motion: ['kenburns', 'panR', 'panL', 'diag'], tdur: 0.9, tstyle: 'inferior' }),
    L('vhs', 'Retro VHS', 'Líneas de video, grano y apagado de TV', { filter: 'vhs', trans: ['tv', 'glitch', 'pixel'], motion: ['handheld', 'zoomIn'], tdur: 0.5, tstyle: 'meme', tanim: 'flicker' }),
    L('neon', 'Neón / Cyberpunk', 'Colores neón, glitch y texto brillante', { filter: 'neon', trans: ['glitch', 'pixel', 'stripes', 'mosaic'], motion: ['diag', 'tilt', 'pulse'], tdur: 0.5, tstyle: 'neon', tanim: 'flicker', color: '#00e5ff' }),
    L('vlog', 'Vlog cálido', 'Luz cálida, fugas de luz y cámara en mano', { filter: 'fugaluz', trans: ['leak', 'slideL', 'fade'], motion: ['handheld', 'float', 'kenburns'], tdur: 0.6, tstyle: 'caja', tanim: 'pop' }),
    L('terror', 'Terror', 'Oscuro, con grano, sacudidas y texto que parpadea', { filter: 'terror', trans: ['black', 'shake', 'glitch'], motion: ['dolly', 'handheld', 'zoomIn'], tdur: 0.7, tanim: 'flicker', color: '#ff2a2a', letterbox: true }),
    L('antiguo', 'Recuerdos', 'Sepia con polvo y rayas de película', { filter: 'sepia', trans: ['dreamy', 'fade', 'clock'], motion: ['kenburns', 'float', 'zoomOut'], tdur: 1, tstyle: 'titulo', tanim: 'fade' }),
    L('venta', 'Anuncio de venta', 'Colores vivos, cajas amarillas y cortes con destello', { filter: 'hdr', trans: ['flash', 'whip', 'doors', 'wipeDiag'], motion: ['punch', 'zoomIn', 'diag'], tdur: 0.4, tstyle: 'caja', tanim: 'pop', color: '#ffd400', bar: true }),
    L('sueno', 'Ensueño', 'Brillo suave y tonos pastel', { filter: 'ensueno', trans: ['dreamy', 'circle', 'fade'], motion: ['float', 'kenburns'], tdur: 1, tstyle: 'titulo', tanim: 'zoom' }),
    L('epico', 'Épico', 'Teal & orange, travelling y golpes de zoom', { filter: 'tealorange', trans: ['zoom', 'zoomOut', 'leak', 'black'], motion: ['dolly', 'tilt', 'punch'], tdur: 0.7, tstyle: 'titulo', tanim: 'drop', color: '#ffd166', letterbox: true }),
    L('limpio', 'Limpio / Tutorial', 'Sin distracciones: deslizamientos y rótulos claros', { filter: 'none', trans: ['slideL', 'slideU', 'wipe'], motion: ['none', 'zoomIn', 'panR'], tdur: 0.5, tstyle: 'inferior', tanim: 'slide' }),
  ];
  const isVid = (c) => F.media.byId(c.mediaId)?.type === 'video';
  const X = (F.looks = { list: LOOKS });
  X.apply = (E, id) => {
    const p = E.p; if (!p?.clips.length) return F.toast('Añade primero imágenes o videos a la línea de tiempo');
    const k = LOOKS.find((x) => x.id === id) || LOOKS[Math.floor(Math.random() * LOOKS.length)], rnd = id === 'random', pick = (a, i) => a[rnd ? Math.floor(Math.random() * a.length) : i % a.length];
    E.api.commit();
    p.clips.forEach((c, i) => {
      const broll = c.fit === 'black';   // el b-roll de objeto sobre negro conserva su encuadre
      Object.assign(c, { filter: k.filter, transition: pick(k.trans, i), transDur: k.tdur, textStyle: broll ? c.textStyle : k.tstyle, textAnim: c.capTimes ? c.textAnim : k.tanim, textColor: k.color });
      if (!broll) { c.motion = isVid(c) ? 'none' : pick(k.motion, i); c.motionAmt = isVid(c) ? c.motionAmt : 0.15; }
    });
    p.letterbox = k.letterbox; p.progressBar = k.bar;
    E.api.after({ insp: true }); E.api.renderBin(); F.toast(`${rnd ? 'Sorpresa' : 'Estilo'}: «${k.n}» aplicado a todo el video. Ctrl+Z lo deshace.`, 'ok', 4000);
  };
  X.html = () => `<div class="pre-sub">Estilos en un clic (todo el video)</div>
    <button class="btn sm primary" data-look="random" style="grid-column:1/-1">${F.icon('sparkles')} Sorpréndeme</button>
    ${LOOKS.map((k) => `<button class="look-item" data-look="${k.id}" title="${F.esc(k.d)}"><b>${F.esc(k.n)}</b><small>${F.esc(k.d)}</small></button>`).join('')}`;
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-look]'); if (b && F.editor?.p) X.apply(F.editor, b.dataset.look); });
})();
