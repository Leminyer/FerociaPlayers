/* ============================================================
   FEROCIA PLAYER PORTAL — "Log a game you played" y el código de jugador
   (Matchmaking, etapa M-3b) · 16 de octubre — diseño aprobado (§81)

   Lo que hace este archivo:
     · El código de jugador, en Play ("How others find you") y en My
       Identity ("Who can find you"): Copy y "Get a new code" (una vez al
       día; el viejo deja de servir).
     · log-game (#/log-game): registrar un juego que se jugó fuera de la
       app, hasta 3 días (72 horas) después y como mucho 3 al día.
         1. Cuándo, el tipo, dónde (opcional) y quién jugó: de FEROCIA con
            su código, o invitados escritos a mano.
         2. Los marcadores: el mismo formulario de "Report the result"
            (pj-results.js).
       Con al menos otro jugador de FEROCIA, el flujo de siempre (Accept /
       Decline, 48 horas); sólo con invitados queda "Self-reported".
   La base comprueba todo otra vez. Todo se pinta como TEXTO (h()).
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { h } = P;
  const $ = (id) => document.getElementById(id);
  const UI = () => P.juegosUI;

  const TAMANOS = { singles: [2, 4], doubles: [4, 6], mixed: [4, 6], drill: [2, 6] };
  const AYUDA = {
    singles: 'Singles: 2 to 4 players, counting you.', doubles: 'Doubles: 4 to 6 players, counting you.',
    mixed: 'Mixed doubles: 4 to 6 players, counting you.', drill: 'Drill / practice: 2 to 6 players, counting you.',
  };

  /* ============================================================
     EL CÓDIGO DE JUGADOR
     ============================================================ */
  let miCodigo = null;
  async function cargarCodigo() {
    try { miCodigo = await UI().rpc('portal_mi_codigo'); } catch (e) { miCodigo = null; }
    return miCodigo;
  }
  function tarjetaCodigo(caja, oscuro) {
    if (!caja) return;
    if (!miCodigo || !miCodigo.code) { caja.hidden = true; return; }
    const copiar = h('button', { type: 'button', class: 'lg-code-btn', text: 'Copy', 'aria-label': `Copy your player code ${miCodigo.code.split('').join(' ')}` });
    const nuevo = h('button', { type: 'button', class: 'lg-code-btn', text: 'Get a new code', disabled: !miCodigo.can_change });
    /* Cuándo podrá pedir otro: a la vista (no sólo al pasar el ratón). */
    const c = miCodigo.next_change ? UI().cuando(miCodigo.next_change) : null;
    const cuandoOtro = !miCodigo.can_change && c ? `You can get another new code ${c.dia === 'Today' ? 'today' : c.dia === 'Tomorrow' ? 'tomorrow' : 'on ' + c.largo} at ${c.hora}.` : '';
    copiar.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(miCodigo.code); P.aviso('Copied. Share it with FEROCIA friends you play with.'); }
      catch (e) { P.aviso(`Your player code is ${miCodigo.code}.`); }
    });
    nuevo.addEventListener('click', async () => {
      const ok = await UI().ventanaConfirmar({ titulo: 'Get a new code?', boton: 'Get a new code',
        texto: 'Your current code stops working right away, so only people you give the new one to can add you. You can do this once a day.' });
      if (!ok) return;
      nuevo.disabled = true;
      try {
        miCodigo = { ...miCodigo, ...(await UI().rpc('portal_codigo_nuevo')) };
        P.aviso(`Your new player code is ${miCodigo.code}.`);
        pintarCodigos();
      } catch (e) { nuevo.disabled = false; P.aviso(UI().textoError(e), true); }
    });
    caja.replaceChildren(...[
      h('span', { class: 'lg-code-k', text: 'Your player code' }),
      h('span', { class: 'lg-code-v', text: miCodigo.code }),
      h('span', { class: 'lg-code-acts' }, copiar, nuevo),
      h('small', { text: 'Share it with FEROCIA friends so they can add you to a game they log. Only people you give it to can use it.' }),
      cuandoOtro ? h('small', { class: 'lg-code-next', text: cuandoOtro }) : null].filter(Boolean));   // (replaceChildren escribiría "null")
    caja.classList.toggle('lg-code-dark', !!oscuro);
    caja.hidden = false;
  }
  function pintarCodigos() { tarjetaCodigo($('pl-code'), true); tarjetaCodigo($('id-code'), false); }
  P.alEntrar('play', async () => { await cargarCodigo(); pintarCodigos(); });
  P.alEntrar('profile', async () => { await cargarCodigo(); pintarCodigos(); });

  /* ============================================================
     LOG A GAME YOU PLAYED
     ============================================================ */
  let estado = null;
  const opcionesDia = () => {
    const hoy = UI().diaNY(new Date());
    return [0, 1, 2, 3].map((n) => {
      const ymd = UI().sumarDias(hoy, -n);
      const etiqueta = n === 0 ? 'Today' : n === 1 ? 'Yesterday'
        : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${ymd}T12:00:00Z`));
      return [ymd, etiqueta];
    });
  };
  /* ¿Hace como mucho 72 horas, y ya pasó? (Hora del club.) */
  function cuandoValido(ymd, hhmm) {
    if (!ymd || !/^\d{2}:\d{2}$/.test(hhmm || '')) return 'time';
    const ahora = new Date();
    const hoy = UI().diaNY(ahora), horaAhora = UI().horaNY(ahora);
    if (ymd > hoy || (ymd === hoy && hhmm > horaAhora)) return 'future';
    /* 72 horas atrás, en la hora del club. */
    const antes = new Date(ahora.getTime() - 72 * 3600 * 1000);
    const dA = UI().diaNY(antes), hA = UI().horaNY(antes);
    if (ymd < dA || (ymd === dA && hhmm < hA)) return 'old';
    return null;
  }

  function seg(nombre, lista, valor, alCambiar) {
    const g = h('div', { class: 'rs-seg lg-seg', role: 'radiogroup', 'aria-label': nombre });
    lista.forEach(([v, t]) => {
      const input = h('input', { class: 'pj-sr', type: 'radio', name: `lg-${nombre}`, value: v, 'data-k': `lg-${nombre}-${v}` });
      input.checked = v === valor;
      input.addEventListener('change', () => alCambiar(v));
      g.append(h('label', { class: `rs-opt${input.checked ? ' is-on' : ''}` }, input, t));
    });
    return g;
  }

  async function pintarLog() {
    const cuerpo = $('lg-body');
    cuerpo.replaceChildren(h('p', { class: 'gm-small', text: 'Loading…' }));
    const yo = await cargarCodigo();
    if (!yo || !yo.player_id) {
      cuerpo.replaceChildren(h('div', { class: 'pj-alert pj-alert-error', role: 'alert', text: 'We couldn\'t open this page. Please try again.' }));
      return;
    }
    /* Cada vez que se entra, un formulario nuevo. */
    estado = { dia: opcionesDia()[0][0], hora: '', tipo: 'doubles', lugar: '',
      gente: [{ player_id: yo.player_id, name: yo.name || 'You', role: 'host' }], yo: yo.player_id, n: 0 };
    paso1();
  }

  function paso1() {
    const cuerpo = $('lg-body');
    const err = h('div', { class: 'pj-alert pj-alert-error', role: 'alert', tabindex: '-1', hidden: true });
    const pintar = () => {
      const k = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
      const [min, max] = TAMANOS[estado.tipo];
      const hora = h('input', { class: 'gm-input', id: 'lg-time', type: 'time', step: '300', value: estado.hora, required: true });
      hora.addEventListener('input', () => { estado.hora = hora.value; err.hidden = true; });
      const lugar = h('input', { class: 'gm-input', id: 'lg-place', type: 'text', maxlength: '80', autocomplete: 'off', placeholder: 'Park or club (optional)', value: estado.lugar });
      lugar.addEventListener('input', () => { estado.lugar = lugar.value; err.hidden = true; });
      const lista = h('ul', { class: 'lg-people' }, ...estado.gente.map((p) => {
        const quitar = p.role === 'host' ? null : h('button', { type: 'button', class: 'gm-link gm-link-soft', text: 'Remove', 'aria-label': `Remove ${p.name}`, 'data-k': `lg-rm-${p.player_id}` });
        if (quitar) quitar.addEventListener('click', () => { estado.gente.splice(estado.gente.indexOf(p), 1); pintar(); $('lg-add-btn') && $('lg-add-btn').focus(); });
        return h('li', null,
          h('span', { class: `pl-av pl-av-sm${p.role === 'host' ? ' pl-av-lime' : ''}`, 'aria-hidden': 'true', text: UI().iniciales(p.name) }),
          h('span', { class: 'lg-people-n' }, h('b', { text: p.role === 'host' ? `You (${p.name})` : p.name }),
            p.role === 'added' ? h('small', { text: 'FEROCIA player · added with their code' }) : p.role === 'guest' ? h('small', { text: 'Not on FEROCIA' }) : null),
          p.role === 'guest' ? h('span', { class: 'lg-guest', text: 'Guest' }) : null, quitar);
      }));
      const lleno = estado.gente.length >= max;
      const anadir = h('button', { type: 'button', class: 'lg-add-player', id: 'lg-add-btn', text: '+ Add a player', disabled: lleno, 'data-k': 'lg-add' });
      anadir.addEventListener('click', async () => {
        const q = await P.ventanaJugador({ yaEstan: estado.gente.filter((p) => p.player_id > 0).map((p) => p.player_id) });
        if (!q) return;
        if (estado.gente.length >= max) return;
        if (q.role === 'guest') estado.gente.push({ player_id: -(++estado.n), name: q.name, role: 'guest' });
        else if (!estado.gente.some((p) => p.player_id === q.player_id)) estado.gente.push({ player_id: q.player_id, name: q.name, role: 'added' });
        err.hidden = true;
        pintar();
      });
      const siguiente = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block', text: estado.tipo === 'drill' ? 'Next: review and log' : 'Next: add the scores' });
      siguiente.addEventListener('click', () => {
        err.hidden = true;
        const fallo = cuandoValido(estado.dia, estado.hora);
        const mal = (t, foco) => { err.textContent = t; err.hidden = false; (foco || err).focus(); };
        if (fallo === 'time') return mal('Choose the time you started playing.', hora);
        if (fallo === 'future') return mal('That time hasn\'t happened yet. Log a game after you play it.', hora);
        if (fallo === 'old') return mal(UI().textoError({ message: 'too_old' }), hora);
        const l = estado.lugar.trim();
        if (l && (l.length < 3 || UI().conContacto(l))) return mal(l.length < 3 ? 'Write at least 3 characters for the place, or leave it empty.' : UI().textoError({ message: 'contact_info' }), lugar);
        if (estado.gente.length < min || estado.gente.length > max) return mal(`${AYUDA[estado.tipo]} Now: ${estado.gente.length}.`, anadir);
        paso2();
      });
      cuerpo.replaceChildren(h('section', { class: 'pj-panel gm-form lg-form', 'aria-label': 'Log a game you played' },
        h('p', { class: 'rs-intro', text: 'Played with friends without planning it here? Add who played and the scores. FEROCIA players get it to accept or decline, like any other game.' }),
        h('span', { class: 'lg-lbl', id: 'lg-l-when', text: 'When' }),
        seg('day', opcionesDia(), estado.dia, (v) => { estado.dia = v; err.hidden = true; pintar(); }),
        h('label', { class: 'gm-field', for: 'lg-time' }, h('span', { class: 'lg-lbl', text: 'Start time' }), hora),
        h('span', { class: 'lg-lbl', text: 'Type' }),
        seg('type', [['singles', 'Singles'], ['doubles', 'Doubles'], ['mixed', 'Mixed'], ['drill', 'Drill']], estado.tipo, (v) => { estado.tipo = v; err.hidden = true; pintar(); }),
        h('label', { class: 'gm-field', for: 'lg-place' }, h('span', { class: 'lg-lbl', text: 'Where (optional)' }), lugar),
        h('span', { class: 'lg-lbl', text: `Who played · ${estado.gente.length} of ${min}–${max}` }),
        lista, anadir,
        h('p', { class: 'gm-small gm-m0', text: lleno ? `That's the most for ${AYUDA[estado.tipo].split(':')[0]}.` : AYUDA[estado.tipo] }),
        (() => { const p = h('p', { class: 'rs-rule' }); p.append(UI().icono('reloj', 16), h('span', { text: 'You can log a game up to 3 days after you played it, and up to 3 logged games a day. Only add the people who played.' })); return p; })(),
        err, siguiente));
      if (k) { const el = cuerpo.querySelector(`[data-k="${k}"]`); if (el) el.focus({ preventScroll: true }); }
    };
    pintar();
  }

  /* "19:05" → "7:05 PM" */
  const hora12 = (t) => { const [hh, mm] = String(t).split(':').map(Number); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; };
  function paso2() {
    const cuerpo = $('lg-body');
    const j = { my_id: estado.yo, kind: estado.tipo };
    const form = P.resultadoFormulario(j, null, { log: {
      kind: estado.tipo,
      gente: estado.gente,
      volver: () => paso1(),
      enviar: async (d) => {
        const r = await UI().rpc('portal_juego_registrar', {
          p_kind: estado.tipo, p_day: estado.dia, p_time: estado.hora, p_place: estado.lugar.trim() || null,
          p_added: d.p_added, p_guests: d.p_guests, p_entries: d.p_entries,
        });
        P.aviso(r && r.status === 'self' ? 'Logged. It counts in your Play games as self-reported.'
          : 'Logged! The FEROCIA players get it to accept or decline. If no one declines in 48 hours, it\'s verified.');
        $('lg-body').replaceChildren();   // lo enviado no se queda escondido en la pantalla
        location.hash = `#/game/${r.id}`;
      },
    } });
    const resumen = h('div', { class: 'lg-summary' },
      h('b', { text: `${UI().TIPO[estado.tipo]} · ${(opcionesDia().find((x) => x[0] === estado.dia) || [, ''])[1]} · ${hora12(estado.hora)}` }),
      h('span', { text: estado.gente.map((p) => (p.role === 'host' ? 'You' : p.role === 'guest' ? `${p.name} (guest)` : p.name)).join(', ') }));
    cuerpo.replaceChildren(resumen, form);
    const t = form.querySelector('h2');
    if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }
  P.alEntrar('log-game', pintarLog);
})();
