# Le Chef de la semaine

Le widget **Chef de la semaine** ouvre la page « Menus de la semaine ». Une fois par semaine, ou quand
on touche **Lancer le Chef maintenant**, le Chef :

1. lit le frigo, le congélateur et les placards, et repère ce qui arrive à sa date dans les 5 jours ;
2. propose 5 repas du soir simples et de saison en Suisse romande, qui finissent d'abord ces produits ;
3. ajoute à la liste de courses les ingrédients qui manquent, rangés par rayon, sans doublon avec ce
   qui y est déjà, marqués **Chef** sur la liste ;
4. vérifie les croquettes et la litière de Mitsu : sous 10 jours, il prévient (commande zooplus),
   sans rien ajouter à la liste ;
5. envoie une notification « Les menus de la semaine sont prêts » aux téléphones inscrits aux rappels.

Il ne fait qu'ajouter : il ne touche ni au stock, ni aux tâches, ni à Mitsu, ni aux réglages. Relancé
dans la semaine, il remplace seulement **ses** articles que personne n'a encore cochés. Sur la page,
un article se retire d'un glissement (avec Annuler).

## Passage automatique

Désactivé au départ. Dans la page, l'interrupteur « Passage automatique » l'active ; le jour et l'heure
se choisissent comme pour les rappels (par défaut le dimanche à 17 h, heure de Zurich). Le réglage est
un document `reglage` de la collection partagée `menus`, valable pour tout le foyer.

## Où est quoi

- Règles et tests : `src/domaine/chef.ts` (consignes, format de réponse imposé, ajouts, alertes Mitsu,
  horaire). Copiées dans `supabase/functions/chef/domaine.js` par `npm run fonction`.
- Fonction serveur : `supabase/functions/chef/index.ts`. Elle appelle Claude (modèle du conseil,
  Sonnet) avec la clé `ANTHROPIC_API_KEY` déjà rangée pour Jarvis, écrit elle-même les articles
  (collection `elements`) et les menus (collection `menus`, un document `menu-AAAA-MM-JJ` par passage).
  Sa dépense compte dans le plafond de Jarvis (5 CHF par mois) : quelques centimes par passage.
- Page et widget : `src/ui/ecrans/Chef.tsx`, entrée `chef` de `src/ui/modules.tsx`.

## Mise en route sur le serveur (une fois)

1. Appliquer `supabase/schema.sql` (ajoute `menus` aux collections et la fonction `prive.programmer_chef`).
2. Déployer la fonction `chef` (fichiers `index.ts`, `domaine.js` et le dossier `_shared`, sans vérification du jeton par Supabase, comme `rappels` et `jarvis` :
   elle vérifie elle-même la session ou la clé du passage horaire).
3. Programmer le passage de chaque heure :
   `select prive.programmer_chef('https://ffnmyfrzqvhvafnxvyxx.supabase.co');`

## Les recettes du foyer (0.0.38)

Onglet « Nos recettes » de la page « Menus de la semaine ». Une base qui se remplit seule, comme la
Base de Frigo et placards :

- **Le Chef** y range chaque repas qu'il propose, avec ses ingrédients (quantités pour deux) et ses
  étapes. Il relit les recettes que le foyer aime et peut les reprendre sous leur titre exact.
- **Jarvis** y range une recette lue derrière un lien (données JSON-LD, étapes comprises), sur une
  photo (bouton « Photographier une recette ») ou dictée/collée dans la barre (outil
  `enregistrer_recette`). Un titre seul dans la barre ouvre une fiche à remplir à la main.
- Une recette déjà là (même titre) n'est pas copiée : elle monte (`vue` + 1), et ce que le foyer a
  écrit n'est jamais écrasé.

La fiche : portions (les quantités se recalculent, les courses aussi), ce qui est déjà à la maison
d'après le stock (le sel, l'huile et les épices sont supposés là), « Mettre aux courses ce qui
manque », un soir des sept prochains jours (la recette rejoint « Prévu ces soirs » et le manquant part
aux courses), le mode cuisine (plein écran, écran allumé, une étape à la fois, glisser pour avancer),
« On l'a fait » (compté, sans rien retirer du stock), l'avis « On aime » / « Pas pour nous » partagé
avec le Chef. Jarvis répond à « qu'est-ce qu'on mange ce soir ? » à partir de ces recettes et du stock.

Rangement : documents `type: "recette"` (id `recette-…`) dans la collection `menus`, à côté des menus
et du réglage : pas de nouvelle table. Règles et tests : `src/domaine/recettes.ts`. Écrans :
`src/ui/ecrans/Recettes.tsx`. Après une modification : `npm run fonction`, puis redéployer `chef` et
`jarvis`.

## La fiche de la semaine (0.0.55)

La version légère de la « fiche de production croisée » de la cuisine pro (le modèle complet est rangé dans Sanji, `savoir/modeles/`). Dans « Cette semaine », une carte « La fiche de la semaine » apparaît dès qu'il y a deux repas : les recettes posées sur un soir des sept prochains jours, puis celles du menu du Chef (sept au plus, codées P1, P2…).

- Chaque ingrédient n'apparaît qu'une fois, avec sa quantité par repas (« P1 200 g · P3 150 g ») et le total quand les unités s'additionnent (g et kg, ml à l, gousses…). Sinon, pas de total inventé.
- « À préparer en une fois » : ce qui sert à au moins deux repas.
- « Mettre aux courses ce qui manque » ajoute le total de la semaine, une ligne par ingrédient, sans ce qui est déjà sur la liste.
- « Partager la fiche » l'envoie en texte (Notes, message, impression).
- Les quantités restent celles de chaque recette, pour son nombre de personnes. Pas de serveur ni de Jarvis : tout se calcule sur le téléphone.

Règles : `src/domaine/ficheSemaine.ts` (tests à côté). Écran : `src/ui/ecrans/FicheSemaine.tsx`.
