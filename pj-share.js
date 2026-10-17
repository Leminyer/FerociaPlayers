/* ============================================================
   FEROCIA PLAYER PORTAL — "Share my month" (SQL 105, §85)

   Hace una imagen (1080 × 1350, la de una publicación en redes) con
   los números del mes del jugador. Se dibuja aquí, en su aparato: no
   se sube a ningún sitio. Si el teléfono sabe compartir archivos, abre
   su menú de compartir; si no (computadora), la descarga.
   Sólo sus datos: su nombre de pila y sus números.
   ============================================================ */

(function () {
  'use strict';

  const P = window.FerociaPortal;
  if (!P) return;

  const W = 1080, H = 1350;
  const C = { noche: '#080f2e', azul: '#174CCC', lima: '#C6F221', blanco: '#ffffff', suave: '#B8C2DC' };

  function cargarLogo() {
    return new Promise((ok) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => ok(null);   // sin logo, la imagen sale igual
      img.src = 'assets/ferocia-logo.png';
    });
  }
  /* Parte un texto en líneas que caben en el ancho. */
  function lineas(ctx, texto, ancho, max) {
    const palabras = String(texto || '').split(/\s+/);
    const out = [];
    let linea = '';
    palabras.forEach((p) => {
      const prueba = linea ? `${linea} ${p}` : p;
      if (ctx.measureText(prueba).width > ancho && linea) { out.push(linea); linea = p; } else linea = prueba;
    });
    if (linea) out.push(linea);
    if (out.length > max) { out.length = max; out[max - 1] = `${out[max - 1].replace(/\s+\S*$/, '')}…`; }
    return out;
  }

  async function dibujar(d) {
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) { /* nada */ } }
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const F = (peso, tam) => `${peso} ${tam}px Inter, Arial, sans-serif`;
    ctx.fillStyle = C.noche; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.lima; ctx.fillRect(0, 0, W, 14);
    // Un círculo grande de fondo, azul.
    ctx.fillStyle = C.azul; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(W - 120, 300, 360, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    const logo = await cargarLogo();
    if (logo) { const w = 300, hh = Math.round((logo.height / logo.width) * w); ctx.drawImage(logo, 90, 90, w, hh); }

    ctx.fillStyle = C.lima; ctx.font = F(800, 40);
    ctx.fillText(`MY ${String(d.mes).toUpperCase()} ${d.anio}`, 90, 300);
    ctx.fillStyle = C.blanco; ctx.font = F(900, 84);
    lineas(ctx, d.nombre ? `${d.nombre}'s month on court` : 'My month on court', W - 180, 2).forEach((t, i) => ctx.fillText(t, 90, 400 + i * 96));

    // El número grande.
    ctx.fillStyle = C.lima; ctx.font = F(900, 260);
    ctx.fillText(d.pct == null ? '—' : `${d.pct}%`, 80, 820);
    ctx.fillStyle = C.blanco; ctx.font = F(700, 44);
    ctx.fillText('win rate', 96, 890);

    // Tres datos.
    const datos = [[String(d.juegos), d.juegos === 1 ? 'game' : 'games'], [String(d.ganados), d.ganados === 1 ? 'win' : 'wins']];
    if (d.escalera) datos.push([`#${d.escalera.puesto}`, `of ${d.escalera.de} · ladder`]);
    else if (d.racha && d.racha.tipo === 'w' && d.racha.actual >= 2) datos.push([String(d.racha.actual), 'wins in a row']);
    const ancho = (W - 180) / datos.length;
    datos.forEach(([n, t], i) => {
      const x = 90 + i * ancho;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, 960, ancho - 24, 190, 28) : ctx.rect(x, 960, ancho - 24, 190); ctx.fill();
      ctx.fillStyle = C.blanco; ctx.font = F(900, 88); ctx.fillText(n, x + 30, 1068);
      ctx.fillStyle = C.suave; ctx.font = F(600, 30); ctx.fillText(t, x + 32, 1118);
    });

    ctx.fillStyle = C.suave; ctx.font = F(600, 30);
    ctx.fillText('FEROCIA Sports Center · Boca Raton', 90, 1260);
    return new Promise((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error('no_image'))), 'image/png'));
  }

  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    P.aviso('Your image is ready — check your downloads.');
    return 'downloaded';
  }

  /* La imagen se prepara antes (cuando el Home ya tiene los números):
     así, al pulsar "Share my month", el teléfono comparte al momento
     (Safari no deja compartir si se espera demasiado tras el toque). */
  P.imagenMes = (d) => dibujar(d);
  P.compartirImagen = async function (blob, d) {
    const nombre = `ferocia-${String(d.mes).toLowerCase()}-${d.anio}.png`;
    const archivo = typeof File === 'function' ? new File([blob], nombre, { type: 'image/png' }) : null;
    if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: `My ${d.mes} at FEROCIA` });
        return 'shared';
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;   // la persona cerró el menú: nada más
        return descargar(blob, nombre);               // el aparato no dejó: se descarga
      }
    }
    return descargar(blob, nombre);
  };
})();
