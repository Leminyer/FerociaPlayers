/* ============================================================
   FEROCIA PLAYER PORTAL — El resultado de un juego (Matchmaking, etapas M-3a y M-3b)
   15 y 16 de octubre — diseños aprobados (§79, §81)

   En la página del juego (pj-games.js lo pide con P.resultadoPanel(j)):
     · El anfitrión, después del juego: quién vino (Played · No-show ·
       Excused; quien se salió menos de 12 horas antes: Late cancellation
       · Excused) y los juegos: sueltos, Best of 3 o Best of 5, con los
       equipos y el marcador. Si alguien lo declina, lo corrige una vez.
       M-3b: puede añadir al jugador de última hora (con su código, o como
       invitado) y, hasta 7 días después, cambiar un invitado por su código.
     · Los demás: Accept / Decline (con el motivo). Si nadie declina en 48
       horas, queda verificado solo. Quien fue añadido en lugar de un
       invitado dice si es él.
     · Después: su estado (esperando, en revisión, verificado, descartado,
       Self-reported).
   "Log a game you played" (pj-log.js) usa el mismo formulario de los
   juegos (P.resultadoFormulario) y la misma ventana para añadir a alguien
   (P.ventanaJugador).
   La base comprueba todo otra vez (equipos, marcadores, límites); aquí se
   avisa antes de enviar. Todo se pinta como TEXTO (h()), nunca HTML.
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { h } = P;
  const UI = () => P.juegosUI;

  const FORMATO = { single: 'Single game', bo3: 'Best of 3', bo5: 'Best of 5' };
  const META = { single: 1, bo3: 2, bo5: 3 };
  const ASISTE = { played: 'Played', no_show: 'No-show', excused: 'Excused', late: 'Late cancellation', late_excused: 'Excused' };
  const ASISTE_LARGO = {
    no_show: "didn't show up", excused: 'excused (emergency or something out of their control)',
    late: 'cancelled less than 12 hours before', late_excused: 'cancelled late — excused',
  };
  const MOTIVOS = [['score', 'A score is wrong'], ['teams', 'The teams are wrong'], ['not_played', "I didn't play this game"],
    ['attendance', "Someone is marked wrong (played / didn't show up)"], ['other', 'Something else']];
  const MOTIVO_TXT = Object.fromEntries(MOTIVOS);
  const MAX_DIA = 8, MAX_PAREJA = 4, MAX_ENTRADAS = 24, MAX_INVITADO = 40;

  const cuandoLargo = (iso) => { const c = UI().cuando(iso); return `${c.largo}, ${c.hora}`; };
  const nombre = (p, yo) => (p.player_id === yo || p.me ? 'You' : p.name || 'A player');
  const panel = (clase, ...hijos) => h('section', { class: `pj-panel rs-panel${clase ? ' ' + clase : ''}`, 'aria-label': 'Game result' }, ...hijos);
  const titulo = (t) => h('div', { class: 'pj-panel-head' }, h('h2', { class: 'pj-panel-title', text: t }));
  const primero = (t) => String(t || '').split(' ')[0];

  /* Un partido, desde el lado de "yo" si jugó (si no, tal cual). */
  function filaPartido(e, yo, n) {
    const enA = (e.team_a || []).some((p) => p.player_id === yo);
    const enB = (e.team_b || []).some((p) => p.player_id === yo);
    const mio = enA ? e.team_a : enB ? e.team_b : e.team_a;
    const otro = enA ? e.team_b : enB ? e.team_a : e.team_b;
    const sa = enB ? e.score_b : e.score_a, sb = enB ? e.score_a : e.score_b;
    const ga = sa.filter((x, i) => x > sb[i]).length, gb = sb.filter((x, i) => x > sa[i]).length;
    const games = sa.map((x, i) => `${x}–${sb[i]}`).join(', ');
    const conQuien = (enA || enB)
      ? [mio.filter((p) => p.player_id !== yo).map((p) => p.name).join(' & '), otro.map((p) => p.name).join(' & ')]
      : [mio.map((p) => p.name).join(' & '), otro.map((p) => p.name).join(' & ')];
    const quien = (enA || enB) ? `${conQuien[0] ? `w/ ${conQuien[0]} · ` : ''}vs ${conQuien[1]}` : `${conQuien[0]} vs ${conQuien[1]}`;
    const marcador = e.format === 'single' ? games : `${ga}–${gb}`;
    const gano = ga > gb;
    return h('li', null,
      h('span', { class: 'rs-t', text: `${e.format === 'single' ? 'Game' : 'Match'} ${n} · ${FORMATO[e.format].toLowerCase()}` }),
      h('span', { class: 'rs-s', text: marcador }),
      (enA || enB) ? h('span', { class: `pj-res ${gano ? 'is-win' : 'is-loss'}`, title: gano ? 'Win' : 'Loss' },
        h('span', { 'aria-hidden': 'true', text: gano ? 'W' : 'L' }), h('span', { class: 'pj-sr', text: gano ? 'Win' : 'Loss' })) : h('span'),
      h('span', { class: 'rs-w', text: e.format === 'single' ? quien : `${quien} · ${games}` }));
  }
  function listaPartidos(r, yo, soloMios) {
    const todos = r.entries || [];
    const mios = todos.filter((e) => [...(e.team_a || []), ...(e.team_b || [])].some((p) => p.player_id === yo));
    const lista = soloMios && mios.length ? mios : todos;
    if (!lista.length) return null;
    return h('ul', { class: 'rs-res' }, ...lista.map((e) => filaPartido(e, yo, e.pos)));
  }
  function notasAsistencia(r, yo) {
    const fuera = (r.people || []).filter((p) => p.attendance !== 'played');
    if (!fuera.length) return null;
    return h('ul', { class: 'rs-att-notes' }, ...fuera.map((p) =>
      h('li', null, h('b', { text: nombre(p, yo) }), `: ${ASISTE_LARGO[p.attendance] || p.attendance}`)));
  }
  const reloj = (texto) => { const p = h('p', { class: 'rs-clock' }); p.append(UI().icono('reloj', 16), h('span', null, ...[].concat(texto))); return p; };

  /* ============================================================
     AÑADIR A ALGUIEN: con su código (FEROCIA) o como invitado
     soloCodigo: sólo con código (cambiar un invitado por su código).
     Devuelve { player_id, name, role: 'added' } o { name, role: 'guest' }.
     ============================================================ */
  P.ventanaJugador = function ({ titulo: tituloV, soloCodigo, yaEstan, boton } = {}) {
    return UI().ventana((caja, cerrar, idT) => {
      let modo = 'code';
      let encontrado = null;
      const err = h('div', { class: 'pj-alert pj-alert-error', role: 'alert', hidden: true });
      const cuerpo = h('div', { class: 'lg-modal-body' });
      const pestanas = h('div', { class: 'lg-tabs', role: 'group', 'aria-label': 'Who is it' });
      const tab = (valor, texto) => {
        const b = h('button', { type: 'button', class: 'lg-tab', 'aria-pressed': String(valor === modo), text: texto });
        b.addEventListener('click', () => { modo = valor; encontrado = null; err.hidden = true; pintar(); });
        return b;
      };
      const mostrar = (t) => { err.textContent = t; err.hidden = false; };

      function pintar() {
        pestanas.replaceChildren(tab('code', 'FEROCIA player'), tab('guest', 'Guest'));
        pestanas.hidden = !!soloCodigo;
        if (modo === 'code') {
          const campo = h('input', { class: 'gm-input lg-code-in', type: 'text', maxlength: '9', autocomplete: 'off', autocapitalize: 'characters',
            spellcheck: 'false', 'aria-label': 'Player code', placeholder: 'Player code' });
          const buscar = h('button', { type: 'button', class: 'lg-find', text: 'Find' });
          const resultado = h('div', { class: 'lg-found-wrap' });
          const anadir = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block', text: boton || 'Add player', hidden: true });
          const hacer = async () => {
            err.hidden = true;
            const c = campo.value.replace(/[\s-]/g, '').toUpperCase();
            if (!/^[2-9A-HJKMNP-Z]{6}$/.test(c)) { mostrar('A player code has 6 letters and numbers, like K7M2Q9.'); campo.focus(); return; }
            buscar.disabled = true;
            try {
              const d = await UI().rpc('portal_codigo_buscar', { p_code: c });
              if (!d || !d.ok) { encontrado = null; resultado.replaceChildren(); anadir.hidden = true; mostrar(UI().textoError({ message: (d && d.error) || 'code_not_found' })); return; }
              if ((yaEstan || []).includes(d.player.player_id)) { encontrado = null; resultado.replaceChildren(); anadir.hidden = true; mostrar(UI().textoError({ message: 'already_in_game' })); return; }
              encontrado = d.player;
              resultado.replaceChildren(h('div', { class: 'lg-found' },
                h('span', { class: 'pl-av pl-av-sm', 'aria-hidden': 'true', text: UI().iniciales(encontrado.name) }),
                h('span', null, h('b', { text: encontrado.name }), h('small', { text: [encontrado.level, encontrado.city].filter(Boolean).join(' · ') }))));
              anadir.textContent = `${boton || 'Add'} ${encontrado.name}`;
              anadir.hidden = false;
              anadir.focus();
            } catch (e) { mostrar(UI().textoError(e)); } finally { buscar.disabled = false; }
          };
          buscar.addEventListener('click', hacer);
          campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); hacer(); } });
          anadir.addEventListener('click', () => { if (encontrado) cerrar({ player_id: encontrado.player_id, name: encontrado.name, role: 'added' }); });
          cuerpo.replaceChildren(
            h('p', { class: 'pj-small gm-m0', text: 'Ask them for their player code. They\'ll find it in Play, under "How others find you", and in My Identity.' }),
            h('div', { class: 'lg-add' }, campo, buscar), resultado,
            h('p', { class: 'gm-small gm-m0', text: 'They get the result to accept or decline. Their name is only shown to the people in this game.' }),
            anadir);
          setTimeout(() => campo.focus(), 0);
        } else {
          const campo = h('input', { class: 'gm-input', type: 'text', maxlength: String(MAX_INVITADO), autocomplete: 'off', 'aria-label': 'Guest name', placeholder: 'First name and last initial' });
          const anadir = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block', text: 'Add guest' });
          const hacer = () => {
            const n = campo.value.trim().replace(/\s+/g, ' ');
            if (!n) { mostrar('Write their name.'); campo.focus(); return; }
            if (n.length > MAX_INVITADO || UI().conContacto(n)) { mostrar(UI().textoError({ message: 'invalid_guest' })); campo.focus(); return; }
            cerrar({ name: n, role: 'guest' });
          };
          anadir.addEventListener('click', hacer);
          campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); hacer(); } });
          cuerpo.replaceChildren(
            h('p', { class: 'pj-small gm-m0', text: 'Someone who isn\'t on FEROCIA. The game still counts for you, and you can link them to their player code within 7 days if they join.' }),
            campo, anadir);
          setTimeout(() => campo.focus(), 0);
        }
      }
      const no = h('button', { type: 'button', class: 'gm-btn-quiet', text: 'Cancel' });
      no.addEventListener('click', () => cerrar(null));
      caja.append(h('h2', { id: idT, text: tituloV || 'Add a player' }), pestanas, cuerpo, err, no);
      pintar();
      return null;
    });
  };

  /* ============================================================
     EL PANEL, SEGÚN EL MOMENTO
     ============================================================ */
  P.resultadoPanel = function (j) {
    const yo = j.my_id;
    const r = j.result;
    if (!r) return j.report && j.is_host ? formulario(j, null) : null;
    const host = (r.people || []).find((p) => p.role === 'host') || {};

    /* M-3b: alguien lo añadió en lugar de su invitado. ¿Es él? */
    if (r.link) {
      const si = h('button', { type: 'button', class: 'rs-accept', text: 'Yes, that\'s me' });
      const no = h('button', { type: 'button', class: 'rs-decline', text: 'That\'s not me' });
      const responder = async (ok, boton) => {
        si.disabled = true; no.disabled = true;
        try {
          const d = await UI().rpc('portal_resultado_vinculo', { p_game: j.id, p_accept: ok });
          P.aviso(!ok ? `Thanks. We let ${primero(r.link.reporter)} know.`
            : d && d.status === 'verified' ? 'Thanks! The result is verified and on your profile.' : 'Thanks! The game is on your profile.');
          if (P.avisosRecargar) P.avisosRecargar();
          UI().recargarJuego();
        } catch (e) { si.disabled = false; no.disabled = false; P.aviso(UI().textoError(e), true); if (boton) boton.focus(); }
      };
      si.addEventListener('click', () => responder(true, si));
      no.addEventListener('click', () => responder(false, no));
      return h('div', { class: 'rs-wrap' },
        h('section', { class: 'rs-banner', 'aria-labelledby': 'rs-b-t' },
          h('span', { class: 'rs-k', text: 'Is it you?' }),
          h('h2', { id: 'rs-b-t', text: `${r.link.reporter || 'A player'} added you to this game` }),
          h('p', { text: `In place of their guest "${r.link.guest_name}". If it was you, the game counts for you too.` })),
        panel(null, titulo('The results'), listaPartidos(r, yo, false), notasAsistencia(r, yo),
          h('div', { class: 'rs-btns' }, no, si),
          reloj(['If you don\'t answer by ', h('b', { text: cuandoLargo(r.link.until) }), ', it\'s added to your profile.'])));
    }

    /* Los demás: aceptar o declinar. */
    if (r.can_vote) {
      const n = (r.entries || []).length;
      const aceptar = h('button', { type: 'button', class: 'rs-accept', text: 'Accept' });
      const declinar = h('button', { type: 'button', class: 'rs-decline', text: 'Decline' });
      aceptar.addEventListener('click', () => votar(j, true, aceptar));
      declinar.addEventListener('click', () => ventanaDeclinar(j, host.name));
      const quien = host.name || 'The host';
      return h('div', { class: 'rs-wrap' },
        h('section', { class: 'rs-banner', 'aria-labelledby': 'rs-b-t' },
          h('span', { class: 'rs-k', text: 'Result reported · please check' }),
          h('h2', { id: 'rs-b-t', text: r.logged ? `${quien} logged a game you played`
            : n ? `${quien} reported ${UI().plural(n, 'result', 'results')} for this game` : `${quien} reported who came to this game` }),
          h('p', { text: 'Does it look right? Accept it, or decline if something is wrong — the host can correct it once, and then the FEROCIA team takes a look.' })),
        panel(null, titulo(!n ? 'Who came' : (r.entries || []).some((e) => [...(e.team_a || []), ...(e.team_b || [])].some((p) => p.player_id === yo)) ? 'Your results' : 'The results'),
          listaPartidos(r, yo, true), notasAsistencia(r, yo),
          h('div', { class: 'rs-btns' }, declinar, aceptar),
          reloj(['If no one declines by ', h('b', { text: cuandoLargo(r.deadline_at) }), ', the result is verified automatically and added to everyone\'s profile.'])));
    }

    /* El anfitrión: lo declinaron y puede corregirlo una vez. */
    if (r.can_correct) {
      const corregir = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block', text: 'Correct the result' });
      const caja = panel('rs-alert', titulo('Your result was declined'),
        h('ul', { class: 'rs-declines' }, ...(r.declines || []).map((d) => h('li', null,
          h('b', { text: d.name }), ` — ${MOTIVO_TXT[d.reason] || 'Something else'}`, d.detail ? h('q', { text: d.detail }) : null))),
        h('p', { class: 'gm-small gm-m0', text: 'You can correct it once. Everyone gets it again to accept or decline; if it\'s declined again, the FEROCIA team decides.' }),
        corregir,
        reloj(['If you don\'t correct it by ', h('b', { text: cuandoLargo(r.deadline_at) }), ', the FEROCIA team will review it.']),
        listaPartidos(r, yo, false));
      corregir.addEventListener('click', () => caja.replaceWith(formulario(j, r)));
      return caja;
    }

    /* El estado. */
    const estado = {
      pending: ['Waiting for the players', 'is-wait'], declined: ['In review', 'is-wait'], disputed: ['In review', 'is-wait'],
      verified: ['Verified', 'is-ok'], discarded: ['Discarded', 'is-off'], self: ['Self-reported', 'is-off'],
    }[r.status] || ['', ''];
    const head = h('div', { class: 'pj-panel-head' }, h('h2', { class: 'pj-panel-title', text: 'Result' }), h('span', { class: `rs-pill ${estado[1]}`, text: estado[0] }));
    const textos = [];
    if (r.status === 'pending') {
      const si = (r.people || []).filter((p) => p.vote === 'accepted' && !p.me).map((p) => p.name);
      if (r.is_reporter) textos.push(h('p', { class: 'gm-small gm-m0', text: si.length ? `Accepted by ${si.join(', ')}.` : 'Everyone got it by email and in the portal.' }));
      else if (r.my_vote === 'accepted') textos.push(h('p', { class: 'gm-small gm-m0', text: 'You accepted it.' }));
      textos.push(new Date(r.deadline_at) <= new Date()
        ? reloj('Nobody declined it — it\'s being verified now.')
        : reloj(['If no one declines by ', h('b', { text: cuandoLargo(r.deadline_at) }), ', it\'s verified automatically.']));
    } else if (r.status === 'declined') {
      textos.push(h('p', { class: 'gm-small gm-m0', text: r.is_reporter ? 'The FEROCIA team will review this result.'
        : r.my_vote === 'declined' ? 'You declined this result. The host can correct it once.' : 'Someone declined this result. The host can correct it once.' }));
    } else if (r.status === 'disputed') {
      textos.push(h('p', { class: 'gm-small gm-m0', text: 'The FEROCIA team is reviewing this result. It counts once they decide.' }));
    } else if (r.status === 'verified') {
      textos.push(h('p', { class: 'gm-small gm-m0', text: r.decided_how === 'team' ? 'Verified by the FEROCIA team. It\'s on everyone\'s profile.' : 'It\'s on everyone\'s profile.' }));
    } else if (r.status === 'discarded') {
      textos.push(h('p', { class: 'gm-small gm-m0', text: 'This result was discarded by the FEROCIA team. It doesn\'t count for anyone.' }));
    } else if (r.status === 'self') {
      textos.push(h('p', { class: 'gm-small gm-m0', text: r.is_reporter
        ? 'It counts in your Play games as self-reported, because no other FEROCIA player can confirm it. It doesn\'t count for reliability or recognitions.'
        : `Self-reported by ${host.name || 'the host'}. It counts in Play games as self-reported, not for reliability or recognitions.` }));
    }
    return panel(null, head, ...textos, ...(r.status === 'discarded' ? [] : [listaPartidos(r, yo, false), notasAsistencia(r, yo), invitados(j, r)]));
  };

  /* M-3b: los invitados; quien lo reportó puede cambiarlos por su código (7 días). */
  function invitados(j, r) {
    const lista = r.guests || [];
    if (!lista.length || !r.is_reporter) return null;
    const filas = lista.map((g) => {
      const l = g.link || {};
      let lado;
      if (l.status === 'pending') lado = h('span', { class: 'gm-small', text: `Waiting for ${l.name || 'them'} to confirm` });
      else if (l.status === 'accepted') lado = h('span', { class: 'gm-pill gm-pill-ok', text: `Linked to ${l.name || 'a player'}` });
      else if (l.can_link) {
        const b = h('button', { type: 'button', class: 'gm-link', text: 'Link with player code', 'aria-label': `Link ${g.name} with their player code` });
        b.addEventListener('click', () => vincular(j, r, g, b));
        lado = b;
      } else lado = null;
      const sub = l.status === 'declined' && l.can_link ? `Said it wasn't them · link until ${UI().cuando(l.until).largo}`
        : l.status === 'expired' && l.can_link ? `Couldn't be linked · link until ${UI().cuando(l.until).largo}`
          : l.status === 'expired' ? "Couldn't be linked" : l.can_link ? `Link until ${UI().cuando(l.until).largo}` : '';
      return h('li', null, h('span', null, h('b', { text: g.name }), sub ? h('span', { class: 'lg-guest-s', text: sub }) : null), lado);
    });
    const hayQue = lista.some((g) => g.link && g.link.can_link);
    return h('div', { class: 'lg-guests-wrap' },
      h('h3', { class: 'rs-h', text: 'Guests' }),
      h('ul', { class: 'lg-guests' }, ...filas),
      hayQue ? reloj(['Did they join FEROCIA? Add their player code within 7 days. They get the result to accept or decline',
        r.status === 'self' ? ' — if they played on the other team, it becomes ' : '.', r.status === 'self' ? h('b', { text: 'Verified' }) : '',
        r.status === 'self' ? ' once they accept (or after 48 hours with no answer).' : '']) : null);
  }
  async function vincular(j, r, g, boton) {
    const yaEstan = (r.people || []).map((p) => p.player_id);
    const quien = await P.ventanaJugador({ titulo: `Link ${g.name} with their player code`, soloCodigo: true, yaEstan, boton: 'Link' });
    if (!quien) return;
    if (boton) boton.disabled = true;
    try {
      await UI().rpc('portal_resultado_vincular', { p_game: j.id, p_ref: g.ref, p_player: quien.player_id });
      P.aviso(`Sent. ${primero(quien.name)} gets the result to confirm it was them.`);
      UI().recargarJuego();
    } catch (e) { if (boton) boton.disabled = false; P.aviso(UI().textoError(e), true); }
  }

  async function votar(j, ok, boton) {
    if (boton) boton.disabled = true;
    try {
      const d = await UI().rpc('portal_resultado_votar', { p_game: j.id, p_accept: ok, p_reason: null, p_detail: null });
      P.aviso(d && d.status === 'verified' ? 'Thanks! The result is verified and on everyone\'s profile.' : 'Thanks! You accepted the result.');
      if (P.avisosRecargar) P.avisosRecargar();
      UI().recargarJuego();
    } catch (e) {
      if (boton) boton.disabled = false;
      P.aviso(UI().textoError(e), true);
    }
  }

  function ventanaDeclinar(j, hostNombre) {
    return UI().ventana((caja, cerrar, idT) => {
      const ops = UI().opciones('rs-motivo', MOTIVOS);
      const detalle = h('textarea', { class: 'gm-textarea', maxlength: '500', rows: '3', placeholder: 'Tell us more (optional)', 'aria-label': 'Tell us more' });
      const err = h('div', { class: 'pj-alert pj-alert-error', role: 'alert', hidden: true });
      const si = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block gm-btn-danger', text: 'Decline result' });
      const no = h('button', { type: 'button', class: 'gm-btn-quiet', text: 'Cancel' });
      ops.addEventListener('change', () => { detalle.placeholder = UI().elegido(ops) === 'other' ? 'Tell us what\'s not right (required)' : 'Tell us more (optional)'; });
      si.addEventListener('click', async () => {
        const m = UI().elegido(ops);
        const d = detalle.value.trim();
        if (!m) { err.textContent = 'Choose what\'s not right.'; err.hidden = false; return; }
        if (m === 'other' && !d) { err.textContent = 'Tell us a little more.'; err.hidden = false; detalle.focus(); return; }
        if (d && UI().conContacto(d)) { err.textContent = 'Please remove phone numbers, emails, links or @usernames.'; err.hidden = false; detalle.focus(); return; }
        si.disabled = true;
        try {
          const res = await UI().rpc('portal_resultado_votar', { p_game: j.id, p_accept: false, p_reason: m, p_detail: d || null });
          cerrar((res && res.status) || 'declined');
        } catch (e) { err.textContent = UI().textoError(e); err.hidden = false; si.disabled = false; }
      });
      no.addEventListener('click', () => cerrar(null));
      caja.append(h('h2', { id: idT, text: 'What\'s not right?' }),
        h('p', { class: 'pj-small gm-m0', text: `${primero(hostNombre || 'The host')} will be able to correct it once. If it's still not right, the FEROCIA team decides.` }),
        ops, detalle, err, si, no);
      return ops.querySelector('input');
    }).then((ok) => {
      if (ok) {
        P.aviso(ok === 'disputed' ? 'Thanks for telling us. The FEROCIA team will review the result.' : 'Thanks for telling us. The host can correct the result.');
        UI().recargarJuego();
      }
    });
  }

  /* ============================================================
     REPORTAR (O CORREGIR) EL RESULTADO — el anfitrión
     opts.log (M-3b, "Log a game"): { kind, gente, enviar(datos), volver() }:
     los jugadores ya vienen elegidos (todos jugaron) y sólo faltan los juegos.
     ============================================================ */
  let vezForm = 0;
  let invitadoN = 0;   // números negativos para los invitados nuevos
  function formulario(j, previo, opts = {}) {
    const id = ++vezForm;
    const log = opts.log || null;
    const yo = j.my_id;
    const tipo = log ? log.kind : j.kind;
    const tam = tipo === 'singles' ? 1 : 2;
    const drill = tipo === 'drill';
    const tope = log ? (tipo === 'singles' ? 4 : 6) : (j.report && j.report.max) || (tipo === 'singles' ? 4 : 6);
    const base = log ? log.gente : previo ? previo.people : (j.report && j.report.people) || [];
    const gente = base.map((p) => ({ player_id: p.player_id, name: p.name, role: p.role }));
    /* Los invitados que ya están en el resultado (al corregir). */
    /* (Un invitado ya cambiado por su jugador no sale: el jugador ya está en la lista.) */
    if (previo) (previo.guests || []).filter((g) => !(g.link && g.link.status === 'accepted')).forEach((g) => gente.push({ player_id: g.ref, name: g.name, role: 'guest' }));
    const fijos = !!previo || !!log;   // al corregir (o en "Log a game") no se añade ni se quita a nadie aquí
    const asistencia = {};
    gente.forEach((p) => {
      const antes = previo && (previo.people || []).find((x) => x.player_id === p.player_id);
      asistencia[p.player_id] = antes ? antes.attendance : (p.role === 'late' ? 'late' : 'played');
    });
    const ids = (lista) => (lista || []).map((x) => x.player_id);
    let partidos = previo && (previo.entries || []).length
      ? previo.entries.map((e) => ({ format: e.format, a: ids(e.team_a), b: ids(e.team_b), scores: e.score_a.map((x, i) => [String(x), String(e.score_b[i])]) }))
      : (drill ? [] : [nuevo()]);
    function nuevo() { return { format: 'single', a: [yo], b: [], scores: [['', '']] }; }

    const err = h('div', { class: 'pj-alert pj-alert-error', role: 'alert', tabindex: '-1', hidden: true });
    const cuerpoGente = h('ul', { class: 'rs-att' });
    const cuerpoPartidos = h('div', { class: 'rs-games' });
    const resumen = h('div', { class: 'rs-sum' });
    const enviar = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block',
      text: log ? 'Log the game' : previo ? 'Send corrected result' : 'Send result to players' });
    const agregar = h('button', { type: 'button', class: 'rs-add', text: '+ Add a game or match' });
    const masGente = h('button', { type: 'button', class: 'lg-add-player', text: '+ Add a player' });
    const persona = (pid) => gente.find((p) => p.player_id === pid);
    const nombreDe = (pid) => (pid === yo ? 'You' : (persona(pid) || {}).role === 'guest' ? `${persona(pid).name} (guest)` : (persona(pid) || {}).name || 'A player');
    const jugaron = () => gente.filter((p) => ['host', 'added', 'guest'].includes(p.role) || asistencia[p.player_id] === 'played').map((p) => p.player_id);
    const cuantos = () => gente.filter((p) => p.role !== 'late').length;

    /* Al volver a pintar, el foco vuelve al mismo control (teclado y lectores de pantalla). */
    const claveFoco = () => { const a = document.activeElement; return a && a.dataset ? a.dataset.k : null; };
    const volverFoco = (k) => { if (!k) return; const el = (cuerpo || document).querySelector(`[data-k="${k}"]`); if (el) el.focus({ preventScroll: true }); };
    let cuerpo = null;

    /* Quién vino. */
    function pintarGente() {
      const k = claveFoco();
      cuerpoGente.replaceChildren(...gente.filter((p) => p.role !== 'host').map((p) => {
        /* Los añadidos con código y los invitados: jugaron (si no, no se ponen). */
        if (p.role === 'added' || p.role === 'guest') {
          const quitar = fijos ? null : h('button', { type: 'button', class: 'gm-link gm-link-soft', text: 'Remove', 'aria-label': `Remove ${p.name}`, 'data-k': `rm-${p.player_id}` });
          if (quitar) quitar.addEventListener('click', () => {
            gente.splice(gente.indexOf(p), 1);
            partidos.forEach((e) => { e.a = e.a.filter((x) => x !== p.player_id); e.b = e.b.filter((x) => x !== p.player_id); });
            pintarGente(); pintarPartidos();
            masGente.focus();
          });
          return h('li', { class: 'lg-att-fixed' },
            h('span', { class: 'rs-att-n', text: p.name }),
            h('span', { class: 'lg-att-r' }, h('span', { class: p.role === 'guest' ? 'lg-guest' : 'lg-fer', text: p.role === 'guest' ? 'Guest' : 'Added with their code' }), quitar));
        }
        const opciones = p.role === 'late' ? ['late', 'late_excused'] : ['played', 'no_show', 'excused'];
        const grupo = h('div', { class: 'rs-seg', role: 'radiogroup', 'aria-label': `${p.name}: did they play?` });
        opciones.forEach((v) => {
          const input = h('input', { class: 'pj-sr', type: 'radio', name: `rs-at-${id}-${p.player_id}`, value: v, 'data-k': `at-${p.player_id}-${v}` });
          input.checked = asistencia[p.player_id] === v;
          const l = h('label', { class: `rs-opt${input.checked ? ` is-on is-${v}` : ''}` }, input, ASISTE[v]);
          input.addEventListener('change', () => {
            asistencia[p.player_id] = v;
            /* Quien no jugó sale de los equipos. */
            if (v !== 'played') partidos.forEach((e) => { e.a = e.a.filter((x) => x !== p.player_id); e.b = e.b.filter((x) => x !== p.player_id); });
            pintarGente(); pintarPartidos();
          });
          grupo.append(l);
        });
        const nota = asistencia[p.player_id] === 'excused' || asistencia[p.player_id] === 'late_excused'
          ? h('p', { class: 'rs-why', text: 'Excused: an emergency or something out of their control. It won\'t count against their reliability.' })
          : p.role === 'late' && asistencia[p.player_id] === 'late'
            ? h('p', { class: 'rs-why rs-why-soft', text: 'Left the game less than 12 hours before. Mark it excused if it was an emergency.' }) : null;
        return h('li', null, h('span', { class: 'rs-att-n', text: p.name + (p.role === 'late' ? ' · left late' : '') }), grupo, nota);
      }));
      masGente.hidden = fijos || cuantos() >= tope;
      volverFoco(k);
    }
    masGente.addEventListener('click', async () => {
      const quien = await P.ventanaJugador({ yaEstan: gente.filter((p) => p.player_id > 0).map((p) => p.player_id) });
      if (!quien) return;
      if (cuantos() >= tope) { P.aviso(UI().textoError({ message: 'too_many_players' }), true); return; }
      if (quien.role === 'guest') gente.push({ player_id: --invitadoN, name: quien.name, role: 'guest' });
      else if (!persona(quien.player_id)) gente.push({ player_id: quien.player_id, name: quien.name, role: 'added' });
      asistencia[gente[gente.length - 1].player_id] = 'played';
      pintarGente(); pintarPartidos();
    });

    /* Los juegos. */
    function pintarPartidos() {
      const k = claveFoco();
      const jug = jugaron();
      cuerpoPartidos.replaceChildren(...partidos.map((e, i) => {
        const caja = h('div', { class: 'rs-game' });
        const quitar = h('button', { type: 'button', class: 'gm-link gm-link-soft', text: 'Remove', 'aria-label': `Remove ${e.format === 'single' ? 'game' : 'match'} ${i + 1}`, 'data-k': `q-${i}` });
        quitar.addEventListener('click', () => { partidos.splice(i, 1); pintarPartidos(); });
        const formato = h('div', { class: 'rs-seg', role: 'radiogroup', 'aria-label': `Game ${i + 1}: format` });
        Object.keys(FORMATO).forEach((f) => {
          const input = h('input', { class: 'pj-sr', type: 'radio', name: `rs-f-${id}-${i}`, value: f, 'data-k': `f-${i}-${f}` });
          input.checked = e.format === f;
          input.addEventListener('change', () => {
            e.format = f;
            const filas = 2 * META[f] - 1;
            while (e.scores.length < filas) e.scores.push(['', '']);
            e.scores = e.scores.slice(0, filas);
            pintarPartidos();
          });
          formato.append(h('label', { class: `rs-opt${input.checked ? ' is-on' : ''}` }, input, FORMATO[f]));
        });
        const equipo = (lado, etiqueta) => {
          const otro = lado === 'a' ? 'b' : 'a';
          const fila = h('div', { class: 'rs-team', role: 'group', 'aria-label': `${etiqueta}, game ${i + 1}` },
            h('span', { class: 'rs-team-l', text: etiqueta }));
          jug.forEach((pid) => {
            const dentro = e[lado].includes(pid);
            const lleno = e[lado].length >= tam;
            const b = h('button', { type: 'button', class: `rs-chip${dentro ? ' is-on' : ''}${pid === yo ? ' is-me' : ''}`,
              'aria-pressed': String(dentro), disabled: !dentro && lleno, text: nombreDe(pid), 'data-k': `c-${i}-${lado}-${pid}` });
            b.addEventListener('click', () => {
              if (dentro) e[lado] = e[lado].filter((x) => x !== pid);
              else { e[otro] = e[otro].filter((x) => x !== pid); e[lado].push(pid); }
              pintarPartidos();
            });
            fila.append(b);
          });
          return fila;
        };
        const marcador = h('div', { class: 'rs-scores' },
          h('div', { class: 'rs-sc-row rs-sc-h', 'aria-hidden': 'true' }, h('span', { class: 'rs-sc-l' }),
            h('span', { class: 'rs-sc-t', text: 'Team 1' }), h('span', { class: 'rs-sc-x' }), h('span', { class: 'rs-sc-t', text: 'Team 2' })));
        e.scores.forEach((s, k) => {
          const extra = e.format !== 'single' && k >= META[e.format];
          const ent = (x) => {
            const inp = h('input', { class: 'rs-sc', type: 'text', inputmode: 'numeric', maxlength: '2', pattern: '[0-9]*',
              'aria-label': `Game ${k + 1}, ${x === 0 ? 'team 1' : 'team 2'} score`, value: s[x] });
            inp.addEventListener('input', () => { s[x] = inp.value.replace(/\D/g, '').slice(0, 2); if (inp.value !== s[x]) inp.value = s[x]; pintarResumen(); });
            return inp;
          };
          marcador.append(h('div', { class: 'rs-sc-row' },
            h('span', { class: 'rs-sc-l', text: e.format === 'single' ? 'Score' : `Game ${k + 1}${extra ? ' (if played)' : ''}` }),
            ent(0), h('span', { class: 'rs-sc-x', 'aria-hidden': 'true', text: '–' }), ent(1)));
        });
        caja.append(
          h('div', { class: 'rs-game-h' }, h('b', { text: `${e.format === 'single' ? 'Game' : 'Match'} ${i + 1}` }), quitar),
          formato, equipo('a', 'Team 1'), equipo('b', 'Team 2'), marcador);
        return caja;
      }));
      agregar.hidden = drill || partidos.length >= MAX_ENTRADAS;
      pintarResumen();
      volverFoco(k);
    }
    function games(e) { return e.scores.filter((s) => s[0] !== '' || s[1] !== '').length; }
    function pintarResumen() {
      err.hidden = true;   // lo que estaba mal se está arreglando
      const n = partidos.reduce((t, e) => t + games(e), 0);
      const fuera = gente.filter((p) => !['host', 'added', 'guest'].includes(p.role) && asistencia[p.player_id] !== 'played').length;
      resumen.replaceChildren(h('span', { text: drill ? 'Drill / practice: no scores' : `${UI().plural(partidos.length, 'entry', 'entries')} · ${UI().plural(n, 'game', 'games')}` }),
        h('span', { text: fuera ? `${fuera} didn't play` : 'Everyone played' }));
    }
    agregar.addEventListener('click', () => {
      const ult = partidos[partidos.length - 1];
      partidos.push(ult ? { format: 'single', a: [], b: [], scores: [['', '']] } : nuevo());
      pintarPartidos();
      const cajas = cuerpoPartidos.querySelectorAll('.rs-game');
      if (cajas.length) cajas[cajas.length - 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    /* Lo mismo que comprueba la base, para avisar antes de enviar. */
    function revisar() {
      const porPersona = {};
      const parejas = {};
      if (!drill && !partidos.length) return UI().textoError({ message: 'scores_required' });
      if (cuantos() > tope) return UI().textoError({ message: 'too_many_players' });
      if (!previo && !log && cuantos() < 2 && !gente.some((p) => p.role !== 'host')) return UI().textoError({ message: 'not_enough_players' });
      for (let i = 0; i < partidos.length; i++) {
        const e = partidos[i];
        const nom = `${e.format === 'single' ? 'Game' : 'Match'} ${i + 1}`;
        if (e.a.length !== tam || e.b.length !== tam) return `${nom}: choose ${tam === 1 ? 'one player' : 'two players'} for each team.`;
        const filas = e.scores.filter((s) => s[0] !== '' || s[1] !== '');
        if (filas.some((s) => s[0] === '' || s[1] === '')) return `${nom}: fill in both scores of each game.`;
        let ga = 0, gb = 0;
        for (const s of filas) {
          const x = Number(s[0]), y = Number(s[1]);
          if (ga === META[e.format] || gb === META[e.format]) return `${nom}: the match was already decided — remove the extra game.`;
          if (x === y) return `${nom}: a game can't end in a tie.`;
          if (x > 40 || y > 40) return `${nom}: check the score.`;
          if (x > y) ga++; else gb++;
        }
        if (ga !== META[e.format] && gb !== META[e.format]) return `${nom}: ${e.format === 'single' ? 'add the score' : `a ${FORMATO[e.format]} ends when a team wins ${META[e.format]} games`}.`;
        [...e.a, ...e.b].forEach((pid) => { if (pid > 0) porPersona[pid] = (porPersona[pid] || 0) + filas.length; });
        if (e.format === 'single') {
          const claves = tam === 2 ? [e.a.slice().sort().join('/'), e.b.slice().sort().join('/')] : [[e.a[0], e.b[0]].sort().join('/')];
          for (const k of claves) { parejas[k] = (parejas[k] || 0) + 1; if (parejas[k] > MAX_PAREJA) return UI().textoError({ message: 'same_partner_limit' }); }
        }
      }
      if (Object.values(porPersona).some((n) => n > MAX_DIA)) return UI().textoError({ message: 'too_many_games_day' });
      return null;
    }

    /* Los invitados nuevos van a la base en orden: el primero es -1, el segundo -2… */
    function datos() {
      const invitadosNuevos = fijos && !log ? [] : gente.filter((p) => p.role === 'guest');
      const ref = new Map(invitadosNuevos.map((g, i) => [g.player_id, -(i + 1)]));
      const mapa = (lista) => lista.map((pid) => (ref.has(pid) ? ref.get(pid) : pid));
      return {
        p_people: gente.filter((p) => p.role === 'in' || p.role === 'late').map((p) => ({ player_id: p.player_id, attendance: asistencia[p.player_id] })),
        p_entries: partidos.map((e) => ({ format: e.format, team_a: mapa(e.a), team_b: mapa(e.b),
          scores: e.scores.filter((s) => s[0] !== '' && s[1] !== '').map((s) => [Number(s[0]), Number(s[1])]) })),
        p_added: previo ? [] : gente.filter((p) => p.role === 'added').map((p) => p.player_id),
        p_guests: invitadosNuevos.map((g) => ({ name: g.name })),
      };
    }

    let enviando = false;
    enviar.addEventListener('click', async () => {
      if (enviando) return;
      err.hidden = true;
      const fallo = revisar();
      if (fallo) { err.textContent = fallo; err.hidden = false; err.focus(); return; }
      enviando = true;
      enviar.disabled = true;
      try {
        const d = datos();
        if (log) { await log.enviar(d); return; }
        const res = await UI().rpc('portal_resultado_reportar', { p_game: j.id, ...d });
        P.aviso(res && res.status === 'self' ? 'Saved. It counts in your Play games as self-reported.'
          : previo ? 'Corrected. Everyone gets it again to accept or decline.' : 'Sent! Everyone gets it to accept or decline. If no one declines in 48 hours, it\'s verified.');
        UI().recargarJuego();
      } catch (e) {
        err.textContent = UI().textoError(e);
        err.hidden = false;
        err.focus();
        enviar.disabled = false;
      } finally { enviando = false; }
    });

    pintarGente();
    pintarPartidos();
    const info = h('p', { class: 'rs-rule' });
    info.append(UI().icono('reloj', 16), h('span', { text: `Single games: up to ${MAX_PAREJA} with the same ${tam === 1 ? 'opponent' : 'partner'}. Best of 3 or 5: same teams for the whole match. Up to ${MAX_DIA} games per person per day.` }));
    const volver = log && log.volver ? h('button', { type: 'button', class: 'gm-btn-quiet', text: '← Back to who played' }) : null;
    if (volver) volver.addEventListener('click', () => log.volver());
    const conGente = !log && gente.length > 1;
    cuerpo = panel('gm-form', titulo(log ? 'Add the scores' : previo ? 'Correct the result' : 'Report the result'),
      h('p', { class: 'rs-intro', text: log
        ? (gente.some((p) => p.role === 'added') ? 'Add every game you played. FEROCIA players get it by email and in the portal to accept or decline.'
          : 'Add every game you played. With guests only, it counts in your Play games as self-reported.')
        : previo ? 'Fix what was wrong. Everyone gets it again to accept or decline.'
          : 'Add every game you played. Everyone gets the result by email and in the portal to accept or decline. If no one declines within 48 hours, it\'s verified.' }),
      conGente || (!log && !fijos) ? h('h3', { class: 'rs-h', text: 'Who played' }) : null,
      log ? null : cuerpoGente, log || fijos ? null : masGente,
      !log && !fijos ? h('p', { class: 'gm-small gm-m0 lg-add-help', text: 'Someone played at the last minute? Add them with their player code, or as a guest.' }) : null,
      drill ? h('p', { class: 'gm-small gm-m0', text: 'Drill / practice has no scores — just mark who came.' }) : h('h3', { class: 'rs-h', text: 'Games' }),
      cuerpoPartidos, agregar, drill ? null : info, resumen, err, enviar, volver,
      !previo && !log && j.report && j.report.until ? h('p', { class: 'gm-small gm-center gm-m0', text: `You can report it until ${cuandoLargo(j.report.until)}.` }) : null);
    return cuerpo;
  }
  P.resultadoFormulario = formulario;
})();
