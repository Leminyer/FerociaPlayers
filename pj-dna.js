/* ============================================================
   FEROCIA PLAYER PORTAL — My DNA (Player DNA™, etapa DNA-1)
   15 de octubre — diseño aprobado (§62, §63)

   Responde de un vistazo: "What kind of player is this?"

   Tres pantallas:
     · dna-start: "Your Player DNA", el paso obligatorio (cuentas nuevas
       después de "A little about you"; cuentas de antes, una vez antes
       del Home).
     · dna: My DNA. De arriba abajo: una frase que lo resume, sus rasgos
       y lo que busca ahora mismo ("Right now", caduca solo); reconocer a
       los de su última sesión; su estilo (lo que él dijo); lo que FEROCIA
       ve en sus juegos; lo que dicen de él (sólo cuántos, nunca quién);
       su fiabilidad (SÓLO él la ve) y quién ve qué.
     · dna-edit: cambiar lo que dijo.
   Todo lo que viene de la base se escribe como TEXTO (h()), nunca como
   HTML. Los únicos innerHTML son los iconos fijos de este archivo.
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { sb, h, fmt } = P;
  const $ = (id) => document.getElementById(id);

  /* ── Las opciones (los mismos códigos que la base) ── */
  const ESTILOS = [['aggressive', 'Aggressive / Banger'], ['control', 'Control Player'], ['patient', 'Patient'],
    ['strategic', 'Strategic'], ['fast_hands', 'Fast Hands'], ['soft_game', 'Soft Game / Dinker'], ['balanced', 'Balanced']];
  const LADOS = [['right', 'Right side'], ['left', 'Left side'], ['either', 'Either side']];
  const FORMATOS = [['singles', 'Singles'], ['doubles', 'Doubles'], ['mixed', 'Mixed doubles']];
  const COMPETICION = [['recreational', 'Recreational'], ['social', 'Social'], ['friendly_competitive', 'Friendly Competitive'],
    ['league', 'League Player'], ['tournament_focused', 'Tournament Focused'], ['practice', 'Practice Oriented']];
  const DIAS = [['weekday', 'Weekdays'], ['weekend', 'Weekends']];
  const FRANJAS = [['morning', 'Morning', 'mornings'], ['afternoon', 'Afternoon', 'afternoons'], ['evening', 'Evening', 'evenings']];
  const MOMENTOS = [];
  DIAS.forEach(([d, dn]) => FRANJAS.forEach(([f, , fp]) => MOMENTOS.push([`${d}_${f}`, `${dn.slice(0, -1)} ${fp}`])));
  const EXTRAS = [['flexible', 'Flexible'], ['last_minute', 'Last-minute games']];
  const SEDES = [['indoor', 'Indoor'], ['outdoor', 'Outdoor'], ['both', 'Both']];
  const INTENCIONES = [['tournament_practice', 'Tournament practice'], ['friendly_doubles', 'Friendly doubles'],
    ['need_tonight', 'Need one player tonight'], ['singles_training', 'Singles training'], ['weekend_social', 'Social games this weekend']];
  const RECONOCIMIENTOS = [['great_partner', 'Great Partner'], ['great_communication', 'Great Communication'],
    ['reliable', 'Reliable'], ['positive_energy', 'Positive Energy'], ['competitive', 'Competitive'],
    ['encouraging', 'Encouraging'], ['respectful', 'Respectful'], ['would_play_again', 'Would Play Again']];
  /* "How you compete" es una lista desde el SQL 94 (antes, una sola). */
  const competiciones = (d) => (Array.isArray(d.competitions) ? d.competitions : (d.competition ? [d.competition] : []));
  const etiqueta = (lista, code) => (lista.find((x) => x[0] === code) || [])[1] || '';
  const enOrden = (lista, codes) => lista.map((x) => x[0]).filter((c) => (codes || []).includes(c));
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  const SVG = (d, w = 15) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONOS = {
    trofeo: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    lados: '<path d="M12 3v18"/><path d="M5 8l-3 4 3 4"/><path d="M19 8l3 4-3 4"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    estrella: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    gente: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M17 4a4 4 0 0 1 0 8"/><path d="M22 21c0-3-2-5-4-5.5"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
  };
  function icono(nombre, clase, w) {
    const s = h('span', clase ? { class: clase, 'aria-hidden': 'true' } : { 'aria-hidden': 'true' });
    s.innerHTML = SVG(ICONOS[nombre], w);   // icono fijo de este archivo (sin datos)
    if (!clase) return s.firstChild;
    return s;
  }

  /* ============================================================
     EL FORMULARIO (el paso obligatorio y "Edit")
     ============================================================ */

  /* Qué significa cada pregunta: sale en el circulito "?" al lado del
     título (al pasar el ratón, con el teclado o tocándolo en el teléfono).
     Pedido el 15 de octubre. */
  const AYUDA = {
    styles: 'How you usually play your points. Pick up to 3 that sound most like you — for example, Strategic if you place the ball and plan your shots, or Soft Game / Dinker if you love long rallies at the kitchen line.',
    side: 'In doubles, the side of the court you prefer to play from: right or left. Choose Either side if you are happy on both.',
    formats: 'The kinds of games you play: Singles (1 vs 1), Doubles (2 vs 2) or Mixed doubles (a man and a woman on each team). Choose all that apply.',
    competition: 'The experience you look for on court — from relaxed, social games (Recreational, Social) to competitive play (League Player, Tournament Focused). Practice Oriented means you mostly play to improve. Pick up to 3.',
    when: 'The times you are usually free to play. Tap every box that fits: weekdays or weekends, in the morning, afternoon or evening. Flexible = any time works. Last-minute games = you are happy to join a game on short notice.',
    venue: 'Whether you prefer indoor courts, outdoor courts, or both.',
    intent: 'What you are looking for at the moment, like one more player for tonight. It is optional and clears on its own: "tonight" at midnight, "this weekend" after Sunday, the others after 7 days.',
  };
  /* El título de una pregunta: el nombre, el circulito "?" con su
     explicación y la nota de la derecha. */
  function cabecera(pref, clave, titulo, nota) {
    const id = `${pref}-tip-${clave}`;
    const boton = h('button', { type: 'button', class: 'dn-help-btn', 'aria-label': `What does "${titulo.replace(/ \(optional\)$/, '')}" mean?`,
      'aria-describedby': id, 'aria-expanded': 'false', 'data-help': id }, h('span', { class: 'dn-help-i', 'aria-hidden': 'true', text: '?' }));
    return h('legend', { class: 'dn-q-h' },
      h('span', { class: 'dn-q-tl' }, h('span', { class: 'dn-q-t', text: titulo }),
        h('span', { class: 'dn-help' }, boton, h('span', { class: 'dn-tip', role: 'tooltip', id, text: AYUDA[clave] }))),
      h('span', { class: 'dn-q-n', text: nota }));
  }
  /* Tocarlo (teléfono) lo abre o lo cierra; Escape o tocar fuera, lo cierra. */
  function cerrarAyudas(salvo) {
    document.querySelectorAll('.dn-help.is-open').forEach((w) => {
      if (w === salvo) return;
      w.classList.remove('is-open');
      w.querySelector('.dn-help-btn').setAttribute('aria-expanded', 'false');
    });
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('.dn-help-btn');
    if (!b) { cerrarAyudas(null); return; }
    ev.preventDefault();
    const w = b.parentElement;
    w.classList.remove('is-dismissed');
    const abrir = !w.classList.contains('is-open');
    cerrarAyudas(w);
    w.classList.toggle('is-open', abrir);
    b.setAttribute('aria-expanded', String(abrir));
  });
  /* Escape la cierra aunque el círculo siga con el foco o el ratón encima
     (vuelve a funcionar al salir de él). */
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    cerrarAyudas(null);
    document.querySelectorAll('.dn-help').forEach((w) => { if (w.matches(':hover, :focus-within')) w.classList.add('is-dismissed'); });
  });
  const reactivar = (ev) => { const w = ev.target.closest && ev.target.closest('.dn-help'); if (w) w.classList.remove('is-dismissed'); };
  document.addEventListener('mouseleave', (ev) => {
    if (ev.target.classList && ev.target.classList.contains('dn-help')) ev.target.classList.remove('is-dismissed');
  }, true);
  document.addEventListener('focusout', reactivar);

  /* Una pregunta: un grupo con su título, su nota y sus opciones. */
  function pregunta(pref, clave, titulo, nota, opciones, tipo) {
    const caja = h('fieldset', { class: 'dn-q', id: `${pref}-q-${clave}`, 'data-q': clave });
    caja.append(cabecera(pref, clave, titulo, nota));
    const lista = h('div', { class: 'dn-opts' });
    opciones.forEach(([code, texto]) => lista.append(
      h('label', { class: 'dn-opt' }, h('input', { class: 'pj-sr', type: tipo, name: `${pref}-${clave}`, value: code }), texto)));
    caja.append(lista);
    return caja;
  }

  /* "When you play": la cuadrícula (días × momento) + Flexible y Last-minute. */
  function preguntaCuando(pref) {
    const caja = h('fieldset', { class: 'dn-q', id: `${pref}-q-when`, 'data-q': 'when' });
    caja.append(cabecera(pref, 'when', 'When you play', 'Choose all that apply'));
    const rejilla = h('div', { class: 'dn-when' }, h('span', { 'aria-hidden': 'true' }));
    FRANJAS.forEach(([, t]) => rejilla.append(h('span', { class: 'dn-when-h', 'aria-hidden': 'true', text: t })));
    DIAS.forEach(([d, dn]) => {
      rejilla.append(h('span', { class: 'dn-when-d', 'aria-hidden': 'true', text: dn }));
      FRANJAS.forEach(([f]) => {
        const code = `${d}_${f}`;
        const celda = h('label', { class: 'dn-cell' },
          h('input', { class: 'pj-sr', type: 'checkbox', name: `${pref}-when`, value: code, 'aria-label': etiqueta(MOMENTOS, code) }));
        celda.append(icono('check', null, 18));
        rejilla.append(celda);
      });
    });
    caja.append(rejilla);
    const extras = h('div', { class: 'dn-opts' });
    EXTRAS.forEach(([code, texto]) => extras.append(
      h('label', { class: 'dn-opt' }, h('input', { class: 'pj-sr', type: 'checkbox', name: `${pref}-when`, value: code }), texto)));
    caja.append(extras);
    return caja;
  }

  const construidos = {};
  function construir(pref) {
    if (construidos[pref]) return;
    construidos[pref] = true;
    const caja = $(`${pref}-qs`);
    caja.replaceChildren(
      pregunta(pref, 'styles', 'Play style', 'Choose up to 3', ESTILOS, 'checkbox'),
      pregunta(pref, 'side', 'Side', 'Choose one', LADOS, 'radio'),
      pregunta(pref, 'formats', 'Format', 'Choose all you play', FORMATOS, 'checkbox'),
      pregunta(pref, 'competition', 'How you compete', 'Choose up to 3', COMPETICION, 'checkbox'),
      preguntaCuando(pref),
      pregunta(pref, 'venue', 'Where you like to play', 'Choose one', SEDES, 'radio'),
      pregunta(pref, 'intent', 'Right now (optional)', 'Clears on its own', INTENCIONES.concat([['', 'Not right now']]), 'radio'));
    caja.addEventListener('change', (ev) => {
      const t = ev.target;
      if (!t || t.tagName !== 'INPUT') return;
      const q = t.closest('.dn-q');
      if (q) q.removeAttribute('aria-invalid');
      repasar(pref);
    });
    repasar(pref);
  }

  /* Pinta lo elegido y, con 3 estilos, apaga los demás. */
  function repasar(pref) {
    const caja = $(`${pref}-qs`);
    caja.querySelectorAll('input').forEach((i) => {
      i.closest('label').classList.toggle('is-on', i.checked);
    });
    /* Play style y How you compete: hasta 3 cada una. */
    ['styles', 'competition'].forEach((clave) => {
      const lista = [...caja.querySelectorAll(`input[name="${pref}-${clave}"]`)];
      const lleno = lista.filter((i) => i.checked).length >= 3;
      lista.forEach((i) => {
        i.disabled = lleno && !i.checked;
        i.closest('label').classList.toggle('is-off', i.disabled);
      });
    });
  }

  const marcados = (pref, clave) => [...document.querySelectorAll(`input[name="${pref}-${clave}"]:checked`)].map((i) => i.value);
  function leer(pref) {
    return {
      p_play_styles: marcados(pref, 'styles'),
      p_side: marcados(pref, 'side')[0] || null,
      p_formats: marcados(pref, 'formats'),
      p_competitions: marcados(pref, 'competition'),
      p_availability: marcados(pref, 'when'),
      p_venue: marcados(pref, 'venue')[0] || null,
      p_intent: marcados(pref, 'intent')[0] || null,
    };
  }
  function llenar(pref, d) {
    const valores = {
      styles: d.play_styles || [], side: [d.side], formats: d.formats || [], competition: competiciones(d),
      when: d.availability || [], venue: [d.venue_pref], intent: [d.intent || ''],
    };
    for (const [clave, lista] of Object.entries(valores)) {
      document.querySelectorAll(`input[name="${pref}-${clave}"]`).forEach((i) => { i.checked = lista.includes(i.value); i.disabled = false; });
    }
    $(`${pref}-qs`).querySelectorAll('.dn-q').forEach((q) => q.removeAttribute('aria-invalid'));
    repasar(pref);
  }
  function limpiar(pref) {
    /* Todo sin elegir, salvo "Right now", que empieza en "Not right now". */
    document.querySelectorAll(`#${pref}-qs input`).forEach((i) => { i.checked = i.name === `${pref}-intent` && i.value === ''; i.disabled = false; });
    $(`${pref}-qs`).querySelectorAll('.dn-q').forEach((q) => q.removeAttribute('aria-invalid'));
    repasar(pref);
  }

  /* Lo que falta: marca la pregunta y devuelve la primera. */
  function revisar(pref, v) {
    const faltan = [];
    const mira = (clave, mal) => {
      const q = $(`${pref}-q-${clave}`);
      if (mal) { q.setAttribute('aria-invalid', 'true'); faltan.push(q); } else q.removeAttribute('aria-invalid');
    };
    mira('styles', v.p_play_styles.length < 1 || v.p_play_styles.length > 3);
    mira('side', !v.p_side);
    mira('formats', v.p_formats.length < 1);
    mira('competition', v.p_competitions.length < 1 || v.p_competitions.length > 3);
    mira('when', v.p_availability.length < 1);
    mira('venue', !v.p_venue);
    return faltan[0] || null;
  }

  function error(pref, texto) {
    const e = $(`${pref}-error`);
    e.textContent = texto || '';
    e.hidden = !texto;
  }
  const ERRORES = {
    invalid_play_styles: 'Choose 1 to 3 play styles.',
    invalid_side: 'Choose your side.',
    invalid_formats: 'Choose at least one format.',
    invalid_competition: 'Choose 1 to 3 ways you compete.',
    invalid_availability: 'Choose when you play.',
    invalid_venue: 'Choose where you like to play.',
    invalid_intent: 'Choose what you are looking for right now, or leave it empty.',
  };

  async function guardar(pref, boton) {
    error(pref, '');
    const v = leer(pref);
    const falta = revisar(pref, v);
    if (falta) {
      error(pref, 'Please answer the highlighted questions.');
      const i = falta.querySelector('input:not([disabled])');
      if (i) i.focus();
      return null;
    }
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
    try {
      const { data, error: err } = await sb.rpc('portal_guardar_dna', v);
      if (err) throw err;
      return data || {};
    } catch (err) {
      console.warn('[portal] guardar DNA:', err);
      error(pref, P.errorTexto(err, ERRORES));
      return null;
    } finally {
      boton.disabled = false;
      boton.setAttribute('aria-busy', 'false');
    }
  }

  /* ── El paso obligatorio ── */
  P.alEntrar('dna-start', () => {
    const primera = !construidos.ds;
    construir('ds');
    if (primera) limpiar('ds');
    const nuevo = !!(P.hayBienvenida && P.hayBienvenida());
    $('ds-steps').hidden = !nuevo;
    $('ds-eyebrow').textContent = nuevo ? 'Last step · about 1 minute' : 'New in your portal · about 1 minute';
    error('ds', '');
  });
  let enviando = false;
  $('ds-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (enviando) return;
    enviando = true;
    try {
      const r = await guardar('ds', $('ds-submit'));
      if (!r) return;
      limpiar('ds');
      const nuevo = !!(P.hayBienvenida && P.hayBienvenida());
      history.replaceState(null, '', nuevo ? '#/welcome' : '#/home');
      await P.refrescar();
      if (!nuevo) P.aviso('Your Player DNA is saved. See it any time in My DNA.');
    } finally {
      enviando = false;
    }
  });

  /* ── Edit ── */
  let vezEdit = 0;
  P.alEntrar('dna-edit', async () => {
    const mia = ++vezEdit;
    construir('de');
    error('de', '');
    const b = $('de-submit');
    b.disabled = true;
    try {
      const d = await leerDNA();
      if (mia !== vezEdit) return;
      if (d.declared) llenar('de', d.declared);
      else limpiar('de');
    } catch (err) {
      if (mia !== vezEdit) return;
      console.warn('[portal] edit DNA:', err);
      error('de', P.errorTexto(err));
    } finally {
      if (mia === vezEdit) b.disabled = false;
    }
  });
  let guardandoEdit = false;
  $('de-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (guardandoEdit) return;
    guardandoEdit = true;
    try {
      const r = await guardar('de', $('de-submit'));
      if (!r) return;
      P.aviso(r.changed === false ? 'Nothing to save — your DNA is the same.' : 'Your DNA is updated.');
      P.ir('dna');
    } finally {
      guardandoEdit = false;
    }
  });

  /* ============================================================
     MY DNA
     ============================================================ */

  function leerDNA() {
    return sb.rpc('portal_mi_dna').then(({ data, error: err }) => {
      if (err) throw err;
      return data || {};
    });
  }

  /* "Hoy" y las fechas, en la hora del club. */
  const ZONA = 'America/New_York';
  const diaClub = (fecha) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(fecha);

  /* ── 1 · La frase que responde la pregunta ──
     "A strategic doubles player who loves the kitchen game." */
  const ADJETIVO = { aggressive: 'hard-hitting', control: 'controlled', patient: 'patient', strategic: 'strategic',
    fast_hands: 'quick-handed', soft_game: 'soft-touch', balanced: 'well-rounded' };
  const COLA = { aggressive: 'who loves to attack', control: 'who plays with control', patient: 'who never rushes a point',
    strategic: 'who thinks two shots ahead', fast_hands: 'who wins the hand battles', soft_game: 'who loves the kitchen game',
    balanced: 'who adapts to any game' };
  function formatoEnFrase(formatos) {
    const f = formatos || [];
    const dobles = f.includes('doubles') || f.includes('mixed');
    if (f.includes('singles') && dobles) return 'singles and doubles';
    if (f.length === 1 && f[0] === 'mixed') return 'mixed doubles';
    if (dobles) return 'doubles';
    if (f.includes('singles')) return 'singles';
    return 'pickleball';
  }
  function pintarFrase(dec) {
    const t = $('dn-title');
    if (!dec) { t.replaceChildren('Your Player DNA'); return; }
    const estilos = enOrden(ESTILOS, dec.play_styles);
    const primero = estilos[0], segundo = estilos[1] || estilos[0];
    const adj = ADJETIVO[primero] || 'great';
    const articulo = /^[aeiou]/i.test(adj) ? 'An ' : 'A ';
    t.replaceChildren(articulo, h('em', { text: adj }), ` ${formatoEnFrase(dec.formats)} player ${COLA[segundo] || 'who loves the game'}.`);
  }

  function pintarRasgos(dec, social) {
    const rasgos = [];
    const rasgo = (ico, texto) => { const s = h('span', { class: 'dn-trait' }); s.append(icono(ico), document.createTextNode(texto)); return s; };
    if (dec) {
      rasgos.push(rasgo('trofeo', enOrden(COMPETICION, competiciones(dec)).map((c) => etiqueta(COMPETICION, c)).join(' · ')));
      rasgos.push(rasgo('lados', etiqueta(LADOS, dec.side)));
      const cuando = enOrden(MOMENTOS.concat(EXTRAS), dec.availability);
      if (cuando.length) rasgos.push(rasgo('calendario', etiqueta(MOMENTOS.concat(EXTRAS), cuando[0])));
    }
    if (social && social.length) rasgos.push(rasgo('estrella', `${etiqueta(RECONOCIMIENTOS, social[0].recognition)} ×${social[0].count}`));
    $('dn-traits').replaceChildren(...rasgos);
  }

  /* ── 2 · Right now ── */
  let declarado = null;
  function hastaTexto(iso) {
    const fin = new Date(new Date(iso).getTime() - 60000);   // caduca a medianoche: el último día es el anterior
    if (diaClub(fin) === diaClub(new Date())) return 'Until midnight tonight · then it clears on its own';
    const dia = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, weekday: 'long', month: 'short', day: 'numeric' }).format(fin);
    return `Until ${dia} · then it clears on its own`;
  }
  function pintarIntencion() {
    const dec = declarado;
    const tiene = !!(dec && dec.intent);
    $('dn-intent').classList.toggle('is-empty', !tiene);
    $('dn-intent-n').textContent = tiene ? etiqueta(INTENCIONES, dec.intent) : 'Nothing set';
    $('dn-intent-s').textContent = tiene ? hastaTexto(dec.intent_until) : 'Looking for a game? Let FEROCIA know.';
    $('dn-intent-go').textContent = tiene ? 'Change' : 'Set';
    $('dn-intent-go').hidden = !dec;
    const caja = $('dn-intent-pick');
    const leyenda = caja.querySelector('legend');
    const botones = INTENCIONES.map(([code, texto]) => h('button', {
      type: 'button', class: 'dn-chip', 'data-intent': code, 'aria-pressed': String(tiene && dec.intent === code), text: texto }));
    if (tiene) botones.push(h('button', { type: 'button', class: 'dn-chip', 'data-intent': '', 'aria-pressed': 'false', text: 'Clear' }));
    caja.replaceChildren(leyenda, ...botones);
  }
  function abrirIntencion(abrir) {
    $('dn-intent-pick').hidden = !abrir;
    $('dn-intent-go').setAttribute('aria-expanded', String(abrir));
  }
  $('dn-intent-go').addEventListener('click', () => {
    const abrir = $('dn-intent-pick').hidden;
    abrirIntencion(abrir);
    if (abrir) { const b = $('dn-intent-pick').querySelector('button'); if (b) b.focus(); }
  });
  let guardandoIntencion = false;
  $('dn-intent-pick').addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-intent]');
    if (!b || guardandoIntencion || !declarado) return;
    const nueva = b.dataset.intent || null;
    guardandoIntencion = true;
    $('dn-intent-pick').setAttribute('aria-busy', 'true');
    try {
      const { data, error: err } = await sb.rpc('portal_guardar_intencion', { p_intent: nueva });
      if (err) throw err;
      declarado = Object.assign({}, declarado, { intent: data.intent || null, intent_until: data.intent_until || null });
      pintarIntencion();
      abrirIntencion(false);
      $('dn-intent-go').focus();
      P.aviso(nueva ? `Saved: ${etiqueta(INTENCIONES, nueva)}.` : 'Cleared. Nothing set right now.');
    } catch (err) {
      console.warn('[portal] intención:', err);
      P.aviso(P.errorTexto(err), true);
    } finally {
      guardandoIntencion = false;
      $('dn-intent-pick').removeAttribute('aria-busy');
    }
  });

  /* ── 3 · Reconocer a los de su última sesión ── */
  const PAPEL = { partner: 'your partner', opponent: 'opponent', both: 'partner & opponent' };
  let sesion = null;
  function pintarReconocer(pendientes) {
    sesion = (pendientes && pendientes[0]) || null;
    $('dn-give').hidden = !sesion;
    if (!sesion) return;
    $('dn-give-where').textContent = `${sesion.competition || (sesion.kind === 'tournament' ? 'Tournament' : 'Ladder')} · ${fmt.corto(sesion.played_on)}`;
    const mas = pendientes.length - 1;
    $('dn-give-until').textContent = `You can do this until ${fmt.corto(sesion.until)}.` + (mas > 0 ? ` ${plural(mas, 'more session', 'more sessions')} waiting.` : '');
    $('dn-give-list').replaceChildren(...(sesion.players || []).map((p) => {
      const nombre = fmt.nombre([p.first_name, p.last_name].filter(Boolean).join(' '));
      const fila = h('div', { class: 'dn-give-p', role: 'group', 'aria-label': nombre, 'data-player': String(p.player_id) },
        h('div', { class: 'dn-give-who' },
          h('span', { class: 'dn-give-av', 'aria-hidden': 'true', text: fmt.iniciales(p.first_name, p.last_name) }),
          h('span', null, nombre, ' ', h('small', { text: `· ${PAPEL[p.role] || 'opponent'}` }))),
        h('div', { class: 'dn-chips' }, ...RECONOCIMIENTOS.map(([code, texto]) =>
          h('button', { type: 'button', class: 'dn-chip', 'data-rec': code, 'aria-pressed': 'false', text: texto }))));
      return fila;
    }));
    repasarReconocer();
  }
  function repasarReconocer() {
    let alguno = false;
    $('dn-give-list').querySelectorAll('.dn-give-p').forEach((fila) => {
      const chips = [...fila.querySelectorAll('.dn-chip')];
      const n = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').length;
      if (n) alguno = true;
      chips.forEach((c) => {
        if (n >= 3 && c.getAttribute('aria-pressed') !== 'true') c.setAttribute('aria-disabled', 'true');
        else c.removeAttribute('aria-disabled');
      });
    });
    $('dn-give-send').disabled = !alguno;
  }
  $('dn-give-list').addEventListener('click', (ev) => {
    const c = ev.target.closest('.dn-chip');
    if (!c || c.getAttribute('aria-disabled') === 'true') return;
    c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'));
    repasarReconocer();
  });
  let reconociendo = false;
  async function mandarReconocimiento(saltar) {
    if (reconociendo || !sesion) return;
    const lista = saltar ? [] : [...$('dn-give-list').querySelectorAll('.dn-give-p')].map((fila) => ({
      player_id: Number(fila.dataset.player),
      recognitions: [...fila.querySelectorAll('.dn-chip[aria-pressed="true"]')].map((c) => c.dataset.rec),
    })).filter((x) => x.recognitions.length);
    if (!saltar && !lista.length) return;
    reconociendo = true;
    const botones = [$('dn-give-send'), $('dn-give-skip')];
    botones.forEach((b) => { b.disabled = true; });
    try {
      const { error: err } = await sb.rpc('portal_reconocer', { p_session_key: sesion.session_key, p_reconocimientos: lista });
      if (err) throw err;
      /* Hecho: la tarjeta se va ya (la siguiente sesión, si hay, llega al recargar). */
      sesion = null;
      $('dn-give').hidden = true;
      P.aviso(saltar ? "Skipped. We won't ask about this session again." : 'Thanks — your recognition was sent.');
    } catch (err) {
      console.warn('[portal] reconocer:', err);
      P.aviso(P.errorTexto(err, {
        already_recognized: 'You already recognized this session.',
        session_not_available: 'This session can no longer be recognized.',
        player_not_in_session: 'Something changed in this session. Please try again.',
      }), true);
    } finally {
      reconociendo = false;
      $('dn-give-skip').disabled = false;
      repasarReconocer();
    }
    cargar();
  }
  $('dn-give-send').addEventListener('click', () => mandarReconocimiento(false));
  $('dn-give-skip').addEventListener('click', () => mandarReconocimiento(true));

  /* ── 4 · Your style ── */
  function pintarEstilo(dec) {
    const fila = (dt, tags, fuerte) => h('div', { class: 'dn-row' }, h('dt', { text: dt }),
      h('dd', null, ...tags.map((t) => h('span', { class: fuerte ? 'dn-tag dn-tag-strong' : 'dn-tag', text: t }))));
    if (!dec) {
      $('dn-rows').replaceChildren(h('p', { class: 'pj-empty', text: 'Tell us how you like to play — tap Edit.' }));
      return;
    }
    const todos = MOMENTOS.concat(EXTRAS);
    $('dn-rows').replaceChildren(
      fila('Play style', enOrden(ESTILOS, dec.play_styles).map((c) => etiqueta(ESTILOS, c)), true),
      fila('Side', [etiqueta(LADOS, dec.side)]),
      fila('Format', enOrden(FORMATOS, dec.formats).map((c) => etiqueta(FORMATOS, c))),
      fila('Competition', enOrden(COMPETICION, competiciones(dec)).map((c) => etiqueta(COMPETICION, c))),
      fila('Availability', enOrden(todos, dec.availability).map((c) => etiqueta(todos, c))),
      fila('Where', [dec.venue_pref === 'both' ? 'Indoor & outdoor' : etiqueta(SEDES, dec.venue_pref)]));
  }

  /* ── 5 · What FEROCIA sees ── */
  const DIA_SEMANA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function pintarVe(der) {
    const d = der || {};
    const tarjeta = (ico, titulo, sub, quieta) => {
      const t = h('div', { class: quieta ? 'dn-see is-quiet' : 'dn-see' });
      t.append(icono(ico, 'dn-see-ico', 18), h('span', { class: 'dn-see-t' }, h('span', { class: 'dn-see-n', text: titulo }), h('span', { class: 'dn-see-s', text: sub })));
      return t;
    };
    const lista = [];
    const u = d.usual;
    const franja = u && FRANJAS.find((f) => f[0] === u.slot);
    lista.push(u && franja
      ? tarjeta('calendario', `${DIA_SEMANA[u.day]} ${franja[2]}`, `${u.sessions} of your last ${u.of} ladder sessions`)
      : tarjeta('calendario', 'Your usual day', 'Shows up after a few ladder sessions', true));

    const f = d.formats || {};
    const nombresF = [['doubles', 'Doubles'], ['mixed', 'Mixed'], ['singles', 'Singles']]
      .filter(([k]) => (f[k] || 0) > 0).sort((a, b) => (f[b[0]] || 0) - (f[a[0]] || 0)).map((x) => x[1]);
    const lad = d.ladders || 0, tor = d.tournaments || 0;
    const origen = lad && tor ? `Ladders and ${plural(tor, 'tournament', 'tournaments')}` : lad ? 'From your ladder games' : tor ? `From ${plural(tor, 'tournament', 'tournaments')}` : '';
    lista.push(nombresF.length
      ? tarjeta('gente', nombresF.join(' · '), origen || 'From your games')
      : tarjeta('gente', 'Your formats', 'Play a ladder or tournament to see this', true));

    const titulos = [];
    if (d.ladder_titles) titulos.push(plural(d.ladder_titles, 'ladder title', 'ladder titles'));
    if (d.tournament_titles) titulos.push(plural(d.tournament_titles, 'tournament title', 'tournament titles'));
    const recorrido = [lad ? plural(lad, 'ladder', 'ladders') : '', titulos.length ? titulos.join(' · ') : (tor ? plural(tor, 'tournament', 'tournaments') : '')].filter(Boolean).join(' · ');
    const tipo = (d.ladder_sessions_180 || 0) >= 6 ? 'Ladder regular' : lad ? 'Ladder player' : tor ? 'Tournament player' : '';
    lista.push(tipo
      ? tarjeta('trofeo', tipo, recorrido)
      : tarjeta('trofeo', 'Your competitions', 'Your ladders and titles will show up here', true));

    const g = d.games_30 || 0;
    lista.push(g
      ? tarjeta('reloj', 'Active this month', `${plural(g, 'game', 'games')} in the last 30 days`)
      : tarjeta('reloj', 'Ready for your next game', 'No games in the last 30 days', true));
    $('dn-sees').replaceChildren(...lista);
  }

  /* ── 6 · Social DNA ── */
  function pintarSocial(social) {
    if (!social || !social.length) {
      $('dn-recog').replaceChildren(h('p', { class: 'pj-empty', text: 'Recognition from the players you share the court with will show up here.' }));
      return;
    }
    $('dn-recog').replaceChildren(...social.map((s) => {
      const b = h('div', { class: 'dn-badge' });
      b.append(icono('estrella', 'dn-badge-ico', 17), h('span', { class: 'dn-badge-n', text: etiqueta(RECONOCIMIENTOS, s.recognition) }),
        h('span', { class: 'dn-badge-c', text: `×${s.count}` }));
      return b;
    }));
  }

  /* ── 7 · Su fiabilidad (sólo él) ── */
  function pintarFiabilidad(r) {
    const panel = $('dn-rel');
    panel.hidden = !r;
    if (!r) return;
    const tipo = { Excellent: ['', 'Excellent'], Good: ['is-good', 'Good'], 'Needs Attention': ['is-attention', 'Needs attention'] }[r.label];
    panel.classList.remove('is-good', 'is-attention', 'is-limited');
    if (tipo) {
      if (tipo[0]) panel.classList.add(tipo[0]);
      $('dn-rel-n').textContent = tipo[1];
      $('dn-rel-s').textContent = `You showed up for ${r.sessions_attended || 0} of your ${plural(r.scheduled_sessions || 0, 'session', 'sessions')}.`;
    } else {
      panel.classList.add('is-limited');
      $('dn-rel-n').textContent = 'Getting started';
      $('dn-rel-s').textContent = 'After 5 ladder sessions you will see your reliability here.';
    }
    const kpi = (dt, dd) => h('div', null, h('dt', { text: dt }), h('dd', { text: dd }));
    $('dn-rel-kpis').replaceChildren(
      kpi('Attendance', r.attendance_pct == null ? '—' : `${r.attendance_pct}%`),
      kpi('No-shows', String(r.no_shows || 0)),
      kpi('Late cancels', String(r.late_cancellations || 0)));
  }

  /* ── 8 · Who sees what ── */
  const PARTES = [['show_style', 'Play style & competition'], ['show_availability', 'Availability'],
    ['show_intent', 'Right now (current intent)'], ['show_social', 'Social DNA'],
    ['show_match_history', 'Match history'], ['show_win_rate', 'Detailed stats']];
  const guardandoParte = {};
  function pintarPrivacidad(d) {
    const dec = d.declared || {};
    const valor = { show_match_history: !!d.show_match_history, show_win_rate: !!d.show_win_rate };
    $('dn-priv').replaceChildren(...PARTES.map(([campo, texto]) => {
      const id = `dn-priv-${campo}`;
      let v = campo in valor ? valor[campo] : dec[campo] !== false;
      /* Si se está guardando ahora mismo, manda lo que eligió (no lo que
         leyó la base un momento antes). */
      const actual = guardandoParte[campo] && $('dn-priv').querySelector(`button[data-campo="${campo}"]`);
      if (actual) v = actual.getAttribute('aria-checked') === 'true';
      return h('li', null, h('span', { id, text: texto }),
        h('button', { type: 'button', class: 'dn-sw', role: 'switch', 'aria-checked': String(v), 'aria-labelledby': id, 'data-campo': campo, disabled: !d.declared && !(campo in valor) }));
    }));
  }
  $('dn-priv').addEventListener('click', async (ev) => {
    const b = ev.target.closest('.dn-sw');
    if (!b || b.disabled) return;
    const campo = b.dataset.campo;
    if (guardandoParte[campo]) return;
    const antes = b.getAttribute('aria-checked') === 'true';
    const nuevo = !antes;
    guardandoParte[campo] = true;
    b.setAttribute('aria-checked', String(nuevo));
    b.setAttribute('aria-busy', 'true');
    try {
      const { error: err } = await sb.rpc('portal_guardar_visibilidad_dna', { p_campo: campo, p_valor: nuevo });
      if (err) throw err;
      const texto = (PARTES.find((p) => p[0] === campo) || [])[1];
      P.aviso(`Saved: ${texto} ${nuevo ? 'on' : 'off'}.`);
    } catch (err) {
      console.warn('[portal] quién ve qué:', err);
      b.setAttribute('aria-checked', String(antes));
      P.aviso(P.errorTexto(err), true);
    } finally {
      guardandoParte[campo] = false;
      b.removeAttribute('aria-busy');
    }
  });

  /* ── Al entrar ── */
  let vez = 0;
  async function cargar() {
    const mia = ++vez;
    $('dn-error').hidden = true;
    $('dn-main').setAttribute('aria-busy', 'true');
    let d;
    try {
      d = await leerDNA();
    } catch (err) {
      if (mia !== vez) return;
      console.warn('[portal] my DNA:', err);
      $('dn-error').textContent = P.errorTexto(err);
      $('dn-error').hidden = false;
      $('dn-main').setAttribute('aria-busy', 'false');
      return;
    }
    if (mia !== vez) return;
    declarado = d.declared || null;
    pintarFrase(declarado);
    pintarRasgos(declarado, d.social);
    pintarIntencion();
    abrirIntencion(false);
    pintarReconocer(d.pending);
    pintarEstilo(declarado);
    pintarVe(d.derived);
    pintarSocial(d.social);
    pintarFiabilidad(d.reliability);
    pintarPrivacidad(d);
    $('dn-main').setAttribute('aria-busy', 'false');
  }
  P.alEntrar('dna', cargar);
})();
