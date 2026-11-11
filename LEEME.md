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

## Editor de video: atajos y herramientas
- **Dividir** (botón o tecla `S`): corta el clip en la posición del cursor.
- **Ctrl+D** duplica el clip; **Inicio / Fin** saltan al principio o al final; **Espacio** reproduce.
- **Texto → Animación «Palabra por palabra»**: subtítulos en mayúsculas, máximo 3 palabras a la vez, repartidos en la duración del clip.
- **Proyecto → «Bajar la música cuando habla la voz»**: baja la música 12 dB mientras suena la narración (también en el MP4 exportado).

## Método Golden en el editor (sin IA, todo local)
**Editar automático (un solo botón):** en el editor pulsa **Automático** (arriba) o **Editar automático** (pestaña Golden). Con tus imágenes y tu voz hace todo en orden y muestra cada paso: corta silencios, muletillas y repeticiones; ajusta las imágenes a la voz; parte los planos largos y alterna encuadres; subtitula con máx. 3 palabras; baja la música cuando habla la voz; y corre la revisión. Si la transcripción no está disponible, corta por volumen y te avisa. **Deshacer todo** devuelve el proyecto a como estaba.

**Manual y fácil:** botones **Texto** (o tecla `T`), **Duplicar** y **Dividir** (`S`) sobre el timeline. Puedes **arrastrar imágenes o audios desde tu PC** a cualquier parte del editor. Todo se puede retocar a mano después.

En el editor, pestaña **Golden** del panel izquierdo. Funciona en el navegador, sin Claude ni claves de API. Sigue la ley de orden: **Cortar → Subtitular → Ilustrar → Sonorizar**.
- **Intake:** destino (anuncio 9:16 / YouTube / reel), producto, **claims prohibidos y permitidos** y duración objetivo.
- **Transcripción de la voz:** dos motores a elegir en la pestaña Golden. **Local** (Whisper dentro del navegador, gratis y sin claves; la primera vez descarga el modelo, necesita internet) o **Whisper de OpenAI** con tu clave propia de Integraciones API.
- **Cortar con transcripción:** quita muletillas (eh, em, mm), pausas largas y tomas repetidas (te quedas con la segunda), y lista en el reporte las frases descartadas.
- **Subtítulos desde el audio:** sincronizados palabra por palabra, máx. 3 palabras en pantalla.
- **Quitar silencios de la voz (por volumen):** analiza el audio, adapta el umbral al ruido de fondo, deja 200 ms de aire y no toca el inicio ni el final de las palabras. Crea una voz nueva en la biblioteca y conserva la original.
- **Multicámara:** alterna encuadres (general, punch-in 113 %, tope 125 %). **Ajustar a duración objetivo.**
- **Subtítulos:** pega el guion como se grabó y se reparte por clip, máx. 3 palabras en pantalla. **Limpiar textos** quita ¿ y ¡.
- **Revisión Golden:** claims prohibidos, CTA en inglés, signos de apertura, gancho en 3 s, prueba del sonido apagado, formato y duración, ritmo y ducking, más el **reporte de cortes** (en qué segundo quedó cada clip y qué silencios se quitaron).
- **Productos guardados:** guarda el nombre y los claims prohibidos y permitidos de un producto y cárgalos en cualquier video con un clic (así nunca se edita a ciegas).
- **Empaquetar el estilo:** cuando un video te guste, guarda su estilo (filtro, transición, texto, encuadres, barras, marca de agua y ducking) con el nombre del cliente y aplícalo a otros videos en un clic.
- Productos y estilos se guardan en este dispositivo, junto a los ajustes de la app.
- **Cámaras por ideas (multicámara con una sola cámara):** reparte el encuadre según las ideas del guion o de la transcripción: **frontal** en el gancho, la promesa y el cierre; **lateral** en la narración (punch-in al 113 %); **closeup** en la frase corta (tope 125 %). Los cortes caen en el silencio más cercano (ventana de 1,5 s); si no hay silencio, no se corta.
- **Dividir (`S`) en el silencio:** el corte manual salta al silencio más cercano; si no hay uno a menos de 1,5 s, te avisa antes de cortar a mitad de palabra.
- **B-roll donde se nombra algo:** define palabra + imagen del objeto, y se coloca en cada mención (objeto sobre fondo negro, menos de 1 s, sin mover la voz). También hay «B-roll aquí» en el cursor.
- **Efectos de sonido:** pop, whoosh y ding generados en la app, colocados un poco *después* del corte (desacoplados). Se editan como cualquier pista.
- **Prueba del sonido apagado:** botón de sonido junto al reproductor. Reproduce sin audio para ver si el video se entiende solo.
- **Replicar estilo desde capturas:** sube capturas de un video de referencia y la app toma la paleta y elige el filtro más parecido (se destila, no se clona). **Prompts de fondos:** genera los 3 prompts (frontal, lateral, closeup) para crear la misma habitación con IA.
- **Revisión:** además avisa de las dos trampas de montaje (cutaway sobre un cambio de cámara y zoom encima de zoom), de demasiados closeups y de b-roll de más de 1 s.
- **Ruido de fondo:** los 3 s iniciales en silencio se usan para medir el ruido y detectar mejor los silencios.
- **Guía:** el método completo, dentro de la app.
Lo que la herramienta no decide: qué se dice, dónde va el silencio que incomoda y si la pieza merece existir.

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
5. Herramientas: `framaly_status`, `framaly_write_script`, `framaly_generate_image`, `framaly_import_image` (imágenes que ya existen, p. ej. las de ChatGPT, por enlace https o `openaiFileIdRefs`), `framaly_import_audio` (narración o música que ya existen: MP3, WAV, M4A, OGG), `framaly_generate_voice`, `framaly_seo_metadata`, `framaly_create_video_project`, `framaly_list_projects`, `framaly_list_media`.
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

## Editor de video · complementos del método (js/golden-extra.js)
- **Bloqueantes del Intake** (arriba del panel Golden): video/voz, claims prohibidos, guion tal como se grabó, destino y duración.
- **Ajustar el primer corte**: «Reducir más los silencios» y «No tan estricto» deshacen el corte y lo repiten con otra sensibilidad.
- **Copiar el contexto del proyecto** (la memoria del editor): producto, destino, claims, reglas fijas y guion.
- **Revisión Golden ampliada**: número de control del corte (1:40 → ~58 s), guion sin pegar, música sin ducking, marca de agua.
- **Guía completa** con «Si algo falla», multicámara con una cámara, replicar estilo y reglas de oro.
- **Todo el conocimiento de la skill dentro del editor**: botón «Todo el conocimiento de la skill» arriba de la pestaña Golden. Abre el documento completo (método, multicámara con una cámara, dónde está cada regla en la app, zona honesta y límites) con índice y buscador. Datos en `js/golden-skill-data.js`, visor en `js/golden-skill.js`.

## Pestaña «Plantillas» (editor de video)
Reúne el material reutilizable de la skill: formato del video (Meta/TikTok, reel, YouTube), archivo de contexto, intake, instrucciones para la máquina, reparto multicámara, b-roll y sonido, reporte de cortes, checklist antes de exportar, replicar/empaquetar estilo, fallos y reglas de oro. Cada una se copia con un clic; los formatos y los estilos guardados se aplican al proyecto. Código: `js/plantillas.js`.

## Sección «Plantillas» (menú, debajo de Editor de video)
Todas las combinaciones de la skill: 6 recetas completas (anuncio COD, reel, YouTube, multicámara con una cámara, replicar estilo, solo limpiar) que crean un proyecto ya configurado; un armador propio (destino, cortes, cámaras, b-roll, sonido); las matrices cámara×bloque, b-roll, instrucciones, destino y síntoma×arreglo; y las 12 combinaciones que no se hacen. La receta elegida entra al archivo de contexto del proyecto. Código: `js/recetas.js`.

## Plantillas para todo tipo de video + «Agregar plantilla»
La sección Plantillas ahora tiene un catálogo de 28 plantillas (Ventas, Contenido, Historias, Negocio, Redes). Cada una: «Crear proyecto» (clips con las escenas, texto, filtro, transición y movimiento ya puestos, con imagen de relleno por escena), «Guion con IA» (rellena el Agente Guionista) y «Copiar». El botón **Agregar plantilla** analiza capturas o un video de referencia con IA (Claude, OpenAI o Gemini): lee el texto de las imágenes (lector óptico), deduce estilo y escenas y guarda la plantilla en «Mis plantillas». Sin IA conectada guarda solo el estilo de color. Código: `js/catalogo.js`; lectura de imágenes en `F.api.llm({ images })`.

## Proyectos a medias (continuar sin volver a gastar créditos)
Los agentes (modo automático y Flujos) guardan un punto de avance: guion, cada imagen y cada narración en cuanto se generan. Si se corta (error, sin créditos, cierras la página) aparece una tarjeta **Proyectos a medias** en Inicio y en la columna de Flujos con lo que ya está hecho; «Continuar» reutiliza lo generado y solo hace lo que falta. Código: `P.pending` y `P.run` en `js/flows.js`. El avance se guarda en el dispositivo (localStorage); las imágenes y voces viven en la Biblioteca.

## Paquete de efectos y flujos ya hechos
`js/extras.js` (se carga después de `render.js`) añade 17 transiciones, 7 movimientos de cámara, 12 filtros (varios con grano, líneas VHS, fugas de luz o brillo), 3 estilos y 4 animaciones de texto, y los **Estilos en un clic** + **Sorpréndeme** (Editor → pestaña «Más»). En Flujos hay 18 flujos ya hechos nuevos (anuncio, curiosidades, motivacional, terror, cuento infantil, receta, tutorial, noticia, viaje, biografía, comparativa, mitos, tips de dinero, ciencia ficción, cómic, retro VHS, meditación, frases) y 6 estilos de imagen nuevos; el montaje acepta «Animación del texto».

## Editor PRO (pestaña «Pro»: Automático y Manual)
`js/pro.js`. **Automático:** Pulido en un clic, color automático, igualar color entre clips, mezcla automática (voz nivelada, música con ducking y fundidos), cortes al ritmo de la música (detección de pulsos) y revisión técnica. **Manual:** corrección de color por clip (brillo, contraste, saturación, temperatura, viñeta, desenfoque), encuadre (zoom, posición, giro, espejo, opacidad), tamaño y posición del texto, velocidad de los videos, entrada suave del audio, logo, fundido de entrada/salida, guías de zona segura, resolución (720p–4K) y calidad de exportación, copiar/pegar estilo y recorte hasta el cursor. Atajos: `,` `.` fotograma · `↑` `↓` clip · `Q` `W` recortar · `Ctrl+Shift+C/V` estilo · `G` guías · `+` `−` zoom.

## Videos con IA (Veo 3 y MiniMax Hailuo)
Sección **Videos con IA** (`js/videosia.js`): genera clips a partir de texto y, opcionalmente, una imagen de partida. Veo usa la clave de Gemini; MiniMax usa la suya. El trabajo se guarda mientras se genera (si cierras la página se retoma sin pagar otra vez) y el resultado entra a la Biblioteca como video con su audio extraído. Cliente: `F.api.videoStart / videoStatus / videoFetch` en `js/api.js`. Servidor: la función `ia` permite crear, consultar y bajar videos; el gasto se anota una sola vez cuando el proveedor termina (precios estimados en `supabase/functions/ia/index.ts`). Prueba sin gastar créditos: `supabase/functions/ia/test/LEEME.md`.
