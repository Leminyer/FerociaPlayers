/* ============================================================
   FEROCIA PLAYER PORTAL — DUPR ID (§124, SQL 144) · 24 nov 2026
   Aprobado: 1A 2A 3A 4A.
   · Opcional. 6 letras o números (8DPLX8). Se escribe en "A little
     about you" (al registrarse) y en My Identity → Edit profile.
   · Sólo lo ven el jugador y el equipo de FEROCIA (no sale en Play ni en
     la tarjeta del jugador).
   · Dos jugadores no pueden tener el mismo: la base lo dice
     ("dupr_taken") sin decir de quién es.
   Lo usan pj-onboarding.js, pj-profile.js y pj-identity.js.
   ============================================================ */
(function () {
  'use strict';
  const P = window.FerociaPortal;
  if (!P) return;
  const { sb } = P;

  const limpio = (v) => String(v == null ? '' : v).replace(/[\s-]/g, '').toUpperCase();
  const valido = (v) => !limpio(v) || /^[A-Z0-9]{6}$/.test(limpio(v));

  const ERRORES = {
    invalid_dupr: 'Your DUPR ID has 6 letters or numbers (for example 8DPLX8).',
    dupr_taken: 'That DUPR ID is already on another FEROCIA player. Check it in the DUPR app, or send us a message from Help.',
    too_many: 'You changed your DUPR ID many times today. Try again tomorrow.',
  };

  /* El suyo, o null. Si la base todavía no tiene el SQL 144: undefined
     (así las pantallas esconden el campo en vez de fallar). */
  async function leer() {
    const { data, error } = await sb.rpc('portal_mi_dupr');
    if (error) {
      if (/Could not find the function|does not exist/i.test(error.message || '')) return undefined;
      throw error;
    }
    return (data && data.dupr_id) || null;
  }

  async function guardar(v) {
    const { data, error } = await sb.rpc('portal_guardar_dupr', { p_dupr_id: limpio(v) });
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);   // "dupr_taken" llega como respuesta
    return data;
  }

  const textoError = (err) => P.errorTexto(err, ERRORES);

  /* Mientras escribe: mayúsculas, sin espacios. */
  document.querySelectorAll('.pj-dupr').forEach((el) => {
    el.addEventListener('input', () => {
      const pos = el.selectionStart;
      const nuevo = el.value.toUpperCase();
      if (nuevo !== el.value) { el.value = nuevo; try { el.setSelectionRange(pos, pos); } catch (_) { /* nada */ } }
    });
  });

  P.dupr = { limpio, valido, leer, guardar, textoError, ERRORES };
})();
