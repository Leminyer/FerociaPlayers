/* ============================================================
   FEROCIA PLAYER PORTAL — completar el perfil y unir la ficha
   Hitos 3 y 4 (14 de octubre) — pantallas 4, 5a y 5b del diseño

   · "A little about you": fecha de nacimiento, teléfono, ciudad, estado,
     género y nivel (y nombre y apellido, ya escritos desde "Create
     account"). Ciudad y estado: FEROCIA Identity I-1 (15 de octubre).
     Lo manda a la base (portal_completar), que decide sola si une su
     ficha, si la deja en revisión o si le crea una nueva. Aquí sólo
     se comprueba que esté bien escrito; quién es quién lo decide la
     base, nunca el navegador.
   · La pantalla de espera (en revisión, o no se pudo confirmar).
   · La bienvenida cuando se acaba de unir (después del paso "Your
     Player DNA", que lleva pj-dna.js).
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { sb, h, fmt } = P;
  const $ = (id) => document.getElementById(id);

  /* Las mismas reglas que "Create account" (y que la base). */
  const NOMBRE_OK = /^[\p{L}][\p{L}\p{M} '.\-]{0,59}$/u;
  const limpiarNombre = (v) => String(v || '').replace(/\s+/g, ' ').trim();

  function marcar(el, mal) {
    if (!el) return;
    if (mal) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  }
  function mostrarError(id, texto) {
    const e = $(id);
    if (!e) return;
    e.textContent = texto || '';
    e.hidden = !texto;
  }

  /* ── La fecha: MM / DD / YYYY mientras se escribe ── */
  const dob = $('ab-dob');
  dob.addEventListener('input', () => {
    const d = dob.value.replace(/\D/g, '').slice(0, 8);
    let v = d;
    if (d.length > 4) v = `${d.slice(0, 2)} / ${d.slice(2, 4)} / ${d.slice(4)}`;
    else if (d.length > 2) v = `${d.slice(0, 2)} / ${d.slice(2)}`;
    dob.value = v;
  });
  /* "04/12/1985" → "1985-04-12", o null si no es una fecha de verdad. */
  function leerFecha(texto) {
    const m = /^(\d{1,2})\D+(\d{1,2})\D+(\d{4})$/.exec(String(texto || '').trim());
    if (!m) return null;
    const mm = +m[1], dd = +m[2], yy = +m[3];
    const f = new Date(Date.UTC(yy, mm - 1, dd));
    if (f.getUTCFullYear() !== yy || f.getUTCMonth() !== mm - 1 || f.getUTCDate() !== dd) return null;
    return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
  function edad(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const hoy = new Date();
    let e = hoy.getFullYear() - y;
    if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) e--;
    return e;
  }

  P.mascaraTelefono($('ab-phone'));
  P.camposLugar('ab-city', 'ab-state');
  /* { nuevo } al acabar de unirse. Se guarda también en esta pestaña
     (sessionStorage) por si recarga en el paso "Your Player DNA", que va
     justo después (Player DNA, §62); luego vuelve a la bienvenida. Va
     con el id de la cuenta: otra cuenta en la misma pestaña no la ve. */
  const CLAVE_BV = 'ferocia-players-bienvenida';
  let bienvenida = null;
  const yo = () => { const s = P.sesion(); return s && s.user ? s.user.id : null; };
  function guardarBienvenida(v) {
    bienvenida = v;
    try {
      if (v) sessionStorage.setItem(CLAVE_BV, JSON.stringify({ uid: yo(), nuevo: !!v.nuevo }));
      else sessionStorage.removeItem(CLAVE_BV);
    } catch (_) { /* sin almacenamiento: sólo en memoria */ }
  }
  P.hayBienvenida = () => {
    if (bienvenida) return true;
    try {
      const g = JSON.parse(sessionStorage.getItem(CLAVE_BV) || 'null');
      if (g && g.uid && g.uid === yo()) { bienvenida = { nuevo: !!g.nuevo }; return true; }
    } catch (_) { /* nada */ }
    return false;
  };
  const elegido = (name) => {
    const r = document.querySelector(`input[name="${name}"]:checked`);
    return r ? r.value : '';
  };

  /* ── 4 · A LITTLE ABOUT YOU ── */
  /* Menores de 18 (17 oct): la tarjeta "Junior players are coming soon"
     en vez del formulario. No se guarda nada; "Go back" vuelve al
     formulario por si se equivocó de fecha. */
  function mostrarJunior(si) {
    const form = $('ab-form').closest('.pj-card');
    form.hidden = si;
    $('ab-junior').hidden = !si;
    $('ab-form').closest('[data-screen]').setAttribute('aria-labelledby', si ? 'ab-junior-title' : 'ab-title');
    if (si) { mostrarError('ab-error', ''); window.scrollTo(0, 0); $('ab-junior-title').focus(); }
  }
  $('ab-junior-back').addEventListener('click', () => {
    mostrarJunior(false);
    const dob = $('ab-dob');
    dob.select();
    dob.focus();
  });

  P.alEntrar('about', () => {
    mostrarJunior(false);
    const e = P.estado() || {};
    const f = $('ab-first'), l = $('ab-last');
    if (!f.value) f.value = e.first_name || '';
    if (!l.value) l.value = e.last_name || '';
    mostrarError('ab-error', '');
  });

  let enviando = false;
  $('ab-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (enviando) return;
    mostrarError('ab-error', '');
    const first = $('ab-first'), last = $('ab-last'), phone = $('ab-phone');
    const nombre = limpiarNombre(first.value);
    const apellido = limpiarNombre(last.value);
    const fecha = leerFecha(dob.value);
    const digitos = phone.value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    const lugar = P.leerLugar('ab-city', 'ab-state');
    const genero = elegido('ab-gender');
    const nivel = elegido('ab-level');

    const fallos = [];
    const revisa = (el, mal) => { marcar(el, mal); if (mal) fallos.push(el); };
    revisa(first, !NOMBRE_OK.test(nombre));
    revisa(last, !NOMBRE_OK.test(apellido));
    revisa(dob, !fecha);
    revisa(phone, digitos.length !== 10);
    revisa($('ab-city'), lugar.malCiudad);
    revisa($('ab-state'), lugar.malEstado);
    revisa($('ab-gender'), !genero);
    revisa($('ab-level'), !nivel);
    if (fallos.length) {
      mostrarError('ab-error', !fecha && dob.value.trim()
        ? 'Enter your date of birth as MM / DD / YYYY.'
        : 'Please complete the highlighted fields.');
      const primero = fallos[0];
      (primero.tagName === 'FIELDSET' ? primero.querySelector('input') : primero).focus();
      return;
    }
    if (edad(fecha) < 18) {
      marcar(dob, true);
      mostrarJunior(true);
      return;
    }

    enviando = true;
    const boton = $('ab-submit');
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
    /* SQL 109: la ciudad tiene que estar en el estado elegido. */
    if (!(await P.comprobarLugar('ab-city', 'ab-state', lugar))) {
      enviando = false;
      boton.disabled = false;
      boton.setAttribute('aria-busy', 'false');
      return;
    }
    try {
      const { data, error } = await sb.rpc('portal_completar', {
        p_first_name: nombre, p_last_name: apellido, p_date_of_birth: fecha,
        p_phone: digitos, p_gender: genero, p_skill_level: nivel,
        p_city: lugar.ciudad, p_state: lugar.estado,
      });
      if (error) throw error;
      P.olvidarDatos();
      /* Recién unido: directo a la bienvenida (sin pasar por Home). */
      if (data && data.estado === 'vinculado' && data.recien) {
        guardarBienvenida({ nuevo: !!data.nuevo });
        history.replaceState(null, '', '#/welcome');
      }
      await P.refrescar();
    } catch (err) {
      console.warn('[portal] completar:', err);
      if (/under_18/.test((err && err.message) || '')) { mostrarJunior(true); return; }
      mostrarError('ab-error', P.errorTexto(err, {
        invalid_date_of_birth: 'Enter your date of birth as MM / DD / YYYY.',
        invalid_phone: 'Enter a 10-digit US phone number.',
        invalid_name: 'Check your first and last name.',
        email_not_confirmed: 'Please confirm your email first — open the link we sent you.',
        invalid_city: P.errorLugar.invalid_city,
        invalid_state: P.errorLugar.invalid_state,
        "don't match": P.errorLugar["don't match"],
      }));
    } finally {
      enviando = false;
      boton.disabled = false;
      boton.setAttribute('aria-busy', 'false');
    }
  });

  /* ── 5a · EN REVISIÓN ── */
  const TEXTOS = {
    en_revision: {
      eyebrow: 'Almost there',
      title: "We're connecting your FEROCIA history",
      lead: "Our team is confirming a few details by hand. We'll email you as soon as your ladders and results are ready — usually within one business day.",
      now: 'Player history — in review',
    },
    rechazado: {
      eyebrow: 'We need a hand',
      title: "We couldn't confirm your FEROCIA history",
      lead: "Our team couldn't match your account to a player record. Send us a message and we'll sort it out together.",
      now: 'Player history — needs your help',
    },
  };

  async function pintarEspera() {
    const e = P.estado() || {};
    const t = TEXTOS[e.estado] || TEXTOS.en_revision;
    $('rv-eyebrow').textContent = t.eyebrow;
    $('rv-title').textContent = t.title;
    $('rv-lead').textContent = t.lead;
    $('rv-now-txt').textContent = t.now;
    document.querySelector('[data-screen="review"]').classList.toggle('is-rechazado', e.estado === 'rechazado');

    /* "While you wait": el Video of the Month y el próximo evento. Son
       públicos (los mismos de ferociasports.com). Si fallan, no pasa nada. */
    const caja = $('rv-wait-grid');
    if (caja.dataset.listo) return;
    try {
      const hoy = new Date();
      const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
      const [vid, evs] = await Promise.all([
        sb.from('videos').select('youtube_id,title').eq('is_featured', true).limit(1),
        sb.from('events').select('id,title,event_date').gte('event_date', hoyIso).order('event_date').limit(1),
      ]);
      const tarjetas = [];
      const v = vid.data && vid.data[0];
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v.youtube_id)) {
        tarjetas.push(h('a', { class: 'pj-wait-card pj-wait-dark', href: `https://www.youtube.com/watch?v=${v.youtube_id}`, target: '_blank', rel: 'noopener' },
          h('span', { class: 'pj-wait-kicker pj-lime', text: 'Video of the Month' }),
          h('span', { class: 'pj-wait-title', text: v.title }),
          h('span', { class: 'pj-wait-go pj-lime', text: 'Watch on YouTube ↗' })));
      }
      const ev = evs.data && evs.data[0];
      if (ev) {
        tarjetas.push(h('a', { class: 'pj-wait-card', href: 'https://ferociasports.com/#events', target: '_blank', rel: 'noopener' },
          h('span', { class: 'pj-wait-kicker pj-orange', text: `Upcoming · ${fmt.corto(ev.event_date)}` }),
          h('span', { class: 'pj-wait-title', text: ev.title }),
          h('span', { class: 'pj-wait-go', text: 'See details ↗' })));
      }
      caja.replaceChildren(...tarjetas);
      $('rv-wait').hidden = !tarjetas.length;
      caja.dataset.listo = '1';
    } catch (err) {
      console.warn('[portal] while you wait:', err);
    }
  }
  P.alEntrar('review', pintarEspera);

  /* "Check again": por si ya la aprobaron mientras tanto. */
  let mirando = false;
  $('rv-refresh').addEventListener('click', async () => {
    if (mirando) return;
    mirando = true;
    const b = $('rv-refresh');
    b.disabled = true;
    try {
      await P.refrescar();
      const e = P.estado();
      if (e && e.estado !== 'vinculado') P.aviso('Still in review. We will email you as soon as it is ready.');
    } finally {
      mirando = false;
      b.disabled = false;
    }
  });
  /* Al volver a la pestaña también se mira (sin avisos). */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const e = P.estado();
    if (e && (e.estado === 'en_revision' || e.estado === 'rechazado')) P.refrescar();
  });

  /* ── 5b · BIENVENIDA ── */
  P.alEntrar('welcome', async () => {
    const e = P.estado() || {};
    P.hayBienvenida();
    const nuevo = !!(bienvenida && bienvenida.nuevo);
    /* Ya se enseñó: fuera de la pestaña (en memoria sigue para repintar). */
    try { sessionStorage.removeItem(CLAVE_BV); } catch (_) { /* nada */ }
    $('wb-title').replaceChildren(
      document.createTextNode(nuevo ? 'Welcome to FEROCIA,' : 'Welcome back,'),
      h('br'),
      document.createTextNode(`${fmt.nombre(e.first_name) || 'player'}.`));
    $('wb-lead').textContent = nuevo
      ? 'Your player profile is ready. Join a ladder or a tournament and your results will show up here.'
      : "We connected your account to your FEROCIA player record. Here's what's waiting for you:";
    const caja = $('wb-stats');
    caja.hidden = true;
    if (nuevo) return;
    try {
      const d = await P.datos();
      const n = (x) => (x == null ? 0 : x);
      const fichas = [
        [n(d.ladders && d.ladders.length), 'Ladders'],
        [n(d.stats && d.stats.played), 'Games played'],
        [n(d.tournaments && new Set(d.tournaments.map((t) => t.id)).size), 'Tournaments'],
      ];
      caja.replaceChildren(...fichas.map(([num, txt]) =>
        h('div', { class: 'pj-welcome-stat' }, h('span', { class: 'pj-welcome-num', text: num }), h('span', { class: 'pj-welcome-lbl', text: txt }))));
      caja.hidden = false;
    } catch (err) {
      console.warn('[portal] bienvenida:', err);
    }
  });
})();
