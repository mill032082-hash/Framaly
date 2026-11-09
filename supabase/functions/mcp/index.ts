// FRAMALY Studio · servidor MCP + API REST para conectar ChatGPT, Claude y otros agentes.
//  · MCP (Streamable HTTP, JSON-RPC):  POST  <url>/functions/v1/mcp
//  · REST:                              POST  <url>/functions/v1/mcp/api/<herramienta>
//  · OpenAPI (Acciones de un GPT):      GET   <url>/functions/v1/mcp/openapi.json
// Autenticación: clave de conexión (fmk_…) creada en FRAMALY → Ajustes. Va en «Authorization: Bearer», en «x-api-key»
// o, para clientes que no permiten cabeceras, dentro de la ruta: <url>/functions/v1/mcp/t/<clave>
// Cada llamada usa las claves compartidas y respeta los topes de la cuenta dueña de la clave.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { type Access, db, logError } from "./budget.ts";
import { EXEC_MODES, INSTRUCTIONS, TOOLS, VERSION, checkArgs, openapi, rpcErr, rpcOk, sha256hex } from "./lib.ts";
import { type Ctx, HANDLERS, ToolError } from "./tools.ts";
import { handleOAuth } from "./oauth.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type, accept, mcp-session-id, mcp-protocol-version, x-client-info, apikey",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};
const J = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", ...extra } });
const RATE_PER_MIN = 30;

type Auth = { ctx: Ctx; tokenId: string; scopes: string[] };

async function authenticate(req: Request, tokenInPath: string | null, base: string): Promise<Auth | Response> {
  const h = req.headers.get("authorization") ?? "";
  const token = (h.match(/^Bearer\s+(.+)$/i)?.[1] ?? req.headers.get("x-api-key") ?? tokenInPath ?? "").trim();
  const bad = (m: string) => J({ error: { type: "unauthorized", message: m } }, 401, { "WWW-Authenticate": `Bearer realm="FRAMALY", resource_metadata="${base}/.well-known/oauth-protected-resource"` });
  if (!/^fmk_[0-9a-f]{48}$/.test(token)) return bad("Falta la clave de conexión de FRAMALY (empieza con fmk_). Créala en FRAMALY → Ajustes → Conectar con ChatGPT y otras IAs.");
  const client = db();
  const { data } = await client.rpc("framaly_token_auth", { p_hash: await sha256hex(token) });
  if (!data) return bad("La clave de conexión no es válida o fue revocada.");
  const { data: acc } = await client.from("framaly_access").select("status,role,perms,ai,daily_usd,email").eq("user_id", data.user_id).maybeSingle();
  if (!acc || acc.status !== "approved") return J({ error: { type: "forbidden", message: "La cuenta dueña de esta clave no está aprobada." } }, 403);
  const mode = EXEC_MODES.includes(data.exec_mode) ? data.exec_mode : "external"; // ante la duda, el modo más seguro
  return { ctx: { client, uid: data.user_id, acc: acc as Access, mode, tokenId: data.token_id }, tokenId: data.token_id, scopes: data.scopes ?? ["read", "write"] };
}

/** Ejecuta una herramienta con permisos, límite de uso y registro */
async function runTool(a: Auth, name: string, args: unknown): Promise<{ ok: boolean; value: unknown }> {
  const def = TOOLS.find((t) => t.name === name), t0 = Date.now();
  const log = (ok: boolean, detail: string) => a.ctx.client.from("framaly_api_calls").insert({ token_id: a.tokenId, user_id: a.ctx.uid, tool: name, ok, ms: Date.now() - t0, detail: detail.slice(0, 300) }).then(() => {}, () => {});
  if (!def) return { ok: false, value: `No existe la herramienta «${name}».` };
  if (!a.scopes.includes(def.scope)) { await log(false, "sin permiso"); return { ok: false, value: "Esta clave no tiene permiso para esa herramienta." }; }
  const bad = checkArgs(def, args); if (bad) { await log(false, bad); return { ok: false, value: bad }; }
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await a.ctx.client.from("framaly_api_calls").select("id", { count: "exact", head: true }).eq("token_id", a.tokenId).gte("created_at", since);
  if ((count ?? 0) >= RATE_PER_MIN) { await log(false, "límite por minuto"); return { ok: false, value: `Demasiadas llamadas (máx. ${RATE_PER_MIN} por minuto). Espera un momento.` }; }
  try {
    const value = await HANDLERS[name]({ ...a.ctx, tool: name }, args ?? {});
    await log(true, "ok");
    return { ok: true, value };
  } catch (e) {
    if (e instanceof ToolError) { await log(false, e.message); return { ok: false, value: e.message }; }
    console.error(e);
    await logError(a.ctx.client, { uid: a.ctx.uid, email: a.ctx.acc.email, kind: "servidor", status: 500, message: `[MCP ${name}] ${String(e)}` });
    await log(false, "error interno");
    return { ok: false, value: "Ocurrió un error inesperado. Inténtalo de nuevo." };
  }
}

const asText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v, null, 1));

async function rpc(a: Auth, msg: any): Promise<unknown | null> {
  const id = msg?.id ?? null, method = String(msg?.method ?? "");
  if (msg?.jsonrpc !== "2.0" || !method) return rpcErr(id, -32600, "Solicitud JSON-RPC inválida.");
  if (method.startsWith("notifications/")) return null;
  switch (method) {
    case "initialize":
      return rpcOk(id, { protocolVersion: msg.params?.protocolVersion ?? "2025-03-26", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "framaly", title: "FRAMALY Studio", version: VERSION }, instructions: INSTRUCTIONS });
    case "ping": return rpcOk(id, {});
    case "tools/list":
      return rpcOk(id, { tools: TOOLS.filter((t) => a.scopes.includes(t.scope)).map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, ...(t.meta ? { _meta: t.meta } : {}), annotations: { readOnlyHint: t.scope === "read", openWorldHint: false } })) });
    case "tools/call": {
      const r = await runTool(a, String(msg.params?.name ?? ""), msg.params?.arguments);
      return rpcOk(id, { content: [{ type: "text", text: asText(r.value) }], isError: !r.ok });
    }
    case "resources/list": return rpcOk(id, { resources: [] });
    case "prompts/list": return rpcOk(id, { prompts: [] });
    default: return rpcErr(id, -32601, `Método no soportado: ${method}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  let path = url.pathname.replace(/^.*?\/mcp(?=\/|$)/, "") || "/";
  let tokenInPath: string | null = null;
  const m = path.match(/^\/t\/(fmk_[0-9a-f]{48})(\/.*)?$/);
  if (m) { tokenInPath = m[1]; path = m[2] || "/"; }
  const base = (Deno.env.get("SUPABASE_URL") ?? url.origin) + "/functions/v1/mcp";

  try {
    // Inicio de sesión OAuth (descubrimiento, registro, permiso y token)
    if (/^\/(\.well-known\/|register$|authorize$|token$)/.test(path)) {
      const o = await handleOAuth(req, path, base, (Deno.env.get("FRAMALY_APP_URL") ?? "https://framaly.vercel.app").replace(/\/+$/, ""));
      if (o) return o;
    }
    // Información y especificación: públicas (no contienen claves)
    if (req.method === "GET" && path === "/openapi.json") return J(openapi(base));
    if (req.method === "GET" && (path === "/" || path === "/info")) return J({ name: "FRAMALY Studio", version: VERSION, mcp: base, openapi: base + "/openapi.json", tools: TOOLS.map((t) => t.name), auth: "Authorization: Bearer fmk_…" });
    if (req.method === "GET" || req.method === "DELETE") return J({ error: { type: "method", message: "Usa POST." } }, 405, { Allow: "POST, OPTIONS" });
    if (req.method !== "POST") return J({ error: { type: "method", message: "Método no permitido." } }, 405);

    const a = await authenticate(req, tokenInPath, base);
    if (a instanceof Response) return a;

    // API REST: POST /api/<herramienta> con los argumentos como JSON
    const rest = path.match(/^\/api\/([a-z_]+)$/);
    if (rest) {
      const args = await req.json().catch(() => ({}));
      const r = await runTool(a, rest[1], args);
      return J(r.ok ? r.value : { error: { type: "tool_error", message: r.value } }, r.ok ? 200 : (String(r.value).startsWith("Demasiadas") ? 429 : 400));
    }

    // MCP (JSON-RPC, una o varias solicitudes)
    if (path === "/" || path === "/mcp") {
      const body = await req.json().catch(() => null);
      if (body == null) return J(rpcErr(null, -32700, "JSON inválido."), 400);
      if (Array.isArray(body)) { const out = (await Promise.all(body.map((x) => rpc(a, x)))).filter((x) => x !== null); return out.length ? J(out) : new Response(null, { status: 202, headers: CORS }); }
      const out = await rpc(a, body);
      return out === null ? new Response(null, { status: 202, headers: CORS }) : J(out);
    }
    return J({ error: { type: "not_found", message: "Ruta no encontrada." } }, 404);
  } catch (e) {
    console.error(e);
    return J({ error: { type: "server", message: "Ocurrió un error inesperado." } }, 500);
  }
});
