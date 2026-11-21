/* Kodex — cliente de la invitación. Generado por Weddit Studio 0.11.1. */
(function (raiz) {
  'use strict';
  var CFG = raiz.WEDDIT_KODEX || {};

  function llamar(cuerpo) {
    if (!CFG.endpoint) return Promise.reject(new Error('Esta invitación no tiene servicio configurado.'));
    return fetch(CFG.endpoint, {
      method: 'POST',
      // texto plano: así el navegador no pide permiso previo, que Apps Script no sabe conceder
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo),
      redirect: 'follow'
    }).then(function (r) { return r.text(); }).then(function (t) {
      var j;
      try { j = JSON.parse(t); } catch (e) { throw new Error('El servicio no respondió correctamente.'); }
      if (!j.ok) { var e2 = new Error(j.error || 'Error del servicio.'); e2.codigo = j.codigo; throw e2; }
      return j.datos;
    });
  }

  /** El código del invitado viaja en la dirección: ...?i=abc123 */
  function codigoDeLaUrl() {
    try { return new URLSearchParams(raiz.location.search).get('i') || ''; } catch (e) { return ''; }
  }

  function enlaceDe(codigo) {
    var u = raiz.location.origin + raiz.location.pathname.replace(/panel\/(index\.html)?$/, '');
    if (u.slice(-1) !== '/') u += '/';
    return u + '?i=' + codigo;
  }

  /** Arma el mensaje de WhatsApp. Abrirlo no prueba que se envió: el registro bueno es el del servicio. */
  function enlaceWhatsApp(numero, texto) {
    var n = String(numero || '').replace(/[^0-9]/g, '');
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto);
  }

  raiz.Kodex = {
    cfg: CFG,
    llamar: llamar,
    codigoDeLaUrl: codigoDeLaUrl,
    enlaceDe: enlaceDe,
    enlaceWhatsApp: enlaceWhatsApp,
    ver: function (codigo) { return llamar({ accion: 'invitacion.ver', codigo: codigo }); },
    responder: function (codigo, asistira, cuantos) {
      return llamar({ accion: 'invitacion.responder', codigo: codigo, asistira: asistira, cuantos: cuantos });
    },
    entrar: function (clave) { return llamar({ accion: 'admin.entrar', eventoId: CFG.eventoId, clave: clave }); },
    conSesion: function (accion, extra) {
      var p = Object.assign({ accion: accion, token: raiz.sessionStorage.getItem('kodex-token') || '' }, extra || {});
      return llamar(p);
    }
  };
})(window);
