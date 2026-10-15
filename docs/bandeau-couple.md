# Le bandeau du couple et « Nos mots »

Sous « Bonjour, Melo », un bandeau défile doucement de droite à gauche, comme un fil d'infos.
Toucher un mot de l'autre lui renvoie un cœur ; toucher ailleurs ouvre la page « Nos mots ».

Ce qui défile, dans l'ordre (`elementsBandeau`, `src/domaine/bandeau.ts`) :

1. **Les mots reçus** des trois derniers jours (trois au plus), avec un cœur.
2. **L'humeur du jour** de chacun (un emoji, une par personne et par jour).
3. **Les comptes à rebours** des trois prochains mois (« Vacances dans 12 jours »).
4. **Le clin d'œil de Jarvis** : une phrase par jour pour le foyer, demandée par le premier
   téléphone ouvert après 6 h (modèle léger, `DEMANDE_CLIN`), partagée avec l'autre.
5. **Des infos utiles** : la météo de Renens, le prochain rendez-vous de la semaine, ce qu'il faut
   finir au frigo, ce qui presse pour Mitsu.

Dans « Nos mots » : écrire un mot (140 caractères) pour maintenant, ce soir 20 h ou demain 7 h,
choisir son humeur, ajouter ou retirer un compte à rebours, relire tous les mots et leurs cœurs.
Un mot à soi ou un compte à rebours se retire d'un glissement, avec Annuler.

## Données

Tout se partage dans la collection `couple` de la table `documents` (types `mot`, `humeur`, `compte`,
`clin`). Les notifications des mots sont décrites dans `docs/notifications.md`. Si l'animation gêne
(Réglages de l'iPhone > Accessibilité > Réduire les animations), le bandeau ne défile plus et se
parcourt au doigt.
