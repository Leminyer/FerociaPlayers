/* ============================================================
   FEROCIA PLAYER PORTAL — RECAP DEL EVENTO Y SUS FOTOS (§123, SQL 143)
   Torneos, etapa 2 · 24 nov 2026 · diseño etapa2.html aprobado
   (1A 2A 3A 4B 5A 6A).

     · Home: "Your recap is ready" durante 7 días después de que el
       torneo o la escalera se marca "Completed" (2A), y "New photos"
       de un evento que sigue en curso (3A).
     · #/recap/t-<id> o #/recap/l-<id>: dónde quedó, su récord, sus
       partidos (o lo mejor de su escalera), los campeones y las fotos.
     · El visor de fotos: se pasan con el dedo o con las flechas, se
       descargan (2A) y "Remove me from this photo" la esconde para
       todos al momento (1A) y avisa al equipo de FEROCIA.
     · "Share my recap": una imagen con su resultado, SIN fotos (5A).
     · My Identity → "Your FEROCIA story": todos sus recaps (6A).

   Las fotos viven en una carpeta privada: sólo los jugadores de ese
   evento reciben un enlace, y el enlace caduca en una hora.
   Todo se pinta como TEXTO (h()), nunca HTML con datos.
   ============================================================ */
(function () {
  'use strict';
  const P = window.FerociaPortal;
  if (!P) return;
  const { h, sb, fmt } = P;
  const $ = (id) => document.getElementById(id);
  const CARPETA = 'event-photos';
  const EN_GRILLA = 6;            // fotos que se ven en el recap antes de "+N"

  const MEDALLA = { gold: '🏆', silver: '🥈', bronze: '🥉' };
  const medallaPuesto = (n) => (n === 1 ? 'gold' : n === 2 ? 'silver' : n === 3 ? 'bronze' : null);
  const ordinal = (n) => {
    const r = n % 100;
    return `${n}${r >= 11 && r <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;
  };
  const conSigno = (n) => (n > 0 ? `+${n}` : String(n || 0));
  const plural = (n, una, varias) => `${n} ${n === 1 ? una : (varias || `${una}s`)}`;
  const ruta = (kind, id) => `#/recap/${kind === 'tournament' ? 't' : 'l'}-${id}`;
  const leerRuta = (param) => {
    const m = /^(t|l)-(\d{1,18})$/.exec(String(param || ''));
    return m ? { kind: m[1] === 't' ? 'tournament' : 'ladder', id: Number(m[2]) } : null;
  };

  async function rpc(nombre, args) {
    const { data, error } = await sb.rpc(nombre, args || {});
    if (error) throw error;
    return data;
  }

  /* Enlaces que caducan a los 10 minutos (una foto escondida con "Remove
     me" deja de verse pronto también en otros teléfonos). Mientras el
     recap está abierto, se piden otra vez antes de que caduquen. */
  const VIDA = 600;
  const RENOVAR_MS = 8 * 60 * 1000;
  async function enlaces(fotos) {
    if (!fotos.length) return {};
    const { data, error } = await sb.storage.from(CARPETA).createSignedUrls(fotos.map((f) => f.path), VIDA);
    if (error) throw error;
    const out = {};
    (data || []).forEach((d) => { if (d && d.signedUrl && d.path) out[d.path] = d.signedUrl; });
    return out;
  }

  /* El resumen de una línea de un recap (Home y la imagen para compartir). */
  function resumen(r) {
    if (r.kind === 'tournament') {
      const entradas = r.entries || [];
      const e = entradas.slice().sort((a, b) => orden(a) - orden(b))[0];
      const partidos = entradas.reduce((n, x) => n + (x.matches || []).length, 0);
      const ganados = entradas.reduce((n, x) => n + (x.wins || 0), 0);
      return {
        medalla: e && e.placement && e.placement.medal,
        titular: e ? e.placement.label : 'Played',
        detalle: e ? [e.category, e.partners ? `with ${e.partners}` : ''].filter(Boolean).join(' · ') : '',
        numeros: [plural(partidos, 'match', 'matches'), plural(ganados, 'win')],
      };
    }
    if (r.type === 'ftc') {
      const f = r.ftc || {};
      return { medalla: null, titular: f.team || 'Team ladder', detalle: 'Team ladder', numeros: [`${f.wins || 0}–${f.losses || 0} record`] };
    }
    return {
      medalla: medallaPuesto(r.rank),
      titular: r.rank ? `${ordinal(r.rank)} of ${r.of}` : 'Ladder complete',
      detalle: r.moved > 0 ? `Up ${plural(r.moved, 'place')} since week 1` : '',
      numeros: [plural(r.sessions || 0, 'session'), plural(Number(r.points) || 0, 'point')],
    };
  }
  const orden = (e) => ({ gold: 0, silver: 1, bronze: 2 }[e.placement && e.placement.medal] ?? 3);

  /* ═══ Home ═══ */
  function tarjetaRecap(r) {
    const s = resumen(r);
    const lineas = [`${s.medalla ? `${MEDALLA[s.medalla]} ` : ''}${s.titular}${s.detalle ? ` · ${s.detalle}` : ''}`,
      [...s.numeros, r.photos ? plural(r.photos, 'photo') : ''].filter(Boolean).join(' · ')];
    return h('section', { class: 'rc-card', 'aria-label': `Your recap: ${r.name}` },
      h('p', { class: 'rc-card-k', text: 'YOUR RECAP IS READY' }),
      h('h2', { class: 'rc-card-t', text: r.name }),
      h('p', { class: 'rc-card-s' }, lineas[0], h('br'), lineas[1]),
      h('a', { class: 'rc-card-btn', href: ruta(r.kind, r.id), text: 'See your recap →' }));
  }
  function tarjetaFotos(f) {
    return h('section', { class: 'rc-card', 'aria-label': `New photos: ${f.name}` },
      h('p', { class: 'rc-card-k', text: 'NEW PHOTOS' }),
      h('h2', { class: 'rc-card-t', text: f.name || 'Your event' }),
      h('p', { class: 'rc-card-s', text: `${plural(f.photos, 'photo')} · only players of this ${f.kind === 'tournament' ? 'tournament' : 'ladder'} can see them` }),
      h('a', { class: 'rc-card-btn', href: ruta(f.kind, f.id), text: 'See photos →' }));
  }

  let vezHome = 0;
  async function pintarHome() {
    const caja = $('rc-hoy');
    if (!caja) return;
    const mia = ++vezHome;
    try {
      const [lista, nuevas] = await Promise.all([rpc('portal_recaps'), rpc('portal_fotos_nuevas')]);
      const nuevos = (Array.isArray(lista) ? lista : []).filter((x) => x.new).slice(0, 3);
      const detalles = await Promise.all(nuevos.map((x) => rpc('portal_recap', { p_kind: x.kind, p_event_id: x.id }).catch(() => null)));
      if (mia !== vezHome) return;
      const tarjetas = [
        ...detalles.filter((d) => d && !d.error).map(tarjetaRecap),
        ...(Array.isArray(nuevas) ? nuevas : []).slice(0, 3).map(tarjetaFotos),
      ];
      caja.replaceChildren(...tarjetas);
      caja.hidden = !tarjetas.length;
    } catch (_) {
      if (mia === vezHome) caja.hidden = true;   // sin SQL 143 o sin conexión: el Home sigue igual
    }
  }

  /* ═══ My Identity: todos sus recaps (6A) ═══ */
  async function pintarIdentidad() {
    const caja = $('rc-id');
    const lista = $('rc-id-lista');
    if (!caja || !lista) return;
    let datos = [];
    try { datos = await rpc('portal_recaps'); } catch (_) { caja.hidden = true; return; }
    datos = Array.isArray(datos) ? datos : [];
    lista.replaceChildren(...datos.map((r) => h('li', null,
      h('a', { class: 'rc-id-fila', href: ruta(r.kind, r.id) },
        h('span', { class: 'rc-id-t' },
          h('span', { class: 'rc-id-k', text: `${fmt.corto(r.date)}${r.date ? ' · ' : ''}${r.kind === 'tournament' ? 'Tournament' : 'Ladder'}` }),
          h('span', { class: 'rc-id-n', text: `${r.medal ? `${MEDALLA[r.medal]} ` : ''}${r.headline ? `${r.headline} · ` : ''}${r.name}` })),
        h('span', { class: 'rc-id-go', text: 'Recap →' })))));
    caja.hidden = !datos.length;
  }

  /* ═══ La pantalla del recap ═══ */
  let actual = null;      // { kind, id, recap, fotos, urls, nombre }
  let imagenLista = null; // la imagen de "Share", preparada antes del toque
  let vezRecap = 0;
  let desde = 'home';

  const filaPartido = (ronda, texto, score, clase) => h('div', { class: 'rc-fila' },
    h('span', null, h('span', { class: 'rc-fila-k', text: ronda }), texto),
    h('span', { class: `rc-fila-sc${clase ? ` ${clase}` : ''}`, text: score }));

  function hero({ medalla, titular, detalle, stats, oscuro }) {
    return h('div', { class: `rc-hero${oscuro ? ' rc-hero-suave' : ''}` },
      h('div', { class: 'rc-hero-med', 'aria-hidden': 'true', text: medalla ? MEDALLA[medalla] : '🎾' }),
      h('div', { class: `rc-hero-res${medalla ? ' rc-lima' : ''}`, text: titular }),
      detalle ? h('div', { class: 'rc-hero-det', text: detalle }) : null,
      stats ? h('dl', { class: 'rc-stats' }, ...stats.map(([n, t]) => h('div', null, h('dt', { text: t }), h('dd', { text: n })))) : null);
  }
  const seccion = (titulo, ...hijos) => h('section', { class: 'rc-sec', 'aria-label': titulo },
    h('h2', { class: 'rc-sec-t', text: titulo }), ...hijos);

  function cuerpoTorneo(r) {
    const partes = [];
    (r.entries || []).forEach((e) => {
      const p = e.placement || {};
      partes.push(hero({
        medalla: p.medal, titular: p.label || 'Played', oscuro: !p.medal,
        detalle: [e.category, e.partners ? `with ${e.partners}` : ''].filter(Boolean).join(' · '),
        stats: [[`${e.wins}–${e.losses}`, 'Record'], [String(e.points_for), 'Points won'], [conSigno(e.diff), 'Diff']],
      }));
      if ((e.matches || []).length) {
        partes.push(seccion((r.entries.length > 1 ? `Your matches · ${e.category}` : 'Your matches'),
          h('div', { class: 'rc-caja' }, ...e.matches.map((m) => filaPartido(m.round, `vs ${m.vs || 'TBD'}`,
            m.forfeit ? `${m.won ? 'W' : 'L'} · forfeit` : `${m.won ? 'W' : 'L'} ${m.score_for}–${m.score_against}`, m.won ? 'rc-w' : 'rc-l')))));
      }
    });
    return partes;
  }
  function cuerpoEscalera(r) {
    if (r.type === 'ftc') {
      const f = r.ftc || {};
      return [
        hero({ medalla: null, titular: f.team || 'Team ladder', detalle: 'Team ladder', oscuro: true,
          stats: [[`${f.wins || 0}–${f.losses || 0}`, 'Record'], [String((f.matches || []).length), 'Matches']] }),
        (f.matches || []).length ? seccion('Your matches', h('div', { class: 'rc-caja' },
          ...f.matches.map((m) => filaPartido(fmt.corto(m.date) || 'Match', `vs ${m.vs || 'TBD'}`,
            `${m.won ? 'W' : 'L'} ${m.score_for}–${m.score_against}`, m.won ? 'rc-w' : 'rc-l')))) : null,
      ];
    }
    const filas = [];
    const b = r.best_session;
    if (b) filas.push(filaPartido('Best session', fmt.largo(b.date), `${b.wins}–${b.losses}`, 'rc-w'));
    const g = r.most_played_with;
    if (g) filas.push(filaPartido('Most played with', g.name, plural(g.games, 'game')));
    const t = r.toughest;
    if (t) filas.push(filaPartido('Toughest opponent', t.name, `${t.wins}–${t.losses}`));
    return [
      hero({ medalla: medallaPuesto(r.rank), titular: r.rank ? `${ordinal(r.rank)} of ${r.of}` : 'Ladder complete',
        detalle: r.moved > 0 ? `Up ${plural(r.moved, 'place')} since week 1` : '', oscuro: !medallaPuesto(r.rank),
        stats: [[String(r.sessions || 0), 'Sessions'], [String(Number(r.points) || 0), 'Points'], [`${r.wins || 0}–${r.losses || 0}`, 'Games']] }),
      filas.length ? seccion('Highlights', h('div', { class: 'rc-caja' }, ...filas)) : null,
    ];
  }

  function bloqueFotos() {
    const { fotos, urls, kind } = actual;
    if (!fotos.length) return null;
    const vistas = fotos.slice(0, EN_GRILLA);
    const resto = fotos.length - vistas.length;
    const celdas = vistas.map((f, i) => {
      const ultima = resto > 0 && i === vistas.length - 1;
      return h('button', { type: 'button', class: `rc-foto${ultima ? ' rc-foto-mas' : ''}`, 'data-rc-foto': String(i),
        'aria-label': ultima ? `See all ${fotos.length} photos` : `Photo ${i + 1} of ${fotos.length}` },
        urls[f.path] ? h('img', { src: urls[f.path], alt: '', loading: 'lazy' }) : null,
        ultima ? h('span', { text: `+${resto + 1}` }) : null);
    });
    return seccion(`Photos · ${fotos.length}`, h('div', { class: 'rc-caja' },
      h('div', { class: 'rc-fotos' }, ...celdas),
      h('p', { class: 'rc-privado', text: `🔒 Only players of this ${kind === 'tournament' ? 'tournament' : 'ladder'} can see these photos.` })));
  }

  async function pintarRecap() {
    const ev = leerRuta(P.rutaParam());
    const cuerpo = $('rc-body');
    const err = $('rc-error');
    const main = $('rc-main');
    if (!cuerpo) return;
    const mia = ++vezRecap;
    const atras = $('rc-back');
    if (atras) { atras.href = desde === 'profile' ? '#/profile' : '#/home'; atras.textContent = desde === 'profile' ? '← My Identity' : '← Home'; }
    err.hidden = true;
    cuerpo.replaceChildren(h('p', { class: 'rc-cargando', text: 'Loading your recap…' }));
    main.setAttribute('aria-busy', 'true');
    imagenLista = null;
    actual = null;
    if (!ev) { mostrarError('This recap was not found.'); return; }
    try {
      const [recap, fotos] = await Promise.all([
        rpc('portal_recap', { p_kind: ev.kind, p_event_id: ev.id }),
        rpc('portal_fotos', { p_kind: ev.kind, p_event_id: ev.id }),
      ]);
      if (fotos && fotos.error) { mostrarError("This recap is only for the players of this event."); return; }
      const lista = (fotos && fotos.photos) || [];
      const urls = await enlaces(lista);
      if (mia !== vezRecap) return;
      const terminado = recap && !recap.error;
      actual = { ...ev, recap: terminado ? recap : null, fotos: lista, urls, firmadas: Date.now(), nombre: (terminado ? recap.name : fotos.name) || 'Your event' };
      pintarCuerpo();
    } catch (e) {
      if (mia !== vezRecap) return;
      mostrarError(/does not exist|Could not find the function/i.test(String(e && e.message))
        ? 'Recaps are not available yet.' : 'We could not load your recap. Check your connection and try again.');
    }
  }
  function mostrarError(texto) {
    const err = $('rc-error');
    err.textContent = texto; err.hidden = false;
    $('rc-body').replaceChildren();
    $('rc-main').removeAttribute('aria-busy');
    $('rc-k').textContent = 'Recap';
    $('rc-title').textContent = 'Your recap';
  }

  function pintarCuerpo() {
    const r = actual.recap;
    const torneo = actual.kind === 'tournament';
    let fecha = '';
    if (r) fecha = torneo ? fmt.largo(r.date) : [fmt.corto(r.start_date), fmt.corto(r.end_date)].filter(Boolean).join(' – ');
    $('rc-k').textContent = `${!r ? 'Photos' : torneo ? 'Tournament recap' : 'Ladder recap'}${fecha ? ` · ${fecha}` : ''}`;
    $('rc-title').textContent = actual.nombre;
    const partes = [];
    if (r) partes.push(...(torneo ? cuerpoTorneo(r) : cuerpoEscalera(r)));
    else partes.push(h('p', { class: 'rc-nota', text: 'Your recap will be here when the event is completed. For now, the photos:' }));
    partes.push(bloqueFotos());
    if (r && torneo && (r.champions || []).some((c) => c.names)) {
      partes.push(seccion('Champions', h('div', { class: 'rc-caja' },
        ...r.champions.filter((c) => c.names).map((c) => h('div', { class: 'rc-camp' }, h('span', { text: c.category }), h('b', { text: c.names }))))));
    }
    if (r) {
      partes.push(h('div', { class: 'rc-share' },
        h('button', { type: 'button', class: 'pj-btn pj-btn-outline pj-btn-block', id: 'rc-share', text: 'Share my recap' })));
    }
    if (!r && !actual.fotos.length) partes.push(h('p', { class: 'rc-nota', text: 'No photos yet.' }));
    $('rc-body').replaceChildren(...partes.filter(Boolean));
    $('rc-main').removeAttribute('aria-busy');
    if (r) prepararImagen();
  }

  /* ═══ "Share my recap" (5A: sin fotos) ═══ */
  async function dibujarRecap(r, nombrePila) {
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) { /* nada */ } }
    const W = 1080, H = 1350;
    const C = { noche: '#080f2e', azul: '#174CCC', lima: '#C6F221', blanco: '#ffffff', suave: '#B8C2DC' };
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const F = (peso, tam) => `${peso} ${tam}px Inter, Arial, sans-serif`;
    const lineas = (texto, ancho, max) => {
      const out = []; let linea = '';
      String(texto || '').split(/\s+/).forEach((p) => {
        const prueba = linea ? `${linea} ${p}` : p;
        if (ctx.measureText(prueba).width > ancho && linea) { out.push(linea); linea = p; } else linea = prueba;
      });
      if (linea) out.push(linea);
      if (out.length > max) { out.length = max; out[max - 1] = `${out[max - 1].replace(/\s+\S*$/, '')}…`; }
      return out;
    };
    ctx.fillStyle = C.noche; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.lima; ctx.fillRect(0, 0, W, 14);
    ctx.fillStyle = C.azul; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(W - 120, 300, 360, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const logo = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = 'assets/ferocia-logo.png'; });
    if (logo) { const w = 300, hh = Math.round((logo.height / logo.width) * w); ctx.drawImage(logo, 90, 90, w, hh); }

    const s = resumen(r);
    ctx.fillStyle = C.lima; ctx.font = F(800, 40);
    ctx.fillText(nombrePila ? `${nombrePila.toUpperCase()}'S RECAP` : 'MY RECAP', 90, 300);
    ctx.fillStyle = C.blanco; ctx.font = F(900, 72);
    lineas(r.name, W - 180, 2).forEach((t, i) => ctx.fillText(t, 90, 392 + i * 84));
    ctx.fillStyle = C.lima; ctx.font = F(900, 120);
    const res = lineas(`${s.medalla ? `${MEDALLA[s.medalla]} ` : ''}${s.titular}`, W - 180, 2);
    res.forEach((t, i) => ctx.fillText(t, 84, 680 + i * 130));
    ctx.fillStyle = C.blanco; ctx.font = F(700, 40);
    lineas(s.detalle, W - 180, 2).forEach((t, i) => ctx.fillText(t, 92, 680 + res.length * 130 - 40 + i * 52));

    let datos;
    if (r.kind === 'tournament') {
      const es = r.entries || [];
      const w = es.reduce((n, e) => n + (e.wins || 0), 0), l = es.reduce((n, e) => n + (e.losses || 0), 0);
      const pf = es.reduce((n, e) => n + (e.points_for || 0), 0);
      datos = [[`${w}–${l}`, 'record'], [String(pf), 'points won']];
    } else if (r.type === 'ftc') {
      datos = [[`${(r.ftc || {}).wins || 0}–${(r.ftc || {}).losses || 0}`, 'record']];
    } else {
      datos = [[String(r.sessions || 0), 'sessions'], [String(Number(r.points) || 0), 'points'], [`${r.wins || 0}–${r.losses || 0}`, 'games']];
    }
    const ancho = (W - 180) / datos.length;
    datos.forEach(([n, t], i) => {
      const x = 90 + i * ancho;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, 960, ancho - 24, 190, 28); else ctx.rect(x, 960, ancho - 24, 190); ctx.fill();
      ctx.fillStyle = C.blanco; ctx.font = F(900, 88); ctx.fillText(n, x + 30, 1068);
      ctx.fillStyle = C.suave; ctx.font = F(600, 30); ctx.fillText(t, x + 32, 1118);
    });
    ctx.fillStyle = C.suave; ctx.font = F(600, 30);
    ctx.fillText('FEROCIA Sports Center · Boca Raton', 90, 1260);
    return new Promise((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error('no_image'))), 'image/png'));
  }
  function prepararImagen() {
    const r = actual && actual.recap;
    if (!r) return;
    const e = P.estado() || {};
    const pila = String(e.first_name || '').trim().split(/\s+/)[0] || '';
    imagenLista = dibujarRecap(r, pila ? fmt.nombre(pila) : '').catch(() => null);
  }
  function descargarBlob(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: nombre });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    P.aviso('Your image is ready — check your downloads.');
  }
  async function compartir(boton) {
    if (!imagenLista || boton.disabled) return;
    boton.disabled = true;
    try {
      const blob = await imagenLista;
      if (!blob) throw new Error('no_image');
      const nombre = 'ferocia-recap.png';
      const archivo = typeof File === 'function' ? new File([blob], nombre, { type: 'image/png' }) : null;
      if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
        try { await navigator.share({ files: [archivo], title: `My recap · ${actual.nombre}` }); }
        catch (e) { if (!e || e.name !== 'AbortError') descargarBlob(blob, nombre); }
      } else {
        descargarBlob(blob, nombre);
      }
    } catch (_) {
      P.aviso('We could not make your image. Try again.', true);
    } finally {
      boton.disabled = false;
    }
  }

  /* ═══ El visor de fotos ═══ */
  let vi = 0;
  let quitando = false;   // mientras se manda "Remove me", el visor no se mueve
  let renovando = false;
  /* Enlaces nuevos si los de ahora están por caducar (recap abierto mucho rato). */
  async function renovar() {
    if (!actual || renovando || Date.now() - actual.firmadas < RENOVAR_MS) return;
    const yo = actual;
    renovando = true;
    try {
      const urls = await enlaces(yo.fotos);
      if (actual !== yo) return;
      yo.urls = urls; yo.firmadas = Date.now();
      document.querySelectorAll('[data-rc-foto] img').forEach((img) => {
        const f = yo.fotos[Number(img.parentElement.dataset.rcFoto)];
        if (f && urls[f.path]) img.src = urls[f.path];
      });
      if ($('rc-visor') && $('rc-visor').open) pintarVisor();
    } catch (_) { /* se intenta la próxima vez */ } finally { renovando = false; }
  }
  function abrirVisor(i) {
    renovar();
    const d = $('rc-visor');
    if (!d || !actual || !actual.fotos.length) return;
    vi = Math.max(0, Math.min(i, actual.fotos.length - 1));
    $('rc-v-hoja').hidden = true;
    pintarVisor();
    if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
    document.body.classList.add('rc-visor-abierto');
  }
  function cerrarVisor() {
    const d = $('rc-visor');
    if (!d) return;
    if (typeof d.close === 'function' && d.open) d.close(); else d.removeAttribute('open');
    document.body.classList.remove('rc-visor-abierto');
  }
  function pintarVisor() {
    const f = actual.fotos[vi];
    const img = $('rc-v-img');
    img.src = actual.urls[f.path] || '';
    img.alt = `Photo ${vi + 1} of ${actual.fotos.length} · ${actual.nombre}`;
    $('rc-v-n').textContent = `${vi + 1} / ${actual.fotos.length}`;
    $('rc-v-prev').disabled = vi === 0;
    $('rc-v-next').disabled = vi === actual.fotos.length - 1;
  }
  function mover(paso) {
    if (!actual || quitando) return;
    renovar();
    const n = vi + paso;
    if (n < 0 || n >= actual.fotos.length) return;
    vi = n;
    $('rc-v-hoja').hidden = true;
    pintarVisor();
  }
  async function descargarFoto(boton) {
    const f = actual && actual.fotos[vi];
    if (!f || boton.disabled) return;
    boton.disabled = true;
    try {
      const nombre = `ferocia-${String(actual.nombre).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'photo'}-${vi + 1}.jpg`;
      const { data, error } = await sb.storage.from(CARPETA).createSignedUrl(f.path, 300, { download: nombre });
      if (error || !data || !data.signedUrl) throw error || new Error('no_url');
      const a = h('a', { href: data.signedUrl, download: nombre, rel: 'noopener' });
      document.body.append(a); a.click(); a.remove();
    } catch (_) {
      P.aviso('We could not download this photo. Try again.', true);
    } finally {
      boton.disabled = false;
    }
  }
  async function quitarme(boton) {
    const f = actual && actual.fotos[vi];
    if (!f || boton.disabled) return;
    const yo = actual;
    boton.disabled = true; boton.textContent = 'Removing…';
    quitando = true;
    try {
      const data = await rpc('portal_foto_quitarme', { p_photo_id: f.id });
      if (data && data.error) throw new Error(data.error);
      if (actual !== yo) return;                 // se fue a otro recap mientras tanto
      const i = yo.fotos.indexOf(f);
      if (i >= 0) { yo.fotos.splice(i, 1); if (i < vi) vi--; }
      $('rc-v-hoja').hidden = true;
      if (!actual.fotos.length) { cerrarVisor(); pintarCuerpo(); $('rc-title').focus(); P.aviso('Done — the photo is hidden. The FEROCIA team will review it.'); return; }
      else { vi = Math.min(vi, actual.fotos.length - 1); pintarVisor(); $('rc-v-remove').focus(); }   // el foco sigue en el visor
      pintarCuerpo();
      P.aviso('Done — the photo is hidden. The FEROCIA team will review it.');
    } catch (e) {
      P.aviso(/too_many/.test(String(e && e.message)) ? 'You sent many requests today. Please write to the FEROCIA team.' : 'We could not send your request. Try again.', true);
    } finally {
      quitando = false;
      boton.disabled = false; boton.textContent = 'Yes, remove me';
    }
  }

  /* ── Eventos ── */
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    const foto = t.closest('[data-rc-foto]');
    if (foto) { abrirVisor(Number(foto.dataset.rcFoto)); return; }
    if (t.closest('#rc-share')) { compartir(t.closest('#rc-share')); return; }
    if (t.closest('#rc-v-close')) { cerrarVisor(); return; }
    if (t.closest('#rc-v-prev')) { mover(-1); return; }
    if (t.closest('#rc-v-next')) { mover(1); return; }
    if (t.closest('#rc-v-down')) { descargarFoto(t.closest('#rc-v-down')); return; }
    if (t.closest('#rc-v-remove')) { $('rc-v-hoja').hidden = false; $('rc-v-yes').focus(); return; }
    if (t.closest('#rc-v-cancel')) { $('rc-v-hoja').hidden = true; $('rc-v-remove').focus(); return; }
    if (t.closest('#rc-v-yes')) quitarme(t.closest('#rc-v-yes'));
  });
  const visor = $('rc-visor');
  if (visor) {
    visor.addEventListener('close', () => document.body.classList.remove('rc-visor-abierto'));
    visor.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); mover(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); mover(1); }
    });
    let x0 = null;
    visor.addEventListener('touchstart', (e) => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    visor.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1);
    });
  }
  /* "← Home" o "← My Identity", según de dónde se llegó (se anota al
     tocar el enlace, antes de que cambie la pantalla). */
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[href^="#/recap/"]');
    if (a) desde = document.body.dataset.pantalla === 'profile' ? 'profile' : 'home';
  }, true);
  window.addEventListener('hashchange', () => { if (!/#\/recap\//.test(location.hash)) cerrarVisor(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && document.body.dataset.pantalla === 'recap') renovar();
  });

  P.alEntrar('home', pintarHome);
  P.alEntrar('profile', pintarIdentidad);
  P.alEntrar('recap', pintarRecap);
})();
