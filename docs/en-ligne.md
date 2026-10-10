# KoraHome en ligne

L'app est publiée sur Netlify à l'adresse **https://korahome-cassa.netlify.app**
(projet `korahome-cassa`, équipe de Melo). Chaque fusion dans `main` reconstruit et
publie l'app toute seule (voir « Qui publie » ; réglages dans `netlify.toml`).
Sur les iPhone, une pastille rouge sur les Réglages signale la nouvelle version.

- Pas de profil de certificat : l'adresse a un vrai certificat https.
- L'app marche partout, Mac éteint, hors du wifi de la maison.
- L'adresse et la clé publique de Supabase sont des variables d'environnement du projet
  Netlify (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), jamais dans le dépôt. Elles
  sont lues à la construction : après les avoir changées, il faut republier.

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
3. Netlify : projet korahome-cassa > Project configuration > Build & deploy > Continuous
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
