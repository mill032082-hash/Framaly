/* FRAMALY — transcripción de la voz (palabras con tiempos).
   Motor "local": Whisper dentro del navegador (transformers.js), sin claves ni servidor.
   Motor "openai": Whisper de OpenAI con la clave propia de este navegador. */
(function () {
  'use strict';
  const T = (F.transcribe = {});
  const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/+esm';
  const MODEL = 'onnx-community/whisper-base_timestamped';
  let asr = null, loading = null;

  T.engine = () => { try { return localStorage.getItem('framaly_tr_engine') || 'local'; } catch (e) { return 'local'; } };
  T.setEngine = (v) => { try { localStorage.setItem('framaly_tr_engine', v); } catch (e) {} };

  /** AudioBuffer -> Float32 mono a 16 kHz (lo que espera Whisper) */
  T.to16k = async (buf) => {
    const n = Math.ceil(buf.duration * 16000), oc = new OfflineAudioContext(1, n, 16000);
    const s = oc.createBufferSource(); s.buffer = buf; s.connect(oc.destination); s.start();
    return (await oc.startRendering()).getChannelData(0);
  };

  /** Normaliza lo que devuelva cualquier motor a [{w, s, e}] */
  T.normalize = (chunks) => (chunks || [])
    .map((c) => ({ w: String(c.text ?? c.word ?? '').trim(), s: +(c.timestamp ? c.timestamp[0] : c.start) || 0, e: +(c.timestamp ? c.timestamp[1] : c.end) || 0 }))
    .filter((x) => x.w && !/^[♪�\s.,;:!?¿¡-]+$/.test(x.w))          // tokens basura
    .map((x) => ({ ...x, e: Math.max(x.e, x.s + 0.05) }));

  async function loadLocal(onProgress) {
    if (asr) return asr;
    if (loading) return loading;
    loading = (async () => {
      let mod; try { mod = await import(LIB); } catch (e) { throw new Error('No se pudo descargar el motor de transcripción (necesita internet la primera vez). Reintenta o elige el motor de OpenAI.'); }
      const { pipeline, env } = mod;
      env.allowLocalModels = false;
      const cb = (d) => { if (d.status === 'progress' && d.total) onProgress?.(`Descargando modelo… ${Math.round((d.loaded / d.total) * 100)}%`); };
      try { return (asr = await pipeline('automatic-speech-recognition', MODEL, { device: navigator.gpu ? 'webgpu' : 'wasm', progress_callback: cb })); }
      catch (e) { return (asr = await pipeline('automatic-speech-recognition', MODEL, { device: 'wasm', progress_callback: cb })); }
    })();
    try { return await loading; } finally { loading = null; }
  }

  async function viaLocal(buf, onProgress) {
    const m = await loadLocal(onProgress);
    onProgress?.('Transcribiendo en tu dispositivo…');
    const out = await m(await T.to16k(buf), { language: 'spanish', task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 });
    return T.normalize(out.chunks);
  }

  async function viaOpenAI(media) {
    const key = (F.settings.keys.openai || '').trim();
    if (!key) throw new Error('Para usar Whisper de OpenAI pega tu clave en Integraciones API (clave propia). O elige el motor «Local».');
    if (media.blob.size > 24 * 1024 * 1024) throw new Error('El audio pesa más de 24 MB (límite de OpenAI). Usa el motor «Local».');
    const fd = new FormData();
    fd.append('file', media.blob, (media.name || 'voz') + '.' + (/wav/.test(media.blob.type) ? 'wav' : /mpeg|mp3/.test(media.blob.type) ? 'mp3' : 'm4a'));
    fd.append('model', 'whisper-1'); fd.append('language', 'es'); fd.append('response_format', 'verbose_json'); fd.append('timestamp_granularities[]', 'word');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${j?.error?.message || 'error'}`);
    return T.normalize(j.words);
  }

  /** Transcribe un audio de la biblioteca. Devuelve [{w,s,e}] */
  T.run = async (mediaId, onProgress) => {
    const m = F.media.byId(mediaId); if (!m) throw new Error('Audio no encontrado');
    const eng = T.engine();
    const words = eng === 'openai' ? (onProgress?.('Enviando a OpenAI…'), await viaOpenAI(m)) : await viaLocal(await F.media.decode(m), onProgress);
    if (!words.length) throw new Error('No se detectó voz. Si el audio tiene mucho ruido o es de un celular lejos, no se puede transcribir bien.');
    return words;
  };
})();
