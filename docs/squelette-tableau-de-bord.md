# Le squelette standard : tableau de bord, widgets, pages

C'est la structure de toutes les apps de la maison, à reprendre telle quelle pour chaque nouveau module et chaque nouvelle app.

## Ce que voit la personne

- Il n'y a pas de barre d'onglets en bas.
- L'accueil est un tableau de bord fait de widgets. Chacun ajoute, retire et range les siens avec « Modifier le tableau de bord ». La disposition est gardée sur le téléphone.
- L'ordre choisi reste stable, mais un widget qui a quelque chose d'urgent remonte en haut avec le signal « À faire ».
- Chaque widget ouvre sa page. Chaque page a un bouton de retour vers la page précédente.
- Les réglages s'ouvrent depuis l'icône en haut de l'accueil.
- Les sections qui n'existent pas encore apparaissent dans « Bientôt » quand on ajoute un widget.
- Le style est sombre et élégant, graphite et laiton, et passe en clair avec l'iPhone. Les pictogrammes sont au trait, sans emoji.

## Comment c'est construit

| Rôle | Fichier |
| --- | --- |
| Le catalogue des widgets et les règles du tableau (ajouter, retirer, déplacer, faire remonter l'urgent), testées | `src/domaine/tableauDeBord.ts` |
| Le registre des modules : pour chacun, son widget et sa page | `src/ui/modules.tsx` |
| Le tableau de bord | `src/ui/ecrans/Accueil.tsx` |
| La navigation par pile, avec le bouton de retour | `src/ui/App.tsx` |

## Brancher un nouveau module

1. Dans `src/domaine/tableauDeBord.ts`, ajouter son identifiant au catalogue, ou passer `disponible` à `true` s'il y est déjà.
2. Écrire ses règles dans `src/domaine/<module>.ts`, avec leurs tests.
3. Écrire sa page dans `src/ui/ecrans/<Module>.tsx`.
4. Ajouter une entrée dans `MODULES` (`src/ui/modules.tsx`) :
   - `widget` dit ce que le module montre sur l'accueil : un chiffre, une légende, jusqu'à trois lignes, et s'il est urgent ;
   - `page` affiche sa page.

Un test vérifie que chaque widget disponible a son module.
