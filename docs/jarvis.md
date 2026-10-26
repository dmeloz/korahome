# Jarvis : l'assistant du foyer

Le bouton étoile en haut de l'accueil ouvre Jarvis. On lui écrit, ou on touche le micro et on lui
parle : « ajoute du lait et des œufs », « la litière est faite », « Sarah sort les poubelles samedi »,
« qu'est-ce qui périme bientôt ? ». Il répond en une phrase et agit tout seul ; chaque réponse qui a
changé quelque chose a son bouton **Annuler**. Quand on lui a parlé, il répond aussi à voix haute.

Ce qu'il sait faire (Kora 0.1.0) : ajouter et cocher des courses, créer une tâche (unique ou qui
revient, pour quelqu'un ou libre), marquer une tâche faite, ranger des produits au frigo, au
congélateur ou au placard, noter une pesée de Mitsu (même à une date passée), tenir son journal (litière, soucis) et son carnet de santé (y compris relu sur une photo du carnet), et répondre sur l'état du foyer.
Il confie aussi une tâche à quelqu'un. Il ne dépense rien, et demande toujours avant de supprimer. Depuis Kora 0.0.41, on lui parle
aussi par Siri (« Dis Siri, Tael… ») : voir `docs/siri.md`.

- **Vêtements** (Kora 0.0.79) : « Sarah fait du 39 », « note une veste en laine pour moi, 120 francs » (noter_taille,
  noter_envie) ; « quelle pointure fait Sarah ? » se répond depuis les tailles et les envies de l'état du foyer.
- **Mémoire** (Kora 0.0.16) : « retiens que Sarah n'aime pas la coriandre » ; Jarvis relit sa
  mémoire à chaque demande (les 60 faits les plus récents, quelques centimes par mois au plus).
  Quand il remarque une habitude, il demande « Je le retiens ? » avant de la garder. La page
  **Ce que Jarvis sait** (lien « Sa mémoire » en haut de Jarvis) permet de relire, corriger d'un
  toucher et effacer d'un glissement. Collection partagée `memoire` (`src/domaine/memoire.ts`).
- **Plus d'actions** (Kora 0.0.16) : décaler ou renommer une tâche, la supprimer, retirer du stock ce
  qui est fini, oublier un fait. Tout ce qui supprime pose d'abord la question, avec ses boutons, et
  se défait ensuite avec Annuler. « Rappelle-moi jeudi… » crée une tâche à cette date, signalée par
  le rappel du matin. Il connaît aussi les derniers soins de Mitsu et les habitudes d'achat.
- **Souhaits pour Claude** (Kora 0.0.16) : ce que Jarvis ne sait pas encore faire, il le note
  (« Je ne sais pas encore le faire, je l'ai noté pour Claude »). Le souhait devient une note de
  test « Idée » sur l'écran « Jarvis », qui part avec les autres sur le serveur ; Claude les lit au
  début d'une session de corrections (`docs/retours-de-test.md`) et en fait une pull request que
  Melo valide. Jarvis ne touche jamais au code lui-même.
- **Photo** : le bouton appareil photo envoie une lettre, une facture ou une carte de rendez-vous ;
  Jarvis crée une tâche à la date de chaque rendez-vous ou échéance. La photo est réduite à
  1600 pixels en JPEG sur le téléphone avant de partir, et n'est gardée nulle part.
- **Ticket de caisse** : la même photo range les achats au stock, avec leur quantité ; sans date
  écrite, la durée habituelle du foyer (ou celle que Kora connaît) donne la date de péremption, et
  les courses correspondantes se cochent, et le total compte dans la carte courses du Budget. Le
  bouton ticket (Frigo et placards, Budget, Courses ; photo ou PDF) fait la même chose avec une
  relecture d'abord : on décoche une ligne ou une course, on change un lieu, on corrige le total,
  puis « Tout ranger » (avec Annuler). Voir `docs/budget.md`.
- **Clin d'œil du jour** : une phrase chaleureuse par jour, que la fée dit à l'accueil (voir
  `docs/bandeau-couple.md`).
- **Recette** : coller le lien d'une recette (Betty Bossi, Fooby, Marmiton…). Le serveur ouvre la page
  (https public seulement, 8 secondes, 1,5 Mo au plus), lit les ingrédients dans ses données
  structurées ou, à défaut, son texte, et Jarvis n'ajoute aux courses que ce qui manque.
- **Conseil de la semaine** : depuis Jarvis, « Préparer la semaine ensemble ». Le modèle plus réfléchi
  (`claude-sonnet-5-5`) propose qui fait quoi, cinq repas qui finissent d'abord ce qui arrive à sa
  date, et les courses. Chaque proposition se coche ou se décoche, puis **Valider ensemble**
  applique le reste (avec Annuler). Compter quelques centimes par conseil.
- **Conseiller du Budget** (0.0.37) : mode `budget`, même modèle réfléchi, une seule réponse par
  l'outil `repondre_budget` (texte, tableau, conseils chiffrés). Consignes `CONSIGNES_BUDGET` dans
  `src/domaine/jarvisModele.ts`, état préparé par `src/domaine/budgetConseil.ts`. Voir `docs/budget.md`.

## Comment ça marche

- `src/domaine/jarvisModele.ts` (copié dans la fonction serveur) et `src/domaine/jarvis.ts` : ses consignes, ses outils, la lecture des recettes, ce qu'il sait du foyer, comment ses actions
  modifient les données, et le plafond de dépense (testé). C'est la règle que reprendra l'app native.
- `src/ui/ecrans/Jarvis.tsx`, `src/ui/ecrans/Conseil.tsx` et `src/ui/jarvis.ts` : la conversation, le conseil, les photos, la voix (reconnaissance et
  synthèse de l'iPhone), l'enregistrement dans le Dépôt et l'annulation.
- `supabase/functions/jarvis/` : la fonction serveur. Elle vérifie que le téléphone est membre du
  foyer, refuse au-delà du plafond, interroge Claude (modèle léger `claude-haiku-5-5`), compte la
  dépense et renvoie la réponse et les actions. Le téléphone vérifie chaque action avant de l'appliquer.
- `supabase/schema.sql`, section « Jarvis » : la table `prive.conso_jarvis` (dépense par foyer et par
  mois) et la fonction `jarvis_compter`, réservée au serveur.

## Le budget

Plafond de **5 CHF par mois** pour tout le foyer : à 80 %, Jarvis l'écrit sous la conversation ; au
plafond, il se tait jusqu'au 1er du mois suivant. Une demande ordinaire coûte moins d'un millième de
franc. Le compte se fait en millionièmes de franc, avec un dollar compté 0,90 CHF (prudent).
Par sécurité, fixer aussi une limite mensuelle sur la console Anthropic (Limits > Spend limit).

Depuis le 26 octobre 2026, l'assistant (Jarvis, le Chef, Siri) ne répond qu'aux foyers inscrits dans
`prive.foyers_assistant` : le dépôt est public et la connexion anonyme ouverte, sans cette liste un
inconnu pouvait créer un foyer et dépenser le crédit Claude. Un foyer absent voit « plafond
atteint ». Pour un nouveau serveur ou un nouveau foyer, dans l'éditeur SQL de Supabase :
`insert into prive.foyers_assistant (foyer_id) values ('<id du foyer>');`.

## Quand Jarvis tombe

Depuis Kora 0.0.82, un appel à Claude qui échoue pour une autre raison que l'affluence (429) ou la
limite du compte écrit une note « Bug serveur » dans les retours de test du foyer (une par fonction
et par jour, `src/domaine/panne.ts`, écrite par `supabase/functions/_shared/alerte.ts`), et la
personne lit « Jarvis a un souci de son côté. Claude est prévenu ». Le 26 octobre 2026, Tael était
resté muet seize heures sans que personne ne le sache.

## Mise en route (une fois)

1. Sur https://console.anthropic.com : créer une clé d'API (Settings > API keys) et une limite de
   dépense mensuelle.
2. Dans Supabase > Edge Functions > Secrets : ajouter `ANTHROPIC_API_KEY` avec cette clé. Elle ne passe
   jamais par le dépôt ni par un téléphone.
3. Appliquer la section « Jarvis » de `supabase/schema.sql`.
4. Déployer la fonction `jarvis` (fichiers `index.ts`, `domaine.js` et le dossier `_shared`, sans vérification JWT : elle
   contrôle elle-même la session du téléphone).

Après une modification de `src/domaine/jarvis.ts` : `npm run fonction`, puis redéployer `jarvis`.
