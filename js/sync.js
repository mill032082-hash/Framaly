/* FRAMALY — Montaje SINCRONIZADO del flujo automático.
   Antes: una imagen quieta por escena, el párrafo entero como subtítulo y ningún sonido.
   Ahora, por cada escena se ESCUCHA la voz ya generada y con eso:
   · se parte la narración en frases y se ubica cada frase en el audio (los cortes caen en los silencios reales),
   · cada frase es un PLANO distinto de la misma imagen (cambio de encuadre y de movimiento),
   · los subtítulos van palabra por palabra (máx. 3) con el tiempo exacto de cada grupo,
   · se colocan efectos de sonido en los cambios de escena (y ambiente si es terror),
   · la voz se nivela y la música baja cuando se habla. */
(function () {
  'use strict';
  const R = F.R, S = (F.sync = {});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  const LEAD = 0.2;   // la voz empieza un poco después del cambio de escena

  /* ---------- 1 · escuchar la voz: dónde empieza, dónde termina y dónde hay silencios ---------- */
  S.listen = (buf) => {
    const d = buf.getChannelData(0), sr = buf.sampleRate, hop = Math.max(1, Math.round(sr / 100)), n = Math.floor(d.length / hop), env = new Float32Array(n); let mx = 0, sum = 0, cnt = 0;
    for (let i = 0; i < n; i++) { let s = 0; for (let j = i * hop, e = j + hop; j < e; j += 2) s += d[j] * d[j]; env[i] = Math.sqrt(s / (hop / 2)); if (env[i] > mx) mx = env[i]; }
    const th = Math.max(0.008, mx * 0.07); let a = 0, b = n - 1;
    while (a < n && env[a] < th) a++; while (b > a && env[b] < th) b--;
    const gaps = []; let run = -1;
    for (let i = a; i <= b; i++) { if (env[i] < th) { if (run < 0) run = i; } else { if (run >= 0 && i - run >= 12) gaps.push({ a: run / 100, b: i / 100, mid: (run + i) / 200 }); run = -1; sum += env[i] * env[i]; cnt++; } }
    return { s0: a / 100, s1: Math.min(buf.duration, (b + 1) / 100), gaps, dur: buf.duration, rms: cnt ? Math.sqrt(sum / cnt) : 0 };
  };

  /* ---------- 2 · partir el texto en frases cortas ---------- */
  const words = (s) => String(s).split(/\s+/).filter(Boolean);
  S.sentences = (text) => {
    const out = [];
    for (const raw of String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])\s+/)) {
      const s = raw.trim(); if (!s) continue;
      if (words(s).length <= 13) { out.push(s); continue; }
      let cur = '';   // frase larga: se parte en las comas, sin dejar trozos de menos de 4 palabras
      for (const part of s.split(/(?<=[,;:])\s+/)) { const next = cur ? cur + ' ' + part : part; if (cur && words(cur).length >= 4 && words(next).length > 11) { out.push(cur); cur = part; } else cur = next; }
      if (cur) { if (out.length && words(cur).length < 4) out[out.length - 1] += ' ' + cur; else out.push(cur); }
    }
    return out;
  };

  /* ---------- 3 · ubicar cada frase en el audio ---------- */
  const weight = (s) => s.replace(/\s+/g, '').length + (/[.!?…]$/.test(s) ? 4 : /[,;:]$/.test(s) ? 2 : 0);
  /** Devuelve [{ text, a, b }] con los segundos (dentro del audio) en que se dice cada frase */
  S.align = (sents, info) => {
    const total = sents.reduce((a, s) => a + weight(s), 0) || 1, span = Math.max(0.2, info.s1 - info.s0), used = new Set(), cuts = [], begins = []; let cum = 0, prev = info.s0;
    for (let i = 0; i < sents.length - 1; i++) {
      cum += weight(sents[i]); let t = info.s0 + (span * cum) / total, best = -1, bd = 0.75;
      info.gaps.forEach((g, k) => { const dd = Math.abs(g.mid - t); if (!used.has(k) && dd < bd && g.mid > prev + 0.35) { bd = dd; best = k; } });
      if (best >= 0) { used.add(best); t = info.gaps[best].mid; }
      t = clamp(t, prev + 0.3, info.s1 - 0.2 * (sents.length - 1 - i)); cuts.push(t); begins.push(best >= 0 ? Math.max(t, info.gaps[best].b - 0.05) : t); prev = t;   // la frase empieza a sonar al acabar el silencio
    }
    return sents.map((text, i) => ({ text, cut: i ? cuts[i - 1] : info.s0, a: i ? begins[i - 1] : info.s0, b: i < cuts.length ? cuts[i] : info.s1 }));
  };
  /** Grupos de 3 palabras (como los pinta el editor) con el segundo en que empieza cada uno */
  S.captions = (segs) => {
    const groups = [], times = [];
    const all = []; segs.forEach((sg) => { const ws = words(sg.text), tot = ws.reduce((a, w) => a + w.length + 1, 0) || 1; let c = 0; ws.forEach((w) => { all.push({ w, t: sg.a + ((sg.b - sg.a) * c) / tot }); c += w.length + 1; }); });
    for (let i = 0; i < all.length; i += 3) { groups.push(all.slice(i, i + 3).map((x) => x.w).join(' ')); times.push(all[i].t); }
    return { text: all.map((x) => x.w).join(' '), groups, times };
  };

  /* ---------- 4 · efectos de sonido (se fabrican en el navegador, no gastan créditos) ---------- */
  const SR = 22050;
  const make = (sec, fn) => { const n = Math.round(SR * sec), d = new Float32Array(n); let seed = 12345; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; }; const st = { lp: 0 }; for (let i = 0; i < n; i++) d[i] = clamp(fn(i / SR, i / n, rnd, st), -1, 1); return d; };
  const SFX = {
    whoosh: () => make(0.55, (t, p, rnd, st) => { const cut = 0.04 + 0.5 * Math.sin(p * Math.PI) ** 2; st.lp += cut * (rnd() - st.lp); return st.lp * Math.sin(p * Math.PI) ** 2 * 1.6; }),
    boom: () => make(1.4, (t, p, rnd, st) => { const f = 34 + 46 * Math.exp(-t * 7); st.ph = (st.ph || 0) + (2 * Math.PI * f) / SR; st.lp += 0.08 * (rnd() - st.lp); return Math.sin(st.ph) * Math.exp(-t * 3.2) * 0.95 + st.lp * Math.exp(-t * 18) * 0.9; }),
    riser: () => make(1.6, (t, p, rnd, st) => { const f = 180 + 1500 * p * p; st.ph = (st.ph || 0) + (2 * Math.PI * f) / SR; st.lp += (0.05 + 0.4 * p) * (rnd() - st.lp); return (Math.sin(st.ph) * 0.25 + st.lp * 0.9) * p * p * (p > 0.97 ? (1 - p) / 0.03 : 1); }),
    shing: () => make(0.7, (t, p, rnd) => (Math.sin(2 * Math.PI * 3100 * t) * 0.35 + Math.sin(2 * Math.PI * 4650 * t) * 0.25 + Math.sin(2 * Math.PI * 6200 * t) * 0.15 + rnd() * 0.12 * Math.exp(-t * 30)) * Math.exp(-t * 6) * Math.min(1, t * 200)),
    stinger: () => make(1.8, (t, p) => [196, 207.6, 277.2, 293.7, 415.3].reduce((a, f, i) => a + Math.sin(2 * Math.PI * f * t + i) * 0.16, 0) * (1 + 0.5 * Math.sin(2 * Math.PI * 9 * t)) * Math.min(1, t * 6) * Math.exp(-Math.max(0, t - 0.5) * 2.2)),
    drone: () => make(8, (t, p, rnd, st) => { st.lp += 0.012 * (rnd() - st.lp); const e = Math.min(1, t * 2, (8 - t) * 2); return (Math.sin(2 * Math.PI * 55 * t) * 0.3 + Math.sin(2 * Math.PI * 58.3 * t) * 0.24 + Math.sin(2 * Math.PI * 82.4 * t) * 0.14 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.25 * t)) + st.lp * 2.2) * e; }),
  };
  const NAMES = { whoosh: 'Efecto · Barrido', boom: 'Efecto · Impacto grave', riser: 'Efecto · Subida de tensión', shing: 'Efecto · Destello', stinger: 'Efecto · Golpe de terror', drone: 'Ambiente · Zumbido oscuro' };
  S.sfx = async (kind) => F.media.list.find((m) => m.source === 'sfx' && m.meta?.sfx === 'sync:' + kind) || F.media.add({ type: 'audio', name: NAMES[kind], blob: F.golden.wav([SFX[kind]()], SR), source: 'sfx', meta: { sfx: 'sync:' + kind } });

  /** Género del video (para elegir sonidos, movimientos y transiciones) */
  S.genre = (cfg) => {
    const pick = cfg.montage?.sfx; if (pick && pick !== 'auto') return pick;
    const s = [cfg.images?.style, cfg.montage?.filter, cfg.idea?.tone, cfg.idea?.topic, cfg.images?.common].join(' ').toLowerCase();
    if (/terror|miedo|horror|suspens|paranormal|creepy|oscur|noir|misterio/.test(s)) return 'terror';
    if (/anime|manga|shonen|otaku|cyber|neon|neón|épic|epic|batalla/.test(s)) return 'anime';
    return 'cine';
  };
  const LOOK = {
    terror: { tr: ['black', 'shake', 'glitch', 'dreamy', 'black'], mo: ['dolly', 'handheld', 'zoomIn', 'tilt'], amt: 0.12 },
    anime: { tr: ['whip', 'zoom', 'flash', 'slideL', 'stripes'], mo: ['punch', 'diag', 'zoomIn', 'panR', 'pulse'], amt: 0.16 },
    cine: { tr: ['fade', 'leak', 'slideL', 'zoom', 'wipeDiag', 'dreamy'], mo: ['kenburns', 'zoomIn', 'panR', 'dolly', 'zoomOut', 'diag'], amt: 0.14 },
  };
  const FRAMES = [{}, { s: 1.22, x: -0.03 }, { s: 1.1, x: 0.035 }, { s: 1.36, y: 0.02 }, { s: 1.16, x: 0.02, y: -0.02 }];   // encuadres: cada frase, un plano

  /* ---------- 5 · el montaje ---------- */
  S.montage = async ({ cfg, script, imgIds, voiceIds, mus, log = () => {} }) => {
    const idea = cfg.idea, mt = cfg.montage, n = script.scenes.length, genre = S.genre(cfg), L = LOOK[genre] || LOOK.cine;
    const p = F.projects.blank(cfg.output?.name || script.title, idea.aspect), pad = clamp(+mt.padding || 0.5, 0.15, 3), tdur = clamp(Math.min(0.6, pad + 0.1), 0.25, 0.6);
    const subs = mt.subtitles || 'narracion', tstyle = ['meme', 'neon', 'caja', 'subtitulo'].includes(mt.textStyle) ? mt.textStyle : 'subtitulo';
    const valid = (list, id) => list.some((x) => x.id === id);
    let T = 0, lastImg = imgIds.find(Boolean), shots = 0, snapped = 0; const starts = [], levels = [];
    for (let i = 0; i < n; i++) {
      const sc = script.scenes[i], imgId = imgIds[i] || lastImg; lastImg = imgId; starts.push(T);
      const vm = voiceIds[i] ? F.media.byId(voiceIds[i]) : null; let info = null;
      if (vm) { try { info = S.listen(await F.media.decode(vm.id)); } catch (e) { info = null; } }
      const sents = S.sentences(sc.narration), last = i === n - 1;
      const tr = last ? 'none' : mt.transition && mt.transition !== 'auto' ? mt.transition : L.tr[i % L.tr.length];
      const sceneMo = mt.motion && mt.motion !== 'auto' ? mt.motion : L.mo[i % L.mo.length];
      // duración de la escena y lugar de cada frase (en segundos desde el inicio de la escena)
      let dur, segs;
      if (info && sents.length) {
        dur = LEAD + info.dur + pad; segs = S.align(sents, info).map((s) => ({ text: s.text, cut: LEAD + s.cut, a: LEAD + s.a, b: LEAD + s.b }));
        snapped += info.gaps.length ? 1 : 0; levels.push([vm.id, info.rms]);
      } else {
        const wps = 2.5, need = Math.max(2.5, sents.length ? words(sc.narration).length / wps + pad : (+idea.duration || 60) / n);
        dur = vm ? LEAD + (vm.duration || need) + pad : need; const a0 = vm ? LEAD : 0.1, span = Math.max(0.5, dur - pad - a0), tot = sents.reduce((a, s) => a + weight(s), 0) || 1; let c = 0;
        segs = sents.map((s) => { const a = a0 + (span * c) / tot; c += weight(s); return { text: s, cut: a, a, b: a0 + (span * c) / tot }; });
      }
      // planos: cada frase es un plano; las muy cortas se unen a la siguiente
      const groups = []; let cur = null;
      for (const sg of segs) { if (cur && cur.b - cur.a < 1.7) { cur.segs.push(sg); cur.b = sg.b; } else { cur = { a: sg.cut, b: sg.b, segs: [sg] }; groups.push(cur); } }
      if (groups.length > 1 && groups[groups.length - 1].b - groups[groups.length - 1].a < 1.2) { const g = groups.pop(), prev = groups[groups.length - 1]; prev.segs.push(...g.segs); prev.b = g.b; }
      if (!groups.length) groups.push({ a: 0, b: dur, segs: [] });
      const end = r1(T + dur); let c0 = T;
      groups.forEach((g, j) => {
        const c1 = j === groups.length - 1 ? end : Math.max(r1(c0 + 0.5), r1(T + groups[j + 1].a - 0.06)), d = r1(c1 - c0);
        const clip = F.newClip(imgId, { duration: d, filter: valid(R.filters(), mt.filter) ? mt.filter : 'none', motion: j === 0 ? sceneMo : L.mo[(i + j * 2 + 1) % L.mo.length], motionAmt: j === 0 ? L.amt : L.amt * 0.7,
          transition: j === groups.length - 1 ? tr : 'none', transDur: tdur, text: '', textStyle: tstyle, textAnim: 'words', textColor: '#ffffff' });
        const fr = FRAMES[(j + (i % 2 ? 2 : 0)) % FRAMES.length]; if (j && fr.s) clip.tf = { s: fr.s, x: fr.x || 0, y: fr.y || 0, r: 0, flip: false, op: 1 };
        if (subs === 'narracion' && g.segs.length) { const cap = S.captions(g.segs); clip.text = cap.text; clip.capTimes = cap.times.map((t) => r2(Math.max(0, T + t - c0))); }
        else if (subs === 'pantalla' && j === 0 && sc.on_screen_text) { clip.text = sc.on_screen_text; clip.textStyle = i === 0 && tstyle === 'subtitulo' ? 'titulo' : mt.textStyle || 'inferior'; clip.textAnim = mt.textAnim || 'pop'; }
        p.clips.push(clip); shots++; c0 = c1;
      });
      if (vm) p.audio.push({ id: F.uid(), mediaId: vm.id, start: r2(T + LEAD), volume: 1, loop: false, fadeOut: false, kind: 'voz' });
      T = end;
    }
    // voz al mismo nivel en todas las escenas
    const ok = levels.filter(([, v]) => v > 0); if (ok.length) { const med = ok.map(([, v]) => v).sort((a, b) => a - b)[Math.floor(ok.length / 2)]; p.audio.forEach((a) => { const lv = ok.find(([id]) => id === a.mediaId); if (lv) a.volume = r2(clamp(med / lv[1], 0.6, 1.5)); }); }
    // música y sonidos
    const hasVoice = p.audio.some((a) => a.kind === 'voz');
    if (mus) p.audio.push({ id: F.uid(), mediaId: mus.id, start: 0, volume: +cfg.music.volume || 0.18, loop: true, fadeOut: true, fadeIn: 1, kind: 'musica' });
    let nfx = 0;
    if ((mt.sfx || 'auto') !== 'ninguno' && F.golden?.wav) {
      const ev = []; const add = (k, t, v) => ev.push([k, Math.max(0, t), v]);
      starts.forEach((t, i) => { if (i) add('whoosh', t - 0.28, 0.32); });
      const lastStart = starts[n - 1], mid = starts[Math.max(1, Math.round(n * 0.65))];
      if (genre === 'terror') { add('boom', 0.05, 0.5); if (n > 3 && mid) add('stinger', mid - 0.1, 0.4); if (n > 1) { add('riser', lastStart - 1.55, 0.3); add('boom', lastStart, 0.55); } }
      else if (genre === 'anime') { add('shing', 0.1, 0.3); starts.forEach((t, i) => { if (i && i % 3 === 0) add('shing', t + 0.05, 0.22); }); if (n > 1) { add('riser', lastStart - 1.55, 0.3); add('boom', lastStart, 0.45); } }
      else { add('boom', 0.05, 0.3); if (n > 2) add('riser', lastStart - 1.55, 0.22); }
      ev.sort((a, b) => a[1] - b[1]); const keep = []; const lastOf = {};
      for (const e of ev) { if (lastOf[e[0]] !== undefined && e[1] - lastOf[e[0]] < 0.8) continue; lastOf[e[0]] = e[1]; keep.push(e); }
      for (const [k, t, v] of keep) { const m = await S.sfx(k); p.audio.push({ id: F.uid(), mediaId: m.id, start: r2(t), volume: v, loop: false, fadeOut: false, kind: 'sfx' }); nfx++; }
      if (genre === 'terror' && !mus) { const m = await S.sfx('drone'); p.audio.push({ id: F.uid(), mediaId: m.id, start: 0, volume: 0.3, loop: true, fadeOut: true, fadeIn: 1.5, kind: 'musica' }); }
    }
    if (hasVoice && p.audio.some((a) => a.kind === 'musica')) p.duck = true;
    p.fadeIn = 0.3; p.fadeOut = 0.7; if (genre === 'terror') p.letterbox = idea.aspect === '16:9';
    p.script = script; p.syncInfo = { genre, shots, scenes: n };
    log(`  · ${shots} planos en ${n} escenas (un plano por frase) · subtítulos al ritmo de la voz · ${nfx} efectos de sonido (${genre})`);
    return p;
  };
})();
