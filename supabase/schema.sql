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
  -- Ce que le téléphone dit de lui (« Dany · iPhone · Kora 0.0.82 ») et sa dernière ouverture (Kora 0.0.82).
  nom text,
  vu_le timestamptz,
  primary key (foyer_id, user_id)
);
alter table public.membres_foyer add column if not exists nom text;
alter table public.membres_foyer add column if not exists vu_le timestamptz;
create index if not exists membres_foyer_user on public.membres_foyer (user_id);

create table if not exists public.documents (
  foyer_id text not null references public.foyers (id) on delete cascade,
  collection text not null check (collection in ('foyer', 'listes', 'elements', 'taches', 'animaux', 'stock', 'catalogue', 'jardin', 'memoire', 'couple', 'menus', 'agenda', 'budget', 'retours', 'corbeille')),
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
-- depuis Kora 0.0.9, la Base des produits habituels depuis Kora 0.0.10, le jardin depuis
-- Kora 0.0.15, la mémoire de Jarvis et le bandeau du couple depuis Kora 0.0.16, les menus du Chef
-- de la semaine depuis Kora 0.0.17, l'agenda commun depuis Kora 0.0.18, le budget depuis Kora 0.0.27, la corbeille depuis Kora 0.0.64, les vêtements depuis Kora 0.0.79 : une base plus ancienne
-- reçoit la nouvelle liste.
alter table public.documents drop constraint if exists documents_collection_check;
alter table public.documents add constraint documents_collection_check
  check (collection in ('foyer', 'listes', 'elements', 'taches', 'animaux', 'stock', 'catalogue', 'jardin', 'memoire', 'couple', 'menus', 'agenda', 'budget', 'retours', 'corbeille', 'vetements', 'maison'));

create index if not exists documents_nouveautes on public.documents (foyer_id, maj_serveur);

-- La synchro à l'instant (Kora 0.1.0) : le serveur prévient les téléphones du foyer dès
-- qu'un document change (Supabase Realtime, qui respecte les règles de lecture ci-dessous).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents') then
    alter publication supabase_realtime add table public.documents;
  end if;
end $$;

-- La modification la plus récente gagne ; l'heure du serveur est toujours celle de l'arrivée.
create or replace function public.documents_plus_recent()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.maj_client < old.maj_client then
    return null;
  end if;
  -- Un téléphone dont l'heure avance ne gagne pas tous les conflits (Kora 0.0.96).
  if new.maj_client > clock_timestamp() + interval '5 minutes' then
    new.maj_client := clock_timestamp();
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
  for delete to authenticated using (user_id = (select auth.uid()));

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
-- inconnus en une heure, le téléphone doit attendre. Un foyer accueille au plus 10 comptes
-- (chaque installation de l'app en crée un) ; plein, il libère d'abord les places des anciennes
-- installations restées sans activité depuis 30 jours.
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
  if not est_membre(trouve) and (select count(*) from membres_foyer m where m.foyer_id = trouve) >= 10 then
    delete from membres_foyer m where m.foyer_id = trouve and not exists (
      select 1 from auth.sessions s
      where s.user_id = m.user_id and coalesce(s.refreshed_at, s.updated_at, s.created_at) > now() - interval '30 days'
    );
    if (select count(*) from membres_foyer m where m.foyer_id = trouve) >= 10 then
      raise exception 'Ce foyer est complet';
    end if;
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

-- ===== Les téléphones reliés (Kora 0.0.82, Réglages › Partage) =====
-- Chaque installation de Kora est un compte membre du foyer. Un membre voit ces téléphones, en
-- retire un (place libérée, rappels coupés) et peut changer le code du foyer.

-- Ce téléphone dit qui il est (« Dany · iPhone · Kora 0.0.82 ») et qu'il vient de s'ouvrir.
create or replace function public.nommer_appareil(p_foyer_id text, p_nom text)
returns void
language sql security definer set search_path = public as $$
  update membres_foyer set nom = left(btrim(p_nom), 60), vu_le = now()
  where foyer_id = p_foyer_id and user_id = auth.uid();
$$;

-- Les téléphones du foyer, le plus récemment actif d'abord. Réservé aux membres.
create or replace function public.appareils_foyer(p_foyer_id text)
returns table (id uuid, nom text, rejoint_le timestamptz, actif_le timestamptz, moi boolean)
language plpgsql stable security definer set search_path = public, prive as $$
begin
  if not est_membre(p_foyer_id) then
    raise exception 'Ce foyer appartient à un autre compte';
  end if;
  return query
    select m.user_id, m.nom, m.rejoint_le,
      greatest(m.vu_le, (select max(coalesce(s.refreshed_at, s.updated_at, s.created_at)) from auth.sessions s where s.user_id = m.user_id)),
      m.user_id = auth.uid()
    from membres_foyer m
    where m.foyer_id = p_foyer_id
    order by 4 desc nulls last;
end $$;

-- Retirer un autre téléphone du foyer : sa place se libère et ses rappels s'arrêtent.
-- Pour ce téléphone-ci, c'est « Quitter le partage ».
create or replace function public.retirer_appareil(p_foyer_id text, p_id uuid)
returns void
language plpgsql security definer set search_path = public, prive as $$
begin
  if not est_membre(p_foyer_id) then
    raise exception 'Ce foyer appartient à un autre compte';
  end if;
  if p_id = auth.uid() then
    raise exception 'Pour ce téléphone, utilise « Quitter le partage »';
  end if;
  delete from abonnements_push a where a.foyer_id = p_foyer_id and a.user_id = p_id;
  delete from membres_foyer m where m.foyer_id = p_foyer_id and m.user_id = p_id;
end $$;

-- Un nouveau code pour rejoindre le foyer (même alphabet que creer_foyer).
create or replace function public.nouveau_code_foyer(p_foyer_id text)
returns text
language plpgsql security definer set search_path = public, prive as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  nouveau text;
begin
  if not est_membre(p_foyer_id) then
    raise exception 'Ce foyer appartient à un autre compte';
  end if;
  loop
    nouveau := '';
    for i in 1..6 loop
      nouveau := nouveau || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from foyers f where f.code = nouveau);
  end loop;
  update foyers set code = nouveau where id = p_foyer_id;
  return nouveau;
end $$;

revoke all on function public.nommer_appareil(text, text) from public, anon;
revoke all on function public.appareils_foyer(text) from public, anon;
revoke all on function public.retirer_appareil(text, uuid) from public, anon;
revoke all on function public.nouveau_code_foyer(text) from public, anon;
grant execute on function public.nommer_appareil(text, text) to authenticated;
grant execute on function public.appareils_foyer(text) to authenticated;
grant execute on function public.retirer_appareil(text, uuid) to authenticated;
grant execute on function public.nouveau_code_foyer(text) to authenticated;

-- ===== Rappels du matin (notifications) =====
-- Chaque iPhone qui accepte les notifications laisse ici son adresse d'envoi (Web Push).
-- La fonction « rappels » (supabase/functions/rappels) passe chaque minute et envoie à
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
create index if not exists abonnements_push_foyer on public.abonnements_push (foyer_id);
create index if not exists abonnements_push_user on public.abonnements_push (user_id);

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
  -- Seulement vers les services de notification connus (veille du 26 octobre 2026).
  if p_endpoint !~ '^https://([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)/' then
    raise exception 'Adresse de notification inconnue';
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

-- Le passage de chaque minute (rappel à l'heure exacte choisie, 7:45 par exemple). À lancer une fois avec l'adresse du projet :
--   select prive.programmer_rappels('https://<projet>.supabase.co');
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function prive.programmer_rappels(p_adresse text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule(
    'rappels-du-matin',
    -- De 5 h à 22 h 59 à Zurich (les rappels n'existent pas la nuit) : 3 h à 22 h 59 UTC (Kora 0.0.96).
    '* 3-22 * * *',
    format(
      $cmd$select net.http_post(url := %L, body := '{"mode": "matin"}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-cle-cron', (select cle_cron from prive.reglages_push)))$cmd$,
      p_adresse || '/functions/v1/rappels'
    )
  );
end $$;

-- Le Chef de la semaine (Kora 0.0.17) passe aussi chaque heure : la fonction « chef » prépare les
-- menus des foyers dont c'est le jour et l'heure (réglés dans l'app). À lancer une fois :
--   select prive.programmer_chef('https://<projet>.supabase.co');
create or replace function prive.programmer_chef(p_adresse text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule(
    'chef-de-la-semaine',
    '2 * * * *',
    format(
      $cmd$select net.http_post(url := %L, body := '{"mode": "heure"}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-cle-cron', (select cle_cron from prive.reglages_push)),
        timeout_milliseconds := 120000)$cmd$,
      p_adresse || '/functions/v1/chef'
    )
  );
end $$;

revoke all on function prive.programmer_chef(text) from public, anon, authenticated;

-- L'essai du matin de la fée (Kora 0.0.85) : chaque jour, la fonction « jarvis » pose une question
-- minuscule à Claude avec les vrais outils et signale une panne aux foyers inscrits.
-- La liste des foyers qui ont l'assistant, pour la fonction serveur seulement.
create or replace function public.foyers_assistant_liste()
returns setof text
language sql stable security definer set search_path = prive as $$
  select foyer_id from foyers_assistant;
$$;
revoke all on function public.foyers_assistant_liste() from public, anon, authenticated;
grant execute on function public.foyers_assistant_liste() to service_role;

-- À lancer une fois avec l'adresse du projet : select prive.programmer_essai_fee('https://<projet>.supabase.co');
create or replace function prive.programmer_essai_fee(p_adresse text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule(
    'essai-de-la-fee',
    '17 5 * * *',
    format(
      $cmd$select net.http_post(url := %L, body := '{"mode": "essai"}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-cle-cron', (select cle_cron from prive.reglages_push)),
        timeout_milliseconds := 60000)$cmd$,
      p_adresse || '/functions/v1/jarvis'
    )
  );
end $$;
revoke all on function prive.programmer_essai_fee(text) from public, anon, authenticated;

revoke all on function public.enregistrer_abonnement(text, text, text, jsonb, jsonb, integer) from public, anon;
revoke all on function public.retirer_abonnement(text) from public, anon;
revoke all on function public.reglages_push(text, text) from public, anon, authenticated;
revoke all on function prive.programmer_rappels(text) from public, anon, authenticated;
grant execute on function public.enregistrer_abonnement(text, text, text, jsonb, jsonb, integer) to authenticated;
grant execute on function public.retirer_abonnement(text) to authenticated;
grant execute on function public.reglages_push(text, text) to service_role;

-- ===== Jarvis (l'assistant du foyer) =====
-- Ce que Jarvis a coûté à chaque foyer, mois par mois, en millionièmes de franc. La fonction
-- « jarvis » (supabase/functions/jarvis) refuse de répondre une fois le plafond du mois atteint
-- (5 CHF, src/domaine/jarvis.ts). Mise en route : docs/jarvis.md.

create table if not exists prive.conso_jarvis (
  foyer_id text not null references public.foyers (id) on delete cascade,
  -- « AAAA-MM », à Zurich.
  mois text not null,
  micro_chf bigint not null default 0,
  demandes integer not null default 0,
  primary key (foyer_id, mois)
);
revoke all on prive.conso_jarvis from public, anon, authenticated;

-- L'assistant est réservé aux foyers inscrits ici (veille du 26 octobre 2026) : le dépôt est
-- public et la connexion anonyme ouverte, un foyer créé par un inconnu ne doit pas dépenser le
-- crédit Claude. Pour en ajouter un : insert into prive.foyers_assistant (foyer_id) values ('…').
create table if not exists prive.foyers_assistant (
  foyer_id text primary key references public.foyers (id) on delete cascade,
  ajoute_le timestamptz not null default now()
);
revoke all on prive.foyers_assistant from public, anon, authenticated;

-- Ajoute une dépense (0 : simple lecture) et renvoie le total du mois. Fonction d'envoi seulement.
-- Un foyer qui n'est pas inscrit voit un total bien au-delà du plafond : l'assistant refuse.
create or replace function public.jarvis_compter(p_foyer_id text, p_mois text, p_micro_chf bigint)
returns bigint
language plpgsql security definer set search_path = prive as $$
declare
  total bigint;
begin
  if not exists (select 1 from foyers_assistant a where a.foyer_id = p_foyer_id) then
    return 1000000000;
  end if;
  insert into conso_jarvis as c (foyer_id, mois, micro_chf, demandes)
  values (p_foyer_id, p_mois, p_micro_chf, case when p_micro_chf > 0 then 1 else 0 end)
  on conflict (foyer_id, mois) do update set
    micro_chf = c.micro_chf + excluded.micro_chf,
    demandes = c.demandes + excluded.demandes
  returning c.micro_chf into total;
  return total;
end $$;

revoke all on function public.jarvis_compter(text, text, bigint) from public, anon, authenticated;
grant execute on function public.jarvis_compter(text, text, bigint) to service_role;

-- ===== L'agenda commun, relié à iCloud (Kora 0.0.18) =====
-- Chacun peut relier son compte iCloud avec un mot de passe d'app Apple. Le mot de passe va
-- dans le coffre du serveur (Vault) ; les téléphones ne le revoient jamais. La fonction
-- « agenda » (supabase/functions/agenda) tient dans chaque iCloud un calendrier « Kora ».
-- Mise en route : docs/agenda.md.

create table if not exists prive.comptes_icloud (
  foyer_id text not null references public.foyers (id) on delete cascade,
  membre_id text not null,
  apple_id text not null,
  -- Le mot de passe d'app, dans vault.secrets.
  secret_id uuid not null,
  -- Le dossier des calendriers du compte, et le calendrier « Kora » que Kora y a créé.
  maison text not null,
  calendrier_kora text not null,
  -- Les calendriers que la personne ne veut pas voir dans Kora (les autres sont lus).
  ignores text[] not null default '{}',
  -- Ce que Kora a écrit dans le calendrier « Kora » : [{evenementId, href, etag, empreinte}].
  liens jsonb not null default '[]',
  en_cours_depuis timestamptz,
  relie_le timestamptz not null default now(),
  primary key (foyer_id, membre_id)
);
revoke all on prive.comptes_icloud from public, anon, authenticated;

-- Relie (ou relie à nouveau) un compte. Fonction serveur seulement.
create or replace function public.icloud_enregistrer(
  p_foyer_id text, p_membre_id text, p_apple_id text, p_mot_de_passe text, p_maison text, p_calendrier_kora text
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  secret uuid;
begin
  select secret_id into secret from prive.comptes_icloud where foyer_id = p_foyer_id and membre_id = p_membre_id;
  if secret is null then
    secret := vault.create_secret(p_mot_de_passe, 'icloud-' || p_foyer_id || '-' || p_membre_id || '-' || gen_random_uuid(), 'Mot de passe d''app iCloud (Kora)');
  else
    perform vault.update_secret(secret, p_mot_de_passe);
  end if;
  insert into prive.comptes_icloud (foyer_id, membre_id, apple_id, secret_id, maison, calendrier_kora)
  values (p_foyer_id, p_membre_id, p_apple_id, secret, p_maison, p_calendrier_kora)
  on conflict (foyer_id, membre_id) do update set
    apple_id = excluded.apple_id, maison = excluded.maison, calendrier_kora = excluded.calendrier_kora,
    liens = case when prive.comptes_icloud.calendrier_kora = excluded.calendrier_kora then prive.comptes_icloud.liens else '[]'::jsonb end,
    relie_le = now();
end $$;

-- Les comptes reliés (d'un foyer, ou de tous), avec leur mot de passe. Fonction serveur seulement.
create or replace function public.icloud_comptes(p_foyer_id text default null)
returns table (foyer_id text, membre_id text, apple_id text, mot_de_passe text, maison text, calendrier_kora text, ignores text[], liens jsonb)
language sql security definer set search_path = '' as $$
  select c.foyer_id, c.membre_id, c.apple_id, s.decrypted_secret, c.maison, c.calendrier_kora, c.ignores, c.liens
  from prive.comptes_icloud c join vault.decrypted_secrets s on s.id = c.secret_id
  where p_foyer_id is null or c.foyer_id = p_foyer_id;
$$;

-- Après une synchro (ou un nouveau choix de calendriers). Un argument null garde la valeur.
create or replace function public.icloud_maj(p_foyer_id text, p_membre_id text, p_liens jsonb default null, p_ignores text[] default null, p_calendrier_kora text default null)
returns void
language sql security definer set search_path = '' as $$
  update prive.comptes_icloud set
    liens = coalesce(p_liens, liens),
    ignores = coalesce(p_ignores, ignores),
    calendrier_kora = coalesce(p_calendrier_kora, calendrier_kora)
  where foyer_id = p_foyer_id and membre_id = p_membre_id;
$$;

-- Une seule synchro à la fois par compte (le téléphone et le passage régulier peuvent se croiser).
create or replace function public.icloud_verrou(p_foyer_id text, p_membre_id text, p_prendre boolean)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not p_prendre then
    update prive.comptes_icloud set en_cours_depuis = null where foyer_id = p_foyer_id and membre_id = p_membre_id;
    return true;
  end if;
  update prive.comptes_icloud set en_cours_depuis = now()
  where foyer_id = p_foyer_id and membre_id = p_membre_id
    and (en_cours_depuis is null or en_cours_depuis < now() - interval '3 minutes');
  return found;
end $$;

-- Délier : le mot de passe quitte le coffre.
create or replace function public.icloud_retirer(p_foyer_id text, p_membre_id text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  -- Pas « secret » : c'est aussi le nom d'une colonne de vault.secrets.
  v_secret uuid;
begin
  delete from prive.comptes_icloud where foyer_id = p_foyer_id and membre_id = p_membre_id returning secret_id into v_secret;
  if v_secret is not null then
    delete from vault.secrets s where s.id = v_secret;
  end if;
end $$;

revoke all on function public.icloud_enregistrer(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.icloud_comptes(text) from public, anon, authenticated;
revoke all on function public.icloud_maj(text, text, jsonb, text[], text) from public, anon, authenticated;
revoke all on function public.icloud_verrou(text, text, boolean) from public, anon, authenticated;
revoke all on function public.icloud_retirer(text, text) from public, anon, authenticated;
grant execute on function public.icloud_enregistrer(text, text, text, text, text, text) to service_role;
grant execute on function public.icloud_comptes(text) to service_role;
grant execute on function public.icloud_maj(text, text, jsonb, text[], text) to service_role;
grant execute on function public.icloud_verrou(text, text, boolean) to service_role;
grant execute on function public.icloud_retirer(text, text) to service_role;

-- La synchro passe aussi toute seule, chaque quart d'heure. À lancer une fois :
--   select prive.programmer_agenda('https://<projet>.supabase.co');
create or replace function prive.programmer_agenda(p_adresse text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule(
    'agenda-icloud',
    '*/15 * * * *',
    format(
      $cmd$select net.http_post(url := %L, body := '{"mode": "passage"}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-cle-cron', (select cle_cron from prive.reglages_push)),
        timeout_milliseconds := 120000)$cmd$,
      p_adresse || '/functions/v1/agenda'
    )
  );
end $$;

revoke all on function prive.programmer_agenda(text) from public, anon, authenticated;

-- ===== Les paiements Apple Pay dans le budget (Kora 0.0.29) =====
-- L'automatisation « Transaction » de l'app Raccourcis envoie chaque paiement à la fonction
-- « paiements » avec un jeton propre à une personne. Le serveur ne garde que l'empreinte
-- (SHA-256) du jeton ; un nouveau lien remplace l'ancien. Voir docs/budget.md.

create table if not exists prive.jetons_paiement (
  foyer_id text not null references public.foyers (id) on delete cascade,
  membre_id text not null,
  empreinte text not null unique,
  cree_le timestamptz not null default now(),
  dernier_le timestamptz,
  primary key (foyer_id, membre_id)
);
revoke all on prive.jetons_paiement from public, anon, authenticated;

-- Crée ou remplace le jeton d'une personne ; une empreinte null l'efface. Fonction serveur seulement.
create or replace function public.paiements_jeton(p_foyer_id text, p_membre_id text, p_empreinte text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from prive.jetons_paiement where foyer_id = p_foyer_id and membre_id = p_membre_id;
  if p_empreinte is not null then
    insert into prive.jetons_paiement (foyer_id, membre_id, empreinte) values (p_foyer_id, p_membre_id, p_empreinte);
  end if;
end $$;

-- À qui appartient un jeton (et la date du dernier paiement reçu). Fonction serveur seulement.
create or replace function public.paiements_qui(p_empreinte text)
returns table (foyer_id text, membre_id text)
language sql security definer set search_path = '' as $$
  update prive.jetons_paiement set dernier_le = now() where empreinte = p_empreinte
  returning foyer_id, membre_id;
$$;

revoke all on function public.paiements_jeton(text, text, text) from public, anon, authenticated;
revoke all on function public.paiements_qui(text) from public, anon, authenticated;
grant execute on function public.paiements_jeton(text, text, text) to service_role;
grant execute on function public.paiements_qui(text) to service_role;

-- ===== Jarvis dans Siri (Kora 0.0.41) =====
-- Le raccourci « Dis Siri, Tael » envoie la phrase à la fonction « siri » avec un jeton propre à
-- une personne. Le serveur ne garde que l'empreinte (SHA-256) du jeton, le nom choisi pour
-- l'assistant et, quelques minutes, la suite de la conversation (question en attente, dernier
-- tour pour « annule »). Un nouveau lien remplace l'ancien. Voir docs/siri.md.

create table if not exists prive.jetons_siri (
  foyer_id text not null references public.foyers (id) on delete cascade,
  membre_id text not null,
  empreinte text not null unique,
  nom text not null default 'Jarvis',
  suite jsonb,
  cree_le timestamptz not null default now(),
  dernier_le timestamptz,
  primary key (foyer_id, membre_id)
);
revoke all on prive.jetons_siri from public, anon, authenticated;

-- Crée ou remplace le jeton d'une personne ; une empreinte null l'efface. Fonction serveur seulement.
create or replace function public.siri_jeton(p_foyer_id text, p_membre_id text, p_empreinte text, p_nom text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from prive.jetons_siri where foyer_id = p_foyer_id and membre_id = p_membre_id;
  if p_empreinte is not null then
    insert into prive.jetons_siri (foyer_id, membre_id, empreinte, nom) values (p_foyer_id, p_membre_id, p_empreinte, coalesce(p_nom, 'Jarvis'));
  end if;
end $$;

-- À qui appartient un jeton, avec son nom et la suite de la conversation. Fonction serveur seulement.
create or replace function public.siri_qui(p_empreinte text)
returns table (foyer_id text, membre_id text, nom text, suite jsonb)
language sql security definer set search_path = '' as $$
  update prive.jetons_siri set dernier_le = now() where empreinte = p_empreinte
  returning foyer_id, membre_id, nom, suite;
$$;

-- Garde la suite de la conversation d'une personne. Fonction serveur seulement.
create or replace function public.siri_suite(p_foyer_id text, p_membre_id text, p_suite jsonb)
returns void
language sql security definer set search_path = '' as $$
  update prive.jetons_siri set suite = p_suite where foyer_id = p_foyer_id and membre_id = p_membre_id;
$$;

revoke all on function public.siri_jeton(text, text, text, text) from public, anon, authenticated;
revoke all on function public.siri_qui(text) from public, anon, authenticated;
revoke all on function public.siri_suite(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.siri_jeton(text, text, text, text) to service_role;
grant execute on function public.siri_qui(text) to service_role;
grant execute on function public.siri_suite(text, text, jsonb) to service_role;

-- ===== Entretien du serveur (Kora 0.0.96) =====
-- Sauvegarde hebdomadaire de tous les documents (dimanche 3 h UTC, huit gardées), ménage quotidien
-- (documents supprimés depuis 90 jours, exécutions du passage régulier de plus de 7 jours).
create table if not exists prive.sauvegardes (
  id bigint generated always as identity primary key,
  foyer_id text not null,
  faite_le timestamptz not null default now(),
  nb_documents integer not null,
  contenu jsonb not null
);
create index if not exists sauvegardes_foyer on prive.sauvegardes (foyer_id, faite_le);
revoke all on prive.sauvegardes from public, anon, authenticated;

create or replace function prive.sauvegarder_foyers()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  f record;
begin
  for f in select id from public.foyers loop
    insert into prive.sauvegardes (foyer_id, nb_documents, contenu)
    select f.id, count(*), coalesce(jsonb_agg(jsonb_build_object('collection', d.collection, 'id', d.id, 'donnees', d.donnees, 'maj_client', d.maj_client)), '[]'::jsonb)
    from public.documents d where d.foyer_id = f.id and d.donnees is not null;
    delete from prive.sauvegardes s where s.foyer_id = f.id and s.id not in (
      select id from prive.sauvegardes where foyer_id = f.id order by faite_le desc limit 8
    );
  end loop;
end $$;
revoke all on function prive.sauvegarder_foyers() from public, anon, authenticated;

create or replace function prive.faire_le_menage()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.documents where donnees is null and maj_serveur < now() - interval '90 days';
  delete from cron.job_run_details where start_time < now() - interval '7 days';
end $$;
revoke all on function prive.faire_le_menage() from public, anon, authenticated;

-- À lancer une fois : select prive.programmer_entretien();
create or replace function prive.programmer_entretien()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule('sauvegarde-hebdomadaire', '0 3 * * 0', 'select prive.sauvegarder_foyers()');
  perform cron.schedule('menage-quotidien', '30 3 * * *', 'select prive.faire_le_menage()');
end $$;
revoke all on function prive.programmer_entretien() from public, anon, authenticated;
