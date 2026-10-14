/* ============================================================
   FEROCIA PLAYER PORTAL — el arranque, las rutas y lo común
   Hito 2 (14 de octubre) — decisiones §42–§45

   · Crea la conexión con Supabase (la misma base que el panel; la
     clave es la PÚBLICA, como en el sitio: lo que protege los datos
     son las reglas de la base, no esta clave).
   · Enseña UNA pantalla según la dirección: #/sign-in, #/create,
     #/check, #/settings. Las de dentro sólo con sesión; las de fuera
     sólo sin ella.
   · La sesión se guarda en ESTE dominio (players.ferociasports.com):
     no se comparte con el panel ni con el sitio.

   Otros archivos registran lo que hacen al entrar en su pantalla con
   FerociaPortal.alEntrar('nombre', fn).
   ============================================================ */

(function () {
  'use strict';

  const CFG = window.FEROCIA_CONFIG;
  if (!CFG || !window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[portal] Falta config.js o supabase-js.');
    return;
  }

  /* ── Un enlace del correo que ya no vale vuelve con el error en la
     dirección (#error=…&error_code=otp_expired…). Se lee ANTES de que
     las rutas lo pisen, y se le explica. ── */
  function errorDelEnlace() {
    const h = location.hash || '';
    if (!/(^#|&)error(_code)?=/.test(h)) return null;
    const p = new URLSearchParams(h.slice(1));
    return p.get('error_code') || p.get('error') || 'error';
  }

  /* Se lee ya, antes de crear la conexión: supabase-js también mira la
     dirección al arrancar. */
  const ERROR_ENLACE = errorDelEnlace();

  /* Dónde guarda supabase-js la sesión en este navegador. */
  const CLAVE_SESION = 'ferocia-players-auth';

  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      /* El enlace del correo vuelve aquí con la sesión en la dirección
         (#access_token=…): supabase-js la lee y la quita. */
      detectSessionInUrl: true,
      /* "implicit" y no "pkce": con pkce el enlace sólo funciona en el
         MISMO navegador que lo pidió. Pide en el computador y abre el
         correo en el teléfono es lo normal. */
      flowType: 'implicit',
      storageKey: CLAVE_SESION,
    },
  });

  const PUBLICAS = ['sign-in', 'create', 'check'];
  const PRIVADAS = ['settings'];
  const INICIO_PRIVADO = 'settings';     // hito 3: será el Home

  let sesion = null;
  let listo = false;
  const entradas = {};

  /* ── Avisos ──
     La cajita está SIEMPRE en la página (invisible cuando está vacía):
     así los lectores de pantalla leen en voz alta cada aviso nuevo. El
     texto se pone un instante después de mostrarla, por la misma razón. */
  let relojAviso = null;
  function aviso(texto, esError) {
    const t = document.getElementById('pj-toast');
    if (!t) return;
    clearTimeout(relojAviso);
    t.textContent = '';
    t.classList.toggle('is-error', !!esError);
    t.classList.add('is-visible');
    requestAnimationFrame(() => { t.textContent = texto; });
    relojAviso = setTimeout(() => {
      t.classList.remove('is-visible');
      t.textContent = '';
    }, 6000);
  }

  /* ── Rutas ── */
  const rutaActual = () => {
    const m = /^#\/([a-z-]+)/.exec(location.hash || '');
    return m ? m[1] : '';
  };

  function ir(nombre) {
    if (rutaActual() === nombre) pintar();
    else location.hash = '#/' + nombre;
  }

  function pintar() {
    if (!listo) return;
    let nombre = rutaActual();
    if (sesion) {
      if (!PRIVADAS.includes(nombre)) nombre = INICIO_PRIVADO;
    } else if (!PUBLICAS.includes(nombre)) {
      nombre = 'sign-in';
    }
    if ('#/' + nombre !== location.hash) {
      history.replaceState(null, '', '#/' + nombre);
    }
    let nueva = null;
    document.querySelectorAll('.pj-screen').forEach((s) => {
      const es = s.dataset.screen === nombre;
      s.classList.toggle('is-active', es);
      if (es) nueva = s;
    });
    window.scrollTo(0, 0);
    const fn = entradas[nombre];
    if (fn) { try { fn(); } catch (e) { console.error('[portal]', nombre, e); } }
    /* Al cambiar de pantalla, el foco va a su título: quien navega con
       el teclado o con lector de pantalla sabe dónde está. (No en la
       primera pantalla al abrir la página.) */
    if (pintadaAntes && nueva && pantallaAnterior !== nombre) {
      const titulo = nueva.querySelector('[data-focus-title]');
      if (titulo) titulo.focus({ preventScroll: true });
    }
    pintadaAntes = true;
    pantallaAnterior = nombre;
  }
  let pintadaAntes = false;
  let pantallaAnterior = '';

  async function arrancar() {
    const errEnlace = ERROR_ENLACE;
    try {
      const { data } = await sb.auth.getSession();
      sesion = data ? data.session : null;
    } catch (e) {
      console.warn('[portal] No se pudo leer la sesión:', e);
      sesion = null;
    }
    listo = true;
    if (errEnlace && !sesion) {
      history.replaceState(null, '', '#/sign-in');
      pintar();
      aviso('That sign-in link has expired or was already used. Enter your email to get a new one.', true);
      return;
    }
    pintar();
  }

  /* supabase-js avisa "SIGNED_IN" también cada vez que la pestaña vuelve
     a estar a la vista. Sólo se repinta si de verdad cambió quién está
     dentro (si no, la página saltaría arriba sin motivo). */
  sb.auth.onAuthStateChange((evento, nueva) => {
    const antes = sesion && sesion.user ? sesion.user.id : null;
    sesion = nueva || null;
    const ahora = sesion && sesion.user ? sesion.user.id : null;
    if (!listo) return;
    if (evento === 'SIGNED_OUT' || (evento === 'SIGNED_IN' && antes !== ahora)) pintar();
  });

  /* Salir aunque el servidor no conteste: se borra la sesión guardada en
     ESTE navegador y se recarga la página, ya sin sesión. */
  function olvidarSesionAqui() {
    try { localStorage.removeItem(CLAVE_SESION); } catch (_) { /* nada */ }
    history.replaceState(null, '', location.pathname + '#/sign-in');
    location.reload();
  }

  window.addEventListener('hashchange', pintar);

  window.FerociaPortal = {
    sb,
    ir,
    aviso,
    sesion: () => sesion,
    alEntrar: (nombre, fn) => { entradas[nombre] = fn; },
    olvidarSesionAqui,
    /* Adónde vuelve el enlace del correo: esta misma página. */
    vuelta: () => location.origin + location.pathname,
  };

  /* Los demás archivos se cargan después y registran sus pantallas;
     se arranca cuando el documento está listo. */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else setTimeout(arrancar, 0);
})();
