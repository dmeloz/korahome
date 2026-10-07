# KoraHome

App compagnon de famille pour deux personnes, sur iPhone. Prototype en application web installable (PWA), conçu pour migrer plus tard vers une app native SwiftUI.

Fiche projet et plan (sur le Mac de la propriétaire) : `~/Atelier-Claude/Cerveau-Obsidian/01-Projets/KoraHome.md`.

## Commandes
- `npm run dev` : serveur de développement (accessible depuis l'iPhone sur le même wifi).
- `npm test` : tests (Vitest).
- `npm run typecheck` puis `npm run build` : vérification des types et build de production dans `dist/`.
- `npm run serveur` : sert l'app en https sur le wifi depuis le Mac (certificat local dans `.certificats/`, voir `docs/installer-sur-iphone.md`).

## Architecture
- `src/domaine/` : logique métier en TypeScript pur. **Aucun import de React, du DOM ou du stockage.** Horloge et identifiants passent par `Contexte`. Chaque règle a ses tests à côté (`*.test.ts`). C'est la spécification que reprendra l'app native.
- `src/donnees/` : accès aux données derrière l'interface `Depot`. `depotLocal.ts` = IndexedDB sur l'appareil. La synchro Supabase viendra comme une autre implémentation de `Depot`.
- `src/ui/` : écrans React. Ils lisent par `useDonnees` et écrivent par le `Depot`, jamais directement dans IndexedDB.

## Conventions
- Interface, code métier et messages de commit en français.
- Aucune clé, jeton ou mot de passe dans le dépôt : variables d'environnement au déploiement uniquement.
- Une étape du plan = une branche et une pull request ; tests, typecheck et build verts avant de demander une relecture.
