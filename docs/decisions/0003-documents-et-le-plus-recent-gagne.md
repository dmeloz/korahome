# 0003 — Des documents JSON partagés, le plus récent gagne

**Décidé** le 10 octobre 2026 (Kora 0.0.4).

**Choix** : une seule table `documents` sur Supabase (foyer, collection, id, données JSON, date de
modification). Chaque téléphone garde tout et marche hors ligne ; à la synchro, la modification la
plus récente gagne, document par document.

**Pourquoi** : deux personnes, peu de modifications simultanées ; un schéma qui ne change pas à
chaque module ; hors ligne d'abord.

**Ce que ça coûte** : deux modifications du même document au même moment, la plus ancienne se perd.
À revoir (fusion fine, CRDT) seulement au premier écrasement réel constaté.

**Complétée** le 11 novembre 2026 par la fiche [0008](0008-les-retouches-se-rejoignent.md) : deux
retouches du même document se rejoignent champ par champ, sur le téléphone.
