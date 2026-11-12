/* ============================================================
   FEROCIA PLAYER PORTAL — LESSONS (§118, SQL 134)
   11 de noviembre de 2026 · diseño aprobado ("FEROCIA Lessons")

   Clases con Leminyer:
     · Home: una tarjeta ("Train with Leminyer" o "Your next lesson").
     · lessons (#/lessons): "My lessons" — las que vienen (cambiar la
       hora, cancelar, añadir a mi calendario) y las de antes.
     · lesson-book (#/lesson-book): reservar en 3 pasos (tipo → día y
       hora → confirmar) y "You're booked!".
       #/lesson-book/<id>: cambiar la hora de esa clase.

   Las horas libres, reservar, cambiar y cancelar pasan por la función
   "lessons" de Supabase (revisa el Google Calendar de Leminyer: si
   Google no contesta, no se reserva). Lo demás, portal_clases().
   Todo se pinta como TEXTO (h()), nunca HTML con datos.
   ============================================================ */
(function () {
  'use strict';
  const P = window.FerociaPortal;
  if (!P) return;
  const { h, sb } = P;
  const $ = (id) => document.getElementById(id);
  const ZONA = 'America/New_York';
  const F_DIA = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, weekday: 'short', month: 'short', day: 'numeric' });
  const F_LARGO = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, weekday: 'long', month: 'short', day: 'numeric' });
  const F_HORA = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' });
  const F_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA });
  const diaDe = (d) => F_ISO.format(d instanceof Date ? d : new Date(d));
  const sumarDias = (dia, n) => { const [y, m, d] = dia.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const mediodia = (dia) => new Date(`${dia}T17:00:00Z`);     // un instante seguro dentro de ese día en Florida
  const cuando = (iso) => `${F_DIA.format(new Date(iso))} · ${F_HORA.format(new Date(iso))}`;
  const precio = (v) => (v == null || v === '' ? '' : `$${Number(v) % 1 ? Number(v).toFixed(2) : Number(v)}`);
  const quedan = (iso) => (Date.parse(iso) - Date.now()) / 3600e3;

  /* ── Los datos: se piden de nuevo al entrar en cada pantalla (una
     llamada pequeña); la promesa sirve para no pedirlos dos veces a la vez. */
  let datosP = null, datosHora = 0;
  function datos(forzar) {
    if (forzar || !datosP || Date.now() - datosHora > 30000) {
      datosHora = Date.now();
      datosP = sb.rpc('portal_clases').then(({ data, error }) => { if (error) { datosP = null; throw error; } return data; });
    }
    return datosP;
  }
  const olvidar = () => { datosP = null; };

  async function funcion(action, data) {
    const { data: r, error } = await sb.functions.invoke('lessons', { body: { action, data } });
    if (error) {
      let cuerpo = null;
      try { cuerpo = await error.context.json(); } catch (_) { /* nada */ }
      const e = new Error((cuerpo && cuerpo.error) || error.message || 'network');
      if (!cuerpo) e.red = true;
      throw e;
    }
    if (!r || r.ok !== true) throw new Error((r && r.error) || 'unexpected');
    return r;
  }

  function errorTexto(err, d) {
    const m = String((err && err.message) || err || '');
    const reglas = (d && d.rules) || {};
    const T = {
      slot_taken: 'That time was just taken — please pick another.',
      slot_unavailable: 'That time is not available anymore — please pick another.',
      google_unavailable: 'Booking is temporarily unavailable. Please try again in a few minutes.',
      google_not_configured: 'Booking is temporarily unavailable. Please try again later.',
      too_many: `You already have ${reglas.max_upcoming || 'the most'} upcoming lessons — the most at a time. You can book another one after your next lesson.`,
      too_late: `Your lesson is less than ${reglas.change_until_hours ?? 24} hours away. To change or cancel it, please contact FEROCIA.`,
      not_booked: 'This lesson was already changed or cancelled. Your lessons are up to date now.',
      not_found: 'This lesson was already changed or cancelled. Your lessons are up to date now.',
      type_not_found: 'This lesson type is not available anymore.',
      invalid_group: 'Choose how many players are coming.',
      note_too_long: 'Your note is too long (500 characters max).',
      not_linked: 'Your account is not connected to a FEROCIA player yet.',
      same_time: 'That is the same time your lesson already has.',
    };
    for (const [k, t] of Object.entries(T)) if (m.includes(k)) return t;
    if (/function .* does not exist|Could not find the function/i.test(m)) return 'Lessons are coming soon.';
    if (err && err.red) return P.errorTexto(new TypeError('fetch'));
    return P.errorTexto(err);
  }

  /* ── El archivo de calendario (.ics) ── */
  const icsTexto = (v) => String(v || '').replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const icsFecha = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function archivoCalendario(c, coach) {
    const texto = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FEROCIA Sports//Lessons//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', `UID:lesson-${Number(c.id)}@ferociasports.com`, `DTSTAMP:${icsFecha(new Date().toISOString())}`,
      `DTSTART:${icsFecha(c.starts_at)}`, `DTEND:${icsFecha(c.ends_at)}`,
      `SEQUENCE:${Math.max(0, Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 1000))}`,
      `SUMMARY:${icsTexto(`FEROCIA lesson · ${c.type_name}`)}`, `LOCATION:${icsTexto('FEROCIA Sports Center')}`,
      `DESCRIPTION:${icsTexto(coach ? `With ${coach}. Manage it in the FEROCIA player portal.` : 'Manage it in the FEROCIA player portal.')}`,
      'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/calendar;charset=utf-8' }));
    const a = h('a', { href: url, download: 'ferocia-lesson.ics', hidden: true });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function botonCalendario(c, coach, clase) {
    const b = h('button', { type: 'button', class: clase || 'pj-btn pj-btn-outline pj-btn-sm', text: 'Add to my calendar' });
    b.addEventListener('click', () => archivoCalendario(c, coach));
    return b;
  }

  /* Un botón ocupado mientras trabaja (y no se puede pulsar dos veces). */
  async function ocupado(btn, texto, fn) {
    if (btn.disabled) return undefined;
    const antes = btn.textContent;
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = texto;
    try { return await fn(); } finally { if (btn.isConnected) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = antes; } }
  }

  /* ============================================================
     HOME: la tarjeta
     ============================================================ */
  P.alEntrar('home', async () => {
    const card = $('ls-card');
    if (!card) return;
    let d;
    try { d = await datos(true); } catch (e) { card.hidden = true; return; }
    const prox = (d.upcoming || []).find((c) => Date.parse(c.starts_at) > Date.now());
    if (!d.available && !prox) { card.hidden = true; return; }
    $('ls-card-t').textContent = prox ? 'Your next lesson' : `Train with ${d.coach || 'FEROCIA'}`;
    $('ls-card-s').textContent = prox ? `${prox.type_name} · ${cuando(prox.starts_at)}` : 'Private & semi-private lessons · Pay at the club';
    const btn = $('ls-card-btn');
    btn.textContent = prox ? 'My lessons' : 'Book';
    btn.setAttribute('href', prox ? '#/lessons' : '#/lesson-book');
    card.hidden = false;
  });

  /* ============================================================
     MY LESSONS
     ============================================================ */
  async function pintarMisClases(forzar) {
    const main = $('ls-main'), err = $('ls-error'), info = $('ls-info');
    main.setAttribute('aria-busy', 'true');
    err.hidden = true;
    let d;
    try { d = await datos(forzar); } catch (e) {
      err.textContent = errorTexto(e); err.hidden = false;
      $('ls-up').replaceChildren(); $('ls-past-sec').hidden = true; $('ls-book').hidden = true;
      main.setAttribute('aria-busy', 'false');
      return;
    }
    $('ls-coach').textContent = d.coach || 'FEROCIA';
    $('ls-book').hidden = !(d.available && d.can_book);
    const reglas = d.rules || {};
    info.hidden = true;
    if (!d.available) { info.textContent = "Lessons can't be booked right now. Please try again later, or contact FEROCIA."; info.hidden = false; }
    else if (!d.can_book) { info.textContent = `You have ${reglas.max_upcoming} upcoming lessons — the most at a time. You can book another one after your next lesson.`; info.hidden = false; }

    const proximas = d.upcoming || [];
    $('ls-up').replaceChildren(...(proximas.length ? proximas.map((c) => filaProxima(c, d)) : [
      h('p', { class: 'ls-vacio', text: d.available ? "You don't have upcoming lessons yet." : 'No upcoming lessons.' }),
      d.available && d.can_book ? h('a', { class: 'pj-btn pj-btn-primary pj-btn-sm', href: '#/lesson-book', text: 'Book a lesson' }) : null,
    ]));
    const antes = d.past || [];
    $('ls-past-sec').hidden = !antes.length;
    const ESTADO = { done: ['Done', 'ls-tag-gris'], attended: ['Done', 'ls-tag-gris'], no_show: ['Missed', 'ls-tag-rojo'], cancelled: ['Cancelled', 'ls-tag-gris'] };
    $('ls-past').replaceChildren(...antes.map((c) => {
      const [t, cl] = ESTADO[c.status] || ['', 'ls-tag-gris'];
      return h('div', { class: 'ls-fila' },
        h('div', { class: 'ls-fila-h' }, h('b', { text: cuando(c.starts_at) }), h('span', { class: `ls-tag ${cl}`, text: t })),
        h('span', { class: 'ls-gris', text: c.type_name + (c.status === 'cancelled' ? (c.cancelled_by === 'admin' ? ' · cancelled by FEROCIA' : ' · cancelled by you') : '') }));
    }));
    main.setAttribute('aria-busy', 'false');
  }

  function filaProxima(c, d) {
    const reglas = d.rules || {};
    const horas = quedan(c.starts_at);
    const tag = horas < 0 ? ['Now', 'ls-tag-lima'] : horas < 24 ? [`In ${Math.max(1, Math.round(horas))} h`, 'ls-tag-ambar'] : ['Booked', 'ls-tag-verde'];
    const fila = h('div', { class: 'ls-fila ls-fila-prox' },
      h('div', { class: 'ls-fila-h' }, h('b', { text: cuando(c.starts_at) }), h('span', { class: `ls-tag ${tag[1]}`, text: tag[0] })),
      h('span', { class: 'ls-gris', text: [c.type_name, `${c.duration_min} min`, c.group_size > 1 ? `${c.group_size} players` : '', precio(c.price) ? `${precio(c.price)} · pay at the club` : ''].filter(Boolean).join(' · ') }));
    const acciones = h('div', { class: 'ls-acts' });
    if (c.can_change) {
      const cambiar = h('a', { class: 'pj-btn pj-btn-outline pj-btn-sm', href: `#/lesson-book/${Number(c.id)}`, text: 'Change time' });
      const cancelar = h('button', { type: 'button', class: 'pj-btn pj-btn-quiet pj-btn-sm', text: 'Cancel' });
      cancelar.addEventListener('click', () => preguntarCancelar(fila, c, d));
      acciones.append(cambiar, cancelar);
    }
    if (horas > 0) acciones.append(botonCalendario(c, d.coach, 'pj-btn pj-btn-quiet pj-btn-sm'));
    fila.append(acciones);
    if (!c.can_change && horas > 0) {
      fila.append(h('p', { class: 'ls-nota', text: `Less than ${reglas.change_until_hours ?? 24} hours to go: to change or cancel, please contact FEROCIA.` }));
    }
    return fila;
  }

  /* "Cancel this lesson?" ahí mismo, sin ventanas. */
  function preguntarCancelar(fila, c, d) {
    if (fila.querySelector('.ls-confirmar')) return;
    const si = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-sm ls-btn-rojo', text: 'Yes, cancel it' });
    const no = h('button', { type: 'button', class: 'pj-btn pj-btn-quiet pj-btn-sm', text: 'Keep it' });
    const caja = h('div', { class: 'ls-confirmar', role: 'group', 'aria-label': 'Cancel this lesson?' },
      h('p', { text: `Cancel your ${c.type_name} on ${cuando(c.starts_at)}?` }), h('div', { class: 'ls-acts' }, si, no));
    fila.append(caja);
    no.focus();
    no.addEventListener('click', () => caja.remove());
    si.addEventListener('click', () => ocupado(si, 'Cancelling…', async () => {
      try {
        await funcion('cancel', { id: Number(c.id) });
        P.aviso('Your lesson was cancelled. We sent you an email.');
      } catch (e) {
        P.aviso(errorTexto(e, d), true);
      }
      olvidar();
      await pintarMisClases(true);
    }));
  }

  P.alEntrar('lessons', () => pintarMisClases(true));

  /* ============================================================
     RESERVAR / CAMBIAR LA HORA
     ============================================================ */
  let R = null;   // { d, cambiar, tipo, slots, dias, hasta, dia, hora, grupo, nota, paso }

  function pasos(n) {
    const el = $('lb-steps');
    el.hidden = !n;
    [...el.children].forEach((x, i) => x.classList.toggle('is-on', i < n));
  }
  function titulo(k, t, n) {
    $('lb-k').textContent = k;
    $('lb-title').textContent = t;
    pasos(n);
  }
  function errorEn(texto) {
    const e = $('lb-error');
    e.textContent = texto || '';
    e.hidden = !texto;
    if (texto) e.focus();
  }

  P.alEntrar('lesson-book', async () => {
    const param = P.rutaParam();
    const cambiar = /^\d{1,15}$/.test(param) ? Number(param) : null;
    errorEn('');
    $('lb-body').replaceChildren(h('p', { class: 'ls-gris', text: 'Loading…' }));
    let d;
    try { d = await datos(true); } catch (e) { $('lb-body').replaceChildren(); errorEn(errorTexto(e)); return; }
    R = { d, cambiar: null, tipo: null, slots: [], hasta: null, dia: null, hora: null, grupo: null, nota: '' };
    if (cambiar) {
      const c = (d.upcoming || []).find((x) => Number(x.id) === cambiar);
      if (!c || !c.can_change) {
        $('lb-body').replaceChildren(h('a', { class: 'pj-btn pj-btn-outline pj-btn-sm', href: '#/lessons', text: 'Back to my lessons' }));
        errorEn(c ? errorTexto('too_late', d) : errorTexto('not_found', d));
        return;
      }
      R.cambiar = c;
      R.tipo = { id: null, name: c.type_name, duration_min: c.duration_min, min_players: c.group_size, max_players: c.group_size, price: c.price };
      return pasoHora();
    }
    if (!d.available) { $('lb-body').replaceChildren(); errorEn("Lessons can't be booked right now. Please try again later, or contact FEROCIA."); titulo('Book a lesson', 'Lessons', 0); return; }
    if (!d.can_book) { $('lb-body').replaceChildren(h('a', { class: 'pj-btn pj-btn-outline pj-btn-sm', href: '#/lessons', text: 'See my lessons' })); errorEn(errorTexto('too_many', d)); titulo('Book a lesson', 'Lessons', 0); return; }
    pasoTipo();
  });

  /* Paso 1: el tipo de clase */
  function pasoTipo() {
    titulo('Book a lesson', 'Choose your lesson', 1);
    const tipos = R.d.types || [];
    const lista = h('div', { class: 'ls-tipos', role: 'radiogroup', 'aria-label': 'Lesson type' });
    const seguir = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block', text: 'Continue' });
    seguir.disabled = !R.tipo;
    tipos.forEach((t) => {
      const elegido = R.tipo && R.tipo.id === t.id;
      const b = h('button', { type: 'button', role: 'radio', class: 'ls-tipo', 'aria-checked': elegido ? 'true' : 'false' },
        h('span', { class: 'ls-tipo-txt' }, h('b', { text: t.name }),
          h('span', { text: [`${t.duration_min} min`, t.max_players > 1 ? `${t.min_players}–${t.max_players} players` : '1 player'].join(' · ') }),
          t.description ? h('span', { class: 'ls-gris', text: t.description }) : null),
        h('span', { class: 'ls-tipo-precio' }, h('b', { text: precio(t.price) || '' }), h('span', { text: 'Pay at the club' })));
      b.addEventListener('click', () => {
        R.tipo = t; R.slots = []; R.hasta = null; R.dia = null; R.hora = null;
        lista.querySelectorAll('.ls-tipo').forEach((x) => x.setAttribute('aria-checked', x === b ? 'true' : 'false'));
        seguir.disabled = false;
      });
      lista.append(b);
    });
    seguir.addEventListener('click', () => { if (R.tipo) pasoHora(); });
    $('lb-body').replaceChildren(lista, seguir);
  }

  /* Paso 2: el día y la hora */
  async function cargarHoras(mas) {
    const hoy = diaDe(new Date());
    const tope = sumarDias(hoy, Number((R.d.rules || {}).max_days_ahead) || 30);
    const desde = mas && R.hasta ? sumarDias(R.hasta, 1) : hoy;
    if (desde > tope) return;
    const hasta = [sumarDias(desde, 30), tope].sort()[0];
    const pedido = R.cambiar ? { change_id: Number(R.cambiar.id), from: desde, to: hasta } : { type_id: R.tipo.id, from: desde, to: hasta };
    const r = await funcion('slots', pedido);
    R.slots = mas ? R.slots.concat(r.slots || []) : (r.slots || []);
    R.hasta = hasta;
    R.tope = tope;
  }
  async function pasoHora(recargar) {
    titulo(R.cambiar ? 'Change the time' : `Book a lesson · ${R.tipo.name}`, 'Pick a day and time', R.cambiar ? 0 : 2);
    const cuerpo = $('lb-body');
    if (!R.hasta || recargar) {
      cuerpo.replaceChildren(h('p', { class: 'ls-gris', role: 'status', text: 'Checking free times…' }));
      try { await cargarHoras(false); } catch (e) { cuerpo.replaceChildren(volver()); errorEn(errorTexto(e, R.d)); return; }
    }
    const porDia = new Map();
    R.slots.forEach((s) => { const k = diaDe(s.s); if (!porDia.has(k)) porDia.set(k, []); porDia.get(k).push(s); });
    const hoy = diaDe(new Date());
    const dias = [];
    for (let k = hoy; k <= R.hasta; k = sumarDias(k, 1)) dias.push(k);
    if (!R.dia || !porDia.has(R.dia)) R.dia = dias.find((k) => porDia.has(k)) || null;
    const tira = h('div', { class: 'ls-dias', role: 'radiogroup', 'aria-label': 'Day' });
    const horas = h('div', { class: 'ls-horas', role: 'radiogroup', 'aria-label': 'Time' });
    const etiqueta = h('p', { class: 'ls-sub2' });
    const seguir = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block', text: 'Continue' });
    const pintarHoras = () => {
      etiqueta.textContent = R.dia ? F_LARGO.format(mediodia(R.dia)) : '';
      const lista = R.dia ? porDia.get(R.dia) || [] : [];
      if (R.hora && !lista.some((s) => s.s === R.hora.s)) R.hora = null;
      horas.replaceChildren(...lista.map((s) => {
        const b = h('button', { type: 'button', role: 'radio', class: 'ls-hora', 'aria-checked': R.hora && R.hora.s === s.s ? 'true' : 'false', text: F_HORA.format(new Date(s.s)) });
        b.addEventListener('click', () => {
          R.hora = s;
          horas.querySelectorAll('.ls-hora').forEach((x) => x.setAttribute('aria-checked', x === b ? 'true' : 'false'));
          seguir.disabled = false;
        });
        return b;
      }));
      seguir.disabled = !R.hora;
    };
    dias.forEach((k) => {
      const hay = porDia.has(k);
      const fecha = mediodia(k);
      const b = h('button', { type: 'button', role: 'radio', class: 'ls-dia', 'aria-checked': k === R.dia ? 'true' : 'false',
        'aria-label': `${F_LARGO.format(fecha)}${hay ? '' : ', no openings'}` },
        h('span', { text: new Intl.DateTimeFormat('en-US', { timeZone: ZONA, weekday: 'short' }).format(fecha) }),
        h('b', { text: new Intl.DateTimeFormat('en-US', { timeZone: ZONA, day: 'numeric' }).format(fecha) }));
      if (!hay) b.disabled = true;
      b.addEventListener('click', () => {
        R.dia = k;
        tira.querySelectorAll('.ls-dia').forEach((x) => x.setAttribute('aria-checked', x === b ? 'true' : 'false'));
        pintarHoras();
      });
      tira.append(b);
    });
    const masFechas = R.hasta < R.tope ? h('button', { type: 'button', class: 'ls-mas', text: 'Later dates →' }) : null;
    if (masFechas) {
      masFechas.addEventListener('click', () => ocupado(masFechas, 'Loading…', async () => {
        try { await cargarHoras(true); pasoHora(); } catch (e) { errorEn(errorTexto(e, R.d)); }
      }));
      tira.append(masFechas);
    }
    pintarHoras();
    seguir.addEventListener('click', () => { if (R.hora) pasoConfirmar(); });
    const partes = [];
    if (R.cambiar) partes.push(h('p', { class: 'ls-sub2', text: `Now: ${R.cambiar.type_name} · ${cuando(R.cambiar.starts_at)}` }));
    if (!R.dia) {
      partes.push(h('p', { class: 'ls-vacio', text: `No openings in the next ${Math.round((Date.parse(R.hasta) - Date.parse(hoy)) / 864e5) + 1} days.` }));
      if (masFechas) partes.push(masFechas);
      partes.push(volver());
    } else {
      partes.push(h('p', { class: 'ls-sub2', text: R.dia ? new Intl.DateTimeFormat('en-US', { timeZone: ZONA, month: 'long' }).format(mediodia(R.dia)) : '' }),
        tira, etiqueta, horas, h('p', { class: 'ls-gris', text: 'Times are Florida time (ET). Days in grey have no openings.' }), seguir);
    }
    cuerpo.replaceChildren(...partes);
  }
  const volver = () => h('a', { class: 'pj-btn pj-btn-quiet pj-btn-sm', href: R && R.cambiar ? '#/lessons' : '#/lesson-book', text: 'Back' });

  /* Paso 3: confirmar */
  function pasoConfirmar() {
    const t = R.tipo, s = R.hora, reglas = R.d.rules || {};
    titulo(R.cambiar ? 'Change the time' : 'Book a lesson', R.cambiar ? 'Confirm the new time' : 'Confirm your lesson', R.cambiar ? 0 : 3);
    const resumen = h('div', { class: 'ls-resumen' },
      h('b', { text: `${t.name} · ${t.duration_min} min` }),
      h('span', { text: `${F_LARGO.format(new Date(s.s))} · ${F_HORA.format(new Date(s.s))} – ${F_HORA.format(new Date(s.e))}` }),
      h('span', { text: `FEROCIA Sports Center · with ${R.d.coach || 'FEROCIA'}` }),
      precio(t.price) ? h('span', { class: 'ls-precio', text: `${precio(t.price)} · Pay at the club` }) : null,
      R.cambiar ? h('span', { class: 'ls-gris', text: `Before: ${cuando(R.cambiar.starts_at)}` }) : null);
    const partes = [resumen];
    let grupo = null, nota = null;
    if (!R.cambiar) {
      if (t.max_players > 1) {
        grupo = h('select', { id: 'lb-grupo', class: 'pj-input' },
          ...Array.from({ length: t.max_players - t.min_players + 1 }, (_, i) => h('option', { value: t.min_players + i, text: String(t.min_players + i) })));
        if (R.grupo) grupo.value = String(R.grupo);
        partes.push(h('div', { class: 'pj-field' }, h('label', { class: 'pj-label', for: 'lb-grupo', text: 'How many players, you included?' }), grupo,
          h('span', { class: 'ls-gris', text: 'You book the time for your whole group.' })));
      }
      nota = h('textarea', { id: 'lb-nota', class: 'pj-input', rows: '3', maxlength: '500', placeholder: 'e.g. I want to work on my third shot drop…' });
      nota.value = R.nota || '';
      partes.push(h('div', { class: 'pj-field' }, h('label', { class: 'pj-label', for: 'lb-nota', text: 'Anything I should know? (optional)' }), nota));
    }
    const n = Number(reglas.change_until_hours ?? 24);
    partes.push(h('p', { class: 'ls-politica', text: n > 0
      ? `You can cancel or change the time yourself until ${n} hour${n === 1 ? '' : 's'} before. After that, please contact FEROCIA. A missed lesson counts in your reliability.`
      : 'You can cancel or change the time yourself in My lessons. A missed lesson counts in your reliability.' }));
    const ok = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block', text: R.cambiar ? 'Confirm new time' : 'Confirm booking' });
    const atras = h('button', { type: 'button', class: 'pj-btn pj-btn-quiet pj-btn-block', text: 'Back' });
    atras.addEventListener('click', () => { if (nota) R.nota = nota.value; if (grupo) R.grupo = Number(grupo.value); pasoHora(); });
    ok.addEventListener('click', () => ocupado(ok, R.cambiar ? 'Saving…' : 'Booking…', async () => {
      errorEn('');
      try {
        let r;
        if (R.cambiar) r = await funcion('change', { id: Number(R.cambiar.id), start: s.s });
        else r = await funcion('book', { type_id: t.id, start: s.s, group: grupo ? Number(grupo.value) : null, note: nota && nota.value.trim() ? nota.value.trim() : null });
        olvidar();
        listo(r.booking, !!R.cambiar);
      } catch (e) {
        const m = String(e.message || '');
        if (/slot_taken|slot_unavailable/.test(m)) {
          if (nota) R.nota = nota.value;
          if (grupo) R.grupo = Number(grupo.value);
          R.hora = null;
          await pasoHora(true);
          errorEn(errorTexto(e, R.d));
        } else errorEn(errorTexto(e, R.d));
      }
    }));
    partes.push(ok, atras);
    $('lb-body').replaceChildren(...partes);
  }

  /* "You're booked!" */
  function listo(c, cambio) {
    titulo(cambio ? 'Change the time' : 'Book a lesson', cambio ? 'New time saved!' : "You're booked!", 0);
    const correo = P.estado() && P.estado().email;
    const caja = h('div', { class: 'ls-listo', role: 'status' },
      h('span', { class: 'ls-ok', 'aria-hidden': 'true', text: '✓' }),
      h('b', { text: `See you ${F_LARGO.format(new Date(c.starts_at)).split(',')[0]}!` }),
      h('span', { text: `${c.type_name} · ${cuando(c.starts_at)}` }),
      h('span', { class: 'ls-gris', text: correo ? `We sent the details to ${correo}` : 'We sent you an email with the details.' }));
    $('lb-body').replaceChildren(caja, botonCalendario({ id: c.id, type_name: c.type_name, starts_at: c.starts_at, ends_at: c.ends_at }, R.d.coach, 'pj-btn pj-btn-outline pj-btn-block'),
      h('a', { class: 'pj-btn pj-btn-quiet pj-btn-block', href: '#/lessons', text: 'See my lessons' }));
    $('lb-title').focus();
  }

  /* Para las pruebas. */
  P.lessons = { datos, olvidar, archivoCalendario };
})();
