/* Weddit Studio 0.11.1 — programa de la invitación exportada.
 * No edites design.js a mano: se genera desde el editor. Para añadir interacciones crea tu propio archivo y usa
 * los ids «iv-…» de cada objeto o la API window.WedditStudio (alias compatible: window.InvitaVector).
 */
(function () {
var ivRenderCore = function ivRenderCore() {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var SERIF = /georgia|times|garamond|cambria|palatino|antiqua|baskerville|didot|bodoni|playfair|cormorant|serif$/i;
  var MONO = /courier|consolas|mono/i;
  var SCRIPT = /script|handwriting|brush|cursive/i;

  function num(value, fallback) { var n = Number(value); return isFinite(n) ? n : (fallback || 0); }
  function clamp01(value) { return Math.max(0, Math.min(1, value)); }
  function svgEl(doc, tag, attrs, parent) {
    var node = doc.createElementNS(NS, tag);
    if (attrs) for (var key in attrs) { var value = attrs[key]; if (value !== undefined && value !== null) node.setAttribute(key, String(value)); }
    if (parent) parent.appendChild(node);
    return node;
  }

  /** Pila tipográfica con una familia genérica coherente, para dispositivos que no tengan la fuente instalada. */
  function fontStack(family) {
    var name = String(family || 'Arial').replace(/["']/g, '');
    var generic = /sans/i.test(name) ? 'sans-serif' : SERIF.test(name) ? 'serif' : MONO.test(name) ? 'monospace' : SCRIPT.test(name) ? 'cursive' : 'sans-serif';
    return '"' + name + '", ' + generic;
  }

  /**
   * Caja del medio (imagen o video) dentro del objeto, en coordenadas locales del objeto.
   * cover   : llena la caja sin deformar y recorta lo que sobra; focusX/focusY (0–100) eligen qué parte queda visible.
   * contain : muestra el medio completo sin deformar.
   * fill    : estira el medio a la caja.
   * mediaZoom amplía el medio dentro de la caja (encuadre) sin cambiar el tamaño del objeto.
   */
  function mediaBox(o, natW, natH) {
    var w = num(o.w), h = num(o.h);
    natW = num(natW); natH = num(natH);
    if (!(natW > 0 && natH > 0) || !(w > 0 && h > 0)) return { x: 0, y: 0, w: w, h: h, known: false };
    if (o.fit === 'fill') return { x: 0, y: 0, w: w, h: h, known: true };
    var zoom = Math.max(0.01, num(o.mediaZoom, 1));
    var base = o.fit === 'cover' ? Math.max(w / natW, h / natH) : Math.min(w / natW, h / natH);
    var iw = natW * base * zoom, ih = natH * base * zoom;
    var fx = clamp01(num(o.focusX === undefined ? 50 : o.focusX, 50) / 100), fy = clamp01(num(o.focusY === undefined ? 50 : o.focusY, 50) / 100);
    return { x: (w - iw) * fx, y: (h - ih) * fy, w: iw, h: ih, known: true };
  }

  /** Escala los números de un trazado absoluto (M, L, C, Z) alternando x / y. */
  function scalePath(d, sx, sy) {
    if (sx === 1 && sy === 1) return d;
    var isX = true;
    return String(d || '').replace(/[MLCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi, function (token) {
      if (/^[a-z]$/i.test(token)) { isX = true; return token; }
      var value = parseFloat(token) * (isX ? sx : sy);
      isX = !isX;
      return String(Math.round(value * 1000) / 1000);
    });
  }

  /* ---------------------------------------------------------------- degradados
   *
   * 0.10 añade transparencia alfa real: cada punto lleva su propio color Y su propia opacidad, y se
   * escriben como stop-color + stop-opacity, que es transparencia de verdad y no un color parecido al
   * fondo. También hay posición por punto y punto medio entre dos puntos.
   *
   * Los degradados de dos colores de antes (c1/c2/angle) se siguen leyendo igual: si no hay `stops`,
   * se construyen a partir de ellos. Ningún proyecto anterior cambia de aspecto.
   */
  function clamp01(v) { var n = num(v); return n < 0 ? 0 : n > 100 ? 100 : n; }

  /** Los puntos del degradado, normalizados y ordenados. Siempre devuelve al menos dos. */
  function gradientStops(g) {
    var lista = [];
    if (g && Array.isArray(g.stops) && g.stops.length >= 2) {
      for (var i = 0; i < g.stops.length; i++) {
        var s = g.stops[i] || {};
        lista.push({
          p: clamp01(s.p === undefined ? (i / (g.stops.length - 1)) * 100 : s.p),
          color: typeof s.color === 'string' && s.color ? s.color : '#d8b99a',
          alpha: s.alpha === undefined ? 100 : clamp01(s.alpha),
          mid: s.mid === undefined ? 50 : Math.min(95, Math.max(5, num(s.mid, 50)))
        });
      }
      lista.sort(function (a, b) { return a.p - b.p; });
    } else {
      lista = [
        { p: 0, color: (g && g.c1) || '#d8b99a', alpha: 100, mid: 50 },
        { p: 100, color: (g && g.c2) || '#b85c2b', alpha: 100, mid: 50 }
      ];
    }
    return lista;
  }

  function mezclaCanal(a, b, t) { return Math.round(a + (b - a) * t); }
  function aRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return [216, 185, 154];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function aHex(rgb) {
    return '#' + rgb.map(function (v) { return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2); }).join('');
  }

  /** Crea el degradado del objeto dentro de «defs» y devuelve la referencia de relleno, o null si es color sólido. */
  function gradientPaint(doc, o, defs, idPrefix) {
    var g = o.gradient;
    if (!g || !g.type || g.type === 'none' || !defs) return null;
    var id = (idPrefix || 'grad_') + o.id, node;
    var escala = Math.max(5, num(g.scale, 100)) / 100;
    if (g.type === 'radial') {
      node = svgEl(doc, 'radialGradient', {
        id: id,
        cx: (num(g.cx, 50)) + '%', cy: (num(g.cy, 50)) + '%',
        r: Math.max(1, 70 * escala) + '%'
      }, defs);
    } else {
      node = svgEl(doc, 'linearGradient', {
        id: id, x1: '0%', y1: '0%', x2: '100%', y2: '0%',
        gradientTransform: 'rotate(' + num(g.angle) + ' .5 .5)' + (escala !== 1 ? ' scale(' + escala + ') translate(' + ((1 - 1 / escala) * 50) + '%, 0)' : '')
      }, defs);
    }
    var puntos = gradientStops(g);
    for (var i = 0; i < puntos.length; i++) {
      var s = puntos[i];
      svgEl(doc, 'stop', { offset: s.p + '%', 'stop-color': s.color, 'stop-opacity': (s.alpha / 100) }, node);
      /* El punto medio no existe en SVG: se emula con un punto intermedio calculado. Sin esto, mover
         el rombo del medio no haría nada, que es justo lo que el encargo pide evitar. */
      var sig = puntos[i + 1];
      if (sig && Math.abs(s.mid - 50) > 1) {
        var t = s.mid / 100;
        var pos = s.p + (sig.p - s.p) * t;
        var ca = aRgb(s.color), cb = aRgb(sig.color);
        svgEl(doc, 'stop', {
          offset: pos + '%',
          'stop-color': aHex([mezclaCanal(ca[0], cb[0], 0.5), mezclaCanal(ca[1], cb[1], 0.5), mezclaCanal(ca[2], cb[2], 0.5)]),
          'stop-opacity': ((s.alpha + (sig.alpha - s.alpha) * 0.5) / 100)
        }, node);
      }
    }
    return 'url(#' + id + ')';
  }

  /* ---------------------------------------------------------------- máscaras de recorte (0.10)
   *
   * El contenido y el trazado de máscara son objetos normales que comparten `clipId`; el trazado lleva
   * además `clipRole: 'mask'`. Nada se aplana ni se destruye: la máscara se expresa como un <clipPath>
   * en defs, y el contenido solo gana un atributo clip-path. Liberarla es quitar dos campos.
   *
   * Cada objeto se dibuja dentro de un <g transform="translate(x y) rotate(r)">, y ese transform
   * también afecta a su clip-path. Para que el trazado quede donde el usuario lo ve, se le aplica
   * dentro del clipPath la transformación inversa del contenido seguida de la suya propia.
   */
  /**
   * opts.htmlBox: true cuando el contenido es un elemento HTML colocado con left/top. En CSS el
   * clip-path se aplica ANTES del transform del elemento, así que allí no hay que compensar su giro;
   * en SVG el transform del grupo sí arrastra al clip-path y hay que deshacerlo.
   */
  function fadeCss(f) {
    var clamp = function (v, lo, hi) { var n = num(v); return n < lo ? lo : n > hi ? hi : n; };
    if (!f || !Array.isArray(f.stops) || f.stops.length < 2) return '';
    const paradas = [];
    const orden = f.stops.slice().sort((a, b) => a.p - b.p);
    for (let i = 0; i < orden.length; i++) {
      const s = orden[i];
      paradas.push('rgba(255,255,255,' + (clamp(num(s.alpha, 100), 0, 100) / 100).toFixed(3) + ') '
        + clamp(num(s.p, 0), 0, 100).toFixed(2) + '%');
      // el punto medio se imita con una parada intermedia, igual que al pintar el relleno en SVG
      const sig = orden[i + 1];
      if (sig) {
        const m = clamp(num(s.mid, 50), 1, 99);
        if (Math.abs(m - 50) > 1) {
          const p = num(s.p) + (num(sig.p) - num(s.p)) * (m / 100);
          const a = (num(s.alpha, 100) + num(sig.alpha, 100)) / 2;
          paradas.push('rgba(255,255,255,' + (clamp(a, 0, 100) / 100).toFixed(3) + ') ' + clamp(p, 0, 100).toFixed(2) + '%');
        }
      }
    }
    if (f.type === 'radial') {
      const r = clamp(num(f.scale, 100), 10, 400);
      /* Elipse, no círculo: en CSS «circle» no admite porcentajes, y además el radial de SVG en
         unidades de caja también se estira con el objeto. Así los dos pintan lo mismo. */
      return 'radial-gradient(ellipse ' + r + '% ' + r + '% at ' + clamp(num(f.cx, 50), 0, 100) + '% '
        + clamp(num(f.cy, 50), 0, 100) + '%, ' + paradas.join(', ') + ')';
    }
    const grados = (clamp(Math.round(num(f.angle, 90)), 0, 360) + 90) % 360;
    const escala = clamp(num(f.scale, 100), 10, 400) / 100;
    // la escala se traduce estirando las posiciones alrededor del centro
    if (Math.abs(escala - 1) > 0.001) {
      const reescaladas = paradas.map((t) => {
        const m = t.match(/^(.*) ([\d.]+)%$/);
        if (!m) return t;
        const p = 50 + (Number(m[2]) - 50) / escala;
        return m[1] + ' ' + clamp(p, -200, 300).toFixed(2) + '%';
      });
      return 'linear-gradient(' + grados + 'deg, ' + reescaladas.join(', ') + ')';
    }
    return 'linear-gradient(' + grados + 'deg, ' + paradas.join(', ') + ')';
  }

  function clipPathFor(doc, maskObj, contentObj, defs, idPrefix, opts) {
    if (!maskObj || !contentObj || !defs) return null;
    opts = opts || {};
    var id = (idPrefix || 'clip_') + 'cm_' + (contentObj.clipId || maskObj.id) + '_' + contentObj.id;
    var previo = defs.querySelector ? defs.querySelector('[id="' + id + '"]') : null;
    if (previo && previo.parentNode) previo.parentNode.removeChild(previo);
    var nodo = svgEl(doc, 'clipPath', { id: id, clipPathUnits: 'userSpaceOnUse' }, defs);
    var cw = num(contentObj.w), ch = num(contentObj.h);
    var mw = num(maskObj.w), mh = num(maskObj.h);
    var t = (opts.htmlBox ? '' : 'rotate(' + (-num(contentObj.rotation)) + ' ' + (cw / 2) + ' ' + (ch / 2) + ') ')
      + ' translate(' + (-num(contentObj.x)) + ' ' + (-num(contentObj.y)) + ')'
      + ' translate(' + num(maskObj.x) + ' ' + num(maskObj.y) + ')'
      + ' rotate(' + num(maskObj.rotation) + ' ' + (mw / 2) + ' ' + (mh / 2) + ')';
    /* La transformación va en la propia forma, no en un <g>: dentro de <clipPath> solo valen formas,
       <text> y <use>, y un grupo lo ignoran los navegadores. Con el grupo, el recorte se quedaba en
       nada y el objeto desaparecía por completo. */
    if (maskObj.type === 'ellipse') {
      svgEl(doc, 'ellipse', { cx: mw / 2, cy: mh / 2, rx: Math.max(0, mw / 2), ry: Math.max(0, mh / 2), transform: t }, nodo);
    } else if (maskObj.type === 'path' && maskObj.d) {
      var msx = mw / (num(maskObj.pathW, mw) || 1), msy = mh / (num(maskObj.pathH, mh) || 1);
      svgEl(doc, 'path', { d: scalePath(maskObj.d, msx, msy), 'fill-rule': maskObj.fillRule || 'nonzero', transform: t }, nodo);
    } else if (maskObj.type === 'text') {
      /* El texto recorta por la silueta de sus letras, no por su caja. <clipPath> admite <text>,
         así que se repite aquí la misma geometría que usa el dibujo normal para que coincidan. */
      var ts = num(maskObj.fontSize, 52), tlh = num(maskObj.lineHeight, ts * 1.2);
      var tlines = (opts.maskLines && opts.maskLines.length ? opts.maskLines : maskObj.lines)
        || String(maskObj.text || '').split('\n');
      var tx = maskObj.align === 'center' ? mw / 2 : maskObj.align === 'right' ? mw : 0;
      var tnode = svgEl(doc, 'text', { x: tx, 'font-family': fontStack(maskObj.fontFamily), 'font-size': ts,
        'font-weight': maskObj.fontWeight || '400', 'font-style': maskObj.fontStyle || 'normal',
        'text-anchor': maskObj.align === 'center' ? 'middle' : maskObj.align === 'right' ? 'end' : 'start',
        transform: t }, nodo);
      if (num(maskObj.letterSpacing)) tnode.setAttribute('letter-spacing', num(maskObj.letterSpacing));
      tnode.style.whiteSpace = 'pre';
      for (var li = 0; li < tlines.length; li++) {
        svgEl(doc, 'tspan', { x: tx, y: ts + li * tlh }, tnode).textContent = tlines[li];
      }
    } else {
      // rectángulo y cualquier otra forma: se recorta por su caja, con su radio si lo tiene
      var radius = Math.max(0, Math.min(num(maskObj.radius), mw / 2, mh / 2));
      svgEl(doc, 'rect', { x: 0, y: 0, width: Math.max(0, mw), height: Math.max(0, mh), rx: radius, ry: radius, transform: t }, nodo);
    }
    return 'url(#' + id + ')';
  }

  function strokeAttrs(o, attrs) {
    var width = num(o.strokeWidth);
    if (width > 0 && o.stroke && o.stroke !== 'none') { attrs.stroke = o.stroke; attrs['stroke-width'] = width; }
    else attrs.stroke = 'none';
    return attrs;
  }

  /* ---------------------------------------------------------------- botón de música
   * El mismo dibujo se usa en el lienzo del editor y en la invitación publicada, de modo que lo que se diseña
   * es exactamente lo que ve el invitado. Los iconos son trazados en una caja de 100 × 100.
   */
  var MUSIC_ICONS = {
    play:       'M38 28 L74 50 L38 72 Z',
    note:       'M62 24 L62 60 A11 11 0 1 1 56 50 L56 36 L42 40 L42 66 A11 11 0 1 1 36 56 L36 32 Z',
    headphones: 'M22 60 V50 A28 28 0 0 1 78 50 V60 M22 58 h10 v20 h-10 a4 4 0 0 1 -4 -4 v-12 a4 4 0 0 1 4 -4 Z M78 58 h-10 v20 h10 a4 4 0 0 0 4 -4 v-12 a4 4 0 0 0 -4 -4 Z',
    speaker:    'M30 40 h12 l16 -14 v48 l-16 -14 h-12 Z M66 38 a18 18 0 0 1 0 24 M74 30 a30 30 0 0 1 0 40',
    disc:       'M50 18 A32 32 0 1 1 49.9 18 Z M50 40 A10 10 0 1 1 49.9 40 Z',
    pause:      'M36 28 h11 v44 h-11 Z M53 28 h11 v44 h-11 Z',
    bars:       'M30 44 h7 v12 h-7 Z M41 34 h7 v32 h-7 Z M52 28 h7 v44 h-7 Z M63 38 h7 v24 h-7 Z',
    mute:       'M30 40 h12 l16 -14 v48 l-16 -14 h-12 Z M66 42 L82 58 M82 42 L66 58'
  };
  var MUSIC_STROKE_ICONS = { headphones: true, speaker: true, mute: true };
  var MUSIC_HOLE_ICONS = { disc: true };   // el centro del disco debe quedar hueco
  function musicIconPath(name) { return MUSIC_ICONS[name] || MUSIC_ICONS.play; }

  function rgbaFrom(hex, alpha) {
    var color = /^#[0-9a-f]{6}$/i.test(String(hex || '')) ? hex : '#000000';
    return 'rgba(' + parseInt(color.slice(1, 3), 16) + ',' + parseInt(color.slice(3, 5), 16) + ',' + parseInt(color.slice(5, 7), 16) + ',' + Math.max(0, Math.min(1, num(alpha, 1))) + ')';
  }

  /**
   * Dibuja el botón de música. options.playing indica qué icono mostrar (pausa cuando está sonando).
   * Devuelve las piezas, para que quien lo use pueda animarlas sin volver a dibujar.
   */
  function drawMusic(doc, o, parent, options) {
    options = options || {};
    var m = (o && o.music) || {};
    var w = Math.max(1, num(o.w, 100)), h = Math.max(1, num(o.h, 100));
    var playing = !!options.playing;
    var group = svgEl(doc, 'g', { 'class': 'iv-music-figure' }, parent);
    var parts = { group: group, waves: [] };

    // ondas de sonido: detrás del botón, para que no tapen el icono
    if (m.waves) {
      var ringGroup = svgEl(doc, 'g', { 'class': 'iv-music-waves' }, group);
      var ringColor = /^#[0-9a-f]{6}$/i.test(String(m.border || '')) && num(m.borderWidth, 0) > 0 ? m.border : m.bg;
      for (var i = 0; i < 3; i++) {
        var k = 1 + (i + 1) * 0.16, cx = w / 2, cy = h / 2;
        var common = { fill: 'none', stroke: rgbaFrom(ringColor, 0.5 - i * 0.14), 'stroke-width': Math.max(1, Math.min(w, h) * 0.025),
          transform: 'translate(' + (cx - cx * k) + ' ' + (cy - cy * k) + ') scale(' + k + ')' };
        var ring = m.shape === 'square'
          ? svgEl(doc, 'rect', Object.assign({ x: 0, y: 0, width: w, height: h, rx: num(m.radius, 24), ry: num(m.radius, 24) }, common), ringGroup)
          : svgEl(doc, 'ellipse', Object.assign({ cx: cx, cy: cy, rx: w / 2, ry: h / 2 }, common), ringGroup);
        ring.setAttribute('class', 'iv-music-wave');
        ring.setAttribute('data-wave', String(i));
        parts.waves.push(ring);
      }
      parts.waveGroup = ringGroup;
    }

    // cuerpo: lo que gira cuando está configurado «girar mientras suena»
    var body = svgEl(doc, 'g', { 'class': 'iv-music-body' }, group);
    parts.body = body;
    var fillColor = rgbaFrom(m.bg, num(m.bgOpacity, 100) / 100);
    var borderWidth = Math.max(0, num(m.borderWidth, 0));
    var shapeAttrs = { fill: fillColor };
    if (borderWidth > 0) { shapeAttrs.stroke = /^#[0-9a-f]{6}$/i.test(String(m.border || '')) ? m.border : '#d1a56e'; shapeAttrs['stroke-width'] = borderWidth; }
    if (m.shape === 'square') {
      var radius = Math.max(0, Math.min(num(m.radius, 24), w / 2, h / 2));
      parts.shape = svgEl(doc, 'rect', Object.assign({ x: borderWidth / 2, y: borderWidth / 2, width: Math.max(0, w - borderWidth), height: Math.max(0, h - borderWidth), rx: radius, ry: radius }, shapeAttrs), body);
    } else {
      parts.shape = svgEl(doc, 'ellipse', Object.assign({ cx: w / 2, cy: h / 2, rx: Math.max(0, (w - borderWidth) / 2), ry: Math.max(0, (h - borderWidth) / 2) }, shapeAttrs), body);
    }

    // icono: imagen propia si se eligió una, y si no, uno de los trazados del catálogo
    var iconHost = svgEl(doc, 'g', { 'class': 'iv-music-icon' }, body);
    parts.iconHost = iconHost;
    var scale = Math.max(0.1, num(m.iconScale, 100) / 100) * 0.52;
    var size = Math.min(w, h) * scale;
    var customSrc = playing ? options.pauseIconSrc : options.playIconSrc;
    if (customSrc) {
      parts.icon = svgEl(doc, 'image', { href: customSrc, x: (w - size) / 2, y: (h - size) / 2, width: size, height: size, preserveAspectRatio: 'xMidYMid meet' }, iconHost);
    } else {
      var iconName = playing ? (m.iconPause || 'pause') : (m.iconPlay || 'play');
      var k = size / 100;
      var attrs = { d: musicIconPath(iconName), transform: 'translate(' + ((w - size) / 2) + ' ' + ((h - size) / 2) + ') scale(' + k + ')',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      var iconColor = /^#[0-9a-f]{6}$/i.test(String(m.icon || '')) ? m.icon : '#ffffff';
      if (MUSIC_STROKE_ICONS[iconName]) { attrs.fill = 'none'; attrs.stroke = iconColor; attrs['stroke-width'] = 7; }
      else { attrs.fill = iconColor; attrs.stroke = 'none'; if (MUSIC_HOLE_ICONS[iconName]) attrs['fill-rule'] = 'evenodd'; }
      parts.icon = svgEl(doc, 'path', attrs, iconHost);
    }
    return parts;
  }

  /* ---------------------------------------------------------------- cuenta regresiva (0.10)
   * Se dibuja igual en el editor y en la invitación publicada: mismas medidas, mismas tipografías,
   * mismos huecos. Quien la pinta solo tiene que pasarle los números ya calculados.
   */
  function drawCountdown(doc, o, parent, opts) {
    opts = opts || {};
    var c = opts.cfg || o.cd || {};
    var vista = opts.view || { estado: 'sin-fecha' };
    var w = num(o.w), h = num(o.h);
    var g = svgEl(doc, 'g', { 'data-countdown': '1' }, parent);

    // sin fecha o sin activar: un aviso claro en el editor, nada de números inventados
    if (vista.estado === 'sin-fecha' || vista.estado === 'sin-activar') {
      if (opts.placeholder === false) return g;
      svgEl(doc, 'rect', { x: 0, y: 0, width: Math.max(0, w), height: Math.max(0, h), rx: 12,
        fill: 'rgba(240,192,112,.10)', stroke: '#c9a366', 'stroke-width': 2, 'stroke-dasharray': '10 7' }, g);
      var aviso = svgEl(doc, 'text', { x: w / 2, y: h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-family': fontStack(c.labelFont || 'Arial'), 'font-size': Math.max(12, Math.min(34, h / 5)),
        fill: '#b08a4a', 'font-weight': '600' }, g);
      aviso.textContent = vista.aviso || 'Configura la fecha del evento';
      return g;
    }

    if (vista.estado === 'terminado' && c.endMode === 'hide') return g;
    if (vista.estado === 'terminado' && (c.endMode === 'message' || c.endMode === 'custom')) {
      var fin = svgEl(doc, 'text', { x: w / 2, y: h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-family': fontStack(c.numberFont), 'font-size': Math.max(14, num(c.numberSize, 90) * 0.55),
        'font-weight': c.numberWeight || '400', fill: c.numberColor || '#3f3730' }, g);
      fin.textContent = c.endMode === 'custom' ? (c.endText || '') : '¡Hoy es el gran día!';
      return g;
    }

    var unidades = (c.units && c.units.length ? c.units : ['days', 'hours', 'minutes', 'seconds']);
    var sep = opts.separatorText === undefined ? '' : opts.separatorText;
    var gapU = num(c.gapUnits, 44), gapNL = num(c.gapNumberLabel, 10);
    var hayTarjeta = c.card && c.card !== 'none';
    var pad = hayTarjeta ? num(c.cardPad, 18) : 0;

    // medidas de cada bloque, para repartir el ancho
    var bloques = [], total = 0;
    for (var i = 0; i < unidades.length; i++) {
      var u = unidades[i];
      var escala = num((c.unitScale || {})[u], 100) / 100;
      var tamN = num(c.numberSize, 90) * escala;
      var tamL = num(c.labelSize, 15) * escala;
      var textoN = (opts.numberOf || function () { return '0'; })(u);
      var textoL = (opts.labelOf || function () { return u; })(u);
      var anchoN = textoN.length * tamN * 0.62 + num(c.numberTracking, 0) * textoN.length;
      var anchoL = textoL.length * tamL * 0.62 + num(c.labelTracking, 0) * textoL.length;
      var ancho = Math.max(anchoN, anchoL) + pad * 2;
      bloques.push({ u: u, tamN: tamN, tamL: tamL, textoN: textoN, textoL: textoL, ancho: ancho });
      total += ancho;
    }
    var anchoSep = sep ? num(c.labelSize, 15) * 1.6 : 0;
    total += anchoSep * Math.max(0, unidades.length - 1) + gapU * Math.max(0, unidades.length - 1);

    var x = c.align === 'left' ? 0 : c.align === 'right' ? (w - total) : (w - total) / 2;
    var altoBloque = num(c.numberSize, 90) + gapNL + num(c.labelSize, 15);
    var yBase = (h - altoBloque) / 2;

    for (var j = 0; j < bloques.length; j++) {
      var b = bloques[j];
      var cx = x + b.ancho / 2;
      if (hayTarjeta) {
        var altoT = b.tamN + gapNL + b.tamL + pad * 2;
        var yT = (h - altoT) / 2;
        if (c.card === 'circle') {
          var radio = Math.max(b.ancho, altoT) / 2;
          svgEl(doc, 'circle', { cx: cx, cy: h / 2, r: radio, fill: c.cardFill || '#f6efe6',
            stroke: c.cardStroke || 'none', 'stroke-width': c.cardStroke ? 2 : 0 }, g);
        } else {
          svgEl(doc, 'rect', { x: x, y: yT, width: b.ancho, height: altoT, rx: c.card === 'soft' ? Math.min(22, altoT / 4) : 4,
            fill: c.cardFill || '#f6efe6', stroke: c.cardStroke || 'none', 'stroke-width': c.cardStroke ? 2 : 0 }, g);
        }
      }
      var numero = svgEl(doc, 'text', { x: cx, y: yBase + b.tamN * 0.78, 'text-anchor': 'middle',
        'font-family': fontStack(c.numberFont), 'font-size': b.tamN, 'font-weight': c.numberWeight || '400',
        fill: c.numberColor || '#3f3730', 'letter-spacing': num(c.numberTracking, 0) }, g);
      numero.textContent = b.textoN;
      var etiqueta = svgEl(doc, 'text', { x: cx, y: yBase + b.tamN + gapNL + b.tamL * 0.82, 'text-anchor': 'middle',
        'font-family': fontStack(c.labelFont), 'font-size': b.tamL, 'font-weight': c.labelWeight || '400',
        fill: c.labelColor || '#8a7f73', 'letter-spacing': num(c.labelTracking, 0) }, g);
      etiqueta.textContent = b.textoL;

      x += b.ancho;
      if (j < bloques.length - 1) {
        if (sep) {
          var s2 = svgEl(doc, 'text', { x: x + gapU / 2 + anchoSep / 2, y: yBase + num(c.numberSize, 90) * 0.72,
            'text-anchor': 'middle', 'font-family': fontStack(c.numberFont),
            'font-size': num(c.numberSize, 90) * 0.5, fill: c.separatorColor || c.labelColor || '#8a7f73' }, g);
          s2.textContent = sep;
        }
        x += gapU + anchoSep;
      }
    }
    return g;
  }

  /**
   * Dibuja un objeto vectorial (rect, ellipse, line, path, text) dentro de «parent», en coordenadas locales 0..w × 0..h.
   * options: { defs, idPrefix, lines } — «lines» son los renglones de texto ya calculados por el editor.
   */
  function drawVector(doc, o, parent, options) {
    options = options || {};
    if (o.type === 'music') return drawMusic(doc, o, parent, options).group;
    var w = num(o.w), h = num(o.h);
    var gradient = gradientPaint(doc, o, options.defs, options.idPrefix);
    var fill = gradient || (o.fill === undefined || o.fill === null || o.fill === '' ? 'none' : o.fill);
    if (o.type === 'rect') {
      var radius = Math.max(0, Math.min(num(o.radius), w / 2, h / 2));
      return svgEl(doc, 'rect', strokeAttrs(o, { x: 0, y: 0, width: Math.max(0, w), height: Math.max(0, h), rx: radius, ry: radius, fill: fill }), parent);
    }
    if (o.type === 'ellipse') {
      return svgEl(doc, 'ellipse', strokeAttrs(o, { cx: w / 2, cy: h / 2, rx: Math.max(0, w / 2), ry: Math.max(0, h / 2), fill: fill }), parent);
    }
    if (o.type === 'line') {
      return svgEl(doc, 'line', { x1: o.flipX ? w : 0, y1: o.flipY ? h : 0, x2: o.flipX ? 0 : w, y2: o.flipY ? 0 : h,
        stroke: o.stroke && o.stroke !== 'none' ? o.stroke : '#604a31', 'stroke-width': Math.max(0.5, num(o.strokeWidth, 4)), 'stroke-linecap': 'round', fill: 'none' }, parent);
    }
    if (o.type === 'path') {
      var sx = w / (num(o.pathW, w) || 1), sy = h / (num(o.pathH, h) || 1);
      var attrs = strokeAttrs(o, { d: scalePath(o.d, sx, sy), fill: (o.closed || o.fillOpenPath) ? fill : 'none', 'fill-rule': o.fillRule || 'nonzero', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      return svgEl(doc, 'path', attrs, parent);
    }
    if (o.type === 'text') {
      var size = num(o.fontSize, 52), lineHeight = num(o.lineHeight, size * 1.2);
      var lines = options.lines || o.lines || String(o.text || '').split('\n');
      var x = o.align === 'center' ? w / 2 : o.align === 'right' ? w : 0;
      var text = svgEl(doc, 'text', strokeAttrs(o, {
        fill: fill === 'none' && !(num(o.strokeWidth) > 0) ? '#56392f' : fill,
        'font-family': fontStack(o.fontFamily), 'font-size': size, 'font-weight': o.fontWeight || '400', 'font-style': o.fontStyle || 'normal',
        'text-anchor': o.align === 'center' ? 'middle' : o.align === 'right' ? 'end' : 'start'
      }), parent);
      if (num(o.letterSpacing)) text.setAttribute('letter-spacing', num(o.letterSpacing));
      text.style.whiteSpace = 'pre';
      text.style.paintOrder = 'stroke';
      for (var i = 0; i < lines.length; i++) svgEl(doc, 'tspan', { x: x, y: size + i * lineHeight }, text).textContent = lines[i];
      return text;
    }
    return null;
  }

  /** Divide el texto en renglones. measure(cadena) → anchura en píxeles de documento con la fuente del objeto. */
  function layoutText(o, measure) {
    var paragraphs = String(o.text === undefined || o.text === null ? '' : o.text).split('\n');
    if (o.textMode === 'point' || !(num(o.w) > 0) || !measure) return paragraphs;
    var maxWidth = num(o.w), lines = [];
    for (var p = 0; p < paragraphs.length; p++) {
      var words = paragraphs[p].split(' '), line = '';
      for (var i = 0; i < words.length; i++) {
        var candidate = i === 0 ? words[i] : line + ' ' + words[i];
        if (i > 0 && line !== '' && measure(candidate) > maxWidth) { lines.push(line); line = words[i]; }
        else line = candidate;
      }
      lines.push(line);
    }
    return lines;
  }

  return { NS: NS, num: num, svgEl: svgEl, fontStack: fontStack, mediaBox: mediaBox, scalePath: scalePath, gradientPaint: gradientPaint, gradientStops: gradientStops, fadeCss: fadeCss, clipPathFor: clipPathFor, drawCountdown: drawCountdown,
    drawVector: drawVector, drawMusic: drawMusic, musicIconPath: musicIconPath, musicIcons: MUSIC_ICONS, rgbaFrom: rgbaFrom, layoutText: layoutText };
};

var ivUiCore = function ivUiCore(R) {
  'use strict';
  var svgEl = R.svgEl, num = R.num, rgba = R.rgbaFrom;
  var uid = 0;

  // ================================================================ iconos
  // Trazados en una caja de 100 × 100. Los de STROKE se dibujan con línea; el resto, rellenos.
  var ICONS = {
    play: 'M34 24 L78 50 L34 76 Z',
    pause: 'M34 24 h12 v52 h-12 Z M54 24 h12 v52 h-12 Z',
    stop: 'M30 30 h40 v40 h-40 Z',
    next: 'M30 24 L62 50 L30 76 Z M66 24 h8 v52 h-8 Z',
    prev: 'M70 24 L38 50 L70 76 Z M26 24 h8 v52 h-8 Z',
    menu: 'M22 32 h56 M22 50 h56 M22 68 h56',
    home: 'M20 50 L50 24 L80 50 M30 46 v30 h40 v-30',
    'chevron-right': 'M40 26 L64 50 L40 74',
    'chevron-down': 'M26 40 L50 64 L74 40',
    'arrow-right': 'M22 50 h54 M56 30 L76 50 L56 70',
    'arrow-left': 'M78 50 h-54 M44 30 L24 50 L44 70',
    check: 'M24 52 L42 70 L76 30',
    close: 'M28 28 L72 72 M72 28 L28 72',
    plus: 'M50 24 v52 M24 50 h52',
    minus: 'M24 50 h52',
    heart: 'M50 78 C18 56 20 32 36 26 C44 23 50 28 50 34 C50 28 56 23 64 26 C80 32 82 56 50 78 Z',
    'heart-line': 'M50 76 C20 55 22 33 36 28 C44 25 50 30 50 36 C50 30 56 25 64 28 C78 33 80 55 50 76 Z',
    star: 'M50 20 L60 42 L84 45 L67 62 L71 86 L50 74 L29 86 L33 62 L16 45 L40 42 Z',
    'star-line': 'M50 22 L60 43 L83 46 L66 62 L70 85 L50 74 L30 85 L34 62 L17 46 L40 43 Z',
    mic: 'M50 20 a10 10 0 0 1 10 10 v18 a10 10 0 0 1 -20 0 v-18 a10 10 0 0 1 10 -10 Z M30 46 a20 20 0 0 0 40 0 M50 66 v14 M38 80 h24',
    camera: 'M18 36 h16 l6 -8 h20 l6 8 h16 v38 h-64 Z M50 56 m-13 0 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0',
    upload: 'M50 70 v-44 M32 44 L50 26 L68 44 M22 74 h56',
    download: 'M50 26 v44 M32 52 L50 70 L68 52 M22 78 h56',
    share: 'M68 28 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M32 50 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M68 72 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M40 46 L60 33 M40 54 L60 67',
    fullscreen: 'M24 38 v-14 h14 M62 24 h14 v14 M76 62 v14 h-14 M38 76 h-14 v-14',
    moon: 'M66 58 A28 28 0 1 1 44 22 A22 22 0 0 0 66 58 Z',
    sun: 'M50 36 a14 14 0 1 0 0 28 a14 14 0 1 0 0 -28 M50 16 v8 M50 76 v8 M16 50 h8 M76 50 h8 M26 26 l6 6 M68 68 l6 6 M74 26 l-6 6 M32 68 l-6 6',
    gift: 'M20 44 h60 v34 h-60 Z M20 44 v-10 h60 v10 M50 34 v44 M50 34 c-14 0 -18 -14 -8 -16 c7 -1 8 9 8 16 c0 -7 1 -17 8 -16 c10 2 6 16 -8 16',
    'map-pin': 'M50 80 C30 58 26 46 26 38 A24 24 0 0 1 74 38 C74 46 70 58 50 80 Z M50 38 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0',
    gallery: 'M18 26 h64 v48 h-64 Z M18 62 L36 46 L50 58 L64 42 L82 60 M64 38 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0',
    video: 'M18 30 h44 v40 h-44 Z M62 44 L84 32 v36 L62 56 Z',
    search: 'M44 44 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 M58 58 L78 78',
    lock: 'M30 46 h40 v32 h-40 Z M38 46 v-10 a12 12 0 0 1 24 0 v10',
    user: 'M50 40 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 M24 82 c0 -16 12 -24 26 -24 s26 8 26 24',
    users: 'M40 38 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 M16 78 c0 -14 11 -21 24 -21 s24 7 24 21 M66 32 a11 11 0 0 1 0 22 M70 60 c9 2 16 9 16 18',
    calendar: 'M20 30 h60 v50 h-60 Z M20 46 h60 M34 22 v14 M66 22 v14',
    envelope: 'M18 32 h64 v40 h-64 Z M18 34 L50 56 L82 34',
    phone: 'M32 20 c6 0 8 14 6 18 c-2 4 -8 4 -8 10 c0 10 12 22 22 22 c6 0 6 -6 10 -8 c4 -2 18 0 18 6 c0 8 -8 14 -16 14 C40 82 18 60 18 36 C18 28 24 20 32 20 Z',
    chat: 'M20 28 h60 v36 h-38 L24 80 v-16 h-4 Z',
    'music-note': 'M64 20 v38 a11 11 0 1 1 -7 -10 v-22 l-22 6 v30 a11 11 0 1 1 -7 -10 v-28 Z',
    volume: 'M26 40 h12 l16 -14 v48 l-16 -14 h-12 Z M62 38 a18 18 0 0 1 0 24 M72 30 a30 30 0 0 1 0 40',
    'volume-off': 'M26 40 h12 l16 -14 v48 l-16 -14 h-12 Z M64 42 L82 60 M82 42 L64 60',
    eye: 'M14 50 C28 30 72 30 86 50 C72 70 28 70 14 50 Z M50 50 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0',
    pencil: 'M24 76 l6 -18 L62 26 l12 12 L42 70 Z M58 30 l12 12',
    trash: 'M26 34 h48 M38 34 v-8 h24 v8 M32 34 l4 44 h28 l4 -44 M44 44 v26 M56 44 v26',
    copy: 'M34 24 h42 v42 h-42 Z M24 36 v40 h40',
    link: 'M44 56 a14 14 0 0 0 20 0 l10 -10 a14 14 0 0 0 -20 -20 l-5 5 M56 44 a14 14 0 0 0 -20 0 l-10 10 a14 14 0 0 0 20 20 l5 -5',
    filter: 'M18 26 h64 L58 54 v26 l-16 -8 v-18 Z',
    settings: 'M50 50 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 M50 16 v10 M50 74 v10 M16 50 h10 M74 50 h10 M26 26 l7 7 M67 67 l7 7 M74 26 l-7 7 M33 67 l-7 7',
    info: 'M50 50 m-30 0 a30 30 0 1 0 60 0 a30 30 0 1 0 -60 0 M50 44 v22 M50 32 v4',
    clock: 'M50 50 m-30 0 a30 30 0 1 0 60 0 a30 30 0 1 0 -60 0 M50 30 v22 h16',
    ticket: 'M18 34 h64 v12 a6 6 0 0 0 0 12 v12 h-64 v-12 a6 6 0 0 0 0 -12 Z M46 34 v8 M46 50 v8 M46 66 v4',
    flower: 'M50 50 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M50 43 c0 -14 -14 -18 -14 -6 c0 6 7 6 14 6 M57 50 c14 0 18 -14 6 -14 c-6 0 -6 7 -6 14 M50 57 c0 14 14 18 14 6 c0 -6 -7 -6 -14 -6 M43 50 c-14 0 -18 14 -6 14 c6 0 6 -7 6 -14',
    leaf: 'M24 76 C24 40 48 22 78 22 C78 52 60 76 24 76 Z M30 70 C44 56 58 46 72 40',
    ring: 'M50 58 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 M50 38 l-10 -14 h20 Z',
    cheers: 'M26 22 h22 l-4 26 a7 7 0 0 1 -14 0 Z M37 48 v22 M30 74 h14 M52 22 h22 l-4 26 a7 7 0 0 1 -14 0 Z M63 48 v22 M56 74 h14',
    gamepad: 'M24 38 h52 a14 14 0 0 1 0 28 h-52 a14 14 0 0 1 0 -28 Z M36 46 v12 M30 52 h12 M62 48 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M70 58 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0',
    dots: 'M26 50 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M50 50 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M74 50 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0'
  };
  // Los que se dibujan con línea en vez de relleno.
  var STROKE_ICONS = { menu: 1, home: 1, 'chevron-right': 1, 'chevron-down': 1, 'arrow-right': 1, 'arrow-left': 1,
    check: 1, close: 1, plus: 1, minus: 1, 'heart-line': 1, 'star-line': 1, mic: 1, camera: 1, upload: 1, download: 1,
    share: 1, fullscreen: 1, sun: 1, gift: 1, 'map-pin': 1, gallery: 1, video: 1, search: 1, lock: 1, user: 1, users: 1,
    calendar: 1, envelope: 1, chat: 1, volume: 1, 'volume-off': 1, eye: 1, pencil: 1, trash: 1, copy: 1, link: 1,
    settings: 1, info: 1, clock: 1, ticket: 1, flower: 1, leaf: 1, ring: 1, cheers: 1, gamepad: 1 };

  function iconNames() { var out = []; for (var k in ICONS) out.push(k); return out.sort(); }

  /** Dibuja un icono dentro de la caja indicada. */
  function drawIcon(doc, parent, name, box, color, weight) {
    if (!name || name === 'none' || !ICONS[name]) return null;
    var k = box.size / 100;
    var attrs = { d: ICONS[name], transform: 'translate(' + box.x + ' ' + box.y + ') scale(' + k + ')',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'pointer-events': 'none' };
    if (STROKE_ICONS[name]) { attrs.fill = 'none'; attrs.stroke = color; attrs['stroke-width'] = num(weight, 7); }
    else { attrs.fill = color; attrs.stroke = 'none'; }
    return svgEl(doc, 'path', attrs, parent);
  }

  // ================================================================ formas
  var SHAPES = [['pill', 'Píldora'], ['rect', 'Rectángulo'], ['rounded', 'Redondeado'], ['circle', 'Circular'],
    ['ribbon', 'Cinta'], ['banner', 'Bandera'], ['seal', 'Sello'], ['brush', 'Pincel'], ['tag', 'Etiqueta'],
    ['hex', 'Hexágono'], ['arch', 'Arco'], ['cut', 'Esquinas cortadas']];

  function round(n) { return Math.round(n * 100) / 100; }

  /** Devuelve el trazado de la forma, en coordenadas 0..w × 0..h. */
  function shapePath(shape, w, h, radius) {
    w = Math.max(1, w); h = Math.max(1, h);
    var r, i, d, step, points = [];
    switch (shape) {
      case 'rect':
        return 'M0 0 H' + round(w) + ' V' + round(h) + ' H0 Z';
      case 'circle':
        return 'M' + round(w / 2) + ' 0 A' + round(w / 2) + ' ' + round(h / 2) + ' 0 1 1 ' + round(w / 2 - 0.01) + ' 0 Z';
      case 'rounded':
        r = Math.max(0, Math.min(num(radius, 18), w / 2, h / 2));
        return roundedRect(w, h, r);
      case 'pill':
        return roundedRect(w, h, Math.min(w, h) / 2);
      case 'hex':
        var cut = Math.min(w * 0.18, h / 2);
        return 'M' + round(cut) + ' 0 H' + round(w - cut) + ' L' + round(w) + ' ' + round(h / 2) +
          ' L' + round(w - cut) + ' ' + round(h) + ' H' + round(cut) + ' L0 ' + round(h / 2) + ' Z';
      case 'cut':
        var c = Math.min(w * 0.12, h * 0.3);
        return 'M' + round(c) + ' 0 H' + round(w - c) + ' L' + round(w) + ' ' + round(c) + ' V' + round(h - c) +
          ' L' + round(w - c) + ' ' + round(h) + ' H' + round(c) + ' L0 ' + round(h - c) + ' V' + round(c) + ' Z';
      case 'tag':
        var point = Math.min(h * 0.5, w * 0.18);
        return 'M0 0 H' + round(w - point) + ' L' + round(w) + ' ' + round(h / 2) + ' L' + round(w - point) + ' ' + round(h) + ' H0 Z';
      case 'arch':
        r = Math.min(w / 2, h * 0.6);
        return 'M0 ' + round(h) + ' V' + round(r) + ' A' + round(w / 2) + ' ' + round(r) + ' 0 0 1 ' + round(w) + ' ' + round(r) +
          ' V' + round(h) + ' Z';
      case 'banner':
        // rectángulo con los extremos en V hacia dentro
        var v = Math.min(w * 0.12, h * 0.45);
        return 'M0 0 H' + round(w) + ' L' + round(w - v) + ' ' + round(h / 2) + ' L' + round(w) + ' ' + round(h) +
          ' H0 L' + round(v) + ' ' + round(h / 2) + ' Z';
      case 'ribbon':
        // cuerpo central con dos colas; el cuerpo ocupa el 78 % del ancho
        var tail = w * 0.11, bodyTop = h * 0.14, bodyBot = h * 0.86;
        return 'M' + round(tail) + ' ' + round(bodyTop) +
          ' Q' + round(w / 2) + ' ' + round(bodyTop - h * 0.12) + ' ' + round(w - tail) + ' ' + round(bodyTop) +
          ' L' + round(w) + ' ' + round(h * 0.04) + ' L' + round(w - tail * 0.45) + ' ' + round(h / 2) +
          ' L' + round(w) + ' ' + round(h * 0.96) + ' L' + round(w - tail) + ' ' + round(bodyBot) +
          ' Q' + round(w / 2) + ' ' + round(bodyBot + h * 0.12) + ' ' + round(tail) + ' ' + round(bodyBot) +
          ' L0 ' + round(h * 0.96) + ' L' + round(tail * 0.45) + ' ' + round(h / 2) + ' L0 ' + round(h * 0.04) + ' Z';
      case 'seal':
        // sello de cera: círculo con borde ondulado
        var cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2, n = 14;
        d = '';
        for (i = 0; i <= n; i++) {
          var a = (i / n) * Math.PI * 2;
          var wob = 1 - (i % 2 === 0 ? 0.055 : 0);
          var px = cx + Math.cos(a) * rx * wob, py = cy + Math.sin(a) * ry * wob;
          d += (i === 0 ? 'M' : 'L') + round(px) + ' ' + round(py);
        }
        return d + ' Z';
      case 'brush':
        // trazo de pincel: bordes irregulares arriba y abajo
        var top = [0.30, 0.10, 0.17, 0.07, 0.14, 0.05, 0.12], bot = [0.72, 0.93, 0.86, 0.96, 0.88, 0.97, 0.70];
        d = 'M0 ' + round(h * 0.42);
        step = w / (top.length - 1);
        for (i = 0; i < top.length; i++) d += ' L' + round(i * step) + ' ' + round(h * top[i]);
        d += ' L' + round(w) + ' ' + round(h * 0.58);
        for (i = bot.length - 1; i >= 0; i--) d += ' L' + round(i * step) + ' ' + round(h * bot[i]);
        return d + ' Z';
      default:
        return roundedRect(w, h, Math.min(w, h) / 2);
    }
  }

  function roundedRect(w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    if (!r) return 'M0 0 H' + round(w) + ' V' + round(h) + ' H0 Z';
    return 'M' + round(r) + ' 0 H' + round(w - r) + ' A' + round(r) + ' ' + round(r) + ' 0 0 1 ' + round(w) + ' ' + round(r) +
      ' V' + round(h - r) + ' A' + round(r) + ' ' + round(r) + ' 0 0 1 ' + round(w - r) + ' ' + round(h) +
      ' H' + round(r) + ' A' + round(r) + ' ' + round(r) + ' 0 0 1 0 ' + round(h - r) +
      ' V' + round(r) + ' A' + round(r) + ' ' + round(r) + ' 0 0 1 ' + round(r) + ' 0 Z';
  }

  // ================================================================ texturas y acabados
  var TEXTURES = [['none', 'Sin textura'], ['paper', 'Papel'], ['wood', 'Madera'], ['metal', 'Metal'],
    ['glass', 'Cristal'], ['grain', 'Grano'], ['marble', 'Mármol'], ['fabric', 'Tela']];

  /** Crea en «defs» el filtro de ruido de una textura y devuelve su id, o '' si no hace falta. */
  function textureFilter(doc, defs, id, kind) {
    if (!defs || !kind || kind === 'none' || kind === 'metal' || kind === 'glass') return '';
    var filter = svgEl(doc, 'filter', { id: id, x: '-2%', y: '-2%', width: '104%', height: '104%' }, defs);
    var freq = { paper: '0.9', wood: '0.015 0.75', grain: '1.6', marble: '0.03', fabric: '0.5 0.9' }[kind] || '0.9';
    var octaves = { paper: '4', wood: '3', grain: '2', marble: '4', fabric: '2' }[kind] || '3';
    svgEl(doc, 'feTurbulence', { type: kind === 'marble' ? 'turbulence' : 'fractalNoise', baseFrequency: freq,
      numOctaves: octaves, seed: '7', result: 'n' }, filter);
    // el ruido pasa a gris translúcido…
    svgEl(doc, 'feColorMatrix', { 'in': 'n', type: 'matrix', result: 'g',
      values: '0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.6 0' }, filter);
    // …y se recorta a la silueta del botón, para que no manche alrededor
    svgEl(doc, 'feComposite', { operator: 'in', 'in': 'g', in2: 'SourceAlpha', result: 'gin' }, filter);
    svgEl(doc, 'feBlend', { 'in': 'SourceGraphic', in2: 'gin', mode: kind === 'wood' ? 'multiply' : 'overlay' }, filter);
    return id;
  }

  /** Pintura del cuerpo: color plano, degradado o acabado metálico / de cristal. */
  function bodyPaint(doc, defs, id, b, w, h) {
    var kind = b.texture;
    if (kind === 'metal' || kind === 'glass' || b.gradient) {
      var angle = kind === 'glass' ? 90 : num(b.gradAngle, 90);
      var rad = (angle - 90) * Math.PI / 180;
      var grad = svgEl(doc, 'linearGradient', { id: id, x1: round(50 - Math.cos(rad) * 50) + '%', y1: round(50 - Math.sin(rad) * 50) + '%',
        x2: round(50 + Math.cos(rad) * 50) + '%', y2: round(50 + Math.sin(rad) * 50) + '%' }, defs);
      var a = b.fill, z = b.gradient ? b.fill2 : b.fill;
      if (kind === 'metal') {
        svgEl(doc, 'stop', { offset: '0%', 'stop-color': shade(a, -18) }, grad);
        svgEl(doc, 'stop', { offset: '18%', 'stop-color': shade(a, 22) }, grad);
        svgEl(doc, 'stop', { offset: '42%', 'stop-color': shade(z, -6) }, grad);
        svgEl(doc, 'stop', { offset: '58%', 'stop-color': shade(z, 14) }, grad);
        svgEl(doc, 'stop', { offset: '100%', 'stop-color': shade(a, -24) }, grad);
      } else if (kind === 'glass') {
        svgEl(doc, 'stop', { offset: '0%', 'stop-color': shade(a, 34), 'stop-opacity': '0.95' }, grad);
        svgEl(doc, 'stop', { offset: '55%', 'stop-color': a, 'stop-opacity': '0.62' }, grad);
        svgEl(doc, 'stop', { offset: '100%', 'stop-color': shade(z, -10), 'stop-opacity': '0.78' }, grad);
      } else {
        svgEl(doc, 'stop', { offset: '0%', 'stop-color': a }, grad);
        svgEl(doc, 'stop', { offset: '100%', 'stop-color': z }, grad);
      }
      return 'url(#' + id + ')';
    }
    return b.fill;
  }

  /** Aclara (+) u oscurece (−) un color #rrggbb en porcentaje. */
  function shade(hex, percent) {
    var color = /^#[0-9a-f]{6}$/i.test(String(hex || '')) ? hex : '#888888';
    var out = '#', i, v;
    for (i = 0; i < 3; i++) {
      v = parseInt(color.substr(1 + i * 2, 2), 16);
      v = Math.round(percent >= 0 ? v + (255 - v) * (percent / 100) : v * (1 + percent / 100));
      out += ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2);
    }
    return out;
  }

  // ================================================================ ornamentos
  var ORNAMENTS = [['none', 'Ninguno'], ['flourish', 'Filigrana lateral'], ['corners', 'Esquinas'],
    ['floral', 'Flores'], ['stars', 'Estrellas'], ['leaves', 'Hojas'], ['stitch', 'Pespunte'], ['studs', 'Remaches']];

  function drawOrnament(doc, parent, kind, w, h, color, opacity) {
    if (!kind || kind === 'none') return;
    var g = svgEl(doc, 'g', { 'class': 'iv-ui-ornament', opacity: String(num(opacity, 0.85)), 'pointer-events': 'none' }, parent);
    var line = { fill: 'none', stroke: color, 'stroke-width': Math.max(1, Math.min(w, h) * 0.022), 'stroke-linecap': 'round' };
    var pad = Math.min(w, h) * 0.16, i;
    if (kind === 'flourish') {
      var fy = h / 2, arm = Math.min(w * 0.13, h * 0.5);
      svgEl(doc, 'path', Object.assign({ d: 'M' + round(pad * 0.5) + ' ' + round(fy) + ' q' + round(arm * 0.5) + ' ' + round(-arm * 0.45) + ' ' + round(arm) + ' 0 q' + round(-arm * 0.5) + ' ' + round(arm * 0.45) + ' ' + round(-arm) + ' 0 Z' }, line), g);
      svgEl(doc, 'path', Object.assign({ d: 'M' + round(w - pad * 0.5) + ' ' + round(fy) + ' q' + round(-arm * 0.5) + ' ' + round(-arm * 0.45) + ' ' + round(-arm) + ' 0 q' + round(arm * 0.5) + ' ' + round(arm * 0.45) + ' ' + round(arm) + ' 0 Z' }, line), g);
    } else if (kind === 'corners') {
      var c = Math.min(w, h) * 0.22;
      var corners = [[pad, pad, 1, 1], [w - pad, pad, -1, 1], [pad, h - pad, 1, -1], [w - pad, h - pad, -1, -1]];
      for (i = 0; i < 4; i++) {
        var p = corners[i];
        svgEl(doc, 'path', Object.assign({ d: 'M' + round(p[0]) + ' ' + round(p[1] + c * p[3]) + ' V' + round(p[1]) + ' H' + round(p[0] + c * p[2]) }, line), g);
      }
    } else if (kind === 'studs') {
      var rr = Math.min(w, h) * 0.055;
      var spots = [[pad, h / 2], [w - pad, h / 2]];
      if (w > h * 2.2) spots = [[pad, pad], [w - pad, pad], [pad, h - pad], [w - pad, h - pad]];
      for (i = 0; i < spots.length; i++) {
        svgEl(doc, 'circle', { cx: round(spots[i][0]), cy: round(spots[i][1]), r: round(rr), fill: color, opacity: '0.75' }, g);
        svgEl(doc, 'circle', { cx: round(spots[i][0] - rr * 0.25), cy: round(spots[i][1] - rr * 0.25), r: round(rr * 0.4), fill: '#ffffff', opacity: '0.35' }, g);
      }
    } else if (kind === 'stitch') {
      var inset = Math.min(w, h) * 0.12;
      svgEl(doc, 'path', { d: roundedRect(w - inset * 2, h - inset * 2, Math.min((h - inset * 2) / 2, 14)),
        transform: 'translate(' + round(inset) + ' ' + round(inset) + ')', fill: 'none', stroke: color,
        'stroke-width': Math.max(1, Math.min(w, h) * 0.018), 'stroke-dasharray': round(Math.min(w, h) * 0.07) + ' ' + round(Math.min(w, h) * 0.05) }, g);
    } else {
      // flores, estrellas y hojas: un adorno a cada lado
      var icon = kind === 'floral' ? 'flower' : kind === 'stars' ? 'star' : 'leaf';
      var size = Math.min(w * 0.16, h * 0.62);
      drawIcon(doc, g, icon, { x: pad * 0.35, y: (h - size) / 2, size: size }, color, 6);
      drawIcon(doc, g, icon, { x: w - pad * 0.35 - size, y: (h - size) / 2, size: size }, color, 6);
    }
  }

  // ================================================================ modelo del botón
  function col(value, fallback) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback; }
  function clamp(v, a, z) { return Math.max(a, Math.min(z, v)); }

  function buttonDefaults() {
    return {
      preset: '', category: '', shape: 'pill', radius: 18,
      label: 'Botón', showLabel: true, font: 'Georgia', fontSize: 30, fontWeight: '600', letterSpacing: 0, textCase: 'none',
      icon: 'none', iconPos: 'right', iconSize: 100, iconWeight: 7,
      fill: '#8b633c', fill2: '#6b4a38', gradient: false, gradAngle: 90, textColor: '#ffffff',
      border: '#d1a56e', borderWidth: 0, borderInset: 0,
      texture: 'none', ornament: 'none', ornamentColor: '#ffffff', ornamentOpacity: 0.85,
      shadowOn: true, shadowX: 0, shadowY: 6, shadowBlur: 14, shadowColor: '#2a1c14', shadowOpacity: 0.3,
      glowOn: false, glowBlur: 16, glowColor: '#c89550', glowOpacity: 0.8,
      innerOn: false, innerBlur: 10, innerColor: '#ffffff', innerOpacity: 0.55,
      hoverFill: '', hoverText: '', hoverBorder: '', hoverScale: 1.03, hoverBrightness: 1.06, hoverGlow: 1,
      pressScale: 0.97, pressBrightness: 0.94, pressShiftY: 2,
      disabledOpacity: 0.45, disabledGray: 0.8,
      transition: 180
    };
  }

  function normalizeButton(source) {
    var d = buttonDefaults(), s = source && typeof source === 'object' ? source : {}, out = {}, k;
    for (k in d) out[k] = d[k];
    out.preset = String(s.preset || '');
    out.category = String(s.category || '');
    out.shape = SHAPES.some(function (x) { return x[0] === s.shape; }) ? s.shape : d.shape;
    out.radius = clamp(num(s.radius, d.radius), 0, 400);
    out.label = s.label === undefined ? d.label : String(s.label).slice(0, 160);
    out.showLabel = s.showLabel !== false;
    out.font = String(s.font || d.font);
    out.fontSize = clamp(num(s.fontSize, d.fontSize), 6, 300);
    out.fontWeight = String(s.fontWeight || d.fontWeight);
    out.letterSpacing = clamp(num(s.letterSpacing, 0), -10, 40);
    out.textCase = ['none', 'upper', 'lower'].indexOf(s.textCase) >= 0 ? s.textCase : 'none';
    out.icon = s.icon && ICONS[s.icon] ? s.icon : 'none';
    out.iconPos = ['left', 'right', 'only', 'top'].indexOf(s.iconPos) >= 0 ? s.iconPos : d.iconPos;
    out.iconSize = clamp(num(s.iconSize, d.iconSize), 20, 300);
    out.iconWeight = clamp(num(s.iconWeight, d.iconWeight), 2, 14);
    out.fill = col(s.fill, d.fill); out.fill2 = col(s.fill2, d.fill2);
    out.gradient = !!s.gradient; out.gradAngle = clamp(num(s.gradAngle, 90), 0, 360);
    out.textColor = col(s.textColor, d.textColor);
    out.border = col(s.border, d.border); out.borderWidth = clamp(num(s.borderWidth, 0), 0, 40);
    out.borderInset = clamp(num(s.borderInset, 0), 0, 40);
    out.texture = TEXTURES.some(function (x) { return x[0] === s.texture; }) ? s.texture : 'none';
    out.ornament = ORNAMENTS.some(function (x) { return x[0] === s.ornament; }) ? s.ornament : 'none';
    out.ornamentColor = col(s.ornamentColor, d.ornamentColor);
    out.ornamentOpacity = clamp(num(s.ornamentOpacity, d.ornamentOpacity), 0, 1);
    out.shadowOn = s.shadowOn !== false && s.shadowOn !== undefined ? !!s.shadowOn : (s.shadowOn === undefined ? d.shadowOn : false);
    out.shadowX = clamp(num(s.shadowX, d.shadowX), -60, 60);
    out.shadowY = clamp(num(s.shadowY, d.shadowY), -60, 60);
    out.shadowBlur = clamp(num(s.shadowBlur, d.shadowBlur), 0, 120);
    out.shadowColor = col(s.shadowColor, d.shadowColor);
    out.shadowOpacity = clamp(num(s.shadowOpacity, d.shadowOpacity), 0, 1);
    out.glowOn = !!s.glowOn; out.glowBlur = clamp(num(s.glowBlur, d.glowBlur), 0, 120);
    out.glowColor = col(s.glowColor, d.glowColor); out.glowOpacity = clamp(num(s.glowOpacity, d.glowOpacity), 0, 1);
    out.innerOn = !!s.innerOn; out.innerBlur = clamp(num(s.innerBlur, d.innerBlur), 0, 120);
    out.innerColor = col(s.innerColor, d.innerColor); out.innerOpacity = clamp(num(s.innerOpacity, d.innerOpacity), 0, 1);
    out.hoverFill = s.hoverFill ? col(s.hoverFill, '') : '';
    out.hoverText = s.hoverText ? col(s.hoverText, '') : '';
    out.hoverBorder = s.hoverBorder ? col(s.hoverBorder, '') : '';
    out.hoverScale = clamp(num(s.hoverScale, d.hoverScale), 0.8, 1.4);
    out.hoverBrightness = clamp(num(s.hoverBrightness, d.hoverBrightness), 0.5, 2);
    out.hoverGlow = clamp(num(s.hoverGlow, d.hoverGlow), 0, 3);
    out.pressScale = clamp(num(s.pressScale, d.pressScale), 0.8, 1.2);
    out.pressBrightness = clamp(num(s.pressBrightness, d.pressBrightness), 0.5, 2);
    out.pressShiftY = clamp(num(s.pressShiftY, d.pressShiftY), -20, 20);
    out.disabledOpacity = clamp(num(s.disabledOpacity, d.disabledOpacity), 0.05, 1);
    out.disabledGray = clamp(num(s.disabledGray, d.disabledGray), 0, 1);
    out.transition = clamp(num(s.transition, d.transition), 0, 2000);
    return out;
  }

  /**
   * Dibuja el botón. opts: { defs, idPrefix, state: 'normal'|'hover'|'pressed'|'disabled', fontStack }
   * Devuelve las piezas para que quien lo use pueda animarlas sin volver a dibujar.
   */
  function drawUiButton(doc, o, parent, opts) {
    opts = opts || {};
    var b = normalizeButton(o && o.btn);
    var w = Math.max(1, num(o.w, 200)), h = Math.max(1, num(o.h, 70));
    var state = opts.state || 'normal';
    var prefix = (opts.idPrefix || ('b' + (++uid))) + '_';
    var defs = opts.defs || svgEl(doc, 'defs', {}, parent);
    var g = svgEl(doc, 'g', { 'class': 'iv-ui-btn-figure' }, parent);
    var parts = { group: g, config: b };

    // estado: hover y presionado pueden cambiar el color
    var fill = state === 'hover' && b.hoverFill ? b.hoverFill : b.fill;
    var textColor = state === 'hover' && b.hoverText ? b.hoverText : b.textColor;
    var border = state === 'hover' && b.hoverBorder ? b.hoverBorder : b.border;
    var painted = { fill: fill, fill2: b.fill2, gradient: b.gradient, gradAngle: b.gradAngle, texture: b.texture };

    var inset = b.borderInset;
    var bw = b.borderWidth;
    var innerW = Math.max(1, w - inset * 2), innerH = Math.max(1, h - inset * 2);
    var d = shapePath(b.shape, innerW, innerH, b.radius);
    var shift = 'translate(' + round(inset) + ' ' + round(inset) + ')';

    // sombra exterior y resplandor, como capas debajo del cuerpo
    if (b.shadowOn && b.shadowOpacity > 0) {
      var sId = prefix + 'sh';
      var f = svgEl(doc, 'filter', { id: sId, x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
      svgEl(doc, 'feGaussianBlur', { stdDeviation: round(Math.max(0.01, b.shadowBlur / 2)) }, f);
      parts.shadow = svgEl(doc, 'path', { d: d, transform: 'translate(' + round(inset + b.shadowX) + ' ' + round(inset + b.shadowY) + ')',
        fill: b.shadowColor, opacity: String(b.shadowOpacity), filter: 'url(#' + sId + ')', 'pointer-events': 'none' }, g);
    }
    if (b.glowOn && b.glowOpacity > 0) {
      var gId = prefix + 'gl';
      var fg = svgEl(doc, 'filter', { id: gId, x: '-60%', y: '-60%', width: '220%', height: '220%' }, defs);
      svgEl(doc, 'feGaussianBlur', { stdDeviation: round(Math.max(0.01, b.glowBlur / 2)) }, fg);
      parts.glow = svgEl(doc, 'path', { d: d, transform: shift, fill: b.glowColor,
        opacity: String(b.glowOpacity * (state === 'hover' ? b.hoverGlow : 1)), filter: 'url(#' + gId + ')',
        'class': 'iv-ui-glow', 'pointer-events': 'none' }, g);
    }

    // cuerpo
    var paint = bodyPaint(doc, defs, prefix + 'p', painted, innerW, innerH);
    var bodyAttrs = { d: d, transform: shift, fill: paint, 'class': 'iv-ui-body' };
    var texId = textureFilter(doc, defs, prefix + 'tx', b.texture);
    if (texId) bodyAttrs.filter = 'url(#' + texId + ')';
    parts.body = svgEl(doc, 'path', bodyAttrs, g);

    // brillo del cristal y del metal: una banda clara en la parte superior
    if (b.texture === 'glass' || b.texture === 'metal') {
      var hlId = prefix + 'hl';
      var hg = svgEl(doc, 'linearGradient', { id: hlId, x1: '0%', y1: '0%', x2: '0%', y2: '100%' }, defs);
      svgEl(doc, 'stop', { offset: '0%', 'stop-color': '#ffffff', 'stop-opacity': b.texture === 'glass' ? '0.55' : '0.4' }, hg);
      svgEl(doc, 'stop', { offset: '100%', 'stop-color': '#ffffff', 'stop-opacity': '0' }, hg);
      svgEl(doc, 'path', { d: shapePath(b.shape, innerW, innerH * 0.52, Math.min(b.radius, innerH * 0.26)), transform: shift,
        fill: 'url(#' + hlId + ')', 'pointer-events': 'none' }, g);
    }

    // sombra interior (neumorfismo y hundidos)
    if (b.innerOn && b.innerOpacity > 0) {
      var iId = prefix + 'in';
      var fi = svgEl(doc, 'filter', { id: iId, x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
      svgEl(doc, 'feGaussianBlur', { 'in': 'SourceAlpha', stdDeviation: round(Math.max(0.01, b.innerBlur / 2)), result: 'bl' }, fi);
      svgEl(doc, 'feOffset', { 'in': 'bl', dx: '0', dy: round(b.innerBlur * 0.25), result: 'of' }, fi);
      svgEl(doc, 'feComposite', { operator: 'arithmetic', k2: '-1', k3: '1', 'in': 'SourceAlpha', in2: 'of', result: 'ring' }, fi);
      svgEl(doc, 'feFlood', { 'flood-color': b.innerColor, 'flood-opacity': String(b.innerOpacity), result: 'c' }, fi);
      svgEl(doc, 'feComposite', { operator: 'in', 'in': 'c', in2: 'ring' }, fi);
      svgEl(doc, 'path', { d: d, transform: shift, fill: '#000', filter: 'url(#' + iId + ')', 'pointer-events': 'none' }, g);
    }

    // borde
    if (bw > 0) {
      parts.border = svgEl(doc, 'path', { d: d, transform: shift, fill: 'none', stroke: border, 'stroke-width': round(bw),
        'class': 'iv-ui-border', 'pointer-events': 'none' }, g);
    }

    drawOrnament(doc, g, b.ornament, w, h, b.ornamentColor, b.ornamentOpacity);

    // contenido: icono y texto
    var content = svgEl(doc, 'g', { 'class': 'iv-ui-content', 'pointer-events': 'none' }, g);
    parts.content = content;
    var label = b.showLabel ? applyCase(b.label, b.textCase) : '';
    var iconSize = Math.min(h * 0.52, w * 0.52) * (b.iconSize / 100);
    var hasIcon = b.icon && b.icon !== 'none' && b.iconPos !== 'none';
    var gap = hasIcon && label ? Math.min(w * 0.05, 18) : 0;
    var textW = label ? measure(label, b.fontSize, b.letterSpacing, opts.measure, b.font, b.fontWeight) : 0;
    var totalW = textW + (hasIcon && b.iconPos !== 'only' ? iconSize + gap : 0);
    var cx = w / 2, cy = h / 2;

    if (hasIcon && (b.iconPos === 'only' || !label)) {
      parts.icon = drawIcon(doc, content, b.icon, { x: cx - iconSize / 2, y: cy - iconSize / 2, size: iconSize }, textColor, b.iconWeight);
    } else {
      var startX = cx - totalW / 2;
      if (hasIcon && b.iconPos === 'left') {
        parts.icon = drawIcon(doc, content, b.icon, { x: startX, y: cy - iconSize / 2, size: iconSize }, textColor, b.iconWeight);
        startX += iconSize + gap;
      }
      if (hasIcon && b.iconPos === 'top') {
        parts.icon = drawIcon(doc, content, b.icon, { x: cx - iconSize / 2, y: cy - iconSize - h * 0.04, size: iconSize }, textColor, b.iconWeight);
        cy = cy + iconSize * 0.55;
        startX = cx - textW / 2;
      }
      if (label) {
        parts.text = svgEl(doc, 'text', { x: round(b.iconPos === 'right' || b.iconPos === 'left' || b.iconPos === 'top' ? startX : cx - textW / 2),
          y: round(cy + b.fontSize * 0.35), fill: textColor, 'font-family': opts.fontStack ? opts.fontStack(b.font) : fontStack(b.font),
          'font-size': round(b.fontSize), 'font-weight': b.fontWeight, 'letter-spacing': round(b.letterSpacing),
          'class': 'iv-ui-text', 'xml:space': 'preserve' }, content);
        parts.text.textContent = label;
        startX += textW + gap;
      }
      if (hasIcon && b.iconPos === 'right') {
        parts.icon = drawIcon(doc, content, b.icon, { x: startX, y: cy - iconSize / 2, size: iconSize }, textColor, b.iconWeight);
      }
    }

    if (state === 'disabled') {
      g.setAttribute('opacity', String(b.disabledOpacity));
      if (b.disabledGray > 0) {
        var dId = prefix + 'ds';
        var fd = svgEl(doc, 'filter', { id: dId }, defs);
        svgEl(doc, 'feColorMatrix', { type: 'saturate', values: String(1 - b.disabledGray) }, fd);
        g.setAttribute('filter', 'url(#' + dId + ')');
      }
    }
    if (state === 'pressed') g.setAttribute('transform', 'translate(0 ' + round(b.pressShiftY) + ')');
    return parts;
  }

  function applyCase(text, mode) {
    var value = String(text === undefined || text === null ? '' : text);
    return mode === 'upper' ? value.toUpperCase() : mode === 'lower' ? value.toLowerCase() : value;
  }
  /**
   * Ancho del texto. Si quien dibuja aporta una función de medida real (opts.measure), se usa esa; si no,
   * una estimación suficiente para centrar. Así el editor y la invitación colocan el contenido igual.
   */
  function measure(text, size, spacing, fn, font, weight) {
    if (typeof fn === 'function') {
      var real = fn(String(text), size, font, weight);
      if (Number.isFinite(real) && real > 0) return real + Math.max(0, String(text).length - 1) * num(spacing, 0);
    }
    return String(text).length * size * 0.52 + Math.max(0, String(text).length - 1) * num(spacing, 0);
  }
  function fontStack(name) { return R.fontStack ? R.fontStack(name) : '"' + name + '", Georgia, serif'; }

  // ================================================================ interruptores
  var KNOBS = [['circle', 'Circular'], ['rounded', 'Redondeado'], ['square', 'Cuadrado'], ['lever', 'Palanca']];
  var SWITCH_STYLES = [['slide', 'Deslizable'], ['lever', 'Palanquita']];

  function switchDefaults() {
    return {
      preset: '', family: '', style: 'slide', on: false, remember: true,
      trackShape: 'pill', trackRadius: 999, trackTexture: 'none', trackBorder: '#d6c6b2', trackBorderWidth: 0,
      onFill: '#5d7a52', onFill2: '#4a6342', onGradient: false, onText: 'ON', onTextColor: '#ffffff', onIcon: 'none',
      offFill: '#cfc5b8', offFill2: '#b8ada0', offGradient: false, offText: 'OFF', offTextColor: '#6b5f52', offIcon: 'none',
      showLabels: true, font: 'Georgia', fontSize: 22, fontWeight: '600',
      knobShape: 'circle', knobFill: '#ffffff', knobFill2: '#e8e2d8', knobGradient: true, knobBorder: '#c9bba9',
      knobBorderWidth: 0, knobInset: 6, knobIcon: 'none', knobIconColor: '#8b7a66',
      leverLength: 62, leverBallSize: 46, leverColor: '#c0a060',
      shadowOn: true, shadowY: 4, shadowBlur: 10, shadowColor: '#2a1c14', shadowOpacity: 0.28,
      glowOn: false, glowColor: '#9fd0ff', glowBlur: 14, glowOpacity: 0.85,
      innerOn: true, innerBlur: 9, innerColor: '#000000', innerOpacity: 0.22,
      ornament: 'none', ornamentColor: '#ffffff',
      transition: 260
    };
  }

  function normalizeSwitch(source) {
    var d = switchDefaults(), s = source && typeof source === 'object' ? source : {}, out = {}, k;
    for (k in d) out[k] = d[k];
    out.preset = String(s.preset || ''); out.family = String(s.family || '');
    out.style = SWITCH_STYLES.some(function (x) { return x[0] === s.style; }) ? s.style : d.style;
    out.on = !!s.on; out.remember = s.remember !== false;
    out.trackShape = SHAPES.some(function (x) { return x[0] === s.trackShape; }) ? s.trackShape : d.trackShape;
    out.trackRadius = clamp(num(s.trackRadius, d.trackRadius), 0, 999);
    out.trackTexture = TEXTURES.some(function (x) { return x[0] === s.trackTexture; }) ? s.trackTexture : 'none';
    out.trackBorder = col(s.trackBorder, d.trackBorder);
    out.trackBorderWidth = clamp(num(s.trackBorderWidth, 0), 0, 30);
    out.onFill = col(s.onFill, d.onFill); out.onFill2 = col(s.onFill2, d.onFill2); out.onGradient = !!s.onGradient;
    out.onText = s.onText === undefined ? d.onText : String(s.onText).slice(0, 40);
    out.onTextColor = col(s.onTextColor, d.onTextColor);
    out.onIcon = s.onIcon && ICONS[s.onIcon] ? s.onIcon : 'none';
    out.offFill = col(s.offFill, d.offFill); out.offFill2 = col(s.offFill2, d.offFill2); out.offGradient = !!s.offGradient;
    out.offText = s.offText === undefined ? d.offText : String(s.offText).slice(0, 40);
    out.offTextColor = col(s.offTextColor, d.offTextColor);
    out.offIcon = s.offIcon && ICONS[s.offIcon] ? s.offIcon : 'none';
    out.showLabels = s.showLabels !== false;
    out.font = String(s.font || d.font);
    out.fontSize = clamp(num(s.fontSize, d.fontSize), 6, 200);
    out.fontWeight = String(s.fontWeight || d.fontWeight);
    out.knobShape = KNOBS.some(function (x) { return x[0] === s.knobShape; }) ? s.knobShape : d.knobShape;
    out.knobFill = col(s.knobFill, d.knobFill); out.knobFill2 = col(s.knobFill2, d.knobFill2);
    out.knobGradient = s.knobGradient !== false;
    out.knobBorder = col(s.knobBorder, d.knobBorder);
    out.knobBorderWidth = clamp(num(s.knobBorderWidth, 0), 0, 20);
    out.knobInset = clamp(num(s.knobInset, d.knobInset), 0, 60);
    out.knobIcon = s.knobIcon && ICONS[s.knobIcon] ? s.knobIcon : 'none';
    out.knobIconColor = col(s.knobIconColor, d.knobIconColor);
    out.leverLength = clamp(num(s.leverLength, d.leverLength), 10, 160);
    out.leverBallSize = clamp(num(s.leverBallSize, d.leverBallSize), 10, 160);
    out.leverColor = col(s.leverColor, d.leverColor);
    out.shadowOn = s.shadowOn !== false;
    out.shadowY = clamp(num(s.shadowY, d.shadowY), -40, 40);
    out.shadowBlur = clamp(num(s.shadowBlur, d.shadowBlur), 0, 80);
    out.shadowColor = col(s.shadowColor, d.shadowColor);
    out.shadowOpacity = clamp(num(s.shadowOpacity, d.shadowOpacity), 0, 1);
    out.glowOn = !!s.glowOn; out.glowColor = col(s.glowColor, d.glowColor);
    out.glowBlur = clamp(num(s.glowBlur, d.glowBlur), 0, 80);
    out.glowOpacity = clamp(num(s.glowOpacity, d.glowOpacity), 0, 1);
    out.innerOn = s.innerOn !== false;
    out.innerBlur = clamp(num(s.innerBlur, d.innerBlur), 0, 60);
    out.innerColor = col(s.innerColor, d.innerColor);
    out.innerOpacity = clamp(num(s.innerOpacity, d.innerOpacity), 0, 1);
    out.ornament = ORNAMENTS.some(function (x) { return x[0] === s.ornament; }) ? s.ornament : 'none';
    out.ornamentColor = col(s.ornamentColor, d.ornamentColor);
    out.transition = clamp(num(s.transition, d.transition), 0, 3000);
    return out;
  }

  /**
   * Dibuja el interruptor en el estado indicado por opts.on (si no se indica, el del propio objeto).
   * Devuelve las piezas, incluida la parte móvil, para poder animarla al cambiar de estado.
   */
  function drawSwitch(doc, o, parent, opts) {
    opts = opts || {};
    var s = normalizeSwitch(o && o.sw);
    var on = opts.on === undefined ? s.on : !!opts.on;
    var w = Math.max(1, num(o.w, 200)), h = Math.max(1, num(o.h, 90));
    var prefix = (opts.idPrefix || ('s' + (++uid))) + '_';
    var defs = opts.defs || svgEl(doc, 'defs', {}, parent);
    var g = svgEl(doc, 'g', { 'class': 'iv-ui-switch-figure' }, parent);
    var parts = { group: g, config: s, on: on };

    var fill = on ? s.onFill : s.offFill, fill2 = on ? s.onFill2 : s.offFill2;
    var gradient = on ? s.onGradient : s.offGradient;
    var trackD = shapePath(s.trackShape, w, h, s.trackShape === 'pill' ? h / 2 : s.trackRadius);

    if (s.shadowOn && s.shadowOpacity > 0) {
      var shId = prefix + 'sh';
      var fs = svgEl(doc, 'filter', { id: shId, x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
      svgEl(doc, 'feGaussianBlur', { stdDeviation: round(Math.max(0.01, s.shadowBlur / 2)) }, fs);
      svgEl(doc, 'path', { d: trackD, transform: 'translate(0 ' + round(s.shadowY) + ')', fill: s.shadowColor,
        opacity: String(s.shadowOpacity), filter: 'url(#' + shId + ')', 'pointer-events': 'none' }, g);
    }
    if (s.glowOn && on && s.glowOpacity > 0) {
      var glId = prefix + 'gl';
      var fgl = svgEl(doc, 'filter', { id: glId, x: '-60%', y: '-60%', width: '220%', height: '220%' }, defs);
      svgEl(doc, 'feGaussianBlur', { stdDeviation: round(Math.max(0.01, s.glowBlur / 2)) }, fgl);
      parts.glow = svgEl(doc, 'path', { d: trackD, fill: s.glowColor, opacity: String(s.glowOpacity),
        filter: 'url(#' + glId + ')', 'class': 'iv-ui-glow', 'pointer-events': 'none' }, g);
    }

    var trackPaint = bodyPaint(doc, defs, prefix + 'tp', { fill: fill, fill2: fill2, gradient: gradient, gradAngle: 90, texture: s.trackTexture }, w, h);
    var trackAttrs = { d: trackD, fill: trackPaint, 'class': 'iv-ui-track' };
    var ttex = textureFilter(doc, defs, prefix + 'tt', s.trackTexture);
    if (ttex) trackAttrs.filter = 'url(#' + ttex + ')';
    parts.track = svgEl(doc, 'path', trackAttrs, g);

    if (s.innerOn && s.innerOpacity > 0) {
      var inId = prefix + 'in';
      var fin = svgEl(doc, 'filter', { id: inId, x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
      svgEl(doc, 'feGaussianBlur', { 'in': 'SourceAlpha', stdDeviation: round(Math.max(0.01, s.innerBlur / 2)), result: 'bl' }, fin);
      svgEl(doc, 'feOffset', { 'in': 'bl', dx: '0', dy: round(s.innerBlur * 0.3), result: 'of' }, fin);
      svgEl(doc, 'feComposite', { operator: 'arithmetic', k2: '-1', k3: '1', 'in': 'SourceAlpha', in2: 'of', result: 'ring' }, fin);
      svgEl(doc, 'feFlood', { 'flood-color': s.innerColor, 'flood-opacity': String(s.innerOpacity), result: 'c' }, fin);
      svgEl(doc, 'feComposite', { operator: 'in', 'in': 'c', in2: 'ring' }, fin);
      svgEl(doc, 'path', { d: trackD, fill: '#000', filter: 'url(#' + inId + ')', 'pointer-events': 'none' }, g);
    }
    if (s.trackBorderWidth > 0) svgEl(doc, 'path', { d: trackD, fill: 'none', stroke: s.trackBorder,
      'stroke-width': round(s.trackBorderWidth), 'pointer-events': 'none' }, g);

    drawOrnament(doc, g, s.ornament, w, h, s.ornamentColor, 0.8);

    var inset = s.knobInset;
    var knobSize = Math.max(4, h - inset * 2);
    var travel = Math.max(0, w - knobSize - inset * 2);
    var knobX = inset + (on ? travel : 0);

    // texto y símbolo del estado, en el lado contrario al mando
    if (s.showLabels) {
      var text = on ? s.onText : s.offText;
      var textColor = on ? s.onTextColor : s.offTextColor;
      var icon = on ? s.onIcon : s.offIcon;
      var labelCx = on ? inset + (w - knobSize - inset * 2) * 0.42 : w - inset - (w - knobSize - inset * 2) * 0.42;
      if (icon && icon !== 'none') {
        var isz = Math.min(h * 0.5, 40);
        drawIcon(doc, g, icon, { x: labelCx - isz / 2, y: h / 2 - isz / 2, size: isz }, textColor, 7);
      } else if (text) {
        var t = svgEl(doc, 'text', { x: round(labelCx), y: round(h / 2 + s.fontSize * 0.35), fill: textColor,
          'text-anchor': 'middle', 'font-family': opts.fontStack ? opts.fontStack(s.font) : fontStack(s.font),
          'font-size': round(s.fontSize), 'font-weight': s.fontWeight, 'class': 'iv-ui-switch-text',
          'pointer-events': 'none', 'xml:space': 'preserve' }, g);
        t.textContent = text;
        parts.label = t;
      }
    }

    // mando
    var knob = svgEl(doc, 'g', { 'class': 'iv-ui-knob', 'pointer-events': 'none' }, g);
    parts.knob = knob;
    parts.travel = travel;
    parts.knobSize = knobSize;
    parts.inset = inset;
    knob.setAttribute('transform', 'translate(' + round(knobX) + ' ' + round(inset) + ')');

    if (s.style === 'lever') {
      // palanquita: base hundida, brazo inclinado y bola en la punta
      var baseR = knobSize * 0.42;
      var pivotX = knobSize / 2, pivotY = knobSize / 2;
      svgEl(doc, 'ellipse', { cx: round(pivotX), cy: round(pivotY), rx: round(baseR), ry: round(baseR * 0.95),
        fill: shade(s.leverColor, -32), opacity: '0.55' }, knob);
      var len = knobSize * (s.leverLength / 100) * 1.6;
      var dir = on ? 1 : -1;
      var tipX = pivotX + dir * len * 0.52, tipY = pivotY - len * 0.46;
      svgEl(doc, 'path', { d: 'M' + round(pivotX) + ' ' + round(pivotY) + ' L' + round(tipX) + ' ' + round(tipY),
        stroke: s.leverColor, 'stroke-width': round(knobSize * 0.2), 'stroke-linecap': 'round', fill: 'none' }, knob);
      var ball = knobSize * (s.leverBallSize / 100) * 0.62;
      var bsId = prefix + 'bs';
      var fbs = svgEl(doc, 'filter', { id: bsId, x: '-60%', y: '-60%', width: '220%', height: '220%' }, defs);
      svgEl(doc, 'feGaussianBlur', { stdDeviation: round(Math.max(0.01, ball * 0.22)) }, fbs);
      svgEl(doc, 'circle', { cx: round(tipX), cy: round(tipY + ball * 0.35), r: round(ball), fill: '#1d140c',
        opacity: '0.35', filter: 'url(#' + bsId + ')' }, knob);
      var bg2 = svgEl(doc, 'radialGradient', { id: prefix + 'lb', cx: '35%', cy: '32%', r: '70%' }, defs);
      svgEl(doc, 'stop', { offset: '0%', 'stop-color': shade(s.leverColor, 42) }, bg2);
      svgEl(doc, 'stop', { offset: '100%', 'stop-color': shade(s.leverColor, -18) }, bg2);
      svgEl(doc, 'circle', { cx: round(tipX), cy: round(tipY), r: round(ball), fill: 'url(#' + prefix + 'lb)' }, knob);
    } else {
      var kd = s.knobShape === 'square' ? shapePath('rect', knobSize, knobSize, 0)
        : s.knobShape === 'rounded' ? shapePath('rounded', knobSize, knobSize, knobSize * 0.28)
          : shapePath('circle', knobSize, knobSize, 0);
      var knobPaint = s.knobFill;
      if (s.knobGradient) {
        var kg = svgEl(doc, 'linearGradient', { id: prefix + 'kg', x1: '0%', y1: '0%', x2: '0%', y2: '100%' }, defs);
        svgEl(doc, 'stop', { offset: '0%', 'stop-color': shade(s.knobFill, 12) }, kg);
        svgEl(doc, 'stop', { offset: '100%', 'stop-color': s.knobFill2 }, kg);
        knobPaint = 'url(#' + prefix + 'kg)';
      }
      var kShadow = prefix + 'ks';
      var fks = svgEl(doc, 'filter', { id: kShadow, x: '-60%', y: '-60%', width: '220%', height: '220%' }, defs);
      svgEl(doc, 'feGaussianBlur', { stdDeviation: round(Math.max(0.01, knobSize * 0.06)) }, fks);
      svgEl(doc, 'path', { d: kd, transform: 'translate(0 ' + round(knobSize * 0.07) + ')', fill: '#2a1c14',
        opacity: '0.3', filter: 'url(#' + kShadow + ')' }, knob);
      svgEl(doc, 'path', { d: kd, fill: knobPaint, stroke: s.knobBorderWidth > 0 ? s.knobBorder : 'none',
        'stroke-width': round(s.knobBorderWidth) }, knob);
      if (s.knobIcon && s.knobIcon !== 'none') {
        var ks = knobSize * 0.5;
        drawIcon(doc, knob, s.knobIcon, { x: (knobSize - ks) / 2, y: (knobSize - ks) / 2, size: ks }, s.knobIconColor, 7);
      }
    }
    return parts;
  }

  // ================================================================ panel administrativo
  var ADMIN_THEMES = { claro: { bg: '#fbf7f1', card: '#ffffff', line: '#e3dacd', text: '#3b2f25', soft: '#8b7a66', head: '#f3ece1' },
    oscuro: { bg: '#241d17', card: '#2e2620', line: '#43372b', text: '#f0e6d8', soft: '#a2927c', head: '#372c23' } };

  /**
   * Dibuja la maqueta del panel administrativo: encabezado, estado de conexión, cifras, buscador, filtros,
   * tabla con las columnas elegidas y formulario. Es el mismo dibujo en el editor y en la previsualización.
   * Los datos que se ven son de muestra y así se indica en el propio panel.
   */
  function drawAdminPanel(doc, o, parent, opts) {
    opts = opts || {};
    var c = o && o.admin ? o.admin : {};
    var ui = c.ui || {}, integration = c.integration || {};
    var theme = ADMIN_THEMES[ui.theme] || ADMIN_THEMES.claro;
    var accent = /^#[0-9a-f]{6}$/i.test(String(ui.accent || '')) ? ui.accent : '#8b633c';
    var w = Math.max(60, num(o.w, 1000)), h = Math.max(60, num(o.h, 1200));
    var g = svgEl(doc, 'g', { 'class': 'iv-admin-figure' }, parent);
    var parts = { group: g };
    var pad = Math.max(14, w * 0.028);
    var font = opts.fontStack ? opts.fontStack(ui.font || 'Georgia') : fontStack(ui.font || 'Georgia');
    var y = 0;

    function text(str, x, yy, size, color, anchor, weight) {
      var t = svgEl(doc, 'text', { x: round(x), y: round(yy), fill: color, 'font-family': font, 'font-size': round(size),
        'font-weight': weight || '400', 'text-anchor': anchor || 'start', 'xml:space': 'preserve', 'pointer-events': 'none' }, g);
      t.textContent = String(str === undefined || str === null ? '' : str);
      return t;
    }
    function card(x, yy, cw, ch, radius, fill, stroke) {
      return svgEl(doc, 'path', { d: roundedRect(cw, ch, radius === undefined ? 10 : radius),
        transform: 'translate(' + round(x) + ' ' + round(yy) + ')', fill: fill || theme.card,
        stroke: stroke || theme.line, 'stroke-width': 1 }, g);
    }

    // fondo
    svgEl(doc, 'path', { d: roundedRect(w, h, 14), fill: theme.bg, stroke: theme.line, 'stroke-width': 1 }, g);

    // encabezado
    var headH = Math.max(52, h * 0.062);
    svgEl(doc, 'path', { d: roundedRect(w, headH, 14), fill: theme.head, stroke: 'none' }, g);
    svgEl(doc, 'rect', { x: 0, y: round(headH - 1), width: round(w), height: 1, fill: theme.line }, g);
    text(ui.title || c.name || 'Panel administrativo', pad, headH * 0.62, Math.min(26, headH * 0.42), theme.text, 'start', '700');

    // chip de estado de conexión
    var statusText = { design: 'Diseño listo', pending: 'Pendiente de conexión', connected: 'Conectado', error: 'Error de conexión' }[integration.status] || 'Diseño listo';
    var statusColor = { design: '#8b7a66', pending: '#b5892f', connected: '#4f7d4a', error: '#a8453c' }[integration.status] || '#8b7a66';
    var chipW = Math.min(w * 0.34, Math.max(140, String(statusText).length * Math.min(11, headH * 0.2)));
    var chipH = Math.max(22, headH * 0.44);
    svgEl(doc, 'path', { d: roundedRect(chipW, chipH, chipH / 2), transform: 'translate(' + round(w - pad - chipW) + ' ' + round((headH - chipH) / 2) + ')',
      fill: statusColor, opacity: '0.14', stroke: statusColor, 'stroke-width': 1 }, g);
    svgEl(doc, 'circle', { cx: round(w - pad - chipW + chipH * 0.55), cy: round(headH / 2), r: round(chipH * 0.16), fill: statusColor }, g);
    text(statusText, w - pad - chipW + chipH * 0.95, headH / 2 + chipH * 0.17, Math.min(13, chipH * 0.46), statusColor, 'start', '600');
    y = headH + pad;

    // cifras
    var stats = (c.views && c.views.stats) || [];
    if (ui.showStats !== false && stats.length) {
      var n = Math.min(4, stats.length), gap = pad * 0.6;
      var sw = (w - pad * 2 - gap * (n - 1)) / n, sh = Math.max(56, h * 0.062);
      for (var i = 0; i < n; i++) {
        var sx = pad + i * (sw + gap);
        card(sx, y, sw, sh, 10);
        text(stats[i].label, sx + sw / 2, y + sh * 0.38, Math.min(12, sh * 0.22), theme.soft, 'middle', '600');
        text('—', sx + sw / 2, y + sh * 0.78, Math.min(22, sh * 0.4), accent, 'middle', '700');
      }
      y += sh + pad;
    }

    // barra de herramientas
    var barH = Math.max(40, h * 0.042);
    if (ui.showSearch !== false || ui.showFilters !== false) {
      var searchW = ui.showSearch === false ? 0 : Math.max(180, w * 0.34);
      if (searchW) {
        card(pad, y, searchW, barH, barH / 2);
        drawIcon(doc, g, 'search', { x: pad + barH * 0.3, y: y + barH * 0.26, size: barH * 0.46 }, theme.soft, 8);
        text('Buscar…', pad + barH * 0.95, y + barH * 0.64, Math.min(14, barH * 0.36), theme.soft);
      }
      var filters = ui.showFilters === false ? [] : ((c.views && c.views.filters) || []).slice(0, 3);
      var fx = pad + (searchW ? searchW + pad * 0.5 : 0);
      for (var k = 0; k < filters.length; k++) {
        var label = (c.fields || []).find(function (f) { return f.key === filters[k]; });
        var fw = Math.max(90, Math.min(160, w * 0.16));
        if (fx + fw > w - pad - 150) break;
        card(fx, y, fw, barH, 8);
        text((label && label.label) || filters[k], fx + fw / 2, y + barH * 0.64, Math.min(13, barH * 0.33), theme.soft, 'middle');
        fx += fw + pad * 0.4;
      }
      // botón de registro nuevo
      var newW = Math.max(130, w * 0.17);
      svgEl(doc, 'path', { d: roundedRect(newW, barH, barH / 2), transform: 'translate(' + round(w - pad - newW) + ' ' + round(y) + ')', fill: accent }, g);
      drawIcon(doc, g, 'plus', { x: w - pad - newW + barH * 0.32, y: y + barH * 0.28, size: barH * 0.42 }, '#ffffff', 9);
      text('Nuevo', w - pad - newW + barH * 0.95, y + barH * 0.64, Math.min(14, barH * 0.35), '#ffffff', 'start', '600');
      y += barH + pad * 0.8;
    }

    // tabla
    var columns = ((c.views && c.views.columns) || []).slice(0, 7);
    var fieldOf = function (key) { return (c.fields || []).find(function (f) { return f.key === key; }) || { key: key, label: key }; };
    var rows = (c.demo || []).slice(0, 6);
    var formH = ui.showForm === false ? 0 : Math.max(150, h * 0.22);
    var tableH = Math.max(100, h - y - pad - (formH ? formH + pad : 0));
    card(pad, y, w - pad * 2, tableH, 10);
    var rowH = Math.max(28, Math.min(44, tableH / Math.max(5, rows.length + 2)));
    svgEl(doc, 'path', { d: roundedRect(w - pad * 2, rowH, 10), transform: 'translate(' + round(pad) + ' ' + round(y) + ')', fill: theme.head, stroke: 'none' }, g);
    var colW = (w - pad * 2) / Math.max(1, columns.length);
    for (var ci = 0; ci < columns.length; ci++) {
      text(fieldOf(columns[ci]).label, pad + colW * ci + 10, y + rowH * 0.66, Math.min(12, rowH * 0.34), theme.soft, 'start', '700');
    }
    for (var ri = 0; ri < rows.length; ri++) {
      var ry = y + rowH * (ri + 1);
      if (ry + rowH > y + tableH) break;
      if (ri % 2) svgEl(doc, 'rect', { x: round(pad + 1), y: round(ry), width: round(w - pad * 2 - 2), height: round(rowH), fill: theme.head, opacity: '0.4' }, g);
      svgEl(doc, 'rect', { x: round(pad + 1), y: round(ry), width: round(w - pad * 2 - 2), height: 1, fill: theme.line, opacity: '0.7' }, g);
      for (var cj = 0; cj < columns.length; cj++) {
        var value = rows[ri][columns[cj]];
        if (value === undefined || value === null || value === '') value = '—';
        if (value === true) value = 'Sí'; else if (value === false) value = 'No';
        var str = String(value);
        var maxChars = Math.max(4, Math.floor(colW / (Math.min(13, rowH * 0.3) * 0.56)));
        if (str.length > maxChars) str = str.slice(0, maxChars - 1) + '…';
        text(str, pad + colW * cj + 10, ry + rowH * 0.66, Math.min(13, rowH * 0.3), theme.text);
      }
    }
    text('Datos de muestra · se sustituyen al conectar el servicio', pad + 10, y + tableH - rowH * 0.3, Math.min(11, rowH * 0.26), theme.soft, 'start', '400');
    y += tableH + pad;

    // formulario
    if (formH) {
      card(pad, y, w - pad * 2, formH, 10);
      text('Nuevo registro', pad + 14, y + Math.min(26, formH * 0.17), Math.min(15, formH * 0.1), theme.text, 'start', '700');
      var visible = (c.fields || []).filter(function (f) { return f.type !== 'id' && !f.readOnly; }).slice(0, 6);
      var cols = 2, fieldW = (w - pad * 2 - 28 - 12) / cols, fieldH = Math.max(32, (formH - 54) / Math.ceil(visible.length / cols) - 10);
      for (var fi = 0; fi < visible.length; fi++) {
        var fx2 = pad + 14 + (fi % cols) * (fieldW + 12);
        var fy2 = y + Math.min(40, formH * 0.26) + Math.floor(fi / cols) * (fieldH + 10);
        if (fy2 + fieldH > y + formH - 8) break;
        text(visible[fi].label + (visible[fi].required ? ' *' : ''), fx2, fy2 - 4, Math.min(11, fieldH * 0.3), theme.soft);
        card(fx2, fy2, fieldW, fieldH, 7, theme.bg);
      }
    }
    return parts;
  }

  return {
    ICONS: ICONS, iconNames: iconNames, drawIcon: drawIcon, drawAdminPanel: drawAdminPanel, ADMIN_THEMES: ADMIN_THEMES,
    SHAPES: SHAPES, TEXTURES: TEXTURES, ORNAMENTS: ORNAMENTS, KNOBS: KNOBS, SWITCH_STYLES: SWITCH_STYLES,
    shapePath: shapePath, roundedRect: roundedRect, shade: shade,
    buttonDefaults: buttonDefaults, normalizeButton: normalizeButton, drawUiButton: drawUiButton,
    switchDefaults: switchDefaults, normalizeSwitch: normalizeSwitch, drawSwitch: drawSwitch
  };
};

var ivWebRuntime = function ivWebRuntime(R, UI) {
  'use strict';
  var design = window.INVITAVECTOR_DESIGN;
  if (!design) return;
  var options = window.INVITAVECTOR_OPTIONS || {};
  var doc = document, body = doc.body, settings = design.pageSettings || {}, spaces = design.workspaces || {};
  var vista = options.vista || '';
  try { vista = vista || new URLSearchParams(window.location.search).get('vista') || ''; } catch (error) { /* sin parámetros */ }
  var elements = {}, objectRecords = [], popupGroups = {}, pendingVisibleEffects = [], opened = false, readyListeners = [];
  var musicRecords = [];

  function px(value) { return (Math.round(R.num(value) * 1000) / 1000) + 'px'; }

  /* ================================================================ REPRODUCTOR DE MÚSICA
   * Una sola instancia por invitación: si hay varios botones, todos controlan este reproductor y reflejan su
   * estado, de modo que nunca suenan dos pistas a la vez. El navegador decide si permite sonar sin que el
   * invitado toque antes la pantalla; cuando lo impide, el botón queda a la espera y se intenta de nuevo con
   * el primer toque. Nunca se da por hecho que la música sonará sola.
   */
  var player = (function () {
    var audio = null, src = '', ownerId = '', blocked = false, failed = '', listeners = [], armed = false;

    function ensure() {
      if (audio) return audio;
      audio = doc.createElement('audio');
      audio.preload = 'metadata';
      audio.setAttribute('playsinline', '');
      audio.addEventListener('play', emit);
      audio.addEventListener('pause', emit);
      audio.addEventListener('ended', emit);
      audio.addEventListener('error', function () { failed = 'No se pudo cargar la música.'; emit(); });
      doc.body.appendChild(audio);
      return audio;
    }
    function state() {
      return { src: src, ownerId: ownerId, blocked: blocked, error: failed,
        playing: !!(audio && !audio.paused && !audio.ended && audio.currentSrc),
        volume: audio ? Math.round(audio.volume * 100) : 100 };
    }
    function emit() { for (var i = 0; i < listeners.length; i++) try { listeners[i](state()); } catch (error) { /* un botón roto no detiene a los demás */ } }

    /** Reintenta una sola vez con el primer gesto del invitado, cuando el navegador bloqueó la reproducción. */
    function armGesture(record) {
      if (armed) return;
      armed = true;
      var retry = function () {
        doc.removeEventListener('pointerdown', retry, true);
        doc.removeEventListener('keydown', retry, true);
        armed = false;
        if (blocked) play(record, true);
      };
      doc.addEventListener('pointerdown', retry, true);
      doc.addEventListener('keydown', retry, true);
    }

    function load(record) {
      var element = ensure();
      if (src !== record.src) { src = record.src; ownerId = record.id; failed = ''; element.src = record.src; }
      element.loop = record.config.loop !== false;
      element.volume = Math.max(0, Math.min(1, R.num(record.config.volume, 70) / 100));
      return element;
    }
    function play(record, fromGesture) {
      var element = load(record);
      var promise = element.play();
      if (promise && promise.catch) promise.then(function () { blocked = false; emit(); }, function () {
        // el navegador exige un gesto del invitado: el botón sigue visible y se puede pulsar
        blocked = true; emit();
        if (!fromGesture) armGesture(record);
      });
      else emit();
    }
    return {
      state: state,
      onChange: function (fn) { listeners.push(fn); fn(state()); },
      isCurrent: function (record) { return !!record && src === record.src; },
      play: play,
      pause: function () { if (audio) audio.pause(); blocked = false; emit(); },
      toggle: function (record) {
        var current = state();
        if (src === record.src && current.playing) { audio.pause(); blocked = false; emit(); }
        else play(record, true);
      },
      setVolume: function (value) { var element = ensure(); element.volume = Math.max(0, Math.min(1, R.num(value, 70) / 100)); emit(); }
    };
  })();

  /**
   * Un video que el navegador no puede decodificar deja de ser un hueco en blanco: se sustituye por un
   * aviso legible. El invitado entiende que falta algo y quien diseñó la invitación sabe qué corregir.
   */
  function mediaFailed(el, o) {
    if (el.querySelector('.iv-media-error')) return;
    var aviso = doc.createElement('div');
    aviso.className = 'iv-media-error';
    aviso.setAttribute('role', 'note');
    var titulo = doc.createElement('strong');
    titulo.textContent = 'Este video no se puede reproducir en este dispositivo';
    var detalle = doc.createElement('span');
    detalle.textContent = (o && o.name ? o.name + ' · ' : '') + 'formato no compatible (se necesita MP4 con H.264)';
    aviso.appendChild(titulo); aviso.appendChild(detalle);
    el.appendChild(aviso);
    el.setAttribute('data-media-error', 'true');
    /* El texto se mide en las unidades de la mesa, no de la ventana: la portada se dibuja a 1080 px de
       ancho y luego se escala, así que un tamaño en vw saldría ilegible en el teléfono. */
    var lado = Math.min(R.num(o && o.w, 300) || 300, R.num(o && o.h, 300) || 300);
    aviso.style.fontSize = Math.max(14, Math.min(46, Math.round(lado / 14))) + 'px';
  }

  /**
   * Máscaras de recorte (0.10). El trazado no se pinta: solo define la forma. El contenido recibe un
   * clip-path construido con el mismo motor que usa el editor, así que se ve exactamente igual.
   */
  var mascarasPorId = {};
  var defsRecortes = null;
  function hostDeRecortes() {
    if (defsRecortes) return defsRecortes;
    var svg = R.svgEl(doc, 'svg', { width: 0, height: 0, 'aria-hidden': 'true' }, doc.body);
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    svg.id = 'iv-clip-defs';
    defsRecortes = R.svgEl(doc, 'defs', null, svg);
    return defsRecortes;
  }
  function recortarConMascara(o, el) {
    if (!o.clipId || o.clipRole === 'mask') return;
    var trazado = mascarasPorId[o.clipId];
    if (!trazado) return;
    var ref = R.clipPathFor(doc, trazado, o, hostDeRecortes(), 'ivc_',
      { htmlBox: true, maskLines: trazado.lines });
    if (ref) el.style.clipPath = ref;
  }

  /** Los trazados de recorte, por su clipId, para que el contenido pueda encontrarlos al construirse. */
  function recogerMascaras() {
    mascarasPorId = {};
    for (var clave in spaces) {
      if (!Object.prototype.hasOwnProperty.call(spaces, clave)) continue;
      var capas = (spaces[clave] || {}).layers || [];
      for (var i = 0; i < capas.length; i++) {
        var objs = capas[i].objects || [];
        for (var j = 0; j < objs.length; j++) {
          if (objs[j] && objs[j].clipId && objs[j].clipRole === 'mask') mascarasPorId[objs[j].clipId] = objs[j];
        }
      }
    }
  }

  /* ---------------------------------------------------------------- cuenta regresiva (0.10)
   * El instante del evento viaja en UTC dentro del diseño, así que cada invitado ve el mismo tiempo
   * restante sin que nadie tenga que configurar nada y sin depender de su configuración regional.
   * Se repinta cada segundo mientras la pestaña esté a la vista.
   */
  var cuentas = [];
  function unidadesDe(c) { return (c.units && c.units.length) ? c.units : ['days', 'hours', 'minutes', 'seconds']; }
  var ETIQUETAS = { days: ['DÍA', 'DÍAS'], hours: ['HORA', 'HORAS'], minutes: ['MINUTO', 'MINUTOS'], seconds: ['SEGUNDO', 'SEGUNDOS'] };

  function restanteDe(c, ahora) {
    var objetivo = Date.parse(c.targetUtc || '');
    if (!c.targetUtc || !c.active || c.paused || !isFinite(objetivo)) {
      return { listo: false, terminado: false, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    var falta = objetivo - ahora;
    if (falta <= 0) return { listo: true, terminado: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
    var seg = Math.floor(falta / 1000);
    return { listo: true, terminado: false, days: Math.floor(seg / 86400), hours: Math.floor((seg % 86400) / 3600),
      minutes: Math.floor((seg % 3600) / 60), seconds: seg % 60 };
  }

  function etiquetaDe(c, u, valor) {
    var propio = c.labelText && c.labelText[u];
    var texto = propio || (ETIQUETAS[u] ? ETIQUETAS[u][valor === 1 ? 0 : 1] : u);
    if (c.labelCase === 'upper') texto = texto.toUpperCase();
    else if (c.labelCase === 'lower') texto = texto.toLowerCase();
    else if (c.labelCase === 'capitalize') texto = texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
    return texto;
  }
  var SEPS = { none: '', dot: '·', colon: ':', line: '|', slash: '/', dash: '—', heart: '♥' };

  function pintarCuenta(entrada, ahora) {
    var o = entrada.o, c = entrada.c, host = entrada.host;
    var r = restanteDe(c, ahora);
    var vista = { estado: r.terminado ? 'terminado' : (c.targetUtc && c.active ? 'contando' : 'sin-fecha') };
    while (host.firstChild) host.removeChild(host.firstChild);
    R.drawCountdown(doc, o, host, {
      cfg: c, view: vista, placeholder: false,
      separatorText: SEPS[c.separator] === undefined ? '' : SEPS[c.separator],
      numberOf: function (u) { var v = r.listo ? r[u] : 0; return (c.pad && u !== 'days') ? String(v).replace(/^(\d)$/, '0$1') : String(v); },
      labelOf: function (u) { return etiquetaDe(c, u, r[u]); }
    });
    void unidadesDe;
    return r.terminado;
  }

  function arrancarCuentas() {
    if (!cuentas.length) return;
    var tic = function () {
      var ahora = Date.now();
      for (var i = 0; i < cuentas.length; i++) pintarCuenta(cuentas[i], ahora);
    };
    tic();
    window.setInterval(tic, 1000);
    // al volver a la pestaña se repinta en el acto, sin esperar al siguiente segundo
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) tic(); });
  }

  function buildObject(o, spaceName, layer) {
    var el = doc.createElement('div'), key = o.webId || o.id;
    var w = Math.max(0, R.num(o.w)), h = Math.max(0, R.num(o.h));
    el.id = 'iv-' + key;
    el.className = 'iv-obj iv-' + o.type;
    el.setAttribute('data-iv-id', o.id);
    el.setAttribute('data-name', o.name || '');
    el.setAttribute('data-workspace', spaceName);
    el.setAttribute('data-layer', layer.name || '');
    el.style.left = px(o.x); el.style.top = px(o.y); el.style.width = px(w); el.style.height = px(h);
    if (R.num(o.rotation)) el.style.transform = 'rotate(' + R.num(o.rotation) + 'deg)';
    var opacity = R.num(o.opacity === undefined ? 100 : o.opacity, 100) / 100;
    if (opacity < 1) el.style.opacity = String(opacity);
    if (o.clipRole === 'mask') {
      // el trazado solo define la forma: no se pinta ni recibe clics
      el.setAttribute('data-clip-role', 'mask');
      el.style.display = 'none';
      return el;
    }
    recortarConMascara(o, el);
    if (o.visible === false) el.hidden = true;
    if (o.shadow && o.shadow.enabled) {
      var sh = o.shadow, color = /^#[0-9a-f]{6}$/i.test(sh.color || '') ? sh.color : '#000000';
      var cr = parseInt(color.slice(1, 3), 16), cg = parseInt(color.slice(3, 5), 16), cb = parseInt(color.slice(5, 7), 16);
      el.style.filter = 'drop-shadow(' + R.num(sh.x) + 'px ' + R.num(sh.y) + 'px ' + Math.max(0, R.num(sh.blur)) + 'px rgba(' + cr + ',' + cg + ',' + cb + ',' + Math.max(0, Math.min(100, R.num(sh.opacity, 28))) / 100 + '))';
    }
    if (o.popupConfig && o.popupConfig.enabled) {
      el.className += ' iv-popup'; el.hidden = true; el.setAttribute('aria-hidden', 'true');
      var popupId = String(o.popupConfig.groupId || '');
      if (popupId) { el.setAttribute('data-popup-group', popupId); if (!popupGroups[popupId]) popupGroups[popupId] = []; popupGroups[popupId].push(el); }
    }
    if (o.buttonConfig && o.buttonConfig.enabled) {
      el.className += ' iv-button'; el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', String(o.buttonConfig.label || o.name || 'Botón'));
    }

    if (o.type === 'uibtn') {
      buildUiButton(o, el, w, h);
      elements[key] = el; elements[o.id] = el;
      objectRecords.push({ object: o, element: el, workspace: spaceName });
      return el;
    }
    if (o.type === 'switch') {
      buildSwitch(o, el, w, h);
      elements[key] = el; elements[o.id] = el;
      objectRecords.push({ object: o, element: el, workspace: spaceName });
      return el;
    }
    if (o.type === 'music') {
      buildMusic(o, el, w, h);
      elements[key] = el; elements[o.id] = el;
      objectRecords.push({ object: o, element: el, workspace: spaceName });
      return el;
    }
    if (o.papel) el.setAttribute('data-papel', String(o.papel));
    if (o.type === 'galeria') {
      /* Carrusel de verdad: se arrastra con el dedo, tiene puntos, flechas, avance automático y
         la foto se abre a pantalla completa. Nada de esto depende de que haya servicio. */
      var g = o.gal || {}, fotos = (g.fotos || []);
      el.setAttribute('data-galeria', '1');
      el.style.borderRadius = R.num(g.radio) + 'px';
      el.style.overflow = 'hidden';
      if (g.fondo && g.fondo !== '#00000000') el.style.background = R.rgbaFrom(g.fondo);

      var pista = doc.createElement('div');
      pista.className = 'iv-gal-pista iv-gal-' + (g.transicion || 'deslizar');
      el.appendChild(pista);

      fotos.forEach(function (f, i) {
        var d = doc.createElement('div');
        d.className = 'iv-gal-foto';
        if ((g.transicion || 'deslizar') === 'deslizar') d.style.left = (i * 100) + '%';
        var im = doc.createElement('img');
        im.src = f.src;
        im.alt = f.pie || '';
        im.loading = i === 0 ? 'eager' : 'lazy';
        im.style.objectFit = g.ajuste === 'contain' ? 'contain' : 'cover';
        d.appendChild(im);
        if (g.pies && f.pie) {
          var pie = doc.createElement('span');
          pie.className = 'iv-gal-pie';
          pie.textContent = f.pie;
          d.appendChild(pie);
        }
        pista.appendChild(d);
      });

      if (!fotos.length) {
        var vacio = doc.createElement('div');
        vacio.className = 'iv-gal-vacio';
        vacio.textContent = 'Galería sin fotografías';
        el.appendChild(vacio);
        return el;
      }

      var puntos = null;
      if (g.puntos !== false && fotos.length > 1) {
        puntos = doc.createElement('div');
        puntos.className = 'iv-gal-puntos';
        fotos.forEach(function (_, i) {
          var b = doc.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', 'Fotografía ' + (i + 1));
          b.style.background = R.rgbaFrom(g.colorPuntos || '#ffffff');
          b.addEventListener('click', function (e) { e.stopPropagation(); ir(i); });
          puntos.appendChild(b);
        });
        el.appendChild(puntos);
      }

      if (g.flechas !== false && fotos.length > 1) {
        ['prev', 'next'].forEach(function (lado) {
          var b = doc.createElement('button');
          b.type = 'button';
          b.className = 'iv-gal-flecha iv-gal-' + lado;
          b.style.color = R.rgbaFrom(g.colorFlechas || '#ffffff');
          b.setAttribute('aria-label', lado === 'prev' ? 'Anterior' : 'Siguiente');
          b.textContent = lado === 'prev' ? '\u2039' : '\u203A';
          b.addEventListener('click', function (e) { e.stopPropagation(); ir(actual + (lado === 'prev' ? -1 : 1)); });
          el.appendChild(b);
        });
      }

      var actual = 0, temporizador = null;
      function ir(i) {
        actual = (i + fotos.length) % fotos.length;
        pista.style.setProperty('--iv-gal-i', actual);
        [].forEach.call(pista.children, function (d, k) { d.classList.toggle('es-actual', k === actual); });
        if (puntos) [].forEach.call(puntos.children, function (b, k) { b.classList.toggle('es-actual', k === actual); });
        reprogramar();
      }
      function reprogramar() {
        if (temporizador) clearTimeout(temporizador);
        var seg = R.num(g.auto);
        if (seg > 0 && fotos.length > 1) temporizador = setTimeout(function () { ir(actual + 1); }, seg * 1000);
      }

      // arrastre con el dedo o con el ratón
      var x0 = null, arrastrando = false;
      el.addEventListener('pointerdown', function (e) { x0 = e.clientX; arrastrando = false; });
      el.addEventListener('pointermove', function (e) {
        if (x0 === null) return;
        if (Math.abs(e.clientX - x0) > 10) arrastrando = true;
      });
      el.addEventListener('pointerup', function (e) {
        if (x0 === null) return;
        var dx = e.clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 40) { ir(actual + (dx < 0 ? 1 : -1)); return; }
        if (!arrastrando && g.zoom !== false) abrirGrande(fotos, actual, g);
      });
      el.addEventListener('pointercancel', function () { x0 = null; });

      ir(0);
      return el;
    }
    if (o.type === 'countdown') {
      var c = o.cd || {};
      var svgCd = R.svgEl(doc, 'svg', { width: Math.max(1, w), height: Math.max(1, h),
        viewBox: '0 0 ' + Math.max(1, w) + ' ' + Math.max(1, h) }, el);
      svgCd.setAttribute('style', 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible');
      el.setAttribute('data-countdown', '1');
      cuentas.push({ o: o, c: c, host: svgCd });
      return el;
    }
    if (o.type === 'image' || o.type === 'video') {
      el.className += ' iv-media';
      // desvanecimiento: la misma máscara CSS que se ve en la mesa de trabajo
      if (o.fade && o.fade.stops) {
        var cssFade = R.fadeCss(o.fade);
        if (cssFade) {
          el.style.webkitMaskImage = cssFade; el.style.maskImage = cssFade;
          el.style.webkitMaskSize = '100% 100%'; el.style.maskSize = '100% 100%';
          el.style.webkitMaskRepeat = 'no-repeat'; el.style.maskRepeat = 'no-repeat';
        }
      }
      var radius = Math.max(0, Math.min(R.num(o.radius), w / 2, h / 2));
      if (radius) el.style.borderRadius = px(radius);
      var media = doc.createElement(o.type === 'image' ? 'img' : 'video');
      var box = R.mediaBox(o, o.natW, o.natH);
      if (box.known) { media.style.left = px(box.x); media.style.top = px(box.y); media.style.width = px(box.w); media.style.height = px(box.h); media.style.objectFit = 'fill'; }
      else { media.style.left = '0'; media.style.top = '0'; media.style.width = '100%'; media.style.height = '100%'; media.style.objectFit = o.fit === 'fill' ? 'fill' : o.fit === 'cover' ? 'cover' : 'contain'; }
      if (o.type === 'image') {
        media.alt = o.name || '';
        media.draggable = false;
        media.decoding = 'async';
        if (spaceName === 'invitation' && R.num(o.y) > 3000) media.loading = 'lazy';   // las imágenes lejanas se cargan al acercarse
      } else {
        media.muted = o.muted !== false;
        if (media.muted) media.setAttribute('muted', '');
        media.loop = o.loop !== false;
        media.playsInline = true;
        media.setAttribute('playsinline', '');
        media.preload = 'auto';
        if (o.autoplay !== false) media.setAttribute('data-autoplay', 'true');
        else media.controls = true;   // sin reproducción automática, el invitado necesita los controles
        /* Si el navegador no sabe decodificar el archivo, la invitación quedaba en blanco sin decir nada:
           ni el invitado ni quien la diseñó sabían qué había pasado. Ahora aparece un aviso en su lugar. */
        media.addEventListener('error', function () { mediaFailed(el, o); });
      }
      media.src = o.src;
      el.appendChild(media);
    } else {
      var svg = R.svgEl(doc, 'svg', { width: Math.max(1, w), height: Math.max(1, h) }, el);
      var defs = R.svgEl(doc, 'defs', null, svg);
      R.drawVector(doc, o, svg, { defs: defs, idPrefix: 'ivg_', lines: o.lines });
      // textos con marcas tipo {{nombre}}: se vuelven a dibujar cuando se sepa quién abrió el enlace
      if (o.type === 'text' && /\{\{\s*[a-z]+\s*\}\}/i.test(String(o.text || ''))) {
        personalizables.push({ o: o, svg: svg, defs: defs, el: el });
      }
    }
    if (o.buttonConfig && o.buttonConfig.enabled && String(o.buttonConfig.label || '').trim()) {
      var label = doc.createElement('span');
      label.className = 'iv-button-label';
      label.textContent = String(o.buttonConfig.label).slice(0, 100);
      label.style.color = /^#[0-9a-f]{6}$/i.test(o.buttonConfig.color || '') ? o.buttonConfig.color : '#ffffff';
      label.style.fontSize = Math.max(8, Math.min(160, R.num(o.buttonConfig.fontSize, 30))) + 'px';
      label.style.fontWeight = String(o.buttonConfig.fontWeight || '700');
      el.appendChild(label);
    }
    elements[key] = el; elements[o.id] = el;
    objectRecords.push({ object: o, element: el, workspace: spaceName });
    return el;
  }

  /* ================================================================ botones de biblioteca */

  function uiSvg(w, h) {
    var svg = R.svgEl(doc, 'svg', { width: Math.max(1, w), height: Math.max(1, h),
      viewBox: '0 0 ' + Math.max(1, w) + ' ' + Math.max(1, h) });
    svg.style.overflow = 'visible';
    return svg;
  }
  /** Ancho real del texto, para que el editor y la invitación centren igual el contenido. */
  var measureCanvas = null;
  function measureText(text, size, family, weight) {
    if (!measureCanvas) measureCanvas = doc.createElement('canvas');
    var ctx = measureCanvas.getContext('2d');
    ctx.font = (weight || '400') + ' ' + Math.max(1, R.num(size, 30)) + 'px ' + R.fontStack(family);
    return ctx.measureText(String(text)).width;
  }

  /**
   * Botón de biblioteca. Se dibujan dos capas —normal y «al pasar el cursor»— y se funden entre sí, de modo que
   * el cambio de color se ve suave. La escala y el brillo van por CSS, con la duración que indique el diseño.
   */
  function buildUiButton(o, el, w, h) {
    var b = UI.normalizeButton(o.btn);
    el.className += ' iv-uibtn';
    el.style.setProperty('--iv-ui-ms', R.num(b.transition, 180) + 'ms');
    el.style.setProperty('--iv-ui-hover-scale', String(b.hoverScale));
    el.style.setProperty('--iv-ui-hover-bright', String(b.hoverBrightness));
    el.style.setProperty('--iv-ui-press-scale', String(b.pressScale));
    el.style.setProperty('--iv-ui-press-bright', String(b.pressBrightness));
    el.style.setProperty('--iv-ui-press-y', R.num(b.pressShiftY, 0) + 'px');

    var svg = uiSvg(w, h);
    el.appendChild(svg);
    var opts = { idPrefix: 'u' + o.id, fontStack: R.fontStack, measure: measureText };
    UI.drawUiButton(doc, o, svg, opts);
    // capa de «cursor encima», solo si el diseño cambia de color en ese estado
    var changesOnHover = !!(b.hoverFill || b.hoverText || b.hoverBorder || b.hoverGlow !== 1);
    if (changesOnHover) {
      var hoverSvg = uiSvg(w, h);
      hoverSvg.setAttribute('class', 'iv-uibtn-hover');
      el.appendChild(hoverSvg);
      UI.drawUiButton(doc, o, hoverSvg, { idPrefix: 'uh' + o.id, state: 'hover', fontStack: R.fontStack, measure: measureText });
    }
    var action = (o.buttonConfig && o.buttonConfig.action) || null;
    var hasAction = action && action.type && action.type !== 'none';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    if (b.showLabel && b.label) el.setAttribute('aria-label', b.label);
    if (!hasAction) el.classList.add('iv-ui-inert');
    el.addEventListener('click', function (event) {
      if (!hasAction) return;
      // «Activar botón» desactivado: el botón se ve y se puede diseñar, pero no ejecuta nada.
      if (el.getAttribute('data-intro-disabled') === 'true') { event.preventDefault(); event.stopPropagation(); return; }
      event.preventDefault(); event.stopPropagation();
      runAction(el, action);
    });
    el.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.click(); }
    });
  }

  /* ================================================================ interruptores */

  function switchKey(o) { return 'iv-switch:' + (o.webId || o.id); }

  /**
   * Interruptor. Se dibujan los dos estados completos y se funden; el mando se mueve con una transición, así que
   * el deslizamiento se ve de verdad. El estado se conserva mientras dura la visita y, si el diseño lo pide,
   * también entre visitas.
   */
  function buildSwitch(o, el, w, h) {
    var s = UI.normalizeSwitch(o.sw);
    el.className += ' iv-switch';
    el.style.setProperty('--iv-ui-ms', R.num(s.transition, 260) + 'ms');
    var svg = uiSvg(w, h);
    el.appendChild(svg);

    var common = { idPrefix: 's' + o.id, fontStack: R.fontStack, measure: measureText };
    var off = UI.drawSwitch(doc, o, svg, { on: false, idPrefix: 'so' + o.id, fontStack: R.fontStack, measure: measureText });
    var on = UI.drawSwitch(doc, o, svg, { on: true, idPrefix: 'sn' + o.id, fontStack: R.fontStack, measure: measureText });
    on.group.setAttribute('class', 'iv-switch-on');
    // los dos mandos van encima de los dos carriles, para poder moverlos y fundirlos
    svg.appendChild(off.knob); svg.appendChild(on.knob);
    off.knob.setAttribute('class', 'iv-ui-knob iv-knob-off');
    on.knob.setAttribute('class', 'iv-ui-knob iv-knob-on');

    var travel = off.travel, inset = off.inset;
    var state = s.on;
    if (s.remember) {
      try {
        var saved = window.localStorage.getItem(switchKey(o));
        if (saved === '1' || saved === '0') state = saved === '1';
      } catch (error) { /* el navegador puede no permitir almacenamiento: se usa el estado de diseño */ }
    }

    function paint(animate) {
      var x = inset + (state ? travel : 0);
      el.classList.toggle('is-on', state);
      el.setAttribute('aria-checked', state ? 'true' : 'false');
      on.group.style.opacity = state ? '1' : '0';
      off.knob.style.opacity = state ? '0' : '1';
      on.knob.style.opacity = state ? '1' : '0';
      off.knob.setAttribute('transform', 'translate(' + x + ' ' + inset + ')');
      on.knob.setAttribute('transform', 'translate(' + x + ' ' + inset + ')');
      if (!animate) {
        // sin animación en el primer dibujo, para que no «salte» al cargar
        svg.classList.add('iv-no-anim');
        window.requestAnimationFrame(function () { svg.classList.remove('iv-no-anim'); });
      }
    }

    el.setAttribute('role', 'switch');
    el.setAttribute('tabindex', '0');
    el.addEventListener('click', function (event) {
      event.preventDefault(); event.stopPropagation();
      state = !state;
      paint(true);
      if (s.remember) { try { window.localStorage.setItem(switchKey(o), state ? '1' : '0'); } catch (error) { /* sin almacenamiento */ } }
      var action = state ? o.actionOn : o.actionOff;
      if (action && action.type && action.type !== 'none') runAction(el, action);
    });
    el.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.click(); }
    });
    paint(false);
    // Si el interruptor nace encendido y tiene acción de encendido, no se ejecuta sola: solo refleja el estado.
  }

  /** Botón de música: dibujo compartido con el editor, más el control del reproductor y sus animaciones. */
  function buildMusic(o, el, w, h) {
    var config = o.music || {};
    var record = { id: o.id, src: o.src || '', config: config, element: el };
    el.className += ' iv-music';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', o.name || 'Música');
    if (record.src) el.setAttribute('data-music-src', record.src);

    var svg = R.svgEl(doc, 'svg', { width: Math.max(1, w), height: Math.max(1, h), viewBox: '0 0 ' + Math.max(1, w) + ' ' + Math.max(1, h) }, el);
    record.svg = svg;
    record.parts = R.drawMusic(doc, o, svg, { playing: false, playIconSrc: config.iconPlayAsset || '', pauseIconSrc: config.iconPauseAsset || '' });

    if (config.showVolume) {
      var slider = doc.createElement('input');
      slider.type = 'range'; slider.min = '0'; slider.max = '100';
      slider.value = String(Math.round(R.num(config.volume, 70)));
      slider.className = 'iv-music-volume';
      slider.setAttribute('aria-label', 'Volumen de la música');
      slider.style.width = px(Math.max(60, w));
      slider.style.top = px(h + Math.max(8, h * 0.08));
      slider.addEventListener('input', function () { player.setVolume(slider.value); });
      slider.addEventListener('click', function (event) { event.stopPropagation(); });
      slider.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
      el.appendChild(slider);
      record.slider = slider;
    }

    var animations = [];
    function stopAnimations() {
      for (var i = 0; i < animations.length; i++) try { animations[i].cancel(); } catch (error) { /* ya terminada */ }
      animations = [];
    }
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function startAnimations() {
      stopAnimations();
      if (reduced || typeof el.animate !== 'function') return;
      var body = record.parts.body;
      if (config.spin && body && body.animate) animations.push(body.animate([{ rotate: '0deg' }, { rotate: '360deg' }],
        { duration: 6000, iterations: Infinity, easing: 'linear', composite: 'add' }));
      if (config.pulse && body && body.animate) animations.push(body.animate([{ scale: 1 }, { scale: 1.06 }, { scale: 1 }],
        { duration: 1600, iterations: Infinity, easing: 'ease-in-out', composite: 'add' }));
      if (config.waves) for (var i = 0; i < record.parts.waves.length; i++) {
        var ring = record.parts.waves[i];
        if (!ring.animate) break;
        animations.push(ring.animate([{ opacity: 1, scale: .78 }, { opacity: 0, scale: 1.25 }],
          { duration: 2200, delay: i * 700, iterations: Infinity, easing: 'ease-out', composite: 'add' }));
      }
    }

    /** Vuelve a dibujar el icono cuando cambia el estado, sin rehacer el resto del botón. */
    function paint(playing) {
      svg.replaceChildren();
      record.parts = R.drawMusic(doc, o, svg, { playing: playing, playIconSrc: config.iconPlayAsset || '', pauseIconSrc: config.iconPauseAsset || '' });
      el.setAttribute('data-playing', playing ? 'true' : 'false');
      el.setAttribute('aria-pressed', playing ? 'true' : 'false');
      if (playing) startAnimations(); else stopAnimations();
    }

    var lastPlaying = null;
    player.onChange(function (state) {
      var mine = state.playing && player.isCurrent(record);
      if (mine !== lastPlaying) { lastPlaying = mine; paint(mine); }
      if (record.slider && !state.blocked) record.slider.value = String(state.volume);
      el.setAttribute('data-blocked', state.blocked && player.isCurrent(record) ? 'true' : 'false');
      if (state.error && player.isCurrent(record)) el.setAttribute('data-error', 'true');
    });

    el.addEventListener('click', function (event) {
      event.preventDefault(); event.stopPropagation();
      if (!record.src) return;
      var scale = Math.max(.8, Math.min(1, R.num(config.pressScale, .94)));
      if (typeof el.animate === 'function' && !reduced) el.animate([{ scale: 1 }, { scale: scale }, { scale: 1 }], { duration: 220, easing: 'ease-out' });
      player.toggle(record);
    });
    el.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.click(); } });
    musicRecords.push(record);
    return record;
  }

  /* ---------------------------------------------------------------- el invitado y su pase
     Si la dirección trae ?i=<codigo>, se le pregunta al servicio quién es, y su nombre, su
     mensaje y sus pases entran en los textos marcados. Sin código, o sin servicio, la invitación
     se ve igual que siempre: la personalización es un añadido, no un requisito. */

  var personalizables = [];
  var invitado = null;

  function medidor() {
    var lienzo = doc.createElement('canvas'), ctx = lienzo.getContext('2d');
    return function (o) {
      return function (texto) {
        ctx.font = (o.fontStyle || 'normal') + ' ' + (o.fontWeight || '400') + ' ' +
          R.num(o.fontSize, 52) + 'px ' + (o.fontFamily || 'serif');
        return ctx.measureText(texto).width;
      };
    };
  }
  var hacerMedida = medidor();

  function sustituir(texto, datos) {
    return String(texto).replace(/\{\{\s*([a-z]+)\s*\}\}/gi, function (todo, clave) {
      var k = clave.toLowerCase();
      if (k === 'nombre') return datos.nombre || '';
      if (k === 'mensaje') return datos.mensaje || '';
      if (k === 'pases') return String(datos.pases || '');
      if (k === 'evento') return (datos.evento && datos.evento.nombre) || '';
      return todo;   // una marca desconocida se deja tal cual, para que se vea y se pueda corregir
    });
  }

  function personalizar(datos) {
    personalizables.forEach(function (p) {
      var copia = Object.assign({}, p.o, { text: sustituir(p.o.text, datos) });
      copia.lines = R.layoutText(copia, hacerMedida(copia));
      while (p.svg.firstChild) p.svg.removeChild(p.svg.firstChild);
      var defs = R.svgEl(doc, 'defs', null, p.svg);
      R.drawVector(doc, copia, p.svg, { defs: defs, idPrefix: 'ivg_', lines: copia.lines });
    });
    body.setAttribute('data-invitado', datos.nombre || '');
  }

  /** Deja los textos sin marcas cuando se abre la invitación sin enlace personal. */
  function despersonalizar() {
    personalizar({ nombre: '', mensaje: '', pases: '', evento: {} });
  }

  /* ---------------------------------------------------------------- confirmar asistencia
     El bloque se coloca donde el diseño lo pida (un objeto marcado con papel «rsvp»); si no hay
     ninguno, se añade al final de la invitación. Lo que manda es lo que queda guardado en el
     servicio: abrir WhatsApp es una cortesía, no la prueba de nada. */

  function nodoRsvp() {
    var marcado = doc.querySelector('[data-papel="rsvp"]');
    if (marcado) { marcado.innerHTML = ''; return marcado; }
    var caja = doc.createElement('div');
    caja.className = 'iv-rsvp';
    content.appendChild(caja);
    return caja;
  }

  function prepararRsvp(datos, aviso) {
    if (!window.Kodex || !Kodex.cfg || !Kodex.cfg.endpoint) return;
    var host = nodoRsvp();
    host.classList.add('iv-rsvp');

    function el(tag, cls, padre, texto) {
      var n = doc.createElement(tag);
      if (cls) n.className = cls;
      if (texto !== undefined) n.textContent = texto;
      (padre || host).appendChild(n);
      return n;
    }

    if (!datos) {
      el('p', 'iv-rsvp-msg', host, aviso ||
        'Para confirmar tu asistencia abre el enlace personal que te enviaron los organizadores.');
      return;
    }

    el('p', 'iv-rsvp-nombre', host, datos.nombre);
    el('p', 'iv-rsvp-pases', host,
      datos.pases === 1 ? 'Tienes 1 pase reservado.' : 'Tienes ' + datos.pases + ' pases reservados.');

    var ya = el('p', 'iv-rsvp-estado', host, '');
    function pintarEstado(d) {
      if (d.estado === 'Confirmada') ya.textContent = 'Confirmaste ' + d.confirmados + ' de ' + d.pases + '. Gracias.';
      else if (d.estado === 'No asistirá') ya.textContent = 'Indicaste que no podrás acompañarnos.';
      else ya.textContent = '';
    }
    pintarEstado(datos);

    var fila = el('div', 'iv-rsvp-fila', host);
    el('label', '', fila, '¿Cuántas personas asistirán?');
    var cuantos = doc.createElement('select');
    for (var i = 1; i <= datos.pases; i++) {
      var op = doc.createElement('option');
      op.value = String(i); op.textContent = String(i);
      cuantos.appendChild(op);
    }
    cuantos.value = String(Math.max(1, Math.min(datos.pases, datos.confirmados || 1)));
    fila.appendChild(cuantos);

    var botones = el('div', 'iv-rsvp-botones', host);
    var si = el('button', 'iv-rsvp-si', botones, 'Sí, asistiré');
    var no = el('button', 'iv-rsvp-no', botones, 'No podré asistir');
    var msg = el('p', 'iv-rsvp-msg', host, '');

    function responder(asistira) {
      si.disabled = no.disabled = true;
      msg.className = 'iv-rsvp-msg';
      msg.textContent = 'Guardando tu respuesta…';
      Kodex.responder(Kodex.codigoDeLaUrl(), asistira, asistira ? cuantos.value : 0).then(function (d) {
        si.disabled = no.disabled = false;
        pintarEstado(d);
        msg.className = 'iv-rsvp-msg is-ok';
        msg.textContent = asistira
          ? 'Tu confirmación quedó registrada.'
          : 'Registramos que no podrás acompañarnos. Gracias por avisar.';
        if (d.whatsapp) {
          var texto = (d.mensaje || 'Hola, confirmo mi asistencia.') +
            '\n\nNombre: ' + d.nombre +
            '\nPases asignados: ' + d.pases +
            (asistira ? '\nPersonas que asistirán: ' + d.confirmados : '\nNo podré asistir.');
          var a = doc.createElement('a');
          a.className = 'iv-rsvp-wa';
          a.href = Kodex.enlaceWhatsApp(d.whatsapp, texto);
          a.target = '_blank'; a.rel = 'noreferrer';
          a.textContent = 'Avisar también por WhatsApp';
          msg.appendChild(doc.createElement('br'));
          msg.appendChild(a);
          // se abre solo, pero la respuesta ya quedó guardada aunque el invitado cierre WhatsApp
          try { window.open(a.href, '_blank', 'noopener'); } catch (e) { /* el enlace queda a mano */ }
        }
      }).catch(function (e) {
        si.disabled = no.disabled = false;
        msg.className = 'iv-rsvp-msg is-error';
        msg.textContent = e.message;
      });
    }
    si.addEventListener('click', function () { responder(true); });
    no.addEventListener('click', function () { responder(false); });
  }

  function arrancarInvitado() {
    if (!window.Kodex || !Kodex.cfg || !Kodex.cfg.endpoint) { if (personalizables.length) despersonalizar(); return; }
    var codigo = Kodex.codigoDeLaUrl();
    if (!codigo) { if (personalizables.length) despersonalizar(); prepararRsvp(null); return; }
    Kodex.ver(codigo).then(function (d) {
      invitado = d;
      if (personalizables.length) personalizar(d);
      prepararRsvp(d);
      layoutSoon();
    }).catch(function (e) {
      if (personalizables.length) despersonalizar();
      prepararRsvp(null, e.message);
    });
  }

  /** Una foto a pantalla completa, con sus flechas y cierre. Se reutiliza para todas las galerías. */
  function abrirGrande(fotos, desde, g) {
    var capa = doc.createElement('div');
    capa.className = 'iv-gal-grande';
    var i = desde;
    var im = doc.createElement('img');
    capa.appendChild(im);
    var pie = doc.createElement('p');
    pie.className = 'iv-gal-grande-pie';
    capa.appendChild(pie);

    function pintar() {
      im.src = fotos[i].src;
      pie.textContent = fotos[i].pie || '';
      pie.style.display = fotos[i].pie ? '' : 'none';
    }
    function mover(d) { i = (i + d + fotos.length) % fotos.length; pintar(); }

    ['prev', 'next'].forEach(function (lado) {
      if (fotos.length < 2) return;
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'iv-gal-flecha iv-gal-' + lado;
      b.textContent = lado === 'prev' ? '\u2039' : '\u203A';
      b.addEventListener('click', function (e) { e.stopPropagation(); mover(lado === 'prev' ? -1 : 1); });
      capa.appendChild(b);
    });
    var cerrar = doc.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'iv-gal-cerrar';
    cerrar.setAttribute('aria-label', 'Cerrar');
    cerrar.textContent = '\u00D7';
    capa.appendChild(cerrar);

    function fuera() {
      capa.remove();
      doc.removeEventListener('keydown', tecla, true);
      body.classList.remove('iv-gal-abierta');
    }
    function tecla(e) {
      if (e.key === 'Escape') fuera();
      else if (e.key === 'ArrowRight') mover(1);
      else if (e.key === 'ArrowLeft') mover(-1);
    }
    cerrar.addEventListener('click', fuera);
    capa.addEventListener('click', function (e) { if (e.target === capa) fuera(); });
    doc.addEventListener('keydown', tecla, true);

    var gx = null;
    capa.addEventListener('pointerdown', function (e) { gx = e.clientX; });
    capa.addEventListener('pointerup', function (e) {
      if (gx === null) return;
      var dx = e.clientX - gx; gx = null;
      if (Math.abs(dx) > 40) mover(dx < 0 ? 1 : -1);
    });

    pintar();
    body.appendChild(capa);
    body.classList.add('iv-gal-abierta');
  }

  function buildArtboard(name) {
    recogerMascaras();
    var space = spaces[name] || { width: 1080, height: 1920, layers: [] };
    var board = doc.createElement('div');
    board.className = 'iv-artboard';
    board.setAttribute('data-workspace', name);
    board.style.width = px(space.width); board.style.height = px(space.height);
    var count = 0;
    (space.layers || []).forEach(function (layer) {
      var group = doc.createElement('div');
      group.className = 'iv-layer';
      group.id = 'iv-layer-' + layer.id;
      group.setAttribute('data-name', layer.name || '');
      var opacity = R.num(layer.opacity === undefined ? 100 : layer.opacity, 100) / 100;
      if (opacity < 1) group.style.opacity = String(opacity);
      if (layer.visible === false) group.hidden = true;
      (layer.objects || []).forEach(function (o) { group.appendChild(buildObject(o, name, layer)); if (layer.visible !== false && o.visible !== false) count++; });
      board.appendChild(group);
    });
    return { el: board, w: R.num(space.width, 1080), h: R.num(space.height, 1920), visibleObjects: count };
  }

  function resolveTarget(target) {
    if (!target) return null;
    var value = String(target);
    if (value.indexOf('popup:') === 0) return popupGroups[value.slice(6)] || [];
    if (popupGroups[value]) return popupGroups[value];            // también se acepta el identificador del grupo a secas
    return elements[value] || doc.getElementById(value) || doc.getElementById('iv-' + value) || null;
  }

  /** Ventana emergente a la que pertenece el elemento que disparó la acción (para cerrarla sin indicar destino). */
  function ownPopup(source) {
    if (!source) return '';
    var el = source;
    while (el && el.getAttribute) {
      var group = el.getAttribute('data-popup-group');
      if (group) return 'popup:' + group;
      el = el.parentNode;
    }
    return '';
  }

  function setPopupState(target, visible, transition) {
    var list = resolveTarget(target);
    if (!Array.isArray(list)) list = list ? [list] : [];
    list.forEach(function (el) {
      el.hidden = false;
      el.setAttribute('aria-hidden', visible ? 'false' : 'true');
      var type = ['fade', 'zoom', 'slide', 'blur', 'wipe', 'slide-left'].indexOf(transition) >= 0 ? transition : 'fade';
      if (visible) {
        var frames = type === 'zoom' ? [{ opacity: 0, scale: .92 }, { opacity: 1, scale: 1 }]
          : type === 'slide' ? [{ opacity: 0, translate: '0 24px' }, { opacity: 1, translate: '0 0' }]
          : type === 'slide-left' ? [{ opacity: 0, translate: '24px 0' }, { opacity: 1, translate: '0 0' }]
          : type === 'blur' ? [{ opacity: 0, filter: 'blur(12px)' }, { opacity: 1, filter: 'blur(0)' }]
          : [{ opacity: 0 }, { opacity: 1 }];
        if (typeof el.animate === 'function' && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) el.animate(frames, { duration: 320, easing: 'ease-out', fill: 'both' });
      } else {
        var close = typeof el.animate === 'function' && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
          ? el.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: .96 }], { duration: 220, easing: 'ease-in', fill: 'forwards' }) : null;
        if (close) close.onfinish = function () { el.hidden = true; };
        else el.hidden = true;
      }
    });
    return list.length > 0;
  }

  function safeOpenUrl(value) {
    try {
      var url = new URL(String(value || ''), window.location.href);
      if (['http:', 'https:', 'mailto:', 'tel:'].indexOf(url.protocol) < 0) return false;
      if (url.protocol === 'mailto:' || url.protocol === 'tel:') window.location.href = url.href;
      else window.open(url.href, '_blank', 'noopener,noreferrer');
      return true;
    } catch (error) { return false; }
  }

  function runAction(source, action) {
    if (!action || !action.type || action.type === 'none') return;
    var target = resolveTarget(action.target), list = Array.isArray(target) ? target : (target ? [target] : []);
    if (action.type === 'open-popup') setPopupState(action.target, true, action.transition);
    else if (action.type === 'close-popup') {
      // Sin destino: cierra la ventana a la que pertenece el botón; si tampoco la hay, todas las abiertas.
      var which = action.target || ownPopup(source);
      if (which) setPopupState(which, false, action.transition);
      else for (var group in popupGroups) setPopupState('popup:' + group, false, action.transition);
    }
    else if (action.type === 'toggle') list.forEach(function (el) { el.hidden = !el.hidden; el.setAttribute('aria-hidden', el.hidden ? 'true' : 'false'); });
    else if (action.type === 'show') list.forEach(function (el) { el.hidden = false; el.setAttribute('aria-hidden', 'false'); });
    else if (action.type === 'hide') list.forEach(function (el) { el.hidden = true; el.setAttribute('aria-hidden', 'true'); });
    else if (action.type === 'open-url') safeOpenUrl(action.url);
    else if (action.type === 'scroll-to') { if (list[0] && list[0].scrollIntoView) list[0].scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (action.type === 'open-invitation') open(action.transition);
    else if (action.type === 'start-intro') escena.arrancar(action.transition);
    else if (action.type === 'play-media' || action.type === 'pause-media') list.forEach(function (el) {
      // botón de música: lo gestiona el reproductor único de la invitación
      var record = musicOf(el);
      if (record) {
        if (action.type === 'play-media') player.play(record, true); else player.pause();
        return;
      }
      var media = el.matches && el.matches('video,audio') ? el : el.querySelector && el.querySelector('video,audio');
      if (!media) return;
      if (action.type === 'play-media') { var promise = media.play(); if (promise && promise.catch) promise.catch(function () {}); }
      else media.pause();
    });
  }

  function musicOf(el) {
    for (var i = 0; i < musicRecords.length; i++) if (musicRecords[i].element === el) return musicRecords[i];
    return null;
  }

  function effectFrames(type) {
    var frames = {
      'fade-in': [{ opacity: 0 }, { opacity: 1 }],
      'fade-out': [{ opacity: 1 }, { opacity: 0 }],
      'slide-up': [{ opacity: 0, translate: '0 36px' }, { opacity: 1, translate: '0 0' }],
      'slide-down': [{ opacity: 0, translate: '0 -36px' }, { opacity: 1, translate: '0 0' }],
      'slide-left': [{ opacity: 0, translate: '36px 0' }, { opacity: 1, translate: '0 0' }],
      'slide-right': [{ opacity: 0, translate: '-36px 0' }, { opacity: 1, translate: '0 0' }],
      'zoom-in': [{ opacity: 0, scale: .72 }, { opacity: 1, scale: 1 }],
      'zoom-out': [{ opacity: 1, scale: 1 }, { opacity: 0, scale: .72 }],
      'bounce-in': [{ opacity: 0, scale: .65 }, { opacity: 1, scale: 1.08, offset: .72 }, { opacity: 1, scale: 1 }],
      'pulse': [{ scale: 1 }, { scale: 1.08 }, { scale: 1 }],
      'bounce': [{ translate: '0 0' }, { translate: '0 -16px' }, { translate: '0 0' }],
      'shake': [{ translate: '0 0' }, { translate: '-7px 0' }, { translate: '7px 0' }, { translate: '-4px 0' }, { translate: '0 0' }],
      'swing': [{ rotate: '0deg' }, { rotate: '9deg' }, { rotate: '-7deg' }, { rotate: '4deg' }, { rotate: '0deg' }],
      'glow': [{ filter: 'drop-shadow(0 0 0 rgba(255,220,150,0))' }, { filter: 'drop-shadow(0 0 16px rgba(255,220,150,.95))' }, { filter: 'drop-shadow(0 0 0 rgba(255,220,150,0))' }],
      'color-shift': [{ filter: 'hue-rotate(0deg)' }, { filter: 'hue-rotate(120deg)' }, { filter: 'hue-rotate(240deg)' }, { filter: 'hue-rotate(360deg)' }],
      'float': [{ translate: '0 0' }, { translate: '0 -12px' }, { translate: '0 0' }],
      'rotate': [{ rotate: '0deg' }, { rotate: '360deg' }]
    };
    return frames[type] || frames['fade-in'];
  }

  function playEffect(el, effect) {
    if (!el || !effect || effect.enabled === false || typeof el.animate !== 'function') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var key = String(effect.id || effect.type || 'effect');
    if (!el.__wedditAnimations) el.__wedditAnimations = {};
    if (el.__wedditAnimations[key]) { try { el.__wedditAnimations[key].cancel(); } catch (error) {} }
    var animation = el.animate(effectFrames(effect.type), {
      duration: Math.max(80, Math.min(30000, R.num(effect.duration, 700))),
      delay: Math.max(0, Math.min(60000, R.num(effect.delay))),
      iterations: effect.infinite ? Infinity : Math.max(1, Math.min(100, R.num(effect.iterations, 1))),
      direction: ['reverse', 'alternate'].indexOf(effect.direction) >= 0 ? effect.direction : 'normal',
      easing: String(effect.easing || 'ease'), fill: 'none'
    });
    el.__wedditAnimations[key] = animation;
    if (!effect.infinite && (effect.type === 'fade-out' || effect.type === 'zoom-out')) {
      animation.onfinish = function () { el.hidden = true; el.setAttribute('aria-hidden', 'true'); };
    }
  }

  function observeEffectVisibility(el, effect) {
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { if (entry.isIntersecting) { playEffect(el, effect); observer.unobserve(el); } });
      }, { threshold: .12 });
      observer.observe(el);
    } else window.requestAnimationFrame(function () { playEffect(el, effect); });
  }

  function setupObjectBehavior() {
    objectRecords.forEach(function (record) {
      var object = record.object, el = record.element;
      var effects = Array.isArray(object.effects) ? object.effects : [];
      var button = (object.type === 'music' || object.type === 'uibtn' || object.type === 'switch') ? null : object.buttonConfig;
      if (button && button.enabled) {
        var action = button.action || { type: 'none' };
        el.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); runAction(el, action); });
        var baseFilter = el.style.filter || '';
        el.addEventListener('pointerenter', function () { var brightness = Math.max(1, Math.min(1.5, R.num(button.hoverBrightness, 1.08))); el.style.filter = (baseFilter ? baseFilter + ' ' : '') + 'brightness(' + brightness + ')'; });
        el.addEventListener('pointerleave', function () { el.style.filter = baseFilter; el.style.scale = ''; });
        el.addEventListener('pointerdown', function () { el.style.scale = String(Math.max(.8, Math.min(1, R.num(button.pressedScale, .97)))); });
        el.addEventListener('pointerup', function () { el.style.scale = ''; });
        el.addEventListener('pointercancel', function () { el.style.scale = ''; });
        el.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.click(); } });
      }
      effects.forEach(function (effect) {
        if (!effect || effect.enabled === false) return;
        if (effect.trigger === 'load') window.requestAnimationFrame(function () { playEffect(el, effect); });
        else if (effect.trigger === 'hover') {
          el.addEventListener('pointerenter', function () { playEffect(el, effect); });
        } else if (effect.trigger === 'click') {
          el.addEventListener('click', function () { playEffect(el, effect); });
        } else if (effect.trigger === 'visible') {
          if (record.workspace !== 'intro' && !opened) pendingVisibleEffects.push({ element: el, effect: effect });
          else observeEffectVisibility(el, effect);
        }
      });
    });
  }

  var introHost = doc.getElementById('iv-intro'), introFrame = doc.getElementById('iv-intro-frame');
  var column = doc.getElementById('iv-column'), fixedBg = doc.getElementById('iv-fixed-bg'), content = doc.getElementById('iv-content');
  var intro = buildArtboard('intro'), background = buildArtboard('background'), invitation = buildArtboard('invitation');
  introFrame.appendChild(intro.el); fixedBg.appendChild(background.el); content.appendChild(invitation.el);
  setupObjectBehavior();

  /** Escala cada mesa al tamaño real: contenido al ancho de la columna; fondo y portada cubriendo su pantalla sin deformarse. */
  function layout() {
    var columnWidth = column.clientWidth || 1;
    var k = columnWidth / invitation.w;
    invitation.el.style.transform = 'scale(' + k + ')';
    content.style.height = (invitation.h * k) + 'px';
    var screenHeight = fixedBg.clientHeight || window.innerHeight;
    var kb = Math.max(columnWidth / background.w, screenHeight / background.h);
    background.el.style.transform = 'translate(' + ((columnWidth - background.w * kb) / 2) + 'px,' + ((screenHeight - background.h * kb) / 2) + 'px) scale(' + kb + ')';
    var fw = introFrame.clientWidth || 1, fh = introFrame.clientHeight || 1;
    var ki = settings.introFit === 'contain' ? Math.min(fw / intro.w, fh / intro.h) : Math.max(fw / intro.w, fh / intro.h);
    intro.el.style.transform = 'translate(' + ((fw - intro.w * ki) / 2) + 'px,' + ((fh - intro.h * ki) / 2) + 'px) scale(' + ki + ')';
  }

  /* El recálculo cambia la altura del contenido, que es justo lo que observa el ResizeObserver. Agrupar las
     llamadas en un solo cuadro evita el aviso «ResizeObserver loop completed with undelivered notifications». */
  var layoutPending = 0;
  function layoutSoon() {
    if (layoutPending) return;
    layoutPending = window.requestAnimationFrame(function () { layoutPending = 0; layout(); });
  }

  function playVideos(host, play) {
    var list = host.querySelectorAll('video[data-autoplay]');
    for (var i = 0; i < list.length; i++) {
      if (play) { var promise = list[i].play(); if (promise && promise.catch) promise.catch(function () { /* el navegador exige un gesto del usuario */ }); }
      else list[i].pause();
    }
  }

  function fire(name) {
    var event;
    try { event = new CustomEvent(name, { detail: api }); } catch (error) { event = doc.createEvent('CustomEvent'); event.initCustomEvent(name, false, false, api); }
    doc.dispatchEvent(event);
  }

  /**
   * Retira la portada y entra a la invitación. Esto es el acto en sí: quién decide cuándo ocurre es
   * la escena de apertura (abajo). Separarlos es lo que permite que el botón ponga en marcha la
   * animación en vez de abrir de golpe, y que no se abra dos veces.
   */
  function abrirInvitacion(transitionOverride) {
    if (opened) return;
    var transitions = ['fade', 'slide', 'zoom', 'blur', 'wipe', 'slide-left', 'dissolve', 'zoom-in', 'expand'];
    if (transitions.indexOf(transitionOverride) >= 0) {
      for (var i = 0; i < transitions.length; i++) body.classList.remove('iv-t-' + transitions[i]);
      body.classList.add('iv-t-' + transitionOverride);
    }
    opened = true;
    body.classList.remove('iv-intro-playing');
    body.classList.add('iv-opened');
    pendingVisibleEffects.splice(0).forEach(function (item) { observeEffectVisibility(item.element, item.effect); });
    body.classList.remove('iv-locked');
    window.scrollTo(0, 0);
    playVideos(fixedBg, true);
    watchContentVideos();
    startAutoMusic();
    setTimeout(function () { playVideos(introHost, false); introHost.setAttribute('aria-hidden', 'true'); }, 1100);
    fire('wedditstudio:open'); fire('invitavector:open');
  }

  /**
   * Lo que ocurre cuando alguien «abre» la portada: pulsar el botón, tocar la portada, el modo
   * automático o `WedditStudio.open()` desde fuera. No abre siempre: en la modalidad manual lo que
   * hace es poner en marcha la animación, y la invitación entra cuando el segmento termina.
   */
  function open(transitionOverride) {
    if (opened) return;
    if (escena.modo === 'manual' && escena.hayAnimacion) {
      escena.arrancar(transitionOverride);
      return;
    }
    // Modalidad automática: el video ya está sonando. Aquí siguen valiendo los tres modos de 0.9.3.
    var modo = escenaCfg.openMode || 'immediate';
    if (modo === 'pause') {
      playVideos(introHost, false);
    } else if (modo === 'finish' && escena.hayAnimacion) {
      if (escena.esperarFinal(transitionOverride)) return;
    }
    escena.marcarAbierta();
    abrirInvitacion(transitionOverride);
  }

  /** Primer botón de música con «intentar sonar al entrar»: se prueba, y si el navegador lo impide, se espera un toque. */
  function startAutoMusic() {
    for (var i = 0; i < musicRecords.length; i++) {
      var record = musicRecords[i];
      if (record.config && record.config.autoplay && record.src) { player.play(record, false); return; }
    }
  }

  /** Los videos del contenido solo se reproducen mientras están a la vista. */
  function watchContentVideos() {
    var list = content.querySelectorAll('video[data-autoplay]');
    if (!list.length) return;
    if (!('IntersectionObserver' in window)) { playVideos(content, true); return; }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { var promise = entry.target.play(); if (promise && promise.catch) promise.catch(function () {}); }
        else entry.target.pause();
      });
    }, { threshold: 0.05 });
    for (var i = 0; i < list.length; i++) observer.observe(list[i]);
  }

  var api = window.WedditStudio = window.InvitaVector = {
    version: design.version, design: design, elements: elements,
    /** Devuelve el elemento de un objeto por su id de diseño o su «ID para desarrollo». */
    get: function (id) { return elements[id] || doc.getElementById('iv-' + id) || null; },
    open: open, isOpen: function () { return opened; }, layout: layout,
    /** La escena de apertura, para poder probarla y para quien quiera gobernarla desde fuera. */
    intro: {
      state: function () { return escena.estado(); },
      mode: function () { return escena.modo; },
      hasAnimation: function () { return escena.hayAnimacion; },
      start: function (t) { return escena.arrancar(t); },
      skip: function (t) { return escena.omitir(t); }
    },
    /** Reproductor de música de la invitación: play, pause, toggle, volumen y estado. */
    music: {
      play: function (id) { var record = id ? musicOf(elements[id]) : musicRecords[0]; if (record) player.play(record, true); },
      pause: function () { player.pause(); },
      toggle: function (id) { var record = id ? musicOf(elements[id]) : musicRecords[0]; if (record) player.toggle(record); },
      setVolume: function (value) { player.setVolume(value); },
      state: function () { return player.state(); },
      buttons: musicRecords
    }
  };

  /* ---------------------------------------------------------------- escena de apertura (0.9.3)
   * La portada deja de ser «un video que se reproduce»: puede llevar un tramo recortado del archivo,
   * un botón que aparece en el segundo que se eligió y tres formas distintas de dar paso a la
   * invitación. Si el diseño no trae nada de esto (proyectos anteriores), todo sigue como estaba. */
  var escenaCfg = design.intro || {};
  var trans = escenaCfg.transition || {};
  var TRANSICIONES = ['fade', 'slide', 'zoom', 'blur', 'wipe', 'slide-left', 'dissolve', 'zoom-in', 'expand'];
  var transition = TRANSICIONES.indexOf(trans.type || settings.introTransition) >= 0
    ? (trans.type || settings.introTransition) : 'fade';
  body.classList.add('iv-t-' + transition);
  body.classList.add('iv-dir-' + (trans.direction || 'up'));
  if (trans.ms) body.style.setProperty('--iv-intro-time', (R.num(trans.ms, 800) / 1000) + 's');
  if (trans.easing) body.style.setProperty('--iv-intro-ease', String(trans.easing));
  if (trans.intensity) body.style.setProperty('--iv-intro-power', String(R.num(trans.intensity, 1)));

  var clipsPorObjeto = {};
  (escenaCfg.clips || []).forEach(function (c) { if (c && c.objectId) clipsPorObjeto[c.objectId] = c; });

  /** Hace que un video reproduzca solo el tramo elegido, sin tocar el archivo. */
  function aplicarRecorte(id, c) {
    var nodo = elements[id];
    var video = nodo ? nodo.querySelector('video') : null;
    if (!video) return null;
    var dentro = R.num(c.in, 0), fuera = R.num(c.out, 0);
    if (!(fuera > dentro)) return video;
    var colocar = function () { if (video.currentTime < dentro - 0.05 || video.currentTime > fuera) { try { video.currentTime = dentro; } catch (e) { /* sin metadatos todavía */ } } };
    if (video.readyState >= 1) colocar(); else video.addEventListener('loadedmetadata', colocar, { once: true });
    video.addEventListener('timeupdate', function () {
      if (video.currentTime < fuera - 0.02) return;
      if (video.loop) { try { video.currentTime = dentro; } catch (e) { /* ignorar */ } }
      else { video.pause(); fire('wedditstudio:intro-clip-end'); }
    });
    return video;
  }
  var videosIntro = [];
  for (var claveClip in clipsPorObjeto) {
    if (!Object.prototype.hasOwnProperty.call(clipsPorObjeto, claveClip)) continue;
    var v = aplicarRecorte(claveClip, clipsPorObjeto[claveClip]);
    if (v) videosIntro.push({ video: v, clip: clipsPorObjeto[claveClip] });
  }

  /* ================================================================ la escena de apertura (0.9.4)
   *
   * Hasta 0.9.3 la portada arrancaba sola: `playVideos(introHost, true)` y a correr. Lo que pide el
   * encargo es lo contrario: el sobre quieto en su primer fotograma hasta que el invitado pulsa.
   *
   * Cuatro estados y nada más, para que no pueda abrirse dos veces ni quedarse encallada:
   *
   *     idle ──pulsar──> playing ──fin del segmento──> transitioning ──> opened
   *       └────────────────── omitir / sin animación ──────────────────────┘
   *
   * «opened» es definitivo. Cualquier pulsación que llegue cuando ya no estamos en «idle» se ignora,
   * así que un doble clic no reinicia el video ni dispara una segunda apertura.
   */
  var escena = (function () {
    var estado = 'idle';
    var modo = escenaCfg.start === 'auto' ? 'auto' : 'manual';
    var hayAnimacion = videosIntro.length > 0;
    var vigilantes = [];

    /** Deja cada video quieto en su primer fotograma; los que no empiezan en el segundo 0, escondidos. */
    function colocarAlPrincipio() {
      for (var i = 0; i < videosIntro.length; i++) {
        var x = videosIntro[i], dentro = R.num(x.clip.in, 0);
        x.video.loop = false;
        x.video.pause();
        var ir = function (video, t) { try { video.currentTime = t; } catch (e) { /* aún sin metadatos */ } };
        if (x.video.readyState >= 1) ir(x.video, dentro);
        else (function (video, t) { video.addEventListener('loadedmetadata', function () { ir(video, t); }, { once: true }); })(x.video, dentro);
        mostrarClip(x, R.num(x.clip.start, 0) <= 0.001);
      }
    }

    /** Con varios clips, solo se ve el que toca: el resto esperan su turno escondidos. */
    function mostrarClip(x, visible) {
      var nodo = elements[x.clip.objectId];
      if (!nodo) return;
      nodo.setAttribute('data-intro-hidden', visible ? 'false' : 'true');
    }

    function limpiarVigilantes() {
      for (var i = 0; i < vigilantes.length; i++) vigilantes[i]();
      vigilantes = [];
    }

    /** El segmento ha terminado (o no hay nada que esperar): transición y adentro. */
    function terminar(transicion) {
      if (estado === 'transitioning' || estado === 'opened') return;
      estado = 'transitioning';
      limpiarVigilantes();
      fire('wedditstudio:intro-end');
      if (escenaCfg.openWhenFinished === false) { estado = 'idle'; return; }   // se queda en la portada
      abrirDeVerdad(transicion);
    }

    function abrirDeVerdad(transicion) {
      estado = 'opened';
      abrirInvitacion(transicion);
    }

    /**
     * Pone en marcha la animación. Es lo que hace el botón «Toca para abrir».
     *
     * Con varios clips se respeta el orden de la línea de tiempo: cada uno empieza en su segundo y
     * solo se ve el que está sonando. La escena termina cuando acaba el último.
     */
    function arrancar(transicion) {
      if (estado !== 'idle') return false;          // ya está en marcha o ya se abrió: no se reinicia
      if (!hayAnimacion) { estado = 'transitioning'; abrirDeVerdad(transicion); return true; }
      estado = 'playing';
      body.classList.add('iv-intro-playing');
      fire('wedditstudio:intro-start');

      var repetir = !!escenaCfg.loopIntro;
      var pendientes = videosIntro.length;
      var unoMenos = function () { pendientes--; if (pendientes <= 0 && !repetir) terminar(transicion); };

      for (var i = 0; i < videosIntro.length; i++) {
        (function (x) {
          var dentro = R.num(x.clip.in, 0), fuera = R.num(x.clip.out, 0);
          var arrancaEn = Math.max(0, R.num(x.clip.start, 0));
          var yaTermino = false;

          var alAvanzar = function () {
            if (fuera <= 0 || x.video.currentTime < fuera - 0.04) return;
            if (repetir) { try { x.video.currentTime = dentro; } catch (e) { /* ignorar */ } return; }
            cerrarClip();
          };
          var alTerminar = function () { if (!repetir) cerrarClip(); };
          var cerrarClip = function () {
            if (yaTermino) return;
            yaTermino = true;
            quitar();
            x.video.pause();
            unoMenos();
          };
          var quitar = function () {
            x.video.removeEventListener('timeupdate', alAvanzar);
            x.video.removeEventListener('ended', alTerminar);
          };
          vigilantes.push(quitar);

          var ponerEnMarcha = function () {
            if (estado !== 'playing') return;
            mostrarClip(x, true);
            x.video.loop = repetir;
            try { x.video.currentTime = dentro; } catch (e) { /* sin metadatos */ }
            x.video.addEventListener('timeupdate', alAvanzar);
            x.video.addEventListener('ended', alTerminar);
            var promesa = x.video.play();
            if (promesa && promesa.catch) promesa.catch(function () {
              /* El navegador puede negarse a reproducir. No se deja al invitado encerrado mirando un
                 sobre que no se abre: se cuenta como terminado y la invitación entra igualmente. */
              if (window.console && console.warn) console.warn('La animación de la portada no pudo reproducirse; se continúa hacia la invitación.');
              cerrarClip();
            });
          };

          if (arrancaEn <= 0.001) ponerEnMarcha();
          else {
            var espera = window.setTimeout(ponerEnMarcha, arrancaEn * 1000);
            vigilantes.push(function () { window.clearTimeout(espera); });
          }
        })(videosIntro[i]);
      }

      /* Red de seguridad: si el video se queda clavado, el invitado entra igualmente. El plazo se
         calcula sobre el segmento configurado, con margen, y nunca baja de 12 segundos. */
      if (!repetir) {
        var limite = Math.max(12, R.num(escenaCfg.duration, 0) * 2 + 8) * 1000;
        window.setTimeout(function () { if (estado === 'playing') terminar(transicion); }, limite);
      }
      return true;
    }

    /**
     * Modalidad automática con «apertura animada» (el modo `finish` de 0.9.3): el video ya venía
     * sonando y, al pulsar, se deja terminar antes de entrar. Devuelve true si se queda esperando.
     */
    function esperarFinal(transicion) {
      if (estado !== 'idle') return true;          // ya se está esperando: la segunda pulsación no cuenta
      var sonando = [];
      for (var i = 0; i < videosIntro.length; i++) {
        if (!videosIntro[i].video.ended && !videosIntro[i].video.paused) sonando.push(videosIntro[i]);
      }
      if (!sonando.length) return false;
      estado = 'playing';
      body.classList.add('iv-intro-finishing');
      fire('wedditstudio:intro-finishing');
      var pendientes = sonando.length;
      var unoMenos = function () { pendientes--; if (pendientes <= 0) terminarSiempre(transicion); };
      for (var j = 0; j < sonando.length; j++) {
        (function (x) {
          x.video.loop = false;
          var fuera = R.num(x.clip.out, 0);
          var vigilar = function () {
            if (x.video.ended || (fuera > 0 && x.video.currentTime >= fuera - 0.04)) { quitar(); unoMenos(); }
          };
          var quitar = function () {
            x.video.removeEventListener('timeupdate', vigilar);
            x.video.removeEventListener('ended', vigilar);
          };
          x.video.addEventListener('timeupdate', vigilar);
          x.video.addEventListener('ended', vigilar);
          vigilantes.push(quitar);
        })(sonando[j]);
      }
      window.setTimeout(function () { if (estado === 'playing') terminarSiempre(transicion); }, 15000);
      return true;
    }

    /** Como terminar(), pero entra siempre: aquí el invitado ya pidió abrir. */
    function terminarSiempre(transicion) {
      if (estado === 'transitioning' || estado === 'opened') return;
      estado = 'transitioning';
      limpiarVigilantes();
      fire('wedditstudio:intro-end');
      abrirDeVerdad(transicion);
    }

    /** «Omitir»: entrar sin ver la animación. */
    function omitir(transicion) {
      if (estado === 'opened' || estado === 'transitioning') return false;
      limpiarVigilantes();
      for (var i = 0; i < videosIntro.length; i++) videosIntro[i].video.pause();
      estado = 'transitioning';
      abrirDeVerdad(transicion);
      return true;
    }

    return {
      modo: modo,
      hayAnimacion: hayAnimacion,
      estado: function () { return estado; },
      marcarAbierta: function () { estado = 'opened'; },
      colocarAlPrincipio: colocarAlPrincipio,
      arrancar: arrancar,
      esperarFinal: esperarFinal,
      omitir: omitir
    };
  })();

  /* El botón de apertura: aparece y desaparece en los segundos configurados, y «Activar botón» decide
     aparte si responde al invitado. Desactivado se ve igual, pero no hace nada: así se puede diseñar
     la escena sin que el botón se dispare por error. */
  var cfgBoton = escenaCfg.button || {};
  var nodoBoton = cfgBoton.objectId ? elements[cfgBoton.objectId] : null;
  var relojBoton = 0;
  if (nodoBoton) {
    nodoBoton.setAttribute('data-intro-button', 'true');
    if (!cfgBoton.enabled) nodoBoton.setAttribute('data-intro-disabled', 'true');
    var apareceEn = R.num(cfgBoton.appearAt, 0), ocultaEn = R.num(cfgBoton.hideAt, 0);
    if (apareceEn > 0) nodoBoton.setAttribute('data-intro-hidden', 'true');
    relojBoton = function () {
      var inicio = Date.now();
      var revisar = function () {
        var t = (Date.now() - inicio) / 1000;
        var visible = t >= apareceEn && (ocultaEn <= 0 || t < ocultaEn);
        nodoBoton.setAttribute('data-intro-hidden', visible ? 'false' : 'true');
        nodoBoton.setAttribute('data-intro-shown', visible ? 'true' : 'false');
        if (ocultaEn > 0 && t >= ocultaEn) return;
        if (!opened) window.setTimeout(revisar, 120);
      };
      revisar();
    };
  }

  var skipIntro = settings.introMode === 'none' || intro.visibleObjects === 0 || vista === 'invitacion' || vista === 'invitation';
  if (vista === 'intro') skipIntro = false;
  arrancarCuentas();   // las cuentas regresivas empiezan a correr en cuanto la página está montada
  arrancarInvitado();  // y se pregunta quién abrió el enlace, si lo hay
  layout();
  window.addEventListener('resize', layoutSoon);
  window.addEventListener('orientationchange', layoutSoon);
  if ('ResizeObserver' in window) new ResizeObserver(layoutSoon).observe(column);

  if (skipIntro) {
    body.classList.add('iv-no-intro');
    escena.marcarAbierta();
    abrirInvitacion();
  } else {
    body.classList.add('iv-locked');
    body.setAttribute('data-intro-start', escena.modo);

    if (escena.modo === 'manual' && escena.hayAnimacion) {
      /* Lo que pide el encargo: el sobre quieto en su primer fotograma. Nada se mueve hasta que el
         invitado pulsa. Se coloca el video en su punto de entrada para que se vea el primer
         fotograma en lugar de un rectángulo negro. */
      escena.colocarAlPrincipio();
    } else {
      playVideos(introHost, true);
    }

    if (typeof relojBoton === 'function') relojBoton();   // el botón aparecerá en su segundo

    if (vista !== 'intro') {
      /* Pulsar la portada entera: en 0.9.3 siempre abría. Ahora solo si se configuró así, porque con
         un botón de apertura lo normal es querer que el invitado pulse ahí y no en cualquier sitio. */
      var sueltaLibre = escenaCfg.tapAnywhere !== false ? !!escenaCfg.tapAnywhere : false;
      var mandaElBoton = !!(cfgBoton && cfgBoton.objectId && cfgBoton.enabled);
      var portadaPulsable = sueltaLibre || !mandaElBoton;
      if (portadaPulsable) {
        introHost.setAttribute('role', 'button');
        introHost.setAttribute('tabindex', '0');
        introHost.addEventListener('click', function (event) {
          if (event.target && event.target.closest && event.target.closest('[data-intro-button="true"], .iv-intro-skip')) return;
          open();
        });
        introHost.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
        });
      } else {
        introHost.style.cursor = 'default';
      }

      /* «Omitir animación»: un control aparte, discreto, que entra directamente. */
      if (escenaCfg.allowSkip) {
        var omitir = doc.createElement('button');
        omitir.type = 'button';
        omitir.className = 'iv-intro-skip';
        omitir.textContent = escenaCfg.skipLabel || 'Saltar sobre · Entrar a la invitación';
        omitir.setAttribute('aria-label', 'Entrar a la invitación sin ver la animación');
        omitir.addEventListener('click', function (event) {
          event.preventDefault(); event.stopPropagation();
          escena.omitir();
        });
        introHost.appendChild(omitir);
      }

      /* «Abrir sola tras unos segundos» sigue valiendo en las dos modalidades: es open() quien decide
         qué significa. Con animación manual, al cumplirse el plazo arranca la animación y la invitación
         entra al terminarla; sin animación, entra directamente, como en las versiones anteriores. */
      if (settings.introMode === 'auto') {
        setTimeout(function () { open(); }, Math.max(0.5, R.num(settings.introAutoSeconds, 4)) * 1000);
      }
    }
  }
  body.classList.add('iv-ready');
  fire('wedditstudio:ready'); fire('invitavector:ready');
};

function start() { var R = ivRenderCore(); ivWebRuntime(R, ivUiCore(R)); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
