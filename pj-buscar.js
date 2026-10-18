/* ============================================================
   FEROCIA PLAYER PORTAL — buscar jugadores por nombre (o código)
   SQL 108 (17 de octubre) — decisión §91. Diseño aprobado
   ("FEROCIA Play — varios juegos y buscar amigos").

   Una sola pieza para tres sitios:
     · Create a game → "Invite friends (optional)"
     · la página del juego (anfitrión) → "Invite players"
     · Log a game / el resultado → "Add a player" (nombre o código)

   P.buscadorJugadores({ para, juego, etiqueta, accion }) devuelve
   { el, enfocar, repintar }.
     para:   'invite' (sólo quien usa Play) o 'log' (registrar un juego).
     juego:  id del juego (para que la base diga si ya está, lleno…).
     accion: (persona, fila) => elemento del final de la fila.
   La búsqueda la hace la base (portal_buscar_jugadores): mínimo 3
   letras, hasta 10, sin Private (salvo su código exacto en 'log'),
   sin bloqueados ni suspendidos, 30 por hora.
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const { sb, h } = P;

  const ERRORES = {
    too_short: 'Type at least 3 letters.',
    too_many_searches: "You've searched a lot in the last hour. Please try again later.",
    not_available: "This game isn't available.",
    hidden_caller: "Your privacy is Private, so you can't search players. Switch to Limited in My Identity.",
  };
  const iniciales = (nombre) => String(nombre || '?').replace(/\./g, '').split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase()).join('') || '?';
  const letras = (t) => String(t || '').replace(/[^\p{L}\p{N}]/gu, '').length;
  let unico = 0;

  P.buscadorJugadores = function ({ para = 'invite', juego = null, etiqueta = 'Name', accion } = {}) {
    const id = `bj-${++unico}`;
    const campo = h('input', { class: 'gm-input bj-in', id, type: 'search', maxlength: '60', autocomplete: 'off', spellcheck: 'false',
      enterkeyhint: 'search', 'aria-describedby': `${id}-s`,
      placeholder: para === 'log' ? 'Name or player code' : 'First or last name' });
    const estado = h('p', { class: 'gm-small gm-m0 bj-s', id: `${id}-s`, role: 'status', 'aria-live': 'polite',
      text: para === 'log' ? 'Type at least 3 letters, or their 6-character code.' : 'Type at least 3 letters.' });
    const lista = h('ul', { class: 'bj-list', hidden: true, 'aria-label': 'Players found' });
    const el = h('div', { class: 'bj' }, h('label', { class: 'bj-l', for: id, text: etiqueta }), campo, estado, lista);

    let vez = 0;
    let reloj = null;
    let ultima = '';
    let personas = [];

    function pintar() {
      lista.replaceChildren(...personas.map((p) => {
        const fila = h('li', { class: 'bj-row' },
          h('span', { class: 'pl-av pl-av-sm', 'aria-hidden': 'true', text: iniciales(p.name) }),
          h('span', { class: 'bj-who' }, h('b', { text: p.name }), h('span', { text: [p.level, p.city].filter(Boolean).join(' · ') })),
          p.code ? h('span', { class: 'bj-code', text: p.code }) : null);
        const fin = accion ? accion(p, fila) : null;
        if (fin) fila.append(fin);
        return fila;
      }));
      lista.hidden = !personas.length;
    }

    async function buscar(forzar) {
      const q = campo.value.trim().replace(/\s+/g, ' ');
      if (!forzar && q === ultima) return;
      const mia = ++vez;
      if (letras(q) < 3) {
        ultima = '';
        personas = []; pintar();
        estado.textContent = q ? 'Type at least 3 letters.' : (para === 'log' ? 'Type at least 3 letters, or their 6-character code.' : 'Type at least 3 letters.');
        return;
      }
      ultima = q;
      estado.textContent = 'Searching…';
      try {
        const { data, error } = await sb.rpc('portal_buscar_jugadores', { p_q: q, p_game: juego, p_para: para });
        if (error) throw error;
        if (mia !== vez) return;
        personas = (data && data.results) || [];
        pintar();
        estado.textContent = !personas.length
          ? (para === 'log' ? 'No players found. Players who keep their profile Private only show up with their player code.'
            : "No players found. Players who keep their profile Private don't appear in search.")
          : personas.length === 1 ? '1 player'
            : `${personas.length} players · Not sure which one? Ask your friend for their player code.`;
      } catch (e) {
        if (mia !== vez) return;
        /* Sin el SQL 108 (la búsqueda no existe todavía): con un código, como antes. */
        if (para === 'log' && /portal_buscar_jugadores|schema cache|function/i.test((e && e.message) || '')) { porCodigo(q, mia); return; }
        console.warn('[portal] buscar jugadores:', e);
        ultima = '';
        personas = []; pintar();
        estado.textContent = P.errorTexto(e, ERRORES);
      }
    }

    /* Se espera a que deje de escribir (casi 1 segundo): cada búsqueda cuenta para el tope de 30 por hora. */
    async function porCodigo(q, mia) {
      const c = q.replace(/[\s-]/g, '').toUpperCase();
      personas = []; pintar();
      if (!/^[2-9A-HJKMNP-Z]{6}$/.test(c)) { ultima = ''; estado.textContent = 'Type their 6-character player code.'; return; }
      try {
        const { data, error } = await sb.rpc('portal_codigo_buscar', { p_code: c });
        if (error) throw error;
        if (mia !== vez) return;
        personas = data && data.ok ? [Object.assign({ code: c }, data.player)] : [];
        pintar();
        estado.textContent = personas.length ? '1 player' : "We couldn't find a player with that code.";
      } catch (e) { if (mia === vez) { ultima = ''; estado.textContent = P.errorTexto(e, ERRORES); } }
    }

    campo.addEventListener('input', () => { clearTimeout(reloj); reloj = setTimeout(() => buscar(false), 900); });
    campo.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      clearTimeout(reloj);
      buscar(false);
    });

    return {
      el,
      enfocar: () => campo.focus(),
      repintar: pintar,
      limpiar: () => { campo.value = ''; ultima = ''; personas = []; pintar(); },
    };
  };
})();
