-- KoraHome : le serveur partagé du foyer (Supabase).
-- À coller une fois dans Supabase > SQL Editor > New query, puis « Run ».
-- Peut être relancé sans risque : il ne supprime aucune donnée.
-- Entrée par le code seulement : Authentication > Sign In / Providers > « Allow anonymous sign-ins ».
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
  collection text not null check (collection in ('foyer', 'listes', 'elements', 'taches', 'animaux', 'stock', 'catalogue', 'retours')),
  id text not null,
  -- Le document complet ; null quand il a été supprimé.
  donnees jsonb,
  -- Heure de la modification sur le téléphone : décide qui gagne.
  maj_client timestamptz not null,
  -- Heure d'arrivée sur le serveur : sert aux téléphones à lire seulement ce qui est nouveau.
  maj_serveur timestamptz not null default clock_timestamp(),
  primary key (foyer_id, collection, id)
);

-- Les notes de test se partagent depuis Kora 0.0.7, le stock (frigo, congélateur, placard)
-- depuis Kora 0.0.9, la Base des produits habituels depuis Kora 0.0.10 : une base plus
-- ancienne reçoit la nouvelle liste.
alter table public.documents drop constraint if exists documents_collection_check;
alter table public.documents add constraint documents_collection_check
  check (collection in ('foyer', 'listes', 'elements', 'taches', 'animaux', 'stock', 'catalogue', 'retours'));

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

-- Un téléphone relié par le code seulement quitte le foyer en se déconnectant.
drop policy if exists "chacun peut quitter un foyer" on public.membres_foyer;
create policy "chacun peut quitter un foyer" on public.membres_foyer
  for delete to authenticated using (user_id = auth.uid());

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

-- Les codes essayés sans succès, pour freiner qui voudrait les deviner.
create table if not exists prive.tentatives (
  user_id uuid not null,
  quand timestamptz not null default now()
);
create index if not exists tentatives_recentes on prive.tentatives (user_id, quand);
revoke all on prive.tentatives from public, anon, authenticated;

-- Rejoindre un foyer avec son code. Renvoie null si le code est inconnu ; au-delà de 10 codes
-- inconnus en une heure, le téléphone doit attendre. Un foyer accueille au plus 6 membres.
create or replace function public.rejoindre_foyer(p_code text)
returns text
language plpgsql security definer set search_path = public, prive as $$
declare
  trouve text;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if (select count(*) from tentatives t where t.user_id = auth.uid() and t.quand > now() - interval '1 hour') >= 10 then
    raise exception 'Trop d''essais';
  end if;
  select f.id into trouve from foyers f where f.code = upper(p_code);
  if trouve is null then
    delete from tentatives t where t.quand < now() - interval '1 day';
    insert into tentatives (user_id) values (auth.uid());
    return null;
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

-- ===== Rappels du matin (notifications) =====
-- Chaque iPhone qui accepte les notifications laisse ici son adresse d'envoi (Web Push).
-- La fonction « rappels » (supabase/functions/rappels) passe chaque heure et envoie à
-- chacun, à son heure (8 h au départ, heure de Zurich), le résumé de sa journée. Mise en route : docs/notifications.md.

create table if not exists public.abonnements_push (
  -- L'adresse d'envoi fournie par l'iPhone : une par téléphone.
  endpoint text primary key,
  foyer_id text not null references public.foyers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- La personne qui utilise ce téléphone (un membre du document « foyer »).
  membre_id text,
  -- Les clés de chiffrement du téléphone (p256dh, auth).
  cles jsonb not null,
  preferences jsonb not null default '{"taches": true, "mitsu": true}',
  heure smallint not null default 8 check (heure between 0 and 23),
  -- Jour (à Zurich) du dernier rappel : un seul par jour.
  dernier_envoi date,
  cree_le timestamptz not null default now()
);

-- Les téléphones passent par les deux fonctions ci-dessous ; seule la fonction d'envoi lit la table.
alter table public.abonnements_push enable row level security;
revoke all on public.abonnements_push from anon, authenticated;

-- Activer les rappels sur ce téléphone, ou changer ses choix et son heure. Le même téléphone
-- peut avoir changé de compte : son ancienne inscription est remplacée.
drop function if exists public.enregistrer_abonnement(text, text, text, jsonb, jsonb);
create or replace function public.enregistrer_abonnement(
  p_endpoint text, p_foyer_id text, p_membre_id text, p_cles jsonb, p_preferences jsonb, p_heure integer default 8
)
returns void
language plpgsql security definer set search_path = public, prive as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if not est_membre(p_foyer_id) then
    raise exception 'Ce foyer appartient à un autre compte';
  end if;
  insert into abonnements_push (endpoint, foyer_id, user_id, membre_id, cles, preferences, heure)
  values (p_endpoint, p_foyer_id, auth.uid(), p_membre_id, p_cles, p_preferences, p_heure)
  on conflict (endpoint) do update set
    foyer_id = excluded.foyer_id, user_id = excluded.user_id, membre_id = excluded.membre_id,
    cles = excluded.cles, preferences = excluded.preferences, heure = excluded.heure;
end $$;

-- Couper les rappels : connaître l'adresse d'envoi suffit (seul ce téléphone la connaît).
create or replace function public.retirer_abonnement(p_endpoint text)
returns void
language sql security definer set search_path = public as $$
  delete from abonnements_push where endpoint = p_endpoint;
$$;

-- Les clés d'envoi (VAPID) et la clé qui autorise le passage horaire. Créées par le
-- serveur lui-même : elles ne passent ni par le dépôt, ni par un téléphone.
create table if not exists prive.reglages_push (
  id boolean primary key default true check (id),
  vapid_publique text,
  vapid_privee text,
  cle_cron text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
);
insert into prive.reglages_push (id) values (true) on conflict do nothing;
revoke all on prive.reglages_push from public, anon, authenticated;

-- Lues par la fonction d'envoi seulement (clé de service). La première fois, elle crée
-- les clés VAPID et les enregistre ; si deux passages se croisent, la première gagne.
create or replace function public.reglages_push(p_publique text default null, p_privee text default null)
returns table (vapid_publique text, vapid_privee text, cle_cron text)
language plpgsql security definer set search_path = prive as $$
begin
  if p_publique is not null then
    update reglages_push r set vapid_publique = p_publique, vapid_privee = p_privee where r.vapid_publique is null;
  end if;
  return query select r.vapid_publique, r.vapid_privee, r.cle_cron from reglages_push r;
end $$;

-- Le passage de chaque heure. À lancer une fois avec l'adresse du projet :
--   select prive.programmer_rappels('https://<projet>.supabase.co');
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function prive.programmer_rappels(p_adresse text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule(
    'rappels-du-matin',
    '0 * * * *',
    format(
      $cmd$select net.http_post(url := %L, body := '{"mode": "matin"}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-cle-cron', (select cle_cron from prive.reglages_push)))$cmd$,
      p_adresse || '/functions/v1/rappels'
    )
  );
end $$;

revoke all on function public.enregistrer_abonnement(text, text, text, jsonb, jsonb, integer) from public, anon;
revoke all on function public.retirer_abonnement(text) from public, anon;
revoke all on function public.reglages_push(text, text) from public, anon, authenticated;
revoke all on function prive.programmer_rappels(text) from public, anon, authenticated;
grant execute on function public.enregistrer_abonnement(text, text, text, jsonb, jsonb, integer) to authenticated;
grant execute on function public.retirer_abonnement(text) to authenticated;
grant execute on function public.reglages_push(text, text) to service_role;
