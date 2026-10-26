# 0005 — Des styles écrits à la main, sans Tailwind ni shadcn

**Décidé** en octobre 2026, confirmé plusieurs fois par Melo.

**Choix** : du CSS rangé par écran dans `src/styles/`, avec des jetons (`--accent`, `--t-corps`, `--courbe`)
dans `base.css`. Graphite et laiton, deux thèmes, aucun emoji dans l'interface.

**Pourquoi** : une signature à soi plutôt que l'allure d'un kit ; des fichiers qu'on peut traduire
en SwiftUI (`docs/pieces-natives.md`).

**Ce que ça coûte** : la discipline des jetons repose sur la relecture et les tests.
