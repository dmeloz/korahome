# Les pièces de Kora, et leur équivalent dans l'app native

Kora 0.0.23 range l'interface en quelques pièces qui se répètent sur toutes les pages. Chacune porte le nom qu'elle aura en SwiftUI, pour que la migration vers l'app native reprenne la même structure sans tout redessiner. La logique métier (`src/domaine/`) ne change pas : elle reste la spécification.

## Ce que voit la personne

- **L'accueil** : la date et la météo, le bandeau du couple qui défile (à la place de la salutation, réglable dans « Nos mots »), la carte « Aujourd'hui » (les choses du jour par urgence, trois en vue et les autres au doigt, un rond pour cocher une tâche), puis des pages de widgets à glisser, rangées par usage (Ménage, Courses, Cuisine, Budget, Agenda). En bas : l'état du partage, la dernière sauvegarde, « Modifier l'accueil ».
- **La barre Jarvis**, en bas de chaque page : la seule façon d'ajouter quelque chose. On écrit ou on dit une phrase ; Kora la range seule quand c'est simple (courses, tâche, rendez-vous, pesée de Mitsu, nouvelle liste), sinon la confie à Jarvis. Le bouton ticket y photographie un ticket de caisse.
- **La visite guidée** : au premier lancement sur chaque téléphone, des bulles montrent la banderole, la carte Aujourd'hui, les pages, un widget, la barre Jarvis, les gestes, la recherche et les réglages. « Passer » à tout moment ; Réglages › Visite guidée la relance et remontre les aides des pages.
- **Une page** : grand titre, une ligne de contexte, une aide montrée une seule fois, puis le contenu.
- **Les gestes**, partout les mêmes : glisser vers la droite = fait (coché, pris) ; vers la gauche = supprimer, avec « Annuler » ; appui long = menu rapide ; glisser depuis le bord gauche = revenir.
- **Le thème** : Auto, Sombre ou Clair doux, choisi par téléphone (Réglages, Ce téléphone). Les textes suivent la taille de texte de l'iPhone.
- **Le mouvement** : les feuilles montent en 0,5 s avec la page derrière qui recule ; les pages glissent en 0,35 s ; avec « Réduire les animations », tout passe en fondu.

## Correspondance

| Pièce web | Fichier | Équivalent SwiftUI |
| --- | --- | --- |
| `Page` (titre, sous-titre, actions) | `src/ui/pieces/Page.tsx` | Vue dans un `NavigationStack`, `.navigationTitle` en grand, `.toolbar` |
| `AideUneFois` | `src/ui/pieces/Page.tsx` | `TipKit` (`Tip` affiché une fois) |
| `Visite` (visite guidée de l'accueil) | `src/ui/pieces/Visite.tsx`, parcours dans `src/domaine/visite.ts` | Une suite de `TipKit` (`popoverTip`) avec `Tips.showAllTipsForTesting()` pour la relancer |
| `Onglets` | `src/ui/pieces/Page.tsx` | `Picker` en style `.segmented` |
| `PointEtat` (urgent, aujourd'hui, calme) | `src/ui/pieces/Page.tsx` | `Circle().fill(...)` avec trois couleurs d'état |
| `CarteAujourdhui` | `src/ui/pieces/Aujourdhui.tsx` | La même vue, et le widget de l'écran d'accueil (`WidgetKit`) |
| `BarreJarvis` | `src/ui/pieces/barre.tsx` | `.safeAreaInset(edge: .bottom)` avec un `TextField` et un `AppIntent` |
| `AuDessusDeLaBarre` | `src/ui/pieces/barre.tsx` | Contenu du même `safeAreaInset`, au-dessus du champ |
| `Glissable` | `src/ui/Glissable.tsx` | `.swipeActions(edge: .leading / .trailing)` et `.contextMenu` |
| `Feuille` | `src/ui/Feuille.tsx` | `.sheet` avec `presentationDetents` |
| Pages d'accueil à glisser | `src/ui/ecrans/Accueil.tsx` | `TabView` en style `.page` |
| Recherche (tirer vers le bas) | `src/ui/Recherche.tsx` | `.searchable` |
| Thème | `src/ui/theme.ts` | `.preferredColorScheme` et un `Asset Catalog` de couleurs |

## Les données qui servent ailleurs

- `carteDuJour` et `phraseDuJour` (`src/domaine/aujourdhui.ts`) donnent la forme exacte d'un futur widget iPhone et de la réponse de Siri à « Qu'est-ce qu'on a aujourd'hui ? ».
- `comprendrePhrase` (`src/domaine/barre.ts`) dit où va une phrase : c'est le futur `AppIntent` de la barre et de Siri.
- `creerSauvegarde` et `lireSauvegarde` (`src/domaine/sauvegarde.ts`) décrivent le fichier de sauvegarde, que l'app native saura relire.
