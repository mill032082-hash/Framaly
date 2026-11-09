// FRAMALY Studio · inicio de sesión OAuth 2.1 (con PKCE) para el servidor MCP.
// El conector (ChatGPT, Claude…) abre /authorize → FRAMALY pide permiso a la persona (pantalla «Conectar aplicación»)
// → el conector canjea el código en /token por un token de acceso (1 hora) y uno de renovación.
import { db } from "./budget.ts";
import { pkceChallenge, randomHex, sameText, sha256hex, validRedirectUri } from "./lib.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type, accept, mcp-session-id, mcp-protocol-version, x-client-info, apikey",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};
const J = (body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store", ...extra } });
const err = (error: string, description: string, status = 400) => J({ error, error_description: description }, status);
const TTL = 3600;

/** Lee los parámetros de /token (formulario o JSON) */
async function params(req: Request): Promise<URLSearchParams> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) { const j = await req.json().catch(() => ({})); return new URLSearchParams(Object.entries(j ?? {}).map(([k, v]) => [k, String(v)])); }
  return new URLSearchParams(await req.text().catch(() => ""));
}

/** Devuelve la respuesta si la ruta es de OAuth; si no, null */
export async function handleOAuth(req: Request, path: string, base: string, appUrl: string): Promise<Response | null> {
  const url = new URL(req.url);

  // --- descubrimiento (RFC 9728 y RFC 8414)
  if (req.method === "GET" && path.startsWith("/.well-known/oauth-protected-resource")) {
    return J({ resource: base, authorization_servers: [base], bearer_methods_supported: ["header"], scopes_supported: ["framaly"], resource_name: "FRAMALY Studio" });
  }
  if (req.method === "GET" && (path.startsWith("/.well-known/oauth-authorization-server") || path.startsWith("/.well-known/openid-configuration"))) {
    return J({ issuer: base, authorization_endpoint: base + "/authorize", token_endpoint: base + "/token", registration_endpoint: base + "/register",
      response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"], scopes_supported: ["framaly"], subject_types_supported: ["public"] });
  }
  const client = db();

  // --- registro dinámico de clientes (RFC 7591)
  if (req.method === "POST" && path === "/register") {
    const b = await req.json().catch(() => null);
    const uris = b?.redirect_uris;
    if (!Array.isArray(uris) || !uris.length || uris.length > 5 || !uris.every(validRedirectUri)) return err("invalid_redirect_uri", "redirect_uris debe ser una lista de 1 a 5 direcciones https (o http://localhost).");
    const { data, error } = await client.rpc("framaly_oauth_register", { p_name: String(b?.client_name ?? "Aplicación"), p_redirects: uris });
    if (error || !data) return err("server_error", "No se pudo registrar la aplicación.", 500);
    return J({ client_id: data, client_name: String(b?.client_name ?? "Aplicación").slice(0, 80), redirect_uris: uris, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", client_id_issued_at: Math.floor(Date.now() / 1000) }, 201);
  }

  // --- pantalla de permiso: se valida y se manda a FRAMALY
  if (req.method === "GET" && path === "/authorize") {
    const q = url.searchParams, clientId = q.get("client_id") ?? "", redirect = q.get("redirect_uri") ?? "", state = q.get("state") ?? "";
    const { data: c } = clientId ? await client.rpc("framaly_oauth_client", { p_id: clientId }) : { data: null };
    // si el cliente o la dirección no son válidos, NO se redirige (podría ser un enlace malicioso)
    if (!c || !Array.isArray(c.redirect_uris) || !c.redirect_uris.includes(redirect)) return err("invalid_request", "client_id o redirect_uri no válidos.");
    const back = (error: string, desc: string) => { const r = new URL(redirect); r.searchParams.set("error", error); r.searchParams.set("error_description", desc); if (state) r.searchParams.set("state", state); return new Response(null, { status: 302, headers: { ...CORS, Location: r.toString() } }); };
    if (q.get("response_type") !== "code") return back("unsupported_response_type", "Solo se admite response_type=code.");
    const challenge = q.get("code_challenge") ?? "";
    if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(challenge) || q.get("code_challenge_method") !== "S256") return back("invalid_request", "Se requiere PKCE con code_challenge_method=S256.");
    const { data: id, error } = await client.rpc("framaly_oauth_start", { p_client: clientId, p_redirect: redirect, p_challenge: challenge, p_state: state, p_scope: q.get("scope") ?? "framaly" });
    if (error || !id) return back("server_error", "No se pudo iniciar la autorización.");
    return new Response(null, { status: 302, headers: { ...CORS, Location: `${appUrl}/#/conectar?req=${id}`, "Cache-Control": "no-store" } });
  }

  // --- canje de código y renovación
  if (req.method === "POST" && path === "/token") {
    const p = await params(req);
    let clientId = p.get("client_id") ?? "";
    const basic = (req.headers.get("authorization") ?? "").match(/^Basic\s+(.+)$/i)?.[1];
    if (!clientId && basic) { try { clientId = atob(basic).split(":")[0]; } catch { /* sin id */ } }
    if (!clientId) return err("invalid_client", "Falta client_id.", 401);
    const grant = p.get("grant_type");
    const access = "fmk_" + randomHex(24), refresh = "fmr_" + randomHex(24);
    const issued = () => J({ access_token: access, token_type: "Bearer", expires_in: TTL, refresh_token: refresh, scope: "framaly" });

    if (grant === "authorization_code") {
      const code = p.get("code") ?? "", redirect = p.get("redirect_uri") ?? "", verifier = p.get("code_verifier") ?? "";
      if (!code || !redirect || !/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return err("invalid_request", "Faltan code, redirect_uri o code_verifier.");
      const { data: ex } = await client.rpc("framaly_oauth_exchange", { p_code_hash: await sha256hex(code), p_client: clientId, p_redirect: redirect });
      if (!ex) return err("invalid_grant", "El código no es válido, venció o ya se usó.");
      if (!sameText(await pkceChallenge(verifier), String(ex.code_challenge))) return err("invalid_grant", "La verificación PKCE no coincide.");
      const { error } = await client.rpc("framaly_oauth_issue", { p_user: ex.user_id, p_client: clientId, p_access_hash: await sha256hex(access), p_access_prefix: access.slice(0, 8), p_refresh_hash: await sha256hex(refresh), p_ttl: TTL, p_scope: ex.scope ?? "framaly" });
      if (error) return err("server_error", "No se pudo emitir el token.", 500);
      return issued();
    }
    if (grant === "refresh_token") {
      const old = p.get("refresh_token") ?? "";
      if (!/^fmr_[0-9a-f]{48}$/.test(old)) return err("invalid_grant", "El token de renovación no es válido.");
      const { data } = await client.rpc("framaly_oauth_refresh", { p_old_hash: await sha256hex(old), p_client: clientId, p_access_hash: await sha256hex(access), p_access_prefix: access.slice(0, 8), p_refresh_hash: await sha256hex(refresh), p_ttl: TTL });
      if (!data) return err("invalid_grant", "El token de renovación no es válido, venció o fue revocado. Vuelve a conectar la aplicación.");
      return issued();
    }
    return err("unsupported_grant_type", "Usa authorization_code o refresh_token.");
  }
  return null;
}
