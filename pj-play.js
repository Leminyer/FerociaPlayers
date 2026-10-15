/* ============================================================
   FEROCIA PLAYER PORTAL — Play (Matchmaking Engine™, etapa M-1 · Discover)
   15 de octubre — diseño aprobado (§70, §71)
   M-2a (§74): los juegos, invitar, reportar y bloquear los pinta pj-games.js.

   Responde de un vistazo: "Who would I enjoy sharing the court with?"
   Regla de oro del capítulo 8: ninguna recomendación es al azar; cada
   una se enseña con sus razones.

   Dos pantallas:
     · play: cómo te encuentran los demás; quién busca jugar ahora;
       recomendados (con etiqueta y razones); nuevos, rivales frecuentes
       y los que vuelven. Lee portal_play().
     · player (#/player/<n> o #/player/me): la tarjeta de un jugador tal
       como la ven los demás. Lee portal_tarjeta_jugador().
   La base decide quién aparece y qué se ve (privacidad e interruptores
   del DNA). Aquí sólo se pinta, siempre como TEXTO (h()), nunca HTML.
   Los únicos innerHTML son los iconos fijos de este archivo.
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { sb, h, fmt } = P;
  const $ = (id) => document.getElementById(id);
  const D = P.dnaTextos;   // las listas del DNA (pj-dna.js)
  if (!D) return;

  const SVG = (d, w = 16) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONOS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    estrella: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    candado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  };
  function icono(nombre, w) {
    const s = h('span');
    s.innerHTML = SVG(ICONOS[nombre], w);   // icono fijo de este archivo (sin datos)
    return s.firstChild;
  }
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const nombre = (p) => fmt.nombre([p.first_name, p.last_name].filter(Boolean).join(' '));
  const iniciales = (p) => fmt.iniciales(p.first_name, p.last_name);
  const lugar = (p) => [p.level, p.city].filter(Boolean).join(' · ');

  /* ── Las razones, en palabras ── */
  const DIA_SEMANA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const FRANJA = { morning: 'mornings', afternoon: 'afternoons', evening: 'evenings' };
  const COMPITE = {
    recreational: 'You both play for fun', social: 'You both enjoy the social side of the game',
    friendly_competitive: 'You both like friendly competition', league: "You're both League Players",
    tournament_focused: "You're both tournament focused", practice: 'You both play to improve',
  };
  const ESTILO = {
    strategic: 'You both play a strategic game', soft_game: 'You both love the soft game', patient: "You're both patient players",
    control: 'You both play with control', fast_hands: 'You both have fast hands', aggressive: 'You both like to attack',
    balanced: 'You both have a well-rounded game',
  };
  const FORMATO = { singles: 'singles', doubles: 'doubles', mixed: 'mixed doubles' };
  /* Cada razón: [texto normal, texto en negrita, texto normal]. */
  function razon(r) {
    switch (r.code) {
      case 'usual': return ['You both play ', `${DIA_SEMANA[r.day] || ''} ${FRANJA[r.slot] || ''}`.trim(), ''];
      case 'level': return ['', 'Similar level', ''];
      case 'when': return ['You both play ', (D.etiqueta(D.MOMENTOS, r.slot) || '').toLowerCase(), ''];
      case 'last_minute': return ['You both like ', 'last-minute games', ''];
      case 'intent': return ["You're both looking for ", (D.etiqueta(D.INTENCIONES, r.intent) || '').toLowerCase(), ''];
      case 'competition': return ['', COMPITE[r.competition] || '', ''];
      case 'style': return ['', ESTILO[r.style] || '', ''];
      case 'format': return ['You both play ', (r.formats || []).map((f) => FORMATO[f]).filter(Boolean).join(' and '), ''];
      case 'together': return ["You've played together ", r.n === 1 ? 'once' : `${r.n} times`, ''];
      case 'new_face': return ["You've ", 'never played together', ' — a new face'];
      default: return null;
    }
  }
  /* Primero lo que más dice: su día de siempre, lo jugado juntos, el nivel… */
  const ORDEN = ['usual', 'together', 'level', 'intent', 'when', 'competition', 'style', 'last_minute', 'format'];
  function razones(lista, max) {
    const l = (lista || []).slice().sort((a, b) => ORDEN.indexOf(a.code) - ORDEN.indexOf(b.code));
    if (!l.some((r) => r.code === 'together') && l.length < max) l.push({ code: 'new_face' });
    return l.map(razon).filter((x) => x && x[1]).slice(0, max);
  }
  function listaRazones(titulo, lista, max) {
    const ul = h('ul', { class: 'pl-why' }, h('li', { class: 'pl-why-k', text: titulo }));
    razones(lista, max).forEach(([a, b, c]) => {
      const li = h('li');
      li.append(icono('check'), h('span', null, a, h('strong', { text: b }), c));
      ul.append(li);
    });
    return ul;
  }

  const ETIQUETA = { great: 'Great match', good: 'Good match' };
  /* Las razones y las etiquetas también las usan los juegos (pj-games.js:
     las solicitudes que recibe el anfitrión). */
  P.razonesLista = (titulo, lista, max) => listaRazones(titulo, lista, max);
  P.etiquetaMatch = ETIQUETA;

  const verTarjeta = (p) => `#/player/${encodeURIComponent(String(p.player_id))}`;
  const reconocimientos = (p, n) => (p.social || []).slice(0, n)
    .map((s) => `${D.etiqueta(D.RECONOCIMIENTOS, s.recognition)} ×${s.count}`).join(' · ');

  /* ── Las piezas de Play ── */
  function tarjetaRecomendada(p) {
    const tags = [
      ...D.enOrden(D.ESTILOS, p.styles || []).map((c) => D.etiqueta(D.ESTILOS, c)),
      ...D.enOrden(D.COMPETICION, p.competitions || []).map((c) => D.etiqueta(D.COMPETICION, c)),
    ];
    const rec = reconocimientos(p, 2);
    const pie = h('div', { class: 'pl-card-foot' });
    if (rec) { const r = h('span', { class: 'pl-recog' }); r.append(icono('estrella', 14), document.createTextNode(rec)); pie.append(r); }
    else pie.append(h('span'));
    pie.append(h('a', { class: 'pl-btn', href: verTarjeta(p), text: 'View player card', 'aria-label': `View ${nombre(p)}'s player card` }));
    return h('article', { class: 'pl-card' },
      h('div', { class: 'pl-card-top' },
        h('span', { class: 'pl-av', 'aria-hidden': 'true', text: iniciales(p) }),
        h('span', { class: 'pl-who' }, h('span', { class: 'pl-name', text: nombre(p) }), h('span', { class: 'pl-meta', text: lugar(p) })),
        p.match ? h('span', { class: 'pl-match', text: ETIQUETA[p.match] }) : null),
      tags.length ? h('div', { class: 'pl-tags' }, ...tags.map((t) => h('span', { class: 'pl-tag', text: t }))) : null,
      listaRazones("Why we think you'd enjoy it", p.reasons, 4),
      pie);
  }
  function tarjetaAhora(p) {
    const hasta = p.intent_until ? D.hastaTexto(p.intent_until).replace(' · then it clears on its own', '').replace(/^Until /, 'until ') : '';
    return h('div', { class: 'pl-now-c' },
      h('span', { class: 'pl-av pl-av-sm pl-av-lime', 'aria-hidden': 'true', text: iniciales(p) }),
      h('span', { class: 'pl-now-t' },
        h('span', { class: 'pl-now-n', text: nombre(p) }),
        h('span', { class: 'pl-now-i', text: D.etiqueta(D.INTENCIONES, p.intent) }),
        h('span', { class: 'pl-now-s', text: [p.level, hasta].filter(Boolean).join(' · ') })),
      h('a', { class: 'pl-btn', href: verTarjeta(p), text: 'View', 'aria-label': `View ${nombre(p)}'s player card` }));
  }
  function filaLista(p, sub) {
    return h('li', null,
      h('span', { class: 'pl-av pl-av-sm', 'aria-hidden': 'true', text: iniciales(p) }),
      h('span', { class: 'pl-list-t' }, h('span', { class: 'pl-list-n', text: nombre(p) }), h('span', { class: 'pl-list-s', text: sub })),
      h('a', { class: 'pl-btn', href: verTarjeta(p), text: 'View', 'aria-label': `View ${nombre(p)}'s player card` }));
  }
  function seccion(idSec, idCaja, lista, pintar) {
    const hay = !!(lista && lista.length);
    $(idSec).hidden = !hay;
    $(idCaja).replaceChildren(...(hay ? lista.map(pintar) : []));
    return hay;
  }

  function pintarYo(me) {
    if (!me) { $('pl-me').hidden = true; return; }
    const como = nombre(me);
    const textos = {
      public: [`Public · as "${como}"`, 'Other players see your full name, level, city, your story and the parts of your DNA you turned on.'],
      limited: [`Limited · as "${como}"`, 'Other players see your first name, level, city and the parts of your DNA you turned on.'],
      private: ["Private · you don't appear in Play", 'Switch to Limited in My Identity (Who can find you) to be recommended to other players.'],
    }[me.visibility] || ['', ''];
    $('pl-me-n').textContent = textos[0];
    $('pl-me-s').textContent = textos[1];
    $('pl-me').hidden = false;
  }

  let vez = 0;
  P.alEntrar('play', async () => {
    const mia = ++vez;
    $('pl-error').hidden = true;
    $('pl-main').setAttribute('aria-busy', 'true');
    let d;
    try {
      const { data, error } = await sb.rpc('portal_play');
      if (error) throw error;
      d = data || {};
    } catch (err) {
      if (mia !== vez) return;
      console.warn('[portal] play:', err);
      $('pl-error').textContent = P.errorTexto(err);
      $('pl-error').hidden = false;
      $('pl-main').setAttribute('aria-busy', 'false');
      return;
    }
    if (mia !== vez) return;
    /* Suspendido del matchmaking (Player Safety, M-2a): su propio aviso. */
    $('pl-locked').hidden = !d.locked || !!d.suspended;
    $('gm-suspended').hidden = !d.suspended;
    if (d.locked) {
      ['pl-now-sec', 'pl-recs-sec', 'pl-new-sec', 'pl-opp-sec', 'pl-ret-sec', 'pl-empty', 'pl-hidden', 'pl-me'].forEach((id) => { $(id).hidden = true; });
      $('pl-main').setAttribute('aria-busy', 'false');
      return;
    }
    pintarYo(d.me);
    const hay = [
      seccion('pl-now-sec', 'pl-now', d.now, tarjetaAhora),
      seccion('pl-recs-sec', 'pl-recs', d.recommended, tarjetaRecomendada),
      seccion('pl-new-sec', 'pl-new', d.new_players, (p) => filaLista(p, [p.level, p.joined ? `joined ${fmt.corto(p.joined)}` : 'New to FEROCIA'].filter(Boolean).join(' · '))),
      seccion('pl-opp-sec', 'pl-opp', d.opponents, (p) => filaLista(p, `Faced ${p.faced} times`)),
      seccion('pl-ret-sec', 'pl-ret', d.returning, (p) => filaLista(p, p.weeks_away ? `Back after ${plural(p.weeks_away, 'week', 'weeks')}` : 'Back on court this week')),
    ];
    /* En Private no ve a nadie (quien no se deja ver no mira): se lo decimos. */
    $('pl-hidden').hidden = !d.hidden;
    $('pl-empty').hidden = !!d.hidden || hay.some(Boolean);
    $('pl-main').setAttribute('aria-busy', 'false');
  });

  /* ============================================================
     LA TARJETA DEL JUGADOR
     ============================================================ */
  function frase(p) {
    const estilos = D.enOrden(D.ESTILOS, p.styles || []);
    if (!estilos.length) return null;
    const adj = D.ADJETIVO[estilos[0]] || 'great';
    const cola = D.COLA[estilos[1] || estilos[0]] || 'who loves the game';
    return [/^[aeiou]/i.test(adj) ? 'An ' : 'A ', h('em', { text: adj }), ` ${D.formatoEnFrase(p.formats)} player ${cola}.`];
  }
  function filaDNA(dt, tags, fuerte) {
    if (!tags.length) return null;
    return h('div', { class: 'dn-row' }, h('dt', { text: dt }),
      h('dd', null, ...tags.map((t) => h('span', { class: fuerte ? 'dn-tag dn-tag-strong' : 'dn-tag', text: t }))));
  }

  let vezTarjeta = 0;
  P.alEntrar('player', async () => {
    const mia = ++vezTarjeta;
    /* #/player/me (o sin nada) = la tuya; #/player/<número> = la de otro;
       cualquier otra cosa: no disponible. */
    const crudo = (location.hash || '').replace(/^#\/player\/?/, '');
    const id = !crudo || crudo === 'me' ? null : (/^\d{1,18}$/.test(crudo) ? crudo : 'x');
    $('pc-error').hidden = true;
    $('pc-card').hidden = false;
    $('pc-card').setAttribute('aria-busy', 'true');
    /* Mientras carga, nada de la tarjeta anterior. */
    ['pc-ini', 'pc-name', 'pc-meta', 'pc-line'].forEach((x) => { $(x).textContent = ''; });
    ['pc-why', 'pc-stats', 'pc-recent', 'pc-hidden', 'pc-preview'].forEach((x) => { $(x).hidden = true; });
    $('pc-rows').replaceChildren();
    let p;
    try {
      if (id === 'x') throw new Error('not_available');
      const { data, error } = await sb.rpc('portal_tarjeta_jugador', { p_player_id: id });
      if (error) throw error;
      p = data || {};
    } catch (err) {
      if (mia !== vezTarjeta) return;
      console.warn('[portal] tarjeta:', err);
      $('pc-error').textContent = P.errorTexto(err, {
        not_available: "This player card isn't available.",
        members_only: 'Play is for FEROCIA members.',
        suspended: 'Your access to Play and games is paused.',
        hidden_caller: "Your privacy is Private, so you can't see other players' cards. Switch to Limited in My Identity (Who can find you).",
      });
      $('pc-error').hidden = false;
      $('pc-error').focus();
      $('pc-card').hidden = true;
      $('pc-preview').hidden = true;
      document.dispatchEvent(new CustomEvent('ferocia:tarjeta', { detail: null }));
      return;
    }
    if (mia !== vezTarjeta) return;

    const hist = p.history || null;
    $('pc-preview').hidden = !p.preview;
    $('pc-preview-t').textContent = p.visibility === 'private'
      ? "You're Private, so nobody sees your card. This is how they would see it with Limited privacy. Change it in "
      : 'This is how other players see your card. Change what they see in ';
    $('pc-ini').textContent = iniciales(p);
    $('pc-name').textContent = nombre(p);
    $('pc-meta').textContent = [p.level, [p.city, p.state].filter(Boolean).join(', '), hist && hist.since ? `FEROCIA since ${String(hist.since).slice(0, 4)}` : '']
      .filter(Boolean).join(' · ');
    const f = frase(p);
    $('pc-line').replaceChildren(...(f || []));
    $('pc-line').hidden = !f;

    /* "You and …": las razones (no en la tuya). */
    const why = $('pc-why');
    why.hidden = !!p.preview || !(p.reasons || []).length;
    if (!why.hidden) {
      why.replaceChildren(...listaRazones(`You and ${fmt.nombre(p.first_name)}`, p.reasons, 5).childNodes);
      if (p.match) why.firstChild.textContent = `You and ${fmt.nombre(p.first_name)} · ${ETIQUETA[p.match]}`;
    }

    const todos = D.MOMENTOS.concat(D.EXTRAS);
    const hasta = p.intent_until ? D.hastaTexto(p.intent_until).replace(' · then it clears on its own', '').replace(/^Until /, 'until ') : '';
    $('pc-rows').replaceChildren(...[
      filaDNA('Play style', D.enOrden(D.ESTILOS, p.styles || []).map((c) => D.etiqueta(D.ESTILOS, c)), true),
      filaDNA('Competition', D.enOrden(D.COMPETICION, p.competitions || []).map((c) => D.etiqueta(D.COMPETICION, c))),
      filaDNA('Side · Format', [p.side ? D.etiqueta(D.LADOS, p.side) : null,
        ...D.enOrden(D.FORMATOS, p.formats || []).map((c) => D.etiqueta(D.FORMATOS, c))].filter(Boolean)),
      filaDNA('Availability', D.enOrden(todos, p.availability || []).map((c) => D.etiqueta(todos, c))),
      filaDNA('Right now', p.intent ? [[D.etiqueta(D.INTENCIONES, p.intent), hasta].filter(Boolean).join(' · ')] : []),
      filaDNA('Social DNA', (p.social || []).slice(0, 4).map((s) => `${D.etiqueta(D.RECONOCIMIENTOS, s.recognition)} ×${s.count}`)),
    ].filter(Boolean));

    /* Public: su historia (y estadísticas o partidos, si los enseña). */
    const st = $('pc-stats');
    st.hidden = !hist;
    if (hist) {
      const kpi = (dt, dd) => h('div', null, h('dt', { text: dt }), h('dd', { text: String(dd) }));
      st.replaceChildren(kpi('Games', hist.games || 0), kpi('Ladders', hist.ladders || 0), kpi('Tournaments', hist.tournaments || 0),
        ...(hist.wins != null ? [kpi('Record', `W ${hist.wins} · L ${hist.losses}`)] : []));
    }
    const rc = $('pc-recent');
    const recientes = hist && Array.isArray(hist.recent) ? hist.recent : [];
    rc.hidden = !recientes.length;
    rc.replaceChildren(...(recientes.length ? [h('h2', { class: 'pc-recent-h', text: 'Recent games' }),
      ...recientes.map((r) => h('div', { class: 'pc-res' },
        h('span', { text: `${fmt.corto(r.date)} · ${r.competition || ''}` }),
        h('span', { class: r.result === 'win' ? 'pc-res-w' : 'pc-res-l',
          text: `${r.result === 'win' ? 'W' : 'L'}${r.score_for != null ? ` ${r.score_for}–${r.score_against}` : ''}` })))] : []));

    /* Lo que guarda para sí (dicho con amabilidad, sin detalles). */
    const sh = p.shows || {};
    const ocultas = [
      sh.style === false ? 'play style' : null, sh.availability === false ? 'availability' : null,
      sh.social === false ? 'recognitions' : null,
      sh.match_history === false || p.visibility !== 'public' ? 'match history' : null,
      sh.stats === false || p.visibility !== 'public' ? 'stats' : null,
    ].filter(Boolean);
    const oc = $('pc-hidden');
    oc.hidden = !ocultas.length;
    if (ocultas.length) {
      const quien = p.preview ? 'You keep' : `${fmt.nombre(p.first_name)} keeps`;
      const txt = ocultas.length === 1 ? ocultas[0] : `${ocultas.slice(0, -1).join(', ')} and ${ocultas[ocultas.length - 1]}`;
      oc.replaceChildren(icono('candado', 15), document.createTextNode(`${quien} ${txt} private.`));
    }
    $('pc-acts').hidden = !!p.preview;
    $('pc-card').setAttribute('aria-busy', 'false');
    /* Invitar, reportar y bloquear los pinta pj-games.js (M-2a). */
    document.dispatchEvent(new CustomEvent('ferocia:tarjeta', { detail: p }));
  });
})();
