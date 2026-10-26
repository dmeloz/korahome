// KoraHome : ce que fait le service worker quand le serveur envoie un rappel.
// Le message porte aussi sa forme déclarative (web_push 8030, messagePush dans src/domaine/rappels.ts) :
// depuis iOS 18.4 l'iPhone l'affiche seul si ce fichier ne répond pas à temps ; sinon la notification
// montrée ici la remplace.
// Chargé par le service worker de l'app (vite.config.ts, workbox.importScripts).

self.addEventListener("push", (event) => {
  let message = { titre: "KoraHome", corps: "", nombre: 0, url: "./" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    if (event.data) message.corps = event.data.text();
  }
  event.waitUntil(
    Promise.all([
      noterRappel(message).catch(() => {}),
      self.registration.showNotification(message.titre, {
        body: message.corps,
        // Chemins relatifs au service worker : l'app peut vivre sous /korahome/ (GitHub Pages).
        icon: "icone-192.png",
        badge: "icone-192.png",
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
  const url = event.notification.data?.url ?? "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => "focus" in f);
      return ouverte ? ouverte.focus() : self.clients.openWindow(url);
    }),
  );
});

// Le centre des rappels de l'accueil (la cloche) relit ce que Kora a envoyé, même une
// notification balayée : chaque rappel reçu est gardé ici, un mois au plus (src/domaine/centreRappels.ts).
const CACHE_RAPPELS = "korahome-rappels";
const ADRESSE_RAPPELS = "__rappels.json";

async function noterRappel(message) {
  const cache = await caches.open(CACHE_RAPPELS);
  const reponse = await cache.match(ADRESSE_RAPPELS);
  let journal = [];
  try {
    journal = reponse ? await reponse.json() : [];
  } catch {
    journal = [];
  }
  const genre = /^bonjour/i.test(message.titre) ? "rappel-du-matin" : "message";
  journal.unshift({ le: new Date().toISOString(), titre: message.titre, corps: message.corps, genre });
  await cache.put(ADRESSE_RAPPELS, new Response(JSON.stringify(journal.slice(0, 80)), { headers: { "content-type": "application/json" } }));
}
