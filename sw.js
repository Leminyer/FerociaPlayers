/* ============================================================
   FEROCIA PLAYER PORTAL — el "service worker" (SQL 110, §92)
   ------------------------------------------------------------
   Un pequeño programa que el teléfono guarda junto al portal. Sólo
   hace dos cosas:
     1. Enseñar el aviso cuando llega un push (aunque el portal esté
        cerrado).
     2. Al tocar el aviso, abrir el portal en ese juego.
   NO guarda copias del portal (sin caché): cada vez que se abre, se
   carga la versión más nueva, como hasta ahora.
   ============================================================ */
'use strict';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (ev) => ev.waitUntil(self.clients.claim()));

/* Sólo direcciones del propio portal: nunca otra web.
   La pantalla llega en "url" ("/#/game/12") y, desde §103, el tipo de aviso
   aparte en "aviso" ("game_cancelled"): con él, el portal abre con el
   cartel grande arriba. Se vuelve a armar pieza por pieza: la pantalla
   sólo puede ser "#/nombre" o "#/nombre/123", y el aviso sólo letras y "_".
   (La "/" del principio se quita para que valga aunque el portal no esté
   en la raíz del sitio.) */
function destino(url, aviso) {
  const base = self.registration.scope;
  try {
    const raiz = new URL(base);
    const crudo = typeof url === 'string' && url ? url.replace(/^\/(?=[#?])/, '') : '#/home';
    const u = new URL(crudo, base);
    if (u.origin !== raiz.origin || u.pathname !== raiz.pathname) return base + '#/home';
    const pantalla = /^#\/[a-z-]{1,30}(\/\d{1,18})?$/.test(u.hash) ? u.hash : '#/home';
    const k = typeof aviso === 'string' && aviso ? aviso : u.searchParams.get('aviso');
    return base + (k && /^[a-z_]{1,30}$/.test(k) ? `?aviso=${k}` : '') + pantalla;
  } catch (e) { return base + '#/home'; }
}

/* §103: con aviso, una marca de hora hace que la dirección sea siempre
   distinta. Así el portal se vuelve a cargar con los datos de AHORA,
   aunque ya estuviera abierto en esa misma pantalla. */
function conMarca(url) {
  return url.includes('?aviso=') ? url.replace(/#/, `&t=${Date.now()}#`) : url;
}

self.addEventListener('push', (ev) => {
  let d = {};
  try { d = ev.data ? ev.data.json() : {}; } catch (e) { d = {}; }
  const titulo = typeof d.title === 'string' && d.title ? d.title.slice(0, 60) : 'FEROCIA';
  const texto = typeof d.body === 'string' ? d.body.slice(0, 200) : 'You have an update about a game.';
  const tag = typeof d.tag === 'string' ? d.tag.slice(0, 60) : 'ferocia';
  ev.waitUntil(self.registration.showNotification(titulo, {
    body: texto,
    tag,
    renotify: tag.startsWith('chat-'),
    icon: 'assets/icono-192.png',
    badge: 'assets/insignia-96.png',
    data: { url: destino(d.url, d.aviso) },
  }));
});

self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  const url = conMarca(destino(ev.notification.data && ev.notification.data.url));
  ev.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abiertas) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        try { await c.navigate(url); } catch (e) { c.postMessage({ ferocia: 'abrir', url }); }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
