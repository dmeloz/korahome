-- Les vêtements du foyer (Kora 0.0.77, idée de Sarah) : tailles, envies et pièces à trier de
-- chacun, dans la collection « vetements ». Au passage, ce que le contrôleur de Supabase
-- signalait : les index manquants sur les clés étrangères, et la règle « chacun peut quitter
-- un foyer » qui relisait auth.uid() à chaque ligne. Appliqué le 26 octobre 2026.
alter table public.documents drop constraint if exists documents_collection_check;
alter table public.documents add constraint documents_collection_check
  check (collection in ('foyer', 'listes', 'elements', 'taches', 'animaux', 'stock', 'catalogue', 'jardin', 'memoire', 'couple', 'menus', 'agenda', 'budget', 'retours', 'corbeille', 'vetements'));

create index if not exists membres_foyer_user on public.membres_foyer (user_id);
create index if not exists abonnements_push_foyer on public.abonnements_push (foyer_id);
create index if not exists abonnements_push_user on public.abonnements_push (user_id);

drop policy if exists "chacun peut quitter un foyer" on public.membres_foyer;
create policy "chacun peut quitter un foyer" on public.membres_foyer
  for delete to authenticated using (user_id = (select auth.uid()));
