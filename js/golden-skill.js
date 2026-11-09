/* FRAMALY — Conocimiento completo de la skill del editor de video, visible dentro del editor.
   Botón «Todo el conocimiento de la skill» en la pestaña Golden: documento completo con índice y buscador. */
(function () {
  'use strict';
  if (!F.golden || !window.__GOLDEN_SKILL_MD) return;
  const G = F.golden, I = F.icon, esc = F.esc;

  /* mini conversor de Markdown (títulos, listas, tablas, citas, código, negritas) */
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  const render = (md) => {
    const lines = md.replace(/\r/g, '').split('\n'), out = []; let i = 0;
    const flushList = (items, tag) => `<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`;
    while (i < lines.length) {
      const l = lines[i];
      if (/^```/.test(l)) { const code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); i++; out.push(`<pre class="codebox">${esc(code.join('\n'))}</pre>`); continue; }
      if (/^---+\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      let m = l.match(/^(#{1,4})\s+(.*)$/); if (m) { out.push(`<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`); i++; continue; }
      if (/^>/.test(l)) { const q = []; while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`); continue; }
      if (/^\|/.test(l) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) {
        const row = (s) => s.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim()); const head = row(l); i += 2; const body = [];
        while (i < lines.length && /^\|/.test(lines[i])) body.push(row(lines[i++]));
        out.push(`<table class="gtab"><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table>`); continue;
      }
      if (/^\s*[-*]\s+/.test(l)) { const it = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) it.push(lines[i++].replace(/^\s*[-*]\s+/, '')); out.push(flushList(it, 'ul')); continue; }
      if (/^\s*\d+\.\s+/.test(l)) { const it = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) it.push(lines[i++].replace(/^\s*\d+\.\s+/, '')); out.push(flushList(it, 'ol')); continue; }
      if (!l.trim()) { i++; continue; }
      const p = [l]; i++; while (i < lines.length && lines[i].trim() && !/^(#|>|\||```|---|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) p.push(lines[i++]);
      out.push(`<p>${inline(p.join(' '))}</p>`);
    }
    return out.join('\n');
  };

  /** Parte el documento en secciones (por título de nivel 1 y 2) para el índice y el buscador */
  const sections = () => {
    const md = window.__GOLDEN_SKILL_MD, parts = md.split(/\n(?=#{1,2} )/), secs = []; let n = 0;
    parts.forEach((p) => { const m = p.match(/^(#{1,2}) (.*)/); if (!m) return; secs.push({ id: 'sk' + n++, lvl: m[1].length, title: m[2].replace(/\*\*/g, ''), md: p }); });
    return secs;
  };

  G.openSkill = () => {
    const secs = sections().filter((s) => s.title.trim());
    const toc = secs.map((s) => `<a href="#" class="sk-toc ${s.lvl === 1 ? 'top' : ''}" data-sk="${s.id}">${esc(s.title)}</a>`).join('');
    const body = secs.map((s) => `<section class="sk-sec" id="${s.id}" data-txt="${esc((s.title + ' ' + s.md).toLowerCase())}">${render(s.md)}</section>`).join('');
    const m = F.modal({
      title: 'Conocimiento completo de la skill · Editor de video', wide: true,
      body: `<div class="skill"><div class="sk-side"><input type="search" class="sk-q" placeholder="Buscar (ej: ducking, claims, closeup)…"><div class="sk-tocs">${toc}</div></div><div class="sk-main">${body}<p class="hint">Fuente: skill «Millora · Editor de video» y método de multicámara con una sola cámara. La Parte 3 dice dónde está cada regla dentro de la app.</p></div></div>`,
    });
    const root = m.q('.skill'), main = m.q('.sk-main');
    root.querySelector('.sk-tocs').addEventListener('click', (e) => { const a = e.target.closest('[data-sk]'); if (!a) return; e.preventDefault(); const el = main.querySelector('#' + a.dataset.sk); el?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    root.querySelector('.sk-q').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase(); let hits = 0;
      main.querySelectorAll('.sk-sec').forEach((s) => { const ok = !q || s.dataset.txt.includes(q); s.style.display = ok ? '' : 'none'; if (ok && q) hits++; });
      root.querySelectorAll('.sk-toc').forEach((a) => { const s = main.querySelector('#' + a.dataset.sk); a.style.display = s && s.style.display === 'none' ? 'none' : ''; });
      let note = root.querySelector('.sk-none'); if (q && !hits) { if (!note) { note = document.createElement('p'); note.className = 'sk-none muted'; main.prepend(note); } note.textContent = `Nada con «${q}».`; } else note?.remove();
    });
  };

  /* botón visible arriba del panel Golden */
  const baseStatus = G.status;
  G.status = (p) => `<button class="btn skill-btn" data-g="skill">${I('eye')} Todo el conocimiento de la skill<small>Método completo, multicámara con una cámara y dónde está cada regla en la app</small></button>` + (baseStatus ? baseStatus(p) : '');
  const basePlusClick = G.plusClick;
  G.plusClick = (a, b, E) => { if (a === 'skill') { G.openSkill(); return true; } return basePlusClick ? basePlusClick(a, b, E) : false; };
})();
