# KoraHome en ligne

L'app est publiée sur **GitHub Pages** : **https://dmeloz.github.io/korahome/**. Chaque fusion dans
`main` la reconstruit et la publie (action `Pages`). Sur les iPhone, une pastille sur les Réglages
signale la nouvelle version. Netlify (kora-cassa.netlify.app, crédits épuisés le 20 octobre 2026,
figé à la 0.0.63) a été retiré du dépôt en 0.0.96.

- Pas de profil de certificat : l'adresse a un vrai certificat https.
- L'app marche partout, Mac éteint, hors du wifi de la maison.

## Comment

- Le dépôt est public (l'offre gratuite de GitHub ne sert Pages que pour un dépôt public). Il ne
  contient aucune donnée du foyer ni aucune clé secrète : les données vivent dans Supabase.
- L'action `Pages` (`.github/workflows/pages.yml`) construit avec `KORAHOME_BASE=/korahome/`
  (le chemin de l'app, repris par le manifeste et le service worker) et publie `dist/`.
- L'adresse et la clé *publishable* de Supabase sont dans l'action (ou dans les variables du dépôt
  si on les y met) : cette clé est publique par nature, les règles RLS de la base protègent tout.
- Nouvelle adresse = nouvelle app pour l'iPhone : la réinstaller sur l'écran d'accueil depuis Safari,
  rejoindre le foyer avec le code, puis réactiver les notifications (Réglages › Notifications). Les
  données reviennent du serveur ; ce qui n'était que sur l'ancien téléphone (réglages, mémoire
  personnelle) repart de zéro. Siri et Apple Pay ne changent pas (ils parlent à Supabase).
- Pour republier sans changement : GitHub › Actions › Pages › Run workflow.

## Passer d'une adresse à l'autre
Chaque adresse garde ses propres données sur l'iPhone. Installer l'app depuis l'adresse
en ligne (Partager, « Sur l'écran d'accueil »), l'ouvrir depuis son icône, puis taper le
code du foyer sur l'écran « Retrouver notre foyer ». Listes, tâches, Mitsu et notes de
test reviennent du serveur.

## Rapports de test
Les notes partent seules sur le serveur du foyer. « Partager » ou « Copier » donnent le
rapport complet avec le journal.
