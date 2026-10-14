/* ============================================================
   FEROCIA PLAYER PORTAL — Account settings y salir
   Hito 2 (14 de octubre): salir y salir de todos los aparatos.
   Hitos 3 y 4 (14 de octubre) — pantalla 9 del diseño aprobado:
   cambiar el correo y ver si recibe los correos del club.

   · "Change email": Supabase manda un enlace al correo nuevo (y, por
     seguridad, otro al de ahora). El cambio ocurre al confirmarlo;
     entonces la base lo copia a su ficha y a su ficha de suscriptor
     (decisión §43).
   · "Sign out": cierra la sesión en ESTE aparato.
   · "Sign out of all devices": la cierra en todos (por si perdió el
     teléfono). Pide un segundo toque para confirmar.
   · Cualquier botón con data-action="sign-out" (las pantallas de
     espera, la cabecera sencilla) también sale.
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const sb = P.sb;
  const $ = (id) => document.getElementById(id);
  const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  P.alEntrar('settings', async () => {
    const s = P.sesion();
    const u = (s && s.user) || {};
    $('st-email').textContent = u.email || (P.estado() || {}).email || '';
    reiniciarConfirmacion();
    cerrarCambio();
    try {
      const d = await P.datos();
      const club = P.textoClub(d.club_emails);
      $('st-club').textContent = club.pill;
      $('st-club').className = `pj-pill ${club.clase}`;
      $('st-club-help').textContent = club.ayuda;
    } catch (err) {
      console.warn('[portal] ajustes:', err);
      $('st-club').textContent = '';
      $('st-club-help').textContent = '';
    }
  });

  /* ── Cambiar el correo ── */
  const formCambio = $('st-change-form');
  function cerrarCambio() {
    formCambio.hidden = true;
    $('st-change').setAttribute('aria-expanded', 'false');
    $('st-change').hidden = false;
    $('st-new-email').value = '';
    $('st-new-email').removeAttribute('aria-invalid');
    $('st-change-error').hidden = true;
    $('st-change-ok').hidden = true;
    $('st-change-send').hidden = false;
  }
  $('st-change').addEventListener('click', () => {
    formCambio.hidden = false;
    $('st-change').setAttribute('aria-expanded', 'true');
    $('st-change').hidden = true;
    $('st-new-email').focus();
  });
  $('st-change-cancel').addEventListener('click', () => { cerrarCambio(); $('st-change').focus(); });

  let cambiando = false;
  formCambio.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (cambiando) return;
    const input = $('st-new-email');
    const nuevo = input.value.trim().toLowerCase();
    const actual = String(((P.sesion() || {}).user || {}).email || '').toLowerCase();
    const err = $('st-change-error');
    err.hidden = true;
    $('st-change-ok').hidden = true;
    if (!EMAIL_OK.test(nuevo)) {
      input.setAttribute('aria-invalid', 'true');
      err.textContent = 'Enter a valid email address.';
      err.hidden = false;
      input.focus();
      return;
    }
    if (nuevo === actual) {
      input.setAttribute('aria-invalid', 'true');
      err.textContent = 'That is already your email.';
      err.hidden = false;
      return;
    }
    input.removeAttribute('aria-invalid');
    cambiando = true;
    const b = $('st-change-send');
    b.disabled = true;
    b.setAttribute('aria-busy', 'true');
    try {
      const { error } = await sb.auth.updateUser({ email: nuevo }, { emailRedirectTo: P.vuelta() });
      if (error) throw error;
      const ok = $('st-change-ok');
      ok.textContent = '';
      ok.append('We sent a confirmation link to ', Object.assign(document.createElement('strong'), { textContent: nuevo }),
        '. Open it to finish the change. Until then, keep using your current email.');
      ok.hidden = false;
      b.hidden = true;
    } catch (e) {
      console.warn('[portal] cambiar correo:', e);
      const m = String((e && e.message) || '');
      const estado = Number(e && e.status);
      err.textContent = estado === 429 || /rate limit|after \d+ seconds/i.test(m)
        ? 'For security, please wait a minute before asking for another email.'
        : /already|registered|exists/i.test(m) ? 'That email is already used by another portal account.'
        : P.errorTexto(e);
      err.hidden = false;
    } finally {
      cambiando = false;
      b.disabled = false;
      b.setAttribute('aria-busy', 'false');
    }
  });

  /* ── Salir ── */
  async function salir(alcance, boton) {
    if (boton) boton.disabled = true;
    try {
      const { error } = await sb.auth.signOut({ scope: alcance });
      if (error) throw error;
      P.aviso(alcance === 'global' ? 'You are signed out on all your devices.' : 'You are signed out.');
    } catch (err) {
      console.warn('[portal] salir:', err);
      /* El servidor no contestó (sin internet, o Supabase caído). En ese
         caso supabase-js NO borra la sesión, así que se borra a mano en
         este aparato y se recarga: queda fuera de verdad. */
      P.olvidarSesionAqui();
      return;
    } finally {
      if (boton) boton.disabled = false;
    }
  }

  $('st-out').addEventListener('click', (ev) => salir('local', ev.currentTarget));
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-action="sign-out"]');
    if (b) salir('local', b);
  });

  /* Segundo toque para confirmar "todos los aparatos". */
  const TEXTO_TODOS = 'Sign out of all devices';
  let confirmando = null;
  function reiniciarConfirmacion() {
    clearTimeout(confirmando);
    confirmando = null;
    const b = $('st-out-all');
    b.textContent = TEXTO_TODOS;
  }
  $('st-out-all').addEventListener('click', (ev) => {
    const b = ev.currentTarget;
    if (!confirmando) {
      b.textContent = 'Tap again to confirm';
      P.aviso('Tap the button again to sign out on every device.');
      confirmando = setTimeout(reiniciarConfirmacion, 5000);
      return;
    }
    reiniciarConfirmacion();
    salir('global', b);
  });
})();
