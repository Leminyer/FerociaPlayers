/* ============================================================
   FEROCIA PLAYER PORTAL — My Identity (FEROCIA Identity, etapa I-1)
   15 de octubre — diseño aprobado (§58, §59)

   Responde de un vistazo: "Who is this player — not only as a
   competitor, but as a member of the community?"

   Junta dos lecturas de la base:
     · portal_mis_datos   (la de siempre: sus datos, escaleras, torneos)
     · portal_mi_identidad (nueva: su gente, sus hitos, su comunidad)
   y pinta, de arriba abajo:
     1. La cabecera: quién es, desde cuándo, con cuántos jugadores ha
        compartido cancha, días en cancha, meses en la comunidad, y una
        frase que lo resume escrita con sus datos.
     2. Your people: parejas habituales y rivales conocidos (con récord).
     3. Your FEROCIA story: el próximo hito y su historia.
     4. Your game: los números (sin amistosos, igual que el Home).
     5. Where you've competed: escaleras y torneos.
     6. Who can find you: public / limited / private (§57: ya se elige;
        hace efecto cuando llegue el matching).
     7. Personal details (sólo los ve él).
   Todo lo que viene de la base se escribe como TEXTO (h()), nunca como
   HTML. Los únicos innerHTML son los iconos fijos de este archivo.
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { sb, h, fmt } = P;
  const $ = (id) => document.getElementById(id);

  const SVG = (d, w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONOS = {
    trofeo: SVG('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
    reloj: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    capas: SVG('<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>'),
    check: SVG('<path d="M20 6 9 17l-5-5"/>'),
    bola: SVG('<circle cx="12" cy="12" r="9"/><path d="M5 5c4 3 4 11 0 14"/><path d="M19 5c-4 3-4 11 0 14"/>'),
    mas: SVG('<path d="M12 5v14"/><path d="M5 12h14"/>'),
    estrella: SVG('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
    bandera: SVG('<path d="M4 21V4"/><path d="M4 4h12l-2 4 2 4H4"/>', 22),
    ok: SVG('<path d="M20 6 9 17l-5-5"/>', 13),
  };
  function icono(nombre, clase) {
    const s = h('span', { class: clase, 'aria-hidden': 'true' });
    s.innerHTML = ICONOS[nombre];   // icono fijo de este archivo (sin datos)
    return s;
  }

  const UMBRALES = [10, 25, 50, 100, 250, 500];
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const nombreCompleto = (p) => fmt.nombre([p.first_name, p.last_name].filter(Boolean).join(' '));

  /* "Hoy" en la hora del club (la misma regla que el resto del portal). */
  const hoyClub = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  function mesesDesde(iso) {
    const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(hoyClub());
    if (!a || !b) return null;
    let m = (+b[1] - +a[1]) * 12 + (+b[2] - +a[2]);
    if (+b[3] < +a[3]) m -= 1;
    return Math.max(0, m);
  }
  /* Aniversarios cumplidos: [{ n: 1, date: '2025-03-10' }, …] */
  function aniversarios(iso) {
    const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!a) return [];
    const hoy = hoyClub();
    const lista = [];
    for (let n = 1; n < 80; n++) {
      const f = `${+a[1] + n}-${a[2]}-${a[3]}`;
      if (f > hoy) break;
      lista.push({ n, date: f });
    }
    return lista;
  }

  /* Desde cuándo es de FEROCIA: su fecha de alta o, si jugó antes (fichas
     que se pasaron al sistema más tarde), el día de su primer juego. */
  function desde(d, id) {
    const alta = (d.player || {}).date_joined || '';
    const primero = (id.first_game && id.first_game.date) || '';
    if (alta && primero) return primero < alta ? primero : alta;
    return alta || primero || '';
  }

  /* ── 1 · La cabecera ── */
  function pintarCabecera(d, id) {
    const p = d.player || {};
    const alta = desde(d, id);
    $('id-ini').textContent = fmt.iniciales(p.first_name, p.last_name, p.email);
    $('id-name').textContent = nombreCompleto(p);
    const lugar = window.FerociaLocation ? window.FerociaLocation.formatLocation(p.city, p.state)
      : [p.city, p.state].filter(Boolean).join(', ');
    $('id-place-t').textContent = lugar || '';
    $('id-place').hidden = !lugar;
    $('id-nudge').hidden = !!(p.city && String(p.city).trim());
    $('id-chips').replaceChildren(
      p.skill_level ? h('span', { class: 'pj-chip pj-chip-lime', text: p.skill_level }) : null,
      alta ? h('span', { class: 'pj-chip', text: `Member since ${fmt.mesAnio(alta)}` }) : null,
      (() => { const c = h('span', { class: 'pj-chip id-chip-ok' }, icono('ok', 'id-ok-ico'), 'Verified'); return c; })());

    const meses = mesesDesde(alta);
    const hecho = (num, texto) => h('div', { class: 'id-fact' },
      h('dt', { class: 'id-fact-l', text: texto }), h('dd', { class: 'id-fact-n', text: num }));
    $('id-facts').replaceChildren(
      hecho(String(id.players_met || 0), id.players_met === 1 ? 'player you\'ve shared the court with' : 'players you\'ve shared the court with'),
      hecho(String(id.days_on_court || 0), id.days_on_court === 1 ? 'day on court at FEROCIA' : 'days on court at FEROCIA'),
      meses == null || meses < 1 ? hecho('New', 'member of the FEROCIA community')
        : hecho(String(meses), meses === 1 ? 'month in the FEROCIA community' : 'months in the FEROCIA community'));

    $('id-statement').replaceChildren(...frase(d, id));
  }

  /* La frase que responde la pregunta, con sus datos (§59: aprobada).
     Devuelve los trozos ya como nodos de texto. */
  function frase(d, id) {
    const p = d.player || {};
    const nombre = fmt.nombre(p.first_name) || 'You';
    const B = (t) => h('strong', { text: t });
    const E = (t) => h('em', { text: t });
    if (!id.games) {
      return ['Welcome to FEROCIA, ', B(nombre), '. Your story starts with your first game.'];
    }
    const titulos = (d.tournaments || []).filter((t) => t.finish === 'Champion')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const fin = titulos.length ? [' and won the ', B(titulos[0].name), '.'] : ['.'];
    const esc = id.main_ladder;
    if (!id.players_met) {
      // Jugó, pero no se sabe con quién (marcadores raros): sin "0 players".
      return esc && esc.name
        ? [B(nombre), ' has played ', B(plural(id.games, 'game', 'games')), ' in the ', E(esc.name), ...fin]
        : [B(nombre), ' has played ', B(plural(id.games, 'game', 'games')), ' at FEROCIA', ...fin];
    }
    const gente = B(plural(id.players_met, 'FEROCIA player', 'FEROCIA players'));
    if (esc && esc.name) {
      if ((esc.games_year || 0) >= 4) {
        return [B(nombre), ' is a ', E(esc.name), ' regular who has played with ', gente, ...fin];
      }
      return [B(nombre), ' has played in the ', E(esc.name), ' and shared the court with ', gente, ...fin];
    }
    const nTorneos = new Set((d.tournaments || []).filter((t) => t.status === 'completed' || t.finish !== 'Registered').map((t) => t.id)).size;
    return [B(nombre), ' has competed in ', E(plural(nTorneos || 1, 'FEROCIA tournament', 'FEROCIA tournaments')),
      ' alongside ', gente, ...fin];
  }

  /* ── 2 · Your people ── */
  const COLORES = ['id-pav-1', 'id-pav-2', 'id-pav-3', 'id-pav-4'];
  function pintarGente(lista, el, texto, vacio, desplaz) {
    if (!lista || !lista.length) {
      el.replaceChildren(h('li', { class: 'id-empty', text: vacio }));
      return;
    }
    el.replaceChildren(...lista.map((x, i) => h('li', { class: 'id-person' },
      h('span', { class: `id-pav ${COLORES[(i + desplaz) % COLORES.length]}`, 'aria-hidden': 'true',
        text: fmt.iniciales(x.first_name, x.last_name, '?') }),
      h('span', { class: 'id-person-t' },
        h('span', { class: 'id-person-n', text: nombreCompleto(x) }),
        h('span', { class: 'id-person-s', text: texto(x.games) })),
      h('span', { class: 'id-rec', 'aria-label': `${x.wins} ${x.wins === 1 ? 'win' : 'wins'}, ${x.losses} ${x.losses === 1 ? 'loss' : 'losses'}`,
        text: `W ${x.wins} · L ${x.losses}` }))));
  }

  /* ── 3 · Your FEROCIA story ── */
  function pintarHistoria(d, id) {
    const p = d.player || {};
    const alta = desde(d, id);
    // Los mismos partidos que "Your game" (y que el Home).
    const juegos = Math.max((d.stats || {}).played || 0, id.games || 0);

    // El próximo hito: el siguiente número de partidos (10, 25, 50…).
    const meta = UMBRALES.find((n) => n > juegos) || (Math.floor(juegos / 500) + 1) * 500;
    const barra = h('span', { class: 'id-bar' }, h('span'));
    const pct = juegos ? Math.min(100, Math.round((juegos / meta) * 100)) : 0;
    barra.firstChild.style.width = pct + '%';   // el ancho, desde aquí (como la barra del Home)
    barra.setAttribute('role', 'progressbar');
    barra.setAttribute('aria-valuemin', '0');
    barra.setAttribute('aria-valuemax', String(meta));
    barra.setAttribute('aria-valuenow', String(juegos));
    barra.setAttribute('aria-label', `${juegos} of ${meta} matches`);
    $('id-next').replaceChildren(
      icono('bandera', 'id-next-ico'),
      h('span', { class: 'id-next-t' },
        h('span', { class: 'id-next-k', text: 'Next milestone' }),
        h('span', { class: 'id-next-n', text: juegos ? `${meta} matches — ${meta - juegos} to go` : 'Your first FEROCIA match' }),
        barra));

    // La historia, de lo más nuevo a lo más viejo. "orden" decide el
    // orden dentro del mismo día (lo de más arriba, primero).
    const hitos = [];
    const add = (date, orden, ico, clase, titulo, sub) => { if (date) hitos.push({ date, orden, ico, clase, titulo, sub }); };
    const conDia = (x) => [x.competition, fmt.largo(x.date)].filter(Boolean).join(' · ');

    const titulos = (d.tournaments || []).filter((t) => t.finish === 'Champion' && t.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (titulos.length) {
      const t = titulos[0];
      add(t.date, 6, 'trofeo', 'id-dot-gold', 'First championship', [t.name, t.category, fmt.mesAnio(t.date)].filter(Boolean).join(' · '));
    }
    (id.game_milestones || []).forEach((m) => add(m.date, 5, 'estrella', '', `${m.n} matches`, fmt.largo(m.date)));
    aniversarios(alta).forEach((a) => add(a.date, 4, 'reloj', '',
      a.n === 1 ? 'One year at FEROCIA' : `${a.n} years at FEROCIA`, fmt.mesAnio(a.date)));
    const fg = id.first_game, fl = id.first_ladder, fw = id.first_win, ft = id.first_tournament;
    const mismoQueJuego = (x) => x && fg && x.date === fg.date && x.competition === fg.competition;
    if (ft && !mismoQueJuego(ft)) add(ft.date, 3, 'capas', '', 'First tournament', conDia(ft));
    if (fw && !mismoQueJuego(fw)) add(fw.date, 2, 'check', '', 'First victory', conDia(fw));
    if (fg) {
      const juntos = [];
      if (fl && mismoQueJuego(fl)) juntos.push('first ladder');
      if (ft && mismoQueJuego(ft)) juntos.push('first tournament');
      if (fw && mismoQueJuego(fw)) juntos.push('first victory');
      add(fg.date, 1, 'bola', '', juntos.length ? `First game & ${juntos.join(' & ')}` : 'First game', conDia(fg));
    }
    if (fl && !mismoQueJuego(fl)) add(fl.date, 1, 'capas', '', 'First ladder', conDia(fl));
    add(alta, 0, 'mas', 'id-dot-lime', 'Joined FEROCIA', fmt.mesAnio(alta));

    hitos.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.orden - a.orden);
    $('id-timeline').replaceChildren(...hitos.map((x) => h('li', { class: 'id-step' },
      icono(x.ico, `id-dot ${x.clase}`.trim()),
      h('span', { class: 'id-step-t' },
        h('span', { class: 'id-step-n', text: x.titulo }),
        h('span', { class: 'id-step-s', text: x.sub })))));
  }

  /* ── 4 · Your game ── */
  function pintarJuego(d, id) {
    const st = d.stats || {};
    const jugados = st.played || 0;
    const pct = jugados ? Math.round(((st.wins || 0) / jugados) * 100) : 0;
    const torneos = d.tournaments || [];
    const titulos = torneos.filter((t) => t.finish === 'Champion').length;
    const podios = torneos.filter((t) => ['Champion', 'Runner-up', '3rd place'].includes(t.finish)).length;
    const dif = id.point_diff || 0;
    const kpi = (num, texto, clase) => h('div', { class: 'id-kpi' },
      h('dt', { class: 'id-kpi-l', text: texto }), h('dd', { class: `id-kpi-n${clase ? ' ' + clase : ''}`, text: num }));
    $('id-kpis').replaceChildren(
      kpi(String(jugados), 'Games'),
      kpi(`${st.wins || 0}–${st.losses || 0}`, 'W–L'),
      kpi(jugados ? `${pct}%` : '—', 'Win rate'),
      kpi(dif > 0 ? `+${dif}` : String(dif), 'Point diff.', dif > 0 ? 'is-up' : ''),
      kpi(String(titulos), titulos === 1 ? 'Title' : 'Titles'),
      kpi(String(podios), podios === 1 ? 'Podium' : 'Podiums'));

    // Forma reciente: de la más vieja (izquierda) a la más nueva (derecha).
    const forma = (id.form || []).slice().reverse();
    if (!forma.length) { $('id-form').replaceChildren(); $('id-form').hidden = true; return; }
    $('id-form').hidden = false;
    $('id-form').replaceChildren(
      h('span', { class: 'id-form-l', text: 'Recent form' }),
      h('span', { class: 'id-form-dots', role: 'img',
        'aria-label': `Last ${forma.length} games, oldest to newest: ${forma.map((r) => (r === 'win' ? 'win' : 'loss')).join(', ')}` },
      ...forma.map((r) => h('span', { class: `id-fd ${r === 'win' ? 'id-fd-w' : 'id-fd-l'}`, 'aria-hidden': 'true', text: r === 'win' ? 'W' : 'L' }))));
  }

  /* ── 5 · Where you've competed ── */
  function pintarHistorial(d) {
    const filas = [];
    (d.ladders || []).forEach((l) => {
      const activa = l.status === 'active';
      filas.push({
        fecha: l.start_date || '', tipo: 'lad', marca: l.rank ? `#${l.rank}` : '—', nombre: l.name,
        sub: activa ? `${fmt.mesAnio(l.start_date)} · playing now` : fmt.mesAnio(l.start_date),
        res: l.rank ? (activa ? `#${l.rank} now` : `Final #${l.rank}`) : (activa ? 'Playing' : 'Played'), oro: false,
      });
    });
    (d.tournaments || []).forEach((t) => {
      filas.push({
        fecha: t.date || '', tipo: 'tro', nombre: t.name,
        sub: [t.category, fmt.mesAnio(t.date)].filter(Boolean).join(' · '),
        res: t.finish || '', oro: t.finish === 'Champion',
      });
    });
    filas.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    if (!filas.length) {
      $('id-hist').replaceChildren(h('li', { class: 'id-empty', text: 'Your ladders and tournaments will show up here.' }));
      return;
    }
    $('id-hist').replaceChildren(...filas.slice(0, 8).map((f) => h('li', { class: 'id-h' },
      f.tipo === 'lad' ? h('span', { class: 'id-h-ico id-h-lad', 'aria-hidden': 'true', text: f.marca })
        : icono('trofeo', 'id-h-ico id-h-tro'),
      h('span', { class: 'id-h-t' },
        h('span', { class: 'id-h-n', text: f.nombre }),
        h('span', { class: 'id-h-s', text: f.sub })),
      h('span', { class: `id-h-r${f.oro ? ' is-gold' : ''}`, text: f.res }))));
  }

  /* ── 6 · Who can find you ──
     Se guarda un instante después de elegir (con las flechas del teclado
     se pasa por las otras opciones: sólo cuenta la última). Las opciones
     nunca se desactivan, para no quitarle el foco a quien usa teclado. */
  let visibilidad = 'limited';     // lo que está guardado en la base
  let cambiosVis = 0;              // cuántas veces la cambió en esta visita
  let relojVis = null;
  let guardandoVis = false;
  function marcarVisibilidad(v) {
    document.querySelectorAll('input[name="id-vis"]').forEach((r) => { r.checked = r.value === v; });
  }
  async function guardarVisibilidad() {
    const r = document.querySelector('input[name="id-vis"]:checked');
    if (!r || r.value === visibilidad) return;
    if (guardandoVis) { relojVis = setTimeout(guardarVisibilidad, 300); return; }
    const nueva = r.value;
    guardandoVis = true;
    try {
      const { error } = await sb.rpc('portal_guardar_privacidad', { p_visibility: nueva });
      if (error) throw error;
      visibilidad = nueva;
      P.olvidarDatos();
      P.aviso(nueva === 'public' ? 'Saved: your identity is public.'
        : nueva === 'private' ? 'Saved: your identity is private.' : 'Saved: your identity is limited.');
    } catch (err) {
      console.warn('[portal] privacidad:', err);
      marcarVisibilidad(visibilidad);
      P.aviso(P.errorTexto(err), true);
    } finally {
      guardandoVis = false;
    }
  }
  $('id-priv').addEventListener('change', (ev) => {
    if (!ev.target || ev.target.name !== 'id-vis') return;
    cambiosVis += 1;
    clearTimeout(relojVis);
    relojVis = setTimeout(guardarVisibilidad, 600);
  });

  /* ── 7 · Personal details ── */
  function pintarDatos(d) {
    const p = d.player || {};
    const par = (dt, dd) => h('div', null, h('dt', { text: dt }), h('dd', { text: dd || '—' }));
    $('id-details').replaceChildren(
      par('Email', p.email),
      par('Mobile', fmt.telefono(p.phone)),
      par('Date of birth', fmt.largo(p.date_of_birth)),
      par('Gender', p.gender));
  }

  /* ── Al entrar ── */
  let vez = 0;
  P.alEntrar('profile', async () => {
    const mia = ++vez;
    const cambiosAlEmpezar = cambiosVis;
    $('id-error').hidden = true;
    $('id-main').setAttribute('aria-busy', 'true');
    let d, id;
    try {
      [d, id] = await Promise.all([
        P.datos(),
        sb.rpc('portal_mi_identidad').then(({ data, error }) => { if (error) throw error; return data || {}; }),
      ]);
    } catch (err) {
      if (mia !== vez) return;
      console.warn('[portal] my identity:', err);
      $('id-error').textContent = P.errorTexto(err);
      $('id-error').hidden = false;
      $('id-main').setAttribute('aria-busy', 'false');
      return;
    }
    if (mia !== vez) return;
    pintarCabecera(d, id);
    pintarGente(id.partners, $('id-partners'), (n) => plural(n, 'game together', 'games together'),
      'Your regular partners will show up here after a few games.', 0);
    pintarGente(id.opponents, $('id-opponents'), (n) => (n === 1 ? 'Faced once' : `Faced ${n} times`),
      'The players you face most will show up here.', 3);
    pintarHistoria(d, id);
    pintarJuego(d, id);
    pintarHistorial(d);
    /* Si eligió otra opción mientras esto cargaba, manda la suya (la
       lectura de la base es de antes). */
    if (!guardandoVis) visibilidad = (d.player && d.player.profile_visibility) || 'limited';
    if (cambiosVis === cambiosAlEmpezar) marcarVisibilidad(visibilidad);
    else { clearTimeout(relojVis); relojVis = setTimeout(guardarVisibilidad, 0); }
    pintarDatos(d);
    $('id-main').setAttribute('aria-busy', 'false');
  });
})();
