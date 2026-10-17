/* ============================================================
   FEROCIA PLAYER PORTAL — Las gráficas del Home (SQL 105, §85)

   Gráficas hechas aquí mismo, en SVG, sin librerías de fuera:
   barras (win rate por periodo), línea (el camino en la escalera),
   anillo (el próximo hito). Los textos se ponen como TEXTO (nunca
   HTML). Cada gráfica lleva su frase para lectores de pantalla.
   Se animan al aparecer, salvo si el aparato pide menos movimiento
   (eso lo decide pj-home.css).
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;
  const NS = 'http://www.w3.org/2000/svg';

  /* Un elemento SVG con sus atributos; el texto, como texto. */
  function s(tag, attrs, texto) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      el.setAttribute(k, String(v));
    }
    if (texto != null) el.textContent = String(texto);
    return el;
  }
  function lienzo(ancho, alto, etiqueta, clase) {
    return s('svg', { viewBox: `0 0 ${ancho} ${alto}`, role: 'img', 'aria-label': etiqueta, class: clase, preserveAspectRatio: 'xMidYMid meet' });
  }

  /* ── Barras: [{label, value (0–100 o null), title, now}] ── */
  function barras(datos, etiqueta) {
    const W = 520, H = 220, base = 176, alto = 140, izq = 40, der = 8;
    const svg = lienzo(W, H, etiqueta, 'hc-svg hc-bars');
    svg.append(s('line', { x1: izq, y1: base, x2: W - der, y2: base, class: 'hc-axis' }));
    const y50 = base - alto * 0.5;
    svg.append(s('line', { x1: izq, y1: y50, x2: W - der, y2: y50, class: 'hc-grid' }));
    svg.append(s('text', { x: 0, y: y50 + 4, class: 'hc-tick' }, '50%'));
    const n = Math.max(datos.length, 1);
    const paso = (W - izq - der) / n;
    const ancho = Math.min(52, paso * 0.62);
    datos.forEach((d, i) => {
      const cx = izq + paso * i + paso / 2;
      const g = s('g', { class: `hc-bar${d.now ? ' is-now' : ''}` });
      if (d.title) g.append(s('title', null, d.title));
      if (d.value != null) {
        const hh = Math.max(4, (alto * d.value) / 100);
        const barra = s('rect', { x: cx - ancho / 2, y: base - hh, width: ancho, height: hh, rx: 8, class: 'hc-bar-r' });
        barra.style.setProperty('--hc-i', String(i));   // para que crezcan una tras otra
        g.append(barra);
        g.append(s('text', { x: cx, y: base - hh - 8, 'text-anchor': 'middle', class: 'hc-val' }, `${d.value}%`));
      } else {
        g.append(s('text', { x: cx, y: base - 8, 'text-anchor': 'middle', class: 'hc-none' }, '—'));
      }
      g.append(s('text', { x: cx, y: H - 16, 'text-anchor': 'middle', class: 'hc-lbl' }, d.label));
      svg.append(g);
    });
    return svg;
  }

  /* ── Línea del puesto: [{rank, of, played, label}] (1 arriba) ── */
  function camino(puntos, etiqueta) {
    const W = 520, H = 220, arriba = 34, abajo = 168, izq = 40, der = 26;
    const svg = lienzo(W, H, etiqueta, 'hc-svg hc-line');
    const peor = Math.max(...puntos.map((p) => p.of || p.rank), 2);
    const y = (r) => arriba + ((r - 1) / (peor - 1)) * (abajo - arriba);
    const n = puntos.length;
    const x = (i) => (n === 1 ? (izq + W - der) / 2 : izq + (i * (W - izq - der)) / (n - 1));
    const mejor = Math.min(...puntos.map((p) => p.rank));
    const ultimo = puntos[n - 1];
    [['#1', 1], [`#${peor}`, peor]].forEach(([t, r]) => {
      svg.append(s('line', { x1: izq, y1: y(r), x2: W - der, y2: y(r), class: 'hc-grid' }));
      svg.append(s('text', { x: 0, y: y(r) + 4, class: 'hc-tick' }, t));
    });
    if (n > 1) {
      const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.rank).toFixed(1)}`).join(' ');
      svg.append(s('path', { d, class: 'hc-path', pathLength: 1 }));
    }
    puntos.forEach((p, i) => {
      const fin = i === n - 1;
      const g = s('g', { class: 'hc-pt' });
      g.append(s('title', null, `${p.label}: #${p.rank} of ${p.of}${p.played ? '' : ' (you didn’t play)'}`));
      g.append(s('circle', { cx: x(i), cy: y(p.rank), r: fin ? 10 : 5, class: fin ? 'hc-dot-end' : (p.played ? 'hc-dot' : 'hc-dot-off') }));
      svg.append(g);
    });
    svg.append(s('text', { x: Math.min(x(n - 1), W - der - 8), y: Math.max(y(ultimo.rank) - 18, 14), 'text-anchor': 'end', class: 'hc-end' }, `#${ultimo.rank}`));
    if (mejor < ultimo.rank && n > 2) {
      const i = puntos.findIndex((p) => p.rank === mejor);
      svg.append(s('text', { x: x(i), y: y(mejor) - 12, 'text-anchor': 'middle', class: 'hc-tick' }, `best #${mejor}`));
    }
    svg.append(s('text', { x: x(0), y: H - 14, 'text-anchor': n === 1 ? 'middle' : 'start', class: 'hc-lbl' }, puntos[0].label));
    if (n > 1) svg.append(s('text', { x: x(n - 1), y: H - 14, 'text-anchor': 'end', class: 'hc-lbl hc-lbl-strong' }, ultimo.label));
    return svg;
  }

  /* ── El anillo del próximo hito ── */
  function anillo(hecho, meta, etiqueta) {
    const svg = lienzo(104, 104, etiqueta, 'hc-ring');
    const r = 44, c = 2 * Math.PI * r;
    const frac = Math.max(0, Math.min(1, meta ? hecho / meta : 0));
    svg.append(s('circle', { cx: 52, cy: 52, r, class: 'hc-ring-bg' }));
    const fg = s('circle', { cx: 52, cy: 52, r, class: 'hc-ring-fg', 'stroke-dasharray': `${(c * frac).toFixed(1)} ${c.toFixed(1)}`,
      transform: 'rotate(-90 52 52)' });
    fg.style.setProperty('--hc-c', c.toFixed(1));
    svg.append(fg);
    svg.append(s('text', { x: 52, y: 59, 'text-anchor': 'middle', class: 'hc-ring-t' }, String(hecho)));
    return svg;
  }

  /* ── Las barras de las parejas (HTML sencillo) ── */
  function filaBarra(nombre, dato, pct, fuerte) {
    const fill = P.h('span', { class: `hc-meter-f${fuerte ? ' is-strong' : ''}` });
    fill.style.width = `${Math.max(4, Math.min(100, pct))}%`;
    return P.h('div', { class: 'hc-meter' },
      P.h('span', { class: 'hc-meter-t' }, P.h('span', { class: 'hc-meter-n', text: nombre }), P.h('span', { class: 'hc-meter-d', text: dato })),
      P.h('span', { class: 'hc-meter-b', 'aria-hidden': 'true' }, fill));
  }

  P.graficas = Object.freeze({ barras, camino, anillo, filaBarra });
})();
