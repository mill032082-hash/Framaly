// FRAMALY Studio · puerta segura hacia las APIs de IA (Claude, OpenAI, ElevenLabs).
// Las claves viven solo aquí (secretos ANTHROPIC_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY).
// Cada llamada: verifica sesión y aprobación, comprueba que la persona use la clave compartida,
// respeta los límites (mensual por API y diario por persona), registra el gasto y avisa al administrador.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS, LABEL, PRICE, Provider, checkBudget, db, fail, notify, record, tokenCost, whoIs } from "./budget.ts";

const HOST: Record<Provider, string> = { anthropic: "https://api.anthropic.com", openai: "https://api.openai.com", elevenlabs: "https://api.elevenlabs.io" };
const SECRET: Record<Provider, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", elevenlabs: "ELEVENLABS_API_KEY" };
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
];
const MAX_BODY = 200_000, MAX_TOKENS = 8000, MAX_CHARS = 5000;

const headersFor = (p: Provider, key: string): Record<string, string> =>
  p === "anthropic" ? { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }
  : p === "openai" ? { Authorization: `Bearer ${key}`, "content-type": "application/json" }
  : { "xi-api-key": key, "content-type": "application/json" };

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
    if (query && !/^output_format=[a-z0-9_]{3,30}$/.test(query)) return fail(400, "bad_request", "Parámetros no permitidos.");

    // 2) ¿Esta persona usa la clave compartida de esta API?
    if (acc.role !== "admin" && acc.ai?.[provider] !== "shared") {
      return fail(403, "mode", `Tu cuenta no usa la clave compartida de ${LABEL[provider]}.`);
    }
    // 3) ¿Está configurada la clave?
    const key = Deno.env.get(SECRET[provider]);
    if (!key) {
      await notify(client, { dedupe: `${provider}:nokey`, level: "warn", provider, title: `Falta la clave de ${LABEL[provider]}`, body: `Alguien intentó usar ${LABEL[provider]} pero el secreto ${SECRET[provider]} no está guardado en Supabase.` });
      return fail(503, "not_configured", `La clave compartida de ${LABEL[provider]} todavía no está configurada.`);
    }
    // 4) Límites (las pruebas de conexión no gastan)
    if (route.kind !== "prueba") {
      const stop = await checkBudget(client, provider, uid, acc);
      if (stop) return stop;
    }

    // 5) Cuerpo con topes
    let body: Record<string, any> | undefined;
    if (method === "POST") {
      body = input.body && typeof input.body === "object" ? input.body : {};
      if (JSON.stringify(body).length > MAX_BODY) return fail(413, "too_large", "La solicitud es demasiado grande.");
      delete body.stream;
      if (provider === "anthropic") body.max_tokens = Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS);
      if (provider === "openai" && route.kind === "texto") { body.max_tokens = Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS); delete body.max_completion_tokens; body.n = 1; }
      if (route.kind === "imagen") body.n = Math.min(Math.max(Number(body.n) || 1, 1), 4);
      if (String(body.input ?? body.text ?? "").length > MAX_CHARS) return fail(413, "too_large", `El texto supera los ${MAX_CHARS} caracteres. Pártelo en partes.`);
    }

    // 6) Llamada al proveedor con la clave del servidor
    const up = await fetch(HOST[provider] + path + (query ? "?" + query : ""), { method, headers: headersFor(provider, key), body: body ? JSON.stringify(body) : undefined });
    const type = up.headers.get("content-type") ?? "application/json";
    if (up.status === 401 || up.status === 403) {
      await notify(client, { dedupe: `${provider}:badkey:${new Date().toISOString().slice(0, 10)}`, level: "crit", provider, title: `La clave de ${LABEL[provider]} fue rechazada`, body: `${LABEL[provider]} respondió ${up.status}: la clave guardada en Supabase no es válida, venció o no tiene saldo.` });
      return fail(502, "bad_key", `La clave compartida de ${LABEL[provider]} no es válida. Avisa a quien administra la plataforma.`);
    }

    // 7) Gasto (solo si salió bien)
    if (route.kind === "voz") {
      const buf = await up.arrayBuffer();
      if (up.ok) {
        const chars = String(body?.input ?? body?.text ?? "").length;
        const cost = provider === "elevenlabs" ? chars * PRICE.elevenlabs.perChar : chars * PRICE.openai.ttsPerChar;
        await record(client, { uid, acc, provider, kind: "voz", units: { chars }, cost });
      }
      return new Response(buf, { status: up.status, headers: { ...CORS, "Content-Type": type } });
    }
    const text = await up.text();
    if (up.ok && route.kind !== "prueba") {
      let j: any = {}; try { j = JSON.parse(text); } catch { /* sin datos de uso */ }
      if (route.kind === "imagen") {
        const images = Array.isArray(j.data) ? j.data.length : Number(body?.n ?? 1);
        const q = /dall-e-3/.test(String(body?.model)) ? "dalle3" : String(body?.quality ?? "medium");
        await record(client, { uid, acc, provider, kind: "imagen", units: { images, quality: q }, cost: images * (PRICE.openai.image[q] ?? 0.063) });
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
    return fail(500, "server", "Ocurrió un error inesperado. Inténtalo de nuevo.");
  }
});
