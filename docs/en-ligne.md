# KoraHome en ligne

L'app est publiée sur Netlify à l'adresse **https://korahome-cassa.netlify.app**
(projet `korahome-cassa`, équipe de Melo). Netlify est relié au dépôt GitHub : chaque
fusion dans `main` reconstruit et publie l'app toute seule (réglages dans `netlify.toml`).
Sur les iPhone, une pastille rouge sur les Réglages signale la nouvelle version.

- Pas de profil de certificat : l'adresse a un vrai certificat https.
- L'app marche partout, Mac éteint, hors du wifi de la maison.
- L'adresse et la clé publique de Supabase sont des variables d'environnement du projet
  Netlify (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), jamais dans le dépôt. Elles
  sont lues à la construction : après les avoir changées, il faut republier.

## Publication refusée : « unrecognized Git contributor »
L'offre gratuite de Netlify n'accepte qu'un contributeur sur un dépôt privé. Un dernier
commit de `main` qui porte un coauteur (ligne `Co-authored-by: Claude …`) est refusé.
Pour fusionner, écrire soi-même le message du commit fusionné, sans ligne de coauteur ;
si la publication a échoué, un petit commit de Melo sans coauteur sur `main` la relance.

## Passer d'une adresse à l'autre
Chaque adresse garde ses propres données sur l'iPhone. Installer l'app depuis l'adresse
en ligne (Partager, « Sur l'écran d'accueil »), l'ouvrir depuis son icône, puis taper le
code du foyer sur l'écran « Retrouver notre foyer ». Listes, tâches, Mitsu et notes de
test reviennent du serveur.

## Rapports de test
Les notes partent seules sur le serveur du foyer. « Partager » ou « Copier » donnent le
rapport complet avec le journal.
