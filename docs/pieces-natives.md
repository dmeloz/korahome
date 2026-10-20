# Les pièces de Kora, et leur équivalent dans l'app native

Kora range l'interface en quelques pièces qui se répètent sur toutes les pages. Chacune porte le nom qu'elle aura en SwiftUI, pour que la migration vers l'app native reprenne la même structure sans tout redessiner. La logique métier (`src/domaine/`) ne change pas : elle reste la spécification. Depuis la refonte façon iOS 27 (Kora 0.0.42 à 0.0.45), la fée remplace la barre Jarvis.

## Ce que voit la personne

- **L'accueil** : la grande date (sans salutation), une rangée de signes (humeurs, compte à rebours, prochain rendez-vous, météo, Mitsu) qui ouvrent leur page au toucher, puis « Ce matin », « Cet après-midi », « Ce soir » ou « Demain » la nuit, sans cadre : la tâche du moment en grand, l'heure à gauche, un rond pour cocher ; trois suivantes, puis « Voir les N autres » qui déplie le reste (pas de liste qui défile dans la page). Ensuite les widgets, en deux tailles. Tirer l'accueil vers le bas ouvre « Tous les espaces » (grille et recherche).
- **La fée** (Tael, violette, pour Dany ; Navi, bleue, pour Sarah) flotte en bas, à droite ou à gauche. Un toucher : elle écoute. Un appui long : on lui écrit. Deux touchers : elle se cache. Glissée contre le bord : elle se range. C'est la seule façon d'ajouter quelque chose : elle range seule ce qui est simple (courses, tâche, rendez-vous, pesée de Mitsu, liste) et confie le reste à l'assistant. Une phrase comme « ouvre le budget » ouvre la page.
- **Sa bulle** : petite et discrète, boutons en simple texte. Le prénom n'apparaît que pour un message de l'autre. Les mots et cœurs de l'autre attendent en petite icône au-dessus d'elle jusqu'au toucher ; les rappels et alertes sont dits tout de suite.
- **Sa vie** (`src/domaine/vieFee.ts`, moteur `src/ui/vieFee.ts`) : elle dort la nuit sur la date (nuit apprise de 14 jours d'usage, 23 h à 7 h au départ), s'étire au réveil et résume la journée, scintille au coin du widget d'une chose urgente (3 par jour), dit « C'est l'heure » à l'heure d'une tâche, fait une boucle de joie à chaque tâche cochée, pâlit quand une urgence attend, porte le givre ou la pluie, fête un jour J, dit ce que l'autre a ajouté aux courses, se fâche si on la secoue, ronronne si on la caresse, et apprend à se taire à une heure où on la renvoie souvent. Son coupé par défaut.
- **La visite guidée** : au premier lancement sur chaque téléphone, des bulles montrent les signes, la carte du jour, un widget et la fée. « Passer » à tout moment ; Réglages › Visite guidée la relance et remontre les aides des pages.
- **Une page** : grand titre, une ligne de contexte, une aide montrée une seule fois, puis le contenu. Depuis 0.0.45, les listes n'ont plus de cadre (de fins traits les séparent) et la chose du moment, la première ligne du groupe qui presse, est en grand. Les Réglages gardent leurs groupes, comme ceux de l'iPhone.
- **Les gestes**, partout les mêmes : glisser vers la droite = fait (coché, pris) ; vers la gauche = supprimer, avec « Annuler » ; appui long = menu rapide ; glisser depuis le bord gauche = revenir.
- **Les réglages par téléphone** : thème (Auto, Sombre, Clair doux), verre des widgets et taille de la date (Ce téléphone) ; son de la fée, nuit apprise et discrétion (Réglages › Tael ou Navi). Les textes suivent la taille de texte de l'iPhone.
- **Le mouvement** : les feuilles montent en 0,5 s avec la page derrière qui recule ; les pages glissent en 0,35 s ; avec « Réduire les animations », tout passe en fondu et la fée ne bat plus des ailes.

## Correspondance

| Pièce web | Fichier | Équivalent SwiftUI |
| --- | --- | --- |
| `Page` (titre, sous-titre, actions) | `src/ui/pieces/Page.tsx` | Vue dans un `NavigationStack`, `.navigationTitle` en grand, `.toolbar` |
| Listes sans cadre, `phare-ligne` | `src/ui/ecrans/Taches.tsx`, `DetailListe.tsx` | `List` en style `.plain`, la première ligne avec une police `.title3` |
| `AideUneFois` | `src/ui/pieces/Page.tsx` | `TipKit` (`Tip` affiché une fois) |
| `Visite` (visite guidée de l'accueil) | `src/ui/pieces/Visite.tsx`, parcours dans `src/domaine/visite.ts` | Une suite de `TipKit` (`popoverTip`) avec `Tips.showAllTipsForTesting()` pour la relancer |
| `Onglets` | `src/ui/pieces/Page.tsx` | `Picker` en style `.segmented` |
| `PointEtat` (urgent, aujourd'hui, calme) | `src/ui/pieces/Page.tsx` | `Circle().fill(...)` avec trois couleurs d'état |
| `CarteAujourdhui` | `src/ui/pieces/Aujourdhui.tsx` | La même vue, et le widget de l'écran d'accueil (`WidgetKit`) |
| `GrandeDate`, `Signes` | `src/ui/pieces/HautAccueil.tsx` | `Text` en `.largeTitle` et une `HStack` de boutons ronds |
| `Fee` (la fée, ses gestes, sa bulle) | `src/ui/pieces/Fee.tsx`, état dans `src/ui/fee.ts` | Une vue en `.overlay` avec `DragGesture`, `onTapGesture(count: 2)` et `onLongPressGesture`, la bulle en `.popover` compact ; les étincelles en `TimelineView` |
| Vie de la fée | `src/ui/vieFee.ts`, règles `src/domaine/vieFee.ts` | Un `@Observable` piloté par un `Timer` sur l'accueil ; l'heure d'une tâche en `UNCalendarNotificationTrigger` local |
| `BarreJarvis` (la saisie de la fée) | `src/ui/pieces/barre.tsx` | `.safeAreaInset(edge: .bottom)` avec un `TextField` et un `AppIntent`, ouvert par l'appui long |
| `AuDessusDeLaBarre` | `src/ui/pieces/barre.tsx` | Contenu du même `safeAreaInset`, au-dessus du champ |
| `Glissable` | `src/ui/Glissable.tsx` | `.swipeActions(edge: .leading / .trailing)` et `.contextMenu` |
| Mouvement (Anime.js : ressorts, graphiques qui se dessinent) | `src/ui/mouvement.ts` | `.animation(.spring(duration:bounce:))` ; un trait en `.trim(from: 0, to: avancee)` animé |
| `Feuille` | `src/ui/Feuille.tsx` | `.sheet` avec `presentationDetents` |
| Tous les espaces (tirer vers le bas) | `src/ui/TousLesEspaces.tsx` | `.searchable` sur une grille `LazyVGrid` |
| Réglages › La fée | `src/ui/ecrans/LaFee.tsx` | Un `Form` avec `Toggle` (son) et un bouton de remise à zéro |
| Thème, verre | `src/ui/theme.ts`, `src/ui/accueilLocal.ts` | `.preferredColorScheme`, `.glassEffect` et un `Asset Catalog` de couleurs |

## Les données qui servent ailleurs

- `carteDuJour` et `phraseDuJour` (`src/domaine/aujourdhui.ts`) donnent la forme exacte d'un futur widget iPhone et de la réponse de Siri à « Qu'est-ce qu'on a aujourd'hui ? ».
- `comprendrePhrase` (`src/domaine/barre.ts`) dit où va une phrase : c'est le futur `AppIntent` de la fée et de Siri.
- `feeDe`, `attentesDuCouple` (`src/domaine/fee.ts`) et `vieFee.ts` décrivent qui est la fée, ce qui attend au-dessus d'elle et quand elle parle ; l'app native les reprend telles quelles.
- `tachesALHeure` et `notificationHeure` (`src/domaine/rappels.ts`) disent quelle tâche rappeler à quelle minute, ce que la fonction serveur `rappels` envoie aujourd'hui.
- `creerSauvegarde` et `lireSauvegarde` (`src/domaine/sauvegarde.ts`) décrivent le fichier de sauvegarde, que l'app native saura relire.
