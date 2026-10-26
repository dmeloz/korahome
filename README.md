# KoraHome

Kora, l'app compagnon du foyer de Melo et Sarah : courses et cuisine, maison, organisation et
budget, avec une fée (Tael, Navi) qui écoute et agit, et Siri. Une application web installable
(PWA) pour iPhone, écrite pour devenir un jour une app native SwiftUI.

- **En ligne** : https://dmeloz.github.io/korahome/ (dans Safari, puis « Sur l'écran d'accueil »).
- **Comment c'est construit** : [`docs/architecture.md`](docs/architecture.md).
- **Ajouter un module** : [`docs/ajouter-un-module.md`](docs/ajouter-un-module.md).
- **Les grands choix et leur raison** : [`docs/decisions/`](docs/decisions/).
- **Ce que chaque version a apporté** : [`CHANGELOG.md`](CHANGELOG.md).
- **La carte détaillée pour Claude** : [`CLAUDE.md`](CLAUDE.md).

```sh
npm install
npm run dev        # puis ouvrir l'adresse affichée dans Safari
npm test           # les règles (Vitest)
npm run typecheck && npm run lint && npm run build
npm run essai      # chaque écran dans un iPhone simulé, après le build
```

Publier : chaque fusion dans `main` publie sur GitHub Pages (voir [`docs/en-ligne.md`](docs/en-ligne.md)).
Depuis le Mac de la maison : `npm run serveur`, puis [`docs/installer-sur-iphone.md`](docs/installer-sur-iphone.md).
