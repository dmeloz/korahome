# Ajouter un module à Kora

La liste dans l'ordre, du plus profond au plus visible. Les étapes 1 à 4 suffisent pour qu'une
nouvelle sorte de document se range, se partage, se sauvegarde et s'affiche ; le reste dépend de ce
que le module fait.

1. **Ses règles** : `src/domaine/<module>.ts` et `<module>.test.ts`. Le type de ses documents
   (souvent une union `Doc<Module>` avec un champ `type`), et des fonctions pures.
2. **Sa collection** : une ligne dans `COLLECTIONS` (`src/domaine/collections.ts`), son type dans
   `DocumentsParCollection` (`src/donnees/depot.ts` ; sans lui, le build échoue), et ses trois
   méthodes `lire…`, `enregistrer…`, `supprimer…` dans `Depot` et `depotLocal.ts`.
3. **Le téléphone** : augmenter `VERSION` dans `src/donnees/depotLocal.ts` avec sa ligne de
   commentaire. Le magasin IndexedDB se crée seul ; le curseur de synchro repart de zéro pour relire
   ce que l'autre iPhone a peut-être déjà envoyé.
4. **Le serveur** : une migration datée dans `supabase/migrations/` qui ajoute la collection à
   `documents_collection_check`, et la même liste dans `supabase/schema.sql`. Le test
   `collections.test.ts` échoue tant que les deux ne disent pas la même chose que le registre.
5. **Ce qu'on lit à l'écran** : le champ dans `Donnees` (`src/ui/useDonnees.ts`) et `VIDE`, puis
   dans `DonneesModule` (`src/ui/modules.tsx`) si une page de module en a besoin.
6. **La corbeille**, si un effacement doit pouvoir se rattraper : `COLLECTIONS_CORBEILLE` et ses
   trois `case` dans `src/domaine/corbeille.ts`, puis `Corbeille.tsx`.
7. **La fée et Siri** : ses outils dans `src/domaine/jarvis.ts` (et leurs tests), ce que Siri lit
   dans `COLLECTIONS_SIRI` (`src/domaine/siri.ts`), puis `npm run fonction` et le redéploiement des
   fonctions touchées.
8. **Sa page** : un onglet de son espace dans `src/ui/modules.tsx`, ses styles dans
   `src/styles/<module>.css` importés par `index.css`, son aide de première visite.
9. **La version** : le numéro suivant libre dans `package.json`, sa ligne dans `CHANGELOG.md`, sa
   nouveauté annoncée par la fée dans `src/domaine/nouveautes.ts`, et la ligne de `CLAUDE.md`.
