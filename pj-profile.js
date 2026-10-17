/* ============================================================
   FEROCIA PLAYER PORTAL — Edit profile
   Hitos 3 y 4 (14 de octubre) — pantalla 8 del diseño aprobado
   FEROCIA Identity, etapa I-1 (15 de octubre): + ciudad y estado.
   (La pantalla de "My profile" pasó a ser My Identity: pj-identity.js.)

   · El jugador cambia SOLO teléfono, ciudad, estado, género y nivel
     (portal_guardar_perfil; la base lo vuelve a comprobar y lo deja
     escrito en el historial de su ficha). Nombre y fecha de nacimiento
     están bloqueados: "Request a change" abre Help con "My details".
   · El teléfono, la ciudad y el estado nuevos también pasan a su ficha
     de suscriptor (§43 y §57).
   · El nivel (SQL 107, 17 de octubre): una vez cada 30 días. Si ya lo
     cambió hace poco, los otros niveles salen bloqueados y la nota dice
     desde qué día puede volver a cambiarlo. La base lo comprueba igual.
     Si no tocó el nivel, se manda vacío y la ficha se queda con el que
     tiene (así un nivel del panel que aquí no existe, como "Advanced
     Intermediate", no le impide cambiar el teléfono).
   · Ciudad y estado se escriben igual que en el formulario de
     suscripción (location-fields.js): "boca ratón" queda "Boca Raton".
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { sb, fmt } = P;
  const L = window.FerociaLocation;   // ciudad y estado (location-fields.js)
  const $ = (id) => document.getElementById(id);

  /* ¿Recibe los correos del club? (su ficha de suscriptor; lo usa
     Account settings) */
  P.textoClub = function (estadoSub) {
    switch (estadoSub) {
      case 'active': return { pill: 'Subscribed', clase: 'pj-pill-ok', titulo: 'Club emails: on', ayuda: 'You get FEROCIA Monthly and event news.' };
      case 'pending': return { pill: 'Waiting for you', clase: 'pj-pill-warn', titulo: 'Club emails: confirm your email', ayuda: 'Open the confirmation email we sent you to start getting FEROCIA Monthly.' };
      case 'unsubscribed': return { pill: 'Off', clase: 'pj-pill-gray', titulo: 'Club emails: off', ayuda: 'You unsubscribed. You can sign up again at ferociasports.com.' };
      case 'bounced': return { pill: 'Not delivered', clase: 'pj-pill-warn', titulo: 'Club emails: not delivered', ayuda: 'Our emails could not reach your address. Send us a message from Help.' };
      default: return { pill: 'Not subscribed', clase: 'pj-pill-gray', titulo: 'Club emails: off', ayuda: 'Sign up for FEROCIA Monthly at ferociasports.com.' };
    }
  };

  /* ── 8 · EDIT PROFILE ── */
  const telefono = $('ed-phone');
  P.mascaraTelefono(telefono);
  P.camposLugar('ed-city', 'ed-state');
  const marcar = (el, mal) => { if (mal) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); };
  const elegir = (name, valor) => document.querySelectorAll(`input[name="${name}"]`).forEach((r) => { r.checked = r.value === valor; });
  const elegido = (name) => { const r = document.querySelector(`input[name="${name}"]:checked`); return r ? r.value : ''; };
  function error(texto) { $('ed-error').textContent = texto || ''; $('ed-error').hidden = !texto; }

  /* El nivel: libre, o bloqueado hasta una fecha (YYYY-MM-DD). */
  const NOTA_NIVEL = 'You can change your level once every 30 days.';
  function bloquearNivel(hasta, actual) {
    const fecha = hasta ? fmt.largo(hasta) : '';
    document.querySelectorAll('input[name="ed-level"]').forEach((r) => { r.disabled = !!fecha && r.value !== actual; });
    const nota = $('ed-level-note');
    nota.textContent = fecha ? `You changed your level recently. You can change it again on ${fecha}.` : NOTA_NIVEL;
    nota.classList.toggle('is-locked', !!fecha);
  }

  let original = null;
  P.alEntrar('edit', async () => {
    error('');
    bloquearNivel(null);
    /* Desde cuándo puede volver a cambiar el nivel; si esto falla, se deja
       libre (la base no deja guardarlo antes de tiempo de todas formas). */
    const estadoNivel = sb.rpc('portal_nivel_estado').then((r) => (r.error ? null : r.data), () => null);
    let d;
    try { d = await P.datos(); } catch (err) { error(P.errorTexto(err)); return; }
    const p = d.player || {};
    const estadoUS = L ? L.toStateCode(p.state) : (p.state || '');
    original = {
      phone: String(p.phone || '').replace(/\D/g, ''), gender: p.gender || '', level: p.skill_level || '',
      city: L ? L.normalizeCity(p.city) : (p.city || ''), state: estadoUS,
    };
    telefono.value = fmt.telefono(p.phone);
    $('ed-city').value = original.city;
    $('ed-state').value = estadoUS;
    [telefono, $('ed-city'), $('ed-state')].forEach((el) => marcar(el, false));
    elegir('ed-gender', p.gender);
    elegir('ed-level', p.skill_level);
    const en = await estadoNivel;
    bloquearNivel(en && en.next_change, p.skill_level);
    $('ed-name').textContent = fmt.nombre([p.first_name, p.last_name].filter(Boolean).join(' '));
    $('ed-dob').textContent = fmt.largo(p.date_of_birth) || 'Date of birth not on file';
  });

  $('ed-request').addEventListener('click', () => {
    P.temaAyuda = 'my_details';
    P.ir('help');
  });

  let guardando = false;
  $('ed-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (guardando) return;
    error('');
    const digitos = telefono.value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    const lugar = P.leerLugar('ed-city', 'ed-state');
    const genero = elegido('ed-gender');
    const nivel = elegido('ed-level');
    marcar(telefono, digitos.length !== 10);
    marcar($('ed-city'), lugar.malCiudad);
    marcar($('ed-state'), lugar.malEstado);
    marcar($('ed-gender'), !genero);
    marcar($('ed-level'), !nivel);
    if (digitos.length !== 10) { error('Enter a 10-digit US phone number.'); telefono.focus(); return; }
    if (lugar.malCiudad) { error(P.errorLugar.invalid_city); $('ed-city').focus(); return; }
    if (lugar.malEstado) { error(P.errorLugar.invalid_state); $('ed-state').focus(); return; }
    /* El nivel sólo es obligatorio si la ficha no tiene ninguno. */
    if (!genero || (!nivel && !(original && original.level))) { error('Choose your gender and playing level.'); return; }
    const nivelNuevo = nivel && (!original || nivel !== original.level) ? nivel : null;
    /* Si no tocó ciudad ni estado, no se mandan: la ficha conserva lo que
       ya tenía tal cual (aunque esté escrito a la antigua, "Boca Raton, FL"). */
    const mismoLugar = !!original && original.city === lugar.ciudad && original.state === lugar.estado;
    if (original && original.phone === digitos && original.gender === genero && !nivelNuevo && mismoLugar) {
      P.aviso('Nothing to save — your details are the same.');
      P.ir('profile');
      return;
    }
    guardando = true;
    const b = $('ed-submit');
    b.disabled = true;
    b.setAttribute('aria-busy', 'true');
    try {
      const { error: err } = await sb.rpc('portal_guardar_perfil', {
        p_phone: digitos, p_gender: genero, p_skill_level: nivelNuevo,
        p_city: mismoLugar ? null : lugar.ciudad, p_state: mismoLugar ? null : lugar.estado,
      });
      if (err) throw err;
      P.olvidarDatos();
      P.aviso('Your profile is updated.');
      P.ir('profile');
    } catch (err) {
      console.warn('[portal] guardar perfil:', err);
      if (/level_too_soon/.test((err && err.message) || '')) {
        const hasta = /^\d{4}-\d{2}-\d{2}$/.test((err && err.details) || '') ? err.details : null;
        if (original) elegir('ed-level', original.level);
        bloquearNivel(hasta, original && original.level);
        P.olvidarDatos();
        /* Lo demás que cambió (teléfono, ciudad…) no se guardó: se le dice. */
        const otros = !!original && !(original.phone === digitos && original.gender === genero && mismoLugar);
        error((hasta ? `You changed your level recently. You can change it again on ${fmt.largo(hasta)}.`
          : 'You changed your level recently. You can change it once every 30 days.')
          + (otros ? ' Your other changes aren\'t saved yet — press Save changes again to keep them.' : ''));
        return;
      }
      error(P.errorTexto(err, Object.assign({ invalid_phone: 'Enter a 10-digit US phone number.' }, P.errorLugar)));
    } finally {
      guardando = false;
      b.disabled = false;
      b.setAttribute('aria-busy', 'false');
    }
  });
})();
