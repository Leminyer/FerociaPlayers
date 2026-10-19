/* ============================================================
   FEROCIA PLAYER PORTAL — el cartel del aviso que se tocó (§103)
   ------------------------------------------------------------
   Cuando alguien toca un push, el portal se abre con
   "?aviso=<tipo>" (lo pone player-push; sw.js sólo deja letras y "_").
   Este archivo:
     1. Lee ese tipo y lo QUITA de la dirección enseguida (si la
        persona recarga, el cartel no vuelve a salir).
     2. En la primera pantalla de la app que se abre, enseña arriba un
        cartel grande con el mismo título del push y el texto de la
        campanita (rojo: malas noticias; verde: buenas; azul: el resto).
     3. Marca como leído ESE aviso en la campanita (SQL 116).
     4. Se quita con "Got it" o al ir a otra pantalla.
   Todo se pinta como TEXTO (h()), nunca HTML.
   ============================================================ */
(function () {
  'use strict';
  const P = window.FerociaPortal;
  if (!P) return;
  const { h } = P;

  /* Los títulos: los mismos del push (player-push/textos.ts). */
  const TITULO = {
    request_received: 'Request to join', request_accepted: "You're in!", request_declined: 'Request not accepted',
    invited: "You're invited", invite_accepted: 'Invitation accepted', invite_declined: 'Invitation declined',
    player_left: 'A player left', removed: 'Game update', game_changed: 'Game changed', game_cancelled: 'Game cancelled',
    reminder: 'Game reminder', result_due: 'How did it go?', result_reported: 'Check your result', result_linked: 'Is it you?',
    link_accepted: 'Result confirmed', link_declined: 'Result update', result_declined: 'Result declined',
    result_disputed: 'Result in review', result_verified: 'Result verified', result_discarded: 'Result discarded',
    chat: 'New messages', test: 'Notifications are on',
  };
  const ROJO = ['game_cancelled', 'removed', 'request_declined', 'result_declined', 'result_discarded', 'link_declined'];
  const VERDE = ['request_accepted', 'invite_accepted', 'result_verified', 'link_accepted'];
  /* Si el aviso ya no está en la campanita (o falla la red): un texto corto. */
  const SIN_DATOS = {
    test: 'This device will get FEROCIA notifications.',
    chat: 'You have new messages in your game chat.',
  };
  const ICONO = {
    rojo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    verde: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    azul: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  };
  const color = (k) => (ROJO.includes(k) ? 'rojo' : VERDE.includes(k) ? 'verde' : 'azul');

  /* ── 1. Leer el aviso de la dirección y quitarlo ── */
  let pendiente = null;
  try {
    const q = new URLSearchParams(location.search);
    const k = q.get('aviso');
    if (k && /^[a-z_]{1,30}$/.test(k)) {
      const m = /^#\/game\/(\d{1,18})$/.exec(location.hash || '');
      pendiente = { kind: k, game: m ? Number(m[1]) : null, hora: Date.now() };
    }
    if (q.has('aviso') || q.has('t')) history.replaceState(null, '', location.pathname + location.hash);
  } catch (e) { pendiente = null; }

  const caja = document.getElementById('pj-aviso');
  let enseñadoEn = '';

  function quitar() {
    if (!caja) return;
    caja.hidden = true;
    caja.replaceChildren();
    enseñadoEn = '';
  }

  /* El aviso de la campanita que corresponde: el más nuevo de ese tipo
     (y de ese juego), primero los que no se han leído. */
  function buscar(items, p) {
    const delTipo = (items || []).filter((it) => it.kind === p.kind && (p.game == null || Number(it.game_id) === p.game));
    return delTipo.find((it) => !it.read) || delTipo[0] || null;
  }

  async function enseñar(p) {
    if (!caja) return;
    const aqui = location.hash;
    let item = null;
    try { item = buscar((await P.avisosDatos()).items, p); } catch (e) { item = null; }
    if (location.hash !== aqui) return;     // se fue a otra pantalla mientras cargaba
    const col = color(p.kind);
    const texto = item && P.textoAviso ? P.textoAviso(item)
      : [SIN_DATOS[p.kind] || 'You have an update about a game.'];
    const ok = h('button', { type: 'button', class: 'pa-ok', text: 'Got it' });
    ok.addEventListener('click', quitar);
    const ico = h('span', { class: 'pa-ico' });
    ico.innerHTML = ICONO[col];            // un dibujo fijo de este archivo, nunca datos
    const tarjeta = h('div', { class: `pa-card pa-${col}`, role: 'alert', tabindex: '-1' },
      ico,
      h('div', { class: 'pa-cuerpo' },
        h('p', { class: 'pa-t', text: TITULO[p.kind] || 'FEROCIA' }),
        h('p', { class: 'pa-x' }, ...texto),
        h('div', { class: 'pa-acts' }, ok)));
    caja.replaceChildren(tarjeta);
    caja.hidden = false;
    enseñadoEn = aqui;
    window.scrollTo(0, 0);
    /* Ya lo vio: ese aviso (y sólo ése) queda leído en la campanita. */
    if (item && !item.read && P.juegosUI && P.juegosUI.rpc) {
      try {
        await P.juegosUI.rpc('portal_aviso_leido', { p_id: item.id });
        if (P.recargarAvisos) P.recargarAvisos();
      } catch (e) { /* sin el SQL 116: la campanita sigue como estaba */ }
    }
  }

  /* ── 2. En la primera pantalla de la app que se abre ── */
  const PANTALLAS = ['home', 'profile', 'dna', 'play', 'player', 'game', 'game-form', 'log-game', 'settings', 'help', 'edit', 'dna-edit', 'welcome'];
  PANTALLAS.forEach((n) => P.alEntrar(n, () => {
    if (!pendiente) return;
    const p = pendiente;
    pendiente = null;
    if (Date.now() - p.hora > 10 * 60000) return;   // si entró mucho después (p. ej. tuvo que volver a iniciar sesión)
    enseñar(p);
  }));

  /* ── 3. Al ir a otra pantalla, el cartel se va ── */
  window.addEventListener('hashchange', () => { if (enseñadoEn && location.hash !== enseñadoEn) quitar(); });

  /* Para las pruebas. */
  P.avisoCartel = { color, TITULO };
})();
