// FRAMALY Studio · piezas comunes de las funciones seguras (ia y asesor).
// Esta copia debe ser IDÉNTICA en supabase/functions/ia/budget.ts y supabase/functions/asesor/budget.ts.
import { createClient } from "jsr:@supabase/supabase-js@2";

export type Provider = "anthropic" | "openai" | "elevenlabs" | "gemini" | "minimax";
export const LABEL: Record<Provider, string> = { anthropic: "Claude (Anthropic)", openai: "OpenAI", elevenlabs: "ElevenLabs", gemini: "Gemini (Google)", minimax: "MiniMax" };

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
/** Error con la forma { error: { message } } que ya entiende la app */
export const fail = (status: number, type: string, message: string) => json({ error: { type, message } }, status);

export const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

/* ---- Precios ESTIMADOS en US$ (ajústalos aquí si tu plan es distinto) ---- */
export const PRICE = {
  anthropic: { perMTok: { "claude-haiku-5-5": [1, 5], "claude-sonnet-5-5": [3, 15], "claude-opus-5-5": [5, 25] } as Record<string, number[]>, fallback: [3, 15] },
  openai: {
    // el orden importa: el nombre más largo va antes que el corto (gpt-5-mini antes que gpt-5)
    chatPerMTok: { "gpt-5-nano": [0.05, 0.4], "gpt-5-mini": [0.25, 2], "gpt-5": [1.25, 10], "gpt-4.1-nano": [0.1, 0.4], "gpt-4.1-mini": [0.4, 1.6], "gpt-4.1": [2, 8], "gpt-4o-mini": [0.15, 0.6], "gpt-4o": [2.5, 10], "o4-mini": [1.1, 4.4], "o3-mini": [1.1, 4.4] } as Record<string, number[]>,
    chatFallback: [2, 8],
    image: { low: 0.016, medium: 0.063, high: 0.25, auto: 0.25, dalle3: 0.08 } as Record<string, number>,
    ttsPerChar: 0.0000167,
  },
  elevenlabs: { perChar: 0.0002 },
  gemini: {
    perMTok: { "gemini-2.5-pro": [1.25, 10], "gemini-2.5-flash-lite": [0.1, 0.4], "gemini-2.5-flash": [0.3, 2.5] } as Record<string, number[]>,
    fallback: [0.3, 2.5],
    ttsPerMTok: [0.5, 10],   // la voz se cobra por tokens de audio
    imageEach: 0.039,
  },
  minimax: { perMTok: { "MiniMax-M2": [0.3, 1.2] } as Record<string, number[]>, fallback: [0.3, 1.2], ttsPerChar: 0.0001, imageEach: 0.0035 },
};
/** Imagen de OpenAI: US$ por imagen según modelo, calidad y tamaño (precios de referencia; gpt-image-2 estimado) */
const IMG: Record<string, Record<string, number[]>> = {
  "gpt-image-2": { low: [0.009, 0.013], medium: [0.034, 0.05], high: [0.133, 0.2] },
  "gpt-image-1.5": { low: [0.009, 0.013], medium: [0.034, 0.05], high: [0.133, 0.2] },
  "gpt-image-1-mini": { low: [0.005, 0.006], medium: [0.011, 0.015], high: [0.036, 0.052] },
  "gpt-image-1": { low: [0.011, 0.016], medium: [0.042, 0.063], high: [0.167, 0.25] },
};
export const openaiImageEach = (model: string, quality: string, size: string): number => {
  const big = size !== "1024x1024";
  if (model.startsWith("dall-e-3")) return big ? 0.08 : 0.04;
  if (model.startsWith("dall-e-2")) return 0.02;
  const key = Object.keys(IMG).find((k) => model.startsWith(k));
  const t = key ? IMG[key] : IMG["gpt-image-1"];
  return (t[quality] ?? t.medium)[big ? 1 : 0];
};
export const tokenCost = (table: Record<string, number[]>, fallback: number[], model: string, tin: number, tout: number) => {
  const key = Object.keys(table).find((k) => model.startsWith(k));
  const [pi, po] = key ? table[key] : fallback;
  return (tin * pi + tout * po) / 1_000_000;
};

const monthStart = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)); };
const dayStart = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); };
const ym = () => new Date().toISOString().slice(0, 7);
const ymd = () => new Date().toISOString().slice(0, 10);
const usd = (n: number) => "US$ " + n.toFixed(2).replace(".", ",");

export type Access = { status: string; role: string; perms: Record<string, boolean>; ai: Record<string, string>; daily_usd: number; email?: string };

/** Quién pregunta y qué permiso tiene. Devuelve una Response si hay que rechazar. */
export async function whoIs(client: ReturnType<typeof db>, req: Request): Promise<{ uid: string; acc: Access } | Response> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error } = await client.auth.getUser(token);
  if (error || !auth?.user) return fail(401, "unauthorized", "Tu sesión venció. Vuelve a iniciar sesión.");
  const { data: acc } = await client.from("framaly_access").select("status,role,perms,ai,daily_usd,email").eq("user_id", auth.user.id).maybeSingle();
  if (!acc || acc.status !== "approved") return fail(403, "forbidden", "Tu cuenta aún no está aprobada.");
  return { uid: auth.user.id, acc: acc as Access };
}

/** La clave: primero la guardada desde la plataforma (bóveda cifrada); si no hay, el secreto de Supabase */
export async function getKey(client: ReturnType<typeof db>, provider: Provider, envName: string): Promise<string | null> {
  const { data } = await client.rpc("framaly_get_secret", { p_provider: provider });
  if (typeof data === "string" && data) return data;
  return Deno.env.get(envName) ?? null;
}

/** Quita de un mensaje cualquier cosa que parezca una clave antes de guardarlo */
const cleanMsg = (m: string) => String(m ?? "").replace(/[A-Za-z0-9_\-]{24,}/g, "•••").slice(0, 300);

/** Deja constancia de un error para que el administrador lo vea en la plataforma */
export async function logError(client: ReturnType<typeof db>, o: { provider?: string; uid?: string | null; email?: string; kind: string; status?: number; message: string }) {
  try {
    await client.from("framaly_errors").insert({ provider: o.provider ?? null, user_id: o.uid ?? null, email: o.email ?? null, kind: o.kind, status: o.status ?? null, message: cleanMsg(o.message) });
  } catch { /* un fallo al registrar nunca debe romper la respuesta */ }
}

export async function limitOf(client: ReturnType<typeof db>, provider: Provider) {
  const { data } = await client.from("framaly_limits").select("monthly_usd,alert_pct").eq("provider", provider).maybeSingle();
  return { monthly: Number(data?.monthly_usd ?? 10), alertPct: Number(data?.alert_pct ?? 80) };
}
const sum = async (client: ReturnType<typeof db>, provider: string | null, uid: string | null, since: Date) => {
  const { data } = await client.rpc("framaly_cost_sum", { p_provider: provider, p_user: uid, p_since: since.toISOString() });
  return Number(data ?? 0);
};

/** ¿Se puede gastar más? Devuelve una Response si se alcanzó algún tope. */
export async function checkBudget(client: ReturnType<typeof db>, provider: Provider, uid: string, acc: Access, perPerson = true): Promise<Response | null> {
  const lim = await limitOf(client, provider);
  const [month, today] = await Promise.all([sum(client, provider, null, monthStart()), perPerson ? sum(client, null, uid, dayStart()) : Promise.resolve(0)]);
  if (month >= lim.monthly) {
    await notify(client, { dedupe: `${provider}:100:${ym()}`, level: "crit", provider, title: `${LABEL[provider]} llegó a su límite mensual`, body: `Se gastó ${usd(month)} de ${usd(lim.monthly)}. Las consultas con la clave compartida quedaron pausadas hasta el mes siguiente o hasta que subas el límite.` });
    await logError(client, { provider, uid, email: acc.email, kind: "limite", status: 429, message: `Límite mensual de ${LABEL[provider]} alcanzado (${usd(month)} de ${usd(lim.monthly)}).` });
    return fail(429, "provider_limit", `FRAMALY alcanzó el límite mensual de ${LABEL[provider]}. Avisa a quien administra la plataforma.`);
  }
  if (perPerson && acc.role !== "admin" && today >= Number(acc.daily_usd)) {
    await logError(client, { provider, uid, email: acc.email, kind: "tope", status: 429, message: `Tope diario alcanzado (${usd(Number(acc.daily_usd))}).` });
    return fail(429, "user_limit", `Llegaste a tu tope diario de uso de IA (${usd(Number(acc.daily_usd))}). Podrás seguir mañana.`);
  }
  return null;
}

/** Registra el gasto y avisa al administrador si se cruza un umbral */
export async function record(client: ReturnType<typeof db>, o: { uid: string; acc: Access; provider: Provider; kind: string; units: Record<string, number | string>; cost: number }) {
  await client.from("framaly_usage").insert({ user_id: o.uid, provider: o.provider, kind: o.kind, units: o.units, cost_usd: o.cost });
  const lim = await limitOf(client, o.provider);
  const month = await sum(client, o.provider, null, monthStart());
  const pct = lim.monthly > 0 ? (month / lim.monthly) * 100 : 100;
  if (pct >= 100) {
    await notify(client, { dedupe: `${o.provider}:100:${ym()}`, level: "crit", provider: o.provider, title: `${LABEL[o.provider]} llegó a su límite mensual`, body: `Se gastó ${usd(month)} de ${usd(lim.monthly)}. Las consultas con la clave compartida quedan pausadas.` });
  } else if (pct >= lim.alertPct) {
    await notify(client, { dedupe: `${o.provider}:${lim.alertPct}:${ym()}`, level: "warn", provider: o.provider, title: `${LABEL[o.provider]} va en ${Math.floor(pct)}% de su límite`, body: `Se han gastado ${usd(month)} de ${usd(lim.monthly)} este mes.` });
  }
  if (o.acc.role !== "admin") {
    const today = await sum(client, null, o.uid, dayStart());
    if (today >= Number(o.acc.daily_usd)) {
      await notify(client, { dedupe: `user:${o.uid}:${ymd()}`, level: "info", provider: o.provider, uid: o.uid, title: `${o.acc.email || "Una persona"} llegó a su tope diario`, body: `Gastó ${usd(today)} hoy (tope ${usd(Number(o.acc.daily_usd))}).` });
    }
  }
}

export async function notify(client: ReturnType<typeof db>, n: { dedupe: string; level: string; title: string; body: string; provider?: string; uid?: string }) {
  await client.from("framaly_notifications").upsert(
    { dedupe: n.dedupe, level: n.level, title: n.title, body: n.body, provider: n.provider ?? null, user_id: n.uid ?? null },
    { onConflict: "dedupe", ignoreDuplicates: true },
  );
}
