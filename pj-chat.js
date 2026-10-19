/* ============================================================
   FEROCIA PLAYER PORTAL — Game chat (Matchmaking, etapa M-2b)
   15 de octubre — diseño aprobado (§75)

   El chat de un juego, dentro de su página (pj-games.js lo pide con
   P.chatPanel(juego)). Sólo para el anfitrión y los jugadores aceptados.
     · Se revisa cada 10 segundos mientras la página está abierta y a la
       vista (lo que ella eligió: sin "en vivo").
     · Sin teléfonos, correos, enlaces ni @usuarios (lo comprueba la base;
       aquí se avisa antes de enviar).
     · Cada mensaje de otro tiene "Report"; los propios, "Delete".
     · Líneas automáticas: entró, salió, cambió la hora, se canceló.
     · 24 horas después del juego (o si se cancela) queda de sólo lectura.
   Todo se pinta como TEXTO (h()), nunca HTML. Los únicos innerHTML son
   los iconos fijos (pj-games.js).
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { h } = P;
  const CADA = 10000;
  const MOTIVO = {
    weather: 'Weather', court: 'Court unavailable', host: 'Host unavailable', player: 'Player unavailable',
    not_enough: 'Not enough players', emergency: 'Emergency', other: 'Other',
  };

  let actual = null;          // { juego, caja, lista, ultimo, reloj, vez }

  function parar() {
    if (actual && actual.reloj) clearInterval(actual.reloj);
    actual = null;
  }
  P.chatParar = parar;
  /* Al salir de la página del juego, se deja de preguntar. */
  window.addEventListener('hashchange', () => { if (!/^#\/game\//.test(location.hash)) parar(); });

  const UI = () => P.juegosUI;

  /* "Today 9:41 AM", "Yesterday 6:12 PM" o "Oct 15, 9:41 AM". */
  function hora(iso) {
    const c = UI().cuando(iso);
    return c.dia === 'Today' ? c.hora : `${c.largo.replace(/^\w+, /, '')} · ${c.hora}`;
  }
  function lineaSistema(m) {
    const d = m.data || {};
    const quien = d.who || 'A player';
    switch (m.code) {
      case 'created': return `${quien} created the game`;
      case 'joined': return `${quien} joined`;
      case 'left': return `${quien} left`;
      case 'removed': return `${quien} is no longer in the game`;
      case 'changed': { const c = UI().cuando(d.plays_at); return `The host changed the game: ${c.largo} · ${c.hora}${d.place ? ` · ${d.place}` : ''}`; }
      case 'cancelled': return `The game was cancelled${d.reason && MOTIVO[d.reason] ? ` — ${MOTIVO[d.reason]}` : ''}`;
      default: return 'Update';
    }
  }

  function pintarMensaje(m) {
    if (m.kind === 'system') {
      return h('li', { class: 'ch-sys', 'data-id': m.id }, `${lineaSistema(m)} · ${hora(m.created_at)}`);
    }
    const a = m.author || {};
    const nombre = `${a.name || 'A player'}${a.host ? ' (host)' : ''}`;
    const meta = h('span', { class: 'ch-meta' }, hora(m.created_at));
    if (m.hidden) {
      return h('li', { class: 'ch-m is-deleted', 'data-id': m.id },
        h('div', { class: 'ch-b' }, h('span', { class: 'ch-t ch-t-del', text: "Hidden — you blocked this player" })));
    }
    if (!m.deleted) {
      const b = h('button', { type: 'button', class: 'ch-act', text: m.mine ? 'Delete' : 'Report',
        'aria-label': m.mine ? 'Delete your message' : `Report this message from ${a.name || 'this player'}` });
      b.addEventListener('click', () => (m.mine ? borrar(m) : reportarMensaje(m)));
      meta.append(' · ', b);
    }
    const burbuja = h('div', { class: 'ch-b' },
      m.mine ? null : h('span', { class: 'ch-n', text: nombre }),
      m.deleted ? h('span', { class: 'ch-t ch-t-del', text: 'Message deleted' }) : h('span', { class: 'ch-t', text: m.body }),
      meta);
    return h('li', { class: `ch-m${m.mine ? ' ch-m-mine' : ''}${m.deleted ? ' is-deleted' : ''}`, 'data-id': m.id },
      m.mine ? null : h('span', { class: 'pl-av pl-av-sm', 'aria-hidden': 'true',
        text: String(a.name || '?').replace(/\./g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('') }),
      burbuja);
  }

  async function borrar(m) {
    const ok = await UI().ventanaConfirmar({ titulo: 'Delete this message?', texto: 'Everyone in the chat will see "Message deleted".', boton: 'Delete', rojo: true });
    if (!ok) return;
    try {
      await UI().rpc('portal_chat_borrar', { p_message: m.id });
      recargar(false);
    } catch (e) { P.aviso(UI().textoError(e), true); }
  }
  async function reportarMensaje(m) {
    const a = m.author || {};
    const r = await UI().reportar({ player_id: a.player_id, name: a.name || 'this player' }, actual && actual.juego.id, { id: m.id, body: m.body });
    /* Si además lo bloqueó: sus mensajes se esconden (los dos siguen en el juego). */
    if (r && r.bloqueado) recargar(true);
  }

  /* Lee los mensajes (todos, o sólo los nuevos) y los pinta. */
  async function recargar(todo) {
    const yo = actual;
    if (!yo || document.hidden) return;
    const vez = ++yo.vez;
    let d;
    try {
      d = await UI().rpc('portal_chat', { p_game: yo.juego.id, p_after: todo ? null : yo.ultimo });
    } catch (e) {
      if (yo !== actual || vez !== yo.vez) return;
      if (/not_available|suspended/.test(String(e && e.message))) { parar(); yo.caja.replaceWith(h('p', { class: 'gm-small', text: "You're no longer in this chat." })); }
      return;
    }
    if (yo !== actual || vez !== yo.vez) return;
    const abajo = yo.lista.scrollHeight - yo.lista.scrollTop - yo.lista.clientHeight < 60;
    if (todo) yo.lista.replaceChildren();
    let cambioJuego = false;
    (d.messages || []).forEach((m) => {
      const viejo = yo.lista.querySelector(`[data-id="${m.id}"]`);
      if (viejo) viejo.replaceWith(pintarMensaje(m)); else yo.lista.append(pintarMensaje(m));
      /* §103: llegó ahora la línea "se canceló" o "cambió la hora": la parte de
         arriba del juego (título, botones, el bloque rojo) se vuelve a pintar. */
      if (!todo && !viejo && m.kind === 'system' && (m.code === 'cancelled' || m.code === 'changed')) cambioJuego = true;
    });
    if (cambioJuego && P.recargarJuego) setTimeout(() => P.recargarJuego(), 0);
    /* Los que alguien borró después: sólo se cambia ese mensaje. */
    (d.deleted_ids || []).forEach((id) => {
      const el = yo.lista.querySelector(`.ch-m[data-id="${Number(id)}"]`);
      if (el && !el.classList.contains('is-deleted')) {
        const t = el.querySelector('.ch-t');
        if (t) { t.textContent = 'Message deleted'; t.classList.add('ch-t-del'); }
        const b = el.querySelector('.ch-act');
        if (b && b.previousSibling) b.previousSibling.remove();
        if (b) b.remove();
        el.classList.add('is-deleted');
      }
    });
    if (d.last_id) yo.ultimo = d.last_id;
    /* Si llegaron más de 200 juntos, se piden los siguientes enseguida. */
    if (d.more) setTimeout(() => { if (actual === yo) recargar(false); }, 0);
    /* "No messages yet" mientras sólo haya líneas automáticas. */
    yo.vacio.hidden = !!yo.lista.querySelector('.ch-m');
    yo.gente.textContent = `Only the ${d.people || ''} players in this game`.replace('the 1 players', 'the players');
    pintarCierre(yo, d.open);
    if (todo || abajo || (d.messages || []).some((m) => m.mine)) yo.lista.scrollTop = yo.lista.scrollHeight;
    /* Leído: la campanita se pone al día (la primera vez, y si llegó algo). */
    if ((todo || (d.messages || []).length) && P.avisosRecargar) P.avisosRecargar();
  }

  function pintarCierre(yo, abierto) {
    yo.form.hidden = !abierto;
    yo.cerrado.hidden = !!abierto;
    if (!abierto && yo.reloj) { clearInterval(yo.reloj); yo.reloj = null; }
  }

  async function enviar(yo) {
    const t = yo.texto.value.trim();
    yo.error.hidden = true;
    yo.texto.removeAttribute('aria-invalid');
    if (!t) return;
    if (UI().conContacto(t)) {
      yo.error.textContent = "Phone numbers, emails, links and @usernames can't be shared in the chat — you'll meet at the court.";
      yo.error.hidden = false;
      yo.texto.setAttribute('aria-invalid', 'true');
      return;
    }
    yo.boton.disabled = true;
    try {
      await UI().rpc('portal_chat_enviar', { p_game: yo.juego.id, p_body: t });
      yo.texto.value = '';
      borradores.delete(yo.juego.id);
      contar(yo);
      await recargar(false);
    } catch (e) {
      const m = String(e && e.message);
      yo.error.textContent = /contact_info/.test(m)
        ? "Phone numbers, emails, links and @usernames can't be shared in the chat — you'll meet at the court." : UI().textoError(e);
      yo.error.hidden = false;
      if (/chat_closed/.test(m)) pintarCierre(yo, false);
    } finally {
      yo.boton.disabled = false;
      yo.texto.focus();
    }
  }
  function contar(yo) {
    const n = 500 - yo.texto.value.length;
    yo.cuenta.textContent = n < 100 ? `${n} characters left` : '';
  }

  /* §103: lo que alguien está escribiendo, por juego. Si la pantalla del juego
     se vuelve a pintar (el juego cambió, o se volvió al portal), el chat nuevo
     lo recupera, y también el cursor si estaba escribiendo. */
  const borradores = new Map();
  let focoEn = null;

  /* El panel del chat para la página del juego. */
  P.chatPanel = function (juego) {
    parar();
    const lista = h('ol', { class: 'ch-list', role: 'log', 'aria-live': 'polite', 'aria-label': 'Messages' });
    const vacio = h('p', { class: 'gm-small gm-m0', text: 'No messages yet. Say hi and agree on the details here.', hidden: true });
    const gente = h('span', { class: 'gm-small' });
    const texto = h('textarea', { class: 'gm-textarea ch-input', id: 'ch-text', maxlength: '500', rows: '2', placeholder: 'Write a message…' });
    const boton = h('button', { type: 'submit', class: 'ch-send', 'aria-label': 'Send message' });
    boton.append(UI().icono('enviar', 18));
    const error = h('p', { class: 'ch-err', role: 'alert', hidden: true });
    const cuenta = h('span', { class: 'gm-small ch-count' });
    const form = h('form', { class: 'ch-compose', novalidate: true },
      h('label', { class: 'pj-sr', for: 'ch-text', text: 'Message' }), texto, boton);
    const cerrado = h('p', { class: 'ch-closed', text: 'This chat is closed. Messages are deleted 30 days after the game.', hidden: true });
    const caja = h('section', { class: 'pj-panel ch-panel', 'aria-label': 'Game chat' },
      h('div', { class: 'pj-panel-head' }, h('h2', { class: 'pj-panel-title', text: 'Game chat' }), gente),
      lista, vacio, form, error, cuenta, cerrado,
      h('p', { class: 'gm-small gm-m0', text: 'Be kind — the community rules apply here too. Messages are deleted 30 days after the game.' }));
    const yo = { juego, caja, lista, vacio, gente, texto, boton, error, cuenta, form, cerrado, ultimo: null, reloj: null, vez: 0 };
    actual = yo;
    form.addEventListener('submit', (ev) => { ev.preventDefault(); enviar(yo); });
    /* Enter envía; Mayúsculas + Enter, salto de línea. */
    texto.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); enviar(yo); }
    });
    texto.addEventListener('input', () => { contar(yo); yo.error.hidden = true; texto.removeAttribute('aria-invalid'); borradores.set(juego.id, texto.value); });
    texto.addEventListener('focus', () => { focoEn = juego.id; });
    /* Si se quita porque la pantalla se vuelve a pintar, no cuenta como "dejó de escribir". */
    texto.addEventListener('blur', () => { setTimeout(() => { if (texto.isConnected) focoEn = null; }, 0); });
    if (borradores.get(juego.id)) { texto.value = borradores.get(juego.id); contar(yo); }
    if (focoEn === juego.id) setTimeout(() => { if (texto.isConnected && !texto.disabled) texto.focus(); }, 0);
    pintarCierre(yo, juego.status === 'active' || juego.status === 'past');
    recargar(true);
    yo.reloj = setInterval(() => { if (actual === yo) recargar(false); }, CADA);
    return caja;
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && actual) recargar(false); });
})();
