/* ============================================================
   FEROCIA PLAYER PORTAL — la app en el teléfono y los avisos push
   SQL 110 (18 de octubre) — decisión §92, Fase 1 (PWA). Diseño
   aprobado ("FEROCIA — notificaciones push y ciudad/estado").

   Cuatro piezas:
     1. Registra sw.js (el que enseña los avisos con el portal cerrado).
     2. Home: la tarjeta "Get FEROCIA on your phone" (sólo en teléfonos
        que todavía no lo tienen): en iPhone los 3 pasos de "Add to
        Home Screen"; en Android el botón Install.
     3. Account: "Notifications on this device" (encender / apagar),
        los mensajes del chat sí/no y "Send me a test".
     4. Después de crear un juego o pedir unirse: una invitación suave
        a encender los avisos. Nunca se pide el permiso del teléfono sin
        explicar antes para qué (en iPhone, si dice que no, no se puede
        volver a preguntar).

   Seguridad: el portal sólo guarda en la base la dirección del
   servicio de push del teléfono y sus dos llaves públicas. Los avisos
   salen del servidor (player-push), nunca del navegador.
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { sb } = P;
  const $ = (id) => document.getElementById(id);

  /* ── El aparato ── */
  const ua = navigator.userAgent || '';
  const esIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const esAndroid = /Android/i.test(ua);
  const esTelefono = esIOS || esAndroid;
  /* Instagram, Facebook, Gmail…: su navegador de dentro no puede añadir a la pantalla de inicio. */
  const dentroDeOtraApp = /FBAN|FBAV|Instagram|Line\/|GSA\/|LinkedInApp|Twitter|Snapchat/i.test(ua);
  const enApp = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const hayPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const permiso = () => ('Notification' in window ? Notification.permission : 'default');
  const nombreAparato = () => (/iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (esIOS && !/iPhone/.test(ua)) ? 'iPad'
    : esAndroid ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Computer');

  /* Recordatorios de este navegador ("Not now"): si no se pueden guardar, no pasa nada. */
  const recuerdo = {
    leer(k) { try { return localStorage.getItem(`fe-push-${k}`); } catch (e) { return null; } },
    poner(k, v) { try { localStorage.setItem(`fe-push-${k}`, v); } catch (e) { /* modo privado */ } },
  };
  const hace = (k, dias) => { const t = Number(recuerdo.leer(k)); return t && Date.now() - t < dias * 864e5; };

  async function rpc(fn, args) {
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) throw error;
    return data;
  }

  /* ── 1. El service worker ── */
  let registro = null;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((r) => { registro = r; })
      .catch((e) => console.warn('[portal] service worker:', (e && e.message) || e));
    /* Si el navegador no pudo cambiar de pantalla al tocar un aviso. */
    navigator.serviceWorker.addEventListener('message', (ev) => {
      const u = ev.data && ev.data.ferocia === 'abrir' && typeof ev.data.url === 'string' ? ev.data.url : '';
      /* §103: con aviso, se vuelve a cargar el portal (datos de ahora + el cartel). */
      try { if (/[?&]aviso=/.test(u) && new URL(u).origin === location.origin) { location.href = u; return; } } catch (e) { /* abajo */ }
      const i = u.indexOf('#/');
      if (i >= 0) location.hash = u.slice(i);
    });
  }
  /* El registro listo, con tope de espera (un navegador raro no deja colgado nada). */
  async function listo() {
    if (registro && registro.active) return registro;
    const r = await Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error('sw_timeout')), 8000))]);
    registro = r;
    return r;
  }
  async function suscripcion() {
    if (!hayPush()) return null;
    try { return await (await listo()).pushManager.getSubscription(); } catch (e) { return null; }
  }

  /* ── La llave pública del club (no es secreta) ── */
  let llave = null;
  async function clave() {
    if (llave) return llave;
    const d = await rpc('portal_push_clave');
    llave = d && typeof d.key === 'string' && /^B[A-Za-z0-9_-]{86}$/.test(d.key) ? d.key : null;
    return llave;
  }
  const bytes = (b64u) => {
    const s = atob(b64u.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64u.length % 4)) % 4));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  };
  const mismaLlave = (sub, k) => {
    try {
      const a = new Uint8Array(sub.options.applicationServerKey), b = bytes(k);
      return a.length === b.length && a.every((x, i) => x === b[i]);
    } catch (e) { return true; }   // si el navegador no lo dice, se da por buena
  };

  /* ── Encender y apagar en este aparato ── */
  async function encender() {
    if (!hayPush()) return { ok: false, motivo: esIOS && !enApp() ? 'ios_instalar' : 'sin_soporte' };
    /* El permiso se pide LO PRIMERO, en el mismo toque: iPhone no deja
       pedirlo después de esperar a la red. La llave ya suele estar
       pedida de antes (al pintar la tarjeta o Account). */
    const pidiendo = Notification.requestPermission();
    const k = await clave();
    const p = await pidiendo;
    if (!k) return { ok: false, motivo: 'no_listo' };
    if (p !== 'granted') return { ok: false, motivo: p === 'denied' ? 'bloqueado' : 'cerrado' };
    const reg = await listo();
    let sub = await reg.pushManager.getSubscription();
    if (sub && !mismaLlave(sub, k)) { await sub.unsubscribe().catch(() => {}); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(k) });
    const j = sub.toJSON();
    await rpc('portal_push_guardar', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_device: nombreAparato() });
    return { ok: true };
  }
  async function apagar() {
    const sub = await suscripcion();
    if (!sub) return;
    await rpc('portal_push_quitar', { p_endpoint: sub.endpoint });
    await sub.unsubscribe().catch(() => {});
  }
  const MOTIVOS = {
    ios_instalar: 'On iPhone, add FEROCIA to your Home Screen first, then open it from the icon.',
    sin_soporte: "This browser can't receive notifications. Try Chrome on Android, or Safari on iPhone.",
    no_listo: 'Notifications are almost ready. Please try again later.',
    bloqueado: esIOS ? 'Notifications are blocked for FEROCIA. Open Settings → Notifications → FEROCIA and turn on Allow Notifications.'
      : 'Notifications are blocked for this site. Allow them in your browser settings (the icon next to the address), then try again.',
    cerrado: "Notifications are still off. When your phone asks, tap Allow.",
  };
  const textoFallo = (e) => P.errorTexto(e, {
    too_many_tests: "You've sent 5 tests in the last hour. Please try again later.",
    not_subscribed: 'Turn on notifications on this device first.',
    invalid_endpoint: "This browser's notifications aren't supported. Try Chrome on Android, or Safari on iPhone.",
  });

  /* Al salir de la cuenta (pj-account.js): este aparato deja de recibir
     los avisos de esta persona (con todos = true, ninguno de sus aparatos).
     Nunca frena la salida (4 s como mucho). */
  P.pushAlSalir = async function (todos) {
    try {
      const sub = await Promise.race([suscripcion(), new Promise((r) => setTimeout(() => r(null), 1500))]);
      if (!sub && !todos) return;
      await Promise.race([rpc('portal_push_salir', { p_endpoint: sub ? sub.endpoint : null, p_todos: !!todos }), new Promise((r) => setTimeout(r, 2500))]);
      if (sub) await sub.unsubscribe().catch(() => {});
    } catch (e) { console.warn('[portal] push al salir:', e); }
  };

  /* Este aparato tiene una suscripción, pero ya no vale para quien entró:
       · el permiso se quitó en los ajustes del teléfono → se quita también aquí;
       · en la base es de otra persona (entró otra cuenta en este aparato), o
         ya no está → se suelta, para que no lleguen aquí avisos de otra persona.
     Devuelve la suscripción que sigue valiendo (o null). */
  async function revisarAparato(sub) {
    if (!sub) return null;
    try {
      if (permiso() !== 'granted') {
        await rpc('portal_push_quitar', { p_endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
        return null;
      }
      const est = await rpc('portal_push_estado', { p_endpoint: sub.endpoint });
      if (est && est.this_device) return sub;
      await rpc('portal_push_soltar', { p_endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
      return null;
    } catch (e) { return sub; }   // sin red: no se toca nada
  }

  /* ── 2. Home: "Get FEROCIA on your phone" ── */
  let pedirInstalar = null;   // el aviso de Chrome para instalar (Android)
  window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); pedirInstalar = ev; pintarTarjeta(); });
  window.addEventListener('appinstalled', () => { pedirInstalar = null; pintarTarjeta(); });

  const mostrar = (id, si) => { const el = $(id); if (el) el.hidden = !si; };
  async function pintarTarjeta() {
    const card = $('pu-card');
    if (!card) return;
    const e = P.estado();
    const sub = e && e.estado === 'vinculado' ? await revisarAparato(await suscripcion()) : null;
    /* ¿Ya están listos los avisos en el club? (la llave; de paso queda pedida). */
    const lista = hayPush() ? await clave().catch(() => null) : null;
    let modo = null;
    if (e && e.estado === 'vinculado' && esTelefono && !hace('later', 14) && !sub && permiso() !== 'denied') {
      if (esIOS && !enApp()) modo = dentroDeOtraApp ? 'safari' : 'ios';
      else if (esAndroid && !enApp() && pedirInstalar) modo = 'android';
      else if (lista && permiso() === 'default') modo = 'on';
    }
    card.hidden = !modo;
    if (!modo) return;
    card.dataset.modo = modo;
    $('pu-s').textContent = modo === 'android' ? 'One tap. It opens like an app and tells you when something happens.'
      : modo === 'on' ? "Turn on notifications and we'll tell you when someone invites you, joins your game or the game changes."
        : 'Know right away when someone invites you or joins your game.';
    $('pu-t').textContent = modo === 'on' ? 'Know right away' : 'Get FEROCIA on your phone';
    mostrar('pu-ios', modo === 'ios');
    mostrar('pu-pics', modo === 'ios');
    mostrar('pu-safari', modo === 'safari');
    mostrar('pu-install', modo === 'android');
    mostrar('pu-alt', modo === 'android' && !!lista && permiso() === 'default');
    mostrar('pu-on', modo === 'on');
    mostrar('pu-err', false);
  }
  function errorTarjeta(t) { const el = $('pu-err'); el.textContent = t; el.hidden = !t; }
  async function botonEncender(boton, alAcabar) {
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
    try {
      const r = await encender();
      if (r.ok) { P.aviso("Notifications are on. We'll let you know when something happens."); if (alAcabar) alAcabar(true); }
      else { if (alAcabar) alAcabar(false, MOTIVOS[r.motivo]); else P.aviso(MOTIVOS[r.motivo], true); }
    } catch (e) {
      console.warn('[portal] encender push:', e);
      if (alAcabar) alAcabar(false, textoFallo(e)); else P.aviso(textoFallo(e), true);
    } finally {
      boton.disabled = false;
      boton.setAttribute('aria-busy', 'false');
    }
  }
  if ($('pu-card')) {
    $('pu-later').addEventListener('click', () => { recuerdo.poner('later', String(Date.now())); $('pu-card').hidden = true; });
    $('pu-install').addEventListener('click', async () => {
      if (!pedirInstalar) return;
      const ev = pedirInstalar;
      pedirInstalar = null;
      try { await ev.prompt(); await ev.userChoice; } catch (e) { console.warn('[portal] instalar:', e); }
      pintarTarjeta();
    });
    const alTerminar = (ok, t) => { if (ok) pintarTarjeta(); else errorTarjeta(t || ''); };
    $('pu-on').addEventListener('click', (ev) => botonEncender(ev.currentTarget, alTerminar));
    $('pu-on-alt').addEventListener('click', (ev) => botonEncender(ev.currentTarget, alTerminar));
    $('pu-pics').addEventListener('click', verDibujos);
    P.alEntrar('home', () => { pintarTarjeta(); });
  }

  /* "Show me with pictures" (aprobado 18 oct): los 3 pasos del iPhone con un
     dibujo cada uno, uno a la vez. Los dibujos son archivos fijos (assets/). */
  const PASOS = [
    ['assets/ios-paso-1.svg', 'Tap Share', 'In Safari, tap Share — the square with an arrow. It is at the bottom of the screen, or inside the ••• menu.'],
    ['assets/ios-paso-2.svg', 'Tap Add to Home Screen', 'Scroll down the list until you see Add to Home Screen, tap it, then tap Add.'],
    ['assets/ios-paso-3.svg', 'Open FEROCIA from the icon', 'Open FEROCIA from the new icon on your Home Screen, then turn on notifications.'],
  ];
  function verDibujos() {
    const UI = P.juegosUI;
    if (!UI || !UI.ventana) return;
    const { h } = P;
    UI.ventana((caja, cerrar, idT) => {
      let i = 0;
      const img = h('img', { class: 'pu-pic', width: '320', height: '200', alt: '' });
      const num = h('span', { class: 'pu-pic-n' });
      const tit = h('h2', { id: idT });
      const txt = h('p', { class: 'pj-small gm-m0' });
      const atras = h('button', { type: 'button', class: 'gm-btn-quiet', text: 'Back' });
      const sig = h('button', { type: 'button', class: 'pj-btn pj-btn-primary' });
      const pintar = () => {
        const [src, t, d] = PASOS[i];
        img.src = src; img.alt = `Step ${i + 1}: ${t}`;
        num.textContent = `Step ${i + 1} of ${PASOS.length}`;
        tit.textContent = t; txt.textContent = d;
        atras.hidden = i === 0;
        sig.textContent = i === PASOS.length - 1 ? 'Got it' : 'Next';
      };
      atras.addEventListener('click', () => { if (i > 0) { i--; pintar(); sig.focus(); } });
      sig.addEventListener('click', () => { if (i < PASOS.length - 1) { i++; pintar(); } else cerrar(true); });
      caja.classList.add('pu-pics-box');
      caja.append(num, tit, img, txt, h('div', { class: 'pu-pic-acts' }, atras, sig));
      pintar();
      return sig;
    });
  }

  /* ── 3. Account: "Notifications on this device" ── */
  const sw = $('st-push-sw'), swChat = $('st-chat-sw');
  async function pintarCuenta() {
    const caja = $('st-push');
    if (!caja) return;
    const e = P.estado();
    if (!e || e.estado !== 'vinculado') { caja.hidden = true; return; }
    caja.hidden = false;
    const aviso = (t) => { $('st-push-warn').textContent = t || ''; $('st-push-warn').hidden = !t; };
    let est = null;
    const sub = await revisarAparato(await suscripcion());
    if (hayPush()) clave().catch(() => null);   // que esté pedida antes del toque
    try { est = await rpc('portal_push_estado', { p_endpoint: sub ? sub.endpoint : null }); } catch (err) { caja.hidden = true; return; }
    const on = !!(est && est.this_device && sub);
    let motivo = null;
    if (!hayPush()) motivo = esIOS && !enApp() ? 'ios_instalar' : 'sin_soporte';
    else if (permiso() === 'denied') motivo = 'bloqueado';
    else if (!est.ready) motivo = 'no_listo';
    sw.hidden = !!motivo && !on;
    sw.setAttribute('aria-checked', String(on));
    $('st-push-v').textContent = on ? `On · ${nombreAparato()}` : motivo === 'bloqueado' ? 'Blocked on this device' : 'Off';
    $('st-push-v').classList.toggle('pu-on-txt', on);
    $('st-push-more').hidden = !on;
    swChat.setAttribute('aria-checked', String(est.chat !== false));
    aviso(motivo && !on ? MOTIVOS[motivo] : '');
  }
  if (sw) {
    sw.addEventListener('click', async () => {
      const antes = sw.getAttribute('aria-checked') === 'true';
      sw.disabled = true;
      try {
        if (antes) { await apagar(); P.aviso("Notifications are off on this device. Game updates come by email again."); }
        else {
          const r = await encender();
          if (r.ok) P.aviso('Notifications are on for this device.');
          else P.aviso(MOTIVOS[r.motivo], true);
        }
      } catch (e) {
        console.warn('[portal] push:', e);
        P.aviso(textoFallo(e), true);
      } finally {
        sw.disabled = false;
        pintarCuenta();
      }
    });
    swChat.addEventListener('click', async () => {
      const antes = swChat.getAttribute('aria-checked') === 'true';
      swChat.setAttribute('aria-checked', String(!antes));
      swChat.disabled = true;
      try {
        await rpc('portal_push_chat', { p_on: !antes });
        P.aviso(!antes ? 'Chat notifications are on.' : "Chat notifications are off. You'll still see new messages in the game.");
      } catch (e) {
        swChat.setAttribute('aria-checked', String(antes));
        P.aviso(textoFallo(e), true);
      } finally { swChat.disabled = false; }
    });
    $('st-push-test').addEventListener('click', async (ev) => {
      const b = ev.currentTarget;
      b.disabled = true;
      try {
        const sub = await suscripcion();
        if (!sub) throw new Error('not_subscribed');
        await rpc('portal_push_prueba', { p_endpoint: sub.endpoint });
        P.aviso('Test sent. It should arrive in a few seconds.');
      } catch (e) { P.aviso(textoFallo(e), true); } finally { b.disabled = false; }
    });
    P.alEntrar('settings', () => { pintarCuenta(); });
  }

  /* ── 4. Después de crear un juego o pedir unirse ── */
  P.pushOfrecer = async function (para) {
    try {
      const UI = P.juegosUI;
      if (!UI || !UI.ventana || !hayPush() || (esIOS && !enApp()) || permiso() !== 'default' || hace('ask', 30)) return;
      if (await suscripcion()) return;
      if (!(await clave())) return;
      recuerdo.poner('ask', String(Date.now()));
      const host = para === 'host';
      await UI.ventana((caja, cerrar, idT) => {
        const { h } = P;
        const err = h('div', { class: 'pj-alert pj-alert-error', role: 'alert', hidden: true });
        const si = h('button', { type: 'button', class: 'pj-btn pj-btn-primary pj-btn-block', text: 'Turn on notifications' });
        const no = h('button', { type: 'button', class: 'gm-btn-quiet', text: 'Not now' });
        si.addEventListener('click', () => botonEncender(si, (ok, t) => { if (ok) cerrar(true); else { err.textContent = t || ''; err.hidden = !t; } }));
        no.addEventListener('click', () => cerrar(null));
        caja.classList.add('pu-ask');
        caja.append(
          h('span', { class: 'gm-modal-ico pu-ask-ico', 'aria-hidden': 'true' }, campana()),
          h('span', { class: 'pu-ask-eye', text: host ? 'GAME CREATED ✓' : 'DONE ✓' }),
          h('h2', { id: idT, text: host ? 'Want to know when players join?' : 'Want to know when the host answers?' }),
          h('p', { class: 'pj-small gm-m0', text: host
            ? "We'll send a notification to this phone when someone asks to join, accepts your invite, or the game changes. Turn it off anytime in Account."
            : "We'll send a notification to this phone when the host answers, the game changes, or there are new messages. Turn it off anytime in Account." }),
          err, si, no,
          h('p', { class: 'pu-ask-next', text: 'Next, your phone asks "Allow notifications?" — tap Allow.' }));
        return si;
      });
    } catch (e) { console.warn('[portal] ofrecer push:', e); }
  };
  function campana() {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    [['width', '26'], ['height', '26'], ['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'],
     ['stroke-linecap', 'round'], ['stroke-linejoin', 'round']].forEach(([k, v]) => s.setAttribute(k, v));
    ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'].forEach((d) => {
      const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); s.append(p);
    });
    return s;
  }
})();
