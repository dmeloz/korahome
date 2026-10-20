# KoraHome en ligne

L'app est publiée sur Netlify à l'adresse **https://kora-cassa.netlify.app**
(projet `kora-cassa`, équipe « D. » de Melo, depuis le 20 octobre 2026 ; l’ancien projet `korahome-cassa` n’a plus de crédits). Chaque fusion dans `main` reconstruit et
publie l'app toute seule (voir « Qui publie » ; réglages dans `netlify.toml`).
Sur les iPhone, une pastille rouge sur les Réglages signale la nouvelle version.

- Pas de profil de certificat : l'adresse a un vrai certificat https.
- L'app marche partout, Mac éteint, hors du wifi de la maison.
- L'adresse et la clé publique de Supabase sont des variables d'environnement du projet
  Netlify (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), jamais dans le dépôt. Elles
  sont lues à la construction : après les avoir changées, il faut republier.

## Depuis le 20 octobre 2026 : GitHub Pages

Le compte Netlify `kora-cassa` a épuisé ses crédits gratuits le 20 octobre au soir (« Account credit
usage exceeded ») : les versions 0.0.64 à 0.0.66 n'ont pas pu partir. L'app est désormais publiée
sur **GitHub Pages**, gratuit et sans compteur : **https://dmeloz.github.io/korahome/**.

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

## Qui publie
L'offre gratuite de Netlify n'accepte qu'un contributeur sur un dépôt privé : quand un
commit porte un coauteur (`Co-authored-by: Claude …`), Netlify refuse de construire
(« unrecognized Git contributor »). La publication passe donc par GitHub : l'action
`Publier` (`.github/workflows/publier.yml`) construit et publie l'app à chaque arrivée
dans `main`, avec un jeton Netlify. Elle reprend les variables du projet Netlify.

Mise en place, une seule fois :
1. Netlify : avatar > User settings > Applications > Personal access tokens > New access
   token (nom « GitHub KoraHome », sans expiration), copier le jeton.
2. GitHub : dépôt korahome > Settings > Secrets and variables > Actions > New repository
   secret, nom `NETLIFY_AUTH_TOKEN`, coller le jeton.
3. Netlify : projet kora-cassa > Project configuration > Build & deploy > Continuous
   deployment > Build settings > Stop builds, pour ne plus voir les constructions refusées.

Pour republier sans changement : GitHub > Actions > Publier > Run workflow.

## Passer d'une adresse à l'autre
Chaque adresse garde ses propres données sur l'iPhone. Installer l'app depuis l'adresse
en ligne (Partager, « Sur l'écran d'accueil »), l'ouvrir depuis son icône, puis taper le
code du foyer sur l'écran « Retrouver notre foyer ». Listes, tâches, Mitsu et notes de
test reviennent du serveur.

## Rapports de test
Les notes partent seules sur le serveur du foyer. « Partager » ou « Copier » donnent le
rapport complet avec le journal.
