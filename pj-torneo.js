/* ============================================================
   FEROCIA PLAYER PORTAL — EL TORNEO DE HOY (§121, SQL 141) · 23 nov 2026
   Etapa 1, entrega 1 (diseño aprobado).

   En el Home, arriba de todo, el día del torneo:
     · "I'm here — Check in" (desde 2 horas antes de la hora de inicio;
       sin hora, desde las 6:00 AM);
     · después: "You're checked in" y si falta la pareja;
     · jugando: "Your next match" (cancha ahora / Up next / esperando).
   Se pone al día cada 30 segundos mientras el Home está abierto.
   Todo se pinta como TEXTO (h()), nunca HTML con datos.
   ============================================================ */
(function () {
  'use strict';
  const P = window.FerociaPortal;
  if (!P) return;
  const { h, sb } = P;
  const $ = (id) => document.getElementById(id);
  const ZONA = 'America/New_York';
  const F_HORA = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' });
  const REFRESCO_MS = 30000;
  let reloj = null;

  const horaDe = (hhmm) => {
    if (!hhmm) return '';
    const [hh, mm] = hhmm.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${ampm}`;
  };

  async function leer() {
    const { data, error } = await sb.rpc('portal_torneo_hoy');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  function siguiente(t) {
    const n = t.next;
    if (!n) return null;
    if (n.state === 'on_court') {
      /* §122: en el bracket, también la ronda ("SEMIFINAL"). */
      return h('div', { class: 'tn-big' },
        h('small', { text: n.round ? `YOUR ${String(n.round).toUpperCase()}` : 'YOUR NEXT MATCH' }),
        h('div', { class: 'tn-big-n', text: `Court ${n.court} · now` }),
        n.vs ? h('span', { text: `vs ${n.vs}` }) : null);
    }
    const textos = {
      up_next: ['UP NEXT — GET READY', n.position === 1 ? "You're first in line" : `${n.position === 2 ? '2nd' : '3rd'} in line`],
      waiting: ['YOUR NEXT MATCH', 'Waiting for a court'],
      paused: ['COURTS PAUSED', 'Your match will be called soon'],
    }[n.state];
    if (!textos) return null;
    return h('div', { class: `tn-big${n.state === 'up_next' ? ' tn-big-lima' : ''}` },
      h('small', { text: textos[0] }),
      h('div', { class: 'tn-big-n', text: textos[1] }),
      n.category || n.round ? h('span', { text: [n.category, n.round].filter(Boolean).join(' · ') }) : null);
  }

  function tarjeta(t) {
    const partes = [];
    const vivo = t.status === 'active' && t.checked_in && t.next;
    partes.push(h('p', { class: 'tn-k', text: vivo ? 'TOURNAMENT · LIVE' : 'TOURNAMENT TODAY' }));
    partes.push(h('h2', { class: 'tn-t', text: t.name }));
    const lineas = (t.entries || []).map((e) => {
      const p = (e.partners || []).map((x) => x.name).filter(Boolean);
      return `${e.category}${p.length ? ` · with ${p.join(' & ')}` : ''}`;
    });
    if (t.start_time) lineas.push(`Starts at ${horaDe(t.start_time)}`);
    partes.push(h('p', { class: 'tn-s' }, ...lineas.flatMap((l, i) => (i ? [h('br'), l] : [l]))));

    if (!t.checked_in) {
      if (t.open) {
        const b = h('button', { type: 'button', class: 'tn-btn', 'data-tn-checkin': String(t.tournament_id) }, "I'm here — Check in");
        partes.push(b, h('p', { class: 'tn-nota', text: 'Check in when you arrive at the courts.' }));
      } else {
        partes.push(h('p', { class: 'tn-espera', text: `Check-in opens at ${F_HORA.format(new Date(t.opens_at))}.` }));
      }
      partes.push(h('p', { class: 'tn-err', role: 'alert', hidden: true }));
      return h('section', { class: 'tn-card', 'aria-label': `Tournament today: ${t.name}` }, ...partes);
    }

    const sig = vivo ? siguiente(t) : null;
    if (sig) {
      partes.push(sig);
    } else {
      partes.push(h('p', { class: 'tn-ok' }, h('span', { 'aria-hidden': 'true', text: '✓ ' }), "You're checked in"));
    }
    const faltan = (t.entries || []).flatMap((e) => (e.partners || []).filter((x) => !x.checked_in));
    faltan.forEach((x) => partes.push(h('div', { class: 'tn-fila' }, h('span', { text: x.name }), h('b', { class: 'tn-falta', text: 'Not checked in yet' }))));
    if (faltan.length && !sig) partes.push(h('p', { class: 'tn-s', text: 'Your matches start once all of you are here.' }));
    else if (!sig && t.next && t.next.state === 'waiting_checkin') {
      partes.push(h('p', { class: 'tn-s', text: 'Your next match starts as soon as your opponents check in.' }));
    }
    if (t.played) partes.push(h('div', { class: 'tn-fila' }, h('span', { text: 'Played' }), h('b', { text: `${t.played} · W ${t.wins} L ${t.played - t.wins}` })));
    const url = `https://ferociasports.com/tournament-results.html?t=${btoa(String(t.tournament_id))}`;
    partes.push(h('div', { class: 'tn-fila' }, h('span', { text: 'Live results' }),
      h('a', { class: 'tn-link', href: url, target: '_blank', rel: 'noopener', text: 'Open →' })));
    return h('section', { class: 'tn-card', 'aria-label': `Tournament today: ${t.name}` }, ...partes);
  }

  async function pintar() {
    const caja = $('tn-hoy');
    if (!caja) return;
    let lista;
    try { lista = await leer(); } catch (_) { caja.hidden = true; return; }   // sin SQL 141 o sin conexión: el Home sigue igual
    caja.replaceChildren(...lista.map(tarjeta));
    caja.hidden = !lista.length;
  }

  async function hacerCheckin(boton) {
    if (boton.disabled) return;
    const id = Number(boton.dataset.tnCheckin);
    const card = boton.closest('.tn-card');
    const err = card && card.querySelector('.tn-err');
    boton.disabled = true; boton.setAttribute('aria-busy', 'true'); boton.textContent = 'Checking in…';
    try {
      const { data, error } = await sb.rpc('portal_torneo_checkin', { p_tournament_id: id });
      if (error) throw error;
      if (data && data.error) {
        const msg = {
          not_open_yet: data.opens_at ? `Check-in opens at ${F_HORA.format(new Date(data.opens_at))}.` : 'Check-in is not open yet.',
          not_today: 'This tournament is not today.',
          not_in_tournament: "You're not on a team in this tournament. Ask the organizer.",
        }[data.error] || 'We could not check you in. Ask the organizer.';
        throw new Error(msg);
      }
      await pintar();
    } catch (e) {
      boton.disabled = false; boton.removeAttribute('aria-busy'); boton.textContent = "I'm here — Check in";
      if (err) { err.textContent = e.message && !/^[a-z_]+$/.test(e.message) ? e.message : 'We could not check you in. Try again, or ask the organizer.'; err.hidden = false; }
    }
  }

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tn-checkin]');
    if (b) hacerCheckin(b);
  });

  P.alEntrar('home', () => {
    pintar();
    if (reloj) clearInterval(reloj);
    reloj = setInterval(() => {
      const home = document.querySelector('.pj-screen[data-screen="home"]');
      if (!home || !home.classList.contains('is-active')) { clearInterval(reloj); reloj = null; return; }
      if (document.visibilityState === 'visible') pintar();
    }, REFRESCO_MS);
  });
})();
