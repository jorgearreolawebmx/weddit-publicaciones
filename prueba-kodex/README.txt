WEDDIT STUDIO 0.11.1 — BASE WEB DE LA INVITACIÓN
======================================================

Proyecto: Nicole XV
Exportado: 2026-11-21T08:57:01.813Z

CÓMO VERLA
- Extrae el ZIP completo en una carpeta y haz doble clic en index.html. No necesita servidor ni conexión:
  los datos están en design.js (no se usa fetch). Si lo abres desde dentro del ZIP sin extraerlo, la página
  no encuentra sus archivos y muestra un aviso.
- index.html?vista=intro        muestra solo la portada.
- index.html?vista=invitacion   entra directo a la invitación.

ARCHIVOS
- index.html   estructura de la página.
- styles.css   estilos. Arriba están las variables: ancho de la columna y colores exteriores.
- script.js    construye la página a partir del diseño. Es el mismo código de dibujo que usa el editor.
- design.js    el diseño como window.INVITAVECTOR_DESIGN (lo lee script.js).
- design.json  el mismo diseño en JSON, para otras herramientas.
- assets/      5 recurso(s): imágenes, videos y fuentes, copiados sin recodificar.

LOS TRES ESPACIOS
- INTRO (1080 × 1980 px): portada a pantalla completa. Modo de entrada: tap; transición: fade.
- FONDO FIJO (1080 × 1920 px): UNA pantalla. Queda fija dentro de la columna móvil
  (position: sticky), detrás del contenido. No se alarga con la invitación ni cubre los márgenes exteriores.
- INVITACIÓN (1080 × 23903 px): contenido largo que se desplaza por encima del fondo.
  Lo que quedó fuera de la mesa en el editor no se exporta.

CÓMO PROGRAMAR INTERACCIONES
Cada objeto del diseño es un elemento propio:
    <div id="iv-ID" class="iv-obj iv-TIPO" data-name="nombre" data-layer="capa" data-workspace="intro|background|invitation">
- ID es el «ID para desarrollo» que escribiste en el editor (por ejemplo iv-boton-mapa) o, si no pusiste uno, el id interno.
- Las capas son <div class="iv-layer" id="iv-layer-ID" data-name="…">.
- Los objetos y capas ocultos en el editor se exportan con el atributo hidden, para que puedas mostrarlos por código
  (por ejemplo, un sobre abierto que reemplaza al cerrado).

FUNCIONES INTERACTIVAS INCLUIDAS EN ESTA EXPORTACIÓN
- Efectos por objeto: entrada, énfasis, movimiento y salida. Se pueden activar al cargar, al entrar en pantalla, al pasar el cursor o al hacer clic.
- Parámetros de efectos: duración, retraso, repeticiones, dirección y aceleración.
- Sombras paralelas configuradas desde el panel de propiedades.
- Botones creados o configurados desde el editor, con etiqueta, brillo hover, escala al presionar y acción.
- Acciones disponibles: abrir/cerrar grupos popup, mostrar/ocultar/alternar un objeto, abrir un enlace seguro (http, https, mailto o tel), desplazarse hasta un objeto, entrar a la invitación y reproducir/pausar un medio.
- Las transiciones de apertura disponibles son fundido, desplazamiento, zoom, desenfoque y cortina. Un botón configurado como «Abrir invitación» puede seleccionar su propia transición.
- Los grupos popup se exportan ocultos y se muestran mediante una acción «Abrir ventana emergente». Para cerrarlos, configura una acción «Cerrar ventana emergente» apuntando al mismo popup:ID.
- El runtime respeta la preferencia de movimiento reducido del dispositivo.

API mínima (window.WedditStudio; compatible con window.InvitaVector):
    WedditStudio.get('boton-mapa')      → elemento del objeto
    WedditStudio.open()                 → entra a la invitación
    WedditStudio.isOpen()               → true cuando ya se entró a la invitación
    WedditStudio.elements               → mapa de ids a elementos
    document.addEventListener('wedditstudio:ready', …)   la página está construida
    document.addEventListener('wedditstudio:open', …)    se entró a la invitación

Ejemplo:
    document.addEventListener('wedditstudio:ready', function () {
      var boton = WedditStudio.get('boton-mapa');
      if (boton) boton.addEventListener('click', function () { window.open('https://maps.google.com/?q=…'); });
    });

LIMITACIONES DE ESTA VERSIÓN
- Los grupos popup son grupos de objetos ocultables, no un constructor modal con fondo oscurecido, panel de contenido independiente ni cierre automático al pulsar fuera.
- Todavía no incluye una línea de tiempo de fotogramas clave ni una vista de nodos para dibujar conexiones entre mesas.
- Galerías avanzadas, formularios conectados, cámara, álbum colaborativo y panel administrativo requieren módulos específicos y/o servicios externos; no se generan automáticamente en esta versión.

Para seguir diseñando, conserva project.json o el archivo editable .xalli.
