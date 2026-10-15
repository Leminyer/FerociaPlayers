/* ============================================================
   FEROCIA PLAYER PORTAL — Games (Matchmaking, etapa M-2a)
   15 de octubre — diseño aprobado (§73, §74)

   Lo que hace este archivo:
     · Play: "Your games" (el que organizas y en los que juegas) y
       "Open games for you" (juegos abiertos de tu nivel).
     · game-form (#/game-form o #/game-form/<n>): crear o editar un juego.
     · game (#/game/<n>): la página del juego. El anfitrión acepta o
       rechaza solicitudes, invita, saca a alguien, edita o cancela; el
       jugador pide unirse, acepta una invitación o se sale. El aviso de
       seguridad sale una vez al entrar en un juego.
     · La campanita de la barra de arriba (los avisos de juegos).
     · La tarjeta del jugador: "Invite to play", Report y Block.
     · Account: los correos de juegos y los jugadores bloqueados.
   La base decide todo (quién ve qué, los límites, los bloqueos): aquí
   sólo se pinta, siempre como TEXTO (h()), nunca HTML. Los únicos
   innerHTML son los iconos fijos de este archivo.
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { sb, h } = P;
  const $ = (id) => document.getElementById(id);

  /* ── Iconos fijos ── */
  const SVG = (d, w = 15) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONOS = {
    lugar: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    gente: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M17 4a4 4 0 0 1 0 8"/><path d="M22 21c0-3-2-5-4-5.5"/>',
    nivel: '<path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 6-6"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    escudo: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    bandera: '<path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
  };
  function icono(nombre, w) {
    const s = h('span');
    s.innerHTML = SVG(ICONOS[nombre], w);   // icono fijo de este archivo (sin datos)
    return s.firstChild;
  }
  const conIcono = (nombre, texto, tag = 'span', props = null) => { const e = h(tag, props); e.append(icono(nombre), document.createTextNode(texto)); return e; };

  /* ── Textos ── */
  const TIPO = { singles: 'Singles', doubles: 'Doubles', mixed: 'Mixed doubles', drill: 'Drill / practice' };
  const MOTIVO = {
    weather: 'Weather', court: 'Court unavailable', host: 'Host unavailable', player: 'Player unavailable',
    not_enough: 'Not enough players', emergency: 'Emergency', other: 'Other',
  };
  const MOTIVOS_SALIR = ['weather', 'court', 'player', 'emergency', 'other'];
  const MOTIVOS_CANCELAR = ['weather', 'court', 'host', 'player', 'not_enough', 'emergency', 'other'];
  const REPORTE = [['no_show', "Didn't show up"], ['rude', 'Rude or disrespectful'], ['harassment', 'Harassment or unwanted contact'],
    ['unsafe', 'Unsafe play'], ['selling', 'Selling or promoting something'], ['fake', 'Fake profile'], ['other', 'Something else']];
  const nombreDe = (x) => (x && x.name) || 'A player';
  const iniciales = (nombre) => String(nombre || '?').replace(/\./g, '').split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase()).join('') || '?';
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const niveles = (l) => (l || []).join(', ');

  const ERRORES = {
    already_hosting: 'You already have an active game. Open it from Play — you can host one game at a time.',
    invalid_time: 'Choose a time at least 30 minutes from now.',
    too_far: 'Games can be up to 14 days ahead.',
    invalid_kind: 'Choose the type of game.',
    invalid_needed: 'Choose how many players you need (singles is always 1).',
    invalid_levels: 'Choose at least one level.',
    invalid_visibility: 'Choose who can see your game.',
    invalid_place: 'Tell players where you will play (3 to 80 characters).',
    invalid_notes: 'Notes can be up to 280 characters.',
    contact_info: "Please remove phone numbers, emails, links or @usernames — you'll meet at the court.",
    too_few_spots: 'More players already joined than that. Keep more spots, or remove someone first.',
    game_closed: "This game can't be changed anymore.",
    game_full: 'This game is already full.',
    already_in: "You're already in this game (or your request is waiting).",
    too_many_requests: 'You have 3 requests waiting. Withdraw one, or wait for a host to answer.',
    too_many_games: 'You created 3 games in the last 24 hours. Please try again tomorrow.',
    invite_limit: 'You used your 8 invitations for this game.',
    invalid_reason: 'Choose a reason.',
    detail_required: 'Tell us a little more in "Other".',
    invalid_detail: 'Keep the details short, without phone numbers, emails or links.',
    too_many_reports: "You've sent many reports today. Please write to us from Help.",
    not_available: "This game isn't available.",
    hidden_caller: 'Your privacy is Private, so you can\'t use games. Switch to Limited in My Identity (Who can find you).',
    suspended: 'Your access to Play and games is paused.',
    members_only: 'Games are for FEROCIA members.',
  };
  const textoError = (err) => P.errorTexto(err, ERRORES);

  /* ── Fechas: siempre en la hora del club (Boca Raton) ── */
  const TZ = 'America/New_York';
  const formato = (opts) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts });
  const F_DIA = formato({ weekday: 'short', month: 'short', day: 'numeric' });
  const F_HORA = formato({ hour: 'numeric', minute: '2-digit' });
  const F_MES = formato({ month: 'short' });
  const F_NUM = formato({ day: 'numeric' });
  function diaNY(d) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  function horaNY(d) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.hour}:${p.minute}`;
  }
  function sumarDias(ymd, n) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }
  function cuando(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { dia: '', largo: '', hora: '', mes: '', num: '' };
    const dia = diaNY(d), hoy = diaNY(new Date());
    const largo = F_DIA.format(d);
    return {
      dia: dia === hoy ? 'Today' : dia === sumarDias(hoy, 1) ? 'Tomorrow' : largo,
      largo, hora: F_HORA.format(d), mes: F_MES.format(d), num: F_NUM.format(d),
    };
  }
  function haceCuanto(iso) {
    const d = new Date(iso);
    const min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min} min ago`;
    if (min < 24 * 60) return `${Math.round(min / 60)} h ago`;
    if (diaNY(d) === sumarDias(diaNY(new Date()), -1)) return 'Yesterday';
    return formato({ month: 'short', day: 'numeric' }).format(d);
  }

  /* ── Llamar a la base ── */
  async function rpc(fn, args) {
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) throw error;
    return data;
  }

  /* ============================================================
     VENTANAS (seguridad, motivos, reportar, confirmar)
     ============================================================ */
  let ventanaAbierta = null;
  function ventana(construir) {
    if (ventanaAbierta) ventanaAbierta.cerrar(null);
    return new Promise((resolver) => {
      const antes = document.activeElement;
      const idT = `gm-v-${Date.now()}`;
      const caja = h('div', { class: 'gm-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idT });
      const velo = h('div', { class: 'gm-veil' }, caja);
      let hecho = false;
      const cerrar = (valor) => {
        if (hecho) return;
        hecho = true;
        velo.remove();
        document.body.classList.remove('gm-con-ventana');
        document.removeEventListener('keydown', teclas, true);
        ventanaAbierta = null;
        if (antes && typeof antes.focus === 'function' && document.contains(antes)) antes.focus({ preventScroll: true });
        resolver(valor);
      };
      function teclas(ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); cerrar(null); return; }
        if (ev.key !== 'Tab') return;
        const f = [...caja.querySelectorAll('button, [href], input, textarea, select')].filter((x) => !x.disabled && x.offsetParent !== null);
        if (!f.length) return;
        if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
        else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
      }
      velo.addEventListener('mousedown', (ev) => { if (ev.target === velo) cerrar(null); });
      const foco = construir(caja, cerrar, idT);
      document.body.append(velo);
      document.body.classList.add('gm-con-ventana');
      document.addEventListener('keydown', teclas, true);
      ventanaAbierta = { cerrar };
      (foco || caja.querySelector('button, input, textarea')).focus();
    });
  }

  /* Un grupo de opciones (una sola) como etiquetas con su radio escondido. */
  function opciones(nombre, lista, clase) {
    const caja = h('div', { class: 'gm-opts', role: 'radiogroup' });
    lista.forEach(([valor, texto]) => caja.append(
      h('label', { class: clase || 'gm-opt' }, h('input', { class: 'pj-sr', type: 'radio', name: nombre, value: valor }), texto)));
    caja.addEventListener('change', () => caja.querySelectorAll('label').forEach((l) => l.classList.toggle('is-on', l.querySelector('input').checked)));
    return caja;
  }
  const elegido = (caja) => { const i = caja.querySelector('input:checked'); return i ? i.value : null; };

  /* Cancelar el juego (anfitrión) o salirse (jugador): con su motivo. */
  function ventanaMotivo({ titulo, texto, motivos, boton, quedarse }) {
    return ventana((caja, cerrar, idT) => {
      const ops = opciones('gm-motivo', motivos.map((m) => [m, MOTIVO[m]]));
      const detalle = h('textarea', { class: 'gm-textarea', maxlength: '200', rows: '2', placeholder: 'Anything else? (optional)', 'aria-label': 'Details' });
      const err = h('div', { class: 'pj-alert pj-alert-error', role: 'alert', hidden: true });
      const si = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block gm-btn-danger', text: boton });
      const no = h('button', { type: 'button', class: 'gm-btn-quiet', text: quedarse });
      ops.addEventListener('change', () => { detalle.placeholder = elegido(ops) === 'other' ? 'Tell us what happened (required)' : 'Anything else? (optional)'; });
      si.addEventListener('click', () => {
        const m = elegido(ops);
        const d = detalle.value.trim();
        if (!m) { err.textContent = 'Choose a reason.'; err.hidden = false; return; }
        if (m === 'other' && !d) { err.textContent = 'Tell us a little more.'; err.hidden = false; detalle.focus(); return; }
        cerrar({ motivo: m, detalle: d || null });
      });
      no.addEventListener('click', () => cerrar(null));
      caja.append(h('h2', { id: idT, text: titulo }), h('p', { class: 'pj-small gm-m0', text: texto }), ops, detalle, err, si, no);
      return ops.querySelector('input');
    });
  }

  /* Confirmar algo (quitar a alguien, bloquear). */
  function ventanaConfirmar({ titulo, texto, boton, rojo }) {
    return ventana((caja, cerrar, idT) => {
      const si = h('button', { type: 'button', class: `pj-btn pj-btn-primary pj-btn-block${rojo ? ' gm-btn-danger' : ''}`, text: boton });
      const no = h('button', { type: 'button', class: 'gm-btn-quiet', text: 'Cancel' });
      si.addEventListener('click', () => cerrar(true));
      no.addEventListener('click', () => cerrar(null));
      caja.append(h('h2', { id: idT, text: titulo }), h('p', { class: 'pj-small gm-m0', text: texto }), si, no);
      return no;
    });
  }

  /* Reportar a un jugador (y, si quiere, bloquearlo). */
  function reportar(persona, juegoId) {
    const quien = nombreDe(persona);
    const nombreCorto = quien.split(' ')[0];
    return ventana((caja, cerrar, idT) => {
      const ops = opciones('gm-reporte', REPORTE);
      const detalle = h('textarea', { class: 'gm-textarea', maxlength: '1000', rows: '3', placeholder: 'What happened? (optional)', 'aria-label': 'What happened' });
      const bloquear = h('input', { class: 'pj-sr', type: 'checkbox' });
      const check = h('label', { class: 'gm-check gm-check-red' }, bloquear,
        h('span', { class: 'gm-box', 'aria-hidden': 'true' }, icono('check', 14)),
        h('span', null, `Also block ${nombreCorto}`, h('small', { text: "You won't see each other in Play or in games." })));
      bloquear.addEventListener('change', () => check.classList.toggle('is-on', bloquear.checked));
      const err = h('div', { class: 'pj-alert pj-alert-error', role: 'alert', hidden: true });
      const si = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block gm-btn-danger', text: 'Send report' });
      const no = h('button', { type: 'button', class: 'gm-btn-quiet', text: 'Cancel' });
      si.addEventListener('click', async () => {
        const motivo = elegido(ops);
        if (!motivo) { err.textContent = 'Choose what happened.'; err.hidden = false; return; }
        si.disabled = true;
        try {
          await rpc('portal_reportar', { p_player: persona.player_id, p_game: juegoId || null, p_reason: motivo,
            p_detail: detalle.value.trim() || null, p_block: bloquear.checked });
          cerrar({ bloqueado: bloquear.checked });
        } catch (e) {
          err.textContent = textoError(e);
          err.hidden = false;
          si.disabled = false;
        }
      });
      no.addEventListener('click', () => cerrar(null));
      caja.append(
        h('span', { class: 'gm-modal-ico gm-modal-ico-red', 'aria-hidden': 'true' }, icono('bandera', 24)),
        h('h2', { id: idT, text: `Report ${quien}` }),
        h('p', { class: 'pj-small gm-m0', text: `Only the FEROCIA team sees reports. ${nombreCorto} won't know who reported.` }),
        ops, detalle, check, err, si, no,
        h('p', { class: 'gm-small gm-center gm-m0', text: 'In an emergency, call 911 first.' }));
      return ops.querySelector('input');
    }).then((r) => {
      if (r) P.aviso(r.bloqueado ? `Thanks for telling us. ${nombreCorto} is blocked, and our team will review your report.` : 'Thanks for telling us. Our team will review your report.');
      return r;
    });
  }

  async function bloquear(persona) {
    const quien = nombreDe(persona);
    const ok = await ventanaConfirmar({
      titulo: `Block ${quien}?`,
      texto: `You won't see each other in Play or in games, and any pending request or invitation between you is withdrawn. ${quien.split(' ')[0]} isn't told. You can unblock in Account.`,
      boton: 'Block', rojo: true,
    });
    if (!ok) return false;
    try {
      await rpc('portal_bloquear', { p_player: persona.player_id });
      P.aviso(`${quien} is blocked.`);
      return true;
    } catch (e) { P.aviso(textoError(e), true); return false; }
  }

  /* El recordatorio de seguridad: una vez al entrar en cada juego. */
  function ventanaSeguridad(j) {
    return ventana((caja, cerrar, idT) => {
      const c = cuando(j.plays_at);
      const ok = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block', text: 'I understand — see the game' });
      ok.addEventListener('click', () => cerrar(true));
      const punto = (t) => { const li = h('li'); li.append(icono('check', 16), document.createTextNode(t)); return li; };
      const reportarLi = h('li');
      reportarLi.append(icono('check', 16), h('span', null, 'Something wrong? Use ', h('b', { text: 'Report' }), ' on the game or player card. You can also block anyone.'));
      const terms = h('a', { href: 'https://ferociasports.com/terms.html#risk', target: '_blank', rel: 'noopener', text: 'Terms of Use' });
      caja.append(
        h('span', { class: 'gm-modal-ico', 'aria-hidden': 'true' }, icono('escudo', 26)),
        h('h2', { id: idT, text: 'Before you play' }),
        h('p', { class: 'pj-small gm-m0' }, "You're in! ", h('b', { text: `${TIPO[j.kind] || 'Game'} · ${c.largo} · ${c.hora}` }), '. A few reminders:'),
        h('ul', null,
          punto('Meet at the court — keep it to public places.'),
          punto("FEROCIA doesn't verify identities or run background checks on players."),
          punto("Tell a friend where you're going, and trust your instincts."),
          punto('Never share money, passwords or personal documents.'),
          reportarLi),
        ok,
        h('p', { class: 'gm-small gm-center gm-m0' }, 'Playing is a physical activity at your own risk. ', terms));
      return ok;
    });
  }

  /* ============================================================
     PLAY: TUS JUEGOS Y LOS JUEGOS ABIERTOS
     ============================================================ */
  function filaMia(j) {
    const c = cuando(j.plays_at);
    const pill = { accepted: ["You're in", 'gm-pill-ok'], requested: ['Request sent', 'gm-pill-wait'], invited: ["You're invited", 'gm-pill-inv'] }[j.my_status]
      || ['', ''];
    return h('a', { class: 'gm-joined-row', href: `#/game/${j.id}` },
      h('span', { class: 'gm-date', 'aria-hidden': 'true' }, h('small', { text: c.mes }), h('b', { text: c.num })),
      h('span', { class: 'gm-who' }, h('b', { text: `${TIPO[j.kind] || 'Game'} · ${c.dia} · ${c.hora}` }),
        h('span', { text: `Hosted by ${nombreDe(j.host)} · ${j.place}` })),
      pill[0] ? h('span', { class: `gm-pill ${pill[1]}`, text: pill[0] }) : null);
  }
  function tarjetaAnfitrion(j) {
    const c = cuando(j.plays_at);
    const pend = j.pending || 0;
    return h('article', { class: 'gm-host' },
      h('div', { class: 'gm-k', text: "You're hosting" }),
      h('div', { class: 'gm-host-t', text: `${TIPO[j.kind] || 'Game'} · ${c.dia} · ${c.hora}` }),
      h('div', { class: 'gm-host-s' },
        conIcono('lugar', j.place),
        conIcono('gente', `${(j.taken || 0) + 1} of ${j.needed + 1} players`),
        conIcono('nivel', niveles(j.levels))),
      h('div', { class: 'gm-host-f' },
        pend ? h('span', { class: 'gm-req', text: `${plural(pend, 'request', 'requests')} waiting` })
          : h('span', { class: 'gm-req gm-req-0', text: j.visibility === 'invite' ? 'Invite only' : 'Open to compatible players' }),
        h('a', { class: 'gm-btn-lime', href: `#/game/${j.id}`, text: 'Open game' })));
  }
  function puestos(j) {
    const caja = h('span', { class: 'gm-spots', 'aria-label': `${(j.taken || 0) + 1} of ${j.needed + 1} spots taken` });
    caja.append(h('span', { class: 'gm-spot', 'aria-hidden': 'true', text: iniciales(nombreDe(j.host)) }));
    (j.players || []).forEach((p) => caja.append(h('span', { class: 'gm-spot', 'aria-hidden': 'true', text: iniciales(p.name) })));
    for (let i = j.taken || 0; i < j.needed; i++) caja.append(h('span', { class: 'gm-spot gm-spot-free', 'aria-hidden': 'true', text: '+' }));
    return caja;
  }
  function tarjetaAbierta(j, alPedir) {
    const c = cuando(j.plays_at);
    const pedir = h('button', { type: 'button', class: 'gm-btn-dark', text: 'Request to join',
      'aria-label': `Request to join ${nombreDe(j.host)}'s ${TIPO[j.kind] || 'game'} on ${c.largo}` });
    pedir.addEventListener('click', () => alPedir(j, pedir));
    return h('article', { class: 'gm-card' },
      h('div', { class: 'gm-card-top' },
        h('span', { class: 'pl-av pl-av-sm', 'aria-hidden': 'true', text: iniciales(nombreDe(j.host)) }),
        h('span', { class: 'pl-who' },
          h('a', { class: 'gm-type', href: `#/game/${j.id}`, text: TIPO[j.kind] || 'Game' }),
          h('span', { class: 'gm-when', text: `${c.dia} · ${c.hora}` }))),
      h('ul', { class: 'gm-meta' },
        conIcono('lugar', j.place, 'li'), conIcono('nivel', niveles(j.levels), 'li'), conIcono('gente', `Hosted by ${nombreDe(j.host)}`, 'li')),
      j.notes ? h('p', { class: 'gm-card-notes', text: j.notes }) : null,
      h('div', { class: 'pl-card-foot' }, puestos(j), pedir));
  }

  let vezPlay = 0;
  async function pintarJuegosPlay() {
    const mia = ++vezPlay;
    $('gm-error').hidden = true;
    let d;
    try { d = await rpc('portal_juegos'); } catch (e) {
      if (mia !== vezPlay) return;
      console.warn('[portal] juegos:', e);
      ['gm-mine-sec', 'gm-open-sec', 'gm-create'].forEach((id) => { $(id).hidden = true; });
      /* Si el SQL 97 todavía no está, Play sigue como antes (sin aviso). */
      if (!/portal_juegos|function|schema cache/i.test(String(e && e.message))) { $('gm-error').textContent = textoError(e); $('gm-error').hidden = false; }
      return;
    }
    if (mia !== vezPlay) return;
    d = d || {};
    if (d.locked) { ['gm-mine-sec', 'gm-open-sec', 'gm-create'].forEach((id) => { $(id).hidden = true; }); return; }
    $('gm-create').hidden = !!d.hosting;

    const jugando = d.playing || [];
    const mias = [];
    if (d.hosting) mias.push(tarjetaAnfitrion(d.hosting));
    if (jugando.length) {
      mias.push(h('div', { class: 'gm-joined' }, h('div', { class: 'gm-k gm-k-blue', text: 'Your other games' }), ...jugando.map(filaMia)));
      if (!d.hosting) mias[0].firstChild.textContent = "You're playing";
    }
    $('gm-mine').replaceChildren(...mias);
    $('gm-mine').classList.toggle('gm-mine-1', mias.length === 1);
    $('gm-mine-sec').hidden = !mias.length;

    const abiertos = d.open || [];
    $('gm-open').replaceChildren(...abiertos.map((j) => tarjetaAbierta(j, pedirDesdePlay)));
    $('gm-open').hidden = !abiertos.length;
    $('gm-open-empty').hidden = !!abiertos.length;
    $('gm-open-sec').hidden = false;
  }
  async function pedirDesdePlay(j, boton) {
    boton.disabled = true;
    try {
      await rpc('portal_juego_pedir', { p_game: j.id });
      P.aviso(`Request sent. ${nombreDe(j.host).split(' ')[0]} will accept or decline — we'll let you know.`);
      pintarJuegosPlay();
    } catch (e) { boton.disabled = false; P.aviso(textoError(e), true); }
  }
  P.alEntrar('play', pintarJuegosPlay);

  /* ============================================================
     CREAR / EDITAR UN JUEGO
     ============================================================ */
  const form = $('gf-form');
  const radios = (nombre) => [...form.querySelectorAll(`input[name="${nombre}"]`)];
  const valorRadio = (nombre) => { const i = radios(nombre).find((x) => x.checked); return i ? i.value : null; };
  function marcar(nombre, valores) {
    const v = [].concat(valores).map(String);
    radios(nombre).forEach((i) => { i.checked = v.includes(i.value); });
  }
  /* Pinta lo elegido (como My DNA): la etiqueta con is-on; en singles,
     sólo 1 jugador. */
  function repasarForm() {
    form.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach((i) => {
      const l = i.closest('label');
      if (l) l.classList.toggle('is-on', i.checked);
    });
    const singles = valorRadio('gf-kind') === 'singles';
    radios('gf-needed').forEach((i) => {
      i.disabled = singles && i.value !== '1';
      if (i.disabled) i.checked = false;
      i.closest('label').classList.toggle('is-off', i.disabled);
    });
    if (singles) marcar('gf-needed', '1');
    form.querySelectorAll('input[name="gf-needed"]').forEach((i) => i.closest('label').classList.toggle('is-on', i.checked));
    $('gf-notes-n').textContent = String(280 - $('gf-notes').value.length);
  }
  form.addEventListener('change', (ev) => {
    if (ev.target.name === 'gf-kind') {
      /* Al cambiar de tipo se propone lo normal: 1 en singles, 3 en dobles. */
      const k = ev.target.value;
      if (k === 'doubles' || k === 'mixed') marcar('gf-needed', '3');
    }
    repasarForm();
  });
  $('gf-notes').addEventListener('input', repasarForm);

  /* Lo mismo que comprueba la base, para avisar antes de enviar. */
  const conContacto = (t) => /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(t) || /(https?:\/\/|www\.)/i.test(t)
    || /\b[a-z0-9-]+(\.|\s\.\s|\s?\(dot\)\s?|\s?\[dot\]\s?)(com|net|org|io|co|us|me|app|ly|link|info|biz|gg|tv)\b/i.test(t)
    || /(\d[^a-z0-9]{0,3}){7,}/i.test(t) || /(^|[^a-z0-9._%+-])@[a-z0-9_.]{2,}/i.test(t);

  let editando = null;
  let enviandoForm = false;
  P.alEntrar('game-form', async () => {
    const crudo = P.rutaParam();
    editando = /^\d{1,18}$/.test(crudo) ? Number(crudo) : null;
    $('gf-error').hidden = true;
    form.hidden = false;
    form.reset();
    const hoy = diaNY(new Date());
    $('gf-day').min = hoy;
    $('gf-day').max = sumarDias(hoy, 14);
    $('gf-title').textContent = editando ? 'Edit your game' : 'Create a game';
    $('gf-send').textContent = editando ? 'Save changes' : 'Create game';
    $('gf-back').setAttribute('href', editando ? `#/game/${editando}` : '#/play');
    $('gf-back').textContent = editando ? '← Back to the game' : '← Play';
    if (!editando) {
      marcar('gf-kind', 'doubles'); marcar('gf-needed', '3'); marcar('gf-vis', 'open');
      $('gf-reminder').checked = true;
      repasarForm();
      return;
    }
    form.setAttribute('aria-busy', 'true');
    try {
      const j = await rpc('portal_juego', { p_game: editando });
      if (!j || !j.is_host || j.status !== 'active') throw new Error(j && j.is_host ? 'game_closed' : 'not_available');
      const d = new Date(j.plays_at);
      marcar('gf-kind', j.kind); marcar('gf-needed', String(j.needed)); marcar('gf-levels', j.levels || []); marcar('gf-vis', j.visibility);
      $('gf-day').value = diaNY(d);
      $('gf-time').value = horaNY(d);
      $('gf-place').value = j.place || '';
      $('gf-notes').value = j.notes || '';
      $('gf-reminder').checked = !!j.reminder;
      repasarForm();
    } catch (e) {
      $('gf-error').textContent = textoError(e);
      $('gf-error').hidden = false;
      form.hidden = true;
    } finally { form.setAttribute('aria-busy', 'false'); }
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (enviandoForm) return;
    const err = $('gf-error');
    err.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    const v = {
      kind: valorRadio('gf-kind'), day: $('gf-day').value, time: $('gf-time').value,
      place: $('gf-place').value.trim().replace(/\s+/g, ' '), needed: Number(valorRadio('gf-needed')) || null,
      levels: radios('gf-levels').filter((i) => i.checked).map((i) => i.value), vis: valorRadio('gf-vis'),
      notes: $('gf-notes').value.trim(), reminder: $('gf-reminder').checked,
    };
    const fallos = [];
    if (!v.kind) fallos.push(['gf-q-kind', 'Choose the type of game.']);
    if (!v.day || !v.time) fallos.push(['gf-day', 'Choose the day and time.']);
    else if (v.day < $('gf-day').min || v.day > $('gf-day').max) fallos.push(['gf-day', 'Games can be up to 14 days ahead.']);
    if (v.place.length < 3) fallos.push(['gf-place', 'Tell players where you will play.']);
    if (!v.needed) fallos.push(['gf-q-needed', 'Choose how many players you need.']);
    if (!v.levels.length) fallos.push(['gf-q-levels', 'Choose at least one level.']);
    if (!v.vis) fallos.push(['gf-q-vis', 'Choose who can see your game.']);
    if (conContacto(v.place) || conContacto(v.notes)) fallos.push([conContacto(v.place) ? 'gf-place' : 'gf-notes', ERRORES.contact_info]);
    if (fallos.length) {
      fallos.forEach(([id]) => $(id).setAttribute('aria-invalid', 'true'));
      err.textContent = fallos[0][1];
      err.hidden = false;
      err.focus();
      return;
    }
    enviandoForm = true;
    $('gf-send').disabled = true;
    try {
      const args = { p_kind: v.kind, p_day: v.day, p_time: v.time, p_place: v.place, p_needed: v.needed, p_levels: v.levels,
        p_visibility: v.vis, p_notes: v.notes || null, p_reminder: v.reminder };
      const r = editando ? await rpc('portal_juego_editar', { p_game: editando, ...args }) : await rpc('portal_juego_crear', args);
      P.aviso(editando ? 'Saved. Players already in the game get the update.'
        : v.vis === 'invite' ? 'Your game is ready. Invite players from this page.' : 'Your game is live. Compatible players can see it in Play.');
      location.hash = `#/game/${r.id}`;
    } catch (e) {
      err.textContent = textoError(e);
      err.hidden = false;
      err.focus();
    } finally {
      enviandoForm = false;
      $('gf-send').disabled = false;
    }
  });

  /* ============================================================
     LA PÁGINA DEL JUEGO
     ============================================================ */
  const panel = (titulo, ...hijos) => h('section', { class: 'pj-panel' }, h('div', { class: 'pj-panel-head' }, ...[].concat(titulo)), ...hijos);
  const tituloPanel = (t) => h('h2', { class: 'pj-panel-title', text: t });

  async function accion(boton, fn, ok) {
    if (boton) boton.disabled = true;
    try {
      await fn();
      if (ok) P.aviso(ok);
      pintarJuego();
    } catch (e) {
      if (boton) boton.disabled = false;
      P.aviso(textoError(e), true);
    }
  }

  function personaFila(p, sub, extra, lima) {
    return h('li', null,
      h('span', { class: `pl-av pl-av-sm${lima ? ' pl-av-lime' : ''}`, 'aria-hidden': 'true', text: iniciales(p.name) }),
      h('span', { class: 'gm-who' }, h('b', { text: p.name }), sub ? h('span', { text: sub }) : null),
      ...(extra || []));
  }

  function panelJugadores(j, soyAnfitrion) {
    const lista = h('ul', { class: 'gm-people' });
    const host = j.host || {};
    lista.append(personaFila({ name: soyAnfitrion ? `${host.name} (you)` : host.name }, 'Host',
      soyAnfitrion ? [] : [botonReportar(host, j.id)], true));
    (j.players || []).forEach((p) => {
      const esYo = p.player_id === j.my_id;
      const extra = [];
      if (soyAnfitrion && j.status === 'active') {
        const quitar = h('button', { type: 'button', class: 'gm-btn-quiet gm-btn-sm', text: 'Remove', 'aria-label': `Remove ${p.name}` });
        quitar.addEventListener('click', async () => {
          const ok = await ventanaConfirmar({ titulo: `Remove ${p.name}?`, texto: `${p.name.split(' ')[0]} will be told they're no longer in this game, and can't ask to join it again.`, boton: 'Remove', rojo: true });
          if (ok) accion(null, () => rpc('portal_juego_quitar', { p_game: j.id, p_player: p.player_id }), `${p.name} is no longer in the game.`);
        });
        extra.push(quitar);
      }
      if (!esYo) extra.push(botonReportar(p, j.id));
      lista.append(personaFila(esYo ? { name: `${p.name} (you)` } : p, null, extra, esYo));
    });
    for (let i = j.taken || 0; i < j.needed; i++) {
      lista.append(h('li', null, h('span', { class: 'pl-av pl-av-sm gm-av-free', 'aria-hidden': 'true', text: '+' }),
        h('span', { class: 'gm-who' }, h('b', { text: 'Open spot' }))));
    }
    return panel(tituloPanel(`Players · ${(j.taken || 0) + 1} of ${j.needed + 1}`), lista);
  }
  function botonReportar(p, juegoId) {
    const b = h('button', { type: 'button', class: 'gm-link gm-link-soft', text: 'Report', 'aria-label': `Report ${p.name}` });
    b.addEventListener('click', async () => {
      const r = await reportar(p, juegoId);
      if (r && r.bloqueado) pintarJuego();
    });
    return b;
  }

  function panelSolicitudes(j) {
    const reqs = j.requests || [];
    const caja = panel([tituloPanel(`Requests to join · ${reqs.length}`), h('span', { class: 'gm-small', text: 'They see the full game once you accept.' })]);
    if (!reqs.length) {
      caja.append(h('p', { class: 'gm-small gm-m0', text: j.visibility === 'invite'
        ? 'Invite only: players join when they accept your invitation.' : 'No requests yet. Compatible players at your level can see your game in Play.' }));
      return caja;
    }
    const lleno = (j.taken || 0) >= j.needed;
    reqs.forEach((p) => {
      const nombre = [p.first_name, p.last_name].filter(Boolean).join(' ');
      const si = h('button', { type: 'button', class: 'gm-btn-dark', text: 'Accept', disabled: lleno, 'aria-label': `Accept ${nombre}` });
      const no = h('button', { type: 'button', class: 'gm-btn-quiet', text: 'Decline', 'aria-label': `Decline ${nombre}` });
      si.addEventListener('click', () => accion(si, () => rpc('portal_juego_responder', { p_game: j.id, p_player: p.player_id, p_accept: true }), `${nombre} is in. We let them know.`));
      no.addEventListener('click', () => accion(no, () => rpc('portal_juego_responder', { p_game: j.id, p_player: p.player_id, p_accept: false }), `Declined. We let ${p.first_name} know.`));
      const reasons = P.razonesLista && (p.reasons || []).length ? P.razonesLista(`You and ${p.first_name}`, p.reasons, 3) : null;
      caja.append(h('div', { class: 'gm-reqcard' },
        h('div', { class: 'pl-card-top' },
          h('span', { class: 'pl-av', 'aria-hidden': 'true', text: iniciales(nombre) }),
          h('span', { class: 'pl-who' }, h('span', { class: 'pl-name', text: nombre }),
            h('span', { class: 'pl-meta', text: [p.level, p.city].filter(Boolean).join(' · ') })),
          p.match && P.etiquetaMatch ? h('span', { class: 'pl-match', text: P.etiquetaMatch[p.match] }) : null),
        reasons,
        h('div', { class: 'gm-acts' }, si, no, botonReportar({ player_id: p.player_id, name: nombre }, j.id)),
        lleno ? h('p', { class: 'gm-small gm-m0', text: 'Your game is full. Add a spot (Edit) or remove someone to accept.' }) : null));
    });
    return caja;
  }

  function panelInvitar(j) {
    const usadas = h('span', { class: 'gm-small', text: `${j.invites_used || 0} of 8 invites used` });
    const lista = h('ul', { class: 'pl-list' });
    const nota = h('p', { class: 'gm-small gm-m0', text: 'Loading players…' });
    const caja = panel([tituloPanel('Invite players'), usadas], nota, lista);
    if ((j.taken || 0) >= j.needed) { nota.textContent = 'Your game is full.'; return caja; }
    rpc('portal_juego_invitables', { p_game: j.id }).then((d) => {
      const gente = (d && d.players) || [];
      usadas.textContent = `${d.used || 0} of 8 invites used`;
      nota.textContent = gente.length ? 'Players Play suggests for you. They get an email and a notification.'
        : 'Nobody to invite yet. As more players complete their Player DNA, they will show up here.';
      gente.slice(0, 12).forEach((p) => {
        const nombre = [p.first_name, p.last_name].filter(Boolean).join(' ');
        const sub = [p.match && P.etiquetaMatch ? P.etiquetaMatch[p.match] : null, p.level].filter(Boolean).join(' · ');
        let fin;
        if (p.invited) fin = h('span', { class: 'gm-pill gm-pill-wait', text: 'Invited' });
        else {
          fin = h('button', { type: 'button', class: 'pl-btn', text: 'Invite', disabled: (d.used || 0) >= 8, 'aria-label': `Invite ${nombre}` });
          fin.addEventListener('click', async () => {
            fin.disabled = true;
            try {
              await rpc('portal_juego_invitar', { p_game: j.id, p_player: p.player_id });
              fin.replaceWith(h('span', { class: 'gm-pill gm-pill-wait', text: 'Invited' }));
              d.used = (d.used || 0) + 1;
              usadas.textContent = `${d.used} of 8 invites used`;
              P.aviso(`Invitation sent to ${nombre}.`);
            } catch (e) { fin.disabled = false; P.aviso(textoError(e), true); }
          });
        }
        lista.append(h('li', null,
          h('span', { class: 'pl-av pl-av-sm', 'aria-hidden': 'true', text: iniciales(nombre) }),
          h('span', { class: 'pl-list-t' }, h('span', { class: 'pl-list-n', text: nombre }), h('span', { class: 'pl-list-s', text: sub })),
          fin));
      });
    }).catch((e) => { nota.textContent = textoError(e); });
    return caja;
  }

  function panelNotas(j) {
    return panel(tituloPanel('Notes'),
      j.notes ? h('div', { class: 'gm-note', text: j.notes }) : h('p', { class: 'gm-small gm-m0', text: 'No notes for this game.' }),
      h('p', { class: 'gm-small gm-m0', text: 'Game chat comes in the next step. For now, everything players need is on this page.' }));
  }
  function panelSeguridad() {
    const punto = (t) => { const li = h('li'); li.append(icono('check', 16), document.createTextNode(t)); return li; };
    return panel(tituloPanel('Play safe'),
      h('ul', { class: 'gm-tips' },
        punto('Meet at the court — keep it to public places.'),
        punto("FEROCIA doesn't verify identities or run background checks."),
        punto('Never share money, passwords or personal documents.'),
        punto('Something wrong? Use Report next to a player. You can also block anyone.')));
  }

  let vezJuego = 0;
  async function pintarJuego() {
    const mia = ++vezJuego;
    const crudo = P.rutaParam();
    const id = /^\d{1,18}$/.test(crudo) ? Number(crudo) : null;
    const err = $('gp-error'), estadoCaja = $('gp-state');
    err.hidden = true; estadoCaja.hidden = true;
    $('gp-main').setAttribute('aria-busy', 'true');
    let j;
    try {
      if (!id) throw new Error('not_available');
      j = await rpc('portal_juego', { p_game: id });
    } catch (e) {
      if (mia !== vezJuego) return;
      $('gp-k').textContent = ''; $('gp-title').textContent = 'Game'; $('gp-sub').replaceChildren(); $('gp-acts').replaceChildren();
      $('gp-grid').hidden = true;
      err.textContent = textoError(e);
      err.hidden = false;
      $('gp-main').setAttribute('aria-busy', 'false');
      return;
    }
    if (mia !== vezJuego) return;
    const c = cuando(j.plays_at);
    const host = j.is_host;
    const est = j.my_status;
    const dentro = host || est === 'accepted';
    const activo = j.status === 'active';

    $('gp-k').textContent = host ? "You're hosting" : `Hosted by ${nombreDe(j.host)}`;
    $('gp-title').textContent = c.dia ? `${TIPO[j.kind] || 'Game'} · ${c.dia}` : (TIPO[j.kind] || 'Game');
    /* j.minimal: ya no está en el juego (ni lo puede ver como abierto): sin cuándo ni dónde. */
    const chips = j.minimal ? [] : [conIcono('reloj', c.hora, 'span', { class: 'gm-chip' }), conIcono('lugar', j.place, 'span', { class: 'gm-chip' }),
      conIcono('nivel', niveles(j.levels), 'span', { class: 'gm-chip' })];
    if (dentro && j.reminder && activo) chips.push(conIcono('campana', 'Reminder 24 h before', 'span', { class: 'gm-chip' }));
    if (j.visibility === 'invite') chips.push(h('span', { class: 'gm-chip', text: 'Invite only' }));
    $('gp-sub').replaceChildren(...chips);

    /* Las acciones de arriba. */
    const acts = [];
    if (host && activo) {
      acts.push(h('a', { class: 'gm-btn-quiet gm-on-dark', href: `#/game-form/${j.id}`, text: 'Edit' }));
      const cancelar = h('button', { type: 'button', class: 'gm-btn-quiet gm-on-dark gm-on-dark-red', text: 'Cancel game' });
      cancelar.addEventListener('click', async () => {
        const r = await ventanaMotivo({ titulo: 'Cancel this game?', texto: 'Everyone in the game, and anyone who asked to join, will be told — with the reason you choose.',
          motivos: MOTIVOS_CANCELAR, boton: 'Cancel game', quedarse: 'Keep the game' });
        if (r) accion(cancelar, () => rpc('portal_juego_cancelar', { p_game: j.id, p_reason: r.motivo, p_detail: r.detalle }), 'Your game was cancelled. We let everyone know.');
      });
      acts.push(cancelar);
    } else if (!host && activo && !j.minimal) {

      if (est === 'accepted') {
        const salir = h('button', { type: 'button', class: 'gm-btn-quiet gm-on-dark gm-on-dark-red', text: 'Leave game' });
        salir.addEventListener('click', async () => {
          const r = await ventanaMotivo({ titulo: 'Leave this game?', texto: `${nombreDe(j.host).split(' ')[0]} will be told, so the spot can go to someone else.`,
            motivos: MOTIVOS_SALIR, boton: 'Leave game', quedarse: 'Stay in the game' });
          if (r) accion(salir, () => rpc('portal_juego_salir', { p_game: j.id, p_reason: r.motivo, p_detail: r.detalle }), "You left the game. We let the host know.");
        });
        acts.push(salir);
      } else if (est === 'requested') {
        const retirar = h('button', { type: 'button', class: 'gm-btn-quiet gm-on-dark', text: 'Withdraw request' });
        retirar.addEventListener('click', () => accion(retirar, () => rpc('portal_juego_salir', { p_game: j.id, p_reason: null, p_detail: null }), 'Request withdrawn.'));
        acts.push(retirar);
      } else if (est === 'invited') {
        const si = h('button', { type: 'button', class: 'gm-btn-lime', text: 'Accept invitation' });
        const no = h('button', { type: 'button', class: 'gm-btn-quiet gm-on-dark', text: 'Decline' });
        si.addEventListener('click', () => accion(si, () => rpc('portal_juego_pedir', { p_game: j.id }), "You're in! See you on the court."));
        no.addEventListener('click', () => accion(no, () => rpc('portal_juego_salir', { p_game: j.id, p_reason: null, p_detail: null }), 'Invitation declined. We let the host know.'));
        acts.push(si, no);
      } else if (!est || est === 'withdrawn' || est === 'left') {
        const lleno = (j.taken || 0) >= j.needed;
        const pedir = h('button', { type: 'button', class: 'gm-btn-lime', text: lleno ? 'Game is full' : 'Request to join', disabled: lleno });
        pedir.addEventListener('click', () => accion(pedir, () => rpc('portal_juego_pedir', { p_game: j.id }), 'Request sent. The host will accept or decline — we\'ll let you know.'));
        acts.push(pedir);
      }
    }
    $('gp-acts').replaceChildren(...acts);

    /* El estado, en palabras. */
    let txt = '';
    if (j.status === 'cancelled') txt = `This game was cancelled by the host${j.cancel_reason ? ` — ${MOTIVO[j.cancel_reason]}` : ''}.`;
    else if (j.status === 'past') txt = 'This game has already been played.';
    else if (['declined', 'removed'].includes(est) || (est === 'withdrawn' && j.minimal)) txt = "You're not in this game. There are more games waiting for you in Play.";
    else if (est === 'left') txt = 'You left this game.';
    else if (est === 'requested') txt = `Your request is waiting. ${nombreDe(j.host).split(' ')[0]} will accept or decline — we'll let you know.`;
    else if (est === 'invited') txt = `${nombreDe(j.host).split(' ')[0]} invited you. Accept to take your spot.`;
    estadoCaja.textContent = txt;
    estadoCaja.hidden = !txt;

    /* Las dos columnas. */
    const izq = [], der = [];
    if (host) {
      if (activo) izq.push(panelSolicitudes(j), panelInvitar(j));
      der.push(panelJugadores(j, true), panelNotas(j));
      if (!activo) { izq.push(...der.splice(0)); }
    } else if (j.players) {
      izq.push(panelJugadores(j, false), panelNotas(j));
      der.push(panelSeguridad());
    } else {
      izq.push(panelSeguridad());
    }
    $('gp-left').replaceChildren(...izq);
    $('gp-right').replaceChildren(...der);
    $('gp-grid').classList.toggle('gm-grid-1', !der.length);
    $('gp-grid').hidden = false;
    $('gp-main').setAttribute('aria-busy', 'false');

    /* El recordatorio de seguridad: una vez, al entrar en el juego. */
    if (j.safety_needed && activo) {
      const ok = await ventanaSeguridad(j);
      if (ok) { try { await rpc('portal_juego_seguridad_ok', { p_game: j.id }); } catch (e) { /* se volverá a enseñar */ } }
    }
  }
  P.alEntrar('game', pintarJuego);

  /* ============================================================
     LA TARJETA DEL JUGADOR: invitar, reportar, bloquear
     ============================================================ */
  let tarjeta = null;
  document.addEventListener('ferocia:tarjeta', (ev) => {
    tarjeta = ev.detail;
    const caja = $('pc-invite');
    if (!caja) return;
    caja.replaceChildren();
    if (!tarjeta || tarjeta.preview) return;
    const quien = [tarjeta.first_name, tarjeta.last_name].filter(Boolean).join(' ');
    const inv = tarjeta.invite || { state: 'no_game' };
    const nota = (t) => h('span', { class: 'pl-soon', text: t });
    switch (inv.state) {
      case 'invite': {
        const b = h('button', { type: 'button', class: 'pl-btn pl-btn-dark', text: 'Invite to play' });
        b.addEventListener('click', async () => {
          b.disabled = true;
          try {
            await rpc('portal_juego_invitar', { p_game: inv.game_id, p_player: tarjeta.player_id });
            caja.replaceChildren(h('span', { class: 'gm-pill gm-pill-wait', text: 'Invited' }), nota('to your game. We let them know.'));
          } catch (e) { b.disabled = false; P.aviso(textoError(e), true); }
        });
        caja.append(b, nota('to the game you are hosting'));
        break;
      }
      case 'invited': caja.append(h('span', { class: 'gm-pill gm-pill-wait', text: 'Invited' }), nota('to your game')); break;
      case 'in_game': caja.append(h('span', { class: 'gm-pill gm-pill-ok', text: 'In your game' })); break;
      case 'full': caja.append(h('button', { type: 'button', class: 'pl-btn', text: 'Invite to play', disabled: true }), nota('Your game is full.')); break;
      case 'limit': caja.append(h('button', { type: 'button', class: 'pl-btn', text: 'Invite to play', disabled: true }), nota('You used your 8 invitations.')); break;
      case 'unavailable': break;
      default:
        caja.append(h('a', { class: 'pl-btn', href: '#/game-form', text: 'Invite to play' }), nota(`Create a game, then invite ${fmtNombre(tarjeta.first_name)}.`));
    }
    $('pc-report').setAttribute('aria-label', `Report ${quien}`);
    $('pc-block').setAttribute('aria-label', `Block ${quien}`);
  });
  const fmtNombre = (t) => P.fmt.nombre(t || '');
  const personaTarjeta = () => tarjeta && { player_id: tarjeta.player_id, name: P.fmt.nombre([tarjeta.first_name, tarjeta.last_name].filter(Boolean).join(' ')) };
  $('pc-report').addEventListener('click', async () => {
    if (!tarjeta) return;
    const r = await reportar(personaTarjeta(), null);
    if (r && r.bloqueado) P.ir('play');
  });
  $('pc-block').addEventListener('click', async () => {
    if (!tarjeta) return;
    if (await bloquear(personaTarjeta())) P.ir('play');
  });

  /* ============================================================
     LA CAMPANITA
     ============================================================ */
  const campana = $('gm-bell'), cajaAvisos = $('gm-notes');
  let avisosHora = 0;
  let avisosCache = null;
  /* "today", "tomorrow" o "on Sat, Oct 18". */
  const enDia = (c) => (c.dia === 'Today' || c.dia === 'Tomorrow' ? c.dia.toLowerCase() : `on ${c.largo}`);
  function textoAviso(n) {
    const d = n.data || {};
    const c = cuando(d.plays_at);
    const cuandoTxt = enDia(c);
    const tipo = TIPO[d.kind] || 'game';
    const b = (t) => h('b', { text: t || 'A player' });
    const motivo = d.reason && MOTIVO[d.reason] ? [' — ', b(MOTIVO[d.reason])] : [];
    switch (n.kind) {
      case 'request_received': return [b(d.who), ` asked to join your ${tipo} game ${cuandoTxt}.`];
      case 'request_accepted': return [b(d.host), ` accepted you in their ${tipo} game ${cuandoTxt}.`];
      case 'request_declined': return [`Your request for ${d.host || 'a player'}'s ${tipo} game ${cuandoTxt} wasn't accepted.`];
      case 'invited': return [b(d.host), ` invited you to a ${tipo} game ${cuandoTxt}.`];
      case 'invite_accepted': return [b(d.who), ` accepted your invitation for ${tipo} ${cuandoTxt}.`];
      case 'invite_declined': return [b(d.who), ` can't make your ${tipo} game ${cuandoTxt}.`];
      case 'player_left': return [b(d.who), ` left your ${tipo} game ${cuandoTxt}`, ...motivo, '.'];
      case 'removed': return [`You're no longer in ${d.host || 'the host'}'s ${tipo} game ${cuandoTxt}.`];
      case 'game_changed': return [b(d.host), ' changed your game. Now: ', b(`${c.dia} · ${c.hora} · ${d.place || ''}`), '.'];
      case 'game_cancelled': return [`Your ${tipo} game ${cuandoTxt} was cancelled by the host`, ...motivo, '.'];
      case 'reminder': return [d.host_view ? 'Reminder: you are hosting ' : 'Reminder: your game, ', b(`${tipo} · ${c.dia} · ${c.hora}`), '.'];
      default: return ['You have an update about a game.'];
    }
  }
  function pintarAvisos(d) {
    const n = d.unread || 0;
    $('gm-bell-n').textContent = n > 9 ? '9+' : String(n);
    $('gm-bell-n').hidden = !n;
    campana.setAttribute('aria-label', n ? `Notifications, ${n} new` : 'Notifications');
    const items = d.items || [];
    $('gm-notes-read').hidden = !n;
    $('gm-notes-list').replaceChildren(...(items.length ? items.map((it) => {
      const fila = h(it.game_id ? 'a' : 'div', { class: `gm-n${it.read ? '' : ' is-new'}`, href: it.game_id ? `#/game/${it.game_id}` : null },
        it.read ? h('span', { class: 'gm-n-sp', 'aria-hidden': 'true' }) : h('span', { class: 'gm-n-dot', 'aria-label': 'New' }),
        h('span', null, h('span', { class: 'gm-n-t' }, ...textoAviso(it)), h('span', { class: 'gm-n-s', text: haceCuanto(it.created_at) })));
      fila.addEventListener('click', () => { cerrarAvisos(); if (!it.read) leerTodo(); });
      return fila;
    }) : [h('p', { class: 'gm-notes-empty', text: 'No notifications yet. Requests, invitations and game updates show up here.' })]));
  }
  let avisosEnCamino = null;
  function cargarAvisos(forzar) {
    if (avisosEnCamino) return avisosEnCamino;
    avisosEnCamino = cargarAvisosYa(forzar).finally(() => { avisosEnCamino = null; });
    return avisosEnCamino;
  }
  async function cargarAvisosYa(forzar) {
    const e = P.estado();
    if (!e || e.estado !== 'vinculado' || e.dna_completo === false) { campana.closest('.gm-bell-wrap').hidden = true; return; }
    if (!forzar && avisosCache && Date.now() - avisosHora < 60000) return;
    avisosHora = Date.now();
    try {
      avisosCache = await rpc('portal_avisos');
      campana.closest('.gm-bell-wrap').hidden = false;
      pintarAvisos(avisosCache);
    } catch (err) {
      /* Sin el SQL 97 (o sin acceso): sin campanita. */
      campana.closest('.gm-bell-wrap').hidden = true;
    }
  }
  async function leerTodo() {
    try {
      await rpc('portal_avisos_leidos');
      if (avisosCache) { avisosCache.unread = 0; avisosCache.items.forEach((x) => { x.read = true; }); pintarAvisos(avisosCache); }
    } catch (e) { /* nada */ }
  }
  function cerrarAvisos() {
    cajaAvisos.hidden = true;
    campana.setAttribute('aria-expanded', 'false');
  }
  campana.addEventListener('click', async () => {
    if (!cajaAvisos.hidden) { cerrarAvisos(); return; }
    cajaAvisos.hidden = false;
    campana.setAttribute('aria-expanded', 'true');
    await cargarAvisos(true);
  });
  $('gm-notes-read').addEventListener('click', () => { leerTodo(); });
  document.addEventListener('click', (ev) => {
    if (!cajaAvisos.hidden && !ev.target.closest('.gm-bell-wrap')) cerrarAvisos();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !cajaAvisos.hidden) { cerrarAvisos(); campana.focus(); }
  });
  /* Se mira al cambiar de pantalla (como mucho una vez por minuto). */
  window.addEventListener('hashchange', cerrarAvisos);
  ['home', 'profile', 'dna', 'play', 'player', 'game', 'game-form', 'settings', 'help', 'edit', 'dna-edit'].forEach((n) => P.alEntrar(n, () => { cargarAvisos(false); }));

  /* ============================================================
     ACCOUNT: correos de juegos y jugadores bloqueados
     ============================================================ */
  const interruptor = $('st-games-sw');
  async function pintarCuenta() {
    try {
      const [av, bl] = await Promise.all([rpc('portal_avisos'), rpc('portal_bloqueados')]);
      interruptor.setAttribute('aria-checked', String(av.email_games !== false));
      $('st-games').hidden = false;
      const lista = $('st-blocked-list');
      lista.replaceChildren(...(bl || []).map((b) => {
        const quitar = h('button', { type: 'button', class: 'gm-btn-quiet gm-btn-sm', text: 'Unblock', 'aria-label': `Unblock ${b.name}` });
        quitar.addEventListener('click', async () => {
          quitar.disabled = true;
          try { await rpc('portal_desbloquear', { p_player: b.player_id }); P.aviso(`${b.name} is unblocked.`); pintarCuenta(); }
          catch (e) { quitar.disabled = false; P.aviso(textoError(e), true); }
        });
        return h('li', null, h('span', { class: 'pl-av pl-av-sm', 'aria-hidden': 'true', text: iniciales(b.name) }), h('b', { text: b.name }), quitar);
      }));
      $('st-blocked').hidden = !(bl || []).length;
    } catch (e) {
      $('st-games').hidden = true;
      $('st-blocked').hidden = true;
    }
  }
  interruptor.addEventListener('click', async () => {
    const antes = interruptor.getAttribute('aria-checked') === 'true';
    interruptor.setAttribute('aria-checked', String(!antes));
    interruptor.disabled = true;
    try {
      await rpc('portal_correo_juegos', { p_on: !antes });
      P.aviso(!antes ? 'Game emails are on.' : "Game emails are off. You'll still see updates in the portal.");
    } catch (e) {
      interruptor.setAttribute('aria-checked', String(antes));
      P.aviso(textoError(e), true);
    } finally { interruptor.disabled = false; }
  });
  P.alEntrar('settings', pintarCuenta);
})();
