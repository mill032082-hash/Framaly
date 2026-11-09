/* FRAMALY — Sección «Plantillas»: catálogo de plantillas para todo tipo de videos con IA
   + «Agregar plantilla»: sube capturas o un video de referencia y la IA los analiza (lee el texto y la imagen)
   para armar una plantilla propia. Las recetas del método de la skill viven en la segunda pestaña. */
(function () {
  'use strict';
  const I = F.icon, esc = F.esc, V = F.views, R = F.R;
  const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem('framaly.' + k) || '{}') }; } catch (e) { return { ...d }; } };
  const store = (k, v) => { try { localStorage.setItem('framaly.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };

  /* escena: [rol, segundos, qué se dice/muestra, prompt de imagen (inglés), texto en pantalla] */
  const S = (r, d, g, p, t = '') => ({ r, d, g, p, t });
  const T = (id, cat, n, d, o, scenes) => ({ id, cat, n, d, aspect: '9:16', tone: 'enérgico estilo viral', filter: 'cine', trans: 'fade', tstyle: 'subtitulo', tanim: 'words', color: '#ffffff', motion: 'kenburns', music: 'Música de fondo, −12 dB cuando hay voz', ...o, scenes });

  const CATS = ['Ventas', 'Contenido', 'Historias', 'Negocio', 'Redes'];
  const BASE = [
    /* ---- Ventas ---- */
    T('cod', 'Ventas', 'Anuncio de venta (COD)', 'Anuncio corto para Meta/TikTok: gancho, problema, producto, prueba y oferta.', { dur: 35, filter: 'vivo', trans: 'flash', color: '#ffd400' }, [
      S('Gancho', 3, 'Una frase que frena el scroll: el problema en una línea.', 'close-up of a frustrated person, dramatic light, vertical', 'EL PROBLEMA'),
      S('Problema', 6, 'Cuenta el problema como lo vive tu cliente.', 'everyday scene showing the problem, realistic'),
      S('Producto', 7, 'Presenta el producto real y qué hace.', 'product hero shot on clean background, soft light', 'EL PRODUCTO'),
      S('Prueba', 8, 'Resultado, demostración o testimonio breve.', 'happy customer using the product, natural light'),
      S('Oferta', 6, 'Precio, bonos y garantía. Sin claims prohibidos.', 'product with bold offer badge, bright colors', 'OFERTA'),
      S('Llamado a la acción', 5, 'Una sola acción clara: pide ahora, pago al recibir.', 'hand pressing order button on phone, close-up', 'PÍDELO YA')]),
    T('flash', 'Ventas', 'Oferta flash / promoción', 'Promoción por tiempo limitado con cuenta regresiva.', { dur: 20, filter: 'vivo', trans: 'glitch', tstyle: 'titulo', tanim: 'pop', color: '#ff3b30' }, [
      S('Alerta', 3, 'Anuncia la oferta con urgencia.', 'bold red sale background, abstract', 'SOLO HOY'),
      S('Producto', 5, 'Muestra el producto o servicio en oferta.', 'product on podium, studio light'),
      S('Descuento', 5, 'El descuento y el precio final.', 'big discount number graphic, high contrast', '-50%'),
      S('Urgencia', 4, 'Fecha límite o unidades limitadas.', 'countdown clock close-up, dramatic', 'ÚLTIMAS UNIDADES'),
      S('Cierre', 3, 'Cómo comprar.', 'smartphone with checkout screen', 'COMPRA AHORA')]),
    T('testi', 'Ventas', 'Testimonio de cliente', 'Reseña real que genera confianza.', { dur: 30, tone: 'emotivo y narrativo', filter: 'calido', trans: 'fade', color: '#ffffff' }, [
      S('Cliente', 4, 'Quién es y qué problema tenía.', 'portrait of a smiling customer, natural window light'),
      S('Antes', 6, 'Cómo era su situación antes.', 'person looking worried at home, soft light'),
      S('Descubrimiento', 6, 'Cómo conoció el producto.', 'person opening a package with curiosity'),
      S('Resultado', 8, 'Qué cambió, con detalles concretos y reales.', 'person happy using the product, bright'),
      S('Recomendación', 6, 'Frase final del cliente y llamado a la acción.', 'customer giving thumbs up, warm light', 'LO RECOMIENDO')]),
    T('unbox', 'Ventas', 'Unboxing / primera impresión', 'Abrir el producto y mostrar lo que trae.', { dur: 30, tone: 'humorístico y cercano', filter: 'vivo' }, [
      S('Caja cerrada', 3, 'Genera expectativa.', 'sealed package on table, top view', 'UNBOXING'),
      S('Abriendo', 6, 'Cómo llega y qué se siente.', 'hands opening a cardboard box, close-up'),
      S('Contenido', 8, 'Muestra cada cosa que trae.', 'flat lay of product contents, clean background'),
      S('Detalle', 7, 'Un detalle que enamora.', 'macro detail of the product, shallow depth of field'),
      S('Veredicto', 6, 'Opinión honesta y a quién se lo recomiendas.', 'person holding product toward camera, smiling')]),
    T('antes', 'Ventas', 'Antes y después', 'Transformación visible con contraste fuerte.', { dur: 25, filter: 'drama', trans: 'wipe', tstyle: 'titulo', tanim: 'pop' }, [
      S('Gancho', 3, 'Promete el cambio.', 'split screen concept, dramatic', 'MIRA EL CAMBIO'),
      S('Antes', 6, 'La situación inicial, sin adornos.', 'dull and messy situation, desaturated', 'ANTES'),
      S('Proceso', 6, 'Qué se hizo (producto o método).', 'time-lapse feeling of work in progress'),
      S('Después', 7, 'El resultado final, claro y real.', 'bright polished result, vivid colors', 'DESPUÉS'),
      S('Cierre', 3, 'Cómo lograr lo mismo.', 'call to action screen, minimal', 'EMPIEZA HOY')]),
    T('prob', 'Ventas', 'Problema → solución', 'Demostración clásica de producto.', { dur: 40, tone: 'informativo y entretenido' }, [
      S('Problema', 6, 'Plantea un problema cotidiano.', 'person struggling with a common task'),
      S('Agitar', 6, 'Haz sentir lo que cuesta no resolverlo.', 'close-up frustrated face, moody light'),
      S('Solución', 8, 'Presenta el producto como la salida.', 'product revealed with soft glow'),
      S('Cómo funciona', 10, 'Tres pasos simples.', 'step by step hands demonstration, clean', '3 PASOS'),
      S('Beneficios', 6, 'Lo que gana el cliente.', 'happy lifestyle scene'),
      S('Oferta y cierre', 4, 'Oferta y llamado a la acción.', 'offer banner on product photo', 'PÍDELO')]),
    T('promo-serv', 'Ventas', 'Promoción de servicio', 'Para servicios: qué haces, para quién y cómo contratarte.', { dur: 40, aspect: '16:9', tone: 'educativo y claro', filter: 'suave' }, [
      S('Gancho', 4, 'La pregunta que se hace tu cliente.', 'professional at work, bright office'),
      S('Qué ofreces', 8, 'Tu servicio en una frase.', 'service in action, candid'),
      S('Para quién', 8, 'A quién ayudas y cómo.', 'diverse clients smiling'),
      S('Proceso', 10, 'Cómo trabajas, en pasos.', 'workflow illustration, clean'),
      S('Contacto', 10, 'Cómo contratarte.', 'phone and laptop with contact details', 'ESCRÍBENOS')]),
    /* ---- Contenido ---- */
    T('tuto', 'Contenido', 'Tutorial paso a paso', 'Enseña algo en pasos claros.', { dur: 60, aspect: '16:9', tone: 'educativo y claro', filter: 'none', trans: 'slideL', tstyle: 'inferior', tanim: 'fade' }, [
      S('Introducción', 6, 'Qué vas a lograr al final.', 'finished result preview, clean desk'),
      S('Materiales', 8, 'Qué se necesita.', 'flat lay of tools and materials'),
      S('Paso 1', 10, 'Primer paso, con un detalle clave.', 'hands performing step one, close-up', 'PASO 1'),
      S('Paso 2', 10, 'Segundo paso.', 'hands performing step two, close-up', 'PASO 2'),
      S('Paso 3', 10, 'Tercer paso y error común a evitar.', 'hands performing step three, close-up', 'PASO 3'),
      S('Resultado', 8, 'Muestra el resultado y pide suscripción.', 'finished result, bright light'),
      S('Cierre', 8, 'Siguiente video o recurso.', 'end screen background, minimal')]),
    T('top5', 'Contenido', 'Top 5 / lista', 'Lista numerada, ideal para retención.', { dur: 45, tstyle: 'titulo', tanim: 'pop', filter: 'vivo' }, [
      S('Gancho', 4, 'Promete la lista y el mejor al final.', 'bold typography background', 'TOP 5'),
      S('Número 5', 7, 'El quinto con una razón.', 'illustration for item five', '5'),
      S('Número 4', 7, 'El cuarto.', 'illustration for item four', '4'),
      S('Número 3', 7, 'El tercero.', 'illustration for item three', '3'),
      S('Número 2', 7, 'El segundo.', 'illustration for item two', '2'),
      S('Número 1', 9, 'El primero, el mejor, con la mayor razón.', 'hero illustration for item one, glowing', '1'),
      S('Cierre', 4, 'Pregunta para comentarios.', 'speech bubbles, minimal', '¿Y TÚ CUÁL ELEGIRÍAS?')]),
    T('explain', 'Contenido', 'Explicativo (explainer)', 'Explica un tema complejo de forma simple.', { dur: 75, aspect: '16:9', tone: 'educativo y claro', filter: 'suave', trans: 'fade', tstyle: 'inferior', tanim: 'fade' }, [
      S('Pregunta', 8, 'Plantea la pregunta del tema.', 'curious concept illustration'),
      S('Contexto', 12, 'Por qué importa.', 'infographic style scene'),
      S('Idea clave', 15, 'La explicación sencilla, con analogía.', 'metaphor illustration, clean colors'),
      S('Ejemplo', 15, 'Un ejemplo de la vida real.', 'real life example scene'),
      S('Error común', 10, 'Lo que casi todos creen mal.', 'warning sign concept'),
      S('Resumen', 10, 'La idea en una frase.', 'summary board, minimal', 'RESUMEN'),
      S('Cierre', 5, 'Invita a seguir.', 'subscribe end card')]),
    T('noticia', 'Contenido', 'Noticia / resumen rápido', 'Lo que pasó, por qué importa y qué sigue.', { dur: 40, tone: 'informativo y entretenido', filter: 'frio', tstyle: 'inferior', tanim: 'up' }, [
      S('Titular', 4, 'El hecho en una frase.', 'news style graphic background', 'ÚLTIMA HORA'),
      S('Qué pasó', 10, 'Los hechos, sin opinión.', 'documentary style image of the event'),
      S('Por qué importa', 10, 'Impacto para tu audiencia.', 'people affected, realistic'),
      S('Qué sigue', 8, 'Lo que se espera.', 'road ahead concept, horizon'),
      S('Cierre', 8, 'Pregunta o invitación a comentar.', 'speech bubbles minimal')]),
    T('mitos', 'Contenido', 'Mitos y verdades', 'Desmiente creencias comunes.', { dur: 40, tone: 'informativo y entretenido', tstyle: 'titulo', tanim: 'pop', filter: 'vivo' }, [
      S('Gancho', 4, 'Lo que todos creen.', 'question mark big, bold', '¿MITO O VERDAD?'),
      S('Mito 1', 9, 'La creencia y por qué falla.', 'myth illustration crossed out', 'MITO'),
      S('Verdad 1', 9, 'Lo que sí es cierto.', 'truth illustration with check mark', 'VERDAD'),
      S('Mito 2', 9, 'Otra creencia común.', 'second myth illustration', 'MITO'),
      S('Cierre', 9, 'Resumen y llamado a seguir.', 'minimal closing card')]),
    T('tips', 'Contenido', 'Consejo del día / tips', 'Tres consejos rápidos y accionables.', { dur: 30, tone: 'enérgico estilo viral', filter: 'calido', tstyle: 'titulo', tanim: 'pop' }, [
      S('Gancho', 3, 'Promete 3 consejos.', 'bold number three typography', '3 CONSEJOS'),
      S('Consejo 1', 8, 'El primero, con ejemplo.', 'illustration for tip one', '1'),
      S('Consejo 2', 8, 'El segundo.', 'illustration for tip two', '2'),
      S('Consejo 3', 8, 'El tercero.', 'illustration for tip three', '3'),
      S('Cierre', 3, 'Guarda el video y sigue.', 'save icon on gradient', 'GUÁRDALO')]),
    T('qa', 'Contenido', 'Pregunta y respuesta', 'Responde una pregunta de tu audiencia.', { dur: 35, tone: 'humorístico y cercano', filter: 'suave', tstyle: 'inferior' }, [
      S('Pregunta', 5, 'Lee la pregunta tal cual llegó.', 'chat bubble with question, clean', 'PREGUNTA'),
      S('Respuesta corta', 8, 'Responde en una frase.', 'person answering to camera, natural'),
      S('Explicación', 14, 'El porqué, con un ejemplo.', 'explanatory scene, bright'),
      S('Cierre', 8, 'Invita a mandar más preguntas.', 'chat bubbles minimal')]),
    /* ---- Historias ---- */
    T('story', 'Historias', 'Storytelling emotivo', 'Una historia con inicio, conflicto, giro y cierre.', { dur: 60, aspect: '16:9', tone: 'emotivo y narrativo', filter: 'calido', trans: 'fade', tstyle: 'inferior', tanim: 'fade', motion: 'kenburns' }, [
      S('Presentación', 10, 'Personaje y mundo.', 'cinematic portrait of the main character, golden hour'),
      S('Conflicto', 12, 'Lo que se rompe o se complica.', 'tense cinematic scene, moody'),
      S('Intento', 12, 'Lo que prueba y falla.', 'character struggling, dramatic light'),
      S('Giro', 12, 'El momento que lo cambia todo.', 'turning point scene, strong contrast'),
      S('Cierre', 14, 'Lección o emoción final.', 'hopeful ending scene, warm light')]),
    T('curio', 'Historias', 'Misterio / curiosidades', 'Datos que enganchan y revelan algo al final.', { dur: 50, tone: 'misterioso e intrigante', filter: 'drama', trans: 'blur', tstyle: 'titulo', tanim: 'type', color: '#e0c36a' }, [
      S('Gancho', 5, 'Una pregunta que nadie sabe responder.', 'mysterious foggy scene, cinematic', '¿SABÍAS QUE…?'),
      S('Dato 1', 10, 'El primer dato sorprendente.', 'archival style image, sepia'),
      S('Dato 2', 10, 'Sube la intriga.', 'dark atmospheric scene'),
      S('Dato 3', 10, 'El más raro.', 'surreal cinematic scene'),
      S('Revelación', 15, 'La respuesta o el giro final.', 'dramatic reveal, strong light beam')]),
    T('doc', 'Historias', 'Mini documental / historia real', 'Hechos reales con estilo documental.', { dur: 90, aspect: '16:9', tone: 'informativo y entretenido', filter: 'vintage', trans: 'fade', tstyle: 'inferior', tanim: 'fade' }, [
      S('Apertura', 10, 'Escena que sitúa lugar y época.', 'documentary establishing shot, film grain'),
      S('Contexto', 15, 'Quién y por qué importa.', 'historical style photo'),
      S('Desarrollo', 25, 'Hechos en orden.', 'documentary scenes, handheld feel'),
      S('Punto crítico', 20, 'El momento clave.', 'dramatic documentary moment'),
      S('Consecuencias', 12, 'Qué pasó después.', 'aftermath, quiet scene'),
      S('Cierre', 8, 'Reflexión final.', 'sunset wide shot')]),
    T('terror', 'Historias', 'Terror corto', 'Relato de suspenso en vertical.', { dur: 45, tone: 'misterioso e intrigante', filter: 'noir', trans: 'glitch', tstyle: 'subtitulo', tanim: 'type', color: '#ff2a2a', motion: 'zoomIn' }, [
      S('Calma', 8, 'Todo parece normal.', 'quiet dark house at night, cinematic'),
      S('Señal', 10, 'Algo no cuadra.', 'shadow in a hallway, horror atmosphere'),
      S('Tensión', 12, 'Sube el miedo.', 'dim flashlight in a dark room'),
      S('Susto', 8, 'El momento clave.', 'sudden horror reveal, strong contrast'),
      S('Final abierto', 7, 'Un cierre inquietante.', 'empty room with open door, eerie')]),
    T('motiv', 'Historias', 'Motivacional', 'Frases e imágenes épicas que inspiran.', { dur: 40, tone: 'motivacional e inspirador', filter: 'drama', trans: 'zoom', tstyle: 'titulo', tanim: 'pop', color: '#ffd166', motion: 'zoomIn' }, [
      S('Apertura', 6, 'Una verdad incómoda.', 'lone figure on a mountain at dawn, epic'),
      S('Obstáculo', 8, 'Lo que frena a la gente.', 'storm clouds, dramatic'),
      S('Decisión', 8, 'El momento de elegir.', 'runner at the start line, determined'),
      S('Esfuerzo', 8, 'El trabajo diario.', 'training montage feel, sweat, grit'),
      S('Victoria', 10, 'El resultado y la frase final.', 'triumph on a summit, sunrise', 'NO TE RINDAS')]),
    /* ---- Negocio ---- */
    T('empresa', 'Negocio', 'Presentación de empresa', 'Quiénes somos, qué hacemos y por qué elegirnos.', { dur: 60, aspect: '16:9', tone: 'informativo y entretenido', filter: 'suave', trans: 'slideL', tstyle: 'inferior', tanim: 'fade', motion: 'panR' }, [
      S('Apertura', 8, 'Quiénes son en una frase.', 'modern office exterior, bright'),
      S('Qué hacemos', 14, 'Productos o servicios.', 'team at work, candid'),
      S('Por qué nosotros', 14, 'Diferenciales y resultados.', 'client success scene'),
      S('Equipo', 12, 'Las personas detrás.', 'team portrait, natural light'),
      S('Contacto', 12, 'Cómo hablar con ustedes.', 'handshake close-up, warm light', 'CONTÁCTANOS')]),
    T('evento', 'Negocio', 'Invitación a evento', 'Fecha, lugar, qué habrá y cómo inscribirse.', { dur: 25, tone: 'enérgico estilo viral', filter: 'vivo', trans: 'slideU', tstyle: 'titulo', tanim: 'pop' }, [
      S('Anuncio', 4, 'Nombre del evento.', 'event poster style background', 'GRAN EVENTO'),
      S('Qué habrá', 8, 'Invitados y actividades.', 'crowd and stage lights'),
      S('Fecha y lugar', 6, 'Día, hora y sitio.', 'calendar and map pin graphic', 'FECHA · LUGAR'),
      S('Inscripción', 7, 'Cómo reservar.', 'ticket and phone', 'RESERVA YA')]),
    T('marca', 'Negocio', 'Presentación personal / marca personal', 'Quién eres y qué ofreces.', { dur: 35, tone: 'humorístico y cercano', filter: 'calido' }, [
      S('Saludo', 4, 'Nombre y a qué te dedicas.', 'portrait of a creator, friendly, natural light'),
      S('Historia', 10, 'Cómo empezaste.', 'story scene of the beginning'),
      S('Lo que haces', 10, 'Lo que aportas.', 'work in action, candid'),
      S('Prueba social', 6, 'Resultados o clientes.', 'happy clients collage'),
      S('Invitación', 5, 'Cómo seguirte o contratarte.', 'social media icons on gradient', 'SÍGUEME')]),
    T('inmob', 'Negocio', 'Inmueble / propiedad', 'Recorrido de una propiedad en venta o alquiler.', { dur: 45, aspect: '16:9', tone: 'informativo y entretenido', filter: 'suave', trans: 'slideL', tstyle: 'inferior', tanim: 'up', motion: 'panR' }, [
      S('Fachada', 6, 'Ubicación y precio.', 'house exterior, golden hour, wide shot'),
      S('Sala', 8, 'Espacios sociales.', 'bright modern living room'),
      S('Cocina y baños', 10, 'Detalles que venden.', 'modern kitchen interior'),
      S('Habitaciones', 10, 'Comodidad y espacio.', 'cozy bedroom, natural light'),
      S('Exteriores', 6, 'Terraza, jardín o vista.', 'terrace with view'),
      S('Contacto', 5, 'Cómo agendar visita.', 'keys handover close-up', 'AGENDA TU VISITA')]),
    T('resta', 'Negocio', 'Restaurante / menú', 'Platos estrella y ambiente.', { dur: 25, tone: 'enérgico estilo viral', filter: 'calido', trans: 'flash', tstyle: 'titulo', tanim: 'pop', color: '#ffd166' }, [
      S('Antojo', 4, 'El plato estrella.', 'close-up of a juicy signature dish, steam, macro'),
      S('Ingredientes', 6, 'Frescura y calidad.', 'fresh ingredients on a wooden table'),
      S('Preparación', 6, 'El momento en cocina.', 'chef cooking with flames, dynamic'),
      S('Ambiente', 5, 'El lugar.', 'cozy restaurant interior, warm lights'),
      S('Reserva', 4, 'Dirección y reserva.', 'table set for two, candle', 'RESERVA')]),
    /* ---- Redes ---- */
    T('short', 'Redes', 'Short / Reel de gancho rápido', 'Un solo mensaje, 20 segundos.', { dur: 20, filter: 'vivo', trans: 'zoom', tstyle: 'titulo', tanim: 'pop' }, [
      S('Gancho', 3, 'Una frase que pare el scroll.', 'bold eye-catching visual, vertical'),
      S('Idea', 10, 'El mensaje, en 2 frases.', 'supporting visual, clean'),
      S('Giro', 4, 'Un dato que sorprende.', 'unexpected twist visual'),
      S('Cierre', 3, 'Sígueme / guarda.', 'follow button on gradient', 'SÍGUEME')]),
    T('yt-largo', 'Redes', 'YouTube largo con capítulos', 'Estructura de 8–10 min con retención.', { dur: 480, aspect: '16:9', tone: 'informativo y entretenido', filter: 'cine', trans: 'fade', tstyle: 'inferior', tanim: 'fade', motion: 'kenburns' }, [
      S('Gancho (30 s)', 30, 'Lo que vas a ganar si te quedas.', 'compelling thumbnail style scene'),
      S('Intro (30 s)', 30, 'Quién eres y por qué te creen.', 'host portrait, studio'),
      S('Capítulo 1', 120, 'Primera idea con ejemplo.', 'chapter one visuals'),
      S('Capítulo 2', 120, 'Segunda idea; cambia el encuadre.', 'chapter two visuals'),
      S('Capítulo 3', 120, 'Tercera idea y el giro.', 'chapter three visuals'),
      S('Resumen (30 s)', 30, 'Lo aprendido.', 'summary board'),
      S('Cierre (30 s)', 30, 'Pide suscripción y recomienda otro video.', 'end screen with suggested videos')]),
    T('podcast', 'Redes', 'Clip de podcast / entrevista', 'Un momento destacado con subtítulos grandes.', { dur: 45, tone: 'informativo y entretenido', filter: 'suave', tstyle: 'subtitulo', tanim: 'words', motion: 'zoomIn' }, [
      S('Gancho', 5, 'La frase más fuerte del clip.', 'podcast studio with microphones, moody'),
      S('Contexto', 8, 'La pregunta o el tema.', 'host close-up'),
      S('Respuesta', 25, 'El mejor fragmento, subtitulado.', 'guest speaking, shallow depth of field'),
      S('Cierre', 7, 'Invita al episodio completo.', 'waveform graphic on dark background', 'EPISODIO COMPLETO')]),
    T('trend', 'Redes', 'Tendencia / meme con tu giro', 'Sube a una tendencia con humor.', { dur: 15, tone: 'humorístico y cercano', filter: 'vivo', trans: 'glitch', tstyle: 'titulo', tanim: 'pop' }, [
      S('Setup', 5, 'La situación que todos reconocen.', 'relatable everyday situation, comedic'),
      S('Giro', 6, 'El remate gracioso.', 'exaggerated reaction, comedic'),
      S('Firma', 4, 'Tu marca o usuario.', 'logo placeholder on gradient', '@TUCANAL')]),
  ];

  const mine = () => (F.settings.customTemplates ||= []);
  const all = () => [...mine().map((t) => ({ ...t, cat: 'Mis plantillas', custom: true })), ...BASE];
  const tplText = (t) => `PLANTILLA · ${t.n}\n${t.d || ''}\nFormato ${t.aspect} · duración ≈ ${t.dur} s · tono ${t.tone}\nEstilo: filtro ${t.filter}, transición ${t.trans}, texto ${t.tstyle}/${t.tanim}, color ${t.color}, movimiento ${t.motion}\n${t.music}\n\nESCENAS\n${t.scenes.map((s, i) => `${i + 1}. ${s.r} (${s.d} s)\n   Guion: ${s.g}${s.t ? `\n   Texto en pantalla: ${s.t}` : ''}\n   Prompt de imagen: ${s.p}`).join('\n')}\n\nReglas: sin claims prohibidos, sin ¿ ¡ en pantalla, producto real (no redibujado), español de Colombia.`;

  /* Imagen de relleno por escena (se reemplaza luego con una imagen IA) */
  const placeholder = (t, s, i) => new Promise((res) => {
    const [W, H] = ({ '9:16': [540, 960], '16:9': [960, 540], '1:1': [720, 720], '4:5': [640, 800] })[t.aspect] || [540, 960], c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, W, H), hue = (i * 47 + 20) % 360;
    g.addColorStop(0, `hsl(${hue},45%,22%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360},50%,10%)`); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.92)'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `700 ${Math.round(Math.min(W, H) * 0.075)}px Inter, sans-serif`; x.fillText(`${i + 1} · ${s.r}`.toUpperCase(), W / 2, H * 0.45);
    x.fillStyle = 'rgba(255,255,255,.55)'; x.font = `500 ${Math.round(Math.min(W, H) * 0.035)}px Inter, sans-serif`; x.fillText('Reemplázala con una imagen de IA', W / 2, H * 0.55);
    c.toBlob(res, 'image/png');
  });
  const okId = (list, id, d) => (list.some((x) => x.id === id) ? id : d);

  const crear = async (t) => {
    const p = await F.projects.create(t.n, t.aspect); p.meta = { ...(p.meta || {}), title: t.n };
    for (let i = 0; i < t.scenes.length; i++) {
      const s = t.scenes[i], m = await F.media.add({ type: 'image', name: `${t.n} · ${s.r}`, blob: await placeholder(t, s, i), source: 'template' });
      p.clips.push(F.newClip(m.id, { duration: Math.max(1, Math.min(30, +s.d || 4)), text: s.t || '', textStyle: okId(R.TEXT_STYLES, t.tstyle, 'subtitulo'), textAnim: okId(R.TEXT_ANIMS, t.tanim, 'fade'), textColor: t.color || '#ffffff',
        filter: okId(R.filters(), t.filter, 'none'), transition: okId(R.TRANSITIONS, t.trans, 'fade'), motion: okId(R.MOTIONS, t.motion, 'kenburns') }));
    }
    p.duck = true; const g = (p.golden ||= {}); Object.assign(g, { destinoSet: true, target: 0, receta: tplText(t) });
    await F.projects.save(p); F.toast(`Proyecto «${t.n}» creado con ${t.scenes.length} escenas`, 'ok'); F.router.go('#/editor');
  };
  const aGuion = (t) => {
    const cur = load('script', {});
    store('script', { ...cur, topic: `[ESCRIBE AQUÍ TU TEMA] con la estructura «${t.n}»: ${t.scenes.map((s) => `${s.r} (${s.d} s): ${s.g}`).join(' | ')}`, duration: t.dur, scenes: t.scenes.length, tone: t.tone, aspect: t.aspect, script: undefined });
    F.router.go('#/guiones');
  };
  const copy = (txt) => (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => F.toast('Plantilla copiada', 'ok'), () => F.toast('No se pudo copiar', 'error'));

  /* ---------- Agregar plantilla: lector óptico + análisis con IA ---------- */
  const toB64 = (src, w, h, max = 1024) => { const k = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return { canvas: c, mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.82).split(',')[1] }; };
  const imgFrom = (file) => new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { res(i); URL.revokeObjectURL(u); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('No se pudo leer ' + file.name)); }; i.src = u; });
  const framesFrom = (file, n = 6) => new Promise((res, rej) => {
    const v = document.createElement('video'), u = URL.createObjectURL(file), out = []; v.muted = true; v.preload = 'auto'; v.playsInline = true;
    v.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Este navegador no pudo leer el video.')); };
    v.onloadedmetadata = async () => {
      const d = v.duration; if (!isFinite(d) || !v.videoWidth) return v.onerror();
      for (let i = 0; i < n; i++) { await new Promise((r) => { v.onseeked = r; v.currentTime = Math.min(d - 0.05, (d * (i + 0.5)) / n); }); out.push(toB64(v, v.videoWidth, v.videoHeight)); }
      URL.revokeObjectURL(u); res({ frames: out, duration: d, w: v.videoWidth, h: v.videoHeight });
    };
    v.src = u;
  });

  const SYS = 'Eres un analista de video corto y un lector óptico (OCR). Recibes capturas o fotogramas de un video de referencia. Lee TODO el texto visible, describe el estilo y deduce la estructura por escenas para crear una PLANTILLA reutilizable. Se destila, no se clona: no copies marcas, nombres ni textos de marca ajena; toma la estructura, el ritmo y el estilo. Responde en español.';
  const analizar = async (frames, nota, meta) => {
    const aspects = ['9:16', '16:9', '1:1', '4:5'];
    const prompt = `Analiza estas ${frames.length} imágenes de referencia en orden cronológico.${nota ? `\nLo que el usuario quiere copiar: ${nota}` : ''}${meta?.duration ? `\nDuración real del video de referencia: ${Math.round(meta.duration)} s.` : ''}
Devuelve SOLO este JSON:
{"nombre":"nombre corto de la plantilla","descripcion":"una frase","aspect":"${aspects.join('|')}","duracion":número_de_segundos,"tono":"uno de: informativo y entretenido | misterioso e intrigante | motivacional e inspirador | humorístico y cercano | educativo y claro | épico y dramático | emotivo y narrativo | enérgico estilo viral","texto_leido":["texto exacto que se ve en cada captura (OCR), vacío si no hay"],"estilo":{"filtro":"cine|calido|frio|vivo|drama|vintage|suave|bn|noir|none","transicion":"fade|black|flash|slideL|slideR|slideU|zoom|wipe|circle|blur|spin|blinds|glitch|none","movimiento":"none|kenburns|zoomIn|zoomOut|panL|panR|panU|panD","texto":"subtitulo|titulo|inferior","animacion_texto":"fade|up|words|type|pop|none","color_texto":"#rrggbb"},"musica":"tipo de música y sonido que sugiere","escenas":[{"rol":"gancho/problema/...","segundos":número,"guion":"qué se dice o muestra, genérico y reutilizable","prompt_imagen":"prompt en inglés para generar una imagen parecida SIN marcas","texto_pantalla":"texto corto en pantalla o vacío"}],"notas":"qué hace bien este video"}
Entre 3 y 8 escenas.`;
    const j = await F.api.llmJSON({ system: SYS, prompt, images: frames.map((f) => ({ mime: f.mime, data: f.data })), maxTokens: 3000 });
    return j;
  };

  const normalize = (j, st, fallbackName) => {
    const E = (v, list, d) => (list.includes(v) ? v : d), A = j.estilo || {};
    return {
      id: F.uid(), n: String(j.nombre || fallbackName || 'Mi plantilla').slice(0, 60), d: String(j.descripcion || ''), aspect: E(j.aspect, ['9:16', '16:9', '1:1', '4:5'], '9:16'), dur: Math.max(5, Math.round(+j.duracion || 30)),
      tone: String(j.tono || 'informativo y entretenido'), filter: E(A.filtro, R.filters().map((x) => x.id), st?.filter || 'cine'), trans: E(A.transicion, R.TRANSITIONS.map((x) => x.id), 'fade'), motion: E(A.movimiento, R.MOTIONS.map((x) => x.id), 'kenburns'),
      tstyle: E(A.texto, R.TEXT_STYLES.map((x) => x.id), 'subtitulo'), tanim: E(A.animacion_texto, R.TEXT_ANIMS.map((x) => x.id), 'fade'), color: /^#[0-9a-f]{6}$/i.test(A.color_texto) ? A.color_texto : (st?.textColor || '#ffffff'),
      music: String(j.musica || 'Música de fondo, −12 dB cuando hay voz'), palette: st?.palette || [], ocr: Array.isArray(j.texto_leido) ? j.texto_leido.map(String) : [], notas: String(j.notas || ''),
      scenes: (j.escenas || []).slice(0, 10).map((s) => S(String(s.rol || 'Escena').slice(0, 40), Math.max(1, Math.min(60, Math.round(+s.segundos || 4))), String(s.guion || ''), String(s.prompt_imagen || ''), String(s.texto_pantalla || '').slice(0, 60))),
    };
  };

  V.agregarPlantilla = (onSaved) => {
    const files = [];
    const m = F.modal({ title: 'Agregar plantilla desde una referencia', wide: true,
      body: `<p class="small muted">Sube de 1 a 6 <b>capturas</b> o un <b>video</b> de referencia. La IA lee el texto de cada imagen (lector óptico), analiza el estilo y arma la estructura por escenas. Se destila, no se clona: no se copian marcas ajenas.</p>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" id="tpImg">${I('image')} Subir capturas</button><button class="btn" id="tpVid">${I('film')} Subir video</button><span class="small muted" id="tpInfo">Aún no subiste nada</span></div>
        <div id="tpThumbs" class="row" style="gap:6px;flex-wrap:wrap;margin:10px 0"></div>
        <label class="lbl">¿Qué quieres copiar? (opcional)</label><textarea id="tpNote" rows="2" placeholder="Ej: el ritmo rápido, los subtítulos amarillos y el cierre con oferta"></textarea>
        <div id="tpOut" style="margin-top:12px"></div>`,
      actions: [{ label: 'Cerrar' }, { label: 'Analizar', primary: true, keep: true, onClick: () => { go(); return false; } }] });
    let frames = [], meta = null;
    const q = (s) => m.q(s), info = (t) => (q('#tpInfo').textContent = t);
    const thumbs = () => { q('#tpThumbs').innerHTML = ''; frames.forEach((f) => { f.canvas.style.cssText = 'height:70px;border-radius:6px;border:1px solid var(--line)'; q('#tpThumbs').appendChild(f.canvas); }); info(frames.length ? `${frames.length} imagen(es) listas` : 'Aún no subiste nada'); };
    q('#tpImg').onclick = async () => { const fs = (await F.pickFiles('image/*', true)).slice(0, 6); if (!fs.length) return; frames = []; meta = null; info('Leyendo…'); for (const f of fs) { try { const i = await imgFrom(f); frames.push(toB64(i, i.naturalWidth, i.naturalHeight)); } catch (e) { F.toast(e.message, 'error'); } } thumbs(); };
    q('#tpVid').onclick = async () => { const f = (await F.pickFiles('video/*,.mp4,.mov,.m4v,.webm'))[0]; if (!f) return; info('Sacando fotogramas del video…'); try { const r = await framesFrom(f); frames = r.frames; meta = r; } catch (e) { F.toast(e.message, 'error'); frames = []; } thumbs(); };
    const go = async () => {
      if (!frames.length) return F.toast('Sube primero capturas o un video de referencia');
      const btn = [...m.el.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Analizar'); btn && F.busy(btn, true, 'Analizando…');
      q('#tpOut').innerHTML = '<p class="small muted">Leyendo el texto y analizando el estilo…</p>';
      let st = null; try { st = F.golden.styleFromStats(frames.map((f) => F.golden.analyzeImage(f.canvas))); } catch (e) { /* sin análisis de color */ }
      let t, aiErr = '';
      try { t = normalize(await analizar(frames, q('#tpNote').value.trim(), meta), st); if (!t.scenes.length) throw new Error('La IA no devolvió escenas.'); }
      catch (e) {
        aiErr = e.message;
        t = normalize({ nombre: 'Plantilla de referencia', descripcion: 'Estilo tomado de tus capturas (sin lectura de texto).', aspect: meta ? (meta.w >= meta.h ? '16:9' : '9:16') : '9:16', duracion: meta ? meta.duration : 30, escenas: frames.slice(0, 6).map((_, i) => ({ rol: `Escena ${i + 1}`, segundos: Math.max(2, Math.round(((meta?.duration || 30) / frames.length))), guion: 'Describe lo que se muestra o se dice.', prompt_imagen: '' })) }, st);
      }
      btn && F.busy(btn, false);
      const row = (s, i) => `<div class="pl-sc"><b>${i + 1}</b><input data-k="r" data-i="${i}" value="${esc(s.r)}" style="width:130px"><input data-k="d" data-i="${i}" type="number" min="1" max="60" value="${s.d}" style="width:60px"><input data-k="g" data-i="${i}" value="${esc(s.g)}" style="flex:1" placeholder="Guion"><input data-k="t" data-i="${i}" value="${esc(s.t)}" style="width:150px" placeholder="Texto en pantalla"></div>`;
      q('#tpOut').innerHTML = `${aiErr ? `<p class="hint" style="color:var(--warn,#f59e0b)">La IA no pudo analizar (${esc(aiErr)}). Se guardó solo el estilo de color de tus capturas; edita las escenas a mano o conecta Claude, OpenAI o Gemini en Integraciones API para leer el texto.</p>` : '<p class="small"><b>Listo.</b> Revisa y edita antes de guardar.</p>'}
        <label class="lbl">Nombre</label><input type="text" id="tpName" value="${esc(t.n)}"><p class="small muted">${esc(t.d)}</p>
        <div class="row" style="gap:6px;flex-wrap:wrap"><span class="tag or">${t.aspect}</span><span class="tag">≈ ${t.dur} s</span><span class="tag">Filtro ${esc(t.filter)}</span><span class="tag">Transición ${esc(t.trans)}</span><span class="tag">Texto ${esc(t.tstyle)}</span>${t.palette.map((c) => `<span title="${c}" style="width:18px;height:18px;border-radius:5px;background:${c};border:1px solid var(--line)"></span>`).join('')}</div>
        ${t.ocr.some(Boolean) ? `<label class="lbl">Texto leído de las imágenes (OCR)</label><pre class="codebox pl-txt">${esc(t.ocr.map((x, i) => `${i + 1}. ${x || '—'}`).join('\n'))}</pre>` : ''}
        ${t.music ? `<p class="small"><b>Música:</b> ${esc(t.music)}</p>` : ''}${t.notas ? `<p class="small"><b>Lo que hace bien:</b> ${esc(t.notas)}</p>` : ''}
        <label class="lbl">Escenas (rol · segundos · guion · texto en pantalla)</label><div id="tpSc">${t.scenes.map(row).join('')}</div>
        <button class="btn primary" id="tpSave" style="margin-top:10px">${I('save')} Guardar plantilla</button>`;
      q('#tpOut').oninput = (e) => { const el = e.target, i = +el.dataset.i, k = el.dataset.k; if (k) t.scenes[i][k] = k === 'd' ? Math.max(1, +el.value || 1) : el.value; };
      q('#tpSave').onclick = () => { t.n = q('#tpName').value.trim() || t.n; t.dur = t.scenes.reduce((a, s) => a + s.d, 0) || t.dur; delete t.cat; mine().unshift(t); F.saveSettings(); m.close(); F.toast(`Plantilla «${t.n}» guardada en Mis plantillas`, 'ok'); onSaved?.(); };
    };
  };

  /* ---------- Página ---------- */
  V.plantillas = (el) => {
    const st = load('plTab', { tab: 'cat', cat: 'Todas', q: '' });
    const draw = () => {
      const list = all(), cats = ['Todas', ...(mine().length ? ['Mis plantillas'] : []), ...CATS];
      el.innerHTML = `<div class="page"><div class="page-h row" style="gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:220px"><h1>Plantillas</h1><p class="muted">Plantillas para todo tipo de videos con IA: crea un proyecto con las escenas listas o llévalas al guionista.</p></div><button class="btn primary" id="plAdd">${I('plus')} Agregar plantilla</button></div>
        <div class="seg" id="plTabs" style="margin-bottom:12px"><button data-tab="cat" class="${st.tab === 'cat' ? 'on' : ''}">Plantillas de video (${list.length})</button><button data-tab="skill" class="${st.tab === 'skill' ? 'on' : ''}">Método de la skill</button></div>
        <div id="plBody"></div></div>`;
      const body = el.querySelector('#plBody');
      if (st.tab === 'skill') return V.plantillasSkill(body);
      const qq = st.q.toLowerCase(), shown = list.filter((t) => (st.cat === 'Todas' || t.cat === st.cat) && (!qq || (t.n + ' ' + t.d + ' ' + t.cat).toLowerCase().includes(qq)));
      body.innerHTML = `<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">${cats.map((c) => `<button class="btn sm ${st.cat === c ? 'primary' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}<input type="search" id="plQ" placeholder="Buscar plantilla…" value="${esc(st.q)}" style="max-width:220px;margin-left:auto"></div>
        <div class="pl-grid">${shown.map((t) => `<div class="pl-rec" data-t="${t.id}"><div class="row" style="gap:6px"><b style="flex:1">${esc(t.n)}</b><span class="tag">${esc(t.cat)}</span></div><p class="small">${esc(t.d)}</p>
          <div class="pl-tags"><span class="tag or">${t.aspect}</span><span class="tag">≈ ${t.dur >= 120 ? Math.round(t.dur / 60) + ' min' : t.dur + ' s'}</span><span class="tag">${t.scenes.length} escenas</span></div>
          <details><summary class="small muted" style="cursor:pointer">Ver escenas</summary><ol class="small" style="margin:6px 0 0 18px;padding:0">${t.scenes.map((s) => `<li><b>${esc(s.r)}</b> · ${s.d} s — ${esc(s.g)}</li>`).join('')}</ol></details>
          <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm primary" data-a="make">${I('film')} Crear proyecto</button><button class="btn sm" data-a="script">${I('script')} Guion con IA</button><button class="btn sm" data-a="copy">${I('copy')} Copiar</button>${t.custom ? `<button class="btn sm danger" data-a="del" title="Borrar">${I('trash')}</button>` : ''}</div></div>`).join('') || '<div class="empty" style="padding:40px">No hay plantillas con ese filtro.</div>'}</div>`;
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'plAdd') return V.agregarPlantilla(() => { st.cat = 'Mis plantillas'; st.tab = 'cat'; store('plTab', st); draw(); });
      if (b.dataset.tab) { st.tab = b.dataset.tab; store('plTab', st); return draw(); }
      if (b.dataset.cat) { st.cat = b.dataset.cat; store('plTab', st); return draw(); }
      const card = b.closest('[data-t]'); if (!card || !b.dataset.a) return;
      const t = all().find((x) => x.id === card.dataset.t); if (!t) return;
      if (b.dataset.a === 'make') crear(t).catch((er) => F.toast(er.message, 'error'));
      else if (b.dataset.a === 'script') aGuion(t);
      else if (b.dataset.a === 'copy') copy(tplText(t));
      else if (b.dataset.a === 'del' && confirm(`¿Borrar la plantilla «${t.n}»?`)) { F.settings.customTemplates = mine().filter((x) => x.id !== t.id); F.saveSettings(); draw(); }
    });
    el.addEventListener('input', (e) => { if (e.target.id === 'plQ') { st.q = e.target.value; store('plTab', st); const pos = e.target.selectionStart; draw(); const n = el.querySelector('#plQ'); n?.focus(); n?.setSelectionRange(pos, pos); } });
    draw();
  };
  V.plantillas.catalog = BASE;
})();
