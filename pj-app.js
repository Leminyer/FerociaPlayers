/* ============================================================
   FEROCIA PLAYER PORTAL — el arranque, las rutas y lo común
   Hito 2 (14 de octubre) — decisiones §42–§45
   Hitos 3 y 4 (14 de octubre) — decisiones §46–§49
   FEROCIA Identity I-1 (15 de octubre): ciudad y estado (§57)
   Player DNA, etapa DNA-1 (15 de octubre): My DNA y su paso (§62, §63)
   Matchmaking M-1 (15 de octubre): Play y la tarjeta del jugador (§70, §71)
   Matchmaking M-2a (15 de octubre): los juegos, la campanita y Player Safety (§74)

   · Crea la conexión con Supabase (la misma base que el panel; la
     clave es la PÚBLICA, como en el sitio: lo que protege los datos
     son las reglas y las funciones de la base, no esta clave).
   · Enseña UNA pantalla según la dirección (#/home, #/profile…).
   · Con sesión, pregunta a la base EN QUÉ PUNTO está la persona
     (portal_estado) y sólo deja ver las pantallas de ese punto:
       sin_ficha            → "A little about you" (y Help)
       en_revision/rechazado → la pantalla de espera (y Help)
       vinculado            → Home, My Identity, My DNA, Edit, Settings, Help
       vinculado sin su DNA  → "Your Player DNA" (y Help): se pide una
                               vez, antes del Home (§62)
     Así nadie se queda en una pantalla sin salida.
   · La sesión se guarda en ESTE dominio: no se comparte con el panel.

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

  /* ── Lo que el enlace de un correo deja en la dirección ──
     · Un enlace que ya no vale: #error=…&error_code=otp_expired…
     · Cambio de correo con dos confirmaciones: el primer enlace vuelve
       con #message=… ("falta confirmar el otro"). Se leen ANTES de que
       supabase-js o las rutas los borren. */
  function leerDireccion() {
    const h = location.hash || '';
    const p = new URLSearchParams(h.replace(/^#\/?/, ''));
    const error = /(^#|&)error(_code)?=/.test(h) ? (p.get('error_code') || p.get('error') || 'error') : null;
    const mensaje = /(^#|&)message=/.test(h) ? 'mensaje' : null;
    return { error, mensaje };
  }
  const DIRECCION = leerDireccion();

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
  const POR_ESTADO = {
    sin_ficha:   { inicio: 'about',  rutas: ['about', 'help'] },
    en_revision: { inicio: 'review', rutas: ['review', 'help'] },
    rechazado:   { inicio: 'review', rutas: ['review', 'help'] },
    vinculado:   { inicio: 'home',   rutas: ['home', 'profile', 'dna', 'dna-edit', 'play', 'player', 'game', 'game-form', 'edit', 'settings', 'help', 'welcome'] },
  };
  /* Unido pero sin su Player DNA: primero el DNA. (Sólo si la base lo
     dice claramente: si el SQL 92 todavía no está, no se pide.) */
  const SIN_DNA = { inicio: 'dna-start', rutas: ['dna-start', 'help'] };

  let sesion = null;
  let estado = null;          // lo que contestó portal_estado
  let estadoFallo = false;    // no se pudo leer (sin internet…)
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

  /* ── Pequeñas herramientas comunes ── */

  /* Crea un elemento con su texto como TEXTO (nunca HTML): así ningún
     nombre o mensaje puede colar código en la página. */
  function h(tag, props, ...hijos) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const c of hijos.flat()) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const MESES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  /* Las fechas de la base llegan como "2026-10-07": se leen tal cual,
     sin pasar por zonas horarias (que las moverían un día). */
  function partes(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  const fmt = {
    largo(iso) { const p = partes(iso); return p ? `${MESES[p.m - 1]} ${p.d}, ${p.y}` : ''; },
    corto(iso) { const p = partes(iso); return p ? `${MESES[p.m - 1].slice(0, 3)} ${p.d}` : ''; },
    mesAnio(iso) { const p = partes(iso); return p ? `${MESES[p.m - 1]} ${p.y}` : ''; },
    mes3(iso) { const p = partes(iso); return p ? MESES[p.m - 1].slice(0, 3).toUpperCase() : ''; },
    dia(iso) { const p = partes(iso); return p ? String(p.d) : ''; },
    mmddyyyy(iso) { const p = partes(iso); return p ? `${String(p.m).padStart(2, '0')}/${String(p.d).padStart(2, '0')}/${p.y}` : ''; },
    telefono(t) {
      const d = String(t || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
      return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(t || '');
    },
    hora(hhmm) {
      const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
      if (!m) return '';
      const hh = +m[1];
      return `${((hh + 11) % 12) + 1}:${m[2]} ${hh < 12 ? 'AM' : 'PM'}`;
    },
    /* Un nombre como se debe ver: "ivy STONE" → "Ivy Stone", "o'neil" →
       "O'Neil", "j. chen" → "J. Chen". Si una palabra ya mezcla mayúsculas
       y minúsculas ("McDonald", "DeLuca") se respeta; sólo se pone en
       mayúscula su primera letra. (Cambio del 15 de octubre.) */
    nombre(texto) {
      return String(texto || '').trim().replace(/\s+/g, ' ').split(' ').map((palabra) =>
        palabra.split(/([-'\u2019])/).map((t) => {
          if (!t || /^[-'\u2019]$/.test(t)) return t;
          const min = t.toLowerCase();
          const base = (t === min || t === t.toUpperCase()) ? min : t;
          return base.charAt(0).toUpperCase() + base.slice(1);
        }).join('')).join(' ');
    },
    iniciales(nombre, apellido, email) {
      const ini = ((nombre || '').trim().charAt(0) + (apellido || '').trim().charAt(0)) || (email || '?').charAt(0);
      return ini.toUpperCase();
    },
  };

  /* El teléfono mientras se escribe: (561) 555-1234. */
  function mascaraTelefono(input) {
    input.addEventListener('input', () => {
      const d = input.value.replace(/\D/g, '').replace(/^1(?=\d{10})/, '').slice(0, 10);
      let v = d;
      if (d.length > 6) v = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
      else if (d.length > 3) v = `(${d.slice(0, 3)}) ${d.slice(3)}`;
      else if (d.length) v = `(${d}`;
      input.value = v;
    });
  }

  /* Ciudad (con la lista de ciudades cercanas) y estado (Florida
     primero): los mismos campos que el formulario de suscripción
     (location-fields.js, que se carga después). Lo usan "A little about
     you" y Edit profile. FEROCIA Identity, etapa I-1. */
  const lugarL = () => window.FerociaLocation;
  function camposLugar(idCiudad, idEstado) {
    const L = lugarL();
    if (!L) return;
    L.mountCitySuggest(idCiudad);
    /* stateOptions sólo trae la lista fija de estados (ningún dato de
       nadie): por eso se puede poner como HTML. */
    document.getElementById(idEstado).innerHTML = L.stateOptions('');
  }
  /* Lee y limpia ciudad y estado ("boca ratón" → "Boca Raton"). */
  function leerLugar(idCiudad, idEstado) {
    const L = lugarL();
    const ci = document.getElementById(idCiudad), es = document.getElementById(idEstado);
    /* El apóstrofo curvo del iPhone (’) cuenta como el recto (Coeur d'Alene),
       y nada de puntos, guiones o apóstrofos delante (".boca" → "Boca"). */
    const crudo = ci.value.replace(/[\u2018\u2019\u02BC]/g, "'").replace(/^[\s.'-]+/, '');
    const c = L ? L.validateCity(crudo, { required: true }) : { ok: !!crudo.trim(), value: crudo.trim() };
    const e = L ? L.validateState(es.value, { required: true }) : { ok: !!es.value, value: es.value };
    if (c.ok) ci.value = c.value;
    return { ciudad: c.ok ? c.value : '', estado: e.ok ? e.value : '', malCiudad: !c.ok, malEstado: !e.ok };
  }
  const errorLugar = {
    invalid_city: 'Check your city — letters only, like "Boca Raton".',
    invalid_state: 'Choose your state.',
  };

  /* Los errores de la base, en palabras. */
  function errorTexto(err, propios) {
    const m = String((err && (err.message || err.msg)) || err || '');
    if (propios) for (const [clave, texto] of Object.entries(propios)) if (m.includes(clave)) return texto;
    if (err instanceof TypeError || /fetch|network|failed to|load failed/i.test(m)) {
      return "We couldn't connect. Check your internet connection and try again.";
    }
    if (/not_authenticated|JWT|jwt/.test(m)) return 'Your session ended. Please sign in again.';
    return 'Something went wrong. Please try again in a moment.';
  }

  /* ── Lo que la base sabe de la persona ── */
  async function cargarEstado() {
    const { data, error } = await sb.rpc('portal_estado');
    if (error) throw error;
    estado = data || null;
    estadoFallo = false;
    pintarCabecera();
    return estado;
  }

  /* Los datos de Home / My Identity / Edit: una sola lectura, guardada
     un minuto (cambiar de pantalla no vuelve a pedirlos). */
  let datosPromesa = null;
  let datosHora = 0;
  function datos(forzar) {
    if (forzar || !datosPromesa || Date.now() - datosHora > 60000) {
      datosHora = Date.now();
      datosPromesa = sb.rpc('portal_mis_datos').then(({ data, error }) => {
        if (error) { datosPromesa = null; throw error; }
        return data;
      });
    }
    return datosPromesa;
  }
  function olvidarDatos() { datosPromesa = null; }

  /* ── Rutas ── */
  const rutaActual = () => {
    const m = /^#\/([a-z-]+)/.exec(location.hash || '');
    return m ? m[1] : '';
  };
  /* Lo que va después del nombre de la pantalla: #/player/123 → "123". */
  /* (Tal cual: cada pantalla comprueba si le sirve.) */
  const rutaParam = () => {
    const m = /^#\/[a-z-]+\/(.+)$/.exec(location.hash || '');
    return m ? m[1] : '';
  };

  function ir(nombre) {
    if (rutaActual() === nombre) pintar();
    else location.hash = '#/' + nombre;
  }

  function permitidas() {
    if (!sesion) return { inicio: 'sign-in', rutas: PUBLICAS };
    if (estadoFallo) return { inicio: 'oops', rutas: ['oops'] };
    if (!estado) return { inicio: 'loading', rutas: ['loading'] };
    if (estado.estado === 'vinculado' && estado.dna_completo === false) return SIN_DNA;
    return POR_ESTADO[estado.estado] || { inicio: 'oops', rutas: ['oops'] };
  }

  function pintarCabecera() {
    const e = estado || {};
    const ini = document.getElementById('pj-me-ini');
    const nom = document.getElementById('pj-me-name');
    if (ini) ini.textContent = fmt.iniciales(e.first_name, e.last_name, e.email);
    if (nom) nom.textContent = fmt.nombre([e.first_name, e.last_name].filter(Boolean).join(' ')) || e.email || '';
  }

  function pintarMarco(nueva, nombre) {
    const conApp = !!(nueva && nueva.dataset.chrome === 'app');
    const unido = !!(estado && estado.estado === 'vinculado');
    const appbar = document.getElementById('pj-appbar');
    const simple = document.getElementById('pj-simplebar');
    const tabbar = document.getElementById('pj-tabbar');
    const pie = document.getElementById('pj-footer');
    if (appbar) appbar.hidden = !(conApp && unido);
    if (tabbar) tabbar.hidden = !(conApp && unido);
    if (simple) simple.hidden = !(conApp && !unido);
    if (pie) pie.hidden = !conApp;
    document.body.classList.toggle('pj-con-barra', conApp && unido);
    document.body.dataset.pantalla = nombre;
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const activo = a.dataset.nav === nombre || (nombre === 'edit' && a.dataset.nav === 'profile')
        || (nombre === 'dna-edit' && a.dataset.nav === 'dna')
        || (['player', 'game', 'game-form'].includes(nombre) && a.dataset.nav === 'play');
      if (activo) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const atras = document.getElementById('pj-simple-back');
    if (atras) atras.setAttribute('href', '#/' + permitidas().inicio);
  }

  let pintadaAntes = false;
  let pantallaAnterior = '';
  let direccionAnterior = '';
  function pintar() {
    if (!listo) return;
    const { inicio, rutas } = permitidas();
    let nombre = rutaActual();
    if (!rutas.includes(nombre)) nombre = inicio;
    if (PUBLICAS.includes(nombre) || sesion) {
      const conParam = nombre === rutaActual() && rutaParam() ? `#/${nombre}/${rutaParam()}` : '#/' + nombre;
      if (conParam !== location.hash && nombre !== 'loading' && nombre !== 'oops') {
        history.replaceState(null, '', conParam);
      }
    }
    let nueva = null;
    document.querySelectorAll('.pj-screen').forEach((s) => {
      const es = s.dataset.screen === nombre;
      s.classList.toggle('is-active', es);
      if (es) nueva = s;
    });
    pintarMarco(nueva, nombre);
    if (pantallaAnterior !== nombre || direccionAnterior !== location.hash) window.scrollTo(0, 0);
    direccionAnterior = location.hash;
    /* Una pantalla puede tener más de un archivo que la pinta (Play: la
       lista de jugadores y, desde M-2a, los juegos). */
    (entradas[nombre] || []).forEach((fn) => {
      try {
        const r = fn();
        if (r && typeof r.catch === 'function') r.catch((e) => console.error('[portal]', nombre, e));
      } catch (e) { console.error('[portal]', nombre, e); }
    });
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

  /* Vuelve a preguntar a la base en qué punto está y repinta. */
  async function refrescar() {
    if (!sesion) { estado = null; pintar(); return; }
    try {
      await cargarEstado();
    } catch (e) {
      console.warn('[portal] No se pudo leer el estado:', e);
      estado = null;
      estadoFallo = true;
    }
    pintar();
  }

  async function arrancar() {
    try {
      const { data } = await sb.auth.getSession();
      sesion = data ? data.session : null;
    } catch (e) {
      console.warn('[portal] No se pudo leer la sesión:', e);
      sesion = null;
    }
    listo = true;
    if (DIRECCION.error && !sesion) {
      history.replaceState(null, '', '#/sign-in');
      pintar();
      aviso('That sign-in link has expired or was already used. Enter your email to get a new one.', true);
      return;
    }
    if (sesion) { pintar(); await refrescar(); }
    else pintar();
    if (DIRECCION.mensaje && sesion) {
      aviso('Almost done: we also sent a link to your other email address. Open it to finish the change.');
    }
  }

  /* supabase-js avisa "SIGNED_IN" también cada vez que la pestaña vuelve
     a estar a la vista. Sólo se repinta si de verdad cambió quién está
     dentro (si no, la página saltaría arriba sin motivo). */
  sb.auth.onAuthStateChange((evento, nueva) => {
    const antes = sesion && sesion.user ? sesion.user.id : null;
    sesion = nueva || null;
    const ahora = sesion && sesion.user ? sesion.user.id : null;
    if (!listo) return;
    if (evento === 'SIGNED_OUT') {
      estado = null; estadoFallo = false; olvidarDatos(); pintar();
    } else if (evento === 'SIGNED_IN' && antes !== ahora) {
      estado = null; estadoFallo = false; olvidarDatos(); pintar(); refrescar();
    } else if (evento === 'USER_UPDATED') {
      /* Cambió el correo: la base lo copia a su ficha al preguntar. */
      olvidarDatos();
      setTimeout(() => { refrescar(); }, 0);
    }
  });

  window.addEventListener('hashchange', pintar);

  /* Salir aunque el servidor no conteste: se borra la sesión guardada en
     ESTE navegador y se recarga la página, ya sin sesión. */
  function olvidarSesionAqui() {
    try { localStorage.removeItem(CLAVE_SESION); } catch (_) { /* nada */ }
    history.replaceState(null, '', location.pathname + '#/sign-in');
    location.reload();
  }

  const reintentar = document.getElementById('op-retry');
  if (reintentar) reintentar.addEventListener('click', () => { estadoFallo = false; pintar(); refrescar(); });

  window.FerociaPortal = {
    sb,
    ir,
    aviso,
    h,
    fmt,
    mascaraTelefono,
    camposLugar,
    leerLugar,
    errorLugar,
    errorTexto,
    sesion: () => sesion,
    estado: () => estado,
    refrescar,
    datos,
    olvidarDatos,
    alEntrar: (nombre, fn) => { (entradas[nombre] = entradas[nombre] || []).push(fn); },

    rutaParam,
    olvidarSesionAqui,
    /* Adónde vuelve el enlace del correo: esta misma página. */
    vuelta: () => location.origin + location.pathname,
  };

  /* Los demás archivos se cargan después y registran sus pantallas;
     se arranca cuando el documento está listo. */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else setTimeout(arrancar, 0);
})();
