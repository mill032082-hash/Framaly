/* FRAMALY — conectores de API: OpenAI, Anthropic (Claude), ElevenLabs, Gemini (Google), MiniMax, YouTube */
(function () {
  'use strict';
  const key = (n) => (F.settings.keys[n] || '').trim();
  const AI = ['anthropic', 'openai', 'elevenlabs', 'gemini', 'minimax'];
  const GEM = 'https://generativelanguage.googleapis.com', MM = 'https://api.minimax.io';
  const GEMINI_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Zephyr', 'Leda', 'Orus', 'Callirrhoe', 'Enceladus'];
  /** MiniMax avisa los fallos dentro de la respuesta (aunque el HTTP sea 200) */
  const mmOk = (j) => { if (j?.base_resp && Number(j.base_resp.status_code) !== 0) throw new Error('MiniMax: ' + (j.base_resp.status_msg || 'error')); return j; };
  const aspectOf = (size) => { const [w, h] = String(size).split('x').map(Number); return w > h ? '16:9' : h > w ? '9:16' : '1:1'; };
  const hexBytes = (hex) => new Uint8Array((hex.match(/.{1,2}/g) || []).map((h) => parseInt(h, 16)));
  /** Audio crudo (PCM 16 bits, mono) -> WAV */
  const pcmToWav = (pcm, rate = 24000) => {
    const h = new ArrayBuffer(44), v = new DataView(h), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length, true);
    return new Blob([h, pcm], { type: 'audio/wav' });
  };
  /** 'shared' (clave de FRAMALY en el servidor) · 'own' (clave propia de este navegador) · 'off' */
  const mode = (n) => (AI.includes(n) && F.cloud?.aiMode ? F.cloud.aiMode(n) : 'own');
  const need = (n, label) => {
    const m = mode(n);
    if (m === 'shared') return;
    if (m === 'off') throw new Error(`${label} no está habilitado para tu cuenta. Pídeselo a quien administra FRAMALY.`);
    if (!key(n)) throw new Error(`Falta la API key de ${label}. Configúrala en Integraciones API.`);
  };
  /** Llamada a un proveedor: por la puerta segura si se usa la clave compartida, directa si es clave propia */
  /** ¿Se permite usar esta API para texto (prompts), imágenes o voz en este navegador? Por defecto sí. */
  const canUse = (p, cap) => F.settings.uses?.[p]?.[cap] !== false;
  const net = async (prov, url, init) => {
    if (mode(prov) !== 'shared') {
      try { return await fetch(url, init); } catch (e) {
        if (prov === 'minimax') throw new Error('MiniMax no permite llamadas directas desde el navegador. Pide a quien administra FRAMALY que te dé acceso a su clave.');
        throw e;
      }
    }
    const r = await F.cloud.gateway(prov, url, init);
    if (r.status === 503 && key(prov)) return fetch(url, init); // clave compartida sin configurar: usa la propia si existe
    if (r.status === 503 && !key(prov)) {
      const lab = { openai: 'OpenAI', anthropic: 'Claude', elevenlabs: 'ElevenLabs', gemini: 'Gemini', minimax: 'MiniMax' }[prov] || prov;
      const msg = F.cloud?.isAdmin?.() ? `Todavía no hay clave de ${lab} guardada. Ve a Integraciones API → ${lab}, pega la clave y pulsa «Guardar clave».` : `${lab} todavía no está disponible: el administrador aún no ha guardado su clave.`;
      return new Response(JSON.stringify({ error: { message: msg } }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    return r;
  };

  async function asJson(r) {
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (e) {}
    if (!r.ok) {
      const msg = j?.error?.message || j?.detail?.message || (typeof j?.detail === 'string' ? j.detail : '') || j?.message || txt.slice(0, 200) || r.statusText;
      const hint = r.status === 404 && /no longer available|not found for API|is not found/i.test(msg) ? ' → Ese modelo ya no está disponible. Cámbialo en Integraciones API → Modelos (en Gemini puedes pulsar «Ver modelos disponibles»).' : '';
      throw new Error(`Error ${r.status}: ${msg}${hint}`);
    }
    return j;
  }
  async function asBlob(r) {
    if (!r.ok) await asJson(r);
    return r.blob();
  }

  F.api = {
    canUse,
    has: (n) => { const m = mode(n); return AI.includes(n) ? (m === 'shared' ? true : m === 'off' ? false : !!key(n)) : !!key(n); },
    textReady() { return ['anthropic', 'openai', 'gemini', 'minimax'].some((p) => this.has(p)); },

    /** Elige el proveedor de texto: el preferido si tiene key, si no el otro */
    textProvider(pref) {
      const p = pref && pref !== 'auto' ? pref : F.settings.textProvider;
      if (pref && pref !== 'auto') {   // lo que eliges es lo que se usa: sin cambiar solo a otra IA
        if (!this.has(pref)) { const L = { anthropic: 'Claude', openai: 'OpenAI', gemini: 'Gemini', minimax: 'MiniMax' }[pref] || pref; throw new Error(`${L} no está conectada o no está habilitada para tu cuenta. Conéctala en Integraciones API o elige otra IA.`); }
        return pref;
      }
      const found = [p, 'anthropic', 'openai', 'gemini', 'minimax'].find((x) => this.has(x) && canUse(x, 'text'));
      if (found) return found;
      throw new Error('Necesitas una API de texto (Claude, OpenAI, Gemini o MiniMax) para los agentes. Ve a Integraciones API.');
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
      if (prov === 'gemini') {
        const mdl = F.settings.models.gemini;
        const gc = { maxOutputTokens: maxTokens };
        if (json) gc.responseMimeType = 'application/json';
        if (/flash/.test(mdl) && !/pro/.test(mdl)) gc.thinkingConfig = { thinkingBudget: 0 };
        const r = await net('gemini', `${GEM}/v1beta/models/${encodeURIComponent(mdl)}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key('gemini') },
          body: JSON.stringify({ ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents: [{ role: 'user', parts: [{ text: prompt + (json ? '\n\nResponde solo con JSON.' : '') }] }], generationConfig: gc }),
        });
        const j = await asJson(r);
        return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      }
      if (prov === 'minimax') {
        const r = await net('minimax', `${MM}/v1/text/chatcompletion_v2`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key('minimax') },
          body: JSON.stringify({ model: F.settings.models.minimax, max_tokens: maxTokens, messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt + (json ? '\n\nResponde solo con JSON.' : '') }] }),
        });
        const j = mmOk(await asJson(r));
        return String(j.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
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
    imageProvider(pref) {
      let saved; try { saved = JSON.parse(localStorage.getItem('framaly.img') || '{}').provider; } catch (e) { /* sin preferencia */ }
      if (pref && pref !== 'auto') return pref;   // lo que eliges es lo que se usa: nunca se cambia solo a otra IA
      return [saved, 'openai', 'gemini', 'minimax'].find((x) => x && x !== 'auto' && this.has(x) && canUse(x, 'image')) || 'openai';
    },
    async image(o) {
      const p = this.imageProvider(o.provider);
      if (p === 'gemini') return this.imageGemini(o);
      if (p === 'minimax') return this.imageMinimax(o);
      if (o.provider === 'openai') return this.imageOpenAI(o);
      try { return await this.imageOpenAI(o); } catch (e) {
        // OpenAI puede no dejar generar imágenes (verificación de organización, saldo…): se prueba con otra IA si hay
        const alt = ['gemini', 'minimax'].find((x) => this.has(x) && canUse(x, 'image'));
        if (o.provider === 'openai' || !alt) throw new Error(/verif|organization/i.test(e.message) ? 'OpenAI no permite generar imágenes con esta cuenta (pide verificar la organización). Usa Gemini o MiniMax para las imágenes y deja OpenAI para los prompts.' : e.message);
        F.toast(`OpenAI no pudo generar la imagen; se usó ${alt === 'gemini' ? 'Gemini' : 'MiniMax'}.`, 'info', 5000);
        return alt === 'gemini' ? this.imageGemini(o) : this.imageMinimax(o);
      }
    },
    async imageGemini({ prompt, size = '1536x1024', n = 1 }) {
      need('gemini', 'Gemini');
      const one = async () => {
        const r = await net('gemini', `${GEM}/v1beta/models/${encodeURIComponent(F.settings.models.geminiImage)}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key('gemini') },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: aspectOf(size) } } }),
        });
        const j = await asJson(r);
        const d = (j.candidates?.[0]?.content?.parts || []).map((p) => p.inlineData || p.inline_data).find(Boolean);
        if (!d?.data) throw new Error(j.candidates?.[0]?.finishReason ? `Gemini no devolvió una imagen (${j.candidates[0].finishReason}). Prueba con otra descripción.` : 'Gemini no devolvió una imagen. Prueba con otra descripción.');
        return F.b64ToBlob(d.data, d.mimeType || d.mime_type || 'image/png');
      };
      return Promise.all(Array.from({ length: Math.min(4, Math.max(1, n)) }, one));
    },
    async imageMinimax({ prompt, size = '1536x1024', n = 1 }) {
      need('minimax', 'MiniMax');
      const r = await net('minimax', `${MM}/v1/image_generation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key('minimax') },
        body: JSON.stringify({ model: F.settings.models.minimaxImage, prompt, aspect_ratio: aspectOf(size), response_format: 'base64', n: Math.min(4, Math.max(1, n)) }),
      });
      const j = mmOk(await asJson(r));
      const list = j.data?.image_base64 || [];
      if (!list.length) throw new Error('MiniMax no devolvió imágenes. Prueba con otra descripción.');
      return list.map((b) => F.b64ToBlob(b, 'image/jpeg'));
    },
    async imageOpenAI({ prompt, size = '1536x1024', quality = 'medium', n = 1, model }) {
      need('openai', 'OpenAI');
      if (!canUse('openai', 'image')) throw new Error('OpenAI está configurada solo para textos y prompts. Elige Gemini o MiniMax como generador de imágenes.');
      const mdl = model || F.settings.models.image;
      const body = { model: mdl, prompt, size, n };
      if (quality && /gpt-image/.test(mdl)) body.quality = quality;
      if (/dall-e-2/.test(mdl)) { body.response_format = 'b64_json'; body.size = '1024x1024'; body.n = Math.min(4, n); }
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
      if (!canUse('openai', 'voice')) throw new Error('OpenAI está configurada sin voz. Elige otro proveedor de voz.');
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

    /** Gemini: voz (devuelve audio crudo que se envuelve como WAV). No admite velocidad. */
    async ttsGemini({ text, voice }) {
      need('gemini', 'Gemini');
      const r = await net('gemini', `${GEM}/v1beta/models/${encodeURIComponent(F.settings.models.geminiTts)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key('gemini') },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICES.includes(voice) ? voice : 'Kore' } } } } }),
      });
      const j = await asJson(r);
      const d = (j.candidates?.[0]?.content?.parts || []).map((p) => p.inlineData || p.inline_data).find(Boolean);
      if (!d?.data) throw new Error('Gemini no devolvió audio. Inténtalo de nuevo con un texto más corto.');
      const rate = +(/rate=(\d+)/.exec(d.mimeType || d.mime_type || '') || [])[1] || 24000;
      const bin = atob(d.data), pcm = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i);
      return pcmToWav(pcm, rate);
    },
    GEMINI_VOICES,
    /** MiniMax: voz (el audio llega como texto hexadecimal dentro del JSON) */
    async ttsMinimax({ text, voiceId, speed = 1 }) {
      need('minimax', 'MiniMax');
      if (!voiceId) throw new Error('Elige una voz de MiniMax.');
      const r = await net('minimax', `${MM}/v1/t2a_v2`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key('minimax') },
        body: JSON.stringify({ model: F.settings.models.minimaxTts, text, stream: false, voice_setting: { voice_id: voiceId, speed: +speed || 1, vol: 1, pitch: 0 }, audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 } }),
      });
      const j = mmOk(await asJson(r));
      if (!j.data?.audio) throw new Error('MiniMax no devolvió audio.');
      return new Blob([hexBytes(j.data.audio)], { type: 'audio/mpeg' });
    },
    async minimaxVoices() {
      need('minimax', 'MiniMax');
      const r = await net('minimax', `${MM}/v1/get_voice`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key('minimax') }, body: JSON.stringify({ voice_type: 'system' }) });
      const j = mmOk(await asJson(r));
      return (j.system_voice || []).map((v) => ({ id: v.voice_id, name: v.voice_name || v.voice_id }));
    },
    /** Une varias partes de audio en una sola (WAV con WAV; el resto como MP3) */
    async joinAudio(blobs) {
      if (blobs.length === 1) return blobs[0];
      if (blobs.every((b) => b.type === 'audio/wav')) {
        const parts = await Promise.all(blobs.map(async (b) => new Uint8Array((await b.arrayBuffer()).slice(44))));
        const all = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; parts.forEach((p) => { all.set(p, o); o += p.length; });
        return pcmToWav(all, 24000);
      }
      return new Blob(blobs, { type: 'audio/mpeg' });
    },

    /** TTS genérico según proveedor */
    async tts(o) {
      if (o.provider === 'elevenlabs') return this.ttsEleven({ ...o, voiceId: o.voiceId || o.voice });
      if (o.provider === 'gemini') return this.ttsGemini(o);
      if (o.provider === 'minimax') return this.ttsMinimax({ ...o, voiceId: o.voiceId || o.voice });
      return this.ttsOpenAI(o);
    },

    /** Modelos de Gemini disponibles para esta clave, ordenados por uso (los nombres cambian seguido) */
    async geminiModels() {
      need('gemini', 'Gemini');
      const j = await asJson(await net('gemini', `${GEM}/v1beta/models`, { headers: { 'x-goog-api-key': key('gemini') } }));
      const all = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => String(m.name).replace(/^models\//, ''));
      const bad = /embed|aqa|live|audio|robotics|computer-use|veo|imagen/i;
      return { text: all.filter((n) => /^gemini/.test(n) && !/image|tts/i.test(n) && !bad.test(n)), image: all.filter((n) => /image/i.test(n)), tts: all.filter((n) => /tts/i.test(n)) };
    },

    /** Modelos de video (Veo) disponibles con la clave de Gemini */
    async veoModels() {
      need('gemini', 'Gemini');
      const url = `${GEM}/v1beta/models` + (mode('gemini') === 'shared' ? '' : '?pageSize=200');
      const j = await asJson(await net('gemini', url, { headers: { 'x-goog-api-key': key('gemini') } }));
      return (j.models || []).map((m) => String(m.name).replace(/^models\//, '')).filter((n) => /veo/i.test(n));
    },

    /** Saldo real informado por el proveedor. Solo ElevenLabs lo entrega con una clave normal; se guarda una instantánea en el servidor. */
    async balance(n) {
      if (n !== 'elevenlabs') return null;
      need('elevenlabs', 'ElevenLabs');
      return asJson(await net('elevenlabs', 'https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key('elevenlabs') } }));
    },

    /** Pruebas de conexión */
    async test(n) {
      if (n === 'openai') { await asJson(await net('openai', 'https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + key('openai') } })); return 'Conexión correcta con OpenAI'; }
      if (n === 'anthropic') { await asJson(await net('anthropic', 'https://api.anthropic.com/v1/models', { headers: { 'x-api-key': key('anthropic'), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } })); return 'Conexión correcta con Anthropic'; }
      if (n === 'elevenlabs') { const v = await this.elevenVoices(); return `ElevenLabs conectado · ${v.length} voces disponibles`; }
      if (n === 'gemini') { await asJson(await net('gemini', `${GEM}/v1beta/models`, { headers: { 'x-goog-api-key': key('gemini') } })); return 'Conexión correcta con Gemini'; }
      if (n === 'minimax') { const v = await this.minimaxVoices(); return `MiniMax conectado · ${v.length} voces disponibles`; }
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
