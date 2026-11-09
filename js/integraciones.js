/* FRAMALY — Integraciones API.
   Cada IA (Claude, OpenAI, ElevenLabs) se muestra según cómo la use la cuenta:
   · clave de FRAMALY (compartida, guardada en el servidor): el administrador ve consumo y límites; las personas, su cupo.
   · clave propia: la persona pega la suya y se guarda solo en su navegador.
   · sin acceso: la IA queda desactivada para esa cuenta. */
(function () {
  'use strict';
  const I = F.icon, V = F.views, esc = F.esc;
  const usd = (n) => 'US$ ' + (+n || 0).toFixed(2).replace('.', ',');
  const num = (n) => { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.', ',') + ' mil' : String(Math.round(n)); };
  const KIND = { clave: ['Clave rechazada', 'err', 'Cambia la clave en la tarjeta de esa API.'], sin_clave: ['Falta la clave', 'err', 'Pega la clave en la tarjeta de esa API.'], proveedor: ['Error del proveedor', 'or', 'Suele ser saldo, cuota o un dato rechazado por el proveedor. Revisa su panel.'], limite: ['Límite mensual', 'or', 'Sube el límite mensual de esa API si quieres seguir.'], tope: ['Tope diario', 'or', 'La persona llegó a su tope. Súbelo en Ajustes → Personas.'], modo: ['Sin permiso', '', 'Esa persona intentó usar una clave que no tiene habilitada. Revisa su modo en Ajustes → Personas.'], servidor: ['Error interno', 'err', 'Un fallo de la función segura. Si se repite, revisa los registros en Supabase.'] };
  const PANEL = { anthropic: ['https://console.anthropic.com/settings/billing', 'Claude'], openai: ['https://platform.openai.com/settings/organization/billing/overview', 'OpenAI'], gemini: ['https://aistudio.google.com/usage', 'Gemini'], minimax: ['https://platform.minimax.io/user-center/payment/balance', 'MiniMax'] };
  const dmy = (d) => new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  const EVT = { conectada: 'Clave conectada', reemplazada: 'Clave reemplazada', prueba_ok: 'Prueba de conexión correcta', prueba_fallo: 'Prueba de conexión fallida', quitada: 'Clave quitada' };
  const SECRET = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', elevenlabs: 'ELEVENLABS_API_KEY', gemini: 'GEMINI_API_KEY', minimax: 'MINIMAX_API_KEY' };
  const AIS = [
    { k: 'anthropic', logo: 'A', bg: 'linear-gradient(135deg,#d97757,#b4532a)', name: 'Claude · Anthropic', sub: 'Agentes de texto: guiones, SEO, prompts y asesor', feats: ['Guionista', 'SEO YouTube', 'Mejorar prompts'] },
    { k: 'openai', logo: 'AI', bg: 'linear-gradient(135deg,#10a37f,#0b7a5e)', name: 'OpenAI', sub: 'Imágenes, voces y texto', feats: ['Imágenes', 'Voz TTS', 'Guionista', 'SEO'] },
    { k: 'elevenlabs', logo: 'XI', bg: 'linear-gradient(135deg,#2b2b2b,#000)', name: 'ElevenLabs', sub: 'Voces ultra realistas y clonadas', feats: ['Voces premium', 'Multilingüe', 'Voces clonadas'] },
    { k: 'gemini', logo: 'G', bg: 'linear-gradient(135deg,#4285f4,#9b72cb)', name: 'Gemini · Google', sub: 'Texto, imágenes y voces con Gemini', feats: ['Guionista', 'Imágenes', 'Voz TTS', 'SEO'] },
    { k: 'minimax', logo: 'M', bg: 'linear-gradient(135deg,#f23f5d,#7b2ff7)', name: 'MiniMax', sub: 'Texto, imágenes y voces con MiniMax', feats: ['Guionista', 'Imágenes', 'Voz TTS', 'SEO'] },
  ];
  const units = (k, u = {}) => k === 'anthropic' ? `${num((u.in_tokens || 0) + (u.out_tokens || 0))} tokens`
    : k === 'openai' || k === 'gemini' || k === 'minimax' ? `${num(u.images)} imágenes · ${num((u.in_tokens || 0) + (u.out_tokens || 0))} tokens · ${num(u.chars)} caracteres de voz`
    : `${num(u.chars)} caracteres`;

  V.integraciones = (el) => {
    const S = F.settings, C = F.cloud, cloudOn = !!(C?.configured() && C.user);
    const data = { rep: null, lims: null, secrets: [], errors: null, ov: {}, acc: [], inv: [], st: {}, own: {} };
    let dead = false;
    const mode = (k) => (cloudOn ? C.aiMode(k) : 'own');
    const model = (k, label, list) => `<label class="lbl">${label}</label><input type="text" data-model="${k}" value="${esc(S.models[k])}" list="dl-${k}"><datalist id="dl-${k}">${list.map((x) => `<option value="${x}">`).join('')}</datalist>`;
    /* Para qué se usa cada API en este navegador (por defecto, todo) */
    const USES = { openai: [['text', 'Prompts y textos'], ['image', 'Imágenes'], ['voice', 'Voz']], gemini: [['text', 'Prompts y textos'], ['image', 'Imágenes'], ['voice', 'Voz']], minimax: [['text', 'Prompts y textos'], ['image', 'Imágenes'], ['voice', 'Voz']], anthropic: [['text', 'Prompts y textos']] };
    const usesRow = (k) => USES[k] ? `<label class="lbl">Usar esta API para</label><div class="chips">${USES[k].map(([c, l]) => `<button class="chip ${F.api.canUse(k, c) ? 'on' : ''}" data-use="${k}:${c}">${l}</button>`).join('')}</div><p class="mini" style="margin:4px 0 0">Apaga «Imágenes» si tu cuenta no puede generarlas: seguirá sirviendo para los prompts.</p>` : '';
    const models = (k) => usesRow(k) + (k === 'anthropic' ? model('anthropic', 'Modelo', ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'])
      : k === 'openai' ? `<div class="grid3">${model('openai', 'Prompts y textos', ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o4-mini', 'o3-mini'])}${model('image', 'Imágenes', ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini', 'dall-e-3', 'dall-e-2'])}${model('tts', 'Voz', ['gpt-4o-mini-tts', 'tts-1-hd', 'tts-1'])}</div>`
      : k === 'gemini' ? `<div class="row" style="gap:8px;margin:8px 0 0;flex-wrap:wrap"><button class="btn sm" data-gemlist>Ver modelos disponibles</button><span class="mini" id="gemMsg">Google cambia los nombres seguido: aquí ves los que tu clave puede usar.</span></div><div class="grid3">${model('gemini', 'Prompts y textos', ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'])}${model('geminiImage', 'Imágenes', ['gemini-2.5-flash-image', 'gemini-2.0-flash-preview-image-generation'])}${model('geminiTts', 'Voz', ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'])}</div>`
      : k === 'minimax' ? `<div class="grid3">${model('minimax', 'Prompts y textos', ['MiniMax-M2', 'MiniMax-M1', 'MiniMax-Text-01'])}${model('minimaxImage', 'Imágenes', ['image-01', 'image-01-live'])}${model('minimaxTts', 'Voz', ['speech-2.8-hd', 'speech-2.8-turbo', 'speech-2.6-hd', 'speech-2.6-turbo', 'speech-02-hd', 'speech-02-turbo'])}</div>`
      : model('eleven', 'Modelo', ['eleven_multilingual_v2', 'eleven_turbo_v2_5', 'eleven_flash_v2_5', 'eleven_v3', 'eleven_turbo_v2', 'eleven_multilingual_v1']));
    const head = (a, tag, cls) => `<div class="hd"><div class="lg" style="background:${a.bg}">${a.logo}</div><div style="flex:1"><b>${a.name}</b><small>${a.sub}</small></div><span class="tag ${cls}" data-st="${a.k}">${tag}</span></div>`;
    const feats = (a) => `<div class="feat">${a.feats.map((f) => `<span class="tag">${f}</span>`).join('')}</div>`;
    const bar = (pct, warn) => `<div class="bar ${warn ? 'warn' : ''}"><i style="width:${Math.min(100, pct)}%"></i></div>`;

    const STATE = { ok: ['Conectado', 'ok'], fail: ['No funciona', 'err'], untested: ['Falta probar', 'or'], none: ['Sin clave', ''] };
    const stOf = (k) => data.st?.[k] || 'none';
    /** Prueba la conexión y, si es la clave de FRAMALY, deja el resultado registrado para todos */
    const check = async (k) => {
      let msg;
      try { msg = await F.api.test(k); if (C?.isAdmin() && mode(k) === 'shared') await C.recordCheck(k, true, msg).catch(() => {}); F.toast(msg, 'ok'); data.own[k] = 'ok'; }
      catch (err) { if (C?.isAdmin() && mode(k) === 'shared') await C.recordCheck(k, false, err.message).catch(() => {}); data.own[k] = 'fail'; F.toast(err.message, 'error', 6000); }
      if (cloudOn) data.st = await C.apiStatus().catch(() => data.st);
    };
    /* --- clave propia (modo clásico) --- */
    const ownTag = (k) => !F.api.has(k) ? ['Sin configurar', ''] : data.own[k] === 'ok' ? ['Conectado', 'ok'] : data.own[k] === 'fail' ? ['No funciona', 'err'] : ['Falta probar', 'or'];
    const ownCard = (a) => `<div class="card int-card">${head(a, ...ownTag(a.k))}
      <label class="lbl">API key</label><div class="keyrow"><input type="password" data-key="${a.k}" value="${esc(S.keys[a.k])}" placeholder="Pega tu clave aquí" autocomplete="off" spellcheck="false"><button class="icon-btn" data-eye="${a.k}" title="Mostrar">${I('eye')}</button><button class="btn" data-test="${a.k}">Probar</button></div>
      ${cloudOn && C.aiBaseMode(a.k) === 'both' && !C.isAdmin() ? `<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-src="${a.k}:shared">Volver a la clave de FRAMALY</button><span class="mini">El administrador comparte esta API contigo.</span></div>` : ''}
      ${a.k === 'minimax' ? '<p class="mini" style="margin:8px 0 0">MiniMax suele no permitir llamadas directas desde el navegador: funciona mejor con la clave de FRAMALY.</p>' : ''}${models(a.k)}${feats(a)}</div>`;
    /* --- saldo del proveedor + historial de la API (administrador) --- */
    const history = (a) => {
      const o = data.ov?.[a.k]; if (!o) return '';
      const days = o.days || [], max = Math.max(0.0001, ...days.map((d) => +d.cost));
      const bars = days.length ? `<div class="spark" title="Gasto por día, últimos 30 días">${days.map((d) => `<i style="height:${Math.max(6, Math.round((+d.cost / max) * 100))}%" title="${dmy(d.day)}: ${usd(d.cost)}"></i>`).join('')}</div>` : '<div class="mini">Todavía no hay gasto registrado con la clave de FRAMALY.</div>';
      const b = o.balance;
      const real = b ? (() => { const p = b.quota > 0 ? Math.round((b.used / b.quota) * 100) : 0; return `<div class="row2"><span><b style="color:var(--text)">Saldo del proveedor${b.plan ? ' · plan ' + esc(b.plan) : ''}</b></span><span>${num(b.used)} de ${num(b.quota)} ${esc(b.unit)} · ${p}%</span></div>${bar(p, p >= 80)}<div class="mini">${b.resets_at ? 'Se renueva el ' + dmy(b.resets_at) + ' · ' : ''}consultado ${F.ago(new Date(b.created_at).getTime())}</div>`; })()
        : a.k === 'elevenlabs' ? '<div class="mini">Aún sin consultar el saldo. Pulsa «Actualizar saldo».</div>'
        : `<div class="mini">${esc(PANEL[a.k][1])} no entrega el saldo con una clave normal. <a href="${PANEL[a.k][0]}" target="_blank" rel="noopener">Ver saldo en su panel →</a></div>`;
      const evs = (o.events || []).length ? `<details style="margin-top:8px" class="small muted"><summary style="cursor:pointer;color:var(--or2)">Historial de conexión</summary>${o.events.map((e) => `<div class="row2 prow"><span>${esc(EVT[e.kind] || e.kind)}${e.detail?.last4 ? ` (••••${esc(e.detail.last4)})` : ''}</span><span>${dmy(e.at)}</span></div>`).join('')}</details>` : '';
      return `<div class="sep"></div>
        <div class="row2"><span><b style="color:var(--text)">Gastado con FRAMALY</b></span><span>${o.first_use ? 'desde el ' + dmy(o.first_use) : 'sin uso aún'}</span></div>
        <div class="big" style="font-size:18px">${usd(o.total)}<span class="mini"> en total</span></div>${bars}
        <div class="sep"></div>${real}
        ${a.k === 'elevenlabs' ? `<button class="btn sm" data-bal="elevenlabs" style="margin-top:8px">Actualizar saldo</button>` : ''}${evs}`;
    };
    /* --- con quién está compartida cada API (administrador) --- */
    const sharedWith = (k) => {
      const ok = (ai) => ai?.[k] === 'shared';
      const a = (data.acc || []).filter((p) => p.status === 'approved' && p.role !== 'admin' && ok(p.ai)).map((p) => ({ e: p.email, w: false }));
      const have = new Set(a.map((x) => (x.e || '').toLowerCase()));
      const i = (data.inv || []).filter((p) => ok(p.ai) && !have.has((p.email || '').toLowerCase())).map((p) => ({ e: p.email, w: true }));
      return [...a, ...i];
    };
    const sharedLine = (a) => {
      const l = sharedWith(a.k), s = stOf(a.k);
      if (s !== 'ok') return `<div class="shared-line"><b style="color:var(--${s === 'fail' ? 'err' : 'or2'})">${s === 'fail' ? 'No funciona' : s === 'untested' ? 'Falta probar' : 'Sin clave'}</b> · ${s === 'none' ? 'guarda la clave y pulsa «Probar conexión»' : s === 'fail' ? 'la última prueba falló, revisa la clave' : 'pulsa «Probar conexión» para confirmar que funciona'}; no se comparte hasta que funcione.</div>`;
      return `<div class="shared-line"><b>Conectado</b> · ${l.length ? 'compartido con ' + l.map((x) => `<span class="tag ok">${esc(x.e || 'Sin correo')}${x.w ? ' (invitado)' : ''}</span>`).join(' ') : '<span class="mini">sin compartir con nadie todavía (Ajustes → Personas con acceso)</span>'}</div>`;
    };
    /* --- clave de FRAMALY, vista del administrador --- */
    const adminCard = (a) => {
      const p = data.rep?.providers?.[a.k] || { cost: 0, units: {} }, l = (data.lims || []).find((x) => x.provider === a.k) || { monthly_usd: 0, alert_pct: 80 };
      const sec = (data.secrets || []).find((x) => x.provider === a.k);
      const pct = l.monthly_usd > 0 ? Math.round((p.cost / l.monthly_usd) * 100) : 0;
      return `<div class="card int-card">${head(a, ...STATE[stOf(a.k)])}
        ${sharedLine(a)}
        <div class="big">${usd(p.cost)}<span class="mini"> de ${usd(l.monthly_usd)} este mes</span></div>${bar(pct, pct >= l.alert_pct)}
        <div class="row2"><span>${pct}% usado</span><span>${units(a.k, p.units)}</span></div>
        <div class="sep"></div>
        <label class="lbl">Límite mensual (US$)</label><div class="keyrow"><input type="number" min="0" step="1" data-lim="${a.k}" value="${l.monthly_usd}"><button class="btn" data-limsave="${a.k}">Guardar</button></div>
        <label class="lbl">Avisarme al llegar a</label><div class="seg">${[80, 90, 100].map((n) => `<button data-alert="${a.k}" data-v="${n}" class="${+l.alert_pct === n ? 'on' : ''}">${n}%</button>`).join('')}</div>
        <div class="sep"></div>
        ${history(a)}
        <div class="sep"></div>
        <label class="lbl">Clave de ${a.name.split(' · ')[0]}</label>
        <p class="mini" style="margin:0 0 6px">${sec ? `Guardada en la plataforma (cifrada) · termina en ••••${esc(sec.last4)} · ${F.ago(new Date(sec.updated_at).getTime())}` : `No hay una clave guardada aquí. Si la dejaste en Supabase (secreto <code>${SECRET[a.k]}</code>), también funciona.`}</p>
        <div class="keyrow"><input type="password" data-secret="${a.k}" placeholder="${sec ? 'Pega una clave nueva para reemplazarla' : 'Pega la clave aquí'}" autocomplete="off" spellcheck="false"><button class="btn" data-secsave="${a.k}">Guardar clave</button>${sec ? `<button class="btn danger" data-secdel="${a.k}">Quitar</button>` : ''}</div>
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn sm" data-test="${a.k}">Probar conexión</button><span class="mini">Se guarda cifrada y no se puede volver a ver, solo reemplazar.</span></div>
        <details style="margin-top:10px" class="small muted"><summary style="cursor:pointer;color:var(--or2)">Modelos</summary>${models(a.k)}</details></div>`;
    };
    /* --- clave de FRAMALY, vista de una persona --- */
    /* Opción para que cada persona agregue su propia clave aunque FRAMALY comparta la suya */
    const ownOption = (a) => `<details class="own-opt" style="margin-top:10px"${S.keys[a.k] ? ' open' : ''}><summary style="cursor:pointer;color:var(--or2)" class="small">Usar mi propia clave de ${esc(a.name.split(' · ')[0])} (opcional)</summary>
        <p class="mini" style="margin:8px 0">Si pegas tu clave, tus usos se cobran a tu cuenta del proveedor y no cuentan en el tope de FRAMALY.</p>
        <div class="keyrow"><input type="password" data-key="${a.k}" value="${esc(S.keys[a.k])}" placeholder="Pega tu clave aquí" autocomplete="off" spellcheck="false"><button class="icon-btn" data-eye="${a.k}" title="Mostrar">${I('eye')}</button></div>
        <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn sm primary" data-src="${a.k}:own">Usar mi clave</button><span class="mini">Se guarda solo en este navegador.</span></div></details>`;
    const personCard = (a) => {
      const cap = +C.access?.daily_usd || 0, used = +data.rep?.mine_today || 0, pct = cap > 0 ? Math.round((used / cap) * 100) : 0;
      return `<div class="card int-card">${head(a, ...(stOf(a.k) === 'ok' ? ['Conectado', 'ok'] : ['No disponible aún', 'or']))}
        ${stOf(a.k) === 'ok' ? '<div class="shared-line"><b>Conectado</b> · compartido contigo por el administrador</div>' : '<div class="shared-line"><b style="color:var(--or2)">No disponible aún</b> · el administrador todavía no la ha conectado o está fallando.</div>'}
        <p class="mini" style="margin:0 0 8px">Usas la clave de FRAMALY. No necesitas configurar nada.</p>
        ${data.rep ? `${bar(pct, pct >= 80)}<div class="row2"><span>Hoy llevas ${usd(used)} de ${usd(cap)}</span><span>${pct}% de tu cupo</span></div>` : '<div class="mini">Cargando tu cupo…</div>'}
        ${cloudOn && C.aiBaseMode(a.k) === 'both' ? ownOption(a) : ''}
        ${feats(a)}</div>`;
    };
    const offCard = (a) => `<div class="card int-card">${head(a, 'No habilitada', '')}<p class="mini" style="margin:0">Esta IA no está habilitada para tu cuenta. Pídeselo a quien administra FRAMALY.</p>${feats(a)}</div>`;
    const aiCard = (a) => { const m = mode(a.k); return m === 'off' ? offCard(a) : m === 'shared' ? (C.isAdmin() ? adminCard(a) : personCard(a)) : ownCard(a); };

    const ytCard = `<div class="card int-card"><div class="hd"><div class="lg" style="background:linear-gradient(135deg,#ff3d3d,#c40000)">${I('youtube')}</div><div style="flex:1"><b>YouTube · Google</b><small>Subida directa a tu canal</small></div><span class="tag ${F.api.has('googleClientId') ? 'ok' : ''}" data-st="googleClientId">${F.api.has('googleClientId') ? 'Conectado' : 'Sin configurar'}</span></div>
      <label class="lbl">OAuth Client ID</label><div class="keyrow"><input type="text" data-key="googleClientId" value="${esc(S.keys.googleClientId)}" placeholder="xxxxxxxx.apps.googleusercontent.com" autocomplete="off" spellcheck="false"><button class="btn" data-test="googleClientId">Conectar</button></div>
      <details style="margin-top:12px" class="small muted"><summary style="cursor:pointer;color:var(--or2)">¿Cómo obtengo el Client ID?</summary><ol style="padding-left:18px;line-height:1.8">
        <li>Entra a <b>console.cloud.google.com</b> y crea un proyecto.</li><li>En “APIs y servicios” habilita <b>YouTube Data API v3</b>.</li><li>Configura la pantalla de consentimiento OAuth (tipo Externo) y añádete como usuario de prueba.</li><li>Credenciales → Crear → <b>ID de cliente OAuth</b> → tipo “Aplicación web”.</li><li>En “Orígenes de JavaScript autorizados” añade <b>${esc(location.origin)}</b>.</li><li>Copia el Client ID aquí y pulsa <b>Conectar</b>.</li></ol></details>
      <div class="feat"><span class="tag">Subir videos</span><span class="tag">Miniaturas</span><span class="tag">Metadatos</span></div></div>`;

    const anyOwn = AIS.some((a) => mode(a.k) === 'own');
    const people = () => {
      const list = data.rep?.people || [];
      if (!C?.isAdmin() || !list.length) return '';
      return `<h2 class="sec-t" style="margin-top:22px">Consumo por persona (este mes) <span class="line"></span></h2><div class="card">${list.sort((x, y) => y.month - x.month).map((p) => `<div class="row2 prow"><span><b>${esc(p.email || 'Sin correo')}</b></span><span>${usd(p.month)} este mes · ${usd(p.today)} hoy</span></div>`).join('')}</div>`;
    };
    const errors = () => {
      const list = data.errors;
      if (!C?.isAdmin() || !list) return '';
      const rows = list.map((e) => { const [lbl, cls, tip] = KIND[e.kind] || [e.kind, '', '']; const who = AIS.find((a) => a.k === e.provider)?.name.split(' · ')[0] || '';
        return `<div class="err-row"><div class="row" style="gap:8px;flex-wrap:wrap"><span class="tag ${cls}">${esc(lbl)}</span><b>${esc(who)}</b>${e.status ? `<span class="mini">código ${e.status}</span>` : ''}<span class="grow"></span><span class="mini">${esc(e.email || '')} · ${F.ago(new Date(e.created_at).getTime())}</span></div><div class="mini" style="margin-top:4px">${esc(e.message)}</div>${/key id used as api key/i.test(e.message) ? '<div class="mini" style="color:var(--or2)">Pegaste el ID de la clave, no la clave. Crea o rota la clave en el proveedor y copia el valor completo (empieza con «sk_») en el momento en que se muestra.</div>' : tip ? `<div class="mini" style="color:var(--or2)">${esc(tip)}</div>` : ''}</div>`; }).join('');
      return `<h2 class="sec-t" style="margin-top:22px">Errores recientes <span class="line"></span>${list.length ? '<button class="btn sm" data-errclear>Limpiar</button>' : ''}</h2><div class="card">${rows || '<p class="mini" style="margin:0">Sin errores. Aquí aparecerán los fallos de las APIs: clave rechazada, saldo agotado, límites alcanzados…</p>'}</div>`;
    };
    const draw = () => {
      if (dead) return;
      el.innerHTML = `<div class="page">
        <div class="notice">${I('shield')}<div>${cloudOn
          ? (anyOwn ? '<b>Tus claves propias se guardan solo en este navegador</b> y se envían directo a cada proveedor. Las claves de FRAMALY viven en el servidor y no se pueden ver.' : '<b>Las claves de FRAMALY viven en el servidor</b> y nadie las ve. Cada uso se mide y respeta los límites.')
          : '<b>Tus claves se guardan solo en este navegador</b> (almacenamiento local de tu PC) y se envían directamente a cada proveedor, sin servidores intermedios. No uses FRAMALY en equipos compartidos con tus claves guardadas.'}</div></div>
        <div class="int-grid">${AIS.map(aiCard).join('')}${ytCard}</div>${people()}${errors()}
        <div class="split even" style="margin-top:16px">
          <div class="card"><h3>${I('bot')} Preferencias de agentes</h3><label class="lbl">Proveedor de texto preferido</label><div class="seg" id="tp"><button data-v="anthropic">Claude</button><button data-v="openai">OpenAI</button><button data-v="gemini">Gemini</button><button data-v="minimax">MiniMax</button></div><p class="hint">Si el preferido no está disponible, se usa el otro automáticamente.</p></div>
        </div></div>`;
      const tp = () => el.querySelector('#tp').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.textProvider)); tp();
      el.querySelector('#tp').onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { S.textProvider = b.dataset.v; F.saveSettings(); tp(); } };
    };
    draw();
    if (cloudOn) {
      (async () => {
        try { data.rep = await C.report(); data.st = await C.apiStatus().catch(() => ({})); if (C.isAdmin()) { [data.lims, data.secrets, data.errors, data.ov] = await Promise.all([C.limits(), C.secrets(), C.errors(), C.overview()]); [data.acc, data.inv] = await Promise.all([C.people().catch(() => []), C.invites().catch(() => [])]); } } catch (e) { F.toast(e.message, 'error'); }
        draw();
      })();
    }

    const q = (s) => el.querySelector(s);
    el.addEventListener('input', (e) => {
      const k = e.target.dataset.key, m = e.target.dataset.model;
      if (k) { S.keys[k] = e.target.value.trim(); F.saveSettings(); const t = q(`[data-st="${k}"]`); if (t) { t.className = 'tag ' + (F.api.has(k) ? 'ok' : ''); t.textContent = F.api.has(k) ? 'Guardado' : 'Sin configurar'; } }
      if (m) { S.models[m] = e.target.value.trim(); F.saveSettings(); }
    });
    el.addEventListener('click', async (e) => {
      const sr = e.target.closest('[data-src]');
      if (sr) {
        const [k, w] = sr.dataset.src.split(':');
        if (w === 'own' && !(S.keys[k] || '').trim()) return F.toast('Pega primero tu clave');
        S.useOwn[k] = w === 'own'; F.saveSettings(); F.toast(w === 'own' ? 'Ahora usas tu propia clave. Pulsa «Probar» para comprobarla.' : 'Ahora usas la clave de FRAMALY', 'ok'); draw(); return;
      }
      const gl = e.target.closest('[data-gemlist]');
      if (gl) {
        F.busy(gl, true, 'Consultando…');
        try {
          const m = await F.api.geminiModels(), fill = (id, list) => { const dl = q('#' + id); if (dl && list.length) dl.innerHTML = list.map((x) => `<option value="${esc(x)}">`).join(''); };
          fill('dl-gemini', m.text); fill('dl-geminiImage', m.image); fill('dl-geminiTts', m.tts);
          const msg = q('#gemMsg'); if (msg) msg.innerHTML = `Disponibles con tu clave — texto: <b>${m.text.slice(0, 6).map(esc).join(', ') || 'ninguno'}</b>${m.image.length ? ' · imágenes: <b>' + m.image.slice(0, 4).map(esc).join(', ') + '</b>' : ''}${m.tts.length ? ' · voz: <b>' + m.tts.slice(0, 4).map(esc).join(', ') + '</b>' : ''}. Pulsa el campo del modelo y elige.`;
        } catch (err) { F.toast(err.message, 'error'); }
        F.busy(gl, false); return;
      }
      const us = e.target.closest('[data-use]');
      if (us) { const [p, c] = us.dataset.use.split(':'); (S.uses[p] ||= {})[c] = !F.api.canUse(p, c); F.saveSettings(); draw(); return; }
      const eye = e.target.closest('[data-eye]'); if (eye) { const i = q(`[data-key="${eye.dataset.eye}"]`); i.type = i.type === 'password' ? 'text' : 'password'; return; }
      const t = e.target.closest('[data-test]');
      if (t) {
        const k = t.dataset.test; if (!F.api.has(k)) return F.toast('Escribe primero la clave');
        F.busy(t, true, '');
        await check(k); if (k === 'googleClientId') { const s = q(`[data-st="${k}"]`); if (s && data.own[k] === 'ok') { s.className = 'tag ok'; s.textContent = 'Conectado'; } F.busy(t, false); return; }
        F.busy(t, false); draw(); return;
      }
      const ls = e.target.closest('[data-limsave]');
      if (ls) {
        const k = ls.dataset.limsave, v = +q(`[data-lim="${k}"]`).value;
        if (!(v >= 0)) return F.toast('Escribe un monto válido');
        F.busy(ls, true, '…');
        try { await C.setLimit(k, { monthly_usd: v }); const l = data.lims.find((x) => x.provider === k); if (l) l.monthly_usd = v; F.toast('Límite guardado', 'ok'); draw(); } catch (err) { F.toast(err.message, 'error'); F.busy(ls, false); }
        return;
      }
      const ss = e.target.closest('[data-secsave]');
      if (ss) {
        const k = ss.dataset.secsave, inp = q(`[data-secret="${k}"]`), v = inp.value.trim();
        if (!v) return F.toast('Pega primero la clave');
        F.busy(ss, true, 'Guardando…');
        try {
          await C.setSecret(k, v); inp.value = ''; data.secrets = await C.secrets(); data.ov = await C.overview(); data.st = await C.apiStatus().catch(() => data.st); draw();
          // al conectar: se prueba la clave y, si el proveedor lo permite, se consulta el saldo
          await check(k); if (k === 'elevenlabs' && data.own[k] === 'ok') await F.api.balance(k).catch((err) => F.toast(err.message, 'error'));
          [data.ov, data.errors] = await Promise.all([C.overview(), C.errors()]); draw();
        } catch (err) { F.toast(err.message, 'error'); F.busy(ss, false); }
        return;
      }
      const sd = e.target.closest('[data-secdel]');
      if (sd) {
        const k = sd.dataset.secdel, nm = AIS.find((a) => a.k === k).name.split(' · ')[0];
        if (!(await F.confirm('Quitar la clave', `Se borrará la clave de ${nm} guardada en la plataforma. Si no hay otra en Supabase, esa IA dejará de funcionar para todos.`, 'Quitar'))) return;
        try { await C.deleteSecret(k); data.secrets = await C.secrets(); data.st = await C.apiStatus().catch(() => data.st); F.toast('Clave quitada', 'ok'); draw(); } catch (err) { F.toast(err.message, 'error'); }
        return;
      }
      if (e.target.closest('[data-errclear]')) { try { await C.clearErrors(); data.errors = []; draw(); } catch (err) { F.toast(err.message, 'error'); } return; }
      const bl = e.target.closest('[data-bal]');
      if (bl) {
        F.busy(bl, true, 'Consultando…');
        try { await F.api.balance(bl.dataset.bal); data.ov = await C.overview(); F.toast('Saldo actualizado', 'ok'); draw(); } catch (err) { F.toast(err.message, 'error'); data.errors = await C.errors().catch(() => data.errors); draw(); }
        return;
      }
      const al = e.target.closest('[data-alert]');
      if (al) { try { await C.setLimit(al.dataset.alert, { alert_pct: +al.dataset.v }); const l = data.lims.find((x) => x.provider === al.dataset.alert); if (l) l.alert_pct = +al.dataset.v; F.toast('Aviso guardado', 'ok'); draw(); } catch (err) { F.toast(err.message, 'error'); } }
    });
    return () => { dead = true; };
  };
})();
