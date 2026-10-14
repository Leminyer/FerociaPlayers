/* ============================================================
   FEROCIA PLAYER PORTAL — Home ("My FEROCIA")
   Hitos 3 y 4 (14 de octubre) — pantalla 6 del diseño aprobado

   Todo sale de una sola llamada a la base (portal_mis_datos), que
   sólo devuelve lo de quien llama: su puesto en la escalera, sus
   números, sus últimos resultados (con pareja y rivales en corto,
   como en el Ladder Hub), sus escaleras y torneos, lo que viene en el
   club y el Video of the Month. El rating del coach NO se enseña
   (decisión §44).
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { h, fmt } = P;
  const $ = (id) => document.getElementById(id);

  const TEMAS = {
    dinking: 'Dinking', serve_return: 'Serve & Return', third_shot: 'Third Shot', strategy: 'Strategy',
    drills: 'Drills', kitchen_rules: 'Kitchen Rules', mistakes: 'Mistakes', ratings: 'Ratings & Levels',
  };
  const ICONO_COPA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>';
  const ICONO_PLAY = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';

  /* Un icono fijo (SVG escrito aquí, nunca datos). */
  function icono(svg) { const s = h('span', { class: 'pj-ico', 'aria-hidden': 'true' }); s.innerHTML = svg; return s; }

  /* El Ladder Hub de ferociasports.com con la clasificación completa. */
  const enlaceEscalera = (id) => `https://ferociasports.com/players.html?l=${encodeURIComponent(btoa(String(id)))}`;
  const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;
  const httpsOk = (u) => { try { return new URL(u).protocol === 'https:'; } catch (_) { return false; } };

  function saludo() {
    const hora = new Date().getHours();
    return hora < 12 ? 'Good morning' : hora < 18 ? 'Good afternoon' : 'Good evening';
  }
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  /* ── La tarjeta del puesto (arriba a la derecha) ── */
  function tarjetaPuesto(ladders) {
    const l = (ladders || []).find((x) => x.status === 'active' && x.rank);
    if (!l) {
      return h('div', { class: 'pj-rank pj-rank-empty' },
        h('span', { class: 'pj-rank-kicker', text: 'Ladders' }),
        h('span', { class: 'pj-rank-empty-t', text: "You're not in an active ladder right now" }),
        h('a', { class: 'pj-rank-link', href: 'https://ferociasports.com', target: '_blank', rel: 'noopener', text: 'See what\'s on at FEROCIA ↗' }));
    }
    let detras;
    if (l.rank === 1) detras = 'Leading the ladder';
    else if (l.behind === 0 || l.behind === '0') detras = 'Tied on points with the spot above';
    else if (l.behind != null) detras = `${plural(Number(l.behind), 'point', 'points')} from the next spot`;
    const avance = l.players > 1 ? Math.max(6, Math.round(((l.players - l.rank) / (l.players - 1)) * 100)) : 100;
    const barra = h('span', { class: 'pj-rank-fill' });
    barra.style.width = `${avance}%`;
    return h('a', { class: 'pj-rank', href: enlaceEscalera(l.id), target: '_blank', rel: 'noopener',
      'aria-label': `${l.name}: you are number ${l.rank} of ${l.players}. Open the full standings.` },
      h('span', { class: 'pj-rank-top' },
        h('span', { class: 'pj-rank-kicker', text: l.name }),
        h('span', { class: 'pj-pill pj-pill-live', text: 'Active' })),
      h('span', { class: 'pj-rank-mid' },
        h('span', { class: 'pj-rank-num' }, h('span', { class: 'pj-rank-lbl', text: 'Your rank' }), h('span', { class: 'pj-rank-big', text: `#${l.rank}` })),
        h('span', { class: 'pj-rank-info' },
          h('span', { class: 'pj-rank-pts', text: `${Number(l.points || 0)} pts · of ${l.players} players` }),
          detras ? h('span', { class: 'pj-rank-sub', text: detras }) : null)),
      h('span', { class: 'pj-rank-bar' }, barra),
      h('span', { class: 'pj-rank-link', text: 'Full standings ↗' }));
  }

  /* ── Los cuatro números ── */
  function numeros(st) {
    const jugados = st.played || 0, ganados = st.wins || 0, perdidos = st.losses || 0;
    const pct = jugados ? Math.round((ganados / jugados) * 100) : null;
    const barra = h('span', { class: 'pj-stat-fill' });
    barra.style.width = `${pct || 0}%`;
    const racha = st.streak && st.streak_kind
      ? `${st.streak} ${st.streak_kind === 'win' ? (st.streak === 1 ? 'win' : 'wins') : (st.streak === 1 ? 'loss' : 'losses')}`
      : '—';
    const rachaTxt = !st.streak_kind ? 'Play your first game to start one'
      : st.streak_kind === 'win' ? 'Keep it going' : "The next one's yours";
    return [
      h('div', { class: 'pj-stat' }, h('span', { class: 'pj-stat-lbl', text: 'Games played' }), h('span', { class: 'pj-stat-num', text: jugados }), h('span', { class: 'pj-stat-sub', text: 'Ladders + tournaments' })),
      h('div', { class: 'pj-stat' }, h('span', { class: 'pj-stat-lbl', text: 'Wins' }), h('span', { class: 'pj-stat-num', text: ganados }), h('span', { class: 'pj-stat-sub', text: plural(perdidos, 'loss', 'losses') })),
      h('div', { class: 'pj-stat' }, h('span', { class: 'pj-stat-lbl', text: 'Win rate' }), h('span', { class: 'pj-stat-num', text: pct == null ? '—' : `${pct}%` }), h('span', { class: 'pj-stat-bar', 'aria-hidden': 'true' }, barra)),
      h('div', { class: 'pj-stat pj-stat-dark' }, h('span', { class: 'pj-stat-lbl', text: 'Current streak' }), h('span', { class: 'pj-stat-num', text: racha }), h('span', { class: 'pj-stat-sub', text: rachaTxt })),
    ];
  }

  /* ── Últimos resultados ── */
  function conQuien(r) {
    const partes = [];
    if (r.partners && r.partners.length) partes.push(`w/ ${r.partners.join(' & ')}`);
    if (r.opponents && r.opponents.length) partes.push(`vs ${r.opponents.join(' & ')}`);
    return partes.join(' · ') || '—';
  }
  function resultados(lista) {
    if (!lista || !lista.length) {
      return h('p', { class: 'pj-empty', text: 'No results yet. Your games will show up here after your first ladder session or tournament.' });
    }
    const filas = lista.map((r) => h('tr', null,
      h('td', { class: 'pj-td-date', text: fmt.corto(r.played_on) }),
      h('td', { class: 'pj-td-strong', text: r.category ? `${r.competition} · ${r.category}` : r.competition }),
      h('td', { class: 'pj-td-soft', text: conQuien(r) }),
      h('td', { class: 'pj-td-score', text: r.score_for != null && r.score_against != null ? `${r.score_for}–${r.score_against}` : '' }),
      h('td', { class: 'pj-td-res' }, h('span', { class: `pj-res ${r.result === 'win' ? 'is-win' : 'is-loss'}`, title: r.result === 'win' ? 'Win' : 'Loss' },
        h('span', { 'aria-hidden': 'true', text: r.result === 'win' ? 'W' : 'L' }), h('span', { class: 'pj-sr', text: r.result === 'win' ? 'Win' : 'Loss' })))));
    return h('div', { class: 'pj-table-scroll' },
      h('table', { class: 'pj-table' },
        h('thead', null, h('tr', null,
          h('th', { scope: 'col', text: 'Date' }), h('th', { scope: 'col', text: 'Event' }),
          h('th', { scope: 'col', text: 'With / against' }), h('th', { scope: 'col', class: 'pj-th-right', text: 'Score' }),
          h('th', { scope: 'col' }, h('span', { class: 'pj-sr', text: 'Result' })))),
        h('tbody', null, filas)));
  }

  /* ── Mis escaleras ── */
  function escaleras(lista) {
    if (!lista || !lista.length) return h('p', { class: 'pj-empty', text: "You haven't played a ladder yet." });
    return lista.map((l) => {
      const activa = l.status === 'active';
      let sub;
      if (l.rank) sub = `${Number(l.points || 0)} pts · ${l.wins || 0} W – ${l.losses || 0} L`;
      else if (l.membership === 'sub') sub = 'Substitute';
      else sub = activa ? 'Season in progress' : `Season ${fmt.mesAnio(l.end_date || l.start_date).split(' ').pop() || ''}`.trim();
      if (!activa && l.rank) sub = `Final standing · ${sub}`;
      return h('a', { class: 'pj-row', href: enlaceEscalera(l.id), target: '_blank', rel: 'noopener' },
        h('span', { class: `pj-row-badge ${activa ? 'is-blue' : ''}`, text: l.rank ? `#${l.rank}` : '—' }),
        h('span', { class: 'pj-row-main' }, h('span', { class: 'pj-row-name', text: l.name }), h('span', { class: 'pj-row-sub', text: sub })),
        h('span', { class: `pj-pill ${activa ? 'pj-pill-ok' : 'pj-pill-gray'}`, text: activa ? 'Active' : 'Completed' }));
    });
  }

  /* ── Torneos ── */
  function torneos(lista) {
    if (!lista || !lista.length) return h('p', { class: 'pj-empty', text: 'No tournaments yet.' });
    return lista.slice(0, 6).map((t) => {
      const oro = t.finish === 'Champion';
      return h('div', { class: 'pj-row' },
        h('span', { class: `pj-row-trophy ${oro ? 'is-gold' : ''}` }, icono(ICONO_COPA)),
        h('span', { class: 'pj-row-main' },
          h('span', { class: 'pj-row-name', text: t.name }),
          h('span', { class: 'pj-row-sub' }, t.category ? `${t.category} · ` : '', h('strong', { class: oro ? 'pj-gold' : '', text: t.finish }))));
    });
  }

  /* ── Lo que viene ── */
  const COLOR_TIPO = (t) => /tourn/i.test(t || '') ? 'pj-orange' : /clinic|camp|lesson/i.test(t || '') ? 'pj-green' : 'pj-blue';
  function eventos(lista) {
    if (!lista || !lista.length) return [h('p', { class: 'pj-empty', text: 'Nothing scheduled yet — check back soon.' })];
    return lista.map((e, i) => {
      const href = e.registration_url && httpsOk(e.registration_url) ? e.registration_url : 'https://ferociasports.com/#events';
      const cuando = e.event_time ? `${fmt.hora(e.event_time)}${e.end_time ? ` – ${fmt.hora(e.end_time)}` : ''}`
        : e.registration_url ? 'Registration open' : fmt.largo(e.event_date);
      return h('a', { class: 'pj-event', href, target: '_blank', rel: 'noopener' },
        h('span', { class: `pj-event-date ${i % 2 ? 'is-navy' : ''}` }, h('span', { class: 'pj-event-mon', text: fmt.mes3(e.event_date) }), h('span', { class: 'pj-event-day', text: fmt.dia(e.event_date) })),
        h('span', { class: 'pj-event-txt' },
          h('span', { class: `pj-event-kind ${COLOR_TIPO(e.event_type)}`, text: e.event_type || 'Event' }),
          h('span', { class: 'pj-event-title', text: e.title }),
          h('span', { class: 'pj-event-sub', text: cuando })));
    });
  }

  function video(v) {
    if (!v || !ID_YOUTUBE.test(v.youtube_id || '')) return null;
    /* Si YouTube no da la foto, queda el fondo azul con el botón (sin icono roto). */
    const foto = h('img', { src: `https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`, alt: '', loading: 'lazy' });
    foto.addEventListener('error', () => foto.remove());
    const portada = h('span', { class: 'pj-video-pic' },
      foto,
      h('span', { class: 'pj-video-badge', text: 'Video of the Month' }));
    const boton = h('span', { class: 'pj-video-play' });
    boton.innerHTML = ICONO_PLAY;
    portada.append(boton);
    return h('a', { class: 'pj-video', href: `https://www.youtube.com/watch?v=${v.youtube_id}`, target: '_blank', rel: 'noopener' },
      portada,
      h('span', { class: 'pj-video-txt' },
        h('span', { class: 'pj-video-topic', text: TEMAS[v.topic] || 'FEROCIA Academy' }),
        h('span', { class: 'pj-video-title', text: v.title }),
        h('span', { class: 'pj-video-go', text: 'Watch on YouTube ↗' })));
  }

  /* ── Pintar ── */
  let vez = 0;
  async function pintar() {
    const mia = ++vez;
    const e = P.estado() || {};
    $('hm-greeting').textContent = saludo();
    $('hm-name').textContent = [e.first_name, e.last_name].filter(Boolean).join(' ');
    const main = $('hm-main');
    main.setAttribute('aria-busy', 'true');
    $('hm-error').hidden = true;
    let d;
    try {
      d = await P.datos();
    } catch (err) {
      if (mia !== vez) return;
      console.warn('[portal] home:', err);
      $('hm-error').textContent = P.errorTexto(err);
      $('hm-error').hidden = false;
      main.setAttribute('aria-busy', 'false');
      return;
    }
    if (mia !== vez) return;
    const p = d.player || {};
    $('hm-name').textContent = [p.first_name, p.last_name].filter(Boolean).join(' ');
    $('hm-chips').replaceChildren(
      p.skill_level ? h('span', { class: 'pj-chip pj-chip-lime', text: p.skill_level }) : null,
      p.date_joined ? h('span', { class: 'pj-chip', text: `FEROCIA player since ${fmt.mesAnio(p.date_joined)}` }) : null);
    $('hm-rank').replaceChildren(tarjetaPuesto(d.ladders));
    $('hm-stats').replaceChildren(...numeros(d.stats || {}));
    $('hm-results').replaceChildren(resultados(d.recent));
    $('hm-ladders').replaceChildren(...[].concat(escaleras(d.ladders)));
    $('hm-tournaments').replaceChildren(...[].concat(torneos(d.tournaments)));
    $('hm-events').replaceChildren(...eventos(d.events));
    const vid = video(d.video);
    $('hm-video').replaceChildren(...(vid ? [vid] : []));
    $('hm-video').hidden = !vid;
    main.setAttribute('aria-busy', 'false');
  }
  P.alEntrar('home', pintar);
})();
