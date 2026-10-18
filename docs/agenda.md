# L'agenda commun

Le widget **Agenda commun** ouvre la page « Agenda » : rendez-vous (médecin, véto), anniversaires,
vacances, sorties et horaires de travail, pour nous deux ou pour l'un de nous.

- **Jour** (heure par heure comme Calendrier : toucher une heure libre y ajoute un événement), **Semaine**, **Mois** et **À venir** (60 jours). Les filtres **Tout**, **Nous deux**, **Melo**, **Sarah**
  (chaque personne voit le sien et le commun). Un point de couleur par personne, laiton pour nous deux.
- **Ajouter** : on écrit comme on parle (« Dentiste jeudi 14h30 », « Vacances du 20 au 27 décembre »,
  « Travail tous les lundis de 8h à 17h pour Sarah », « Anniversaire de maman le 12 mars 1962 ») et les
  champs se remplissent ; tout reste modifiable. Avec l'année de naissance, l'âge fêté s'affiche.
- Les rappels prévus au carnet de Mitsu y apparaissent, en lecture seule.
- Jarvis sait ajouter et retirer un événement (avec confirmation), lit l'agenda des deux semaines, et
  une photo de carte de rendez-vous ou de faire-part va dans l'agenda.
- Le rappel du matin commence par l'agenda du jour (réglable dans Notifications).

## Relié à iCloud

Chacun peut relier son compte iCloud depuis la page (section « Calendrier de l'iPhone ») :

1. sur https://account.apple.com : Connexion et sécurité, Mots de passe pour app, « + », nommé « Kora » ;
2. dans Kora : identifiant Apple et ce mot de passe d'app.

La fonction serveur `agenda` crée alors un calendrier **Kora** dans cet iCloud et, chaque quart d'heure
ou à chaque modification :

- y écrit tout l'agenda du foyer (avec le prénom devant ce qui concerne l'autre : « Sarah · Dentiste ») ;
- reprend dans Kora ce qui y est ajouté, modifié ou supprimé sur l'iPhone (le plus récent gagne) ;
- lit les autres calendriers choisis (« Travail », « Famille »…) et les montre dans Kora, marqués
  « iCloud de … », en lecture seule. Ils se règlent dans « Régler ».

Sécurité : le mot de passe d'app va dans le coffre du serveur (Supabase Vault, table
`prive.comptes_icloud`) et ne revient jamais aux téléphones. Il ne donne accès qu'aux calendriers et se
retire à tout moment chez Apple. « Délier mon iCloud » l'efface du serveur ; le calendrier « Kora »
reste sur l'iPhone, à supprimer à la main. Si le calendrier « Kora » est supprimé sur l'iPhone, Kora
le recrée et le remplit, sans rien effacer de l'agenda.

## Où est quoi

- Règles et tests : `src/domaine/agenda.ts` (événements, répétitions, phrase, widget, Jarvis, rappel) et
  `src/domaine/icloud.ts` (iCalendar, CalDAV, décisions de synchro `planSynchro`). `icloud.ts` est copié
  dans `supabase/functions/agenda/domaine.js` par `npm run fonction`.
- Fonction serveur : `supabase/functions/agenda/index.ts` (relier, choisir, synchroniser, délier,
  passage du quart d'heure).
- Page et widget : `src/ui/ecrans/Agenda.tsx`, entrée `agenda` de `src/ui/modules.tsx`.
- Données : collection partagée `agenda` (un document par événement, plus `icloud-compte-<membre>`
  écrit par le serveur pour montrer l'état de chaque compte).

## Mise en route sur le serveur (une fois)

1. Appliquer `supabase/schema.sql` : ajoute `agenda` aux collections, la table `prive.comptes_icloud` et
   les fonctions `icloud_*` (réservées au serveur), et `prive.programmer_agenda`.
2. Déployer la fonction `agenda` (fichiers `index.ts` et `domaine.js`, sans vérification du jeton par
   Supabase : elle vérifie elle-même la session ou la clé du passage régulier).
3. Redéployer `rappels` (l'agenda du jour dans le rappel du matin) et `jarvis` (ses nouveaux outils).
4. Programmer le passage du quart d'heure :
   `select prive.programmer_agenda('https://ffnmyfrzqvhvafnxvyxx.supabase.co');`
