/* FRAMALY — Instrucciones paso a paso por sección + bienvenida */
(function () {
  'use strict';
  const I = F.icon;
  F.HELP = {
    inicio: { t: 'Crea un video en automático en 3 pasos', s: [
      'Conecta tus claves en <a href="#/integraciones">Integraciones API</a> (como mínimo <b>OpenAI</b>). Solo se hace una vez.',
      'En <b>Modo automático</b> escribe de qué trata tu video y elige formato, duración y estilo.',
      'Pulsa <b>Crear video automático</b>. Los agentes escriben el guion, crean las imágenes, narran, montan y exportan el MP4.',
      'Al terminar se abre <b>Publicar</b>: revisa el título, descarga la miniatura y súbelo a YouTube.',
    ], tip: 'Si subes una canción a la Biblioteca, el modo automático la usa como música de fondo.' },
    editor: { t: 'Cómo usar el editor', s: [
      'Arrastra imágenes desde la columna izquierda al timeline (o pulsa <b>+</b>). Usa <b>Subir</b> para traer fotos de tu PC.',
      'Haz clic en un clip para editar a la derecha: duración, movimiento, filtro, transición y texto. <b>Aplicar a todos</b> copia el ajuste a todos los clips.',
      'Arrastra los clips para reordenarlos y el borde derecho para cambiar su duración.',
      'Suelta voces en la pista <b>VOZ</b> y música en <b>MÚSICA</b>. <b>Ajustar a narración</b> hace que las imágenes duren lo mismo que la voz.',
      'Pulsa <b>Espacio</b> para ver la vista previa y <b>Exportar</b> para descargar el MP4.',
    ], tip: 'Atajos: Ctrl+Z deshacer · Supr eliminar · ← → mover 1 segundo.' },
    flujos: { t: 'Cómo funcionan los flujos de agentes', s: [
      'Elige una plantilla a la izquierda: YouTube, Short, Historia, Top, Documental o Presentación.',
      'Haz clic en el nodo <b>Idea / Tema</b> y escribe de qué trata el video.',
      'Opcional: haz clic en cualquier agente para cambiar su configuración (estilo de imagen, voz, transiciones…). Los interruptores activan o desactivan voz, música y SEO.',
      'Pulsa <b>Ejecutar flujo</b>. Cada agente pasa su resultado al siguiente y verás el progreso en vivo.',
      'Al terminar, el MP4 se exporta solo y se abre <b>Publicar</b>. Usa <b>Guardar</b> para reutilizar el flujo.',
    ], tip: 'Los nodos se pueden arrastrar. El costo aproximado aparece en el registro.' },
    guiones: { t: 'Cómo crear un guion', s: [
      'Escribe el tema, la duración y el tono, y pulsa <b>Escribir guion</b>.',
      'Revisa y corrige cada escena: narración, prompt de imagen y texto en pantalla.',
      'Pulsa <b>Generar video completo</b>: se crean las imágenes y la voz, se monta y se exporta en automático.',
    ], tip: '“Enviar a Voces” lleva toda la narración al estudio de voz.' },
    imagenes: { t: 'Cómo generar imágenes', s: [
      'Describe la imagen en español o en inglés. Pulsa <b>Mejorar prompt con IA</b> para que quede más detallada.',
      'Elige estilo, formato (horizontal para YouTube, vertical para Shorts), calidad y cantidad.',
      'Pulsa <b>Generar</b>. Las imágenes se guardan solas en la Biblioteca.',
      'Pasa el ratón por encima y pulsa <b>+ Editor</b> para añadirla al video actual.',
    ], tip: 'La calidad “Media” es la mejor relación calidad/precio.' },
    voces: { t: 'Cómo crear narraciones', s: [
      'Elige proveedor: <b>OpenAI</b> (rápido y económico) o <b>ElevenLabs</b> (voces premium).',
      'Pega el texto, elige la voz y, si quieres, describe el tono en “Dirección de voz”.',
      'Pulsa <b>Generar voz</b>. El audio se guarda en la Biblioteca.',
      'Pulsa <b>+ Voz</b> para añadirlo al video o <b>+ Música</b> si es una canción.',
    ], tip: 'Los textos largos se generan por partes y se unen solos.' },
    efectos: { t: 'Cómo aplicar efectos', s: [
      'Abre un proyecto en el Editor (y, si quieres, selecciona un clip).',
      'Aquí elige una pestaña: transiciones, filtros, movimientos o textos.',
      'Pulsa <b>Clip</b> para aplicarlo solo al clip seleccionado o <b>Todos</b> para todo el video.',
      'En <b>Crear filtro</b> ajusta los controles y guarda tu propio filtro de color.',
    ] },
    biblioteca: { t: 'Tu biblioteca', s: [
      'Aquí se guardan todas las imágenes y audios, tanto los creados con IA como los que subes.',
      'Arrastra archivos desde tu PC a este recuadro o pulsa <b>Subir archivos</b>.',
      'Usa <b>+ Editor</b>, <b>+ Voz</b> o <b>+ Música</b> para añadirlos al video actual.',
    ], tip: 'Sube aquí tu música de fondo: el modo automático la usará en tus videos.' },
    publicar: { t: 'Cómo publicar tu video', s: [
      'Elige la plataforma: si el formato no coincide, pulsa “Cambiar el proyecto a…”.',
      'Pulsa <b>Exportar</b> (si usaste el modo automático ya está exportado y se descarga solo).',
      'Pulsa <b>Generar con IA</b> para el título, descripción y etiquetas. Los capítulos se añaden solos.',
      'Elige el fondo y el texto de la miniatura y descárgala en PNG.',
      'Para subir directo a YouTube, configura el Client ID de Google en Integraciones. Si no, sube el MP4 descargado a YouTube Studio.',
    ] },
    integraciones: { t: 'Cómo conectar tus APIs', s: [
      '<b>OpenAI</b> (imprescindible): entra a platform.openai.com → API keys → Create new secret key. Pega la clave y pulsa <b>Probar</b>.',
      '<b>Claude</b> (opcional, para guiones): console.anthropic.com → API keys. Si no la pones, se usa OpenAI.',
      '<b>ElevenLabs</b> (opcional): elevenlabs.io → tu perfil → API key.',
      '<b>YouTube</b> (opcional): sigue los pasos de la tarjeta de Google para subir videos directamente.',
    ], tip: 'Recarga saldo en OpenAI (Billing) o las imágenes darán error. Un video de 1 minuto cuesta aprox. US$0,60–1.' },
  };

  const hidden = () => { try { return JSON.parse(localStorage.getItem('framaly.helpHidden') || '{}'); } catch (e) { return {}; } };
  const setHidden = (id, v) => { const h = hidden(); h[id] = v; localStorage.setItem('framaly.helpHidden', JSON.stringify(h)); };
  const steps = (h) => `<ol class="help-steps">${h.s.map((x) => `<li>${x}</li>`).join('')}</ol>${h.tip ? `<div class="hint">${I('zap')} ${h.tip}</div>` : ''}`;

  /** Tarjeta de instrucciones al principio de la sección */
  F.helpCard = (id, container) => {
    const h = F.HELP[id]; if (!h || !container) return;
    const wrap = document.createElement('div');
    const render = () => {
      const hid = hidden()[id];
      wrap.innerHTML = hid
        ? `<button class="btn sm ghost help-show" style="margin-bottom:12px">${I('script')} Ver instrucciones</button>`
        : `<div class="help"><div class="help-ic">${I('script')}</div><div style="flex:1;min-width:0"><b>${h.t}</b>${steps(h)}</div><button class="icon-btn help-x" title="Ocultar instrucciones">${I('x')}</button></div>`;
    };
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('.help-x')) { setHidden(id, true); render(); }
      if (e.target.closest('.help-show')) { setHidden(id, false); render(); }
    });
    render();
    container.prepend(wrap);
  };

  /** Instrucciones en ventana (botón de la barra superior) */
  F.showHelp = (id) => {
    const h = F.HELP[id]; if (!h) return;
    F.modal({ title: h.t, body: steps(h), actions: [{ label: 'Entendido', primary: true }] });
  };

  /** Bienvenida del primer uso */
  F.onboarding = () => {
    F.modal({ title: 'Bienvenido a FRAMALY Studio',
      body: `<p class="muted" style="margin-top:0">Crea videos para YouTube, Shorts y TikTok <b>en automático</b>: escribes la idea y la plataforma hace el resto.</p>
        <div class="steps">
          <div class="stp">${I('key')}<span><b>1. Conecta OpenAI</b><br><span class="small muted">Pega tu API key en Integraciones (una sola vez).</span></span></div>
          <div class="stp">${I('zap')}<span><b>2. Escribe tu idea</b><br><span class="small muted">En Inicio → Modo automático, y pulsa “Crear video automático”.</span></span></div>
          <div class="stp">${I('youtube')}<span><b>3. Publica</b><br><span class="small muted">Se exporta el MP4 con título, descripción y miniatura listos.</span></span></div>
        </div>
        <p class="hint">En cada sección verás instrucciones paso a paso. Puedes abrirlas siempre con el botón <b>Instrucciones</b> de arriba.</p>`,
      onClose: () => localStorage.setItem('framaly.onboarded', '1'),
      actions: [
        { label: 'Explorar primero' },
        { label: `${I('key')} Conectar APIs`, primary: true, onClick: () => F.router.go('#/integraciones') },
      ] });
  };
})();
