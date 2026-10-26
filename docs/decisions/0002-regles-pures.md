# 0002 — Toutes les règles dans une couche pure et testée

**Décidé** le 7 octobre 2026.

**Choix** : `src/domaine/` ne connaît ni React, ni le DOM, ni le stockage. L'heure et les
identifiants arrivent par `Contexte`. Chaque fichier a ses tests.

**Pourquoi** : les règles se testent en millisecondes, les fonctions serveur les reprennent sans les
recopier (`npm run fonction`), et l'app native les traduira une à une.

**Ce que ça coûte** : un peu plus de code de liaison dans `src/ui/`.
