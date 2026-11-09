/* FRAMALY — guía de conocimiento del Asesor IA.
   Cada entrada: id, sec (sección a la que pertenece; '' = general), t (título), k (palabras clave), a (respuesta paso a paso).
   Formato de la respuesta: **negrita**, listas con "1. " o "- ", y enlaces [[#/ruta|Texto]]. */
(function () {
  'use strict';

  F.KB_MAPA = `FRAMALY Studio es una plataforma para crear videos con imágenes, voces y agentes de IA y publicarlos en YouTube. Secciones del menú: Inicio (modo automático y proyectos), Editor de video (timeline), Flujos y agentes (cadena de agentes de IA), Guiones, Imágenes, Voces, Efectos y transiciones, Biblioteca (imágenes y audios), Publicar (exportar, SEO, miniatura, YouTube), Integraciones API (claves de IA) y Ajustes (cuenta y preferencias). El camino más rápido es el Modo automático de Inicio: se escribe la idea y la IA hace guion, imágenes, voz, montaje y exportación.`;

  F.KB = [
    /* ================= GENERAL ================= */
    { id: 'g.mapa', sec: '', t: 'Qué es FRAMALY y qué puedo hacer', k: 'que es framaly para que sirve secciones menu mapa herramienta plataforma funciones todo',
      a: `FRAMALY convierte una idea en un video listo para YouTube.
- **Inicio**: el **Modo automático** crea un video entero desde una frase. También lista tus proyectos.
- **Editor de video**: montas a mano imágenes, voces y música en un timeline.
- **Flujos y agentes**: una cadena de agentes de IA (guionista, director visual, locutor, música, editor, SEO).
- **Guiones**, **Imágenes** y **Voces**: cada agente por separado.
- **Efectos y transiciones**: transiciones, filtros, movimientos y textos.
- **Biblioteca**: todas tus imágenes y audios.
- **Publicar**: exportar el MP4, título y etiquetas con IA, miniatura y subida a YouTube.
- **Integraciones API** y **Ajustes**: claves de IA, cuenta y preferencias.` },
    { id: 'g.primeros', sec: '', t: 'Primeros pasos: qué necesito para empezar', k: 'empezar comenzar primeros pasos necesito requisitos claves api como empiezo inicio configurar',
      a: `1. Entra con tu cuenta (correo o Google) y espera a que te aprueben si es la primera vez.
2. Si tu cuenta tiene acceso a [[#/integraciones|Integraciones API]], conecta tu clave de **OpenAI** (imprescindible para imágenes y voz). **Claude** y **ElevenLabs** son opcionales.
3. Ve a [[#/inicio|Inicio]], escribe la idea de tu video en **Modo automático** y pulsa **Crear video automático**.
Sin ninguna clave, el [[#/editor|Editor]] funciona igual con tus propias imágenes y audios subidos.` },
    { id: 'g.costos', sec: '', t: 'Cuánto cuesta crear un video', k: 'costo precio cuanto cuesta dinero gasto cobra pagar openai dolares barato caro',
      a: `El costo lo cobra el proveedor de IA (por ejemplo OpenAI) a quien puso la clave. Aproximado:
- Un video de **1 minuto** cuesta entre **US$0,60 y US$1**.
- Una imagen cuesta cerca de **US$0,016** en calidad Baja, **US$0,063** en Media y **US$0,25** en Alta.
- En [[#/inicio|Inicio]], debajo del botón **Crear video automático**, aparece el costo estimado antes de empezar.
Tip: la calidad **Media** es la mejor relación calidad/precio. Si no hay saldo en OpenAI (Billing), las imágenes dan error.` },
    { id: 'g.exportar', sec: '', t: 'Cómo se exporta y cuánto tarda', k: 'exportar mp4 webm descargar tiempo real tarda cuanto demora grabar archivo video final calidad 1080',
      a: `La exportación **se graba en tiempo real**: un video de 3 minutos tarda unos 3 minutos.
1. Pulsa **Exportar** en el [[#/editor|Editor]] o en [[#/publicar|Publicar]].
2. Elige formato (**MP4** o **WebM**), calidad y FPS.
3. **No cambies de pestaña ni minimices la ventana** mientras graba, para que el audio quede sincronizado.
4. Al terminar, se descarga el archivo.
Usa **Chrome o Edge**: son los navegadores que permiten exportar MP4.` },
    { id: 'g.cuenta', sec: 'ajustes', t: 'Mi cuenta, inicio de sesión y sincronización', k: 'cuenta sesion iniciar login cerrar sincronizar nube google correo contrasena aprobacion pendiente',
      a: `- Entras con **correo y contraseña** o con **Google**.
- Si la cuenta es nueva, aparece **Esperando aprobación** hasta que quien administra FRAMALY la apruebe. La pantalla se actualiza sola.
- Tus proyectos y tu biblioteca se **guardan en la nube** y se sincronizan solos entre tus dispositivos. Gana siempre el cambio más reciente.
- En [[#/ajustes|Ajustes]] → **Mi cuenta** hay **Sincronizar ahora** y **Cerrar sesión**; también en el menú lateral.
- Tus claves de IA **no se suben** a la nube: se guardan solo en cada navegador.` },
    { id: 'g.celular', sec: '', t: 'Usar FRAMALY en el celular o tablet', k: 'celular movil telefono tablet android iphone instalar pantalla principal app',
      a: `FRAMALY se adapta sola a celular, tablet y PC.
1. Abre la dirección de la app en Chrome (Android) o Safari (iPhone).
2. Inicia sesión: verás los mismos proyectos que en el PC.
3. Para tenerla como app: en Chrome, menú ⋮ → **Agregar a pantalla principal**; en Safari, **Compartir → Agregar a inicio**.
En el celular el menú está en el botón de tres rayas de arriba a la izquierda.` },
    { id: 'g.problemas', sec: '', t: 'Algo no funciona: errores frecuentes', k: 'error problema falla no funciona no sirve falta clave saldo no carga ayuda solucionar arreglar',
      a: `Los casos más comunes:
- **"Falta la API key"**: la clave no está puesta. Se pone en [[#/integraciones|Integraciones API]] (si tu cuenta tiene ese permiso; si no, pídeselo a quien administra FRAMALY).
- **Las imágenes dan error**: casi siempre falta saldo en OpenAI (Billing).
- **No puedo exportar MP4**: usa Chrome o Edge actualizados, o elige **WebM**.
- **No veo una sección**: tu cuenta no la tiene habilitada; pídeselo a quien administra FRAMALY.
- **Esperando aprobación**: tu cuenta aún no fue aprobada.
- **El audio sale desfasado**: no cambies de pestaña mientras se exporta.` },

    /* ================= INICIO ================= */
    { id: 'inicio.auto', sec: 'inicio', t: 'Crear un video automático (Modo automático)', k: 'automatico crear video automatico idea tema modo automatico rapido todo solo hacer un video desde cero',
      a: `1. Ve a [[#/inicio|Inicio]] y busca el recuadro **Modo automático**.
2. Escribe de qué trata tu video (ej: "5 curiosidades sobre los pulpos").
3. Elige **formato** (YouTube 16:9, Shorts/TikTok 9:16, cuadrado 1:1 o Instagram 4:5), **duración** (30 s a 5 min) y **estilo visual**.
4. Deja marcado **Exportar el MP4 automáticamente al terminar** si quieres el archivo listo.
5. Pulsa **Crear video automático**. Los agentes escriben el guion, crean las imágenes, narran, montan con transiciones y subtítulos, crean título/descripción/etiquetas y exportan.
6. Al terminar se abre [[#/publicar|Publicar]] para descargar la miniatura y subirlo a YouTube.
Tip: si subes una canción a la [[#/biblioteca|Biblioteca]], se usa como música de fondo.` },
    { id: 'inicio.proyecto', sec: 'inicio', t: 'Crear un proyecto nuevo a mano', k: 'proyecto nuevo crear manual nombre formato aspecto 16:9 9:16 cuadrado vertical horizontal',
      a: `1. Pulsa **Nuevo proyecto** (arriba a la derecha) o **Proyecto manual** en [[#/inicio|Inicio]].
2. Escribe el nombre y elige el formato: **16:9** (YouTube), **9:16** (Shorts/TikTok/Reels), **1:1** (cuadrado) o **4:5** (Instagram).
3. Pulsa **Crear proyecto**: se abre el [[#/editor|Editor]] vacío.
Si solo quieres ver cómo funciona, usa **Cargar proyecto de ejemplo**.` },
    { id: 'inicio.recientes', sec: 'inicio', t: 'Abrir, cambiar o borrar mis proyectos', k: 'proyectos recientes abrir borrar eliminar cambiar de proyecto lista mis videos continuar',
      a: `- En [[#/inicio|Inicio]], abajo, están los **Proyectos recientes**. Haz clic en uno para abrirlo en el [[#/editor|Editor]].
- Para borrarlo, pulsa el **bote de basura** de su tarjeta y confirma. Las imágenes y audios siguen en la [[#/biblioteca|Biblioteca]].
- Dentro del Editor, el botón de carpeta **Proyectos** también permite cambiar de proyecto.` },

    /* ================= EDITOR ================= */
    { id: 'editor.basico', sec: 'editor', t: 'Hacer un video en el Editor paso a paso', k: 'editor timeline montar video manual hacer video clips arrastrar usar editor como se usa',
      a: `1. Abre el [[#/editor|Editor]] (o crea un proyecto en Inicio).
2. En la columna izquierda, pestaña **Imágenes**, arrastra imágenes al timeline o pulsa **+**. **Subir** trae fotos de tu PC.
3. Haz clic en un clip y edítalo a la derecha: duración, movimiento, filtro, transición y texto.
4. Arrastra los clips para reordenarlos y el borde derecho para cambiar su duración.
5. Suelta voces en la pista **VOZ** y música en **MÚSICA**.
6. Pulsa **Espacio** para ver la vista previa y **Exportar** para descargar el MP4.` },
    { id: 'editor.clip', sec: 'editor', t: 'Ajustar un clip: duración, movimiento, filtro, transición, texto', k: 'clip duracion movimiento filtro transicion texto encuadre inspector aplicar a todos editar clip imagen ken burns',
      a: `Selecciona un clip y usa el panel derecho:
- **Duración (segundos)** del clip.
- **Encuadre**: cómo se ajusta la imagen al cuadro.
- **Movimiento**: Estático, Ken Burns, Acercar, Alejar o Paneo (← → ↑ ↓), con **Intensidad**.
- **Filtro** de color y **Transición** (con su **Duración de la transición**).
- **Texto** en pantalla con **Estilo** (Subtítulo, Título central, Rótulo inferior) y **Animación**.
**Aplicar a todos** copia ese ajuste a todos los clips. También puedes **Duplicar**, **Cambiar** la imagen o moverla con ← →.` },
    { id: 'editor.audio', sec: 'editor', t: 'Agregar voz y música al video', k: 'audio voz musica pista agregar narracion cancion volumen empieza en fondo sonido locucion',
      a: `1. En la columna izquierda abre la pestaña **Audio** (o pulsa **Audio** en la barra).
2. Pulsa **+** en un audio para añadirlo, o arrástralo a la pista **VOZ** o **MÚSICA**.
3. Haz clic en la pista para ajustar: **Tipo de pista**, **Volumen** y **Empieza en (segundos)**.
La música se repite y baja al final automáticamente.
Los audios los creas en [[#/voces|Voces]] o los subes a la [[#/biblioteca|Biblioteca]].` },
    { id: 'editor.ajustar', sec: 'editor', t: 'Que las imágenes duren lo mismo que la narración', k: 'ajustar narracion sincronizar duracion uniforme imagenes voz igual tiempo cuadrar',
      a: `1. Pon la narración en la pista **VOZ**.
2. Pulsa el botón del reloj **Ajustar a narración**: los clips pasan a durar lo mismo que la voz.
Si prefieres que todos duren igual, usa **Duración uniforme** (el icono de tijeras).` },
    { id: 'editor.atajos', sec: 'editor', t: 'Atajos de teclado del Editor', k: 'atajos teclado deshacer rehacer eliminar espacio reproducir mover flechas ctrl z',
      a: `- **Espacio**: reproducir / pausar.
- **Ctrl+Z**: deshacer. **Ctrl+Y** (o Ctrl+Shift+Z): rehacer.
- **Supr**: eliminar el elemento seleccionado.
- **← →**: moverse 1 segundo (con **Shift**, 5 segundos).` },
    { id: 'editor.exportar', sec: 'editor', t: 'Exportar desde el Editor: FPS, marca de agua y formato', k: 'exportar editor fps marca de agua nombre canal barras progreso 1080 formato proyecto',
      a: `1. En el Editor pulsa **Exportar** (arriba a la derecha).
2. En el proyecto puedes poner **FPS de exportación** (24, 30 o 60) y una **Marca de agua / nombre del canal**.
3. Elige MP4 o WebM y la calidad, y espera: la grabación es en tiempo real.
Para título, descripción, miniatura y subida a YouTube usa [[#/publicar|Publicar]].` },

    /* ================= FLUJOS ================= */
    { id: 'flujos.usar', sec: 'flujos', t: 'Usar los flujos de agentes', k: 'flujo flujos agentes plantilla ejecutar guionista director visual locutor nodos cadena automatizar',
      a: `1. En [[#/flujos|Flujos y agentes]] elige una plantilla a la izquierda: **Video YouTube narrado**, **Short / TikTok viral**, **Historia / cuento**, **Top / Listado**, **Mini documental** o **Presentación con música**.
2. Haz clic en el nodo **Idea** y escribe de qué trata el video (también duración, formato, tono e idioma).
3. Opcional: haz clic en cualquier agente para cambiar su configuración. Los interruptores activan o desactivan **voz**, **música** y **SEO**.
4. Pulsa **Ejecutar flujo** y mira el progreso en vivo. Cada agente pasa su resultado al siguiente.
5. Al terminar se exporta el MP4 y se abre [[#/publicar|Publicar]].
**Guardar** deja el flujo en **Mis flujos** para reutilizarlo.` },
    { id: 'flujos.agentes', sec: 'flujos', t: 'Qué hace cada agente y qué se configura', k: 'agente guionista director visual locutor musica editor seo configuracion voz estilo transiciones subtitulos',
      a: `- **Idea**: tema, duración, formato, tono e idioma.
- **Guionista**: escribe las escenas (con Claude u OpenAI).
- **Director visual**: crea una imagen por escena. Configuras estilo y calidad.
- **Locutor**: genera la narración (proveedor, voz, instrucciones de tono y velocidad).
- **Música**: elige una canción de la biblioteca y su volumen.
- **Editor**: monta con transiciones, movimiento, filtro y subtítulos.
- **SEO**: crea título, descripción y etiquetas (puedes dar palabras clave).
- **Salida**: nombre del proyecto y si exporta el MP4 solo.` },

    /* ================= GUIONES ================= */
    { id: 'guiones.crear', sec: 'guiones', t: 'Escribir un guion y convertirlo en video', k: 'guion guiones escribir escenas narracion tono publico idioma generar video completo texto libreto',
      a: `1. En [[#/guiones|Guiones]] escribe el **tema**, la **duración**, el **tono** y el **idioma** (y opcionalmente cuántas escenas; 0 = automático).
2. Pulsa **Escribir guion**.
3. Revisa cada escena y corrige la **Narración**, el **Prompt de imagen** y el **Texto en pantalla**. Puedes **Añadir escena** o quitar una.
4. Pulsa **Generar video completo**: se crean las imágenes y la voz, se monta y se exporta.
Tip: **Enviar a Voces** lleva toda la narración al estudio de voz, y **Copiar** copia el guion.` },

    /* ================= IMÁGENES ================= */
    { id: 'imagenes.generar', sec: 'imagenes', t: 'Generar imágenes con IA', k: 'imagen imagenes generar crear foto escena fondo prompt describir ia dibujar estilo calidad cantidad',
      a: `1. En [[#/imagenes|Imágenes]], describe la imagen en español o inglés. **Mejorar prompt con IA** la deja más detallada.
2. Elige **estilo visual** (Cinematográfico, Fotorrealista, Ilustración, Anime, Animación 3D, Acuarela, Épico fantasía, Cyberpunk neón, Minimalista, Documental).
3. Elige **formato** (horizontal para YouTube, vertical para Shorts, cuadrado), **calidad** y **cantidad**.
4. Pulsa **Generar imágenes**. Se guardan solas en la [[#/biblioteca|Biblioteca]].
5. Pasa el ratón por una imagen y pulsa **+ Editor** para usarla en tu video.
Tip: calidad **Media** es la mejor relación calidad/precio.` },

    /* ================= VOCES ================= */
    { id: 'voces.generar', sec: 'voces', t: 'Crear una narración (voz)', k: 'voz voces narracion locucion generar audio texto a voz openai elevenlabs narrar tts hablar',
      a: `1. En [[#/voces|Voces]] elige el proveedor: **OpenAI** (rápido y económico) o **ElevenLabs** (voces premium).
2. Pega el **texto a narrar** y elige la **voz**. En OpenAI puedes escribir la **Dirección de voz** (tono, emoción, ritmo) y la **Velocidad**.
3. Pulsa **Generar voz**. El audio se guarda en la [[#/biblioteca|Biblioteca]].
4. Pulsa **+ Voz** para añadirlo al video, o **+ Música** si es una canción.
Los textos largos se generan por partes y se unen solos.
La opción **Navegador (gratis)** solo sirve para **escuchar una prueba**; no crea un audio para el video.` },
    { id: 'voces.eleven', sec: 'voces', t: 'Usar voces de ElevenLabs', k: 'elevenlabs eleven voces premium voice id estabilidad similitud clonada clonar voz propia',
      a: `1. Pon tu clave de ElevenLabs en [[#/integraciones|Integraciones API]].
2. En [[#/voces|Voces]] elige **ElevenLabs**, pulsa **Cargar** para traer tus voces y elige una.
3. Ajusta **Estabilidad**, **Similitud** y **Velocidad**, y pulsa **Generar voz**.
**copiar** guarda el Voice ID para pegarlo en el agente Locutor de tus flujos.` },

    /* ================= EFECTOS ================= */
    { id: 'efectos.catalogo', sec: 'efectos', t: 'Qué transiciones, filtros y movimientos hay', k: 'efectos transiciones filtros movimientos textos animaciones lista cuales hay catalogo disponible glitch zoom',
      a: `En [[#/efectos|Efectos y transiciones]]:
- **14 transiciones**: Corte directo, Disolver, Fundido a negro, Destello blanco, Deslizar (← → ↑), Zoom de impacto, Barrido, Círculo, Desenfoque, Giro, Persianas y Glitch.
- **8 movimientos**: Estático, Ken Burns, Acercar, Alejar y Paneo en 4 direcciones.
- **10 filtros**: Original, Cinemático, Cálido, Frío, Vívido, Dramático, Vintage, Suave, Blanco y negro y Noir.
- **Textos**: 3 estilos (Subtítulo, Título central, Rótulo inferior) y 5 animaciones (Aparecer, Subir, Máquina de escribir, Rebote, Sin animación).` },
    { id: 'efectos.aplicar', sec: 'efectos', t: 'Aplicar un efecto o crear mi propio filtro', k: 'aplicar efecto clip todos crear filtro propio guardar color vineta personalizado',
      a: `1. Abre un proyecto en el [[#/editor|Editor]] y, si quieres, selecciona un clip.
2. En [[#/efectos|Efectos y transiciones]] elige la pestaña (transiciones, filtros, movimientos o textos).
3. Pulsa **Clip** para aplicarlo solo al clip seleccionado, o **Todos** para todo el video.
Para tu propio filtro: en **Crear filtro** ajusta los controles de color y pulsa **Guardar filtro**. Queda en **Mis filtros**.` },

    /* ================= BIBLIOTECA ================= */
    { id: 'biblioteca.usar', sec: 'biblioteca', t: 'Subir y usar archivos de la Biblioteca', k: 'biblioteca subir archivos imagenes audios musica arrastrar renombrar descargar eliminar mp3 wav guardar',
      a: `1. En [[#/biblioteca|Biblioteca]] pulsa **Subir archivos** o arrástralos al recuadro. Acepta imágenes y audios (mp3, wav, ogg, m4a, aac, flac).
2. Cada archivo tiene botones: **+ Editor**, **+ Voz** o **+ Música** (para añadirlo al video), **Ver**, **Renombrar**, **Descargar** y **Eliminar**.
Tip: sube tu **música de fondo**: el Modo automático la usa en tus videos.
Todo se guarda en tu cuenta y aparece en tus otros dispositivos.` },

    /* ================= PUBLICAR ================= */
    { id: 'publicar.proceso', sec: 'publicar', t: 'Publicar un video paso a paso', k: 'publicar subir youtube titulo descripcion etiquetas miniatura seo capitulos plataforma tiktok shorts reels',
      a: `1. En [[#/publicar|Publicar]] elige la **plataforma** (YouTube, Shorts, TikTok, Reels…). Si el formato no coincide, pulsa **Cambiar el proyecto a…**.
2. Pulsa **Exportar** (si usaste el Modo automático, ya está exportado).
3. Pulsa **Generar con IA** para el título, la descripción y las etiquetas. **Insertar capítulos** los añade solos.
4. Elige la **Visibilidad** (Privado, No listado o Público) y la **Categoría**.
5. Crea la **miniatura** (estilo Impacto, Limpio o Lateral, con su texto) y descárgala en **PNG 1280×720**.
6. Sube a YouTube: **Conectar y subir** si conectaste Google, o sube el MP4 descargado en YouTube Studio.` },
    { id: 'publicar.youtube', sec: 'publicar', t: 'Subir directo a YouTube (Client ID de Google)', k: 'youtube subir directo client id google oauth canal conectar cuenta autorizar credencial',
      a: `Para subir directo necesitas una vez el **Client ID de Google**:
1. En console.cloud.google.com crea un proyecto y habilita **YouTube Data API v3**.
2. Configura la pantalla de consentimiento (tipo Externo) y añade tu correo como usuario de prueba.
3. Credenciales → Crear → **ID de cliente OAuth** → tipo **Aplicación web**.
4. En **Orígenes de JavaScript autorizados** pon la dirección donde usas FRAMALY.
5. Pega el Client ID en [[#/integraciones|Integraciones API]] → YouTube y pulsa **Conectar**.
Después, en [[#/publicar|Publicar]], pulsa **Conectar y subir**. Si no quieres configurarlo, descarga el MP4 y súbelo en YouTube Studio.` },
    { id: 'publicar.miniatura', sec: 'publicar', t: 'Crear la miniatura', k: 'miniatura portada thumbnail png fondo texto impacto limpio lateral youtube imagen portada',
      a: `1. En [[#/publicar|Publicar]], baja a **Miniatura**.
2. Escribe el **Texto de la miniatura** y elige el estilo: **Impacto**, **Limpio** o **Lateral**.
3. Elige el fondo: una imagen tuya o **Fondo con IA**.
4. Pulsa **PNG 1280×720** para descargarla. Es el tamaño que pide YouTube.` },

    /* ================= INTEGRACIONES ================= */
    { id: 'integraciones.claves', sec: 'integraciones', t: 'Conectar las claves de IA (OpenAI, Claude, ElevenLabs)', k: 'integraciones claves api key openai claude anthropic elevenlabs conectar probar modelo token credencial',
      a: `1. En [[#/integraciones|Integraciones API]] busca la tarjeta del proveedor.
2. **OpenAI** (imprescindible): en platform.openai.com → API keys → Create new secret key. Pega la clave y pulsa **Probar**.
3. **Claude** (opcional, para guiones): en console.anthropic.com → API keys. Si no la pones, se usa OpenAI.
4. **ElevenLabs** (opcional): elevenlabs.io → tu perfil → API key.
5. Si quieres, cambia el **Modelo** de cada proveedor.
Las claves propias se guardan **solo en este navegador** y se envían directo a cada proveedor. No se suben a la nube.
Si tu cuenta usa la **clave de FRAMALY**, no necesitas ninguna: la IA ya viene conectada.` },

    { id: 'integraciones.compartida', sec: 'integraciones', t: 'Usar la IA con la clave de FRAMALY (sin poner mi clave)', k: 'clave compartida framaly sin clave no veo clave cupo tope diario limite gasto usar ia sin configurar listo para usar',
      a: `Si tu cuenta usa la **clave de FRAMALY**, no tienes que configurar nada:
1. En [[#/integraciones|Integraciones API]] verás cada IA con la etiqueta **Listo para usar**.
2. Úsalas normalmente: guiones, imágenes y voces funcionan sin pegar ninguna clave.
3. Cada persona tiene un **tope diario**. La barra de la tarjeta muestra cuánto llevas hoy.
4. Si llegas al tope, verás un aviso y podrás seguir al día siguiente.
Si una IA aparece como **No habilitada**, pídele a quien administra FRAMALY que te la active.` },
    { id: 'ajustes.ia', sec: 'ajustes', t: 'Elegir con qué clave trabaja cada persona y preparar correos (administrador)', k: 'personas ia clave de framaly que ponga la suya sin ia modo api tope diario preparar correo invitar permisos administrador cuenta nueva',
      a: `En [[#/ajustes|Ajustes]] → **Personas con acceso** (solo administrador):
1. Pulsa **Permisos** en una persona. Abajo, en **IA: ¿con qué clave trabaja?**, elige para cada API (Claude, OpenAI, ElevenLabs): **Clave de FRAMALY**, **Que ponga la suya** o **Sin IA**.
2. Con **Clave de FRAMALY** la persona usa tu clave sin verla y cuenta para tus límites. Con **Que ponga la suya** verá Integraciones API para pegar la suya.
3. Ajusta el **Tope diario** (en dólares) que esa persona puede gastar con tu clave.
**Preparar un correo:** escribe el correo en **Preparar acceso** y deja sus permisos antes de que se registre. Si entra con Google queda aprobado al instante; si usa contraseña queda pendiente con sus ajustes ya cargados y tú pulsas **Aprobar**.` },
    { id: 'integraciones.limites', sec: 'integraciones', t: 'Límites de gasto, consumo y avisos (administrador)', k: 'limite mensual gasto consumo tokens avisos campanita campana notificacion notificaciones para que sirve la campanita presupuesto cuanto se ha gastado barra porcentaje alerta',
      a: `Solo lo ve quien administra FRAMALY, en [[#/integraciones|Integraciones API]]:
1. Cada API tiene su tarjeta con lo gastado este mes, una **barra de progreso** y el detalle (tokens, imágenes o caracteres).
2. Escribe el **Límite mensual (US$)** y pulsa **Guardar**. Al llegar al límite, esa IA se pausa para las personas que usan la clave de FRAMALY.
3. Elige **Avisarme al llegar a** 80 %, 90 % o 100 %.
4. La **campanita** de arriba muestra los avisos sin leer: una API cerca de su límite, que se agotó, o que una persona llegó a su tope diario. **Marcar todo como leído** limpia el contador.
5. Abajo ves el **consumo por persona**.
Los montos son **estimados** a partir de los precios de cada proveedor.` },

    /* ================= AJUSTES ================= */
    { id: 'ajustes.generales', sec: 'ajustes', t: 'Qué se puede cambiar en Ajustes', k: 'ajustes preferencias configuracion cambiar formato duracion estilo fps calidad visibilidad idioma tono voz',
      a: `En [[#/ajustes|Ajustes]], cada cambio se guarda solo:
- **Mi cuenta**: tu correo, **Sincronizar ahora** y **Cerrar sesión**.
- **Ejecución de videos**: formato, duración y estilo con los que arranca el Modo automático, si exporta solo y los **FPS** de proyectos nuevos.
- **Exportación y publicación**: formato de archivo, calidad y visibilidad en YouTube.
- **Agentes de IA**: proveedor de texto, idioma y tono de los guiones, voz por defecto y calidad/tamaño de imágenes.
- **Datos**: espacio usado, copia de seguridad, vaciar la biblioteca y borrar todo de este dispositivo.
- **Ayuda**: ver el tutorial otra vez.` },
    { id: 'ajustes.copia', sec: 'ajustes', t: 'Copia de seguridad: descargar e importar proyectos', k: 'copia seguridad backup descargar importar proyectos respaldo exportar json restaurar',
      a: `1. En [[#/ajustes|Ajustes]] → **Datos y copia de seguridad**, pulsa **Descargar mis proyectos**: se guarda un archivo con tus proyectos.
2. Para recuperarlos, pulsa **Importar proyectos** y elige ese archivo.
El archivo guarda los proyectos; las imágenes y audios viajan con tu cuenta en la nube.` },
    { id: 'ajustes.personas', sec: 'ajustes', t: 'Aprobar personas y dar permisos (administrador)', k: 'personas aprobar rechazar permisos acceso administrador invitar usuarios quitar acceso pendiente quien puede entrar',
      a: `Solo lo ve quien administra FRAMALY, en [[#/ajustes|Ajustes]] → **Personas con acceso**:
1. Quien se registra aparece como **Pendiente**. Pulsa **Aprobar** para dejarlo entrar o **Rechazar**.
2. Pulsa **Permisos** en una persona y marca o desmarca las secciones que puede usar (por ejemplo, quitar **Integraciones API**).
3. **Quitar acceso** bloquea a una persona ya aprobada.
Los cambios le llegan en un minuto, sin que vuelva a entrar. El menú lateral avisa cuántas personas hay por aprobar.` },
  ];
})();
