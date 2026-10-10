-- KoraHome : le serveur partagé du foyer (Supabase).
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ».
-- Peut être relancé sans risque : il ne supprime aucune donnée.
--
-- Principe : chaque téléphone garde toutes ses données. Le serveur garde une ligne par
-- document (une liste, un élément, une tâche, Mitsu…) ; quand deux téléphones modifient
-- le même document, la modification la plus récente gagne. Seuls les membres d'un foyer
-- voient et modifient ses documents (sécurité au niveau des lignes).

create table if not exists public.foyers (
  id text primary key,
  nom text not null,
  code text not null unique,
  cree_le timestamptz not null default now()
);

create table if not exists public.membres_foyer (
  foyer_id text not null references public.foyers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rejoint_le timestamptz not null default now(),
  primary key (foyer_id, user_id)
);

create table if not exists public.documents (
  foyer_id text not null references public.foyers (id) on delete cascade,
  collection text not null check (collection in ('foyer', 'listes', 'elements', 'taches', 'animaux')),
  id text not null,
  -- Le document complet ; null quand il a été supprimé.
  donnees jsonb,
  -- Heure de la modification sur le téléphone : décide qui gagne.
  maj_client timestamptz not null,
  -- Heure d'arrivée sur le serveur : sert aux téléphones à lire seulement ce qui est nouveau.
  maj_serveur timestamptz not null default clock_timestamp(),
  primary key (foyer_id, collection, id)
);

create index if not exists documents_nouveautes on public.documents (foyer_id, maj_serveur);

-- La modification la plus récente gagne ; l'heure du serveur est toujours celle de l'arrivée.
create or replace function public.documents_plus_recent()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.maj_client < old.maj_client then
    return null;
  end if;
  new.maj_serveur := clock_timestamp();
  return new;
end $$;

drop trigger if exists documents_plus_recent on public.documents;
create trigger documents_plus_recent before insert or update on public.documents
  for each row execute function public.documents_plus_recent();

-- Hors du schéma public : n'est pas exposée par l'API, sert seulement aux règles ci-dessous.
create schema if not exists prive;
grant usage on schema prive to authenticated;

create or replace function prive.est_membre(f text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membres_foyer where foyer_id = f and user_id = auth.uid());
$$;

alter table public.foyers enable row level security;
alter table public.membres_foyer enable row level security;
alter table public.documents enable row level security;

drop policy if exists "membres lisent leur foyer" on public.foyers;
create policy "membres lisent leur foyer" on public.foyers
  for select to authenticated using (prive.est_membre(id));

drop policy if exists "membres voient les membres" on public.membres_foyer;
create policy "membres voient les membres" on public.membres_foyer
  for select to authenticated using (prive.est_membre(foyer_id));

drop policy if exists "membres lisent les documents" on public.documents;
create policy "membres lisent les documents" on public.documents
  for select to authenticated using (prive.est_membre(foyer_id));

drop policy if exists "membres ajoutent des documents" on public.documents;
create policy "membres ajoutent des documents" on public.documents
  for insert to authenticated with check (prive.est_membre(foyer_id));

drop policy if exists "membres modifient les documents" on public.documents;
create policy "membres modifient les documents" on public.documents
  for update to authenticated using (prive.est_membre(foyer_id)) with check (prive.est_membre(foyer_id));

-- Ouvrir le partage d'un foyer. Renvoie son code d'invitation (6 caractères sans O, 0, I, L, 1,
-- le même alphabet que src/domaine/synchro.ts). Relancé par un membre, renvoie le même foyer.
create or replace function public.creer_foyer(p_id text, p_nom text)
returns table (id text, nom text, code text)
language plpgsql security definer set search_path = public, prive as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  nouveau text;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if exists (select 1 from foyers f where f.id = p_id) then
    if not est_membre(p_id) then
      raise exception 'Ce foyer appartient à un autre compte';
    end if;
  else
    loop
      nouveau := '';
      for i in 1..6 loop
        nouveau := nouveau || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      exit when not exists (select 1 from foyers f where f.code = nouveau);
    end loop;
    insert into foyers (id, nom, code) values (p_id, p_nom, nouveau);
    insert into membres_foyer (foyer_id, user_id) values (p_id, auth.uid());
  end if;
  return query select f.id, f.nom, f.code from foyers f where f.id = p_id;
end $$;

-- Rejoindre un foyer avec son code. Un foyer accueille au plus 6 comptes.
create or replace function public.rejoindre_foyer(p_code text)
returns text
language plpgsql security definer set search_path = public, prive as $$
declare
  trouve text;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  select f.id into trouve from foyers f where f.code = upper(p_code);
  if trouve is null then
    raise exception 'Code inconnu';
  end if;
  if not est_membre(trouve) and (select count(*) from membres_foyer m where m.foyer_id = trouve) >= 6 then
    raise exception 'Ce foyer est complet';
  end if;
  insert into membres_foyer (foyer_id, user_id) values (trouve, auth.uid()) on conflict do nothing;
  return trouve;
end $$;

revoke all on function prive.est_membre(text) from public, anon;
revoke all on function public.documents_plus_recent() from public, anon, authenticated;
revoke all on function public.creer_foyer(text, text) from public, anon;
revoke all on function public.rejoindre_foyer(text) from public, anon;
grant execute on function public.creer_foyer(text, text) to authenticated;
grant execute on function public.rejoindre_foyer(text) to authenticated;
grant execute on function prive.est_membre(text) to authenticated;
