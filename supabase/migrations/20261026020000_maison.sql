-- La maison (Kora 0.0.79) : les jours des déchets du foyer et nos appareils avec leur
-- garantie, dans la collection « maison ». Appliqué le 26 octobre 2026.
alter table public.documents drop constraint if exists documents_collection_check;
alter table public.documents add constraint documents_collection_check
  check (collection in ('foyer', 'listes', 'elements', 'taches', 'animaux', 'stock', 'catalogue', 'jardin', 'memoire', 'couple', 'menus', 'agenda', 'budget', 'retours', 'corbeille', 'vetements', 'maison'));
