# Nos mots : ce qui se dit entre vous deux

L'ancien bandeau défilant de l'accueil a laissé la place à trois choses plus discrètes :

- **Les mots de l'autre** attendent en petite icône au-dessus de la fée. Toucher l'icône le lit,
  y répond ou renvoie un cœur.
- **L'humeur du jour** de chacun est un des « signes » au bout de la date (`src/domaine/signes.ts`).
  Tant que personne ne l'a donnée, le signe est un sourire ; le toucher ouvre « Nos mots ».
- **Le clin d'œil du jour** : une phrase par jour pour le foyer, demandée par le premier téléphone
  ouvert après 6 h (modèle léger, `DEMANDE_CLIN`), partagée avec l'autre, que la fée dit à l'accueil.

Dans « Nos mots » : écrire un mot (140 caractères) pour maintenant, ce soir 20 h ou demain 7 h,
choisir son humeur, ajouter ou retirer un compte à rebours, relire tous les mots et leurs cœurs.
Un mot à soi ou un compte à rebours se retire d'un glissement, avec Annuler.

Règles : `src/domaine/bandeau.ts` (le nom du fichier date du bandeau).

## Données

Tout se partage dans la collection `couple` de la table `documents` (types `mot`, `humeur`, `compte`,
`clin`). Les notifications des mots sont décrites dans `docs/notifications.md`.
