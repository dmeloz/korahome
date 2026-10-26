# 0007 — Un registre unique des collections

**Décidé** le 27 octobre 2026 (Kora 0.0.83), dans la prise de recul sur Kora.

**Choix** : chaque collection du foyer est déclarée une fois dans `src/domaine/collections.ts` ; la
synchro, les magasins IndexedDB et la sauvegarde en découlent, le dépôt dit quelles collections ont
changé, et `useDonnees` ne relit que celles-là. Un test compare le registre et la contrainte du
serveur.

**Pourquoi** : une collection était écrite en huit endroits ; un oubli faisait une donnée qui ne se
partage pas. Et chaque geste relisait les dix-sept collections.

**Ce que ça coûte** : rien de visible ; les méthodes nommées du `Depot` restent, à côté de
`lire(collection)`.
