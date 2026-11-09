# FRAMALY Studio

Estudio para crear videos con imágenes, voces y agentes de IA, y publicarlos en YouTube.

## Cómo abrirlo
1. Doble clic en **`Iniciar FRAMALY.bat`** (se abre en http://localhost:5577). Deja la ventana negra abierta.
2. Usa **Chrome o Edge** (necesarios para exportar MP4).

> También puedes abrir `index.html` directamente, pero la subida a YouTube solo funciona desde `http://localhost:5577`.

## Usarla en el celular
FRAMALY se adapta sola a celular, tablet y PC.
1. Abre `Iniciar FRAMALY.bat` en tu PC. La ventana negra muestra una dirección como `http://192.168.1.22:5577`.
2. Con el celular conectado **a la misma red Wi-Fi**, abre esa dirección en Chrome (Android) o Safari (iPhone).
3. Si Windows pregunta por el firewall, pulsa **Permitir acceso**.
4. Para tenerla como app: en Chrome, menú ⋮ → **Agregar a pantalla principal**; en Safari, **Compartir → Agregar a inicio**.

Cada dispositivo guarda su propia biblioteca y sus propias claves de API.

## Modo automático (lo normal)
1. Conecta tu clave de **OpenAI** en *Integraciones API* (solo una vez).
2. En **Inicio → Modo automático** escribe la idea del video y elige formato, duración y estilo.
3. Pulsa **Crear video automático**. Los agentes escriben el guion, generan las imágenes, narran, montan con transiciones y subtítulos, crean título/descripción/etiquetas y **exportan el MP4 solos**.
4. Se abre **Publicar**: descarga la miniatura y súbelo a YouTube.

Si subes una canción a la *Biblioteca*, se usa automáticamente como música de fondo.
Cada sección tiene instrucciones paso a paso arriba y en el botón **Instrucciones**.

## Cuentas y base de datos (Supabase)
La plataforma trae **inicio de sesión y base de datos integrados**. Las personas que la usen solo ven una pantalla de «Inicia sesión» (correo y contraseña); no configuran nada. Sus proyectos y su biblioteca se guardan en su cuenta y aparecen en cualquier dispositivo (PC, celular).

**Lo prepara el administrador una sola vez:**
1. Crea un proyecto gratis en **supabase.com**.
2. **SQL Editor → New query**: pega el contenido de **`supabase/schema.sql`** y pulsa **Run**.
3. **Project Settings → API**: copia el **Project URL** y la clave **anon public** y escríbelos en **`js/config.js`**. Nunca uses la clave `service_role`.
4. **Authentication → URL Configuration**: pon la dirección donde publicas la app (por ejemplo tu dominio de Vercel) como Site URL y Redirect URL.
5. **Authentication → Providers → Email**: desactiva **Confirm email** para que las personas entren al crear su cuenta sin revisar el correo.
6. Publica de nuevo (Vercel). Listo.

**Quién puede entrar (aprobación):** además de `supabase/schema.sql`, ejecuta **`supabase/access.sql`**. Con eso, cada persona que se registra queda **pendiente** y no ve nada hasta que el administrador la apruebe. El administrador es `mill032082@gmail.com`: la primera vez debe entrar con **Google** (o, si se registró con contraseña, hay que marcarla como administradora en la tabla `framaly_access`). Las aprobaciones se hacen en **Ajustes → Personas con acceso**, y el menú lateral avisa cuántas hay por aprobar. Para cambiar de administrador, edita el correo dentro de `framaly_on_user_created` en `access.sql`.

**Permisos por persona:** en **Ajustes → Personas con acceso → Permisos** eliges qué secciones puede usar cada persona (editor, flujos, guiones, imágenes, voces, efectos, biblioteca, publicar, Integraciones API y ajustes). Las personas nuevas arrancan **sin** Integraciones API. Los cambios les llegan en un minuto, sin volver a entrar.

Para cerrar el registro del todo, cuando ya estén tus personas, apaga **Allow new users to sign up** en Supabase (Authentication → Sign In / Providers).

Cómo se sincroniza: automático, gana el cambio más reciente, y borrar algo en un dispositivo lo borra en los demás. Las claves de OpenAI, Claude y ElevenLabs **no se suben nunca**: siguen solo en cada navegador. Si `js/config.js` está vacío, la app funciona sin cuentas y guarda todo solo en el dispositivo.

## Claves de IA compartidas, límites y avisos
Las claves de Claude, OpenAI y ElevenLabs pueden vivir **en el servidor** (Supabase), donde nadie las ve. Las personas usan la IA a través de una función segura que mide cada uso, respeta los límites y avisa al administrador.

**Preparación (una vez):**
1. Ejecuta en el SQL Editor de Supabase, en este orden: `supabase/schema.sql`, `supabase/access.sql`, `supabase/asesor.sql` y `supabase/budget.sql`.
2. Despliega las funciones `supabase/functions/ia` y `supabase/functions/asesor` (cada una con su `budget.ts`, que es idéntico en las dos).
3. En Supabase → Edge Functions → Secrets guarda: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` y `ELEVENLABS_API_KEY`. Usa claves creadas solo para FRAMALY y pon además un límite de gasto en cada proveedor como red de seguridad.

**Proveedores:** Claude, OpenAI, ElevenLabs, **Gemini** y **MiniMax**. Secretos opcionales en Supabase: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `GEMINI_API_KEY`, `MINIMAX_API_KEY`. Los modelos de Gemini y MiniMax se pueden cambiar en Integraciones API. Para activarlos en una base ya existente, ejecuta `supabase/gemini_minimax.sql`.

**Dos formas de guardar las claves (las dos valen):** en la plataforma (**Integraciones API → Guardar clave**, se cifra en la bóveda de Supabase; requiere `supabase/secrets.sql`) o como secretos de la función en Supabase. Si hay una guardada en la plataforma, esa tiene prioridad. Los fallos de las APIs aparecen en **Integraciones API → Errores recientes**.

**Saldo e historial:** ejecuta también `supabase/history.sql`. Cada API muestra lo gastado con FRAMALY (total y por día) y un historial de conexión. El **saldo real** solo lo entrega ElevenLabs con una clave normal (créala con el permiso *User: Read*); en las demás hay un enlace a su panel.

**Cómo se usa (administrador):**
- **Ajustes → Personas con acceso → Permisos:** para cada persona y cada API eliges **Clave de FRAMALY**, **Que ponga la suya** o **Sin IA**, y un **tope diario** en dólares.
- **Preparar acceso:** deja un correo listo antes de que se registre (con Google entra aprobado; con contraseña queda pendiente con sus ajustes).
- **Integraciones API:** por API ves lo gastado, el límite mensual y el aviso (80/90/100 %), y el consumo por persona.
- **Campanita:** avisos de límites y topes. Los montos son estimados; los precios se ajustan en `budget.ts`.

## Conectar con ChatGPT, Claude y otros agentes (MCP + API)

FRAMALY incluye un servidor **MCP** y una **API REST** (función `mcp` de Supabase) para que otra IA cree videos por ti.

1. Ejecuta `supabase/api_tokens.sql` en el SQL Editor y despliega `supabase/functions/mcp` (**sin** verificar JWT: la función se autentica sola con la clave de conexión).
2. En FRAMALY → **Ajustes → Conectar con ChatGPT y otras IAs** crea una clave (`fmk_…`). Se guarda solo su huella (SHA-256); se muestra una única vez y se puede revocar.
3. Direcciones: MCP `https://<proyecto>.supabase.co/functions/v1/mcp` · OpenAPI `…/mcp/openapi.json` · REST `…/mcp/api/<herramienta>`.
4. ChatGPT (GPT personalizado → Acciones): importa la URL de OpenAPI y autentica con Bearer. Claude, Cursor, Claude Code y otros clientes MCP: dirección del servidor + cabecera `Authorization: Bearer fmk_…` (o `…/mcp/t/<clave>` si no permiten cabeceras).
5. Herramientas: `framaly_status`, `framaly_write_script`, `framaly_generate_image`, `framaly_generate_voice`, `framaly_seo_metadata`, `framaly_create_video_project`, `framaly_list_projects`, `framaly_list_media`.
6. Seguridad: cada llamada usa las claves compartidas y respeta los modos de IA, el tope diario y los límites mensuales de la cuenta dueña de la clave; máximo 30 llamadas por minuto por clave; todo queda registrado en «Uso reciente».
7. Pruebas del servidor: `supabase/functions/mcp/test` (necesitan Node y esbuild; no requieren Deno).

## Asesor IA (botón flotante)
El botón **Asesor IA** (abajo a la derecha) explica paso a paso cómo hacer cualquier cosa en FRAMALY. Sabe en qué sección estás y respeta los permisos de tu cuenta. Responde de tres formas:
1. **Con IA desde el servidor** (recomendada): la clave de Claude vive solo en Supabase y nadie la ve. Requiere ejecutar **`supabase/asesor.sql`**, desplegar la función **`supabase/functions/asesor`** y crear el secreto **`ANTHROPIC_API_KEY`** en Supabase (Edge Functions → Secrets). Cada persona tiene un límite diario de consultas (60 por defecto; se cambia con el secreto `ASESOR_DAILY_LIMIT`, y el modelo con `ASESOR_MODEL`).
2. **Con una clave propia** guardada en el navegador, si la persona tiene una en Integraciones API.
3. **Guía integrada** (`js/conocimiento.js`): funciona siempre y sin costo. Para que el asesor sepa algo nuevo, se agrega una entrada en ese archivo.

## Configuración (sección «Integraciones API»)
| Servicio | Para qué | Dónde se consigue |
|---|---|---|
| OpenAI | Imágenes, voces y textos | platform.openai.com → API keys |
| Anthropic (Claude) | Guiones y SEO | console.anthropic.com → API keys |
| ElevenLabs (opcional) | Voces premium | elevenlabs.io → Profile → API key |
| Google OAuth Client ID (opcional) | Subir a YouTube | console.cloud.google.com (los pasos están en la app) |

Las claves se guardan solo en tu navegador.

## Secciones
- **Editor de video**: timeline con 14 transiciones, movimientos de cámara (Ken Burns, zoom, paneo), filtros de color, textos animados, pistas de voz y música, deshacer/rehacer y exportación MP4 1080p.
- **Flujos y agentes**: Idea → Guionista → Director Visual → Locutor → Música → Editor → SEO → proyecto listo. Seis plantillas (YouTube, Shorts, Historia, Top, Documental, Presentación).
- **Guiones / Imágenes / Voces**: cada agente por separado.
- **Efectos**: vista previa animada y creador de filtros propios.
- **Biblioteca**: todas tus imágenes y audios (se guardan en el navegador).
- **Publicar**: exportación, SEO con IA, capítulos, miniatura 1280×720 y subida directa a YouTube.

## Notas
- La exportación se hace en tiempo real: un video de 3 minutos tarda unos 3 minutos. No cambies de pestaña mientras se graba.
- Los datos viven en el navegador: si borras los datos de navegación de Chrome, se borra la biblioteca.
