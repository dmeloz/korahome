# Notifications : les rappels du matin

Aux jours et à l'heure choisis sur l'iPhone (tous les jours à 8 h au départ, de 5 h à 22 h, heure de Zurich), chaque iPhone inscrit reçoit **une seule** notification qui
résume sa journée : ses tâches et les tâches libres (du jour et en retard), ce qui presse pour Mitsu
(commande, provisions, soins) et ce qui arrive à sa date au frigo ou au placard dans les trois jours. Rien à faire : pas de notification. La pastille de l'icône affiche le
nombre de rappels et s'efface à l'ouverture de l'app.

## Sur l'iPhone

1. KoraHome doit être **sur l'écran d'accueil** et ouverte depuis son icône (iOS 16.4 ou plus).
2. Le partage doit être activé sur ce téléphone (les rappels partent du serveur du foyer).
3. Réglages > Notifications > Rappels du matin > « Activer les rappels du matin », puis « Autoriser ».
4. « Recevoir le rappel d'aujourd'hui maintenant » envoie tout de suite un essai.

Chacun choisit sur son iPhone, comme une alarme de l'app Horloge : l'heure (la roue de l'iPhone), les
jours (L M M J V S D, ou « Tous les jours », « En semaine », « Le week-end ») et ce que contient le
rappel (tâches, Mitsu, frigo et placards), avec un aperçu de la notification. Les jours voyagent dans les `preferences`
de l'abonnement (`jours`, 0 = dimanche) : pas de changement de table. Le rappel suit la personne
choisie dans Réglages > Ce téléphone.

## Comment ça marche

- `src/domaine/rappels.ts` : quoi rappeler et quand (testé). C'est la règle que reprendra l'app native.
- `public/notifications-sw.js` : le service worker affiche la notification et ouvre l'app au toucher.
- `src/ui/rappels.ts` et `src/ui/ecrans/Notifications.tsx` : permission, inscription, choix.
- `supabase/schema.sql`, section « Rappels du matin » : la table `abonnements_push` (une ligne par
  iPhone), les clés d'envoi dans `prive.reglages_push` (créées par le serveur lui-même, jamais dans
  le dépôt) et le passage de chaque heure (`pg_cron`).
- `supabase/functions/rappels/` : la fonction serveur. Appelée chaque heure par `pg_cron`, elle envoie
  le rappel à chaque iPhone au premier passage à partir de 8 h, une fois par jour, et oublie les
  iPhone qui ont retiré l'autorisation.

## Modifier les règles

Après une modification de `src/domaine/rappels.ts` (ou de `taches.ts`, `mitsu.ts`, `stock.ts`) :

1. `npm run fonction` régénère `supabase/functions/rappels/domaine.js` (un test vérifie qu'il est à jour).
2. Redéployer la fonction `rappels` (fichiers `index.ts` et `domaine.js`, sans vérification JWT :
   elle contrôle elle-même la clé du passage horaire et la session du téléphone).

## Mise en route d'un nouveau projet Supabase

1. Appliquer `supabase/schema.sql`.
2. Déployer la fonction `rappels`.
3. Une fois : `select prive.programmer_rappels('https://<projet>.supabase.co');`

Pour le projet du foyer (korahome), tout cela est fait depuis le 10 octobre 2026.
