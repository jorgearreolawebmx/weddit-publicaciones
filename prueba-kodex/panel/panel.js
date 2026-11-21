/* Panel de invitados — Weddit Studio 0.11.1. Habla con Kodex; no guarda nada en el navegador. */
(function () {
  'use strict';
  var raiz = document.getElementById('kx');
  var invitados = [], resumen = {}, evento = {};
  var filtro = '', estadoFiltro = '';

  function el(tag, cls, padre, texto) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (texto !== undefined) n.textContent = texto;
    if (padre) padre.appendChild(n);
    return n;
  }
  function campo(padre, etiqueta, nodo) {
    var l = el('label', '', padre); el('span', '', l, etiqueta); l.appendChild(nodo); return nodo;
  }
  var input = function (v, t) { var i = document.createElement('input'); i.type = t || 'text'; i.value = v === undefined ? '' : v; return i; };

  /* ------------------------------------------------------------ puerta */

  function puerta(aviso) {
    raiz.replaceChildren();
    var caja = el('div', 'kx-gate', raiz);
    el('h1', '', caja, 'Acceso para organizadores');
    el('p', '', caja, 'Esta parte es solo para quienes organizan el evento. Los invitados no la necesitan.');
    var clave = input('', 'password');
    clave.placeholder = 'Contraseña';
    caja.appendChild(clave);
    var acciones = el('div', '', caja);
    acciones.style.cssText = 'margin-top:12px;display:flex;gap:8px';
    var entrar = el('button', 'pri', acciones, 'Entrar');
    var err = el('p', 'kx-err', caja, aviso || '');

    function intentar() {
      err.className = 'kx-err'; err.textContent = 'Comprobando…';
      entrar.disabled = true;
      Kodex.entrar(clave.value).then(function (d) {
        sessionStorage.setItem('kodex-token', d.token);
        evento = d;
        cargar();
      }).catch(function (e) {
        entrar.disabled = false;
        err.className = 'kx-err'; err.textContent = e.message;
      });
    }
    entrar.addEventListener('click', intentar);
    clave.addEventListener('keydown', function (e) { if (e.key === 'Enter') intentar(); });
    clave.focus();
  }

  /* ------------------------------------------------------------ datos */

  function cargar() {
    Kodex.conSesion('invitados.listar').then(function (d) {
      invitados = d.invitados; resumen = d.resumen; evento = Object.assign(evento, d.evento);
      pintar();
    }).catch(function (e) {
      sessionStorage.removeItem('kodex-token');
      puerta(e.codigo === 401 ? '' : e.message);
    });
  }

  function refrescar(mensaje) {
    Kodex.conSesion('invitados.listar').then(function (d) {
      invitados = d.invitados; resumen = d.resumen; evento = Object.assign(evento, d.evento);
      pintar(mensaje);
    });
  }

  /* ------------------------------------------------------------ pantalla */

  function pintar(mensaje) {
    raiz.replaceChildren();
    var w = el('div', 'kx-wrap', raiz);

    var top = el('div', 'kx-top', w);
    el('h1', '', top, evento.nombre || 'Administración del evento');
    var salir = el('button', '', top, 'Salir');
    salir.addEventListener('click', function () {
      Kodex.conSesion('admin.salir').catch(function () {});
      sessionStorage.removeItem('kodex-token');
      puerta();
    });

    // ---- estadísticas
    var st = el('div', 'kx-stats', w);
    [['Invitaciones', resumen.invitaciones], ['Pases asignados', resumen.pases],
     ['Personas confirmadas', resumen.confirmados], ['Pases pendientes', resumen.pasesPendientes],
     ['No asistirán', resumen.noAsisten]].forEach(function (p) {
      var c = el('div', 'kx-stat', st);
      el('b', '', c, String(p[1] === undefined ? 0 : p[1]));
      el('span', '', c, p[0]);
    });

    // ---- alta
    var alta = el('div', 'kx-card', w);
    el('h2', '', alta, 'Nueva invitación');
    var f = el('div', 'kx-form', alta);
    var nombre = campo(f, 'Nombre de la persona o familia', input(''));
    var pases = campo(f, 'Pases asignados', input(1, 'number')); pases.min = 1; pases.max = 50;
    var msj = campo(f, 'Mensaje personalizado', input(''));
    var crear = el('button', 'pri', f, 'Crear y generar enlace');
    var errAlta = el('p', 'kx-err', alta, mensaje || '');
    if (mensaje) errAlta.className = 'kx-err kx-ok';

    crear.addEventListener('click', function () {
      errAlta.className = 'kx-err'; errAlta.textContent = '';
      crear.disabled = true;
      Kodex.conSesion('invitado.crear', { nombre: nombre.value, pases: pases.value, mensaje: msj.value })
        .then(function () { refrescar('Invitación creada.'); })
        .catch(function (e) { crear.disabled = false; errAlta.textContent = e.message; });
    });

    // ---- lista
    var lista = el('div', 'kx-card', w);
    el('h2', '', lista, 'Invitados');
    var tools = el('div', 'kx-tools', lista);
    var buscar = input(filtro, 'search'); buscar.placeholder = 'Buscar por nombre…';
    tools.appendChild(buscar);
    var sel = document.createElement('select');
    [['', 'Todos los estados'], ['Pendiente', 'Pendientes'], ['Confirmada', 'Confirmadas'], ['No asistirá', 'No asistirán']]
      .forEach(function (o) { var x = document.createElement('option'); x.value = o[0]; x.textContent = o[1]; sel.appendChild(x); });
    sel.value = estadoFiltro;
    tools.appendChild(sel);
    var csv = el('button', '', tools, 'Descargar CSV');

    buscar.addEventListener('input', function () { filtro = buscar.value; pintarTabla(); });
    sel.addEventListener('change', function () { estadoFiltro = sel.value; pintarTabla(); });
    csv.addEventListener('click', descargarCsv);

    var cont = el('div', '', lista);
    pintarTabla();

    function visibles() {
      var q = filtro.trim().toLowerCase();
      return invitados.filter(function (i) {
        if (estadoFiltro && i.estado !== estadoFiltro) return false;
        return !q || i.nombre.toLowerCase().indexOf(q) >= 0;
      });
    }

    function pintarTabla() {
      cont.replaceChildren();
      var filas = visibles();
      if (!filas.length) { el('p', 'kx-err', cont, invitados.length ? 'Ningún invitado coincide con la búsqueda.' : 'Todavía no hay invitados.'); return; }
      var t = el('table', 'kx-table', cont);
      var thead = el('thead', '', t), tr = el('tr', '', thead);
      ['Invitado', 'Pases', 'Confirmados', 'Estado', 'Respuesta', 'Enlace', ''].forEach(function (h) { el('th', '', tr, h); });
      var tb = el('tbody', '', t);

      filas.forEach(function (i) {
        var r = el('tr', '', tb);
        var c1 = el('td', '', r); c1.dataset.th = 'Invitado';
        el('div', '', c1, i.nombre);
        if (i.mensaje) { var m = el('div', '', c1, i.mensaje); m.style.cssText = 'color:#9aa3ad;font-size:12px;margin-top:2px'; }

        var c2 = el('td', '', r, String(i.pases)); c2.dataset.th = 'Pases';
        var c3 = el('td', '', r, String(i.confirmados)); c3.dataset.th = 'Confirmados';

        var c4 = el('td', '', r); c4.dataset.th = 'Estado';
        var clase = i.estado === 'Confirmada' ? 'c' : i.estado === 'No asistirá' ? 'n' : 'p';
        el('span', 'kx-pill ' + clase, c4, i.estado);

        var c5 = el('td', '', r, i.respondido ? new Date(i.respondido).toLocaleString() : '—');
        c5.dataset.th = 'Respuesta';

        var c6 = el('td', '', r); c6.dataset.th = 'Enlace';
        var caja = el('div', 'kx-link', c6);
        var u = input(Kodex.enlaceDe(i.codigo)); u.readOnly = true;
        caja.appendChild(u);
        var cop = el('button', '', caja, 'Copiar');
        cop.addEventListener('click', function () {
          u.select();
          (navigator.clipboard ? navigator.clipboard.writeText(u.value) : Promise.reject())
            .then(function () { cop.textContent = 'Copiado'; }, function () { document.execCommand('copy'); cop.textContent = 'Copiado'; });
          setTimeout(function () { cop.textContent = 'Copiar'; }, 1600);
        });

        var c7 = el('td', '', r); c7.dataset.th = '';
        var acts = el('div', 'kx-row-acts', c7);
        var ed = el('button', '', acts, 'Editar');
        var bo = el('button', '', acts, 'Eliminar');
        ed.addEventListener('click', function () { editar(i); });
        bo.addEventListener('click', function () {
          if (!confirm('¿Eliminar la invitación de ' + i.nombre + '? Su enlace dejará de funcionar.')) return;
          Kodex.conSesion('invitado.borrar', { id: i.id }).then(function () { refrescar('Invitación eliminada.'); });
        });
      });
    }

    function editar(i) {
      var nuevoNombre = prompt('Nombre', i.nombre);
      if (nuevoNombre === null) return;
      var nuevosPases = prompt('Pases asignados', String(i.pases));
      if (nuevosPases === null) return;
      var nuevoMsj = prompt('Mensaje personalizado', i.mensaje || '');
      if (nuevoMsj === null) return;
      Kodex.conSesion('invitado.editar', { id: i.id, nombre: nuevoNombre, pases: nuevosPases, mensaje: nuevoMsj })
        .then(function () { refrescar('Invitación actualizada.'); })
        .catch(function (e) { alert(e.message); });
    }

    function descargarCsv() {
      Kodex.conSesion('reporte').then(function (d) {
        var lineas = [d.cabeceras].concat(d.filas).map(function (f) {
          return f.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
        });
        // con BOM para que Excel abra bien los acentos
        var blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'confirmaciones.csv';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      });
    }

    // ---- ajustes
    var aj = el('div', 'kx-card', w);
    el('h2', '', aj, 'Ajustes del evento');
    var fa = el('div', 'kx-form', aj);
    var wa = campo(fa, 'WhatsApp receptor', input(evento.whatsapp || ''));
    var mt = campo(fa, 'Mensaje de confirmación', input(evento.mensaje || ''));
    var gu = el('button', '', fa, 'Guardar ajustes');
    var errAj = el('p', 'kx-err', aj, '');
    gu.addEventListener('click', function () {
      Kodex.conSesion('admin.ajustes', { whatsapp: wa.value, mensaje: mt.value }).then(function (d) {
        evento.whatsapp = d.whatsapp; evento.mensaje = d.mensaje;
        errAj.className = 'kx-err kx-ok'; errAj.textContent = 'Ajustes guardados.';
      }).catch(function (e) { errAj.className = 'kx-err'; errAj.textContent = e.message; });
    });

    var cc = el('div', 'kx-card', w);
    el('h2', '', cc, 'Cambiar la contraseña');
    var fc = el('div', 'kx-form', cc);
    var act = campo(fc, 'Contraseña actual', input('', 'password'));
    var nue = campo(fc, 'Contraseña nueva', input('', 'password'));
    var cb = el('button', '', fc, 'Cambiar');
    var errC = el('p', 'kx-err', cc, '');
    cb.addEventListener('click', function () {
      Kodex.conSesion('admin.cambiarClave', { actual: act.value, nueva: nue.value }).then(function () {
        errC.className = 'kx-err kx-ok';
        errC.textContent = 'Contraseña cambiada. Las sesiones abiertas en otros dispositivos se cerraron.';
        act.value = nue.value = '';
      }).catch(function (e) { errC.className = 'kx-err'; errC.textContent = e.message; });
    });
  }

  /* ------------------------------------------------------------ arranque */
  if (!window.Kodex || !Kodex.cfg.endpoint) {
    raiz.replaceChildren();
    var c = el('div', 'kx-gate', raiz);
    el('h1', '', c, 'Panel no disponible');
    el('p', '', c, 'Esta invitación se publicó sin servicio de administración. Configúralo en Weddit Studio, en «Administración del evento», y vuelve a publicar.');
  } else if (sessionStorage.getItem('kodex-token')) {
    cargar();
  } else {
    puerta();
  }
})();
