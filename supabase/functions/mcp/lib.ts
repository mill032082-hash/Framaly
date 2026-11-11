// FRAMALY Studio · piezas puras del servidor MCP / API (sin red ni base de datos: se pueden probar solas).

export const VERSION = "1.9.0";

/** Modo de ejecución de una conexión: external = FRAMALY no genera nada · no_openai = puede generar, pero OpenAI queda bloqueado · all = todo permitido */
export type ExecMode = "external" | "no_openai" | "all";
export const EXEC_MODES: ExecMode[] = ["external", "no_openai", "all"];

export const sha256hex = async (s: string): Promise<string> => {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const sha256Bytes = async (b: Uint8Array): Promise<string> => [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))].map((x) => x.toString(16).padStart(2, "0")).join("");

export const newId = (prefix = "m") => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Duración (segundos) de un MP3 leyendo sus tramas. Si no encuentra ninguna, estima a 128 kbps. */
export function mp3Duration(b: Uint8Array): number {
  let i = 0;
  if (b.length > 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) i = 10 + (((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f));
  const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const SR: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  let secs = 0, frames = 0;
  while (i + 4 <= b.length) {
    if (b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0) {
      const ver = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3, bri = b[i + 2] >> 4, sri = (b[i + 2] >> 2) & 3, pad = (b[i + 2] >> 1) & 1;
      if (ver !== 1 && layer === 1 && bri > 0 && bri < 15 && sri < 3) {
        const mpeg1 = ver === 3, br = (mpeg1 ? BR1 : BR2)[bri] * 1000, sr = SR[ver][sri], spf = mpeg1 ? 1152 : 576;
        const len = Math.floor(((mpeg1 ? 144 : 72) * br) / sr) + pad;
        secs += spf / sr; frames++; i += Math.max(len, 4); continue;
      }
    }
    i++;
  }
  return frames ? secs : b.length / 16000;
}

/** ¿El nombre de host apunta a una red privada o interna? (protección al descargar imágenes de un enlace) */
export function isPrivateHost(h: string): boolean {
  const host = h.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) { const [a, b] = [Number(m[1]), Number(m[2])]; return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127); }
  if (host.includes(":")) return host === "::" || host === "::1" || /^f[cd]/.test(host) || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb") || host.startsWith("::ffff:");
  return false;
}

/** Reconoce el tipo de imagen por sus primeros bytes (no por lo que diga el servidor) */
export function sniffImage(b: Uint8Array): string | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** Reconoce el tipo de audio por sus primeros bytes: MP3, WAV, OGG o M4A */
export function sniffAudio(b: Uint8Array): string | null {
  if (b.length > 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return "audio/mpeg";
  if (b.length > 4 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && ((b[1] >> 1) & 3) !== 0) return "audio/mpeg";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x41 && b[10] === 0x56 && b[11] === 0x45) return "audio/wav";
  if (b.length > 4 && b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return "audio/ogg";
  if (b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "audio/mp4";
  return null;
}

/** Duración (segundos) de un audio. MP3 y WAV son exactos; M4A usa su cabecera; OGG es una estimación. */
export function audioDuration(b: Uint8Array, mime: string): number {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (mime === "audio/mpeg") return mp3Duration(b);
  if (mime === "audio/wav") {
    let i = 12, byteRate = 0;
    while (i + 8 <= b.length) {
      const id = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]), size = dv.getUint32(i + 4, true);
      if (id === "fmt " && i + 20 <= b.length) byteRate = dv.getUint32(i + 16, true);
      if (id === "data") return byteRate ? Math.min(size, b.length - i - 8) / byteRate : b.length / 32000;
      i += 8 + size + (size % 2);
    }
    return byteRate ? b.length / byteRate : b.length / 32000;
  }
  if (mime === "audio/mp4") {
    const lim = Math.min(b.length - 32, 262144);
    for (let i = 0; i < lim; i++) if (b[i] === 0x6d && b[i + 1] === 0x76 && b[i + 2] === 0x68 && b[i + 3] === 0x64) {
      const v = b[i + 4];
      if (v === 0) { const ts = dv.getUint32(i + 16), d = dv.getUint32(i + 20); if (ts) return d / ts; }
      else { const ts = dv.getUint32(i + 24), d = Number(dv.getBigUint64(i + 28)); if (ts) return d / ts; }
    }
  }
  return b.length / 16000;   // estimación (~128 kbps)
}

/* ---------- OAuth ---------- */
export const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/** PKCE (S256): base64url(SHA-256(verifier)) */
export const pkceChallenge = async (verifier: string) => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
export const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((x) => x.toString(16).padStart(2, "0")).join("");
/** Comparación en tiempo constante */
export const sameText = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
/** Direcciones de retorno aceptables: https (o http solo en localhost), sin credenciales ni fragmento */
export function validRedirectUri(u: unknown): boolean {
  if (typeof u !== "string" || u.length > 500) return false;
  let x: URL; try { x = new URL(u); } catch { return false; }
  if (x.hash || x.username || x.password) return false;
  if (x.protocol === "https:") return true;
  return x.protocol === "http:" && (x.hostname === "localhost" || x.hostname === "127.0.0.1" || x.hostname === "[::1]");
}

export const ASPECTS = ["16:9", "9:16", "1:1", "4:5"] as const;
export const openaiSize = (a: string) => (a === "16:9" ? "1536x1024" : a === "1:1" ? "1024x1024" : "1024x1536");

/** Quita las vallas ``` y se queda con el primer objeto JSON de un texto */
export function parseJSON(text: string): any {
  let t = String(text ?? "").replace(/```(?:json)?/gi, "").trim();
  const a = t.indexOf("{"), z = t.lastIndexOf("}");
  if (a >= 0 && z > a) t = t.slice(a, z + 1);
  return JSON.parse(t);
}

/* ---------- herramientas: nombre, texto y esquema (las usan el MCP y la API REST) ---------- */
export type ToolDef = { name: string; title: string; description: string; scope: "read" | "write"; inputSchema: Record<string, unknown>; meta?: Record<string, unknown>; legacy?: string[] };
/** Archivo que ChatGPT entrega a una herramienta MCP (campo declarado en _meta["openai/fileParams"]): ChatGPT rellena download_url y file_id */
const fileObj = { type: "object", description: "Archivo de ChatGPT (ChatGPT rellena download_url y file_id).", properties: { download_url: { type: "string" }, file_id: { type: "string" } }, required: ["download_url"] };
const urls = { type: "array", maxItems: 12, items: { type: "string" }, description: "Enlaces https públicos de imágenes (PNG, JPG, WEBP o GIF) que ya tengas." };
const fileRefs = { type: "array", maxItems: 12, description: "Imágenes de la conversación de ChatGPT (ChatGPT las rellena solo).", items: { type: "object", properties: { name: { type: "string" }, id: { type: "string" }, mime_type: { type: "string" }, download_link: { type: "string" } } } };
const aurls = { type: "array", maxItems: 12, items: { type: "string" }, description: "Enlaces https públicos de audios (MP3, WAV, M4A u OGG) que ya tengas." };
const asp = { type: "string", enum: [...ASPECTS], description: "Formato del video: 16:9 (YouTube), 9:16 (Shorts/TikTok), 1:1 o 4:5." };

export const TOOLS: ToolDef[] = [
  { name: "framaly_status", title: "Estado de FRAMALY", scope: "read",
    description: "Muestra el modo de esta conexión (si FRAMALY puede generar o solo recibe tus archivos), qué IAs hay, el tope diario y lo gastado hoy. Llámala primero.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "framaly_write_script", title: "Escribir guion", scope: "write",
    description: "Escribe el guion de un video narrado, dividido en escenas (narración, descripción de imagen y texto en pantalla). Devuelve JSON listo para framaly_create_video_project.",
    inputSchema: { type: "object", required: ["topic"], additionalProperties: false, properties: {
      topic: { type: "string", description: "De qué trata el video." },
      duration_seconds: { type: "integer", minimum: 10, maximum: 600, description: "Duración aproximada. Por defecto 60." },
      scenes: { type: "integer", minimum: 2, maximum: 12, description: "Número de escenas. Si no se indica, se calcula." },
      tone: { type: "string" }, audience: { type: "string" }, language: { type: "string", description: "Idioma de la narración. Por defecto español." },
      extra: { type: "string", description: "Instrucciones extra para el guionista." },
      provider: { type: "string", enum: ["anthropic", "openai", "gemini"], description: "IA de texto. Si se omite, se usa la primera disponible." } } } },
  { name: "framaly_save_script", title: "Guardar guion en FRAMALY", scope: "write",
    description: "Guarda en la sección Guiones de FRAMALY un guion que TÚ escribiste (no gasta créditos). Úsalo SIEMPRE que escribas o cambies un guion para el usuario: queda listo en Guiones → «Recibidos de tu IA». Puedes enlazar a cada escena una imagen o una voz ya importadas (image_media_id / voice_media_id) para que el video se monte sin generar nada.",
    inputSchema: { type: "object", required: ["title", "scenes"], additionalProperties: false, properties: {
      title: { type: "string", maxLength: 120, description: "Título del video." },
      topic: { type: "string", maxLength: 400, description: "De qué trata (una frase)." },
      visual_bible: { type: "string", maxLength: 900, description: "Aspecto fijo de todo el video: personajes, lugar, paleta y luz." },
      aspect: { type: "string", enum: ["16:9", "9:16", "1:1", "4:5"], description: "Formato. Por defecto 9:16." },
      language: { type: "string", maxLength: 40 },
      scenes: { type: "array", minItems: 1, maxItems: 40, items: { type: "object", required: ["narration"], additionalProperties: false, properties: {
        narration: { type: "string", maxLength: 1500, description: "Texto exacto que dice el locutor." },
        image_prompt: { type: "string", maxLength: 1200, description: "Descripción de la imagen de la escena." },
        on_screen_text: { type: "string", maxLength: 120 },
        image_media_id: { type: "string", maxLength: 60, description: "Imagen de la biblioteca para esta escena (opcional)." },
        voice_media_id: { type: "string", maxLength: 60, description: "Narración de la biblioteca para esta escena (opcional)." } } } },
      script_id: { type: "string", maxLength: 60, description: "Para corregir un guion ya guardado: el script_id que devolvió esta herramienta." },
      idempotency_key: { type: "string", maxLength: 80, description: "Evita duplicados si repites la llamada." } } } },
  { name: "framaly_list_scripts", title: "Listar guiones guardados", scope: "read",
    description: "Lista los guiones guardados en la sección Guiones de FRAMALY (recibidos por esta conexión o generados por FRAMALY).",
    inputSchema: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 50 } } } },
  { name: "framaly_generate_image", title: "Generar imagen", scope: "write",
    description: "Genera una imagen con IA, la guarda en la biblioteca de FRAMALY y devuelve su id y un enlace temporal (1 hora). Escribe el prompt en español.",
    inputSchema: { type: "object", required: ["prompt"], additionalProperties: false, properties: {
      prompt: { type: "string", maxLength: 3000 }, aspect: asp,
      quality: { type: "string", enum: ["low", "medium", "high"], description: "Solo OpenAI. Por defecto medium." },
      provider: { type: "string", enum: ["openai", "gemini"] }, name: { type: "string", description: "Nombre en la biblioteca." } } } },
  { name: "framaly_import_image", title: "Importar imágenes", scope: "write",
    description: "Recibe en la biblioteca de FRAMALY las imágenes que ChatGPT generó (campo image / images) o imágenes de enlaces https. No genera nada ni gasta créditos. Devuelve media_id, nombre y tipo.",
    meta: { "openai/fileParams": ["image"] },
    legacy: ["images", "openaiFileIdRefs", "files", "file"],   // se siguen aceptando por compatibilidad, pero ya no se muestran a ChatGPT
    inputSchema: { type: "object", additionalProperties: false, properties: {
      image: fileObj, image_urls: urls, name: { type: "string", description: "Nombre del archivo (ej: caballo_volador_andes.png). Si se omite se usa el que traiga la imagen." } } } },
  { name: "framaly_inspect_file", title: "Diagnosticar archivo de ChatGPT", scope: "read",
    description: "Diagnóstico: recibe un archivo de ChatGPT y dice si FRAMALY puede descargar sus bytes (tipo, tamaño, error real). No guarda nada ni gasta créditos.",
    meta: { "openai/fileParams": ["file"] },
    inputSchema: { type: "object", required: ["file"], additionalProperties: false, properties: { file: fileObj } } },
  { name: "framaly_import_audio", title: "Importar audios", scope: "write",
    description: "Trae a la biblioteca de FRAMALY audios que ya existen (narración, música o efectos en MP3, WAV, M4A u OGG) desde enlaces https o desde los archivos de la conversación. Devuelve el id y la duración de cada uno.",
    inputSchema: { type: "object", additionalProperties: false, properties: { audio_urls: aurls, openaiFileIdRefs: fileRefs, name: { type: "string", description: "Nombre base en la biblioteca." } } } },
  { name: "framaly_upload_media", title: "Subir imagen o audio", scope: "write",
    description: "Sube a la biblioteca un archivo en base64 (imagen PNG, JPG, WEBP o GIF; audio MP3, WAV, M4A u OGG; hasta unos 10 MB). Devuelve su id y duración. Si ya tienes un enlace https usa framaly_import_image o framaly_import_audio. Un archivo idéntico no se duplica.",
    inputSchema: { type: "object", required: ["type", "data_base64"], additionalProperties: false, properties: {
      type: { type: "string", enum: ["image", "audio"] }, data_base64: { type: "string", maxLength: 14000000, description: "Contenido del archivo en base64 (sin saltos de línea)." },
      name: { type: "string", description: "Nombre en la biblioteca." } } } },
  { name: "framaly_generate_voice", title: "Generar voz", scope: "write",
    description: "Convierte un texto en una narración de voz (MP3), la guarda en la biblioteca y devuelve su id, su duración y un enlace temporal.",
    inputSchema: { type: "object", required: ["text"], additionalProperties: false, properties: {
      text: { type: "string", maxLength: 4000 }, provider: { type: "string", enum: ["openai", "elevenlabs"] },
      voice: { type: "string", description: "Voz de OpenAI (nova, shimmer, coral, sage, alloy, ash, ballad, echo, fable, onyx, verse)." },
      voice_id: { type: "string", description: "Id de voz de ElevenLabs. Si se omite, se usa la primera de la cuenta." },
      name: { type: "string" } } } },
  { name: "framaly_seo_metadata", title: "Título, descripción y etiquetas", scope: "write",
    description: "Crea título, descripción y etiquetas optimizados para YouTube a partir del tema o de la narración.",
    inputSchema: { type: "object", required: ["topic"], additionalProperties: false, properties: {
      topic: { type: "string" }, narration: { type: "string", description: "Texto completo de la narración (opcional)." },
      keywords: { type: "string" }, language: { type: "string" }, provider: { type: "string", enum: ["anthropic", "openai", "gemini"] } } } },
  { name: "framaly_create_video_project", title: "Crear proyecto de video", scope: "write",
    description: "Crea un proyecto de video listo para el editor de FRAMALY, con transiciones y subtítulos. Usa tus imágenes y audios (image_urls, audio_urls, openaiFileIdRefs) o los genera con IA. Un solo audio es la música de fondo; varios son la narración de cada escena, en orden. Cada escena admite un efecto de sonido (sfx_url o sfx_media_id). Repetir la llamada no duplica el proyecto.",
    inputSchema: { type: "object", required: ["title"], additionalProperties: false, properties: {
      image_urls: urls, audio_urls: aurls, openaiFileIdRefs: fileRefs,
      music_url: { type: "string", description: "Enlace https de la música de fondo." }, music_media_id: { type: "string" },
      title: { type: "string", maxLength: 100 }, aspect: asp,
      scenes: { type: "array", minItems: 1, maxItems: 12, description: "Una por escena. Si se omite y se dan imágenes, se crea una escena por imagen.", items: { type: "object", additionalProperties: false, properties: {
        narration: { type: "string" }, image_url: { type: "string", description: "Enlace https de una imagen ya existente." }, voice_url: { type: "string", description: "Enlace https del audio de esta escena." }, image_prompt: { type: "string", description: "Qué mostrar (en español). Si hay image_media_id no hace falta." },
        image_media_id: { type: "string" }, voice_media_id: { type: "string" }, on_screen_text: { type: "string" },
        sfx_url: { type: "string", description: "Enlace https de un efecto de sonido para esta escena." }, sfx_media_id: { type: "string" }, sfx_offset: { type: "number", minimum: 0, maximum: 60, description: "Segundos desde el inicio de la escena." }, sfx_volume: { type: "number", minimum: 0, maximum: 1 } } } },
      seconds_per_scene: { type: "number", minimum: 2.5, maximum: 30, description: "Segundos por escena cuando no hay voz. Por defecto 5." },
      voice: { type: "boolean", description: "Generar la narración con voz. Por defecto: sí si hay una API de voz disponible." },
      subtitles: { type: "string", enum: ["narracion", "pantalla", "ninguno"], description: "Qué texto mostrar en pantalla. Por defecto: narracion." },
      style: { type: "string", description: "Estilo visual que se añade a cada prompt (ej: «fotografía cinematográfica, luz dorada»)." },
      image_provider: { type: "string", enum: ["openai", "gemini"] }, voice_provider: { type: "string", enum: ["openai", "elevenlabs"] },
      voice_name: { type: "string" }, voice_id: { type: "string" },
      idempotency_key: { type: "string", maxLength: 80, description: "Texto único para no crear el proyecto dos veces si repites la llamada. Opcional: si se omite, se detecta por el contenido." } } } },
  { name: "framaly_list_projects", title: "Listar proyectos", scope: "read",
    description: "Lista los proyectos de video de la cuenta (id, nombre, formato, clips, duración y fecha).",
    inputSchema: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 50 } } } },
  { name: "framaly_get_media", title: "Ver una imagen de la biblioteca", scope: "read",
    description: "Devuelve la imagen de la biblioteca (media_id) para verla en la conversación, con su nombre, tipo, tamaño y un enlace temporal firmado (10 min). Solo ve archivos de tu cuenta. No genera nada ni gasta créditos.",
    inputSchema: { type: "object", required: ["media_id"], additionalProperties: false, properties: { media_id: { type: "string", maxLength: 60, description: "Identificador (framaly_list_media)." } } } },
  { name: "framaly_list_media", title: "Listar biblioteca", scope: "read",
    description: "Lista imágenes y audios de la biblioteca (id, nombre, tipo, duración) para reutilizarlos como image_media_id / voice_media_id.",
    inputSchema: { type: "object", additionalProperties: false, properties: { type: { type: "string", enum: ["image", "audio"] }, limit: { type: "integer", minimum: 1, maximum: 100 } } } },
];

export const INSTRUCTIONS = "FRAMALY Studio monta videos con los recursos que le envías. Flujo: 1) framaly_status para ver el modo de la conexión; 2) en modo externo (por defecto) TÚ generas el guion, las imágenes, las narraciones y los efectos y los envías: framaly_import_image / framaly_import_audio (enlaces u openaiFileIdRefs) o framaly_upload_media (base64); FRAMALY NO genera nada ni gasta créditos de OpenAI; 3) framaly_create_video_project con las escenas (image_media_id / image_url, voice_media_id / voice_url, sfx_url, music_url): conserva el orden y no regenera lo que ya existe; 4) SIEMPRE que escribas un guion para el usuario, guárdalo con framaly_save_script (queda en la sección Guiones); toda imagen o audio que importes queda en su Biblioteca y aparece solo en FRAMALY en menos de un minuto, sin pulsar nada; 5) el usuario abre FRAMALY y exporta el MP4. Si el usuario eligió otro modo, framaly_write_script, framaly_generate_image y framaly_generate_voice generan con las claves de FRAMALY (OpenAI siempre bloqueado salvo modo «todo»).";

/** Especificación OpenAPI 3.1 (para las Acciones de un GPT personalizado y cualquier cliente REST) */
/** Las Acciones de ChatGPT aceptan descripciones de hasta 300 caracteres */
const short = (s: string) => (s.length <= 300 ? s : s.slice(0, 300).replace(/[^.]*$/, "").trim() || s.slice(0, 297) + "…");

export function openapi(base: string) {
  const paths: Record<string, unknown> = {};
  for (const t of TOOLS) {
    paths["/api/" + t.name] = { post: { operationId: t.name, summary: t.title, description: short(t.description),
      requestBody: { required: true, content: { "application/json": { schema: t.inputSchema } } },
      responses: { "200": { description: "Resultado", content: { "application/json": { schema: { type: "object" } } } }, "401": { description: "Clave inválida" }, "429": { description: "Demasiadas llamadas o tope alcanzado" } } } };
  }
  // Acciones de un GPT: ChatGPT entrega las imágenes de la conversación en openaiFileIdRefs (name, id, mime_type, download_link).
  // Solo se declara aquí (API REST); el conector MCP usa el campo «image».
  const imp: any = (paths["/api/framaly_import_image"] as any)?.post?.requestBody?.content?.["application/json"]?.schema;
  if (imp?.properties) imp.properties = { openaiFileIdRefs: { ...fileRefs, description: "Imágenes de la conversación de ChatGPT (se rellena solo)." }, ...imp.properties };
  return { openapi: "3.1.0", info: { title: "FRAMALY Studio", version: VERSION, description: "Crea videos con IA desde otros agentes. " + INSTRUCTIONS },
    servers: [{ url: base }], paths, components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Clave de conexión creada en FRAMALY → Ajustes (empieza con fmk_)." } } }, security: [{ bearer: [] }] };
}

export const rpcOk = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
export const rpcErr = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

/** Valida los argumentos contra el esquema de la herramienta (solo lo necesario: requeridos, tipos y rangos básicos) */
export function checkArgs(def: ToolDef, args: any): string | null {
  const s: any = def.inputSchema, a = args ?? {};
  if (typeof a !== "object" || Array.isArray(a)) return "Los argumentos deben ser un objeto.";
  for (const k of s.required ?? []) if (a[k] === undefined || a[k] === null || a[k] === "") return `Falta «${k}».`;
  for (const [k, v] of Object.entries(a)) {
    const p = s.properties?.[k] ?? (def.legacy?.includes(k) ? {} : undefined); if (!p) return `Argumento desconocido: «${k}».`;
    if (p.type === "string" && typeof v !== "string") return `«${k}» debe ser texto.`;
    if (p.type === "string" && p.maxLength && (v as string).length > p.maxLength) return `«${k}» es demasiado largo (máx. ${p.maxLength}).`;
    if (p.enum && !p.enum.includes(v)) return `«${k}» debe ser uno de: ${p.enum.join(", ")}.`;
    if (p.type === "integer" && (!Number.isInteger(v) || (p.minimum != null && (v as number) < p.minimum) || (p.maximum != null && (v as number) > p.maximum))) return `«${k}» debe ser un entero entre ${p.minimum ?? "…"} y ${p.maximum ?? "…"}.`;
    if (p.type === "number" && (typeof v !== "number" || !isFinite(v) || (p.minimum != null && v < p.minimum) || (p.maximum != null && v > p.maximum))) return `«${k}» debe ser un número entre ${p.minimum ?? "…"} y ${p.maximum ?? "…"}.`;
    if (p.type === "boolean" && typeof v !== "boolean") return `«${k}» debe ser verdadero o falso.`;
    if (p.type === "array" && (!Array.isArray(v) || (p.minItems && v.length < p.minItems) || (p.maxItems && v.length > p.maxItems))) return `«${k}» debe ser una lista de ${p.minItems ?? 0} a ${p.maxItems ?? "…"} elementos.`;
  }
  return null;
}
