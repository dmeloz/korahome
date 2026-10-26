# 0004 — L'assistant ne vit que sur le serveur, avec un plafond

**Décidé** le 7 octobre 2026, renforcé le 26 octobre (0.0.81).

**Choix** : la clé de Claude est dans les secrets de Supabase ; la fée et Siri passent par les
fonctions `jarvis` et `siri`. Plafond de 5 CHF par mois, assistant réservé au foyer inscrit. Les
actions qui suppriment attendent un oui.

**Pourquoi** : le dépôt est public et l'app tourne dans un navigateur : aucune clé ne doit y être.

**Ce que ça coûte** : sans réseau, la fée ne répond pas ; les règles passent par la génération des
`domaine.js`.
