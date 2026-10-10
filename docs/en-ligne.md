# KoraHome en ligne

L'app est publiée sur Netlify à l'adresse **https://korahome-cassa.netlify.app**
(projet `korahome-cassa`, équipe de Melo). Netlify est relié au dépôt GitHub : chaque
fusion dans `main` reconstruit et publie l'app toute seule (réglages dans `netlify.toml`).
Sur les iPhone, le bandeau « Nouvelle version prête » apparaît à l'ouverture suivante.

- Pas de profil de certificat : l'adresse a un vrai certificat https.
- L'app marche partout, Mac éteint, hors du wifi de la maison.
- L'adresse et la clé publique de Supabase sont des variables d'environnement du projet
  Netlify (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), jamais dans le dépôt.

## Passer d'une adresse à l'autre
Chaque adresse garde ses propres données sur l'iPhone. Après avoir installé l'app depuis
la nouvelle adresse : Bienvenue > « Rejoindre un foyer déjà créé », taper le code du foyer.
Les listes, tâches et le suivi de Mitsu reviennent du serveur. Les notes de test, elles,
restent dans l'ancienne app : envoyer le rapport avant de la supprimer.

## Rapports de test
« Envoyer le rapport au Mac » ne marche que dans l'app servie par le Mac. En ligne,
utiliser « Partager » (AirDrop vers le Mac) ou « Copier ».
