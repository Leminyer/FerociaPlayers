/* ============================================================
   FEROCIA PLAYER PORTAL — My profile y Edit profile
   Hitos 3 y 4 (14 de octubre) — pantallas 7 y 8 del diseño aprobado

   · My profile: sus datos (de su ficha), lo de pickleball y su cuenta.
   · Edit profile: el jugador cambia SOLO teléfono, género y nivel
     (portal_guardar_perfil; la base lo vuelve a comprobar y lo deja
     escrito en el historial de su ficha). Nombre y fecha de nacimiento
     están bloqueados: "Request a change" abre Help con "My details".
     El teléfono nuevo también pasa a la lista de suscriptores (§43).
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { sb, h, fmt } = P;
  const $ = (id) => document.getElementById(id);

  const ICONOS = {
    link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>',
    lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  };
  function icono(svg, clase) { const s = h('span', { class: `pj-fact-ico ${clase}`, 'aria-hidden': 'true' }); s.innerHTML = svg; return s; }

  /* ¿Recibe los correos del club? (su ficha de suscriptor) */
  P.textoClub = function (estadoSub) {
    switch (estadoSub) {
      case 'active': return { pill: 'Subscribed', clase: 'pj-pill-ok', titulo: 'Club emails: on', ayuda: 'You get FEROCIA Monthly and event news.' };
      case 'pending': return { pill: 'Waiting for you', clase: 'pj-pill-warn', titulo: 'Club emails: confirm your email', ayuda: 'Open the confirmation email we sent you to start getting FEROCIA Monthly.' };
      case 'unsubscribed': return { pill: 'Off', clase: 'pj-pill-gray', titulo: 'Club emails: off', ayuda: 'You unsubscribed. You can sign up again at ferociasports.com.' };
      case 'bounced': return { pill: 'Not delivered', clase: 'pj-pill-warn', titulo: 'Club emails: not delivered', ayuda: 'Our emails could not reach your address. Send us a message from Help.' };
      default: return { pill: 'Not subscribed', clase: 'pj-pill-gray', titulo: 'Club emails: off', ayuda: 'Sign up for FEROCIA Monthly at ferociasports.com.' };
    }
  };

  const par = (dt, dd) => h('div', { class: 'pj-dl-item' }, h('dt', { text: dt }), h('dd', null, dd));

  /* ── 7 · MY PROFILE ── */
  let vez = 0;
  P.alEntrar('profile', async () => {
    const mia = ++vez;
    $('pf-error').hidden = true;
    let d;
    try { d = await P.datos(); } catch (err) {
      if (mia !== vez) return;
      $('pf-error').textContent = P.errorTexto(err);
      $('pf-error').hidden = false;
      return;
    }
    if (mia !== vez) return;
    const p = d.player || {};
    const st = d.stats || {};
    const actual = (d.ladders || []).find((l) => l.status === 'active' && l.rank);
    const mejor = (d.tournaments || []).find((t) => t.finish === 'Champion')
      || (d.tournaments || []).find((t) => t.finish === 'Runner-up')
      || (d.tournaments || []).find((t) => t.finish === '3rd place');

    $('pf-ini').textContent = fmt.iniciales(p.first_name, p.last_name, p.email);
    $('pf-name').textContent = [p.first_name, p.last_name].filter(Boolean).join(' ');
    $('pf-chips').replaceChildren(
      p.skill_level ? h('span', { class: 'pj-chip pj-chip-lime', text: p.skill_level }) : null,
      p.date_joined ? h('span', { class: 'pj-chip', text: `Since ${fmt.mesAnio(p.date_joined)}` }) : null);
    $('pf-stats').replaceChildren(
      h('div', null, h('dt', { text: 'Games' }), h('dd', { text: st.played || 0 })),
      h('div', null, h('dt', { text: 'Ladders' }), h('dd', { text: (d.ladders || []).length })),
      h('div', null, h('dt', { text: 'Tournaments' }), h('dd', { text: new Set((d.tournaments || []).map((t) => t.id)).size })));

    $('pf-personal').replaceChildren(
      par('First name', p.first_name || '—'),
      par('Last name', p.last_name || '—'),
      par('Date of birth', fmt.largo(p.date_of_birth) || '—'),
      par('Gender', p.gender || '—'),
      par('Email', h('span', { class: 'pj-dd-row' }, h('span', { class: 'pj-break', text: p.email || '' }), h('span', { class: 'pj-pill-ok', text: 'Verified' }))),
      par('Mobile phone', fmt.telefono(p.phone) || '—'));
    $('pf-pickleball').replaceChildren(
      par('Playing level', p.skill_level || 'Not set'),
      par('Player since', fmt.mesAnio(p.date_joined) || '—'),
      par('Current ladder', actual ? `${actual.name} · #${actual.rank}` : 'None right now'),
      par('Best result', mejor ? `${mejor.finish} · ${mejor.name}` : '—'));

    const club = P.textoClub(d.club_emails);
    const hecho = (svg, clase, titulo, texto) => h('div', { class: 'pj-fact' }, icono(svg, clase),
      h('span', { class: 'pj-fact-txt' }, h('span', { class: 'pj-fact-t', text: titulo }), h('span', { class: 'pj-fact-s', text: texto })));
    $('pf-account').replaceChildren(
      hecho(ICONOS.link, 'is-green', 'Player record linked', 'Your ladders and results stay in sync.'),
      hecho(ICONOS.mail, 'is-blue', club.titulo, club.ayuda),
      hecho(ICONOS.lock, 'is-gray', 'Sign-in by email link', 'No password to remember.'));
  });

  /* ── 8 · EDIT PROFILE ── */
  const telefono = $('ed-phone');
  P.mascaraTelefono(telefono);
  const marcar = (el, mal) => { if (mal) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); };
  const elegir = (name, valor) => document.querySelectorAll(`input[name="${name}"]`).forEach((r) => { r.checked = r.value === valor; });
  const elegido = (name) => { const r = document.querySelector(`input[name="${name}"]:checked`); return r ? r.value : ''; };
  function error(texto) { $('ed-error').textContent = texto || ''; $('ed-error').hidden = !texto; }

  let original = null;
  P.alEntrar('edit', async () => {
    error('');
    let d;
    try { d = await P.datos(); } catch (err) { error(P.errorTexto(err)); return; }
    const p = d.player || {};
    original = { phone: String(p.phone || '').replace(/\D/g, ''), gender: p.gender || '', level: p.skill_level || '' };
    telefono.value = fmt.telefono(p.phone);
    marcar(telefono, false);
    elegir('ed-gender', p.gender);
    elegir('ed-level', p.skill_level);
    $('ed-name').textContent = [p.first_name, p.last_name].filter(Boolean).join(' ');
    $('ed-dob').textContent = fmt.largo(p.date_of_birth) || 'Date of birth not on file';
  });

  $('ed-request').addEventListener('click', () => {
    P.temaAyuda = 'my_details';
    P.ir('help');
  });

  let guardando = false;
  $('ed-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (guardando) return;
    error('');
    const digitos = telefono.value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    const genero = elegido('ed-gender');
    const nivel = elegido('ed-level');
    marcar(telefono, digitos.length !== 10);
    marcar($('ed-gender'), !genero);
    marcar($('ed-level'), !nivel);
    if (digitos.length !== 10) { error('Enter a 10-digit US phone number.'); telefono.focus(); return; }
    if (!genero || !nivel) { error('Choose your gender and playing level.'); return; }
    if (original && original.phone === digitos && original.gender === genero && original.level === nivel) {
      P.aviso('Nothing to save — your details are the same.');
      P.ir('profile');
      return;
    }
    guardando = true;
    const b = $('ed-submit');
    b.disabled = true;
    b.setAttribute('aria-busy', 'true');
    try {
      const { error: err } = await sb.rpc('portal_guardar_perfil', { p_phone: digitos, p_gender: genero, p_skill_level: nivel });
      if (err) throw err;
      P.olvidarDatos();
      P.aviso('Your profile is updated.');
      P.ir('profile');
    } catch (err) {
      console.warn('[portal] guardar perfil:', err);
      error(P.errorTexto(err, { invalid_phone: 'Enter a 10-digit US phone number.' }));
    } finally {
      guardando = false;
      b.disabled = false;
      b.setAttribute('aria-busy', 'false');
    }
  });
})();
