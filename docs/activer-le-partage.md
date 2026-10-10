# Activer le partage entre les deux iPhone

Le partage passe par un projet Supabase gratuit : une base de données en ligne qui
garde une copie des listes, des tâches et du suivi de Mitsu. Chaque iPhone garde
tout de son côté et fonctionne sans réseau ; les modifications se rejoignent dès
que possible (la plus récente gagne). Les notes de test restent sur chaque téléphone.

À faire une seule fois.

Le projet du foyer existe déjà (`korahome`, Zurich, créé par Claude avec le connecteur
Supabase le 9 octobre 2026) : les étapes 1, 2 et 4 sont faites. Restent l'étape 3 (un
interrupteur) et la 5. Les étapes complètes servent si le projet devait être recréé.

## 1. Créer le projet

1. Sur https://supabase.com, créer un compte puis « New project ».
2. Nom : `korahome`. Région : Europe (Zurich). Noter le mot de passe de
   la base dans le trousseau, **jamais dans le dépôt**.

## 2. Créer les tables

1. Menu « SQL Editor » > « New query ».
2. Coller tout le contenu de [`supabase/schema.sql`](../supabase/schema.sql), puis « Run ».
   Le script peut être relancé sans risque.

## 3. Connexion par adresse e-mail et mot de passe

Chacun crée son compte depuis l'app (Réglages > Partage) avec son adresse e-mail et un
mot de passe, que l'iPhone peut proposer et retenir dans le trousseau. Aucun e-mail
n'est envoyé : l'envoi intégré de Supabase ne permet plus de modifier les messages et
n'écrit qu'aux membres de l'équipe du projet.

1. « Authentication » > « Sign In / Providers » > « Email ».
2. Désactiver **« Confirm email »**, puis « Save ».

## 4. Donner l'adresse du projet à l'app

1. « Project Settings » > « API » (ou « Data API ») : copier « Project URL » et la
   clé publique « anon » (ou « publishable »). La clé publique peut être dans l'app :
   ce sont les règles de `schema.sql` qui protègent les données. La clé
   « service_role » (ou « secret ») ne doit **jamais** être copiée nulle part.
2. Sur le Mac, dans `~/Atelier-Claude/Projets-code/korahome`, créer le fichier
   `.env.local` (ignoré par Git) :

   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=la-cle-publique
   ```

3. Relancer `npm run serveur` : l'app est reconstruite avec le partage activé.

## 5. Relier les deux iPhone

1. Sur l'iPhone de Melo : Réglages > Partage > « Créer un compte » (adresse e-mail et
   mot de passe) > « Partager ce foyer ». Un code comme `K7Q-M4P` s'affiche.
2. Sur l'iPhone de Sarah : Réglages > Partage (ou, sur un iPhone neuf, « Rejoindre un
   foyer déjà créé » sous le formulaire de bienvenue) > créer son propre compte >
   saisir le code > « Rejoindre ce foyer ». Les données de son téléphone
   sont remplacées par celles du foyer partagé, puis elle choisit son prénom.

## Quand ça se synchronise

À l'ouverture de l'app, au retour dans l'app, au retour du réseau, une seconde et
demie après chaque modification, et toutes les 30 secondes tant que l'app est à
l'écran. Réglages > Partage montre la dernière synchronisation et un bouton pour la
relancer.
