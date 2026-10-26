# Notifications : les rappels du matin

Aux jours et à l'heure choisis sur l'iPhone (tous les jours à 8 h au départ, de 5:00 à 22:59, à la minute près, heure de Zurich), chaque iPhone inscrit reçoit **une seule** notification qui
résume sa journée : ses tâches et les tâches libres (du jour et en retard), ce qui presse pour Mitsu
(commande, provisions, soins) et ce qui arrive à sa date au frigo ou au placard dans les trois jours. Rien à faire : pas de notification. La pastille de l'icône affiche le
nombre de choses qui pressent, comme celle de Messages : depuis Kora 0.1.0, l'app la tient à jour
à chaque changement (tâche faite, produit consommé), et elle disparaît quand tout est fait.

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

## Les mots du couple

Un mot écrit dans « Nos mots » (voir `docs/bandeau-couple.md`) arrive aussi en notification sur
l'autre iPhone : tout de suite (le téléphone appelle la fonction `rappels` en mode `mot`, qui vérifie
que la personne est membre du foyer), ou à l'heure prévue pour un mot programmé (le passage de
chaque heure annonce les mots devenus visibles depuis l'heure précédente, `fenetreMotsProgrammes`).
Chacun peut les couper dans Réglages > Notifications > « Mots du couple » (`preferences.mots`).

## L'heure des tâches

Depuis Kora 0.0.44, une tâche qui a une heure (choisie, ou proposée par Kora d'après l'heure où elle
se fait d'habitude) envoie aussi « C'est l'heure » à cette minute, à la personne qui la fait et à
tous pour une tâche libre (`tachesALHeure`, `notificationHeure`). Le passage de chaque minute s'en
charge ; « Tâches » coupé dans le contenu du rappel la coupe aussi. App ouverte, c'est la fée qui le
dit sur l'accueil, avec « C'est fait » et « Dans 15 min » (`src/ui/vieFee.ts`).

## Comment ça marche

- `src/domaine/rappels.ts` : quoi rappeler et quand (testé). C'est la règle que reprendra l'app native.
- `public/notifications-sw.js` : le service worker affiche la notification et ouvre l'app au toucher.
- `src/ui/rappels.ts` et `src/ui/ecrans/Notifications.tsx` : permission, inscription, choix.
- `supabase/schema.sql`, section « Rappels du matin » : la table `abonnements_push` (une ligne par
  iPhone), les clés d'envoi dans `prive.reglages_push` (créées par le serveur lui-même, jamais dans
  le dépôt) et le passage de chaque minute (`pg_cron`, `* * * * *`).
- `supabase/functions/rappels/` : la fonction serveur. Appelée chaque minute par `pg_cron`, elle envoie
  le rappel à chaque iPhone au premier passage à partir de son heure (la minute est dans `preferences.minute`), une fois par jour, et oublie les
  iPhone qui ont retiré l'autorisation.

## Modifier les règles

Après une modification de `src/domaine/rappels.ts` (ou de `taches.ts`, `mitsu.ts`, `stock.ts`) :

1. `npm run fonction` régénère `supabase/functions/rappels/domaine.js` (un test vérifie qu'il est à jour).
2. Redéployer la fonction `rappels` (fichiers `index.ts`, `domaine.js` et le dossier `_shared`, sans vérification JWT :
   elle contrôle elle-même la clé du passage horaire et la session du téléphone).

## Mise en route d'un nouveau projet Supabase

1. Appliquer `supabase/schema.sql`.
2. Déployer la fonction `rappels`.
3. Une fois : `select prive.programmer_rappels('https://<projet>.supabase.co');`

Pour le projet du foyer (korahome), tout cela est fait depuis le 10 octobre 2026.

## Heures calmes (depuis 0.0.67)

Réglages › Notifications › « Heures calmes » (par téléphone, `preferences.calme`) : un mot du couple écrit ou
programmé entre 22 h et 7 h (heure du foyer) n'est pas annoncé à ce téléphone sur le moment ; au passage
de 7 h 00, la fonction `rappels` rattrape les mots devenus visibles depuis 22 h la veille pour ces
téléphones seulement (`enHeuresCalmes`, `fenetreMotsCalmes` dans `src/domaine/rappels.ts`). Les cœurs ne
sont jamais rattrapés. Le rappel du matin garde son heure.

## Notifications déclaratives (depuis 0.0.85)

Chaque message envoyé (`messagePush` dans `src/domaine/rappels.ts`, utilisé par `rappels` et `chef`)
porte deux formes. La forme déclarative (`web_push: 8030`, `notification` avec `title`, `body`,
`navigate` et `app_badge`) est lue par l'iPhone lui-même depuis iOS 18.4 : la notification s'affiche
et la pastille de l'icône se pose même si le service worker ne se réveille pas à temps. L'ancienne
forme (`titre`, `corps`, `nombre`, `url`) reste lue par `public/notifications-sw.js`, qui reçoit
toujours l'évènement : sa notification remplace celle proposée et il garde le rappel pour la cloche.

Le rappel du matin annonce aussi les anniversaires de l'agenda une semaine avant
(`anniversairesBientot` dans `src/domaine/agenda.ts`).
