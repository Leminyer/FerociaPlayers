/* ============================================================
   FEROCIA PLAYER PORTAL — la cuenta (ajustes) y salir
   Hito 2 (14 de octubre) — pantalla 9 del diseño aprobado, en su
   parte de entrar y salir. Cambiar el correo y los correos del club
   llegan en el hito 4.

   · "Sign out": cierra la sesión en ESTE aparato.
   · "Sign out of all devices": la cierra en todos (por si perdió el
     teléfono). Pide un segundo toque para confirmar.
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const sb = P.sb;
  const $ = (id) => document.getElementById(id);

  function iniciales(nombre, apellido, email) {
    const a = (nombre || '').trim().charAt(0);
    const b = (apellido || '').trim().charAt(0);
    const ini = (a + b) || (email || '?').charAt(0);
    return ini.toUpperCase();
  }

  P.alEntrar('settings', () => {
    const s = P.sesion();
    const u = (s && s.user) || {};
    const meta = u.user_metadata || {};
    const nombre = String(meta.first_name || '').trim();
    const apellido = String(meta.last_name || '').trim();
    $('st-email').textContent = u.email || '';
    $('me-initials').textContent = iniciales(nombre, apellido, u.email);
    $('me-name').textContent = [nombre, apellido].filter(Boolean).join(' ') || (u.email || '');
    reiniciarConfirmacion();
  });

  async function salir(alcance, boton) {
    boton.disabled = true;
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
      boton.disabled = false;
    }
  }

  $('st-out').addEventListener('click', (ev) => salir('local', ev.currentTarget));

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
      confirmando = setTimeout(reiniciarConfirmacion, 5000);
      return;
    }
    reiniciarConfirmacion();
    salir('global', b);
  });
})();
