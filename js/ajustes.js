/* FRAMALY — Ajustes: cuenta, ejecución de videos, exportación, agentes de IA, datos y ayuda.
   Cada opción escribe en los mismos valores que ya usan las otras secciones, así que cambiarla tiene efecto real. */
(function () {
  'use strict';
  const I = F.icon, R = F.R, V = F.views;
  const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem('framaly.' + k) || '{}') }; } catch (e) { return { ...d }; } };
  const store = (k, v) => { try { localStorage.setItem('framaly.' + k, JSON.stringify(v)); } catch (e) {} };
  const opt = (pairs, sel) => pairs.map(([v, n]) => `<option value="${F.esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${F.esc(n)}</option>`).join('');
  const TONES = ['informativo y entretenido', 'misterioso e intrigante', 'motivacional e inspirador', 'humorístico y cercano', 'educativo y claro', 'épico y dramático', 'emotivo y narrativo', 'enérgico estilo viral'];
  const VERSION = '1.0';

  /* Pantalla a la que llega el conector (ChatGPT, Claude…) para pedir permiso */
  V.conectar = (el) => {
    const C = F.cloud, req = new URLSearchParams((location.hash.split('?')[1] || '')).get('req') || '';
    el.innerHTML = `<div class="page"><div class="card" id="cnx" style="max-width:560px;margin:24px auto"><p class="muted" style="margin:0">Cargando…</p></div></div>`;
    const box = el.querySelector('#cnx'); let dead = false;
    const fail = (m) => { box.innerHTML = `<h3>${I('shield')} Conectar aplicación</h3><p class="muted">${F.esc(m)}</p><a class="btn" href="#/inicio">Ir al inicio</a>`; };
    (async () => {
      if (!/^[0-9a-f-]{36}$/.test(req)) return fail('Este enlace no es válido. Vuelve a la aplicación e inténtalo de nuevo.');
      if (!C?.configured() || !C.user || !C.approved()) return fail('Primero inicia sesión en FRAMALY con una cuenta aprobada.');
      let info; try { info = await C.oauthInfo(req); } catch (e) { return fail(e.message); }
      if (dead) return;
      if (!info) return fail('Esta solicitud venció o ya se respondió. Vuelve a la aplicación e inténtalo de nuevo.');
      box.innerHTML = `<h3>${I('plug')} Conectar «${F.esc(info.client_name)}» con FRAMALY</h3>
        <p><b>${F.esc(info.client_name)}</b> <span class="mini">(${F.esc(info.redirect_host || '')})</span> quiere usar tu cuenta <b>${F.esc(C.user.email || '')}</b> para:</p>
        <ul class="small" style="line-height:1.9;padding-left:18px"><li>Escribir guiones, generar imágenes y voces con tus claves de IA, <b>respetando tus topes de gasto</b>.</li><li>Traer imágenes y audios a tu biblioteca.</li><li>Crear proyectos de video y ver tus proyectos y tu biblioteca.</li></ul>
        <p class="mini">No podrá ver tus claves de IA ni cambiar tus ajustes. Puedes quitarle el acceso cuando quieras en <b>Ajustes → Conectar con ChatGPT y otras IAs</b>.</p>
        <div class="row" style="gap:8px;margin-top:14px"><button class="btn primary" id="cnxOk">Permitir</button><button class="btn" id="cnxNo">Cancelar</button></div>`;
      const go = async (allow) => {
        const b = box.querySelector(allow ? '#cnxOk' : '#cnxNo'); F.busy(b, true, allow ? 'Conectando…' : '…');
        try {
          const r = await C.oauthDecide(req, allow), u = new URL(r.redirect_uri);
          if (r.error) u.searchParams.set('error', r.error); else u.searchParams.set('code', r.code);
          if (r.state) u.searchParams.set('state', r.state);
          box.innerHTML = `<h3>${I('check')} ${allow ? 'Listo' : 'Cancelado'}</h3><p class="muted">${allow ? 'Volviendo a la aplicación…' : 'No se dio acceso.'}</p>`;
          location.href = u.toString();
        } catch (e) { F.toast(e.message, 'error', 6000); fail(e.message); }
      };
      box.querySelector('#cnxOk').onclick = () => go(true); box.querySelector('#cnxNo').onclick = () => go(false);
    })();
    return () => { dead = true; };
  };

  V.ajustes = (el) => {
    const S = F.settings;
    const au = load('auto', { topic: '', aspect: '16:9', duration: 60, style: 'cine', exportAfter: true });
    const pub = load('pub', { format: F.Engine.supportsMp4() ? 'mp4' : 'webm', quality: 'high', privacy: 'private', category: '22', thumbStyle: 'impacto', thumbUpload: true });
    const sc = load('script', { tone: TONES[0], audience: 'público general', language: 'español', provider: 'auto', voice: 'nova' });
    const im = load('img', { prompt: '', style: 'cine', size: '1536x1024', quality: 'medium', n: 1, provider: 'openai' });
    // cada formulario guarda su grupo; "data-g" dice a cuál pertenece
    const vz = load('voice', { provider: 'openai' });
    const groups = { auto: au, pub, script: sc, img: im, voice: vz };
    const sel = (g, k, label, options, extra = '') => `<div><label class="lbl">${label}</label><select data-g="${g}" data-k="${k}" ${extra}>${opt(options, groups[g][k])}</select></div>`;
    const txt = (g, k, label, ph = '') => `<div><label class="lbl">${label}</label><input type="text" data-g="${g}" data-k="${k}" value="${F.esc(groups[g][k])}" placeholder="${F.esc(ph)}"></div>`;

    el.innerHTML = `<div class="page">
      <div class="card" id="aPeople" style="display:none;margin-bottom:16px"></div>
      <div class="card" id="aConn" style="display:none;margin-bottom:16px"></div>
      <div class="split even">
        <div class="card" id="aCuenta"></div>
        <div class="card"><h3>${I('zap')} Ejecución de videos</h3><p class="desc">Valores con los que arrancan el modo automático y los proyectos nuevos.</p>
          <div class="grid2">${sel('auto', 'aspect', 'Formato', R.ASPECTS)}${sel('auto', 'duration', 'Duración', [[30, '30 segundos'], [60, '1 minuto'], [90, '1,5 minutos'], [120, '2 minutos'], [180, '3 minutos'], [300, '5 minutos']])}
            ${sel('auto', 'style', 'Estilo visual', Object.entries(F.STYLES).filter(([k]) => k !== 'ninguno').map(([k, v]) => [k, v.name]))}
            <div><label class="lbl">FPS de proyectos nuevos</label><select id="aFps">${opt([[24, '24'], [30, '30'], [60, '60']], S.defaultFps || 30)}</select></div></div>
          <label class="check"><input type="checkbox" data-g="auto" data-k="exportAfter" ${au.exportAfter ? 'checked' : ''}> Exportar el MP4 automáticamente al terminar</label></div>
      </div>
      <div class="split even" style="margin-top:16px">
        <div class="card"><h3>${I('film')} Exportación y publicación</h3><p class="desc">Cómo se exporta el video y cómo se sube a YouTube.</p>
          <div class="grid2">${sel('pub', 'format', 'Formato de archivo', [['mp4', 'MP4' + (F.Engine.supportsMp4() ? '' : ' (no compatible)')], ['webm', 'WebM']])}${sel('pub', 'quality', 'Calidad', [['high', 'Alta'], ['medium', 'Media'], ['low', 'Ligera']])}
            ${sel('pub', 'privacy', 'Visibilidad en YouTube', [['private', 'Privado'], ['unlisted', 'No listado'], ['public', 'Público']])}</div>
          <p class="hint">La exportación se graba en tiempo real: un video de 3 minutos tarda unos 3 minutos. Usa Chrome o Edge.</p></div>
        <div class="card"><h3>${I('bot')} Agentes de IA</h3><p class="desc">Preferencias de los agentes que escriben, dibujan y narran. Las claves y los modelos están en <a href="#/integraciones">Integraciones API</a>.</p>
          <label class="lbl">Proveedor de texto preferido</label><div class="seg" id="aTp"><button data-v="anthropic">Claude</button><button data-v="openai">OpenAI</button><button data-v="gemini">Gemini</button><button data-v="minimax">MiniMax</button></div>
          <div class="grid2" style="margin-top:12px">${txt('script', 'language', 'Idioma de los guiones', 'español')}${sel('script', 'tone', 'Tono', TONES.map((t) => [t, t[0].toUpperCase() + t.slice(1)]))}
            ${sel('script', 'voice', 'Voz por defecto (OpenAI)', [['', 'Sin voz'], ...F.api.OPENAI_VOICES.map((v) => [v, v])])}${sel('img', 'provider', 'Generador de imágenes', [['openai', 'OpenAI'], ['gemini', 'Gemini'], ['minimax', 'MiniMax']])}${sel('voice', 'provider', 'Proveedor de voz', [['openai', 'OpenAI'], ['elevenlabs', 'ElevenLabs'], ['gemini', 'Gemini'], ['minimax', 'MiniMax']])}${sel('img', 'quality', 'Calidad de imágenes', [['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta']])}
            ${sel('img', 'size', 'Tamaño de imágenes', [['1536x1024', 'Horizontal'], ['1024x1536', 'Vertical'], ['1024x1024', 'Cuadrado']])}</div></div>
      </div>
      <div class="split even" style="margin-top:16px">
        <div class="card"><h3>${I('folder')} Datos y copia de seguridad</h3><p class="desc" id="aUse">Calculando almacenamiento…</p>
          <div class="row" style="flex-wrap:wrap"><button class="btn" id="aExport">${I('download')} Descargar mis proyectos</button><button class="btn" id="aImport">${I('upload')} Importar proyectos</button></div>
          <p class="hint">El archivo guarda tus proyectos. Las imágenes y los audios viajan con tu cuenta, no en el archivo.</p>
          <div class="row" style="flex-wrap:wrap;margin-top:10px"><button class="btn danger" id="dClrM">${I('trash')} Vaciar biblioteca</button><button class="btn danger" id="dClrAll">${I('trash')} Borrar todo de este dispositivo</button></div></div>
        <div class="card"><h3>${I('script')} Ayuda y acerca de</h3><p class="desc">FRAMALY Studio · versión ${VERSION}</p>
          <div class="row" style="flex-wrap:wrap"><button class="btn" id="aTour">${I('play')} Ver el tutorial de bienvenida</button><button class="btn" id="aHelp">${I('eye')} Mostrar todas las instrucciones</button></div>
          <p class="hint">Tus claves de IA se guardan solo en este navegador y no se suben a la nube.</p></div>
      </div></div>`;
    const q = (s) => el.querySelector(s);

    /* ----- cuenta ----- */
    const C = F.cloud;
    const renderCuenta = () => {
      const on = C?.configured();
      q('#aCuenta').innerHTML = `<h3>${I('shield')} Mi cuenta</h3>` + (!on
        ? `<p class="desc">Estás en modo local: tus proyectos se guardan solo en este dispositivo.</p>`
        : C.user
          ? `<div class="who" style="display:flex;align-items:center;gap:12px;margin:6px 0 14px"><span class="av" style="width:42px;height:42px;border-radius:50%;background:var(--grad);color:#fff;display:grid;place-items:center;font-weight:800">${F.esc((C.user.email || '?')[0].toUpperCase())}</span><div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis">${F.esc(C.user.email || 'Sesión iniciada')}</b><span class="small muted">${C.status === 'syncing' ? F.esc(C.progress || 'Sincronizando…') : C.status === 'error' ? F.esc(C.error) : C.last ? 'Guardado en la nube · ' + F.ago(C.last) : 'Conectado'}</span></div></div>
             <div class="row" style="flex-wrap:wrap"><button class="btn primary" id="aSync" ${C.status === 'syncing' ? 'disabled' : ''}>${I('upload')} Sincronizar ahora</button><button class="btn" id="aOut">Cerrar sesión</button></div><p class="hint">Se sincroniza solo mientras trabajas. Lo más reciente gana.</p>`
          : `<p class="desc">Inicia sesión para guardar tus proyectos en la nube.</p>`);
    };
    renderCuenta();
    const offCloud = F.on('cloud', renderCuenta);
    q('#aCuenta').addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'aSync') { F.busy(b, true, 'Sincronizando…'); try { await C.sync({ manual: true }); } catch (err) { F.toast(err.message, 'error'); } if (b.isConnected) F.busy(b, false); }
      if (b.id === 'aOut') await C.signOut();
    });

    /* ----- conectar con ChatGPT y otras IAs (servidor MCP + API) ----- */
    const TOOLS_INFO = [['framaly_status', 'Qué IAs tienes disponibles y cuánto llevas gastado hoy'], ['framaly_write_script', 'Escribe el guion de un video en escenas'], ['framaly_generate_image', 'Genera una imagen y la guarda en tu biblioteca'], ['framaly_import_image', 'Trae a tu biblioteca imágenes que ya tienes (por ejemplo, las de ChatGPT)'], ['framaly_import_audio', 'Trae audios que ya tienes: narración, música o efectos (MP3, WAV, M4A)'], ['framaly_generate_voice', 'Convierte un texto en narración (MP3)'], ['framaly_seo_metadata', 'Título, descripción y etiquetas para YouTube'], ['framaly_create_video_project', 'Crea un proyecto de video completo, listo para el editor'], ['framaly_list_projects', 'Lista tus proyectos'], ['framaly_list_media', 'Lista tu biblioteca de imágenes y audios']];
    const GPT_TXT = 'Cuando el usuario cree o suba imágenes o audios en esta conversación y pida un video, llama a framaly_create_video_project pasando todos esos archivos en openaiFileIdRefs: las imágenes en el orden en que deben salir; un solo audio será la música de fondo y varios audios serán la narración de cada escena, en orden. Añade un título y, si hay texto para narrar, una escena por imagen con su "narration". No generes imágenes ni voces nuevas si ya existen. Al terminar, di al usuario que abra FRAMALY, pulse Actualizar y exporte el MP4 desde el Editor.';
    const conn = { tokens: null, calls: [], grants: [], fresh: null, busy: false };
    const copyBtn = (v, label = 'Copiar') => `<button class="btn sm" data-copy="${F.esc(v)}">${I('copy')} ${label}</button>`;
    const renderConn = () => {
      const box = q('#aConn'); if (!box) return;
      if (!C?.configured() || !C.user || !C.approved()) { box.style.display = 'none'; return; }
      box.style.display = '';
      const url = C.mcpUrl(), key = conn.fresh?.token || 'fmk_TU_CLAVE';
      const toks = conn.tokens || [];
      const fresh = conn.fresh ? `<div class="notice" style="margin:12px 0"><div><b>Tu nueva clave «${F.esc(conn.fresh.name)}»</b> — cópiala ahora, no se podrá volver a ver:
        <div class="keyrow" style="margin-top:8px"><input type="text" readonly value="${F.esc(conn.fresh.token)}" id="aTokV" onclick="this.select()">${copyBtn(conn.fresh.token)}</div></div></div>` : '';
      const rows = toks.filter((t) => !t.revoked_at).map((t) => `<div class="row2 prow"><span><b>${F.esc(t.name)}</b> <span class="mini">· ${F.esc(t.prefix)}••••••••</span></span><span class="mini">${t.last_used_at ? 'usada ' + F.ago(new Date(t.last_used_at).getTime()) : 'sin usar'} <button class="btn sm danger" data-revoke="${t.id}" style="margin-left:8px">Revocar</button></span></div>`).join('');
      const calls = (conn.calls || []).map((c) => `<div class="row2 prow"><span><span class="tag ${c.ok ? 'ok' : 'err'}">${c.ok ? 'ok' : 'error'}</span> <b>${F.esc(c.tool)}</b> <span class="mini">${F.esc(c.token_name || '')}${c.ok ? '' : ' · ' + F.esc(c.detail || '')}</span></span><span class="mini">${F.ago(new Date(c.created_at).getTime())}${c.ms ? ' · ' + (c.ms / 1000).toFixed(1) + ' s' : ''}</span></div>`).join('');
      const apps = (conn.grants || []).map((g) => `<div class="row2 prow"><span><b>${F.esc(g.client_name)}</b> <span class="tag ok">OAuth</span></span><span class="mini">${g.last_used_at ? 'usada ' + F.ago(new Date(g.last_used_at).getTime()) : 'sin usar'} <button class="btn sm danger" data-revgrant="${g.id}" style="margin-left:8px">Quitar acceso</button></span></div>`).join('');
      box.innerHTML = `<h3>${I('plug')} Conectar con ChatGPT y otras IAs</h3>
        <p class="desc">Deja que ChatGPT, Claude u otro agente use FRAMALY por ti: escribir guiones, generar imágenes y voces y <b>crear proyectos de video</b> que aparecen en tu editor. Usa tus claves de IA y respeta tus topes de gasto.</p>
        <label class="lbl">Dirección del servidor MCP</label><div class="keyrow"><input type="text" readonly value="${F.esc(url)}" onclick="this.select()">${copyBtn(url)}</div>
        <label class="lbl">Especificación de la API (OpenAPI)</label><div class="keyrow"><input type="text" readonly value="${F.esc(url)}/openapi.json" onclick="this.select()">${copyBtn(url + '/openapi.json')}</div>
        <div class="sep"></div>
        <b style="color:var(--text)">Aplicaciones conectadas con inicio de sesión (OAuth)</b>
        <p class="mini" style="margin:4px 0 8px">Cuando conectas ChatGPT o Claude con «OAuth», aparece una ventana de FRAMALY para que pulses <b>Permitir</b>. No copias ninguna clave. Aquí las ves y les quitas el acceso.</p>
        <div>${apps || '<p class="mini" style="margin:0">Todavía no hay aplicaciones conectadas.</p>'}</div>
        <div class="sep"></div>
        <b style="color:var(--text)">Tus claves de conexión</b>
        <p class="mini" style="margin:4px 0 8px">Cada IA o programa usa su propia clave. Si una se filtra, la revocas aquí y deja de funcionar al instante.</p>
        ${fresh}
        <form class="invite-form" id="aTokForm" novalidate><input type="text" id="aTokName" placeholder="Nombre (ej: ChatGPT, Claude, Cursor)" maxlength="60" autocomplete="off"><button class="btn primary" type="submit">${I('plus')} Crear clave</button></form>
        <div style="margin-top:10px">${rows || '<p class="mini" style="margin:0">Todavía no tienes claves de conexión.</p>'}</div>
        <div class="sep"></div>
        <details class="small"><summary style="cursor:pointer;color:var(--or2)">Cómo conectarlo con ChatGPT</summary><ol class="help-steps">
          <li><b>Conector con OAuth (recomendado):</b> en ChatGPT → Ajustes → Complementos/Conectores → <b>Añadir</b> → «URL del servidor». Pega la <b>dirección del servidor MCP</b>, deja la autenticación en <b>OAuth</b> y pulsa <b>Crear</b>. Se abrirá FRAMALY: inicia sesión y pulsa <b>Permitir</b>.</li>
          <li><b>GPT personalizado:</b> en ChatGPT entra a <b>Explorar GPT → Crear</b> → pestaña <b>Configurar</b> → <b>Crear acción</b>.</li>
          <li>Pulsa <b>Importar desde URL</b> y pega la <b>especificación de la API</b> de arriba.</li>
          <li>En <b>Autenticación</b> elige <b>Clave de API → Bearer</b> y pega tu clave <code>fmk_…</code>.</li>
          <li><b>Si ya habías importado la acción</b>, ábrela y pulsa de nuevo <b>Importar desde URL</b> para actualizarla: ChatGPT guarda una copia vieja de las herramientas. En <b>Autenticación</b> pon la clave (Bearer). <b>Para que use las imágenes y audios que crees en ChatGPT</b> y los convierta en video, pega esto en las <b>Instrucciones</b> del GPT: <div class="keyrow" style="margin-top:6px"><input type="text" readonly value="${F.esc(GPT_TXT)}" onclick="this.select()">${copyBtn(GPT_TXT)}</div></li>
          <li>Guarda y dile al GPT: «<i>Crea un video de 5 escenas sobre los faros del mundo en FRAMALY</i>».</li>
          <li><b>Conector MCP de ChatGPT / Claude:</b> añade un conector personalizado con la <b>dirección del servidor MCP</b>. Si no te deja poner una cabecera de autorización, usa esta dirección que ya lleva la clave: <code>${F.esc(url)}/t/${F.esc(key)}</code> (trátala como una contraseña).</li></ol></details>
        <details class="small" style="margin-top:6px"><summary style="cursor:pointer;color:var(--or2)">Claude Desktop, Claude Code, Cursor y otros clientes MCP</summary>
          <p class="mini" style="margin:8px 0 4px">Configuración para clientes que aceptan cabeceras:</p>
          <pre class="codebox">{ "mcpServers": { "framaly": { "url": "${F.esc(url)}", "headers": { "Authorization": "Bearer ${F.esc(key)}" } } } }</pre>
          <p class="mini" style="margin:8px 0 4px">Claude Code:</p>
          <pre class="codebox">claude mcp add --transport http framaly ${F.esc(url)} --header "Authorization: Bearer ${F.esc(key)}"</pre></details>
        <details class="small" style="margin-top:6px"><summary style="cursor:pointer;color:var(--or2)">Qué puede hacer la IA conectada (10 herramientas)</summary>${TOOLS_INFO.map(([n, d]) => `<div class="row2 prow"><span><code>${n}</code></span><span class="mini" style="text-align:right">${F.esc(d)}</span></div>`).join('')}
          <p class="hint">Un proyecto creado por la IA aparece en tu Editor de video al pulsar <b>Actualizar</b>. Máximo 30 llamadas por minuto por clave. Si ChatGPT dice que no ve una herramienta nueva, vuelve a importar la especificación de la API en la acción de tu GPT.</p></details>
        <div class="sep"></div>
        <b style="color:var(--text)">Uso reciente</b>
        <div style="margin-top:6px">${calls || '<p class="mini" style="margin:0">Todavía no hubo llamadas.</p>'}</div>`;
    };
    const loadConn = async () => { if (!C?.configured() || !C.user || !C.approved()) return renderConn(); try { [conn.tokens, conn.calls, conn.grants] = await Promise.all([C.tokens(), C.apiCalls(10), C.grants().catch(() => [])]); } catch (e) { F.toast(e.message, 'error'); } renderConn(); };
    loadConn();
    q('#aConn').addEventListener('click', async (e) => {
      const cp = e.target.closest('[data-copy]');
      if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copy); F.toast('Copiado', 'ok', 1200); } catch (err) { F.toast('No se pudo copiar: selecciona el texto y usa Ctrl+C'); } return; }
      const rg = e.target.closest('[data-revgrant]');
      if (rg) { if (!(await F.confirm('Quitar acceso', 'Esa aplicación dejará de poder usar tu cuenta de FRAMALY. ¿Quitarle el acceso?', 'Quitar'))) return; try { await C.revokeGrant(rg.dataset.revgrant); F.toast('Acceso quitado', 'ok'); await loadConn(); } catch (err) { F.toast(err.message, 'error'); } return; }
      const rv = e.target.closest('[data-revoke]');
      if (rv) { if (!(await F.confirm('Revocar clave', 'La IA o el programa que use esta clave dejará de funcionar. ¿Revocarla?', 'Revocar'))) return; try { await C.revokeToken(rv.dataset.revoke); F.toast('Clave revocada', 'ok'); conn.fresh = null; await loadConn(); } catch (err) { F.toast(err.message, 'error'); } }
    });
    q('#aConn').addEventListener('submit', async (e) => {
      e.preventDefault(); if (conn.busy) return;
      const name = q('#aTokName').value.trim(); if (!name) return F.toast('Ponle un nombre a la clave');
      conn.busy = true;
      try { conn.fresh = await C.createToken(name); F.toast('Clave creada. Cópiala ahora.', 'ok', 4000); await loadConn(); q('#aTokV')?.select(); } catch (err) { F.toast(err.message, 'error'); }
      conn.busy = false;
    });
    const offConn = F.on('cloud', () => { if (!conn.tokens) loadConn(); else renderConn(); });

    /* ----- personas con acceso (solo administrador) ----- */
    let people = [], invites = [];
    const open = new Set();
    const edit = new Map();   // borradores: nada se guarda hasta pulsar «Guardar cambios»
    const SECS = [['editor', 'Editor de video'], ['flujos', 'Flujos y agentes'], ['guiones', 'Guiones'], ['imagenes', 'Imágenes'], ['voces', 'Voces'], ['efectos', 'Efectos y transiciones'], ['biblioteca', 'Biblioteca'], ['publicar', 'Publicar'], ['integraciones', 'Integraciones API'], ['ajustes', 'Ajustes']];
    const AIS = [['anthropic', 'Claude'], ['openai', 'OpenAI'], ['elevenlabs', 'ElevenLabs'], ['gemini', 'Gemini'], ['minimax', 'MiniMax']];
    // Cada API tiene dos espacios: «mi API» (FRAMALY) y «su propia API». Se guardan como un solo modo: shared · both · own · off
    const slot = (m, w) => (w === 'mine' ? ['shared', 'both'] : ['own', 'both']).includes(m || 'own');
    const toMode = (mine, own) => (mine && own ? 'both' : mine ? 'shared' : own ? 'own' : 'off');
    const ST = { pending: ['Pendiente', 'or'], approved: ['Aprobada', 'ok'], blocked: ['Rechazada', 'err'], invited: ['Preparado', 'or'] };
    const everyone = () => [...invites.map((i) => ({ user_id: 'inv:' + i.email, email: i.email, status: 'invited', role: 'user', perms: i.perms, ai: i.ai, daily_usd: i.daily_usd, created_at: i.created_at })), ...people];
    const renderPeople = () => {
      const box = q('#aPeople');
      if (!C?.isAdmin()) { box.style.display = 'none'; return; }
      box.style.display = '';
      const rows = everyone().map((p) => {
        const me = p.user_id === C.user.id, [lbl, cls] = ST[p.status] || ST.pending, inv = p.status === 'invited';
        const acts = me || p.role === 'admin' ? '' : inv
          ? `<button class="btn sm danger" data-invdel="${F.esc(p.email)}">Quitar</button>`
          : p.status === 'approved'
            ? `<button class="btn sm danger" data-p="${p.user_id}" data-s="blocked">Quitar acceso</button>`
            : `<button class="btn sm primary" data-p="${p.user_id}" data-s="approved">Aprobar</button>${p.status === 'pending' ? `<button class="btn sm" data-p="${p.user_id}" data-s="blocked">Rechazar</button>` : ''}`;
        const dr = edit.get(p.user_id), editing = !!dr, perms = (dr || p).perms || {}, ai = (dr || p).ai || {}, daily = (dr || p).daily_usd ?? 2, dis = editing ? '' : 'disabled';
        const bar = editing
          ? `<div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn primary sm" data-save="${p.user_id}">Guardar cambios</button><button class="btn sm" data-cancel="${p.user_id}">Cancelar</button><span class="mini" style="color:var(--or2)">Los cambios se aplican al pulsar Guardar.</span></div>`
          : `<div class="row" style="gap:8px;margin-top:14px"><button class="btn sm" data-edit="${p.user_id}">Editar</button><span class="mini">Pulsa Editar para cambiar sus permisos y sus IA.</span></div>`;
        const panel = open.has(p.user_id) && p.role !== 'admin' ? `<div class="perms">
            <b class="small">Puede usar:</b><div class="perm-grid">${SECS.map(([k, n]) => `<label class="check"><input type="checkbox" data-pp="${p.user_id}" data-pk="${k}" ${perms[k] === false ? '' : 'checked'} ${dis}> ${n}</label>`).join('')}</div>
            <b class="small" style="display:block;margin-top:14px">Mi API (clave de FRAMALY): ¿puede usarla?</b>
            <div class="ai-grid">${AIS.map(([k, n]) => `<div><label class="lbl">${n}</label><select data-pai="${p.user_id}" data-pak="${k}" data-slot="mine" ${dis}><option value="1" ${slot(ai[k], 'mine') ? 'selected' : ''}>Sí, con mi API</option><option value="0" ${slot(ai[k], 'mine') ? '' : 'selected'}>No</option></select></div>`).join('')}
              <div><label class="lbl">Tope diario con mi API (US$)</label><input type="number" min="0" step="0.5" data-pdaily="${p.user_id}" value="${daily}" ${dis}></div></div>
            <b class="small" style="display:block;margin-top:14px">Su propia API: ¿puede conectar la suya?</b>
            <div class="ai-grid">${AIS.map(([k, n]) => `<div><label class="lbl">${n}</label><select data-pai="${p.user_id}" data-pak="${k}" data-slot="own" ${dis}><option value="1" ${slot(ai[k], 'own') ? 'selected' : ''}>Sí, puede poner la suya</option><option value="0" ${slot(ai[k], 'own') ? '' : 'selected'}>No</option></select></div>`).join('')}</div>
            ${bar}
            <p class="hint">«Mi API»: usa tu clave sin verla y cuenta para tus límites. «Su propia API»: puede pegar su clave en Integraciones API. Con las dos en Sí elige cuál usar; con las dos en No, esa IA queda desactivada.</p></div>` : '';
        const permBtn = p.role === 'admin' || me ? '' : `<button class="btn sm" data-perm="${p.user_id}">${open.has(p.user_id) ? 'Cerrar' : 'Permisos'}</button>`;
        return `<div class="person"><span class="em"><b>${F.esc(p.email || 'Sin correo')}</b>${me ? ' <span class="small muted">(tú)</span>' : ''}<br><span class="small muted">${inv ? 'esperando que se registre' : F.ago(new Date(p.created_at).getTime())}</span></span>${p.role === 'admin' ? '<span class="tag or">Administrador</span>' : ''}<span class="tag ${cls}">${lbl}</span>${permBtn}${acts}${panel}</div>`;
      }).join('');
      box.innerHTML = `<h3>${I('shield')} Personas con acceso</h3><p class="desc">Quien se registra queda pendiente hasta que tú lo apruebes aquí. También puedes dejar un correo preparado antes de que se registre.</p>
        <form class="invite-form" id="aInv" novalidate><input type="text" inputmode="email" id="aInvMail" placeholder="correo@ejemplo.com" autocomplete="off" autocapitalize="none" spellcheck="false"><button class="btn primary" type="submit">${I('plus')} Preparar acceso</button></form>
        ${rows ? `<div class="people">${rows}</div>` : '<p class="muted">Todavía no se ha registrado nadie más.</p>'}
        <p class="hint">Un correo preparado que entra con <b>Google</b> queda aprobado al instante con lo que dejaste. Si entra con contraseña, queda pendiente con sus ajustes ya cargados y tú pulsas Aprobar.</p>`;
    };
    const loadPeople = () => C?.isAdmin() ? Promise.all([C.people(), C.invites()]).then(([l, i]) => { people = l; invites = i; renderPeople(); }).catch((e) => F.toast(e.message, 'error')) : renderPeople();
    loadPeople();
    const find = (id) => (String(id).startsWith('inv:') ? invites.find((i) => 'inv:' + i.email === id) : people.find((x) => x.user_id === id));
    q('#aPeople').addEventListener('click', async (e) => {
      const pb = e.target.closest('[data-perm]');
      if (pb) { const id = pb.dataset.perm; if (open.has(id)) { open.delete(id); edit.delete(id); } else open.add(id); return renderPeople(); }
      const ed = e.target.closest('[data-edit]');
      if (ed) { const p = find(ed.dataset.edit); if (p) edit.set(ed.dataset.edit, { perms: { ...(p.perms || {}) }, ai: { anthropic: 'own', openai: 'own', elevenlabs: 'own', gemini: 'own', minimax: 'own', ...(p.ai || {}) }, daily_usd: p.daily_usd ?? 2 }); return renderPeople(); }
      const cn = e.target.closest('[data-cancel]');
      if (cn) { edit.delete(cn.dataset.cancel); return renderPeople(); }
      const sv = e.target.closest('[data-save]');
      if (sv) {
        const id = sv.dataset.save, d = edit.get(id), p = find(id); if (!d || !p) return;
        const v = +d.daily_usd; if (!(v >= 0)) return F.toast('Escribe un monto válido para el tope diario');
        F.busy(sv, true, 'Guardando…');
        try { await C.setPerson(id, { perms: d.perms, ai: d.ai, daily_usd: v }); p.perms = d.perms; p.ai = d.ai; p.daily_usd = v; edit.delete(id); F.toast('Cambios guardados', 'ok'); renderPeople(); }
        catch (err) { F.toast(err.message, 'error'); F.busy(sv, false); }
        return;
      }
      const del = e.target.closest('[data-invdel]');
      if (del) { try { await C.removeInvite(del.dataset.invdel); F.toast('Correo quitado', 'ok'); await loadPeople(); } catch (err) { F.toast(err.message, 'error'); } return; }
      const b = e.target.closest('[data-p]'); if (!b) return;
      F.busy(b, true, '…');
      try { await C.decide(b.dataset.p, b.dataset.s); F.toast(b.dataset.s === 'approved' ? 'Persona aprobada' : 'Acceso quitado', 'ok'); await loadPeople(); } catch (err) { F.toast(err.message, 'error'); F.busy(b, false); }
    });
    q('#aPeople').addEventListener('submit', async (e) => {
      e.preventDefault();
      const mail = q('#aInvMail').value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return F.toast('Escribe un correo válido');
      if (people.some((p) => (p.email || '').toLowerCase() === mail)) return F.toast('Esa persona ya tiene cuenta. Cambia sus ajustes con el botón Permisos.');
      try { await C.addInvite(mail); open.add('inv:' + mail); F.toast('Correo preparado. Ajusta sus permisos y sus IA y pulsa Guardar cambios.', 'ok'); await loadPeople(); const np = find('inv:' + mail); if (np) { edit.set('inv:' + mail, { perms: { ...(np.perms || {}) }, ai: { anthropic: 'own', openai: 'own', elevenlabs: 'own', gemini: 'own', minimax: 'own', ...(np.ai || {}) }, daily_usd: np.daily_usd ?? 2 }); renderPeople(); } } catch (err) { F.toast(err.message, 'error'); }
    });
    const draftChange = (e) => {
      const t = e.target, id = t.dataset.pp || t.dataset.pai || t.dataset.pdaily; if (!id) return;
      const d = edit.get(id); if (!d) return;
      if (t.dataset.pp) { if (t.checked) delete d.perms[t.dataset.pk]; else d.perms[t.dataset.pk] = false; }
      else if (t.dataset.pai) {
        const k = t.dataset.pak, cur = d.ai[k] || 'own', mine = t.dataset.slot === 'mine' ? t.value === '1' : slot(cur, 'mine'), own = t.dataset.slot === 'own' ? t.value === '1' : slot(cur, 'own');
        d.ai[k] = toMode(mine, own);
        // quien pega su propia clave necesita ver Integraciones; quien no, no (se puede ajustar a mano después)
        if (Object.values(d.ai).some((v) => v === 'own' || v === 'both')) delete d.perms.integraciones;
        renderPeople();
      } else d.daily_usd = t.value;
    };
    q('#aPeople').addEventListener('change', draftChange);
    q('#aPeople').addEventListener('input', (e) => { if (e.target.dataset.pdaily) draftChange(e); });

    /* ----- opciones sueltas: se guardan al cambiar ----- */
    el.addEventListener('change', (e) => {
      const t = e.target, g = t.dataset.g, k = t.dataset.k;
      if (g && k) {
        const v = t.type === 'checkbox' ? t.checked : t.value;
        groups[g][k] = k === 'duration' ? +v : v;
        store(g, groups[g]); F.toast('Ajuste guardado', 'ok', 1400);
      }
      if (t.id === 'aFps') { S.defaultFps = +t.value; F.saveSettings(); F.toast('Ajuste guardado', 'ok', 1400); }
    });
    const tp = () => q('#aTp').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.textProvider));
    tp();
    q('#aTp').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { S.textProvider = b.dataset.v; F.saveSettings(); tp(); F.toast('Ajuste guardado', 'ok', 1400); } });

    /* ----- datos ----- */
    navigator.storage?.estimate?.().then((x) => (q('#aUse').textContent = `${F.media.list.length} archivos y ${F.projects.list.length} proyectos · ${F.bytes(x.usage || 0)} usados de ${F.bytes(x.quota || 0)}`)).catch(() => (q('#aUse').textContent = `${F.media.list.length} archivos y ${F.projects.list.length} proyectos`));
    q('#aExport').onclick = () => {
      if (!F.projects.list.length) return F.toast('Todavía no tienes proyectos');
      F.download(new Blob([JSON.stringify({ app: 'framaly', version: 1, date: new Date().toISOString(), projects: F.projects.list }, null, 1)], { type: 'application/json' }), 'framaly-proyectos-' + new Date().toISOString().slice(0, 10) + '.json');
      F.toast('Copia descargada', 'ok');
    };
    q('#aImport').onclick = async () => {
      const [f] = await F.pickFiles('.json,application/json', false); if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        const list = (j.projects || []).filter((p) => p && p.id && Array.isArray(p.clips));
        if (j.app !== 'framaly' || !list.length) throw new Error('Ese archivo no es una copia de FRAMALY.');
        for (const p of list) { p.updated = Math.max(p.updated || 0, Date.now()); await F.db.put('projects', p); }
        await F.projects.load(); F.emit('projects');
        F.toast(`${list.length} proyecto(s) importados`, 'ok'); F.router.reload();
      } catch (err) { F.toast(err.message || 'No se pudo leer el archivo', 'error'); }
    };
    q('#dClrM').onclick = async () => { if (!(await F.confirm('Vaciar biblioteca', 'Se eliminarán todas las imágenes y audios. Si usas la nube, también se borrarán de tu cuenta. No se puede deshacer.', 'Vaciar'))) return; F.media.list.forEach((m) => F.cloud?.tomb('media', m.id)); await F.db.clear('media'); F.media.list = []; F.emit('media'); F.toast('Biblioteca vaciada'); F.router.reload(); };
    q('#dClrAll').onclick = async () => { if (!(await F.confirm('Borrar todo de este dispositivo', 'Se eliminarán proyectos, biblioteca y ajustes de este dispositivo (incluidas tus API keys y la sesión). La copia que ya esté en la nube no se borra. No se puede deshacer.', 'Borrar todo'))) return; await F.db.clear('media'); await F.db.clear('projects'); Object.keys(localStorage).filter((k) => k.startsWith('framaly.')).forEach((k) => localStorage.removeItem(k)); location.reload(); };

    /* ----- ayuda ----- */
    q('#aTour').onclick = () => F.onboarding();
    q('#aHelp').onclick = () => { localStorage.removeItem('framaly.helpHidden'); Object.keys(localStorage).filter((k) => k.startsWith('framaly.seenHelp.')).forEach((k) => localStorage.removeItem(k)); F.toast('Las instrucciones vuelven a mostrarse en cada sección', 'ok'); };
    return () => { offCloud(); offConn(); };
  };
})();
