/* ============================================================
   FEROCIA PLAYER PORTAL — entrar sin contraseña
   Hito 2 (14 de octubre) — decisiones §44 y §45

   SIN CONTRASEÑAS (decidido por ella): el jugador escribe su correo y
   le llega UN correo con dos cosas:
     · un enlace "Sign in to FEROCIA" — lo toca y entra;
     · un código de 6 dígitos — por si abre el correo en otro aparato.
   Las dos valen una vez y caducan en 1 hora (lo pone Supabase).

   CORREO SIN CUENTA (decidido por ella, 14 de octubre, §48): si en
   "Entrar" escribe un correo que todavía no tiene cuenta en el portal,
   no se le deja esperando un correo que nunca llega: pasa a "Crear
   cuenta" con su correo ya escrito y un aviso que lo explica. Supabase
   lo dice al contestar (otp_disabled), sin tocar la base de datos.
   (Se acepta que así se puede saber si un correo tiene cuenta; el
   captcha del hito 5 impide probar miles de correos.)

   El nombre que escribe al crear la cuenta se guarda en la cuenta sólo
   como dato de partida (hito 3 lo usa para buscar su ficha, en el
   servidor, junto con el correo verificado y la fecha de nacimiento).
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const sb = P.sb;

  const ESPERA_REENVIO_S = 60;          // lo mismo que exige Supabase entre correos
  const CLAVE_PENDIENTE = 'pj-pendiente';
  const $ = (id) => document.getElementById(id);

  /* ── Lo que falta por confirmar (sólo en esta pestaña) ── */
  function guardarPendiente(email, modo) {
    try { sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify({ email, modo, en: Date.now() })); } catch (_) { /* privado */ }
    _pendiente = { email, modo, en: Date.now() };
  }
  let _pendiente = null;
  function leerPendiente() {
    if (_pendiente) return _pendiente;
    try {
      const p = JSON.parse(sessionStorage.getItem(CLAVE_PENDIENTE) || 'null');
      if (p && typeof p.email === 'string' && (p.modo === 'sign-in' || p.modo === 'create')) _pendiente = p;
    } catch (_) { /* nada */ }
    return _pendiente;
  }
  function borrarPendiente() {
    _pendiente = null;
    try { sessionStorage.removeItem(CLAVE_PENDIENTE); } catch (_) { /* nada */ }
  }

  /* ── Comprobaciones ── */
  const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const limpiarEmail = (v) => String(v || '').trim().toLowerCase();
  /* Letras de cualquier idioma, espacios, guion, apóstrofo y punto. */
  const NOMBRE_OK = /^[\p{L}][\p{L}\p{M} '.\-]{0,59}$/u;
  const limpiarNombre = (v) => String(v || '').replace(/\s+/g, ' ').trim();

  function marcar(input, mal) {
    if (mal) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  function mostrarError(id, texto) {
    const e = $(id);
    if (!e) return;
    e.textContent = texto || '';
    e.hidden = !texto;
  }

  /* Qué decirle según lo que contestó Supabase. "enCodigo" = la
     respuesta viene de comprobar el código de 6 dígitos. */
  function explicar(error, enCodigo) {
    const msg = String((error && error.message) || '');
    const codigo = String((error && (error.code || error.error_code)) || '');
    const estado = Number(error && error.status);
    if (estado === 429 || /rate limit|too many|after \d+ seconds/i.test(msg) || codigo === 'over_email_send_rate_limit') {
      return { tipo: 'espera', texto: 'For security, please wait a minute before asking for another email.' };
    }
    if (codigo === 'signup_disabled' || codigo === 'otp_disabled' || /signups? not allowed/i.test(msg)) {
      return { tipo: 'sin_registro' };
    }
    if (!enCodigo && (codigo === 'email_address_invalid' || codigo === 'validation_failed' || /email.*invalid|invalid.*email/i.test(msg))) {
      return { tipo: 'correo', texto: 'Enter a valid email address.' };
    }
    if (enCodigo && (codigo === 'otp_expired' || /expired|invalid/i.test(msg))) {
      return { tipo: 'codigo', texto: "That code didn't work. Check the numbers, or ask for a new email." };
    }
    if (window.FerociaCaptcha && window.FerociaCaptcha.esErrorDeCaptcha(error)) {
      /* El código corto ayuda al equipo a saber la causa si el jugador escribe. */
      const cod = /^[\w-]{1,20}$/.test(String((error && error.captchaCodigo) || '')) ? ` (code ${error.captchaCodigo})` : '';
      return { tipo: 'captcha', texto: `We couldn't check that you're a person. If you use an ad blocker, pause it for this page (or try another browser), then try again.${cod}` };
    }
    if (error instanceof TypeError || /fetch|network|failed to/i.test(msg)) {
      return { tipo: 'red', texto: "We couldn't connect. Check your internet connection and try again." };
    }
    return { tipo: 'otro', texto: 'Something went wrong. Please try again in a moment.' };
  }

  /* Hito 5: antes de pedir el correo, la verificación de Cloudflare
     (ferocia-captcha.js). "caja" es dónde aparece la casilla, si hace
     falta marcarla. Cada verificación vale una sola vez.
     17 oct: si Supabase rechaza la verificación, se pide otra a Cloudflare
     y se intenta UNA vez más, sin que el jugador haga nada (no si
     Cloudflare no cargó o no contestó: eso no se arregla al momento). Si
     vuelve a fallar, el error lleva un código corto (captchaCodigo):
     el de Cloudflare, o 'rejected' si Supabase no aceptó una verificación. */
  async function pedirCorreo(email, modo, datos, caja) {
    const C = window.FerociaCaptcha;
    const cajaEl = caja ? $(caja) : null;
    const intento = async () => {
      const opciones = { emailRedirectTo: P.vuelta(), shouldCreateUser: modo === 'create' };
      if (modo === 'create' && datos) opciones.data = datos;
      const token = C && cajaEl ? await C.token(cajaEl) : null;
      if (token) opciones.captchaToken = token;
      try {
        const { error } = await sb.auth.signInWithOtp({ email, options: opciones });
        return { error: error || null, conToken: !!token };
      } finally {
        if (C && cajaEl) C.usado(cajaEl);
      }
    };
    let r = await intento();
    const deCaptcha = (x) => !!(x.error && C && C.esErrorDeCaptcha(x.error));
    const sinArreglo = (cod) => ['no-script', 'timeout', 'unsupported', 'render'].includes(cod);
    if (deCaptcha(r) && cajaEl && !r.conToken && sinArreglo(C.codigo(cajaEl))) {
      /* no se reintenta: Cloudflare no puede contestar ahora */
    } else if (deCaptcha(r) && cajaEl) {
      const primero = r;
      r = await intento();
      /* Si el reintento choca con "espera un minuto", no salió ningún correo:
         se enseña el problema de la verificación, no "revisa tu correo". */
      if (r.error && Number(r.error.status) === 429) r = primero;
    }
    if (deCaptcha(r)) {
      const cod = r.conToken ? 'rejected' : ((cajaEl && C.codigo(cajaEl)) || 'no-token');
      try { r.error.captchaCodigo = cod; } catch (_) { /* nada */ }
      console.warn('[portal] captcha:', cod);
    }
    return r.error;
  }

  function ocupado(boton, si) {
    if (!boton) return;
    boton.disabled = si;
    boton.setAttribute('aria-busy', si ? 'true' : 'false');
  }

  /* ── 1 · ENTRAR ── */
  let enviando = false;
  /* El correo que "Entrar" no encontró, para escribirlo en "Crear cuenta". */
  let correoSinCuenta = null;
  $('si-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (enviando) return;
    const input = $('si-email');
    const email = limpiarEmail(input.value);
    mostrarError('si-error', '');
    if (!EMAIL_OK.test(email)) {
      marcar(input, true);
      mostrarError('si-error', 'Enter a valid email address.');
      input.focus();
      return;
    }
    marcar(input, false);
    enviando = true;
    ocupado($('si-submit'), true);
    try {
      const error = await pedirCorreo(email, 'sign-in', null, 'si-captcha');
      if (error) {
        const e = explicar(error);
        /* Sin cuenta: a "Crear cuenta", con su correo ya escrito. */
        if (e.tipo === 'sin_registro') {
          correoSinCuenta = email;
          P.ir('create');
          return;
        }
        /* "Espera un minuto": la cuenta existe y el correo anterior sigue
           valiendo. Se pasa a "Revisa tu correo", donde la cuenta atrás
           ya pide esperar antes de reenviar. */
        if (e.tipo !== 'espera') { mostrarError('si-error', e.texto); return; }
      }
      guardarPendiente(email, 'sign-in');
      P.ir('check');
    } catch (err) {
      mostrarError('si-error', explicar(err).texto);
    } finally {
      enviando = false;
      ocupado($('si-submit'), false);
    }
  });

  /* ── 2 · CREAR CUENTA ── */
  $('ca-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (enviando) return;
    mostrarError('ca-error', '');
    const first = $('ca-first'), last = $('ca-last'), mail = $('ca-email'), terms = $('ca-terms');
    const nombre = limpiarNombre(first.value);
    const apellido = limpiarNombre(last.value);
    const email = limpiarEmail(mail.value);
    const fallos = [];
    marcar(first, !NOMBRE_OK.test(nombre)); if (!NOMBRE_OK.test(nombre)) fallos.push(first);
    marcar(last, !NOMBRE_OK.test(apellido)); if (!NOMBRE_OK.test(apellido)) fallos.push(last);
    marcar(mail, !EMAIL_OK.test(email)); if (!EMAIL_OK.test(email)) fallos.push(mail);
    if (fallos.length) {
      mostrarError('ca-error', 'Please check the highlighted fields.');
      fallos[0].focus();
      return;
    }
    if (!terms.checked) {
      mostrarError('ca-error', 'Please agree to the Terms of Use and Privacy Policy to continue.');
      terms.focus();
      return;
    }
    enviando = true;
    ocupado($('ca-submit'), true);
    try {
      const error = await pedirCorreo(email, 'create', { first_name: nombre, last_name: apellido }, 'ca-captcha');
      if (error) {
        const e = explicar(error);
        mostrarError('ca-error', e.tipo === 'sin_registro'
          ? "New accounts aren't open yet. Please check back soon."
          : e.texto);
        return;
      }
      guardarPendiente(email, 'create');
      P.ir('check');
    } catch (err) {
      mostrarError('ca-error', explicar(err).texto);
    } finally {
      enviando = false;
      ocupado($('ca-submit'), false);
    }
  });

  /* ── 3 · REVISA TU CORREO ── */
  const casillas = () => Array.from($('ck-code').querySelectorAll('input'));
  const codigo = () => casillas().map((i) => i.value).join('');

  function vaciarCasillas() {
    casillas().forEach((i) => { i.value = ''; marcar(i, false); });
  }

  /* Escribir, borrar y pegar el código. */
  casillas().forEach((input, i, todas) => {
    /* Al entrar en una casilla llena, se selecciona: escribir la cambia. */
    input.addEventListener('focus', () => input.select());
    input.addEventListener('input', () => {
      const solo = input.value.replace(/\D/g, '');
      if (solo.length > 1) {                       // autocompletar / pegar dentro
        repartir(solo, solo.length >= 6 ? 0 : i);
        return;
      }
      input.value = solo;
      if (solo && i < todas.length - 1) todas[i + 1].focus();
      if (codigo().length === 6) enviarCodigo();
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Backspace' && !input.value && i > 0) { todas[i - 1].focus(); todas[i - 1].value = ''; ev.preventDefault(); }
      if (ev.key === 'ArrowLeft' && i > 0) todas[i - 1].focus();
      if (ev.key === 'ArrowRight' && i < todas.length - 1) todas[i + 1].focus();
    });
    input.addEventListener('paste', (ev) => {
      const txt = (ev.clipboardData || window.clipboardData).getData('text') || '';
      const solo = txt.replace(/\D/g, '');
      if (!solo) return;
      ev.preventDefault();
      repartir(solo, solo.length >= 6 ? 0 : i);
    });
  });
  /* Reparte varios dígitos desde una casilla. Las casillas que quedan
     detrás se vacían, para que lo pegado nunca se mezcle con números
     viejos; y sólo se envía solo si quedaron las 6 llenas. */
  function repartir(digitos, desde) {
    const todas = casillas();
    const d = digitos.slice(0, todas.length - desde);
    todas.forEach((c, k) => {
      if (k >= desde) c.value = k < desde + d.length ? d[k - desde] : '';
    });
    const sig = Math.min(desde + d.length, todas.length - 1);
    todas[sig].focus();
    if (codigo().length === 6) enviarCodigo();
  }

  let verificando = false;
  async function enviarCodigo() {
    if (verificando) return;
    const p = leerPendiente();
    const token = codigo();
    mostrarError('ck-error', '');
    if (!p) { P.ir('sign-in'); return; }
    if (!/^\d{6}$/.test(token)) {
      casillas().forEach((c) => marcar(c, !c.value));
      mostrarError('ck-error', 'Enter all 6 digits of the code.');
      return;
    }
    verificando = true;
    ocupado($('ck-submit'), true);
    try {
      const { error } = await sb.auth.verifyOtp({ email: p.email, token, type: 'email' });
      if (error) {
        const e = explicar(error, true);
        mostrarError('ck-error', e.tipo === 'espera' ? e.texto : (e.tipo === 'red' ? e.texto
          : "That code didn't work. Check the numbers, or ask for a new email."));
        vaciarCasillas();
        casillas()[0].focus();
        return;
      }
      borrarPendiente();
      vaciarCasillas();
      /* pj-app.js cambia de pantalla al recibir SIGNED_IN. */
    } catch (err) {
      mostrarError('ck-error', explicar(err).texto);
    } finally {
      verificando = false;
      ocupado($('ck-submit'), false);
    }
  }
  $('ck-form').addEventListener('submit', (ev) => { ev.preventDefault(); enviarCodigo(); });

  /* Reenviar, con la espera de 60 segundos a la vista. */
  let relojReenvio = null;
  function pintarReenvio() {
    const p = leerPendiente();
    const b = $('ck-resend');
    clearInterval(relojReenvio);
    const tick = () => {
      const faltan = p ? Math.ceil((p.en + ESPERA_REENVIO_S * 1000 - Date.now()) / 1000) : 0;
      if (faltan > 0) {
        b.disabled = true;
        b.textContent = `Send again in 0:${String(faltan).padStart(2, '0')}`;
      } else {
        b.disabled = false;
        b.textContent = 'Send it again';
        clearInterval(relojReenvio);
      }
    };
    tick();
    relojReenvio = setInterval(tick, 1000);
  }
  $('ck-resend').addEventListener('click', async () => {
    const p = leerPendiente();
    if (!p || enviando) return;
    enviando = true;
    $('ck-resend').disabled = true;
    mostrarError('ck-error', '');
    try {
      const error = await pedirCorreo(p.email, p.modo, null, 'ck-captcha');
      if (error) {
        const e = explicar(error);
        if (e.tipo !== 'sin_registro') { mostrarError('ck-error', e.texto); return; }
      }
      guardarPendiente(p.email, p.modo);
      P.aviso('We sent you a new email. Use the newest link or code.');
    } catch (err) {
      mostrarError('ck-error', explicar(err).texto);
    } finally {
      enviando = false;
      pintarReenvio();
    }
  });

  P.alEntrar('check', () => {
    const p = leerPendiente();
    if (!p) { P.ir('sign-in'); return; }
    const lead = $('ck-lead');
    const correo = document.createElement('strong');
    correo.textContent = p.email;                         // como texto, nunca HTML
    const boton = document.createElement('strong');
    boton.textContent = 'Sign in to FEROCIA';
    lead.replaceChildren(
      document.createTextNode('We sent a sign-in link to '),
      correo,
      document.createTextNode('. Tap '),
      boton,
      document.createTextNode(" in that email and you're in."));
    /* Los pasos sólo tienen sentido al crear la cuenta. */
    $('ck-steps').hidden = p.modo !== 'create';
    $('ck-other').setAttribute('href', p.modo === 'create' ? '#/create' : '#/sign-in');
    mostrarError('ck-error', '');
    vaciarCasillas();
    pintarReenvio();
  });

  P.alEntrar('sign-in', () => { mostrarError('si-error', ''); });
  P.alEntrar('create', () => {
    mostrarError('ca-error', '');
    const info = $('ca-info');
    if (correoSinCuenta) {
      $('ca-email').value = correoSinCuenta;
      marcar($('ca-email'), false);
      info.textContent = "We couldn't find a portal account for this email. Create yours below — it takes a minute, and if you've played at FEROCIA we'll bring in your history.";
      info.hidden = false;
      correoSinCuenta = null;
    } else {
      info.textContent = '';
      info.hidden = true;
    }
  });

  /* Al entrar de verdad, lo pendiente ya no sirve. */
  sb.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_IN') borrarPendiente(); });
})();
