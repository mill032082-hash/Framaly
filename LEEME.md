# FRAMALY Studio

Estudio para crear videos con imágenes, voces y agentes de IA, y publicarlos en YouTube.

## Cómo abrirlo
1. Doble clic en **`Iniciar FRAMALY.bat`** (se abre en http://localhost:5577). Deja la ventana negra abierta.
2. Usa **Chrome o Edge** (necesarios para exportar MP4).

> También puedes abrir `index.html` directamente, pero la subida a YouTube solo funciona desde `http://localhost:5577`.

## Modo automático (lo normal)
1. Conecta tu clave de **OpenAI** en *Integraciones API* (solo una vez).
2. En **Inicio → Modo automático** escribe la idea del video y elige formato, duración y estilo.
3. Pulsa **Crear video automático**. Los agentes escriben el guion, generan las imágenes, narran, montan con transiciones y subtítulos, crean título/descripción/etiquetas y **exportan el MP4 solos**.
4. Se abre **Publicar**: descarga la miniatura y súbelo a YouTube.

Si subes una canción a la *Biblioteca*, se usa automáticamente como música de fondo.
Cada sección tiene instrucciones paso a paso arriba y en el botón **Instrucciones**.

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
