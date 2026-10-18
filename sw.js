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

/* Sólo direcciones del propio portal ("/#/game/12", o ya completa dentro
   del portal): nunca otra web. */
function destino(url) {
  const base = self.registration.scope;
  try {
    if (typeof url === 'string' && url.startsWith(base + '#/')) return url;
    const u = new URL(typeof url === 'string' && url.startsWith('/#/') ? url.slice(1) : '#/home', base);
    return u.href.startsWith(base) ? u.href : base + '#/home';
  } catch (e) { return base + '#/home'; }
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
    data: { url: destino(d.url) },
  }));
});

self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  const url = destino(ev.notification.data && ev.notification.data.url);
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
