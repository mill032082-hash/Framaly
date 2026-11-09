// FRAMALY Studio · herramientas del servidor MCP / API. Usan las claves y los topes de la cuenta del usuario.
import { LABEL, PRICE, type Provider, checkBudget, db, getKey, logError, openaiImageEach, record, tokenCost, type Access } from "./budget.ts";
import { audioDuration, isPrivateHost, mp3Duration, newId, openaiSize, parseJSON, sniffAudio, sniffImage } from "./lib.ts";

export class ToolError extends Error {}
export type Ctx = { client: ReturnType<typeof db>; uid: string; acc: Access };

const SECRET: Record<Provider, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", elevenlabs: "ELEVENLABS_API_KEY", gemini: "GEMINI_API_KEY", minimax: "MINIMAX_API_KEY" };
const BUCKET = "framaly-media";
const MODELS = { anthropic: "claude-sonnet-5-5", openai: "gpt-4.1-mini", gemini: "gemini-3.8-flash", image: "gpt-image-1", geminiImage: "gemini-2.5-flash-image", tts: "gpt-4o-mini-tts", eleven: "eleven_multilingual_v2" };

const allowed = (ctx: Ctx, p: Provider) => ctx.acc.role === "admin" || ["shared", "both"].includes(String(ctx.acc.ai?.[p]));

/** Primera IA usable (permitida para la cuenta y con clave guardada), o la pedida */
async function pick(ctx: Ctx, order: Provider[], pref?: string): Promise<{ p: Provider; key: string }> {
  const list = pref ? [pref as Provider] : order;
  for (const p of list) {
    if (!order.includes(p)) throw new ToolError(`${pref} no sirve para esta herramienta. Opciones: ${order.join(", ")}.`);
    if (!allowed(ctx, p)) { if (pref) throw new ToolError(`Tu cuenta no tiene habilitada la clave de FRAMALY para ${LABEL[p]}.`); continue; }
    const key = await getKey(ctx.client, p, SECRET[p]);
    if (key) return { p, key };
    if (pref) throw new ToolError(`El administrador todavía no guardó la clave de ${LABEL[p]}.`);
  }
  throw new ToolError(`No hay ninguna IA disponible para esto (${order.map((x) => LABEL[x]).join(", ")}). Pide al administrador que conecte una en Integraciones API y la habilite para tu cuenta.`);
}

async function budget(ctx: Ctx, p: Provider) {
  const stop = await checkBudget(ctx.client, p, ctx.uid, ctx.acc);
  if (stop) { let m = "Se alcanzó un tope de uso."; try { m = (await stop.json()).error.message; } catch { /* mensaje por defecto */ } throw new ToolError(m); }
}

async function call(ctx: Ctx, p: Provider, url: string, init: RequestInit): Promise<Response> {
  const r = await fetch(url, init);
  if (r.ok) return r;
  const t = await r.text(); let msg = t.slice(0, 200);
  try { const j = JSON.parse(t); msg = j?.error?.message ?? j?.detail?.message ?? msg; } catch { /* texto */ }
  await logError(ctx.client, { provider: p, uid: ctx.uid, email: ctx.acc.email, kind: r.status === 401 || r.status === 403 ? "clave" : "proveedor", status: r.status, message: `[MCP] ${msg}` });
  throw new ToolError(`${LABEL[p]} respondió ${r.status}: ${String(msg).replace(/[A-Za-z0-9_\-]{24,}/g, "•••")}`);
}

/* ---------- texto ---------- */
async function text(ctx: Ctx, o: { system: string; prompt: string; json?: boolean; maxTokens?: number; provider?: string }) {
  const { p, key } = await pick(ctx, ["anthropic", "openai", "gemini"], o.provider);
  await budget(ctx, p);
  const max = Math.min(o.maxTokens ?? 4000, 8000);
  let out = "", tin = 0, tout = 0, model = "", cost = 0;
  if (p === "anthropic") {
    model = MODELS.anthropic;
    const j = await (await call(ctx, p, "https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: max, system: o.system + (o.json ? "\nResponde ÚNICAMENTE con JSON válido." : ""), messages: [{ role: "user", content: o.prompt }] }) })).json();
    out = (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join(""); tin = Number(j.usage?.input_tokens ?? 0); tout = Number(j.usage?.output_tokens ?? 0);
    cost = tokenCost(PRICE.anthropic.perMTok, PRICE.anthropic.fallback, model, tin, tout);
  } else if (p === "openai") {
    model = MODELS.openai;
    const body: Record<string, unknown> = { model, max_tokens: max, messages: [{ role: "system", content: o.system }, { role: "user", content: o.prompt + (o.json ? "\n\nResponde solo con JSON." : "") }] };
    if (o.json) body.response_format = { type: "json_object" };
    const j = await (await call(ctx, p, "https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) })).json();
    out = j.choices?.[0]?.message?.content ?? ""; tin = Number(j.usage?.prompt_tokens ?? 0); tout = Number(j.usage?.completion_tokens ?? 0);
    cost = tokenCost(PRICE.openai.chatPerMTok, PRICE.openai.chatFallback, model, tin, tout);
  } else {
    model = MODELS.gemini;
    const gc: Record<string, unknown> = { maxOutputTokens: max }; if (o.json) gc.responseMimeType = "application/json";
    const j = await (await call(ctx, p, `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: o.system }] }, contents: [{ role: "user", parts: [{ text: o.prompt + (o.json ? "\n\nResponde solo con JSON." : "") }] }], generationConfig: gc }) })).json();
    out = (j.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.text ?? "").join(""); tin = Number(j.usageMetadata?.promptTokenCount ?? 0); tout = Number(j.usageMetadata?.candidatesTokenCount ?? 0) + Number(j.usageMetadata?.thoughtsTokenCount ?? 0);
    cost = tokenCost(PRICE.gemini.perMTok, PRICE.gemini.fallback, model, tin, tout);
  }
  await record(ctx.client, { uid: ctx.uid, acc: ctx.acc, provider: p, kind: "texto", units: { in_tokens: tin, out_tokens: tout, model, via: "mcp" }, cost });
  return { text: out, provider: p };
}

async function json(ctx: Ctx, o: Parameters<typeof text>[1]) {
  const r = await text(ctx, { ...o, json: true });
  try { return { data: parseJSON(r.text), provider: r.provider }; } catch { throw new ToolError("La IA devolvió un formato inesperado. Inténtalo de nuevo."); }
}

/* ---------- imágenes y voz ---------- */
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function image(ctx: Ctx, o: { prompt: string; aspect?: string; quality?: string; provider?: string }) {
  const { p, key } = await pick(ctx, ["openai", "gemini"], o.provider);
  await budget(ctx, p);
  const aspect = o.aspect ?? "16:9";
  if (p === "openai") {
    const size = openaiSize(aspect), q = o.quality ?? "medium", model = MODELS.image;
    const j = await (await call(ctx, p, "https://api.openai.com/v1/images/generations", { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ model, prompt: o.prompt, size, n: 1, quality: q }) })).json();
    const d = j.data?.[0]; if (!d?.b64_json) throw new ToolError("OpenAI no devolvió la imagen. Prueba con otra descripción o con provider=gemini.");
    await record(ctx.client, { uid: ctx.uid, acc: ctx.acc, provider: p, kind: "imagen", units: { images: 1, quality: q, model, via: "mcp" }, cost: openaiImageEach(model, q, size) });
    return { bytes: b64(d.b64_json), mime: "image/png", provider: p };
  }
  const j = await (await call(ctx, p, `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.geminiImage}:generateContent`, { method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: o.prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: aspect } } }) })).json();
  const d = (j.candidates?.[0]?.content?.parts ?? []).map((x: any) => x.inlineData ?? x.inline_data).find(Boolean);
  if (!d?.data) throw new ToolError("Gemini no devolvió la imagen. Prueba con otra descripción o con provider=openai.");
  await record(ctx.client, { uid: ctx.uid, acc: ctx.acc, provider: p, kind: "imagen", units: { images: 1, model: MODELS.geminiImage, via: "mcp" }, cost: PRICE.gemini.imageEach });
  return { bytes: b64(d.data), mime: d.mimeType ?? d.mime_type ?? "image/png", provider: p };
}

async function voice(ctx: Ctx, o: { text: string; provider?: string; voice?: string; voice_id?: string }) {
  const { p, key } = await pick(ctx, ["openai", "elevenlabs"], o.provider);
  await budget(ctx, p);
  const chars = o.text.length;
  if (p === "openai") {
    const res = await call(ctx, p, "https://api.openai.com/v1/audio/speech", { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODELS.tts, voice: o.voice || "nova", input: o.text, response_format: "mp3", instructions: "Narrador profesional: voz cálida, clara, con ritmo dinámico y entonación natural." }) });
    const bytes = new Uint8Array(await res.arrayBuffer());
    await record(ctx.client, { uid: ctx.uid, acc: ctx.acc, provider: p, kind: "voz", units: { chars, via: "mcp" }, cost: chars * PRICE.openai.ttsPerChar });
    return { bytes, mime: "audio/mpeg", duration: mp3Duration(bytes), provider: p };
  }
  let vid = o.voice_id;
  if (!vid) {
    const v = await (await call(ctx, p, "https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } })).json();
    vid = v.voices?.[0]?.voice_id; if (!vid) throw new ToolError("No encontré voces en la cuenta de ElevenLabs.");
  }
  const res = await call(ctx, p, `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vid)}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ text: o.text, model_id: MODELS.eleven }) });
  const bytes = new Uint8Array(await res.arrayBuffer());
  await record(ctx.client, { uid: ctx.uid, acc: ctx.acc, provider: p, kind: "voz", units: { chars, via: "mcp" }, cost: chars * PRICE.elevenlabs.perChar });
  return { bytes, mime: "audio/mpeg", duration: (bytes.length * 8) / 128000, provider: p };
}

/* ---------- descargar una imagen de un enlace (con protección contra redes internas) ---------- */
const MAX_IMG = 8 * 1024 * 1024, MAX_AUD = 25 * 1024 * 1024;
async function download(url: string, kind: "image" | "audio" = "image"): Promise<{ bytes: Uint8Array; mime: string }> {
  const MAX = kind === "image" ? MAX_IMG : MAX_AUD, W = kind === "image" ? "imagen" : "audio";
  let u: URL;
  try { u = new URL(url); } catch { throw new ToolError(`El enlace «${String(url).slice(0, 60)}» no es válido.`); }
  for (let hop = 0; hop < 4; hop++) {
    if (u.protocol !== "https:" || u.username || u.password || isPrivateHost(u.hostname)) throw new ToolError("Solo se aceptan enlaces https públicos.");
    try {
      const ips = [...(await Deno.resolveDns(u.hostname, "A")), ...(await Deno.resolveDns(u.hostname, "AAAA").catch(() => [] as string[]))];
      if (ips.some((ip) => isPrivateHost(ip))) throw new ToolError("Ese enlace apunta a una red privada.");
    } catch (e) { if (e instanceof ToolError) throw e; /* sin DNS disponible: basta con la revisión del nombre */ }
    let r: Response;
    try { r = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(15000), headers: { "user-agent": "FRAMALY-import/1.0" } }); } catch { throw new ToolError(`No pude descargar el ${W} de ${u.hostname} (sin respuesta).`); }
    if ([301, 302, 303, 307, 308].includes(r.status)) { const loc = r.headers.get("location"); if (!loc) throw new ToolError("El enlace redirige a ninguna parte."); u = new URL(loc, u); continue; }
    if (!r.ok) throw new ToolError(`No pude descargar el ${W} (${r.status}). Si el enlace es temporal, puede haber vencido.`);
    if (Number(r.headers.get("content-length") ?? 0) > MAX) throw new ToolError(`El ${W} pesa más de ${MAX / 1048576} MB.`);
    const chunks: Uint8Array[] = []; let n = 0;
    const rd = r.body?.getReader(); if (!rd) throw new ToolError("La descarga vino vacía.");
    for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.length; if (n > MAX) { await rd.cancel(); throw new ToolError(`El ${W} pesa más de ${MAX / 1048576} MB.`); } chunks.push(value); }
    const bytes = new Uint8Array(n); let o = 0; for (const c of chunks) { bytes.set(c, o); o += c.length; }
    const mime = kind === "image" ? sniffImage(bytes) : sniffAudio(bytes); if (!mime) throw new ToolError(kind === "image" ? "Ese enlace no es una imagen PNG, JPG, WEBP o GIF." : "Ese enlace no es un audio MP3, WAV, M4A u OGG.");
    return { bytes, mime };
  }
  throw new ToolError("El enlace redirige demasiadas veces.");
}
const isAudioRef = (f: any) => /^audio\//i.test(String(f?.mime_type ?? "")) || /\.(mp3|wav|m4a|ogg|aac)$/i.test(String(f?.name ?? ""));
const refUrls = (refs: unknown, audio = false): string[] => (Array.isArray(refs) ? refs : []).filter((f: any) => isAudioRef(f) === audio).map((f: any) => String(f?.download_link ?? "")).filter(Boolean);
const importAudio = async (ctx: Ctx, url: string, name: string) => { const d = await download(url, "audio"); const dur = audioDuration(d.bytes, d.mime); const m = await saveMedia(ctx, { type: "audio", bytes: d.bytes, mime: d.mime, name, meta: { imported: true }, duration: dur }); return { ...m, duration: dur }; };
const importUrl = async (ctx: Ctx, url: string, name: string, meta: Record<string, unknown> = {}) => { const d = await download(url); const m = await saveMedia(ctx, { type: "image", bytes: d.bytes, mime: d.mime, name, meta: { ...meta, imported: true } }); return m; };

/* ---------- biblioteca ---------- */
async function saveMedia(ctx: Ctx, o: { type: "image" | "audio"; bytes: Uint8Array; mime: string; name: string; meta?: Record<string, unknown>; duration?: number }) {
  const id = newId("m"), path = `${ctx.uid}/${id}`, now = Date.now();
  const up = await ctx.client.storage.from(BUCKET).upload(path, o.bytes, { contentType: o.mime, upsert: true });
  if (up.error) throw new ToolError("No se pudo guardar el archivo en tu biblioteca: " + up.error.message);
  const { error } = await ctx.client.from("framaly_media").insert({ user_id: ctx.uid, id, type: o.type, name: o.name.slice(0, 120), source: "ai", meta: { ...(o.meta ?? {}), via: "mcp" }, size: o.bytes.length, duration: o.duration ?? null, mime: o.mime, created: now, updated: now, deleted: false });
  if (error) throw new ToolError("No se pudo registrar el archivo en tu biblioteca: " + error.message);
  const sig = await ctx.client.storage.from(BUCKET).createSignedUrl(path, 3600);
  return { id, url: sig.data?.signedUrl ?? null };
}

async function mediaRow(ctx: Ctx, id: string, type: "image" | "audio") {
  const { data } = await ctx.client.from("framaly_media").select("id,type,duration,name").eq("user_id", ctx.uid).eq("id", id).eq("deleted", false).maybeSingle();
  if (!data || data.type !== type) throw new ToolError(`No encontré ${type === "image" ? "la imagen" : "el audio"} «${id}» en tu biblioteca (usa framaly_list_media).`);
  return data as { id: string; type: string; duration: number | null; name: string };
}

const pool = async <T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length); let k = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (k < items.length) { const i = k++; out[i] = await fn(items[i], i); } }));
  return out;
};

/* ---------- herramientas ---------- */
type Handler = (ctx: Ctx, a: any) => Promise<unknown>;

export const HANDLERS: Record<string, Handler> = {
  async framaly_status(ctx) {
    const avail = async (order: Provider[]) => { const r: string[] = []; for (const p of order) if (allowed(ctx, p) && (await getKey(ctx.client, p, SECRET[p]))) r.push(p); return r; };
    const day = new Date(); day.setUTCHours(0, 0, 0, 0);
    const { data: spent } = await ctx.client.rpc("framaly_cost_sum", { p_provider: null, p_user: ctx.uid, p_since: day.toISOString() });
    return { cuenta: ctx.acc.email, rol: ctx.acc.role, ias_disponibles: { texto: await avail(["anthropic", "openai", "gemini"]), imagenes: await avail(["openai", "gemini"]), voz: await avail(["openai", "elevenlabs"]) },
      tope_diario_usd: ctx.acc.role === "admin" ? null : Number(ctx.acc.daily_usd), gastado_hoy_usd: Number(Number(spent ?? 0).toFixed(4)) };
  },

  async framaly_write_script(ctx, a) {
    const dur = a.duration_seconds ?? 60, n = a.scenes ?? Math.min(12, Math.max(3, Math.round(dur / 7))), words = Math.round(dur * 2.4);
    const { data, provider } = await json(ctx, { provider: a.provider, maxTokens: 6000,
      system: "Eres un guionista profesional de YouTube, experto en retención de audiencia, storytelling y videos narrados construidos con imágenes.",
      prompt: `Escribe el guion de un video narrado sobre: "${a.topic}".
- Idioma de la narración: ${a.language || "español"}
- Tono: ${a.tone || "informativo y entretenido"}
- Público: ${a.audience || "público general"}
- Duración aproximada: ${dur} segundos (unas ${words} palabras de narración en total, repartidas entre las escenas)
- Exactamente ${n} escenas. La primera debe ser un gancho potente en los primeros 5 segundos; la última, un cierre con llamada a la acción.
${a.extra ? "- Instrucciones extra: " + a.extra : ""}
Para cada escena entrega "narration" (texto exacto del locutor, sin acotaciones), "image_prompt" (descripción visual detallada EN ESPAÑOL, sin texto ni letras en la imagen, coherente entre escenas) y "on_screen_text" (2 a 6 palabras).
Devuelve JSON: {"title":"título atractivo (máx. 70 caracteres)","scenes":[{"narration":"...","image_prompt":"...","on_screen_text":"..."}]}` });
    if (!Array.isArray(data.scenes) || !data.scenes.length) throw new ToolError("El guion generado no contiene escenas. Inténtalo de nuevo.");
    return { ia_usada: provider, title: String(data.title ?? a.topic).slice(0, 100), scenes: data.scenes.slice(0, 12).map((s: any) => ({ narration: String(s.narration ?? ""), image_prompt: String(s.image_prompt ?? s.narration ?? ""), on_screen_text: String(s.on_screen_text ?? "") })) };
  },

  async framaly_generate_image(ctx, a) {
    const r = await image(ctx, a);
    const m = await saveMedia(ctx, { type: "image", bytes: r.bytes, mime: r.mime, name: a.name || a.prompt.slice(0, 48), meta: { prompt: a.prompt } });
    return { media_id: m.id, url_temporal: m.url, ia_usada: r.provider, nota: "La imagen ya está en la biblioteca de FRAMALY." };
  },

  async framaly_import_image(ctx, a) {
    const urls = [...(a.image_urls ?? []), ...refUrls(a.openaiFileIdRefs)];
    if (!urls.length) throw new ToolError("Pasa image_urls (enlaces https) o las imágenes de la conversación (openaiFileIdRefs).");
    if (urls.length > 12) throw new ToolError("Máximo 12 imágenes por llamada.");
    const out: unknown[] = [], fallos: string[] = [];
    await pool(urls, 3, async (u, i) => { try { const m = await importUrl(ctx, u, `${a.name || "Imagen importada"} ${i + 1}`); out[i] = { media_id: m.id, url_temporal: m.url }; } catch (e) { fallos.push(`imagen ${i + 1}: ${(e as Error).message}`); } });
    if (!out.filter(Boolean).length) throw new ToolError(fallos.join(" · "));
    return { importadas: out.filter(Boolean), fallos, siguiente_paso: "Usa los media_id en framaly_create_video_project (image_media_id)." };
  },

  async framaly_import_audio(ctx, a) {
    const urls = [...(a.audio_urls ?? []), ...refUrls(a.openaiFileIdRefs, true)];
    if (!urls.length) throw new ToolError("Pasa audio_urls (enlaces https) o los audios de la conversación (openaiFileIdRefs).");
    if (urls.length > 12) throw new ToolError("Máximo 12 audios por llamada.");
    const out: unknown[] = [], fallos: string[] = [];
    await pool(urls, 3, async (u, i) => { try { const m = await importAudio(ctx, u, `${a.name || "Audio importado"} ${i + 1}`); out[i] = { media_id: m.id, duracion_segundos: Number(m.duration.toFixed(2)), url_temporal: m.url }; } catch (e) { fallos.push(`audio ${i + 1}: ${(e as Error).message}`); } });
    if (!out.filter(Boolean).length) throw new ToolError(fallos.join(" · "));
    return { importados: out.filter(Boolean), fallos, siguiente_paso: "Usa los media_id en framaly_create_video_project (voice_media_id por escena o music_media_id)." };
  },

  async framaly_generate_voice(ctx, a) {
    const r = await voice(ctx, a);
    const m = await saveMedia(ctx, { type: "audio", bytes: r.bytes, mime: r.mime, name: a.name || a.text.slice(0, 48), meta: { text: a.text }, duration: r.duration });
    return { media_id: m.id, duracion_segundos: Number(r.duration.toFixed(2)), url_temporal: m.url, ia_usada: r.provider };
  },

  async framaly_seo_metadata(ctx, a) {
    const { data, provider } = await json(ctx, { provider: a.provider, maxTokens: 2500,
      system: "Eres un experto en SEO de YouTube y crecimiento de canales.",
      prompt: `Crea los metadatos optimizados para un video de YouTube en ${a.language || "español"}.
Tema: ${a.topic}
${a.narration ? "Narración: " + String(a.narration).slice(0, 6000) : ""}
${a.keywords ? "Palabras clave objetivo: " + a.keywords : ""}
Devuelve JSON: {"title":"título con gancho, máx. 70 caracteres","description":"descripción de 3 párrafos con 3-5 hashtags al final","tags":["15 a 25 etiquetas"]}` });
    return { ia_usada: provider, title: String(data.title ?? "").slice(0, 100), description: String(data.description ?? ""), tags: (Array.isArray(data.tags) ? data.tags : String(data.tags ?? "").split(",")).map((t: unknown) => String(t).trim()).filter(Boolean) };
  },

  async framaly_create_video_project(ctx, a) {
    const given = [...(a.image_urls ?? []), ...refUrls(a.openaiFileIdRefs)] as string[];
    const audioGiven = [...(a.audio_urls ?? []), ...refUrls(a.openaiFileIdRefs, true)] as string[];
    let scenes: any[] = Array.isArray(a.scenes) ? a.scenes.map((s: any) => ({ ...s })) : [];
    if (!scenes.length) { if (!given.length) throw new ToolError("Pasa scenes o imágenes (image_urls / openaiFileIdRefs)."); scenes = given.slice(0, 12).map(() => ({ narration: "" })); }
    let gi = 0;
    for (const s of scenes) if (!s.image_media_id && !s.image_url && !String(s.image_prompt ?? "").trim() && gi < given.length) s.image_url = given[gi++];
    // audios que ya existen: uno solo = música de fondo; varios = narración de cada escena, en orden
    let musicUrl: string | null = a.music_url ?? null;
    if (audioGiven.length === 1 && !musicUrl && !a.music_media_id) musicUrl = audioGiven[0];
    else if (audioGiven.length > 1) { let ai = 0; for (const s of scenes) if (!s.voice_media_id && !s.voice_url && ai < audioGiven.length) s.voice_url = audioGiven[ai++]; }
    const aspect = a.aspect ?? "16:9", style = a.style ? ". " + a.style : "";
    const genImg = scenes.filter((s) => !s.image_media_id && !s.image_url).length, wantVoice = a.voice ?? true;
    const genVoice = wantVoice ? scenes.filter((s) => !s.voice_media_id && !s.voice_url && String(s.narration ?? "").trim()).length : 0;
    if (scenes.some((s) => !s.image_media_id && !s.image_url && !String(s.image_prompt ?? "").trim())) throw new ToolError("Cada escena necesita image_prompt, image_url o image_media_id (o pasa image_urls / openaiFileIdRefs).");
    if (genImg > 6 || genVoice > 6) throw new ToolError("Máximo 6 imágenes y 6 voces generadas por llamada. Genéralas antes con framaly_generate_image / framaly_generate_voice y pasa image_media_id / voice_media_id.");
    if (genVoice) await pick(ctx, ["openai", "elevenlabs"], a.voice_provider).catch((e) => { if (a.voice === true || a.voice_provider) throw e; scenes.forEach((s) => { if (!s.voice_media_id) s.__skipVoice = true; }); });
    const failures: string[] = [], created: string[] = [];
    const res = await pool(scenes, 3, async (s, i) => {
      try {
        let img = s.image_media_id ? await mediaRow(ctx, s.image_media_id, "image") : null;
        if (!img && s.image_url) { const m = await importUrl(ctx, String(s.image_url), `${a.title.slice(0, 40)} · escena ${i + 1}`); created.push(m.id); img = { id: m.id, type: "image", duration: null, name: "" }; }
        if (!img) { const r = await image(ctx, { prompt: s.image_prompt + style, aspect, provider: a.image_provider }); const m = await saveMedia(ctx, { type: "image", bytes: r.bytes, mime: r.mime, name: `${a.title.slice(0, 40)} · escena ${i + 1}`, meta: { prompt: s.image_prompt } }); created.push(m.id); img = { id: m.id, type: "image", duration: null, name: "" }; }
        let vo: { id: string; duration: number } | null = null;
        if (s.voice_media_id) { const r = await mediaRow(ctx, s.voice_media_id, "audio"); vo = { id: r.id, duration: Number(r.duration ?? 0) }; }
        else if (s.voice_url) { const m = await importAudio(ctx, String(s.voice_url), `${a.title.slice(0, 32)} · voz ${i + 1}`); created.push(m.id); vo = { id: m.id, duration: m.duration }; }
        else if (wantVoice && !s.__skipVoice && String(s.narration ?? "").trim()) {
          const r = await voice(ctx, { text: String(s.narration).slice(0, 4000), provider: a.voice_provider, voice: a.voice_name, voice_id: a.voice_id });
          const m = await saveMedia(ctx, { type: "audio", bytes: r.bytes, mime: r.mime, name: `${a.title.slice(0, 32)} · voz ${i + 1}`, meta: { text: s.narration }, duration: r.duration }); created.push(m.id); vo = { id: m.id, duration: r.duration };
        }
        return { img: img.id, vo };
      } catch (e) { failures.push(`escena ${i + 1}: ${(e as Error).message}`); return null; }
    });
    if (failures.length) throw new ToolError(`No se pudo crear el proyecto. ${failures.join(" · ")}. Archivos ya creados (reutilízalos con image_media_id / voice_media_id): ${created.join(", ") || "ninguno"}.`);

    let music: { id: string } | null = null;
    try {
      if (a.music_media_id) { const r = await mediaRow(ctx, a.music_media_id, "audio"); music = { id: r.id }; }
      else if (musicUrl) { const m = await importAudio(ctx, musicUrl, `${a.title.slice(0, 32)} · música`); music = { id: m.id }; }
    } catch (e) { throw new ToolError(`No se pudo usar la música: ${(e as Error).message}`); }

    // montaje: mismas reglas que el Agente Editor de FRAMALY
    const TR = ["fade", "slideL", "zoom", "circle", "blur", "wipe", "black", "slideU"], MO = ["kenburns", "zoomIn", "panR", "zoomOut", "panL", "panU"], sub = a.subtitles ?? "narracion";
    const now = Date.now(), clips: unknown[] = [], audio: unknown[] = []; let t = 0;
    scenes.forEach((s, i) => {
      const r = res[i]!, dur = Math.round((r.vo ? Math.max(2.5, r.vo.duration + 0.7) : Math.max(2.5, Number(a.seconds_per_scene ?? 5))) * 10) / 10;
      const txt = sub === "narracion" ? String(s.narration ?? "") : sub === "pantalla" ? String(s.on_screen_text ?? "") : "";
      clips.push({ id: newId("c"), mediaId: r.img, duration: dur, fit: "cover", motion: MO[i % MO.length], motionAmt: 0.15, filter: "cine", transition: TR[i % TR.length], transDur: 0.8, text: txt, textStyle: sub === "narracion" ? "subtitulo" : i === 0 ? "titulo" : "inferior", textAnim: sub === "narracion" ? "fade" : "up", textColor: "#ffffff" });
      if (r.vo) audio.push({ id: newId("a"), mediaId: r.vo.id, start: Math.round((t + 0.2) * 10) / 10, volume: 1, loop: false, fadeOut: false, kind: "voz" });
      t = Math.round((t + dur) * 10) / 10;
    });
    if (music) audio.push({ id: newId("a"), mediaId: music.id, start: 0, volume: 0.18, loop: true, fadeOut: true, kind: "musica" });
    const pid = newId("p");
    const project = { id: pid, name: a.title, aspect, fps: 30, clips, audio, watermark: "", letterbox: false, progressBar: false, meta: { title: a.title, description: "", tags: "" },
      script: { title: a.title, scenes: scenes.map((s) => ({ narration: String(s.narration ?? ""), image_prompt: String(s.image_prompt ?? ""), on_screen_text: String(s.on_screen_text ?? "") })) }, created: now, updated: now };
    const { error } = await ctx.client.from("framaly_projects").insert({ user_id: ctx.uid, id: pid, data: project, updated: now, deleted: false });
    if (error) throw new ToolError("No se pudo guardar el proyecto: " + error.message);
    return { project_id: pid, nombre: a.title, escenas: scenes.length, duracion_segundos: t, con_voz: audio.some((x: any) => x.kind === "voz"), con_musica: !!music, siguiente_paso: "Abre FRAMALY, pulsa «Actualizar» y verás el proyecto en el Editor de video. Desde ahí puedes ajustarlo y exportar el MP4." };
  },

  async framaly_list_projects(ctx, a) {
    const { data, error } = await ctx.client.from("framaly_projects").select("id,data,updated").eq("user_id", ctx.uid).eq("deleted", false).order("updated", { ascending: false }).limit(a.limit ?? 20);
    if (error) throw new ToolError(error.message);
    return { proyectos: (data ?? []).map((r: any) => ({ id: r.id, nombre: r.data?.name, formato: r.data?.aspect, clips: r.data?.clips?.length ?? 0, duracion_segundos: Math.round((r.data?.clips ?? []).reduce((s: number, c: any) => s + Number(c.duration || 0), 0) * 10) / 10, actualizado: new Date(Number(r.updated)).toISOString() })) };
  },

  async framaly_list_media(ctx, a) {
    let q = ctx.client.from("framaly_media").select("id,type,name,source,duration,created").eq("user_id", ctx.uid).eq("deleted", false).order("created", { ascending: false }).limit(a.limit ?? 30);
    if (a.type) q = q.eq("type", a.type);
    const { data, error } = await q; if (error) throw new ToolError(error.message);
    return { archivos: (data ?? []).map((m: any) => ({ id: m.id, tipo: m.type, nombre: m.name, origen: m.source, duracion_segundos: m.duration })) };
  },
};
