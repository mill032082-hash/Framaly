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

Para cerrar el registro del todo, cuando ya estén tus personas, apaga **Allow new users to sign up** en Supabase (Authentication → Sign In / Providers).

Cómo se sincroniza: automático, gana el cambio más reciente, y borrar algo en un dispositivo lo borra en los demás. Las claves de OpenAI, Claude y ElevenLabs **no se suben nunca**: siguen solo en cada navegador. Si `js/config.js` está vacío, la app funciona sin cuentas y guarda todo solo en el dispositivo.

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
