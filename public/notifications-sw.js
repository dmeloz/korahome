// KoraHome : ce que fait le service worker quand le serveur envoie un rappel.
// Chargé par le service worker de l'app (vite.config.ts, workbox.importScripts).

self.addEventListener("push", (event) => {
  let message = { titre: "KoraHome", corps: "", nombre: 0, url: "/" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    if (event.data) message.corps = event.data.text();
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(message.titre, {
        body: message.corps,
        icon: "/icone-192.png",
        badge: "/icone-192.png",
        // Un nouveau rappel remplace celui de la veille au lieu de s'empiler.
        tag: "rappel-du-matin",
        data: { url: message.url },
      }),
      // La pastille sur l'icône de l'app (iOS 16.4+, app sur l'écran d'accueil).
      message.nombre > 0 && self.navigator.setAppBadge ? self.navigator.setAppBadge(message.nombre).catch(() => {}) : null,
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => "focus" in f);
      return ouverte ? ouverte.focus() : self.clients.openWindow(url);
    }),
  );
});
