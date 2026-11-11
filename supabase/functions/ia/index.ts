// FRAMALY Studio · puerta segura hacia las APIs de IA (Claude, OpenAI, ElevenLabs, Gemini, MiniMax).
// Las claves viven solo aquí (plataforma cifrada o secretos ANTHROPIC_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY, GEMINI_API_KEY, MINIMAX_API_KEY).
// Cada llamada: verifica sesión y aprobación, comprueba que la persona use la clave compartida,
// respeta los límites (mensual por API y diario por persona), registra el gasto y avisa al administrador.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS, LABEL, PRICE, Provider, checkBudget, db, fail, getKey, limitOf, logError, notify, openaiImageEach, record, tokenCost, whoIs } from "./budget.ts";

const HOST: Record<Provider, string> = { anthropic: "https://api.anthropic.com", openai: "https://api.openai.com", elevenlabs: "https://api.elevenlabs.io", gemini: "https://generativelanguage.googleapis.com", minimax: "https://api.minimax.io" };
const SECRET: Record<Provider, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", elevenlabs: "ELEVENLABS_API_KEY", gemini: "GEMINI_API_KEY", minimax: "MINIMAX_API_KEY" };
// Solo se permiten estas llamadas, nada más
const ROUTES: { p: Provider; m: string; re: RegExp; kind: string }[] = [
  { p: "anthropic", m: "POST", re: /^\/v1\/messages$/, kind: "texto" },
  { p: "anthropic", m: "GET", re: /^\/v1\/models$/, kind: "prueba" },
  { p: "openai", m: "POST", re: /^\/v1\/chat\/completions$/, kind: "texto" },
  { p: "openai", m: "POST", re: /^\/v1\/images\/generations$/, kind: "imagen" },
  { p: "openai", m: "POST", re: /^\/v1\/audio\/speech$/, kind: "voz" },
  { p: "openai", m: "GET", re: /^\/v1\/models$/, kind: "prueba" },
  { p: "elevenlabs", m: "POST", re: /^\/v1\/text-to-speech\/[A-Za-z0-9_-]{5,40}$/, kind: "voz" },
  { p: "elevenlabs", m: "GET", re: /^\/v1\/voices$/, kind: "prueba" },
  { p: "elevenlabs", m: "GET", re: /^\/v1\/user\/subscription$/, kind: "saldo" },   // saldo real (solo administrador)
  // Gemini: el tipo de uso (texto, imagen o voz) se deduce del nombre del modelo
  { p: "gemini", m: "POST", re: /^\/v1beta\/models\/[A-Za-z0-9._-]{3,60}:generateContent$/, kind: "gemini" },
  { p: "gemini", m: "GET", re: /^\/v1beta\/models$/, kind: "prueba" },
  { p: "minimax", m: "POST", re: /^\/v1\/text\/chatcompletion_v2$/, kind: "texto" },
  { p: "minimax", m: "POST", re: /^\/v1\/t2a_v2$/, kind: "voz" },
  { p: "minimax", m: "POST", re: /^\/v1\/image_generation$/, kind: "imagen" },
  { p: "minimax", m: "POST", re: /^\/v1\/get_voice$/, kind: "prueba" },
  // Video con IA: crear (cuesta), consultar el estado (gratis; el gasto se anota cuando termina bien) y bajar el archivo
  { p: "gemini", m: "POST", re: /^\/v1beta\/models\/veo-[A-Za-z0-9._-]{3,50}:predictLongRunning$/, kind: "video" },
  { p: "gemini", m: "GET", re: /^\/v1beta\/models\/veo-[A-Za-z0-9._-]{3,50}\/operations\/[A-Za-z0-9._-]{3,80}$/, kind: "video_estado" },
  { p: "gemini", m: "GET", re: /^\/v1beta\/files\/[A-Za-z0-9._-]{3,80}:download$/, kind: "video_archivo" },
  { p: "minimax", m: "POST", re: /^\/v1\/video_generation$/, kind: "video" },
  { p: "minimax", m: "GET", re: /^\/v1\/query\/video_generation$/, kind: "video_estado" },
  { p: "minimax", m: "GET", re: /^\/v1\/files\/retrieve$/, kind: "video_archivo" },
];
/* Precios ESTIMADOS de video en US$ (ajústalos si tu plan es distinto) */
const VEO_PER_SEC = (model: string) => (/fast/i.test(model) ? 0.15 : /lite/i.test(model) ? 0.1 : 0.4);
const MINIMAX_VIDEO = (seconds: number, res: string) => (/1080/.test(res) ? 0.49 : 0.28) * (seconds > 6 ? 2 : 1);
const NO_COST = ["prueba", "saldo", "video_estado", "video_archivo"];
const MAX_BODY = 200_000, MAX_BODY_VIDEO = 3_000_000, MAX_TOKENS = 8000, MAX_CHARS = 5000;   // el video puede llevar una imagen de partida

const headersFor = (p: Provider, key: string): Record<string, string> =>
  p === "anthropic" ? { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }
  : p === "openai" || p === "minimax" ? { Authorization: `Bearer ${key}`, "content-type": "application/json" }
  : p === "gemini" ? { "x-goog-api-key": key, "content-type": "application/json" }
  : { "xi-api-key": key, "content-type": "application/json" };

/** ¿Ya se anotó el gasto de este video? (el estado se consulta muchas veces) */
async function alreadyBilled(client: ReturnType<typeof db>, uid: string, job: string): Promise<boolean> {
  const { data } = await client.from("framaly_usage").select("id").eq("user_id", uid).eq("kind", "video").eq("units->>job", job).limit(1);
  return !!(data && data.length);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail(405, "method", "Método no permitido.");
  try {
    const client = db();
    const who = await whoIs(client, req);
    if (who instanceof Response) return who;
    const { uid, acc } = who;

    // 1) Qué se pide
    const input = await req.json().catch(() => ({}));
    const provider = input.provider as Provider;
    const method = String(input.method ?? "GET").toUpperCase();
    const [path, query = ""] = String(input.path ?? "").split("?");
    const route = ROUTES.find((r) => r.p === provider && r.m === method && r.re.test(path));
    if (!route) return fail(400, "bad_request", "Esa operación no está permitida.");
    let kind = route.kind;
    if (kind === "gemini") kind = /image/i.test(path) ? "imagen" : /tts/i.test(path) ? "voz" : "texto";
    if (kind === "saldo" && acc.role !== "admin") return fail(403, "forbidden", "Solo el administrador puede ver el saldo.");
    if (query && !/^(output_format=[a-z0-9_]{3,30}|alt=media|task_id=[A-Za-z0-9_-]{3,80}|file_id=[A-Za-z0-9_-]{3,80}(&download=1)?)$/.test(query)) return fail(400, "bad_request", "Parámetros no permitidos.");

    // 2) ¿Esta persona usa la clave compartida de esta API?
    if (acc.role !== "admin" && !["shared", "both"].includes(String(acc.ai?.[provider]))) {
      await logError(client, { provider, uid, email: acc.email, kind: "modo", status: 403, message: `Intentó usar la clave compartida de ${LABEL[provider]}, pero su cuenta no la tiene habilitada.` });
      return fail(403, "mode", `Tu cuenta no usa la clave compartida de ${LABEL[provider]}.`);
    }
    // 3) ¿Está configurada la clave?
    const key = await getKey(client, provider, SECRET[provider]);
    if (!key) {
      await logError(client, { provider, uid, email: acc.email, kind: "sin_clave", status: 503, message: `No hay clave de ${LABEL[provider]} guardada.` });
      await notify(client, { dedupe: `${provider}:nokey`, level: "warn", provider, title: `Falta la clave de ${LABEL[provider]}`, body: `Alguien intentó usar ${LABEL[provider]} pero el secreto ${SECRET[provider]} no está guardado en Supabase.` });
      return fail(503, "not_configured", `La clave compartida de ${LABEL[provider]} todavía no está configurada.`);
    }
    // 4) Límites (las pruebas de conexión no gastan)
    if (!NO_COST.includes(kind)) {
      const stop = await checkBudget(client, provider, uid, acc);
      if (stop) return stop;
    }

    // 5) Cuerpo con topes
    let body: Record<string, any> | undefined;
    if (method === "POST") {
      body = input.body && typeof input.body === "object" ? input.body : {};
      if (JSON.stringify(body).length > (kind === "video" ? MAX_BODY_VIDEO : MAX_BODY)) return fail(413, "too_large", "La solicitud es demasiado grande.");
      delete body.stream;
      if (provider === "anthropic") body.max_tokens = Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS);
      if (provider === "openai" && route.kind === "texto") { body.max_tokens = Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS); delete body.max_completion_tokens; body.n = 1; }
      if (provider === "minimax" && kind === "texto") body.max_tokens = Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS);
      if (kind === "video" && provider === "gemini") { body.instances = Array.isArray(body.instances) ? body.instances.slice(0, 1) : []; if (body.parameters && typeof body.parameters === "object") body.parameters.sampleCount = 1; }
      if (provider === "gemini" && kind !== "video") {
        const gc = (body.generationConfig ||= {});
        if (kind === "texto") gc.maxOutputTokens = Math.min(Number(gc.maxOutputTokens) || 1024, MAX_TOKENS);
        body.contents = Array.isArray(body.contents) ? body.contents.slice(0, 6) : [];
      }
      if (kind === "imagen" && provider !== "gemini") body.n = Math.min(Math.max(Number(body.n) || 1, 1), 4);
      const sent = provider === "gemini" ? String(body.contents?.[0]?.parts?.[0]?.text ?? "") : String(body.input ?? body.text ?? "");
      if (kind === "voz" && sent.length > MAX_CHARS) return fail(413, "too_large", `El texto supera los ${MAX_CHARS} caracteres. Pártelo en partes.`);
    }

    // 6) Llamada al proveedor con la clave del servidor
    const upQuery = query.replace(/&download=1$/, "");
    const up = await fetch(HOST[provider] + path + (upQuery ? "?" + upQuery : ""), { method, headers: headersFor(provider, key), body: body ? JSON.stringify(body) : undefined });
    const type = up.headers.get("content-type") ?? "application/json";
    if (kind === "saldo" && (up.status === 401 || up.status === 403)) {
      await logError(client, { provider, uid, email: acc.email, kind: "proveedor", status: up.status, message: "La clave no tiene permiso para leer el saldo (falta «User: Read»)." });
      return fail(403, "no_perm", `La clave de ${LABEL[provider]} no tiene permiso para leer el saldo. Al crearla, activa «User: Read».`);
    }
    if (up.status === 401 || up.status === 403) {
      await logError(client, { provider, uid, email: acc.email, kind: "clave", status: up.status, message: `${LABEL[provider]} rechazó la clave (${up.status}).` });
      await notify(client, { dedupe: `${provider}:badkey:${new Date().toISOString().slice(0, 10)}`, level: "crit", provider, title: `La clave de ${LABEL[provider]} fue rechazada`, body: `${LABEL[provider]} respondió ${up.status}: la clave guardada en Supabase no es válida, venció o no tiene saldo.` });
      return fail(502, "bad_key", `La clave compartida de ${LABEL[provider]} no es válida. Avisa a quien administra la plataforma.`);
    }

    // 6b) Otros errores del proveedor: se registran y se devuelven tal cual
    if (!up.ok) {
      const t = await up.text();
      let msg = t;
      try { const j = JSON.parse(t); msg = j?.error?.message ?? j?.detail?.message ?? (typeof j?.detail === "string" ? j.detail : "") ?? t; } catch { /* texto plano */ }
      await logError(client, { provider, uid, email: acc.email, kind: "proveedor", status: up.status, message: String(msg || t) });
      return new Response(t, { status: up.status, headers: { ...CORS, "Content-Type": type } });
    }

    // 7) Gasto (solo si salió bien). Solo OpenAI y ElevenLabs devuelven audio directo; MiniMax y Gemini lo envían dentro de un JSON.
    if (kind === "voz" && (provider === "elevenlabs" || provider === "openai")) {
      const buf = await up.arrayBuffer();
      if (up.ok) {
        const chars = String(body?.input ?? body?.text ?? "").length;
        const cost = provider === "elevenlabs" ? chars * PRICE.elevenlabs.perChar : chars * PRICE.openai.ttsPerChar;
        await record(client, { uid, acc, provider, kind: "voz", units: { chars }, cost });
      }
      return new Response(buf, { status: up.status, headers: { ...CORS, "Content-Type": type } });
    }
    // Video de Veo: el archivo se reenvía tal cual (la clave nunca llega al navegador)
    if (kind === "video_archivo" && provider === "gemini") return new Response(up.body, { status: up.status, headers: { ...CORS, "Content-Type": type } });
    const text = await up.text();
    let j: any = {}; try { j = JSON.parse(text); } catch { /* sin datos de uso */ }
    // Video de MiniMax: con download=1 se baja el archivo desde la dirección que da MiniMax y se reenvía
    if (kind === "video_archivo" && provider === "minimax" && /&download=1$/.test(query) && Number(j?.base_resp?.status_code ?? 0) === 0) {
      const url = String(j?.file?.download_url ?? "");
      if (!/^https:\/\//.test(url)) return fail(502, "no_file", "MiniMax no entregó el archivo del video.");
      const f = await fetch(url);
      return new Response(f.body, { status: f.status, headers: { ...CORS, "Content-Type": f.headers.get("content-type") ?? "video/mp4" } });
    }
    // Saldo real de ElevenLabs: se guarda una instantánea y se avisa si la cuota se acaba
    if (provider === "elevenlabs" && kind === "saldo" && up.ok) {
      const used = Number(j.character_count ?? 0), quota = Number(j.character_limit ?? 0), reset = Number(j.next_character_count_reset_unix ?? 0);
      await client.from("framaly_balance").insert({ provider, used, quota, unit: "caracteres", plan: String(j.tier ?? ""), resets_at: reset ? new Date(reset * 1000).toISOString() : null });
      const pct = quota > 0 ? (used / quota) * 100 : 0, lim = await limitOf(client, provider), ym = new Date().toISOString().slice(0, 7);
      if (pct >= 100) await notify(client, { dedupe: `${provider}:quota100:${ym}`, level: "crit", provider, title: "ElevenLabs agotó su cuota de caracteres", body: `Usó ${used} de ${quota} caracteres de su plan. Las voces de ElevenLabs no funcionarán hasta que se renueve o subas de plan.` });
      else if (pct >= lim.alertPct) await notify(client, { dedupe: `${provider}:quota${lim.alertPct}:${ym}`, level: "warn", provider, title: `ElevenLabs va en ${Math.floor(pct)}% de su cuota`, body: `Usó ${used} de ${quota} caracteres de su plan.` });
      return new Response(text, { status: 200, headers: { ...CORS, "Content-Type": type } });
    }
    // MiniMax responde 200 aunque falle: el error viene en base_resp
    const bs = Number(j?.base_resp?.status_code ?? 0);
    if (provider === "minimax" && bs !== 0) {
      const bad = bs === 1004 || bs === 2049;
      await logError(client, { provider, uid, email: acc.email, kind: bad ? "clave" : "proveedor", status: bs, message: String(j?.base_resp?.status_msg ?? "Error de MiniMax") });
      if (bad) {
        await notify(client, { dedupe: `${provider}:badkey:${new Date().toISOString().slice(0, 10)}`, level: "crit", provider, title: `La clave de ${LABEL[provider]} fue rechazada`, body: `MiniMax respondió "${j?.base_resp?.status_msg}": la clave no es válida o no tiene saldo.` });
        return fail(502, "bad_key", `La clave compartida de ${LABEL[provider]} no es válida. Avisa a quien administra la plataforma.`);
      }
      return new Response(text, { status: 200, headers: { ...CORS, "Content-Type": type } });
    }
    // Video: el gasto se anota una sola vez, cuando el proveedor dice que terminó bien
    if (kind === "video_estado" && up.ok) {
      if (provider === "gemini") {
        const done = j?.done === true && !j?.error && (j?.response?.generateVideoResponse?.generatedSamples?.length ?? j?.response?.generatedVideos?.length ?? 0) > 0;
        const model = path.split("/")[3] ?? "veo", op = path.split("/").pop() ?? "";
        if (done && !(await alreadyBilled(client, uid, op))) await record(client, { uid, acc, provider, kind: "video", units: { seconds: 8, model, job: op }, cost: 8 * VEO_PER_SEC(model) });
      } else if (String(j?.status ?? "").toLowerCase() === "success") {
        const job = query.replace(/^task_id=/, "");
        if (!(await alreadyBilled(client, uid, job))) await record(client, { uid, acc, provider, kind: "video", units: { seconds: 6, job }, cost: MINIMAX_VIDEO(6, "768P") });
      }
      return new Response(text, { status: up.status, headers: { ...CORS, "Content-Type": type } });
    }
    if (up.ok && !NO_COST.includes(kind) && kind !== "video") {
      if (provider === "gemini") {
        const u = j.usageMetadata ?? {};
        const tin = Number(u.promptTokenCount ?? 0), tout = Number(u.candidatesTokenCount ?? 0) + Number(u.thoughtsTokenCount ?? 0);
        const model = path.split("/").pop()!.split(":")[0];
        if (kind === "imagen") {
          const n = (j.candidates?.[0]?.content?.parts ?? []).filter((p: any) => p.inlineData || p.inline_data).length || 1;
          await record(client, { uid, acc, provider, kind: "imagen", units: { images: n, model }, cost: n * PRICE.gemini.imageEach });
        } else if (kind === "voz") {
          const chars = String(body?.contents?.[0]?.parts?.[0]?.text ?? "").length;
          await record(client, { uid, acc, provider, kind: "voz", units: { chars, in_tokens: tin, out_tokens: tout, model }, cost: (tin * PRICE.gemini.ttsPerMTok[0] + tout * PRICE.gemini.ttsPerMTok[1]) / 1_000_000 });
        } else {
          await record(client, { uid, acc, provider, kind: "texto", units: { in_tokens: tin, out_tokens: tout, model }, cost: tokenCost(PRICE.gemini.perMTok, PRICE.gemini.fallback, model, tin, tout) });
        }
      } else if (provider === "minimax") {
        if (kind === "voz") {
          const chars = String(body?.text ?? "").length;
          await record(client, { uid, acc, provider, kind: "voz", units: { chars }, cost: chars * PRICE.minimax.ttsPerChar });
        } else if (kind === "imagen") {
          const n = Array.isArray(j.data?.image_base64) ? j.data.image_base64.length : Number(body?.n ?? 1);
          await record(client, { uid, acc, provider, kind: "imagen", units: { images: n }, cost: n * PRICE.minimax.imageEach });
        } else {
          const tin = Number(j.usage?.prompt_tokens ?? 0), tout = Number(j.usage?.completion_tokens ?? Math.max(0, Number(j.usage?.total_tokens ?? 0) - tin));
          await record(client, { uid, acc, provider, kind: "texto", units: { in_tokens: tin, out_tokens: tout, model: String(body?.model ?? "") }, cost: tokenCost(PRICE.minimax.perMTok, PRICE.minimax.fallback, String(body?.model ?? ""), tin, tout) });
        }
      } else if (kind === "imagen") {
        const images = Array.isArray(j.data) ? j.data.length : Number(body?.n ?? 1);
        const q = String(body?.quality ?? "medium"), mdl = String(body?.model ?? "gpt-image-1");
        await record(client, { uid, acc, provider, kind: "imagen", units: { images, quality: q, model: mdl }, cost: images * openaiImageEach(mdl, q, String(body?.size ?? "1536x1024")) });
      } else if (provider === "anthropic") {
        const tin = Number(j.usage?.input_tokens ?? 0), tout = Number(j.usage?.output_tokens ?? 0);
        await record(client, { uid, acc, provider, kind: "texto", units: { in_tokens: tin, out_tokens: tout, model: String(body?.model ?? "") }, cost: tokenCost(PRICE.anthropic.perMTok, PRICE.anthropic.fallback, String(body?.model ?? j.model ?? ""), tin, tout) });
      } else {
        const tin = Number(j.usage?.prompt_tokens ?? 0), tout = Number(j.usage?.completion_tokens ?? 0);
        await record(client, { uid, acc, provider, kind: "texto", units: { in_tokens: tin, out_tokens: tout, model: String(body?.model ?? "") }, cost: tokenCost(PRICE.openai.chatPerMTok, PRICE.openai.chatFallback, String(body?.model ?? j.model ?? ""), tin, tout) });
      }
    }
    return new Response(text, { status: up.status, headers: { ...CORS, "Content-Type": type } });
  } catch (e) {
    console.error(e);
    try { await logError(db(), { kind: "servidor", status: 500, message: String(e) }); } catch { /* sin registro */ }
    return fail(500, "server", "Ocurrió un error inesperado. Inténtalo de nuevo.");
  }
});
