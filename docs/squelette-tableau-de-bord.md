# Le squelette standard : tableau de bord, widgets, pages

C'est la structure de toutes les apps de la maison, à reprendre telle quelle pour chaque nouveau module et chaque nouvelle app.

## Ce que voit la personne

- Il n'y a pas de barre d'onglets en bas.
- L'accueil est une page fixe qui ne défile jamais (depuis 0.0.73). On y voit d'abord la date et ses signes, puis quatre chiffres du jour (Tâches, Courses, Budget, Agenda), « Ce soir » et deux piles « En ce moment ». Ce qui presse monte en haut des piles. Chaque téléphone retire ou remet ses cartes avec un appui long. L'ancienne grille de widgets réglable est partie : la grille « bento » est gardée pour un futur hub sur iPad.
- Les modules sont rangés en quatre espaces depuis 0.0.75 : Cuisine, Maison, Organisation et Budget. Un chiffre ou une carte ouvre sa page. Chaque page a la même barre du haut (`BarreHaut`), avec le retour, le titre et le sélecteur des espaces.
- Les réglages s'ouvrent par la petite roue en haut à droite de l'accueil. On cherche en écrivant à la fée.
- Le style est sombre et élégant, graphite et laiton, et passe en clair avec l'iPhone. Les pictogrammes sont au trait, sans emoji. Les arrondis et les écarts suivent les jetons `--rayon-*` et `--espace-*` de `base.css` (depuis 0.0.86). Une page encore vide montre `EtatVide`.

## Comment c'est construit

| Rôle | Fichier |
| --- | --- |
| Le catalogue des sections et leur espace (`fusionneDans`), testé | `src/domaine/tableauDeBord.ts` |
| Ce que montre Aujourd'hui (la carte du jour, ce qui presse), testé | `src/domaine/aujourdhui.ts`, `src/ui/ecrans/Aujourdhui.tsx` |
| Le registre des modules : pour chacun, son aperçu (`widget`) et sa page | `src/ui/modules.tsx` |
| Aujourd'hui et les pages de cartes des espaces | `src/ui/ecrans/Aujourdhui.tsx`, `src/ui/ecrans/Espace*.tsx` |
| La navigation par pile, avec le bouton de retour et la page qu'on glisse vers la droite pour revenir | `src/ui/App.tsx` |
| Les gestes (revenir, glisser une ligne pour la supprimer), testés | `src/ui/gestes.ts` |
| Une ligne qu'on glisse vers la gauche pour la supprimer, avec « Annuler » | `src/ui/Glissable.tsx`, `src/ui/annulation.tsx` |

## Brancher un nouveau module

1. Dans `src/domaine/tableauDeBord.ts`, ajouter son identifiant au catalogue, ou passer `disponible` à `true` s'il y est déjà.
2. S'il garde des données partagées, suivre d'abord `docs/ajouter-un-module.md` (registre des collections).
3. Écrire ses règles dans `src/domaine/<module>.ts`, avec leurs tests.
4. Écrire sa page dans `src/ui/ecrans/<Module>.tsx`.
5. Ajouter une entrée dans `MODULES` (`src/ui/modules.tsx`) :
   - `widget` donne l'aperçu du module (un chiffre, une légende, jusqu'à trois lignes, et s'il est urgent), repris par les chiffres et les cartes de l'accueil ;
   - `page` affiche sa page ; ou bien `ouvre` envoie vers l'onglet d'une autre page (le widget Listes ouvre l'onglet « Autres listes » de Courses, Entretien celui de Tâches). L'onglet ouvert est gardé dans la pile (`onglet`, `changerOnglet`).
6. Dans ses listes, envelopper chaque ligne supprimable dans `<Glissable onSupprimer={…}>` et proposer « Annuler » avec `useAnnoncer()`.

Un test vérifie que chaque widget disponible a son module.

## Aujourd'hui

Depuis 0.1.14, chaque chose est dite à un seul endroit de l'écran (`src/ui/ecrans/Aujourdhui.tsx`) :

- la **carte du moment** (`momentDuJour` dans `src/domaine/aujourdhui.ts`) porte ce qui attend aujourd'hui : la chose qui presse en grand, en laiton, avec « C'est fait » et « Plus tard », puis trois lignes de suite au plus ; rien n'attend, elle reste graphite et dit le repas du soir ou « Rien de prévu, rien ne presse » ;
- la carte ivoire **Demain** (`demainDuJour`) rassemble tout demain : le premier rendez-vous, les autres, les poubelles à sortir, le froid du matin ; elle n'existe pas quand demain est vide ;
- l'**Agenda** dit le reste de la semaine (`ligneWidget(…, true)`), jamais aujourd'hui ni demain ;
- **Tael** ne prend une carte que pour ce que les cartes ne disent pas : une remarque déjà montrée par la carte du moment est tue (`dejaSurLaCarte`), et le mot de l'autre n'est pas annoncé deux fois (`CarteTael sansMot`) ;
- le bas de l'écran se fond sous le bouton rond (`.pile-kora::before` dans `styles/espaces.css`), sur les six espaces.

La fée flotte au-dessus de tous les écrans et remplace les boutons « + » : on la touche pour parler, et un appui long sert à écrire. Les pièces communes ont leur équivalent SwiftUI, décrit dans `docs/pieces-natives.md` : la page, les onglets, la fée, les gestes, le thème et l'état vide. La carte d'ensemble des couches est dans `docs/architecture.md`.
