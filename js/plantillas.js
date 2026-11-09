/* FRAMALY — Pestaña «Plantillas» del editor de video.
   Todo el material reutilizable de la skill «Millora · Editor de video» en un solo lugar:
   formatos de destino, archivo de contexto, intake, instrucciones para la máquina, reparto de cámaras,
   prompts de fondos, reporte de cortes, checklists, estilos guardados, fallos y reglas de oro.
   Cada plantilla se puede copiar; las que tocan el proyecto tienen botón para aplicarlas. */
(function () {
  'use strict';
  if (!F.golden) return;
  const G = F.golden, I = F.icon, esc = F.esc;
  const P = (F.plantillas = {});

  const BLOQ = `INTAKE · BLOQUEANTES (sin esto no se edita)
[ ] 1. Video crudo con buen audio (cámara o micrófono; el audio define el 80 % del resultado)
[ ] 2. Claims PERMITIDOS y PROHIBIDOS del producto (se piden una sola vez)
[ ] 3. Guion TAL COMO SE GRABÓ (no el que se escribió)

CONFIRMAR
[ ] Destino: Meta/TikTok 9:16 · YouTube 16:9 · reel orgánico
[ ] Duración objetivo (anuncio COD: 25–40 s)
[ ] Look fijado: color, tipografía del subtítulo, color del resaltado

TRUCO DE GRABACIÓN: 3 segundos en silencio al inicio (miden el ruido ambiente).`;

  const INSTR = `LAS 4 INSTRUCCIONES (en este orden: Cortar → Subtitular → Ilustrar → Sonorizar)
1. «Corta los silencios»: ritmo natural, sin que se note el corte.
2. «Subtítulos por palabra»: a la altura del pecho, la palabra clave más grande y en color. Máx. 3 palabras, mayúsculas.
3. «B-roll donde nombro algo»: escena de objeto sobre negro, no stock, menos de 1 s.
4. «Sfx desacoplado del corte»: el sonido NO cae donde cae el tijeretazo.

PARA AJUSTAR EL PRIMER CORTE (casi nunca queda a la primera)
- «Reduce más los silencios»
- «No seas tan estricto»

REGLAS DEL CORTE
- Si dudas entre cortar o dejar, DEJA.
- Nunca cortes la primera ni la última palabra de una frase.
- 200 ms de aire entre frases.
- El corte cae en el silencio más cercano dentro de 1,5 s; si no hay silencio, NO se corta.
- De las tomas repetidas te quedas con la SEGUNDA.
- Número de control: crudo de 1:40 → ~58 s con ~40 cortes. Si sale en 1:20, los silencios no se cortaron.`;

  const CAMARAS = `REPARTO DE CÁMARAS POR IDEAS (una sola cámara)
Un bloque = una idea. Cuando termina la idea, termina la cámara.
bloque 1: frontal  ← hook, mira al lente
bloque 2: frontal  ← promesa, sigue de frente
bloque 3: lateral  ← empieza la historia, deja de mirarte
bloque 4: lateral  ← la historia sigue
bloque 5: lateral  ← el giro
bloque 6: frontal  ← vuelve a ti para pedirte algo (CTA)

FRONTAL = ojo al lente, plano medio → hook, promesa, CTA (se guarda para cuando le hablas al espectador)
LATERAL = tres cuartos, más lejos, nunca mira al lente → la narración
CLOSEUP = más bajo y cerca, fondo desenfocado → la frase corta que quieres que repitan (se pide: uno cada ~3 min)

NÚMEROS: cambio de encuadre cuando cambia la idea (~1 min 30 s) · cada 10 s es ruido · punch-in 113 %, tope 125 %.
TRAMPAS: nunca un cutaway a pantalla completa encima de un cambio de cámara · no pongas zoom encima de zoom.`;

  const REPORTE = `Antes de exportar dame el REPORTE DE CORTES:
1. En qué segundo quedó cada corte.
2. Qué frases descartaste (texto exacto).
3. Número de control: duración del crudo → duración final y cantidad de cortes.
No exportes hasta que yo revise que no se comió ninguna frase importante.`;

  const REVISION = `ANTES DE EXPORTAR
[ ] Prueba del sonido apagado (el 85 % ve sin sonido): ¿se entiende de qué va y en qué momento quedarse?
[ ] El primer segundo frena el scroll; el gancho pega en los primeros 3 s
[ ] Ningún claim prohibido en subtítulos ni textos en pantalla
[ ] Sin marcas de agua ajenas ni CTA en inglés
[ ] Sin signos de apertura (¿ ¡), solo los de cierre
[ ] Formato y duración correctos para el destino
[ ] Música con ducking −12 dB cuando habla la voz
[ ] Subtítulos sincronizados contra el video YA cortado, máx. 3 palabras
[ ] Reporte de cortes revisado`;

  const ESTILO = `REPLICAR UN ESTILO DE REFERENCIA
Toma 3–5 capturas del video de referencia:
1. el gancho  2. un visual  3. un subtítulo  4. el cierre
De ahí se extrae paleta, tipografía, ritmo de corte y tipo de animación.
Se destila, no se clona: el resultado sale con identidad propia, nunca con la marca ajena.

EMPAQUETAR EL ESTILO
Cuando el resultado te guste, guarda el estilo con el nombre del cliente: paleta, tiempos, tipo de subtítulo y visuales que funcionaron. La próxima vez es un solo clic.`;

  const BROLL = `TÉCNICAS DE B-ROLL (varía la técnica; menos de 1 s cada pieza)
1. Imágenes IA: el producto SIEMPRE con foto real como semilla, jamás redibujado.
2. Mockups en HTML/CSS (interfaces, notificaciones, chats de WhatsApp): nítidos y sin costo.
3. Texto grande: la palabra clave a pantalla completa, resaltada.
4. Iconos y logos: apps, banderas, sellos de garantía.
5. Animación hecha con el motor del editor, no con clips de video generados por IA.
Se ilustra donde el guion NOMBRA algo; escena de objeto sobre negro, nunca stock genérico.

SONIDO
- Efectos en los cortes y apariciones (pop, whoosh, ding), desacoplados del corte.
- Música de fondo con ducking: 12 dB abajo cuando hay voz.
- Voz en off opcional; el video no se bloquea por ella.`;

  const FALLOS = `SI ALGO FALLA (no se abandona el video)
- Transcripción vacía → verifica que haya pista de audio; si es ruidoso usa un modelo más grande.
- Cortes secos, palabras que se pisan → falta el aire: 200 ms entre frases.
- Subtítulos desfasados → se sincronizaron contra el crudo: rehacer desde el corte.
- B-roll fuera de lugar → no se entregó el guion como se grabó.
- La música tapa la voz → falta el ducking de −12 dB.
- El video sale largo (1:20 en vez de ~58 s) → el ruido impidió detectar silencios: limpiar con la muestra de los 3 s iniciales y recortar de nuevo.
- Render roto → revisar pistas solapadas y texto desbordado antes de reintentar.`;

  const ORO = `REGLAS DE ORO
1. Foto y video reales del producto. La IA no redibuja el producto.
2. Claims por producto. Revisa lo prohibido antes de escribir cualquier texto en pantalla.
3. Sin signos de apertura (¿ ¡) en subtítulos ni en pantalla: solo los de cierre.
4. Español de Colombia, sin traducción automática ni CTA en inglés.
5. El primer resultado se itera. Nadie acierta a la primera.
6. Verificar antes de entregar. Nunca se da por listo sin ver el render.

LO QUE LA MÁQUINA NO DECIDE
Qué se dice y en qué orden · dónde va el silencio que incomoda (márcalo antes de cortar) · si la pieza merecía existir.`;

  const FORMATOS = [
    ['meta', 'Anuncio Meta / TikTok', '9:16 · 25–40 s · COD'],
    ['reel', 'Reel orgánico', '9:16 · ~30 s'],
    ['yt', 'YouTube', '16:9 · sin duración fija'],
  ];

  /** Secciones: [id, título, descripción, texto|función, acciones extra [data-pl, etiqueta]] */
  const secs = (p) => [
    ['ctx', 'Archivo de contexto del proyecto', 'La memoria del editor: producto, destino, duración, claims y guion. Se llena solo con tu Intake.', () => G.contextText(p), []],
    ['bloq', 'Intake · bloqueantes y confirmaciones', 'Lo que se pide antes de editar.', BLOQ, []],
    ['instr', 'Instrucciones para la máquina', 'Las 4 instrucciones, cómo ajustar el primer corte y las reglas del corte.', INSTR, []],
    ['cam', 'Reparto multicámara con una cámara', 'Frontal, lateral y closeup por ideas.', CAMARAS, [['bgp', 'Prompts de fondos 3 cámaras']]],
    ['broll', 'B-roll y sonido', 'Cinco técnicas de b-roll y reglas de sonido.', BROLL, []],
    ['rep', 'Pedir el reporte de cortes', 'Texto listo para pegar en tu IA antes de exportar.', REPORTE, [['rev', 'Abrir Revisión Golden']]],
    ['chk', 'Checklist antes de exportar', 'Todo lo que se revisa antes de dar el video por listo.', REVISION, [['rev', 'Abrir Revisión Golden']]],
    ['est', 'Replicar y empaquetar un estilo', 'Capturas de referencia y estilo por cliente.', ESTILO, [['ref', 'Replicar desde capturas']]],
    ['fail', 'Si algo falla', 'Síntoma → causa y arreglo.', FALLOS, []],
    ['oro', 'Reglas de oro', 'Las seis reglas y lo que la máquina no decide.', ORO, []],
  ];

  P.apply = (E, k) => {
    const p = E.p, g = G.gd(p), D = { meta: ['9:16', 35], reel: ['9:16', 30], yt: ['16:9', 0] }[k]; if (!D) return;
    E.api.commit(); p.aspect = D[0]; g.destino = k; g.destinoSet = true; g.target = D[1];
    E.api.setAspect?.(); E.api.after({ insp: true }); E.api.save();
    F.toast(`Plantilla aplicada: formato ${D[0]}${D[1] ? ` · duración objetivo ${D[1]} s` : ''}`, 'ok');
  };

  P.panel = (bin, E) => {
    const p = E.p, g = G.gd(p), styles = F.settings.goldenStyles || [];
    const list = secs(p);
    bin.innerHTML = `<div class="plant">
      <div class="small muted" style="line-height:1.5">Todo el material reutilizable de la skill. Copia el texto o aplícalo a tu proyecto.</div>
      <div class="pl-card"><b>Formato del video</b><span class="small muted">Cambia el formato y la duración objetivo de este proyecto.</span>
        <div class="pl-fmt">${FORMATOS.map(([k, n, d]) => `<button class="btn sm ${g.destino === k && g.destinoSet ? 'primary' : ''}" data-pl="fmt:${k}">${esc(n)}<small>${esc(d)}</small></button>`).join('')}</div></div>
      <div class="pl-card"><b>Estilos guardados</b>${styles.length ? `<div class="pl-fmt">${styles.map((s) => `<button class="btn sm" data-pl="sty:${s.id}">${esc(s.name)}</button>`).join('')}</div>` : '<span class="small muted">Aún no guardaste ninguno. En Golden → «Guardar el estilo de este video».</span>'}</div>
      ${list.map(([id, t, d, txt, acts]) => `<details class="pl-card" data-id="${id}"><summary><b>${esc(t)}</b><span class="small muted">${esc(d)}</span></summary>
        <pre class="codebox pl-txt"></pre>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm primary" data-pl="copy:${id}">${I('save')} Copiar</button>${acts.map(([a, n]) => `<button class="btn sm" data-pl="${a}">${esc(n)}</button>`).join('')}</div></details>`).join('')}
      <button class="btn skill-btn" data-pl="skill">${I('eye')} Todo el conocimiento de la skill<small>Documento completo con índice y buscador</small></button></div>`;
    bin.querySelectorAll('details.pl-card').forEach((d) => {
      const it = list.find((x) => x[0] === d.dataset.id), fill = () => { d.querySelector('.pl-txt').textContent = typeof it[3] === 'function' ? it[3]() : it[3]; };
      fill(); d.addEventListener('toggle', fill);
    });
    bin.onclick = (e) => {
      const b = e.target.closest('[data-pl]'); if (!b || !E.p) return; const [a, v] = b.dataset.pl.split(':');
      if (a === 'copy') {
        const it = secs(E.p).find((x) => x[0] === v), t = typeof it[3] === 'function' ? it[3]() : it[3];
        (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => F.toast('Plantilla copiada', 'ok'), () => F.toast('No se pudo copiar: selecciona el texto y cópialo a mano', 'error'));
      } else if (a === 'fmt') P.apply(E, v);
      else if (a === 'sty') { G.applyStyle(E, v); }
      else if (a === 'bgp') G.openBgPrompts?.();
      else if (a === 'rev') G.openReview?.(E);
      else if (a === 'ref') G.referenceStyle?.(E).catch((er) => F.toast(er.message, 'error'));
      else if (a === 'skill') G.openSkill?.();
    };
  };
})();
