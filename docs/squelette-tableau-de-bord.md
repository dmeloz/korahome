# Le squelette standard : tableau de bord, widgets, pages

C'est la structure de toutes les apps de la maison, à reprendre telle quelle pour chaque nouveau module et chaque nouvelle app.

## Ce que voit la personne

- Il n'y a pas de barre d'onglets en bas.
- L'accueil est un tableau de bord fait de widgets. Un appui long sur un widget passe en modification (le glisser pour le ranger, « − » pour le retirer, deux tailles) ; tirer l'accueil vers le bas ouvre « Tous les espaces », d'où l'on glisse un espace sur l'accueil pour en faire un widget. La disposition est gardée sur le téléphone.
- L'ordre choisi reste stable, mais un widget qui a quelque chose d'urgent remonte en haut avec le signal « À faire ».
- Chaque widget ouvre sa page. Chaque page a un bouton de retour vers la page précédente.
- Les réglages s'ouvrent par la petite roue en haut à droite de l'accueil (depuis 0.0.73 ; avant, depuis « Tous les espaces »). On cherche en écrivant à la fée.
- Le style est sombre et élégant, graphite et laiton, et passe en clair avec l'iPhone. Les pictogrammes sont au trait, sans emoji.

## Comment c'est construit

| Rôle | Fichier |
| --- | --- |
| Le catalogue des widgets et les règles du tableau (ajouter, retirer, déplacer, faire remonter l'urgent), testées | `src/domaine/tableauDeBord.ts` |
| Le registre des modules : pour chacun, son widget et sa page | `src/ui/modules.tsx` |
| Le tableau de bord | `src/ui/ecrans/Accueil.tsx` |
| La navigation par pile, avec le bouton de retour et la page qu'on glisse vers la droite pour revenir | `src/ui/App.tsx` |
| Les gestes (revenir, glisser une ligne pour la supprimer), testés | `src/ui/gestes.ts` |
| Une ligne qu'on glisse vers la gauche pour la supprimer, avec « Annuler » | `src/ui/Glissable.tsx`, `src/ui/annulation.tsx` |

## Brancher un nouveau module

1. Dans `src/domaine/tableauDeBord.ts`, ajouter son identifiant au catalogue, ou passer `disponible` à `true` s'il y est déjà.
2. Écrire ses règles dans `src/domaine/<module>.ts`, avec leurs tests.
3. Écrire sa page dans `src/ui/ecrans/<Module>.tsx`.
4. Ajouter une entrée dans `MODULES` (`src/ui/modules.tsx`) :
   - `widget` dit ce que le module montre sur l'accueil : un chiffre, une légende, jusqu'à trois lignes, et s'il est urgent ;
   - `page` affiche sa page ; ou bien `ouvre` envoie vers l'onglet d'une autre page (le widget Listes ouvre l'onglet « Autres listes » de Courses, Entretien celui de Tâches). L'onglet ouvert est gardé dans la pile (`onglet`, `changerOnglet`).
5. Dans ses listes, envelopper chaque ligne supprimable dans `<Glissable onSupprimer={…}>` et proposer « Annuler » avec `useAnnoncer()`.

Un test vérifie que chaque widget disponible a son module.

## Aujourd'hui

L'accueil a la grande date et ses signes, « Ce matin / Ce soir » avec la tâche du moment, puis les widgets en verre. La fée flotte au-dessus de tous les écrans et remplace les boutons « + » : on la touche pour parler, un appui long pour écrire. Les pièces communes (page, onglets, fée, gestes, thème) et leur équivalent SwiftUI sont décrits dans `docs/pieces-natives.md`.
