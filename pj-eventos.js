/* ============================================================
   FEROCIA PLAYER PORTAL — MY EVENTS (§128, SQL 145) · 24 nov 2026
   Diseño mis-eventos.html aprobado (1A 2B 3A 4A 5A 6A · 1A 2A 3A 4A).

     · #/events: las escaleras y torneos donde jugó (en curso primero).
     · #/event/t-<id> o #/event/l-<id>: la tabla completa, como la página
       pública, con su fila resaltada.
         - Escalera: Standings y Sessions (todas, la más reciente arriba).
         - Torneo: su división primero; Round robin, Results y Bracket;
           en curso, "On court now / Up next" (se pone al día solo).
     · Se llega desde una tarjeta del Home y desde My Identity (2B); en la
       computadora, también desde el menú.

   Los datos son los de la página pública (portal_evento los devuelve
   sólo si jugó ese evento). Las cuentas de las tablas son las mismas de
   tournament-results.html y players.html. Todo se pinta como TEXTO.
   ============================================================ */
(function () {
  'use strict';
  const P = window.FerociaPortal;
  if (!P) return;
  const { h, sb, fmt } = P;
  const $ = (id) => document.getElementById(id);

  const WEB = 'https://ferociasports.com';
  const SESIONES_POR_VEZ = 6;        // grupos de sesión antes de "Older sessions"
  const REFRESCO_VIVO_MS = 30000;    // torneo en curso: se pone al día cada 30 s

  const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const diaSemana = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? DIAS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()] : '';
  };
  const conDia = (iso) => (iso ? `${diaSemana(iso)}, ${fmt.corto(iso)}` : '');
  const ordinal = (n) => {
    const r = n % 100;
    return `${n}${r >= 11 && r <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
  };
  const plural = (n, una, varias) => `${n} ${n === 1 ? una : (varias || `${una}s`)}`;
  const conSigno = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
  const puntos = (v) => { const n = Number(v) || 0; return Number.isInteger(n) ? String(n) : n.toFixed(1); };
  const MEDALLA = { gold: '🥇', silver: '🥈', bronze: '🥉' };
  const ruta = (kind, id) => `#/event/${kind === 'tournament' ? 't' : 'l'}-${id}`;
  const leerRuta = (param) => {
    const m = /^(t|l)-(\d{1,18})$/.exec(String(param || ''));
    return m ? { kind: m[1] === 't' ? 'tournament' : 'ladder', id: Number(m[2]) } : null;
  };
  const publica = (kind, id) => `${WEB}/${kind === 'tournament' ? 'tournament-results.html?t=' : 'players.html?l='}${encodeURIComponent(btoa(String(id)))}`;

  async function rpc(nombre, args) {
    const { data, error } = await sb.rpc(nombre, args || {});
    if (error) throw error;
    return data;
  }

  /* ── La lista (se pide una vez por visita; la usan Home, Identity y My Events) ── */
  let lista = null;          // [] cuando ya se pidió
  let pidiendo = null;
  function pedirLista(forzar) {
    if (!forzar && lista) return Promise.resolve(lista);
    if (!forzar && pidiendo) return pidiendo;
    pidiendo = rpc('portal_mis_eventos').then((l) => { lista = Array.isArray(l) ? l : []; return lista; })
      .finally(() => { pidiendo = null; });
    return pidiendo;
  }

  /* El resultado de un evento, en dos líneas (lista y escritorio). */
  function resultado(e) {
    if (e.kind === 'tournament') {
      const rec = e.played ? `${e.wins}–${e.played - e.wins}` : '';
      if (e.completed && e.finish) {
        const med = MEDALLA[e.finish.medal] ? `${MEDALLA[e.finish.medal]} ` : '';
        return { t: `${med}${e.finish.label}`, s: rec };
      }
      return { t: e.live ? 'In progress' : 'Played', s: rec };
    }
    if (e.rank) return e.live ? { t: `#${e.rank}`, s: `of ${e.of}` } : { t: ordinal(e.rank), s: `of ${e.of}` };
    return { t: '—', s: '' };
  }
  function subtitulo(e) {
    if (e.kind === 'tournament') return [fmt.corto(e.date), e.divisions].filter(Boolean).join(' · ');
    const fechas = e.end_date && !e.live ? `${fmt.corto(e.start_date)} – ${fmt.corto(e.end_date)}` : `Since ${fmt.corto(e.start_date)}`;
    return [fechas, e.sessions ? plural(e.sessions, 'session') : ''].filter(Boolean).join(' · ');
  }
  const icono = (e) => h('span', { class: `ev-ic${e.kind === 'tournament' ? ' ev-ic-t' : ''}`, 'aria-hidden': 'true', text: e.kind === 'tournament' ? '🏆' : '🪜' });

  function fila(e, actual) {
    const r = resultado(e);
    return h('li', null, h('a', { class: `ev-fila${actual ? ' is-actual' : ''}`, href: ruta(e.kind, e.id), 'aria-current': actual ? 'page' : null },
      icono(e),
      h('span', { class: 'ev-fila-txt' },
        h('b', { class: 'ev-fila-n' }, e.name, e.live ? [' ', h('span', { class: 'ev-live', text: 'LIVE' })] : null),
        h('small', { class: 'ev-fila-s', text: subtitulo(e) })),
      h('span', { class: 'ev-fila-r' }, h('b', { text: r.t }), r.s ? h('small', { text: r.s }) : null)));
  }

  function pintarLista(caja, eventos, actual) {
    const vivos = eventos.filter((e) => e.live);
    const fin = eventos.filter((e) => !e.live);
    const partes = [];
    const grupo = (titulo, arr) => [h('h2', { class: 'ev-sec', text: titulo }),
      h('ul', { class: 'ev-lista' }, arr.map((e) => fila(e, actual && actual.kind === e.kind && actual.id === e.id)))];
    if (vivos.length) partes.push(...grupo('Now', vivos));
    if (fin.length) partes.push(...grupo('Finished', fin));
    if (!eventos.length) partes.push(h('p', { class: 'ev-vacio', text: "No ladders or tournaments yet. When you play one, it shows up here with its full standings." }));
    caja.replaceChildren(...partes);
  }

  /* ── Home y My Identity: la tarjeta (2B) ── */
  function resumenTexto(eventos) {
    const esc = eventos.filter((e) => e.kind === 'ladder').length;
    const tor = eventos.length - esc;
    return [esc ? plural(esc, 'ladder') : '', tor ? plural(tor, 'tournament') : ''].filter(Boolean).join(' · ');
  }
  async function pintarTarjetas() {
    const home = $('ev-home');
    const ident = $('ev-ident');
    try {
      const eventos = await pedirLista();
      if (home) { home.hidden = !eventos.length; const t = $('ev-home-n'); if (t) t.textContent = resumenTexto(eventos); }
      if (ident) ident.hidden = !eventos.length;
    } catch (_) {
      if (home) home.hidden = true;        // si falla, el Home sigue igual
      if (ident) ident.hidden = true;
    }
  }

  /* ── #/events ── */
  let vezLista = 0;
  async function pintarEventos() {
    const caja = $('ev-lista-main');
    const err = $('ev-lista-error');
    if (!caja) return;
    const mia = ++vezLista;
    err.hidden = true;
    caja.replaceChildren(h('p', { class: 'ev-cargando', text: 'Loading your events…' }));
    caja.setAttribute('aria-busy', 'true');
    try {
      const eventos = await pedirLista(true);
      if (mia !== vezLista) return;
      pintarLista(caja, eventos, null);
    } catch (e) {
      if (mia !== vezLista) return;
      caja.replaceChildren();
      err.textContent = P.errorTexto(e, {}) || 'We could not load your events. Try again in a moment.';
      err.hidden = false;
    } finally {
      if (mia === vezLista) caja.setAttribute('aria-busy', 'false');
    }
  }

  /* ═══════════════ Un evento ═══════════════ */
  let actual = null;       // { kind, id, d (datos), cat, pestana, mostradas, primera }
  let vezEvento = 0;
  let reloj = null;

  function nombres(d) {
    const m = new Map((d.players || []).map((p) => [Number(p.id), p]));
    const largo = (id) => { const p = m.get(Number(id)); return p ? fmt.nombre(`${p.first_name || ''} ${p.last_name || ''}`) : ''; };
    const corto = (id) => {
      const p = m.get(Number(id));
      if (!p) return '';
      const ap = String(p.last_name || '').trim();
      return fmt.nombre(`${p.first_name || ''}`) + (ap ? ` ${ap.charAt(0).toUpperCase()}.` : '');
    };
    return { largo, corto };
  }
  const integrantes = (t) => (t ? [t.player1_id, t.player2_id, t.player3_id, t.player4_id].filter((x) => x != null) : []);

  /* Pestañas (botones con aria-pressed, como el resto del portal). */
  function pestanas(opciones, activa, alCambiar) {
    return h('div', { class: 'ev-tabs', role: 'group', 'aria-label': 'Sections' },
      opciones.map(([id, texto]) => {
        const b = h('button', { type: 'button', class: 'ev-tab', 'data-k': `tab:${id}`, 'aria-pressed': id === activa ? 'true' : 'false', text: texto });
        b.addEventListener('click', () => { if (id !== activa) alCambiar(id); });
        return b;
      }));
  }

  /* Una tabla: columnas [{t, k, cls, extra}] (extra = sólo en pantallas anchas, 1A). */
  function tabla(columnas, filas, esMia, etiqueta) {
    return h('div', { class: 'ev-tabla-caja' }, h('table', { class: 'ev-tabla' },
      h('caption', { class: 'pj-sr', text: etiqueta }),
      h('thead', null, h('tr', null, columnas.map((c) => h('th', { scope: 'col', class: [c.cls, c.extra ? 'ev-extra' : ''].filter(Boolean).join(' ') || null, text: c.t })))),
      h('tbody', null, filas.map((f) => h('tr', { class: esMia(f) ? 'is-yo' : null },
        columnas.map((c) => {
          const v = c.k(f);
          const celda = c.th
            ? h('th', { scope: 'row', class: [c.cls, c.extra ? 'ev-extra' : ''].filter(Boolean).join(' ') || null }, v)
            : h('td', { class: [c.cls, c.extra ? 'ev-extra' : ''].filter(Boolean).join(' ') || null }, v);
          return celda;
        }))))));
  }
  /* Con su espacio delante: "Ana Lopez YOU" (así lo leen bien los lectores de pantalla). */
  const tuMarca = () => h('span', null, ' ', h('span', { class: 'ev-tu', text: 'YOU' }));

  /* ── Escalera de siempre ── */
  function pintarEscalera(cuerpo) {
    const d = actual.d;
    const me = Number(d.me);
    const pestana = actual.pestana || 'standings';
    const nodos = [pestanas([['standings', 'Standings'], ['sessions', 'Sessions']], pestana, (p) => { actual.pestana = p; pintarCuerpo(); })];
    if (pestana === 'standings') {
      const filas = d.standings || [];
      if (!filas.length) nodos.push(h('p', { class: 'ev-vacio', text: 'No standings yet.' }));
      else {
        nodos.push(tabla([
          { t: '#', cls: 'ev-pos', k: (s) => String(s.rank) },
          { t: 'Player', cls: 'ev-nom', th: true, k: (s) => [fmt.nombre(`${s.first_name || ''} ${s.last_name || ''}`), Number(s.player_id) === me ? tuMarca() : null] },
          { t: 'Pts', k: (s) => puntos(s.points) },
          { t: 'Played', extra: true, k: (s) => String(s.played ?? 0) },
          { t: 'W–L', k: (s) => `${s.wins ?? 0}–${s.losses ?? 0}` },
          { t: 'Pts for', extra: true, k: (s) => String(s.pts_for ?? 0) },
          { t: 'Pts against', extra: true, k: (s) => String(s.pts_against ?? 0) },
          { t: 'Diff', k: (s) => conSigno(Number(s.diff) || 0) },
        ], filas, (s) => Number(s.player_id) === me, `${d.ladder.name} standings`));
      }
    } else {
      nodos.push(...sesiones(d, me));
    }
    cuerpo.replaceChildren(...nodos);
  }

  function sesiones(d, me) {
    const canchas = Array.isArray(d.sessions) ? d.sessions : [];
    if (!canchas.length) return [h('p', { class: 'ev-vacio', text: 'No sessions recorded yet.' })];
    /* Agrupar por día y hora (ya vienen de la más reciente a la más vieja). */
    const grupos = [];
    canchas.forEach((c) => {
      const clave = `${c.session_date}|${c.session_time || ''}`;
      let g = grupos[grupos.length - 1];
      if (!g || g.clave !== clave) { g = { clave, fecha: c.session_date, hora: c.session_time, canchas: [] }; grupos.push(g); }
      g.canchas.push(c);
    });
    const corto = (x) => {
      const ap = String(x.last_name || '').trim();
      return fmt.nombre(x.first_name || '') + (ap ? ` ${ap.charAt(0).toUpperCase()}.` : '');
    };
    const lado = (arr) => (arr || []).map(corto).join(' & ') || '—';
    const tengo = (arr) => (arr || []).some((x) => Number(x.player_id) === me);
    const n = actual.mostradas || SESIONES_POR_VEZ;
    const nodos = grupos.slice(0, n).map((g) => h('section', { class: 'ev-ses', 'aria-label': `${conDia(g.fecha)} ${fmt.hora(g.hora)}`.trim() },
      h('h3', { class: 'ev-ses-h', text: [conDia(g.fecha), fmt.hora(g.hora)].filter(Boolean).join(' · ') }),
      g.canchas.map((c) => h('div', { class: 'ev-cancha' },
        h('h4', { class: 'ev-cancha-h', text: `Court ${c.court_group}` }),
        (c.games || []).map((j) => {
          const a = j.team_a || [], b = j.team_b || [];
          const mio = tengo(a) || tengo(b);
          const sa = a[0] ? a[0].score_for : null, sb2 = b[0] ? b[0].score_for : null;
          const listo = j.status === 'completed' && sa != null && sb2 != null;
          return h('div', { class: `ev-juego${mio ? ' is-yo' : ''}` },
            h('span', { class: 'ev-juego-t' }, h('span', { class: listo && sa > sb2 ? 'ev-gana' : null, text: lado(a) }), ' vs ', h('span', { class: listo && sb2 > sa ? 'ev-gana' : null, text: lado(b) })),
            h('b', { class: 'ev-juego-s', text: listo ? `${sa}–${sb2}` : '—' }));
        }),
        (c.no_shows || []).length ? h('p', { class: 'ev-noshow', text: `No-show: ${c.no_shows.map(corto).join(', ')}` }) : null))));
    if (grupos.length > n) {
      const mas = h('button', { type: 'button', class: 'pj-btn pj-btn-quiet pj-btn-sm ev-mas', text: 'Older sessions ↓' });
      mas.addEventListener('click', () => { actual.mostradas = n + SESIONES_POR_VEZ; pintarCuerpo(); });
      nodos.push(mas);
    }
    return nodos;
  }

  /* ── Torneo ── */
  /* La tabla del round robin: la misma cuenta de tournament-results.html
     (ganados, diferencia, puntos a favor, perdidos; retirados al final). */
  function standings(equipos, partidos) {
    const st = {};
    equipos.forEach((t) => { st[t.id] = { team: t, w: 0, l: 0, pf: 0, pc: 0, ff: false }; });
    partidos.filter((m) => m.forfeit_team_id).forEach((m) => { if (st[m.forfeit_team_id]) st[m.forfeit_team_id].ff = true; });
    partidos.filter((m) => m.status === 'completed').forEach((m) => {
      const a = st[m.team_a_id], b = st[m.team_b_id];
      if (!a || !b) return;
      a.pf += m.score_a != null ? parseInt(m.score_a, 10) : 0; a.pc += m.score_b != null ? parseInt(m.score_b, 10) : 0;
      b.pf += m.score_b != null ? parseInt(m.score_b, 10) : 0; b.pc += m.score_a != null ? parseInt(m.score_a, 10) : 0;
      if (m.winner_id === m.team_a_id) { a.w++; b.l++; } else if (m.winner_id === m.team_b_id) { b.w++; a.l++; }
    });
    return Object.values(st).sort((a, b) => {
      if (a.ff !== b.ff) return a.ff ? 1 : -1;
      if (b.w !== a.w) return b.w - a.w;
      const da = a.pf - a.pc, db = b.pf - b.pc;
      if (db !== da) return db - da;
      if (b.pf !== a.pf) return b.pf - a.pf;
      return a.l - b.l;
    });
  }
  const RONDAS = ['R32', 'R16', 'QF', 'Semifinals', '3rd Place', 'Final'];
  const RONDA_TXT = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarterfinal', Semifinals: 'Semifinal', '3rd Place': '3rd place', Final: 'Final' };
  const detalleGames = (m) => (Array.isArray(m.games) && m.games.length
    ? m.games.map((g) => `${g.score_a ?? '–'}–${g.score_b ?? '–'}`).join(', ') : '');

  function pintarTorneo(cuerpo) {
    const d = actual.d;
    const nm = nombres(d);
    const mios = new Set((d.my_teams || []).map(Number));
    const cats = d.categories || [];
    const cat = cats.find((c) => Number(c.id) === Number(actual.cat)) || cats[0];
    if (!cat) { cuerpo.replaceChildren(h('p', { class: 'ev-vacio', text: 'No divisions yet.' })); return; }
    const equipos = (d.teams || []).filter((t) => Number(t.category_id) === Number(cat.id));
    const tMap = new Map(equipos.map((t) => [Number(t.id), t]));
    const pareja = (id) => { const t = tMap.get(Number(id)); return t ? (integrantes(t).map(nm.largo).filter(Boolean).join(' & ') || t.name || 'Team') : 'TBD'; };
    const rr = (d.rr || []).filter((m) => Number(m.category_id) === Number(cat.id));
    const br = (d.bracket || []).filter((m) => Number(m.category_id) === Number(cat.id));
    const opciones = [['rr', 'Round robin'], ['results', 'Results']];
    if (br.length) opciones.push(['bracket', 'Bracket']);
    let pestana = actual.pestana && opciones.some((o) => o[0] === actual.pestana) ? actual.pestana : 'rr';
    const nodos = [];

    if (cats.length > 1) {
      nodos.push(h('div', { class: 'ev-chips', role: 'group', 'aria-label': 'Division' }, cats.map((c) => {
        const b = h('button', { type: 'button', class: 'ev-chip', 'data-k': `cat:${c.id}`, 'aria-pressed': Number(c.id) === Number(cat.id) ? 'true' : 'false', text: c.name || 'Division' });
        b.addEventListener('click', () => { actual.cat = c.id; pintarCuerpo(); });
        return b;
      })));
    }

    /* 3A: en curso, "On court now / Up next" de esta división. */
    const vivo = (d.live || []).filter((x) => Number(x.category_id) === Number(cat.id));
    if (d.tournament.status === 'active' && vivo.length) {
      const enCancha = vivo.flatMap((x) => (x.courts || []).filter((c) => c.team_a_id || c.team_b_id).map((c) => ({ ...c, fase: x.phase })));
      const siguen = vivo.flatMap((x) => x.next || []);
      const pausa = vivo.some((x) => x.paused);
      const mio = (c) => mios.has(Number(c.team_a_id)) || mios.has(Number(c.team_b_id));
      nodos.push(h('section', { class: 'ev-vivo', 'aria-label': 'Live courts' },
        pausa ? h('p', { class: 'ev-vivo-pausa', text: 'Courts paused — matches will resume shortly.' }) : null,
        h('h3', { class: 'ev-vivo-h', text: 'On court now' }),
        enCancha.length ? h('ul', { class: 'ev-vivo-lista' }, enCancha.map((c) => h('li', { class: mio(c) ? 'is-yo' : null },
          h('b', { class: 'ev-vivo-c', text: `Court ${c.court}` }), h('span', { text: `${pareja(c.team_a_id)} vs ${pareja(c.team_b_id)}` }),
          c.round ? h('small', { text: RONDA_TXT[c.round] || c.round }) : null)))
          : h('p', { class: 'ev-vivo-v', text: 'No matches on court right now.' }),
        siguen.length ? [h('h3', { class: 'ev-vivo-h', text: 'Up next' }),
          h('ol', { class: 'ev-vivo-lista' }, siguen.map((c) => h('li', { class: mio(c) ? 'is-yo' : null },
            h('span', { text: `${pareja(c.team_a_id)} vs ${pareja(c.team_b_id)}` }), c.round ? h('small', { text: RONDA_TXT[c.round] || c.round }) : null)))] : null));
    }

    nodos.push(pestanas(opciones, pestana, (p) => { actual.pestana = p; pintarCuerpo(); }));

    if (pestana === 'rr') {
      if (!equipos.length) nodos.push(h('p', { class: 'ev-vacio', text: 'No teams yet.' }));
      const grupos = (d.groups || []).filter((g) => Number(g.category_id) === Number(cat.id));
      const conGrupo = grupos.length && equipos.some((t) => t.group_id != null);
      const bloques = conGrupo
        ? grupos.map((g) => ({ titulo: g.name || 'Group', grupo: g.id, eqs: equipos.filter((t) => Number(t.group_id) === Number(g.id)) }))
            .concat(equipos.some((t) => t.group_id == null) ? [{ titulo: 'Unassigned', grupo: null, eqs: equipos.filter((t) => t.group_id == null) }] : [])
            .filter((b) => b.eqs.length)
        : [{ titulo: null, grupo: null, eqs: equipos }];
      bloques.forEach((b) => {
        if (!b.eqs.length) return;
        const ids = new Set(b.eqs.map((t) => Number(t.id)));
        /* Como tournament-results.html: los partidos del grupo por su group_id
           (si no lo tienen, por las parejas). */
        const ms = rr.filter((m) => (b.grupo != null && m.group_id != null ? Number(m.group_id) === Number(b.grupo)
          : ids.has(Number(m.team_a_id)) || ids.has(Number(m.team_b_id))));
        if (b.titulo) nodos.push(h('h3', { class: 'ev-sub', text: b.titulo }));
        if (!ms.some((m) => m.status === 'completed')) { nodos.push(h('p', { class: 'ev-vacio', text: 'No matches played yet.' })); return; }
        const st = standings(b.eqs, ms);
        nodos.push(tabla([
          { t: '#', cls: 'ev-pos', k: (s) => String(st.indexOf(s) + 1) },
          { t: 'Team', cls: 'ev-nom', th: true, k: (s) => [pareja(s.team.id), s.ff ? h('span', { class: 'ev-ff', text: ' (FF)' }) : null, mios.has(Number(s.team.id)) ? tuMarca() : null] },
          { t: 'W–L', k: (s) => `${s.w}–${s.l}` },
          { t: 'Pts', k: (s) => String(s.pf) },
          { t: 'Pts against', extra: true, k: (s) => String(s.pc) },
          { t: 'Diff', k: (s) => conSigno(s.pf - s.pc) },
        ], st, (s) => mios.has(Number(s.team.id)), `${cat.name} round robin${b.titulo ? ` · ${b.titulo}` : ''}`));
      });
    } else if (pestana === 'results') {
      const hechos = rr.filter((m) => m.status === 'completed' || m.status === 'forfeited');
      if (!hechos.length) nodos.push(h('p', { class: 'ev-vacio', text: 'No scores yet.' }));
      [...new Set(hechos.map((m) => m.round))].sort((a, b) => a - b).forEach((r) => {
        nodos.push(h('section', { class: 'ev-ses' }, h('h3', { class: 'ev-ses-h', text: `Round ${r}` }),
          h('div', { class: 'ev-cancha' }, hechos.filter((m) => m.round === r).map((m) => partido(m, pareja, mios)))));
      });
    } else {
      const porRonda = RONDAS.filter((r) => br.some((m) => m.round_name === r));
      nodos.push(h('div', { class: 'ev-bracket' }, porRonda.map((r) => {
        const ms = br.filter((m) => m.round_name === r).sort((a, b) => (a.match_number || 0) - (b.match_number || 0) || a.id - b.id);
        return h('section', { class: 'ev-br-col' }, h('h3', { class: 'ev-ses-h', text: RONDA_TXT[r] || r }),
          ms.map((m, i) => llave(m, ms.length > 1 ? `${RONDA_TXT[r] || r} ${i + 1}` : (RONDA_TXT[r] || r), pareja, mios)));
      })));
    }
    cuerpo.replaceChildren(...nodos);
  }

  function partido(m, pareja, mios) {
    const listo = m.status === 'completed';
    const mio = mios.has(Number(m.team_a_id)) || mios.has(Number(m.team_b_id));
    const ff = (id) => (Number(m.forfeit_team_id) === Number(id) ? ' (FF)' : '');
    return h('div', { class: `ev-juego${mio ? ' is-yo' : ''}` },
      h('span', { class: 'ev-juego-t' },
        h('span', { class: listo && m.winner_id === m.team_a_id ? 'ev-gana' : null, text: pareja(m.team_a_id) + ff(m.team_a_id) }), ' vs ',
        h('span', { class: listo && m.winner_id === m.team_b_id ? 'ev-gana' : null, text: pareja(m.team_b_id) + ff(m.team_b_id) }),
        detalleGames(m) ? h('small', { class: 'ev-games', text: detalleGames(m) }) : null,
        m.court ? h('small', { class: 'ev-games', text: `Court ${m.court}` }) : null),
      h('b', { class: 'ev-juego-s', text: listo ? `${m.score_a ?? '—'}–${m.score_b ?? '—'}` : '—' }));
  }

  function llave(m, titulo, pareja, mios) {
    const listo = m.status === 'completed';
    const bye = m.status === 'bye';
    const lado = (id, score) => {
      const gana = listo && m.winner_id != null && Number(m.winner_id) === Number(id);
      const med = gana && m.round_name === 'Final' ? ' 🥇' : '';
      return h('div', { class: `ev-br-e${gana ? ' is-gana' : ''}${mios.has(Number(id)) ? ' is-yo' : ''}` },
        h('span', { text: id ? `${pareja(id)}${Number(m.forfeit_team_id) === Number(id) ? ' (FF)' : ''}${med}` : (bye ? 'BYE' : 'TBD') }),
        h('b', { text: listo && id ? String(score ?? '') : '' }));
    };
    return h('div', { class: 'ev-br-m' }, h('div', { class: 'ev-br-h', text: titulo }),
      lado(m.team_a_id, m.score_a), lado(m.team_b_id, m.score_b),
      detalleGames(m) ? h('div', { class: 'ev-br-g', text: detalleGames(m) }) : null);
  }

  /* ── Cabecera y cuerpo ── */
  function pintarCabecera() {
    const d = actual.d;
    const esTorneo = d.kind === 'tournament';
    const info = esTorneo ? d.tournament : d.ladder;
    const k = esTorneo
      ? `Tournament · ${conDia(info.date)}`
      : `Ladder · ${info.status === 'completed' && info.end_date ? `${fmt.corto(info.start_date)} – ${fmt.corto(info.end_date)}` : `Since ${fmt.corto(info.start_date)}`}`;
    $('ev-k').textContent = k;
    $('ev-title').textContent = info.name || 'Your event';
    const vivo = info.status === 'active';
    $('ev-live').hidden = !vivo;
    const enl = [];
    if (info.status === 'completed') enl.push(h('a', { class: 'ev-enl ev-enl-lima', href: `#/recap/${esTorneo ? 't' : 'l'}-${info.id}`, text: 'Your recap' }));
    enl.push(h('a', { class: 'ev-enl', href: publica(d.kind, info.id), target: '_blank', rel: 'noopener' }, 'Open public page ', h('span', { 'aria-hidden': 'true', text: '↗' })));
    $('ev-enlaces').replaceChildren(...enl);
    const nota = $('ev-nota');
    nota.hidden = !(esTorneo && d.tournament.emergency_closed);
    nota.textContent = 'This tournament was closed early.';
  }

  function pintarCuerpo() {
    const cuerpo = $('ev-body');
    if (!actual || !actual.d || !cuerpo) return;
    const foco = document.activeElement && cuerpo.contains(document.activeElement) ? document.activeElement.getAttribute('data-k') : null;
    if (actual.d.kind === 'tournament') pintarTorneo(cuerpo);
    else pintarEscalera(cuerpo);
    if (foco) { const el = cuerpo.querySelector(`[data-k="${CSS.escape(foco)}"]`); if (el) el.focus(); }
    /* La primera vez, a la altura de su fila (escalera). */
    if (actual.primera) {
      actual.primera = false;
      const fila = cuerpo.querySelector('tr.is-yo');
      if (fila && typeof fila.scrollIntoView === 'function') {
        requestAnimationFrame(() => { try { fila.scrollIntoView({ block: 'center' }); } catch (_) { /* nada */ } });
      }
    }
  }

  function pararReloj() { if (reloj) { clearInterval(reloj); reloj = null; } }

  async function pintarEvento() {
    const ev = leerRuta(P.rutaParam());
    const err = $('ev-error');
    const cuerpo = $('ev-body');
    const main = $('ev-main');
    if (!cuerpo) return;
    pararReloj();
    const desdeLista = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('.ev-aside'));
    const mia = ++vezEvento;
    err.hidden = true;
    $('ev-live').hidden = true;
    $('ev-nota').hidden = true;
    $('ev-enlaces').replaceChildren();
    $('ev-k').textContent = 'My Events';
    $('ev-title').textContent = 'Loading…';
    cuerpo.replaceChildren(h('p', { class: 'ev-cargando', text: 'Loading the standings…' }));
    main.setAttribute('aria-busy', 'true');
    const fallo = (texto) => { cuerpo.replaceChildren(); $('ev-title').textContent = 'My Events'; err.textContent = texto; err.hidden = false; main.setAttribute('aria-busy', 'false'); };
    if (!ev) { fallo('This event was not found.'); return; }
    try {
      const d = await rpc('portal_evento', { p_kind: ev.kind, p_id: ev.id });
      if (mia !== vezEvento) return;
      if (!d || d.error) { fallo('This event is only for the players who played it.'); return; }
      const mias = new Set((d.my_teams || []).map(Number));
      const catMia = d.kind === 'tournament' ? ((d.teams || []).find((t) => mias.has(Number(t.id))) || {}).category_id : null;
      actual = { kind: ev.kind, id: ev.id, d, cat: catMia, pestana: null, mostradas: SESIONES_POR_VEZ, primera: true };
      pintarCabecera();
      pintarCuerpo();
      if (desdeLista) $('ev-title').focus();
      /* Computadora: la lista a la izquierda (en el teléfono no se ve). */
      pedirLista().then((l) => { if (mia === vezEvento && $('ev-aside')) pintarLista($('ev-aside'), l, ev); }).catch(() => {});
      main.setAttribute('aria-busy', 'false');
      /* 3A: el torneo en curso se pone al día solo mientras se mira. */
      if (d.kind === 'tournament' && d.tournament.status === 'active') {
        reloj = setInterval(() => { refrescarVivo(mia); }, REFRESCO_VIVO_MS);
      }
    } catch (e) {
      if (mia !== vezEvento) return;
      fallo(P.errorTexto(e, {}) || 'We could not load this event. Try again in a moment.');
    }
  }

  let refrescando = false;
  async function refrescarVivo(vez) {
    if (refrescando || vez !== vezEvento || !actual || document.hidden) return;
    if (document.body.dataset.pantalla !== 'event') { pararReloj(); return; }
    refrescando = true;
    try {
      const d = await rpc('portal_evento', { p_kind: actual.kind, p_id: actual.id });
      if (vez !== vezEvento) return;
      if (!d || d.error) { pararReloj(); return; }
      if (JSON.stringify(d) === JSON.stringify(actual.d)) return;   // nada cambió: no se repinta
      actual.d = d;
      pintarCabecera();
      pintarCuerpo();
      if (d.tournament && d.tournament.status !== 'active') pararReloj();
    } catch (_) { /* se intenta en la próxima vuelta */ } finally { refrescando = false; }
  }

  P.alEntrar('home', pintarTarjetas);
  P.alEntrar('profile', pintarTarjetas);
  P.alEntrar('events', pintarEventos);
  P.alEntrar('event', pintarEvento);
  /* Al salir de la pantalla del evento, deja de ponerse al día. */
  window.addEventListener('hashchange', () => { if (!/^#\/event\//.test(location.hash)) pararReloj(); });

  /* Para las pruebas (sin datos). */
  P.eventos = { standings, leerRuta, resultado };
})();
