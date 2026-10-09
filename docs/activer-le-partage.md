# Activer le partage entre les deux iPhone

Le partage passe par un projet Supabase gratuit : une base de données en ligne qui
garde une copie des listes, des tâches et du suivi de Mitsu. Chaque iPhone garde
tout de son côté et fonctionne sans réseau ; les modifications se rejoignent dès
que possible (la plus récente gagne). Les notes de test restent sur chaque téléphone.

À faire une seule fois.

Le projet du foyer existe déjà (`korahome`, Zurich, créé par Claude avec le connecteur
Supabase le 9 octobre 2026) : les étapes 1, 2 et 4 sont faites. Restent l'étape 3 et
la 5. Les étapes complètes servent si le projet devait être recréé.

## 1. Créer le projet

1. Sur https://supabase.com, créer un compte puis « New project ».
2. Nom : `korahome`. Région : Europe (Zurich). Noter le mot de passe de
   la base dans le trousseau, **jamais dans le dépôt**.

## 2. Créer les tables

1. Menu « SQL Editor » > « New query ».
2. Coller tout le contenu de [`supabase/schema.sql`](../supabase/schema.sql), puis « Run ».
   Le script peut être relancé sans risque.

## 3. Connexion par code e-mail

Une app installée sur l'écran d'accueil de l'iPhone ne partage pas sa session avec
Safari : un lien magique ouvrirait Safari, pas KoraHome. On se connecte donc avec
un code à 6 chiffres reçu par e-mail.

1. Menu « Authentication » > « Emails » > « Magic Link ».
2. Remplacer le contenu par :

   ```html
   <h2>KoraHome</h2>
   <p>Ton code de connexion : <strong>{{ .Token }}</strong></p>
   <p>Il est valable une heure.</p>
   ```

3. « Authentication » > « Sign In / Providers » > « Email » : laisser « Enable Email
   provider » activé. Si la longueur du code (« Email OTP Length ») est proposée,
   choisir 6.
4. L'envoi d'e-mails intégré à Supabase n'écrit qu'aux membres de l'équipe du projet
   (et quelques messages par heure, ce qui suffit à deux personnes qui restent
   connectées). Inviter donc l'autre membre du foyer dans « Organization » > « Team »
   > « Invite » ; il accepte l'invitation depuis l'e-mail reçu. Plus tard, un service
   d'envoi (Resend, Brevo…) branché dans « Authentication » > « SMTP » lèverait cette
   limite.

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

1. Sur l'iPhone de Melo : Réglages > Partage > se connecter avec son adresse e-mail
   et le code reçu > « Partager ce foyer ». Un code comme `K7Q-M4P` s'affiche.
2. Sur l'iPhone de Sarah : Réglages > Partage (ou, sur un iPhone neuf, « Rejoindre un
   foyer déjà créé » sous le formulaire de bienvenue) > se connecter avec sa propre
   adresse > saisir le code > « Rejoindre ce foyer ». Les données de son téléphone
   sont remplacées par celles du foyer partagé, puis elle choisit son prénom.

## Quand ça se synchronise

À l'ouverture de l'app, au retour dans l'app, au retour du réseau, une seconde et
demie après chaque modification, et toutes les 30 secondes tant que l'app est à
l'écran. Réglages > Partage montre la dernière synchronisation et un bouton pour la
relancer.
