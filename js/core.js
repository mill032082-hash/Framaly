/* FRAMALY — núcleo: utilidades, almacenamiento, biblioteca, proyectos, UI */
(function () {
  'use strict';
  const F = (window.F = {});

  /* ---------- utilidades ---------- */
  F.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
  F.$ = (s, r = document) => r.querySelector(s);
  F.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  F.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  F.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  F.round1 = (v) => Math.round(v * 10) / 10;
  F.fmt = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); const r = s - m * 60; return String(m).padStart(2, '0') + ':' + r.toFixed(1).padStart(4, '0'); };
  F.fmtS = (s) => { s = Math.round(Math.max(0, s || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  F.bytes = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');
  F.ago = (t) => { const d = (Date.now() - t) / 1000; if (d < 60) return 'hace un momento'; if (d < 3600) return 'hace ' + Math.floor(d / 60) + ' min'; if (d < 86400) return 'hace ' + Math.floor(d / 3600) + ' h'; return new Date(t).toLocaleDateString('es'); };
  F.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  F.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  F.pool = async (items, limit, fn) => {
    const out = new Array(items.length); let i = 0;
    const worker = async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  };
  F.b64ToBlob = (b64, type) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); };
  F.download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  F.safeName = (s) => (String(s || 'framaly').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'framaly');
  F.pickFiles = (accept, multiple = true) => new Promise((res) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple;
    i.onchange = () => res([...i.files]); i.click();
  });
  F.actx = () => (F._actx ||= new (window.AudioContext || window.webkitAudioContext)());

  /* ---------- eventos ---------- */
  const evs = {};
  F.on = (n, f) => { (evs[n] ||= []).push(f); return () => (evs[n] = evs[n].filter((x) => x !== f)); };
  F.emit = (n, d) => (evs[n] || []).slice().forEach((f) => f(d));

  /* ---------- ajustes ---------- */
  const DEF = {
    keys: { openai: '', anthropic: '', elevenlabs: '', googleClientId: '' },
    textProvider: 'anthropic',
    models: { anthropic: 'claude-sonnet-5-5', openai: 'gpt-4.1-mini', image: 'gpt-image-1', tts: 'gpt-4o-mini-tts', eleven: 'eleven_multilingual_v2' },
    currentProject: null,
    customFilters: [],
    flows: [],
    cloud: { tomb: [] },
  };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('framaly.settings') || '{}'); } catch (e) { saved = {}; }
  F.settings = { ...DEF, ...saved, keys: { ...DEF.keys, ...(saved.keys || {}) }, models: { ...DEF.models, ...(saved.models || {}) }, cloud: { ...DEF.cloud, ...(saved.cloud || {}) } };
  F.saveSettings = () => { try { localStorage.setItem('framaly.settings', JSON.stringify(F.settings)); } catch (e) {} F.emit('settings'); };

  /* ---------- iconos (trazos estilo lucide) ---------- */
  const IC = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    film: '<rect x="2" y="2" width="20" height="20" rx="2.2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
    script: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    sparkles: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6z"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    workflow: '<rect x="3" y="3" width="8" height="8" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
    folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    plug: '<path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    skip: '<path d="M19 20 9 12l10-8zM5 19V5"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    youtube: '<path d="M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
    bot: '<path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    wand: '<path d="m21.6 3.6-1.2-1.2a1.2 1.2 0 0 0-1.7 0L2.4 18.6a1.2 1.2 0 0 0 0 1.7l1.3 1.3a1.2 1.2 0 0 0 1.7 0L21.6 5.4a1.2 1.2 0 0 0 0-1.8M14 7l3 3M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  };
  F.icon = (n, cls = '') => `<svg class="i ${n === 'play' ? 'fill ' : ''}${cls}" viewBox="0 0 24 24">${IC[n] || IC.zap}</svg>`;
  F.icon.names = IC;

  /* ---------- IndexedDB ---------- */
  F.db = {
    open() {
      return (this._p ||= new Promise((res, rej) => {
        const r = indexedDB.open('framaly', 1);
        r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('projects', { keyPath: 'id' }); d.createObjectStore('media', { keyPath: 'id' }); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      }));
    },
    async tx(store, mode, fn) {
      const d = await this.open();
      return new Promise((res, rej) => {
        const t = d.transaction(store, mode); const req = fn(t.objectStore(store));
        t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    },
    put(s, v) { return this.tx(s, 'readwrite', (o) => o.put(v)); },
    get(s, id) { return this.tx(s, 'readonly', (o) => o.get(id)); },
    all(s) { return this.tx(s, 'readonly', (o) => o.getAll()); },
    del(s, id) { return this.tx(s, 'readwrite', (o) => o.delete(id)); },
    clear(s) { return this.tx(s, 'readwrite', (o) => o.clear()); },
  };

  /* ---------- Biblioteca de medios ---------- */
  F.media = {
    list: [], urls: new Map(), imgs: new Map(), bufs: new Map(),
    async load() { this.list = (await F.db.all('media')).sort((a, b) => b.created - a.created); },
    byId(id) { return this.list.find((m) => m.id === id); },
    images() { return this.list.filter((m) => m.type === 'image'); },
    audios() { return this.list.filter((m) => m.type === 'audio'); },
    url(m) { if (typeof m === 'string') m = this.byId(m); if (!m) return ''; if (!this.urls.has(m.id)) this.urls.set(m.id, URL.createObjectURL(m.blob)); return this.urls.get(m.id); },
    async add({ type, name, blob, source = 'upload', meta = {} }) {
      const m = { id: F.uid(), type, name: name || (type === 'image' ? 'Imagen' : 'Audio'), blob, source, meta, size: blob.size, created: Date.now() };
      if (type === 'audio') { try { m.duration = (await this.decode(m)).duration; } catch (e) { m.duration = 0; } }
      await F.db.put('media', m);
      this.list.unshift(m);
      F.emit('media');
      return m;
    },
    async addFiles(files) {
      const out = [];
      for (const f of files) {
        const type = f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name) ? 'audio' : null;
        if (!type) { F.toast(`Formato no compatible: ${f.name}`, 'error'); continue; }
        out.push(await this.add({ type, name: f.name.replace(/\.[^.]+$/, ''), blob: f }));
      }
      if (out.length) F.toast(`${out.length} archivo(s) añadidos a la biblioteca`, 'ok');
      return out;
    },
    async rename(id, name) { const m = this.byId(id); if (!m) return; m.name = name; m.updated = Date.now(); await F.db.put('media', m); F.emit('media'); },
    async remove(id) {
      await F.db.del('media', id);
      F.cloud?.tomb('media', id);
      this.list = this.list.filter((m) => m.id !== id);
      if (this.urls.has(id)) { URL.revokeObjectURL(this.urls.get(id)); this.urls.delete(id); }
      this.imgs.delete(id); this.bufs.delete(id);
      F.emit('media');
    },
    image(id) {
      if (this.imgs.has(id)) return this.imgs.get(id).p;
      const m = this.byId(id);
      const img = new Image();
      const p = new Promise((res, rej) => {
        if (!m) return rej(new Error('Imagen no encontrada'));
        img.onload = () => { F.emit('imgload', id); res(img); };
        img.onerror = rej;
        img.src = this.url(m);
      });
      p.catch(() => {});
      this.imgs.set(id, { img, p });
      return p;
    },
    imgSync(id) {
      const e = this.imgs.get(id);
      if (!e) { this.image(id); return null; }
      return e.img.complete && e.img.naturalWidth ? e.img : null;
    },
    async decode(m) {
      if (typeof m === 'string') m = this.byId(m);
      if (!m) throw new Error('Audio no encontrado');
      if (this.bufs.has(m.id)) return this.bufs.get(m.id);
      const buf = await F.actx().decodeAudioData(await m.blob.arrayBuffer());
      this.bufs.set(m.id, buf);
      return buf;
    },
  };

  /* ---------- Proyectos ---------- */
  F.newClip = (mediaId, extra = {}) => ({
    id: F.uid(), mediaId, duration: 4, fit: 'cover', motion: 'kenburns', motionAmt: 0.15, filter: 'none',
    transition: 'fade', transDur: 0.8, text: '', textStyle: 'subtitulo', textAnim: 'fade', textColor: '#ffffff', ...extra,
  });
  F.projects = {
    list: [],
    async load() { this.list = (await F.db.all('projects')).sort((a, b) => b.updated - a.updated); },
    blank(name = 'Proyecto sin título', aspect = '16:9') {
      return { id: F.uid(), name, aspect, fps: 30, clips: [], audio: [], watermark: '', letterbox: false, progressBar: false, meta: { title: '', description: '', tags: '' }, created: Date.now(), updated: Date.now() };
    },
    async create(name, aspect) { const p = this.blank(name, aspect); await this.save(p); this.setCurrent(p.id); return p; },
    async save(p) {
      p.updated = Date.now();
      await F.db.put('projects', JSON.parse(JSON.stringify(p)));
      const i = this.list.findIndex((x) => x.id === p.id);
      if (i < 0) this.list.unshift(p); else this.list[i] = p;
      this.list.sort((a, b) => b.updated - a.updated);
      F.emit('projects');
    },
    get(id) { return this.list.find((p) => p.id === id); },
    current() { return this.get(F.settings.currentProject) || null; },
    setCurrent(id) { F.settings.currentProject = id; F.saveSettings(); F.emit('projects'); },
    async ensureCurrent() {
      let p = this.current();
      if (!p) { p = this.list[0] || (await this.create('Mi primer video', '16:9')); this.setCurrent(p.id); }
      return p;
    },
    async remove(id) {
      await F.db.del('projects', id);
      F.cloud?.tomb('projects', id);
      this.list = this.list.filter((p) => p.id !== id);
      if (F.settings.currentProject === id) this.setCurrent(this.list[0]?.id || null);
      F.emit('projects');
    },
    duration(p) { return p.clips.reduce((a, c) => a + c.duration, 0); },
    thumb(p) { const c = p.clips.find((c) => F.media.byId(c.mediaId)); return c ? F.media.url(c.mediaId) : ''; },
  };

  /** Añade medios al proyecto actual del editor */
  F.addToEditor = async (ids, kind) => {
    const p = await F.projects.ensureCurrent();
    let nImg = 0, nAud = 0;
    for (const id of [].concat(ids)) {
      const m = F.media.byId(id); if (!m) continue;
      if (m.type === 'image') { p.clips.push(F.newClip(id)); nImg++; }
      else {
        const k = kind || (m.source === 'ai' ? 'voz' : 'musica');
        p.audio.push({ id: F.uid(), mediaId: id, start: 0, volume: k === 'musica' ? 0.25 : 1, loop: k === 'musica', fadeOut: k === 'musica', kind: k });
        nAud++;
      }
    }
    await F.projects.save(p);
    F.emit('project-changed', p.id);
    F.toast(`Añadido a "${p.name}": ${nImg ? nImg + ' imagen(es)' : ''}${nImg && nAud ? ' y ' : ''}${nAud ? nAud + ' audio(s)' : ''}`, 'ok');
  };

  /* ---------- UI: toasts y modales ---------- */
  F.toast = (msg, type = 'info', ms = 3600) => {
    const box = F.$('#toasts'); if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = F.icon(type === 'error' ? 'x' : type === 'ok' ? 'check' : 'zap') + '<span>' + F.esc(msg) + '</span>';
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, type === 'error' ? ms + 2500 : ms);
  };
  F.modal = ({ title, body = '', actions = [], wide = false, locked = false, onClose }) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><div class="modal-h"><h3>${F.esc(title)}</h3>${locked ? '' : `<button class="icon-btn" data-x>${F.icon('x')}</button>`}</div><div class="modal-b">${body}</div>${actions.length ? `<div class="modal-f">${actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}" data-a="${i}">${a.label}</button>`).join('')}</div>` : ''}</div>`;
    document.body.appendChild(wrap);
    let closed = false;
    const close = () => { if (closed) return; closed = true; wrap.remove(); onClose?.(); };
    wrap.addEventListener('mousedown', (e) => { if (!locked && e.target === wrap) close(); });
    wrap.addEventListener('click', async (e) => {
      if (e.target.closest('[data-x]')) return close();
      const b = e.target.closest('[data-a]');
      if (b) { const a = actions[+b.dataset.a]; const r = await a.onClick?.(wrap); if (r !== false) close(); }
    });
    return { el: wrap, close, q: (s) => wrap.querySelector(s) };
  };
  F.confirm = (title, text, okLabel = 'Confirmar', danger = true) => new Promise((res) => {
    F.modal({ title, body: `<p class="muted" style="margin:0">${text}</p>`, onClose: () => res(false), actions: [
      { label: 'Cancelar', onClick: () => res(false) },
      { label: okLabel, primary: !danger, danger, onClick: () => res(true) },
    ] });
  });
  F.prompt = (title, value = '', label = '') => new Promise((res) => {
    const m = F.modal({ title, body: `${label ? `<label class="lbl">${label}</label>` : ''}<input type="text" id="pIn" value="${F.esc(value)}">`, onClose: () => res(null), actions: [
      { label: 'Cancelar', onClick: () => res(null) },
      { label: 'Aceptar', primary: true, onClick: (w) => res(w.querySelector('#pIn').value.trim()) },
    ] });
    const i = m.q('#pIn'); i.focus(); i.select();
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { res(i.value.trim()); m.close(); } });
  });
  F.busy = (btn, on, label) => {
    if (!btn) return;
    if (on) { btn._html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${label || 'Procesando…'}`; }
    else { btn.disabled = false; if (btn._html) btn.innerHTML = btn._html; }
  };
})();
