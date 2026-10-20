-- La corbeille du foyer (Kora 0.0.64) : ce que l'un efface reste trente jours sur le serveur,
-- dans la collection « corbeille », et l'autre téléphone peut le remettre. Appliqué le 20 octobre 2026.
alter table public.documents drop constraint if exists documents_collection_check;
alter table public.documents add constraint documents_collection_check
  check (collection in ('foyer', 'listes', 'elements', 'taches', 'animaux', 'stock', 'catalogue', 'jardin', 'memoire', 'couple', 'menus', 'agenda', 'budget', 'retours', 'corbeille'));
