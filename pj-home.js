/* ============================================================
   FEROCIA PLAYER PORTAL — Home (SQL 105, §85)

   1. "What brings you in today?": 6 opciones fijas (siempre en el mismo
      sitio, para que nadie tenga que buscar). Cada una trae un dato del
      momento (portal_home_resumen) y, si hace falta, una pregunta más
      con botones. Nada de chat ni de bot: sólo botones.
   2. "Your game, in numbers": sus números y gráficas
      (portal_mi_rendimiento), con el rango (4 weeks / 6 months / All
      time) y de dónde vienen (All / Ladders & tournaments / Play).
   3. Abajo, lo de antes más compacto: Recent results, eventos y el
      Video of the Month (portal_mis_datos y portal_mis_partidos).

   Sólo datos de quien entra. El rating del coach NO se enseña (§44).
   Si el SQL 105 todavía no está, el Home se ve igual de bien con lo de
   antes (sin gráficas).
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { h, fmt } = P;
  const $ = (id) => document.getElementById(id);
  const ZONA = 'America/New_York';
  const MESES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DIAS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const OPCIONES = ['now', 'plan', 'open', 'matches', 'log', 'stats'];
  const menosMovimiento = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Fechas "AAAA-MM-DD" (se leen tal cual, sin zonas horarias) ── */
  const aFecha = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const aIso = (dt) => dt.toISOString().slice(0, 10);
  const sumar = (iso, n) => { const d = aFecha(iso); d.setUTCDate(d.getUTCDate() + n); return aIso(d); };
  const diaSemana = (iso) => aFecha(iso).getUTCDay();
  const mesDe = (iso) => String(iso).slice(0, 7);
  const primeroDeMes = (iso, atras) => { const d = aFecha(String(iso).slice(0, 8) + '01'); d.setUTCMonth(d.getUTCMonth() - (atras || 0)); return aIso(d); };
  const finDeMes = (iso) => { const d = aFecha(primeroDeMes(iso)); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return aIso(d); };
  const nombreMes = (iso) => MESES[aFecha(iso).getUTCMonth()];
  const hoyClub = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const pctDe = (w, n) => (n ? Math.round((w / n) * 100) : null);

  function saludo() {
    const hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
    return hora < 12 ? 'Good morning' : hora < 18 ? 'Good afternoon' : 'Good evening';
  }

  /* Ir a otra pantalla y, si se pide, a una parte de ella (cuando ya se ve). */
  function irA(ruta, seccion) {
    location.hash = ruta;
    if (!seccion) return;
    const fin = Date.now() + 5000;
    const mirar = () => {
      const el = $(seccion);
      if (el && !el.hidden && el.offsetParent !== null && !el.closest('[aria-busy="true"]')) {
        el.scrollIntoView({ behavior: menosMovimiento() ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      if (Date.now() < fin) setTimeout(mirar, 150);
    };
    setTimeout(mirar, 150);
  }

  /* ════════════════ 1. "WHAT BRINGS YOU IN TODAY?" ════════════════ */
  let res = null;          // portal_home_resumen (null si falla o aún no llega)
  let elegida = null;      // la opción elegida
  let planDia = null;      // Today / Tomorrow / This weekend / Pick a date
  let quiere = null;       // la intención elegida para "Right now"

  const BLOQUEO = {
    suspended: ['Your access to Play is paused', 'Paused — see Play', 'Open Play →', '#/play'],
    members: ['Play is for FEROCIA members', 'For FEROCIA members', 'See how to join →', '#/play'],
    hidden: ["You're set to Private, so you don't appear in Play — and you don't see other players. Switch to Limited in My Identity to use it.",
      'Switch to Limited to use Play', 'Go to My Identity →', '#/profile'],
  };
  const SIN_DNA = ['Finish your Player DNA so Play can match you with the right players.', 'Finish your Player DNA first', 'Finish my DNA →', '#/dna'];
  const bloqueo = () => (res && res.state === 'hidden' && res.has_dna === false ? SIN_DNA : (res && BLOQUEO[res.state])) || null;
  const intenciones = () => ((P.dnaTextos && P.dnaTextos.INTENCIONES) || []);
  const textoIntencion = (code) => ((intenciones().find((x) => x[0] === code) || [])[1] || '');

  function cuandoCorto(iso) {
    const d = new Date(iso);
    const dia = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, weekday: 'short', month: 'short', day: 'numeric' }).format(d);
    const hora = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' }).format(d);
    return `${dia}, ${hora}`;
  }
  /* "today's", "yesterday's" o "Saturday's" (el día del juego, en el club). */
  function diaDe(iso) {
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
    const hoy = hoyClub();
    if (dia === hoy) return "today's";
    if (dia === sumar(hoy, -1)) return "yesterday's";
    return `${DIAS[diaSemana(dia)]}'s`;
  }

  function pintarPista(op, texto, etiqueta, viva) {
    $(`hm-oh-${op}`).textContent = texto;
    const tag = $(`hm-ot-${op}`);
    tag.textContent = etiqueta || '';
    tag.hidden = !etiqueta;
    tag.classList.toggle('is-live', !!viva);
  }

  function pintarPistas() {
    const b = bloqueo();
    const r = res || {};
    const usual = (op) => (r.usual === op ? 'Your usual' : null);
    if (b) {
      ['now', 'plan', 'open', 'matches', 'log'].forEach((op) => pintarPista(op, b[1], usual(op)));
    } else if (!res) {
      pintarPista('now', 'See who’s up for a game');
      pintarPista('plan', 'Pick a day — compatible players see it');
      pintarPista('open', 'Games you can join');
      pintarPista('matches', 'Players who fit your game');
      pintarPista('log', 'Add the scores in under a minute');
    } else {
      if (r.now > 0) pintarPista('now', `${plural(r.now, 'compatible player is', 'compatible players are')} up for a game`, 'Live', true);
      else if (r.intent) pintarPista('now', `You're showing: ${textoIntencion(r.intent) || 'Right now'}`, usual('now'));
      else pintarPista('now', 'Let compatible players know you’re up for it', usual('now'));
      pintarPista('plan', r.hosting ? `You're hosting ${cuandoCorto(r.hosting.plays_at)}` : 'Pick a day — compatible players see it', usual('plan'));
      pintarPista('open', r.open_week >= 9 ? '9+ open games at your level this week'
        : r.open_week > 0 ? `${plural(r.open_week, 'open game', 'open games')} at your level this week` : 'None yet this week — post one', usual('open'));
      let m;
      if (r.great > 0) m = `${plural(r.great, 'Great match', 'Great matches')}${r.new_players > 0 ? ` · ${r.new_players} new` : ''}`;
      else if (r.recommended > 0) m = `${plural(r.recommended, 'player', 'players')} recommended for you`;
      else m = 'Your matches are on their way';
      pintarPista('matches', m, usual('matches'));
      pintarPista('log', 'Add the scores in under a minute', usual('log'));
    }
    pintarPista('stats', pistaNumeros(), usual('stats'));
  }

  /* Lo que el jugador tiene pendiente: un botón blanco arriba. */
  function pintarPendiente() {
    const a = $('hm-task');
    const r = res;
    if (!r || r.state === 'suspended') { a.hidden = true; return; }
    let texto = null, ruta = null, seccion = null, total = 0;
    const t = r.task;
    if (t) {
      ruta = `#/game/${t.id}`;
      total = r.tasks || 1;
      if (t.todo === 'confirm') texto = `Confirm ${diaDe(t.plays_at)} result`;
      else if (t.todo === 'link') texto = `${t.reporter || 'A player'} added you to a game`;
      else if (t.todo === 'correct') texto = `Fix ${diaDe(t.plays_at)} result`;
      else texto = `Add the scores of ${diaDe(t.plays_at)} game`;
    } else if (r.invited > 0) {
      texto = r.invited === 1 ? "You're invited to a game" : `You're invited to ${r.invited} games`; ruta = '#/play'; seccion = 'gm-mine-sec'; total = r.invited;
    } else if (r.requests > 0 && r.hosting) {
      texto = `${plural(r.requests, 'player wants', 'players want')} to join your game`; ruta = `#/game/${r.hosting.id}`; total = r.requests;
    } else if (r.unread > 0) {
      texto = `${plural(r.unread, 'new message', 'new messages')} in your games`; ruta = '#/play'; seccion = 'gm-mine-sec'; total = r.unread;
    }
    if (!texto) { a.hidden = true; return; }
    $('hm-task-n').textContent = String(Math.max(total, 1));
    $('hm-task-n').hidden = total < 1;
    $('hm-task-t').textContent = `${texto} →`;
    a.setAttribute('href', ruta);
    a.dataset.seccion = seccion || '';
    a.hidden = false;
  }
  $('hm-task').addEventListener('click', (ev) => {
    olvidarResumen();
    const sec = ev.currentTarget.dataset.seccion;
    if (!sec) return;
    ev.preventDefault();
    irA(ev.currentTarget.getAttribute('href'), sec);
  });

  /* ── El segundo paso ── */
  const boton = (texto, clase, alPulsar, extra) => {
    const b = h('button', Object.assign({ type: 'button', class: clase, text: texto }, extra || {}));
    b.addEventListener('click', alPulsar);
    return b;
  };
  const enlace = (texto, clase, ruta, seccion) => {
    const a = h('a', { class: clase, href: ruta, text: texto });
    if (seccion) a.addEventListener('click', (ev) => { ev.preventDefault(); irA(ruta, seccion); });
    return a;
  };
  const fichas = (lista, actual, alElegir, etiqueta) => h('div', { class: 'hm-chips', role: 'group', 'aria-label': etiqueta },
    lista.map(([code, texto]) => boton(texto, 'hm-chip', () => alElegir(code), { 'aria-pressed': String(actual === code) })));

  function fechaPlan(code) {
    const hoy = hoyClub();
    if (code === 'today') return hoy;
    if (code === 'tomorrow') return sumar(hoy, 1);
    if (code === 'weekend') { const ds = diaSemana(hoy); return ds === 6 || ds === 0 ? hoy : sumar(hoy, 6 - ds); }
    return null;
  }

  let guardando = false;
  async function avisarAhora(btn) {
    if (guardando || !quiere) return;
    guardando = true;
    btn.disabled = true;
    try {
      const { error } = await P.sb.rpc('portal_guardar_intencion', { p_intent: quiere });
      if (error) throw error;
      if (res) { res.intent = quiere; }
      P.aviso(`You're showing: ${textoIntencion(quiere)}. It clears on its own.`);
      irA('#/play', 'pl-now-sec');
    } catch (e) {
      console.warn('[portal] home, right now:', e);
      P.aviso(P.errorTexto(e), true);
      btn.disabled = false;
    } finally { guardando = false; }
  }

  function pintarPaso() {
    const caja = $('hm-step');
    const fila = [];
    const b = bloqueo();
    const accion = (texto, ruta, seccion) => enlace(texto, 'hm-go', ruta, seccion);
    const r = res || {};
    if (!elegida) {
      const a = h('a', { class: 'hm-step-link', href: '#hm-numbers', text: 'Just look around ↓' });
      a.addEventListener('click', (ev) => { ev.preventDefault(); bajarANumeros(); });
      fila.push(h('span', { class: 'hm-step-t hm-step-soft' }, 'Not sure? ', a));
    } else if (elegida === 'stats') {
      fila.push(h('span', { class: 'hm-step-t', text: 'Your numbers are right below.' }));
      const a = h('a', { class: 'hm-go', href: '#hm-numbers', text: 'Take me there ↓' });
      a.addEventListener('click', (ev) => { ev.preventDefault(); bajarANumeros(); });
      fila.push(a);
    } else if (b) {
      fila.push(h('span', { class: 'hm-step-t', text: b[0] }), accion(b[2], b[3]));
    } else if (elegida === 'now') {
      const ya = r.intent ? `You're showing “${textoIntencion(r.intent)}” right now. ` : '';
      if (!quiere && r.intent) quiere = r.intent;
      fila.push(h('span', { class: 'hm-step-t', text: `${ya}What are you up for?` }));
      fila.push(fichas(intenciones(), quiere, (c) => { quiere = c; pintarPaso(); }, 'What are you up for?'));
      const go = boton(r.intent && quiere === r.intent ? 'See who’s on →' : 'Let them know →', 'hm-go', (ev) => {
        if (r.intent && quiere === r.intent) irA('#/play', 'pl-now-sec'); else avisarAhora(ev.currentTarget);
      }, { disabled: !quiere });
      fila.push(h('span', { class: 'hm-step-acts' },
        enlace('Just see who’s on', 'hm-ghost', '#/play', 'pl-now-sec'), go));
      fila.push(h('span', { class: 'hm-step-note', text: 'Compatible players see it in Play. It clears on its own.' }));
    } else if (elegida === 'plan') {
      if (r.hosting) {
        fila.push(h('span', { class: 'hm-step-t', text: `You're already hosting a game: ${cuandoCorto(r.hosting.plays_at)}.` }),
          accion('Open your game →', `#/game/${r.hosting.id}`));
      } else {
        fila.push(h('span', { class: 'hm-step-t', text: 'When do you want to play?' }));
        fila.push(fichas([['today', 'Today'], ['tomorrow', 'Tomorrow'], ['weekend', 'This weekend'], ['pick', 'Pick a date']],
          planDia, (c) => { planDia = c; pintarPaso(); }, 'When do you want to play?'));
        const dia = fechaPlan(planDia);
        const ir = enlace('Create the game →', 'hm-go', dia ? `#/game-form/d-${dia}` : '#/game-form');
        if (!planDia) { ir.setAttribute('aria-disabled', 'true'); ir.setAttribute('tabindex', '-1'); ir.classList.add('is-off'); ir.addEventListener('click', (ev) => ev.preventDefault()); }
        fila.push(ir);
      }
    } else if (elegida === 'open') {
      if (r.open_week > 0) fila.push(h('span', { class: 'hm-step-t', text: r.open_week >= 9 ? '9+ open games at your level this week.' : `${plural(r.open_week, 'open game', 'open games')} at your level this week.` }), accion('See open games →', '#/play', 'gm-open-sec'));
      else fila.push(h('span', { class: 'hm-step-t', text: 'No open games at your level this week yet. Post one and compatible players will see it.' }), accion('Create a game →', '#/game-form'));
    } else if (elegida === 'matches') {
      if (r.recommended > 0) fila.push(h('span', { class: 'hm-step-t', text: r.great > 0 ? `${plural(r.great, 'player is a Great match', 'players are a Great match')} for you.` : `${plural(r.recommended, 'player is', 'players are')} recommended for you.` }), accion('See my matches →', '#/play', 'pl-recs-sec'));
      else fila.push(h('span', { class: 'hm-step-t', text: 'Your matches are on their way. Play has new players and familiar faces too.' }), accion('Open Play →', '#/play'));
    } else if (elegida === 'log') {
      fila.push(h('span', { class: 'hm-step-t', text: 'Played a game we didn’t plan here? Add it in under a minute.' }), accion('Log it →', '#/log-game'));
    }
    caja.replaceChildren(...fila);
  }

  function elegir(op) {
    olvidarResumen();   // al volver, lo pendiente puede haber cambiado
    elegida = op;
    OPCIONES.forEach((o) => $(`hm-o-${o}`).setAttribute('aria-pressed', String(o === op)));
    pintarPaso();
    if (op === 'stats') bajarANumeros();
    /* Para "Your usual" (si falla, no pasa nada). */
    P.sb.rpc('portal_home_elegir', { p_choice: op }).then(({ error }) => { if (error) console.warn('[portal] home, elegir:', error.message); }, () => {});
  }
  OPCIONES.forEach((op) => $(`hm-o-${op}`).addEventListener('click', () => elegir(op)));

  function bajarANumeros() {
    const t = $('hm-num-t');
    t.scrollIntoView({ behavior: menosMovimiento() ? 'auto' : 'smooth', block: 'start' });
    t.focus({ preventScroll: true });
  }

  /* El resumen tarda más (usa lo mismo que Play): no se espera para pintar
     el Home, y se guarda un minuto si el jugador vuelve sin hacer nada. */
  let guardado = null;   // { t, v }
  let generacion = 0;    // sube cada vez que se olvida: una respuesta vieja no se guarda
  function olvidarResumen() { guardado = null; generacion++; }
  function traerResumen(mia) {
    if (guardado && Date.now() - guardado.t < 60000) { res = guardado.v; return Promise.resolve(); }
    const gen = generacion;
    return P.sb.rpc('portal_home_resumen').then(({ data, error }) => {
      if (error) throw error;
      if (gen === generacion) guardado = { t: Date.now(), v: data };
      if (mia === vez) res = data;
    }).catch((e) => { console.warn('[portal] home, resumen:', e); });
  }

  /* ════════════════ 2. "YOUR GAME, IN NUMBERS" ════════════════ */
  let rend = null;      // portal_mi_rendimiento
  let datos = null;     // portal_mis_datos
  const filtro = { rango: '6m', fuente: 'all' };
  let hoy = hoyClub();

  const FUENTE = { all: () => true, official: (g) => g.s === 'ladder' || g.s === 'tournament', play: (g) => g.s === 'play' || g.s === 'self' };
  const juegos = () => ((rend && rend.games) || []);
  const deFuente = (lista) => lista.filter(FUENTE[filtro.fuente] || FUENTE.all);
  const resumen = (lista) => { const w = lista.filter((g) => g.r === 'w').length; return { n: lista.length, w, l: lista.length - w, pct: pctDe(w, lista.length) }; };
  const persona = (i) => (rend && rend.people && rend.people[i]) || { n: 'A player', card: null };
  const nombre = (i) => fmt.nombre(persona(i).n);

  /* Los periodos de las barras según el rango. */
  function periodos() {
    if (filtro.rango === '4w') {
      return [3, 2, 1, 0].map((k) => {
        const to = sumar(hoy, -7 * k), from = sumar(to, -6);
        return { from, to, label: k === 0 ? 'This week' : fmt.corto(from), now: k === 0 };
      });
    }
    let n = 6, paso = 1;
    if (filtro.rango === 'all') {
      const prim = deFuente(juegos())[0];
      const meses = prim ? (aFecha(hoy).getUTCFullYear() - aFecha(prim.d).getUTCFullYear()) * 12 + aFecha(hoy).getUTCMonth() - aFecha(prim.d).getUTCMonth() + 1 : 1;
      // Meses; si son muchos, trimestres o años de calendario (que empiecen
      // antes o el mes de su primer juego).
      const atras = meses - 1, mh = aFecha(hoy).getUTCMonth();
      if (meses <= 12) n = Math.max(meses, 2);
      else if (meses <= 36) { paso = 3; n = Math.ceil(Math.max(atras - (mh % 3), 0) / 3) + 1; }
      else { paso = 12; n = Math.ceil(Math.max(atras - mh, 0) / 12) + 1; }
    }
    const lista = [];
    const mesHoy = aFecha(hoy).getUTCMonth();
    const desfase = paso === 3 ? mesHoy % 3 : paso === 12 ? mesHoy : 0;
    for (let k = n - 1; k >= 0; k--) lista.push({ from: primeroDeMes(hoy, k * paso + desfase) });
    // Cada periodo acaba el día antes del siguiente; el último, hoy.
    lista.forEach((p, i) => { p.to = i === lista.length - 1 ? hoy : sumar(lista[i + 1].from, -1); });
    return lista.map((p, i) => {
      const fin = i === lista.length - 1;
      let label;
      if (paso === 1) label = MESES[aFecha(p.from).getUTCMonth()].slice(0, 3);
      else if (paso === 3) label = `Q${Math.floor(aFecha(p.from).getUTCMonth() / 3) + 1} '${String(aFecha(p.from).getUTCFullYear()).slice(2)}`;
      else label = String(aFecha(p.from).getUTCFullYear());
      return Object.assign(p, { label, now: fin });
    });
  }
  const enRango = (lista, per) => lista.filter((g) => g.d >= per[0].from && g.d <= hoy);

  /* Cuenta hacia arriba (si el aparato lo permite). */
  function numero(el, valor, sufijo) {
    const fin = Number(valor);
    if (!Number.isFinite(fin) || menosMovimiento() || fin < 2) { el.textContent = `${valor}${sufijo || ''}`; return; }
    const t0 = performance.now(), dur = 700;
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = `${Math.round(fin * (1 - Math.pow(1 - k, 3)))}${sufijo || ''}`;
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }
  function tarjeta(etiqueta, valor, sufijo, sub, oscura, extra) {
    const n = h('span', { class: 'hm-kpi-n' });
    if (valor == null) n.textContent = '—'; else numero(n, valor, sufijo);
    return h('div', { class: `hm-kpi${oscura ? ' is-dark' : ''}` },
      h('span', { class: 'hm-kpi-l', text: etiqueta }),
      h('span', { class: 'hm-kpi-v' }, n, extra ? h('span', { class: 'hm-kpi-x', text: extra }) : null),
      sub ? h('span', { class: `hm-kpi-s${sub.ok ? ' is-up' : ''}`, text: sub.t }) : null);
  }

  /* Rachas sobre una lista ordenada (del más viejo al más nuevo). */
  function rachas(lista) {
    let mejor = 0, run = 0, mejorFin = null;
    lista.forEach((g) => { run = g.r === 'w' ? run + 1 : 0; if (run > mejor) { mejor = run; mejorFin = g.d; } });
    let actual = 0; const tipo = lista.length ? lista[lista.length - 1].r : null;
    for (let i = lista.length - 1; i >= 0 && lista[i].r === tipo; i--) actual++;
    return { actual, tipo, mejor, mejorFin };
  }

  function escaleraActiva() {
    return ((datos && datos.ladders) || []).find((x) => x.status === 'active' && x.rank) || null;
  }

  function pintarKpis(per) {
    const lista = deFuente(juegos());
    const rango = resumen(enRango(lista, per));
    const mes = lista.filter((g) => mesDe(g.d) === mesDe(hoy)).length;
    const ra = rachas(lista);
    const l = escaleraActiva();
    const cards = [
      tarjeta('Games played', rango.n, '', { t: mes ? `+${mes} this month` : 'None yet this month', ok: mes > 0 }),
      tarjeta('Win rate', rango.pct, '%', rango.n ? { t: `${plural(rango.w, 'win', 'wins')} · ${plural(rango.l, 'loss', 'losses')}` } : { t: 'No games in this period' }),
      tarjeta('Current streak', ra.actual ? ra.actual : null, ra.tipo === 'w' ? (ra.actual === 1 ? ' win' : ' wins') : (ra.actual === 1 ? ' loss' : ' losses'),
        { t: ra.tipo === 'l' ? 'The next one’s yours' : ra.mejor ? `Your best ever: ${ra.mejor}` : 'Play your first game to start one' }, true),
    ];
    if (l && filtro.fuente !== 'play') {
      let detras = null;
      if (l.rank === 1) detras = 'Leading the ladder';
      else if (Number(l.behind) === 0) detras = 'Tied on points with the spot above';
      else if (l.behind != null) detras = `${plural(Number(l.behind), 'point', 'points')} from #${l.rank - 1}`;
      cards.push(tarjeta(l.name, `#${l.rank}`, '', detras ? { t: detras } : null, false, ` of ${l.players}`));
    } else {
      const dias = new Set(lista.filter((g) => mesDe(g.d) === mesDe(hoy)).map((g) => g.d)).size;
      cards.push(tarjeta('Days on court', dias, '', { t: `In ${nombreMes(hoy)}` }));
    }
    $('hm-kpis').replaceChildren(...cards);
  }

  /* La frase del mes (todo junto: escaleras, torneos y Play). */
  function frase() {
    const todos = juegos();
    if (!todos.length) return null;
    const ahora = mesDe(hoy);
    const mes = todos.filter((g) => mesDe(g.d) === ahora);
    const m = resumen(mes);
    const porMes = {};
    todos.forEach((g) => { const k = mesDe(g.d); (porMes[k] = porMes[k] || []).push(g); });
    const otros = Object.entries(porMes).filter(([k, v]) => k !== ahora && v.length >= 5).map(([k, v]) => ({ k, r: resumen(v) }));
    const ra = rachas(todos);
    const nm = nombreMes(hoy);
    const cam = rend.ladder && rend.ladder.sessions;
    if (m.n >= 5 && otros.length >= 2 && otros.every((o) => m.pct > o.r.pct)) {
      const primero = otros.sort((a, b) => a.k.localeCompare(b.k))[0];
      return { t: `Your best month yet: you won ${m.pct}% of your games in ${nm}.`, s: `That's up from ${primero.r.pct}% in ${nombreMes(primero.k + '-01')}.` };
    }
    if (ra.tipo === 'w' && ra.actual >= 3) return { t: `You're on a ${ra.actual}-game winning streak.`, s: ra.actual >= ra.mejor ? 'Your best ever. Keep it going.' : `Your best ever is ${ra.mejor}.` };
    if (cam && cam.length >= 2 && cam[0].rank - cam[cam.length - 1].rank >= 2) {
      return { t: `You've climbed ${cam[0].rank - cam[cam.length - 1].rank} spots in ${rend.ladder.name}.`, s: `From #${cam[0].rank} to #${cam[cam.length - 1].rank}.` };
    }
    const antes = (porMes[mesDe(primeroDeMes(hoy, 1))] || []).length;
    if (m.n > 0 && m.n > antes && antes > 0) return { t: `${plural(m.n, 'game', 'games')} in ${nm} — already more than last month.`, s: `${plural(m.w, 'win', 'wins')} so far.` };
    if (m.n > 0) return { t: `${plural(m.n, 'game', 'games')} and ${plural(m.w, 'win', 'wins')} so far in ${nm}.`, s: 'Every game shows up here.' };
    const ult = todos[todos.length - 1].d;
    const dias = Math.round((aFecha(hoy) - aFecha(ult)) / 86400000);
    return { t: dias <= 1 ? 'Your last game was yesterday.' : `It's been ${dias} days since your last game.`, s: 'Ready for the next one?', plan: true };
  }

  function pintarFrase() {
    const f = frase();
    $('hm-banner').hidden = !f;
    if (!f) return;
    $('hm-banner-t').textContent = f.t;
    $('hm-banner-s').textContent = f.s;
    const mes = juegos().filter((g) => mesDe(g.d) === mesDe(hoy));
    $('hm-share').hidden = !mes.length || typeof P.imagenMes !== 'function';
    if (!$('hm-share').hidden) prepararImagen();
  }

  /* "Share my month": la imagen se prepara en cuanto hay números. */
  let imagen = null;   // { datos, promesa, blob }
  function datosMes() {
    const mes = juegos().filter((g) => mesDe(g.d) === mesDe(hoy));
    const r = resumen(mes);
    const l = escaleraActiva();
    const e = (datos && datos.player) || P.estado() || {};
    return { nombre: fmt.nombre(e.first_name || ''), mes: nombreMes(hoy), anio: aFecha(hoy).getUTCFullYear(),
      juegos: r.n, ganados: r.w, pct: r.pct, racha: rachas(juegos()), escalera: l ? { nombre: l.name, puesto: l.rank, de: l.players } : null };
  }
  function prepararImagen() {
    const d = datosMes();
    if (imagen && JSON.stringify(imagen.datos) === JSON.stringify(d)) return;
    const x = { datos: d, blob: null };
    // Se dibuja cuando el aparato está libre (no frena el Home).
    x.promesa = new Promise((ok) => (window.requestIdleCallback ? window.requestIdleCallback(ok, { timeout: 3000 }) : setTimeout(ok, 800)))
      .then(() => P.imagenMes(d)).then((b) => { x.blob = b; return b; });
    x.promesa.catch(() => {});
    imagen = x;
  }

  function pista(texto) { return h('p', { class: 'hc-empty', text: texto }); }

  function pintarBarras(per) {
    const lista = deFuente(juegos());
    const datosB = per.map((p) => {
      const r = resumen(lista.filter((g) => g.d >= p.from && g.d <= p.to));
      return { label: p.label, value: r.n ? r.pct : null, now: p.now, n: r.n,
        title: r.n ? `${p.label}: ${r.pct}% (${plural(r.n, 'game', 'games')})` : `${p.label}: no games` };
    });
    const conJuegos = datosB.filter((d) => d.value != null);
    const caja = $('hm-c-rate');
    $('hm-c-rate-t').textContent = filtro.rango === '4w' ? 'Win rate by week' : (per.length && per[0].label.length > 3 ? 'Win rate by period' : 'Win rate by month');
    if (conJuegos.length < 2) {
      $('hm-c-rate-s').textContent = '';
      caja.replaceChildren(pista(filtro.rango === '4w' ? 'Play in two different weeks to see your trend.' : 'Play in two different months to see your trend.'));
      return;
    }
    const a = conJuegos[0], b = conJuegos[conJuegos.length - 1];
    const dif = b.value - a.value;
    const mejor = conJuegos.reduce((x, y) => (y.value > x.value ? y : x));
    $('hm-c-rate-s').textContent = dif >= 3 ? `Up ${dif} points since ${a.label}` : dif <= -3 ? `Your best: ${mejor.label} (${mejor.value}%)` : `Steady since ${a.label}`;
    const etiqueta = `Win rate: ${datosB.map((d) => `${d.label} ${d.value == null ? 'no games' : d.value + '%'}`).join(', ')}`;
    caja.replaceChildren(P.graficas.barras(datosB, etiqueta));
  }

  /* Filtros, opción A (16 oct, 22:14): el camino, la forma y los días
     también siguen el rango de tiempo. */
  function pintarCamino(per) {
    const sec = $('hm-c-ladder-sec');
    const l = rend && rend.ladder;
    if (!l || !l.sessions || !l.sessions.length || filtro.fuente === 'play') { sec.hidden = true; return; }
    sec.hidden = false;
    const ses = l.sessions.filter((x) => x.d >= per[0].from);
    $('hm-c-ladder-t').textContent = l.status === 'active' ? `Your ${l.name} journey` : `Your ${l.name} season`;
    if (!ses.length) { $('hm-c-ladder-s').textContent = ''; $('hm-c-ladder').replaceChildren(pista('No ladder sessions in this period.')); return; }
    const puntos = ses.map((x, i) => ({ rank: x.rank, of: x.of, played: x.played, label: i === ses.length - 1 && x.d === hoy ? 'Today' : fmt.corto(x.d) }));
    const a = ses[0].rank, b = ses[ses.length - 1].rank, mejor = Math.min(...ses.map((x) => x.rank));
    $('hm-c-ladder-s').textContent = ses.length === 1 ? `#${b} after your first session`
      : a > b ? `From #${a} to #${b} in ${plural(ses.length, 'session', 'sessions')}`
        : a === b ? `Holding #${b} over ${plural(ses.length, 'session', 'sessions')}` : `#${b} now · your best: #${mejor}`;
    const etiqueta = `Ladder rank by session: ${ses.map((x) => '#' + x.rank).join(', ')}`;
    $('hm-c-ladder').replaceChildren(P.graficas.camino(puntos, etiqueta));
  }

  function pintarForma(per) {
    const ult = enRango(deFuente(juegos()), per).slice(-10);
    const caja = $('hm-c-form');
    if (ult.length < 3) { $('hm-c-form-s').textContent = ''; caja.replaceChildren(pista(ult.length ? 'Play 3 games in this period to see your form.' : 'No games in this period yet.')); return; }
    const w = ult.filter((g) => g.r === 'w').length;
    $('hm-c-form-s').textContent = `Last ${ult.length} games · ${plural(w, 'win', 'wins')}`;
    const fichasF = ult.map((g) => h('span', { class: `hm-form-c ${g.r === 'w' ? 'is-w' : 'is-l'}`, title: `${fmt.corto(g.d)}: ${g.r === 'w' ? 'win' : 'loss'}${g.sf != null && g.sa != null ? ` ${g.sf}–${g.sa}` : ''}`, text: g.r === 'w' ? 'W' : 'L' }));
    caja.replaceChildren(h('div', { class: 'hm-form', role: 'img', 'aria-label': `Last ${ult.length} games, oldest to newest: ${ult.map((g) => (g.r === 'w' ? 'win' : 'loss')).join(', ')}` }, fichasF),
      h('span', { class: 'hm-fine', text: 'Oldest → newest' }));
  }

  const NIVEL_DIA = (n) => (n >= 3 ? ' is-2' : n ? ' is-1' : '');
  const NIVEL_MES = (n) => (n >= 8 ? ' is-2' : n ? ' is-1' : '');
  const leyenda = () => h('span', { class: 'hm-legend', 'aria-hidden': 'true' }, 'Less', h('span', { class: 'hm-day' }), h('span', { class: 'hm-day is-1' }), h('span', { class: 'hm-day is-2' }), 'More');
  function pintarDias(per) {
    const lista = deFuente(juegos());
    if (filtro.rango === 'all') { pintarMeses(lista, per); return; }
    const semanas = filtro.rango === '4w' ? 4 : 26;
    const texto = filtro.rango === '4w' ? 'last 4 weeks' : 'last 6 months';
    const inicio = sumar(hoy, -(diaSemana(hoy) + 7 * (semanas - 1)));   // un domingo
    const cuenta = {};
    lista.forEach((g) => { if (g.d >= inicio && g.d <= hoy) cuenta[g.d] = (cuenta[g.d] || 0) + 1; });
    const celdas = [];
    for (let i = 0; i < semanas * 7; i++) {
      const d = sumar(inicio, i);
      const n = cuenta[d] || 0;
      const c = h('span', { class: `hm-day${d > hoy ? ' is-future' : NIVEL_DIA(n)}` });
      if (d <= hoy) c.title = `${fmt.corto(d)}: ${n ? plural(n, 'game', 'games') : 'no games'}`;
      celdas.push(c);
    }
    const dias = Object.keys(cuenta).length;
    // Semanas seguidas (si esta semana todavía no jugó, cuenta desde la anterior).
    let seguidas = 0;
    const semanaCon = (k) => { for (let j = 0; j < 7; j++) if (cuenta[sumar(inicio, k * 7 + j)]) return true; return false; };
    let k = semanas - 1;
    if (!semanaCon(k)) k--;
    for (; k >= 0 && semanaCon(k); k--) seguidas++;
    $('hm-c-days-s').textContent = seguidas >= 2 ? `${seguidas} weeks in a row · ${texto}` : `${plural(dias, 'day', 'days')} on court · ${texto}`;
    $('hm-c-days').replaceChildren(
      h('div', { class: `hm-days${semanas > 12 ? ' is-long' : ''}`, role: 'img', 'aria-label': `${plural(dias, 'day', 'days')} on court in the ${texto}${seguidas >= 2 ? `, ${seguidas} weeks in a row` : ''}` }, celdas),
      leyenda());
  }
  /* All time: un cuadro por mes (cuántos días jugó ese mes), un año por fila. */
  function pintarMeses(lista, per) {
    const dias = {};
    lista.forEach((g) => { (dias[mesDe(g.d)] = dias[mesDe(g.d)] || new Set()).add(g.d); });
    const anio0 = aFecha(per[0].from).getUTCFullYear(), anio1 = aFecha(hoy).getUTCFullYear();
    const filas = [h('span'), ...MESES.map((m) => h('span', { class: 'hm-months-m', 'aria-hidden': 'true', text: m.charAt(0) }))];
    let total = 0, meses = 0;
    for (let a = anio0; a <= anio1; a++) {
      const celdas = [];
      for (let m = 1; m <= 12; m++) {
        const k = `${a}-${String(m).padStart(2, '0')}`;
        const n = dias[k] ? dias[k].size : 0;
        const futuro = `${k}-01` > hoy;
        total += n; if (n) meses++;
        const c = h('span', { class: `hm-day${futuro ? ' is-future' : NIVEL_MES(n)}` });
        if (!futuro) c.title = `${MESES[m - 1]} ${a}: ${n ? plural(n, 'day', 'days') : 'no games'}`;
        celdas.push(c);
      }
      filas.push(h('span', { class: 'hm-months-y', text: String(a) }), ...celdas);
    }
    $('hm-c-days-s').textContent = `${plural(total, 'day', 'days')} on court · by month`;
    $('hm-c-days').replaceChildren(
      h('div', { class: 'hm-months', role: 'img', 'aria-label': `${plural(total, 'day', 'days')} on court in ${plural(meses, 'month', 'months')}, all time` }, filas),
      leyenda());
  }

  function parejas(lista, minimo) {
    const por = {};
    lista.forEach((g) => (g.p || []).forEach((i) => { const x = (por[i] = por[i] || { i, n: 0, w: 0 }); x.n++; if (g.r === 'w') x.w++; }));
    return Object.values(por).filter((x) => x.n >= minimo)
      .map((x) => Object.assign(x, { pct: pctDe(x.w, x.n) }))
      .sort((a, b) => b.pct - a.pct || b.n - a.n || a.i - b.i);
  }

  function pintarParejas(per) {
    const minimo = filtro.rango === '4w' ? 3 : 5;
    const top = parejas(enRango(deFuente(juegos()), per), minimo).slice(0, 3);
    $('hm-c-partners-s').textContent = `At least ${minimo} games together`;
    const caja = $('hm-c-partners');
    if (!top.length) { caja.replaceChildren(pista(`Play ${minimo} games with the same partner to see who you click with.`)); return; }
    const filas = top.map((x) => P.graficas.filaBarra(nombre(x.i), `${x.w}–${x.n - x.w} · ${x.pct}%`, x.pct, x.pct >= 70));
    const p = persona(top[0].i);
    if (p.card) filas.push(h('a', { class: 'hm-link', href: `#/player/${encodeURIComponent(String(p.card))}`, text: `Play with ${fmt.nombre(p.n)} again →` }));
    caja.replaceChildren(...filas);
  }

  /* Los momentos que lo hicieron subir (de todo su historial). */
  const ORDEN_FINAL = { Champion: 1, 'Runner-up': 2, '3rd place': 3, Semifinalist: 4 };
  const ETIQ_FUENTE = (g) => (g.s === 'ladder' || g.s === 'tournament') ? (g.c || (g.s === 'ladder' ? 'Ladder' : 'Tournament'))
    : g.lg ? 'Logged game' : 'Play game';
  function momentos() {
    const todos = juegos();
    const lista = [];
    const ses = rend.ladder && rend.ladder.sessions;
    if (ses && ses.length > 1) {
      let mejor = null;
      for (let i = 1; i < ses.length; i++) {
        const sube = ses[i - 1].rank - ses[i].rank;
        if (ses[i].played && sube >= 2 && (!mejor || sube >= mejor.sube)) mejor = { sube, d: ses[i].d, de: ses[i - 1].rank, a: ses[i].rank };
      }
      if (mejor) {
        const delDia = todos.filter((g) => g.s === 'ladder' && g.d === mejor.d);
        const w = delDia.filter((g) => g.r === 'w').length;
        lista.push({ d: mejor.d, k: `${fmt.corto(mejor.d)} · ${rend.ladder.name}`, t: `+${mejor.sube} spots in one session`,
          s: `${delDia.length ? `${w}–${delDia.length - w} on the day, ` : ''}#${mejor.de} → #${mejor.a}` });
      }
    }
    // La primera victoria contra alguien que le había ganado 2 veces o más.
    const derrotas = {}; let primera = null;
    todos.forEach((g) => {
      (g.o || []).forEach((i) => {
        if (g.r === 'l') derrotas[i] = (derrotas[i] || 0) + 1;
        else if (derrotas[i] >= 2) { primera = { g, i, antes: derrotas[i] }; derrotas[i] = -999; }
      });
    });
    if (primera) {
      lista.push({ d: primera.g.d, k: `${fmt.corto(primera.g.d)} · ${ETIQ_FUENTE(primera.g)}`, t: `First win vs ${nombre(primera.i)}`,
        s: `${primera.g.sf != null && primera.g.sa != null ? `${primera.g.sf}–${primera.g.sa}, ` : ''}after ${plural(primera.antes, 'loss', 'losses')}` });
    }
    const torneo = ((datos && datos.tournaments) || []).filter((t) => ORDEN_FINAL[t.finish])
      .sort((a, b) => ORDEN_FINAL[a.finish] - ORDEN_FINAL[b.finish] || String(b.date || '').localeCompare(String(a.date || '')))[0];
    if (torneo) {
      lista.push({ d: torneo.date || '', k: `${torneo.date ? fmt.corto(torneo.date) + ' · ' : ''}${torneo.name}`,
        t: torneo.finish === 'Champion' ? 'Champion' : torneo.finish === 'Semifinalist' ? 'Semifinal finish' : `${torneo.finish} finish`,
        s: torneo.category ? `${torneo.category} · your best tournament` : 'Your best tournament' });
    }
    const ra = rachas(todos);
    if (ra.mejor >= 4) lista.push({ d: ra.mejorFin, k: `Until ${fmt.corto(ra.mejorFin)}`, t: `${ra.mejor} wins in a row`, s: 'Your longest winning streak' });
    return lista.slice(0, 3);
  }

  function pintarMomentos() {
    const lista = momentos();
    $('hm-hl-sec').hidden = !lista.length;
    $('hm-hl').replaceChildren(...lista.map((m) => h('div', { class: 'hm-hl-c' },
      h('span', { class: 'hm-hl-k', text: m.k }), h('span', { class: 'hm-hl-t', text: m.t }), h('span', { class: 'hm-hl-s', text: m.s }))));
  }

  const HITOS = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
  function pintarHito() {
    const total = juegos().length;
    const meta = HITOS.find((x) => x > total) || (Math.floor(total / 500) + 1) * 500;
    const faltan = meta - total;
    const ult8 = juegos().filter((g) => g.d > sumar(hoy, -56)).length;
    let ritmo = 'Your next game counts';
    if (ult8 >= 2) {
      const semanas = Math.ceil(faltan / (ult8 / 8));
      const cuando = aFecha(sumar(hoy, semanas * 7));
      const parte = cuando.getUTCDate() <= 10 ? 'early' : cuando.getUTCDate() <= 20 ? 'mid' : 'late';
      ritmo = semanas <= 1 ? 'At your pace: this week' : `At your pace: ${parte} ${MESES[cuando.getUTCMonth()]}`;
    }
    $('hm-ms-ring').replaceChildren(P.graficas.anillo(total, meta, `${total} of ${meta} games`));
    $('hm-ms-t').textContent = `${plural(faltan, 'game', 'games')} to your ${meta}th`;
    $('hm-ms-s').textContent = ritmo;
  }

  /* "Did you know": un dato útil, con su acción. */
  function idea() {
    const todos = juegos();
    if (todos.length < 20) return null;
    const total = resumen(todos);
    const porDia = {};
    todos.forEach((g) => { const k = diaSemana(g.d); (porDia[k] = porDia[k] || []).push(g); });
    let mejor = null;
    Object.entries(porDia).forEach(([k, v]) => {
      const resto = todos.filter((g) => String(diaSemana(g.d)) !== k);
      if (v.length < 6 || resto.length < 6) return;
      const a = resumen(v).pct, b = resumen(resto).pct;
      if (a - b >= 15 && (!mejor || a - b > mejor.dif)) mejor = { k: Number(k), a, b, dif: a - b };
    });
    if (mejor) {
      const dia = DIAS[mejor.k];
      const hoyD = diaSemana(hoy);
      const prox = sumar(hoy, (mejor.k - hoyD + 7) % 7 || 7);
      return { t: `${dia}s are your day:`, s: ` you win ${mejor.a}% of your ${dia} games, and ${mejor.b}% on other days.`,
        a: `Plan a ${dia} game →`, href: `#/game-form/d-${prox}`, juego: true };
    }
    const top = parejas(todos, 5)[0];
    if (top && top.pct - total.pct >= 15) {
      const p = persona(top.i);
      return { t: `You click with ${nombre(top.i)}:`, s: ` you win ${top.pct}% of your games together, and ${total.pct}% overall.`,
        a: p.card ? 'See their player card →' : null, href: p.card ? `#/player/${encodeURIComponent(String(p.card))}` : null };
    }
    return null;
  }
  function pintarIdea() {
    const x = idea();
    const bloqueado = !!bloqueo();
    $('hm-tip').hidden = !x;
    if (!x) return;
    const partes = [h('span', { class: 'hm-tip-k', text: 'Did you know' }), h('p', { class: 'hm-tip-t' }, h('strong', { text: x.t }), x.s)];
    if (x.a && x.href && !(x.juego && bloqueado)) partes.push(h('a', { class: 'hm-link', href: x.href, text: x.a }));
    $('hm-tip').replaceChildren(...partes);
  }

  function pistaNumeros() {
    if (!rend) return 'Your numbers and charts';
    const todos = juegos();
    if (!todos.length) return 'Your story starts with your first game';
    const ra = rachas(todos);
    if (ra.tipo === 'w' && ra.actual >= 2) return `On a ${ra.actual}-game winning streak`;
    const seis = todos.filter((g) => g.d >= primeroDeMes(hoy, 5));
    const porMes = {};
    seis.forEach((g) => { const k = mesDe(g.d); (porMes[k] = porMes[k] || []).push(g); });
    const meses = Object.keys(porMes).sort();
    if (meses.length >= 2) {
      const a = resumen(porMes[meses[0]]).pct, b = resumen(porMes[meses[meses.length - 1]]).pct;
      if (b - a >= 5) return `Up ${b - a} points in win rate since ${nombreMes(meses[0] + '-01')}`;
    }
    return `${plural(todos.length, 'game', 'games')} and counting`;
  }

  function pintarFiltros() {
    document.querySelectorAll('#hm-numbers [data-rango]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rango === filtro.rango)));
    document.querySelectorAll('#hm-numbers [data-fuente]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.fuente === filtro.fuente)));
  }

  function pintarNumeros() {
    hoy = (rend && rend.today) || hoyClub();
    pintarFiltros();
    const vacio = !juegos().length;
    $('hm-charts').hidden = vacio;
    $('hm-empty').hidden = !vacio;
    $('hm-filters').hidden = vacio;
    $('hm-kpis').hidden = vacio;
    const per = periodos();
    pintarKpis(per);
    pintarFrase();
    if (vacio) return;
    $('hm-num-s').textContent = filtro.fuente === 'official' ? 'Ladders and tournaments'
      : filtro.fuente === 'play' ? 'Play games (verified and self-reported)' : 'Ladders, tournaments and Play games';
    pintarBarras(per);
    pintarCamino(per);
    pintarForma(per);
    pintarDias(per);
    pintarParejas(per);
    pintarMomentos();
    pintarHito();
    pintarIdea();
  }

  document.querySelectorAll('#hm-numbers [data-rango]').forEach((b) => b.addEventListener('click', () => { filtro.rango = b.dataset.rango; pintarNumeros(); }));
  document.querySelectorAll('#hm-numbers [data-fuente]').forEach((b) => b.addEventListener('click', () => { filtro.fuente = b.dataset.fuente; pintarNumeros(); }));

  $('hm-share').addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    if (typeof P.compartirImagen !== 'function' || b.disabled || !imagen) return;
    b.disabled = true;
    try {
      const blob = imagen.blob || await imagen.promesa;
      await P.compartirImagen(blob, imagen.datos);
    } catch (err) {
      if (err && err.name !== 'AbortError') { console.warn('[portal] share:', err); P.aviso('We couldn\u2019t make the image. Please try again.', true); }
    } finally { b.disabled = false; }
  });

  /* ════════════════ 3. LO DE ANTES, MÁS COMPACTO ════════════════ */
  const TEMAS = {
    dinking: 'Dinking', serve_return: 'Serve & Return', third_shot: 'Third Shot', strategy: 'Strategy',
    drills: 'Drills', kitchen_rules: 'Kitchen Rules', mistakes: 'Mistakes', ratings: 'Ratings & Levels',
  };
  const ICONO_PLAY = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
  const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;
  const httpsOk = (u) => { try { return new URL(u).protocol === 'https:'; } catch (_) { return false; } };

  const ETIQUETA = { verified: 'Verified', pending: 'Awaiting confirmation', review: 'In review', self: 'Self-reported' };
  const FORMATO_PLAY = { single: '', bo3: ' · Best of 3', bo5: ' · Best of 5' };
  const TIPO_PLAY = { singles: 'Singles', doubles: 'Doubles', mixed: 'Mixed', drill: 'Drill' };
  function filaPlay(m) {
    const js = m.scores || [];
    return {
      play: true, status: m.status, played_on: m.played_on, result: m.result,
      competition: `${m.logged ? 'Logged game' : 'Play game'} · ${TIPO_PLAY[m.kind] || 'Game'}${FORMATO_PLAY[m.format] || ''}`,
      partners: m.partners || [], opponents: m.opponents || [],
      score_for: m.format === 'single' && js[0] ? js[0][0] : m.won,
      score_against: m.format === 'single' && js[0] ? js[0][1] : m.lost,
    };
  }
  function conQuien(r) {
    const partes = [];
    if (r.partners && r.partners.length) partes.push(`w/ ${r.partners.map(fmt.nombre).join(' & ')}`);
    if (r.opponents && r.opponents.length) partes.push(`vs ${r.opponents.map(fmt.nombre).join(' & ')}`);
    return partes.join(' · ') || '—';
  }
  function resultados(lista) {
    if (!lista || !lista.length) return [h('p', { class: 'pj-empty', text: 'No results yet. Your games will show up here after your first ladder session, tournament or Play game.' })];
    return lista.map((r) => {
      const espera = r.play && r.status !== 'verified' && r.status !== 'self';
      const etiqueta = r.play ? h('span', { class: `hm-tag${espera ? ' is-wait' : r.status === 'self' ? ' is-self' : ''}`, text: ETIQUETA[r.status] || '' }) : null;
      const res2 = espera
        ? h('span', { class: 'hm-res is-wait', title: ETIQUETA[r.status] }, h('span', { 'aria-hidden': 'true', text: '·' }), h('span', { class: 'pj-sr', text: ETIQUETA[r.status] }))
        : h('span', { class: `hm-res ${r.result === 'win' ? 'is-w' : 'is-l'}` },
          h('span', { 'aria-hidden': 'true', text: r.result === 'win' ? 'W' : 'L' }), h('span', { class: 'pj-sr', text: r.result === 'win' ? 'Win' : 'Loss' }));
      return h('li', { class: 'hm-rr' }, res2,
        h('span', { class: 'hm-rr-m' },
          h('span', { class: 'hm-rr-e' }, r.category ? `${r.competition} · ${r.category}` : r.competition, etiqueta),
          h('span', { class: 'hm-rr-w', text: conQuien(r) })),
        h('span', { class: 'hm-rr-sc', text: r.score_for != null && r.score_against != null ? `${r.score_for}–${r.score_against}` : '' }),
        h('span', { class: 'hm-rr-d', text: fmt.corto(r.played_on) }));
    });
  }
  const TIPOS = { tournament: 'Tournament', ladder: 'Ladder', clinic: 'Clinic', private_session: 'Private session', other: 'Event' };
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
          h('span', { class: `pj-event-kind ${COLOR_TIPO(e.event_type)}`, text: TIPOS[e.event_type] || 'Event' }),
          h('span', { class: 'pj-event-title', text: e.title }),
          h('span', { class: 'pj-event-sub', text: cuando })));
    });
  }
  function video(v) {
    if (!v || !ID_YOUTUBE.test(v.youtube_id || '')) return null;
    const play = h('span', { class: 'hm-vid-play' });
    play.innerHTML = ICONO_PLAY;   // icono fijo escrito aquí (nunca datos)
    return h('a', { class: 'hm-vid', href: `https://www.youtube.com/watch?v=${v.youtube_id}`, target: '_blank', rel: 'noopener' }, play,
      h('span', { class: 'hm-vid-t' }, h('span', { class: 'hm-vid-k', text: `Video of the Month · ${TEMAS[v.topic] || 'FEROCIA Academy'}` }),
        h('span', { class: 'hm-vid-n', text: v.title })));
  }

  /* ════════════════ PINTAR ════════════════ */
  let vez = 0;
  async function pintar() {
    const mia = ++vez;
    const e = P.estado() || {};
    elegida = null; planDia = null; quiere = null;
    res = guardado && Date.now() - guardado.t < 60000 ? guardado.v : null;   // nada de la visita anterior
    OPCIONES.forEach((o) => $(`hm-o-${o}`).setAttribute('aria-pressed', 'false'));
    $('hm-greeting').textContent = `${saludo()}${e.first_name ? `, ${fmt.nombre(e.first_name)}` : ''}`;
    pintarPistas();
    pintarPaso();
    $('hm-task').hidden = true;
    $('hm-ask').setAttribute('aria-busy', 'true');
    const main = $('hm-main');
    main.setAttribute('aria-busy', 'true');
    $('hm-error').hidden = true;

    const rpc = (n) => P.sb.rpc(n).then(({ data, error }) => { if (error) throw error; return data; });
    const pendiente = traerResumen(mia);
    const [d, rd, mp] = await Promise.allSettled([P.datos(), rpc('portal_mi_rendimiento'), rpc('portal_mis_partidos')]);
    if (mia !== vez) return;
    if (d.status === 'rejected') {
      console.warn('[portal] home:', d.reason);
      $('hm-error').textContent = P.errorTexto(d.reason);
      $('hm-error').hidden = false;
      main.setAttribute('aria-busy', 'false');
      // La pregunta de arriba sigue sirviendo: se termina de pintar igual.
      await pendiente;
      if (mia !== vez) return;
      pintarPistas(); pintarPendiente(); pintarPaso();
      $('hm-ask').setAttribute('aria-busy', 'false');
      return;
    }
    datos = d.value || {};
    rend = rd.status === 'fulfilled' ? rd.value : null;
    if (rd.status === 'rejected') console.warn('[portal] home, números:', rd.reason);
    const p = datos.player || {};
    $('hm-greeting').textContent = `${saludo()}${p.first_name ? `, ${fmt.nombre(p.first_name)}` : ''}`;

    pintarPistas();
    pintarPendiente();
    pintarPaso();

    // Sus números: sin el SQL 105, sólo los 4 números de antes (sin gráficas).
    if (rend) {
      const todos = rend.games || [];
      filtro.fuente = 'all';
      filtro.rango = todos.length && todos[0].d >= sumar(rend.today, -60) ? 'all' : '6m';
      $('hm-numbers').hidden = false;
      pintarNumeros();
    } else {
      $('hm-numbers').hidden = false;
      $('hm-filters').hidden = true; $('hm-charts').hidden = true; $('hm-banner').hidden = true;
      $('hm-empty').hidden = true; $('hm-kpis').hidden = false;
      const st = datos.stats || {};
      const pct = st.played ? Math.round(((st.wins || 0) / st.played) * 100) : null;
      $('hm-num-s').textContent = 'Ladders and tournaments';
      $('hm-kpis').replaceChildren(
        tarjeta('Games played', st.played || 0, '', null), tarjeta('Win rate', pct, '%', null),
        tarjeta('Current streak', st.streak || null, st.streak_kind === 'win' ? ' wins' : ' losses', null, true));
    }

    // Recent results: lo oficial y lo de Play, juntos por fecha.
    const oficiales = datos.recent || [];
    const play = mp.status === 'fulfilled' && mp.value ? (mp.value.recent || []).map(filaPlay) : [];
    const todos = [...play, ...oficiales].map((r, i) => ({ r, i }))
      .sort((a, b) => String(b.r.played_on || '').localeCompare(String(a.r.played_on || '')) || a.i - b.i).map((x) => x.r).slice(0, 6);
    $('hm-results').replaceChildren(...resultados(todos));
    $('hm-events').replaceChildren(...eventos(datos.events));
    const vid = video(datos.video);
    $('hm-video').replaceChildren(...(vid ? [vid] : []));
    $('hm-video').hidden = !vid;
    main.setAttribute('aria-busy', 'false');
    // Cuando llegan los números del momento: las pistas, lo pendiente y el paso.
    await pendiente;
    if (mia !== vez) return;
    pintarPistas();
    pintarPendiente();
    pintarPaso();
    pintarIdea();
    $('hm-ask').setAttribute('aria-busy', 'false');
  }
  P.alEntrar('home', pintar);
})();
