/* FRAMALY — conectores de API: OpenAI, Anthropic (Claude), ElevenLabs, YouTube */
(function () {
  'use strict';
  const key = (n) => (F.settings.keys[n] || '').trim();
  const AI = ['anthropic', 'openai', 'elevenlabs'];
  /** 'shared' (clave de FRAMALY en el servidor) · 'own' (clave propia de este navegador) · 'off' */
  const mode = (n) => (AI.includes(n) && F.cloud?.aiMode ? F.cloud.aiMode(n) : 'own');
  const need = (n, label) => {
    const m = mode(n);
    if (m === 'shared') return;
    if (m === 'off') throw new Error(`${label} no está habilitado para tu cuenta. Pídeselo a quien administra FRAMALY.`);
    if (!key(n)) throw new Error(`Falta la API key de ${label}. Configúrala en Integraciones API.`);
  };
  /** Llamada a un proveedor: por la puerta segura si se usa la clave compartida, directa si es clave propia */
  const net = async (prov, url, init) => {
    if (mode(prov) !== 'shared') return fetch(url, init);
    const r = await F.cloud.gateway(prov, url, init);
    if (r.status === 503 && key(prov)) return fetch(url, init); // clave compartida sin configurar: usa la propia si existe
    return r;
  };

  async function asJson(r) {
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (!r.ok) {
      const msg = j?.error?.message || j?.detail?.message || (typeof j?.detail === 'string' ? j.detail : '') || j?.message || txt.slice(0, 200) || r.statusText;
      throw new Error(`Error ${r.status}: ${msg}`);
    }
    return j;
  }
  async function asBlob(r) {
    if (!r.ok) await asJson(r);
    return r.blob();
  }

  F.api = {
    has: (n) => { const m = mode(n); return AI.includes(n) ? (m === 'shared' ? true : m === 'off' ? false : !!key(n)) : !!key(n); },
    textReady() { return this.has('anthropic') || this.has('openai'); },

    /** Elige el proveedor de texto: el preferido si tiene key, si no el otro */
    textProvider(pref) {
      const p = pref && pref !== 'auto' ? pref : F.settings.textProvider;
      if (this.has(p)) return p;
      const other = p === 'anthropic' ? 'openai' : 'anthropic';
      if (this.has(other)) return other;
      throw new Error('Necesitas una API key de Anthropic (Claude) u OpenAI para los agentes de texto. Ve a Integraciones API.');
    },

    /** Llamada a modelo de lenguaje. Devuelve texto. */
    async llm({ system = '', prompt, json = false, maxTokens = 4000, provider }) {
      const prov = this.textProvider(provider);
      if (prov === 'anthropic') {
        const r = await net('anthropic', 'https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': key('anthropic'), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: F.settings.models.anthropic, max_tokens: maxTokens, system: system + (json ? '\nResponde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código.' : ''), messages: [{ role: 'user', content: prompt }] }),
        });
        const j = await asJson(r);
        return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      }
      const body = { model: F.settings.models.openai, messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt + (json ? '\n\nResponde solo con JSON.' : '') }] };
      if (json) body.response_format = { type: 'json_object' };
      const r = await net('openai', 'https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key('openai') }, body: JSON.stringify(body),
      });
      const j = await asJson(r);
      return j.choices?.[0]?.message?.content || '';
    },
    parseJSON(text) {
      let t = String(text || '').replace(/```(?:json)?/gi, '').trim();
      const a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a >= 0 && b > a) t = t.slice(a, b + 1);
      try { return JSON.parse(t); } catch (e) { throw new Error('La IA devolvió un formato inesperado. Intenta de nuevo.'); }
    },
    async llmJSON(opts) { return this.parseJSON(await this.llm({ ...opts, json: true })); },

    /** Generación de imágenes (OpenAI). Devuelve Blob[] */
    async image({ prompt, size = '1536x1024', quality = 'medium', n = 1, model }) {
      need('openai', 'OpenAI');
      const mdl = model || F.settings.models.image;
      const body = { model: mdl, prompt, size, n };
      if (quality && /gpt-image/.test(mdl)) body.quality = quality;
      if (/dall-e-3/.test(mdl)) { body.n = 1; body.response_format = 'b64_json'; body.size = size === '1536x1024' ? '1792x1024' : size === '1024x1536' ? '1024x1792' : '1024x1024'; }
      const r = await net('openai', 'https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key('openai') }, body: JSON.stringify(body),
      });
      const j = await asJson(r);
      return Promise.all((j.data || []).map((d) => (d.b64_json ? F.b64ToBlob(d.b64_json, 'image/png') : fetch(d.url).then((x) => x.blob()))));
    },

    /** Texto a voz con OpenAI. Devuelve Blob mp3 */
    async ttsOpenAI({ text, voice = 'nova', instructions = '', speed = 1 }) {
      need('openai', 'OpenAI');
      const model = F.settings.models.tts;
      const body = { model, voice, input: text, response_format: 'mp3' };
      if (instructions && /gpt-4o/.test(model)) body.instructions = instructions;
      if (speed && +speed !== 1) body.speed = +speed;
      const r = await net('openai', 'https://api.openai.com/v1/audio/speech', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key('openai') }, body: JSON.stringify(body),
      });
      return asBlob(r);
    },
    OPENAI_VOICES: ['nova', 'shimmer', 'coral', 'sage', 'alloy', 'ash', 'ballad', 'echo', 'fable', 'onyx', 'verse'],

    /** ElevenLabs */
    async elevenVoices() {
      need('elevenlabs', 'ElevenLabs');
      const j = await asJson(await net('elevenlabs', 'https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key('elevenlabs') } }));
      return (j.voices || []).map((v) => ({ id: v.voice_id, name: v.name, labels: v.labels || {} }));
    },
    async ttsEleven({ text, voiceId, stability = 0.5, similarity = 0.75, speed = 1 }) {
      need('elevenlabs', 'ElevenLabs');
      if (!voiceId) throw new Error('Selecciona una voz de ElevenLabs.');
      const r = await net('elevenlabs', `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'xi-api-key': key('elevenlabs') },
        body: JSON.stringify({ text, model_id: F.settings.models.eleven, voice_settings: { stability: +stability, similarity_boost: +similarity, speed: +speed } }),
      });
      return asBlob(r);
    },

    /** TTS genérico según proveedor */
    async tts(o) {
      return o.provider === 'elevenlabs' ? this.ttsEleven({ ...o, voiceId: o.voiceId || o.voice }) : this.ttsOpenAI(o);
    },

    /** Pruebas de conexión */
    async test(n) {
      if (n === 'openai') { await asJson(await net('openai', 'https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + key('openai') } })); return 'Conexión correcta con OpenAI'; }
      if (n === 'anthropic') { await asJson(await net('anthropic', 'https://api.anthropic.com/v1/models', { headers: { 'x-api-key': key('anthropic'), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } })); return 'Conexión correcta con Anthropic'; }
      if (n === 'elevenlabs') { const v = await this.elevenVoices(); return `ElevenLabs conectado · ${v.length} voces disponibles`; }
      if (n === 'googleClientId') { await this.youtubeToken(); return 'Cuenta de YouTube autorizada'; }
    },

    /* ---------- YouTube (OAuth con Google Identity Services) ---------- */
    _gis: null,
    loadGIS() {
      return (this._gis ||= new Promise((res, rej) => {
        if (window.google?.accounts?.oauth2) return res();
        const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
        s.onload = () => res(); s.onerror = () => { this._gis = null; rej(new Error('No se pudo cargar Google Identity Services')); };
        document.head.appendChild(s);
      }));
    },
    async youtubeToken() {
      need('googleClientId', 'Google (OAuth Client ID)');
      if (location.protocol === 'file:') throw new Error('Para conectar YouTube abre FRAMALY desde "Iniciar FRAMALY.bat" (http://localhost:5577), no como archivo.');
      if (this._yt && this._yt.exp > Date.now()) return this._yt.token;
      await this.loadGIS();
      return new Promise((res, rej) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: key('googleClientId'),
          scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube',
          callback: (r) => { if (r.error) return rej(new Error(r.error_description || r.error)); this._yt = { token: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 }; res(r.access_token); },
          error_callback: (e) => rej(new Error(e?.message || 'Autorización cancelada')),
        });
        client.requestAccessToken();
      });
    },
    async youtubeUpload(blob, { title, description, tags, privacy = 'private', categoryId = '22' }, onProgress) {
      const token = await this.youtubeToken();
      const meta = { snippet: { title: (title || 'Video FRAMALY').slice(0, 100), description: (description || '').slice(0, 4900), tags: (tags || []).slice(0, 30), categoryId }, status: { privacyStatus: privacy, selfDeclaredMadeForKids: false } };
      const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': blob.type || 'video/webm', 'X-Upload-Content-Length': String(blob.size) }, body: JSON.stringify(meta),
      });
      if (!init.ok) await asJson(init);
      const loc = init.headers.get('Location');
      if (!loc) throw new Error('YouTube no devolvió la URL de subida.');
      return new Promise((res, rej) => {
        const x = new XMLHttpRequest();
        x.open('PUT', loc); x.setRequestHeader('Content-Type', blob.type || 'video/webm');
        x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
        x.onload = () => { try { const j = JSON.parse(x.responseText); if (x.status >= 300) throw new Error(j.error?.message || 'Error al subir'); res(j); } catch (e) { rej(e); } };
        x.onerror = () => rej(new Error('Fallo de red durante la subida'));
        x.send(blob);
      });
    },
    async youtubeThumbnail(videoId, blob) {
      const token = await this.youtubeToken();
      const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': blob.type || 'image/png' }, body: blob });
      return asJson(r);
    },
  };
})();
