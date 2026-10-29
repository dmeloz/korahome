-- Kora 0.0.96 : l'entretien du serveur, suites invisibles de l'audit du 29 octobre 2026.
-- Peut être relancé sans risque.
--
-- 1. L'horloge des conflits est bornée : un téléphone dont l'heure avance ne gagne plus tous les
--    conflits ; une modification datée de plus de 5 minutes dans le futur prend l'heure du serveur.
-- 2. Une sauvegarde hebdomadaire de tous les documents (dimanche 3 h UTC), huit semaines gardées,
--    dans prive.sauvegardes : le filet derrière une fausse manipulation ou une migration ratée.
-- 3. Ménage : les documents supprimés depuis plus de 90 jours (lignes vides gardées pour prévenir
--    les téléphones) et les exécutions du passage régulier de plus de 7 jours.
-- 4. Le passage des rappels ne tourne plus la nuit (les rappels vont de 5 h à 22 h 59 à Zurich) :
--    chaque minute entre 3 h et 22 h 59 UTC au lieu de 1 440 appels par jour.

-- ===== 1. Horloge bornée =====
create or replace function public.documents_plus_recent()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.maj_client < old.maj_client then
    return null;
  end if;
  if new.maj_client > clock_timestamp() + interval '5 minutes' then
    new.maj_client := clock_timestamp();
  end if;
  new.maj_serveur := clock_timestamp();
  return new;
end $$;

-- ===== 2. Sauvegarde hebdomadaire =====
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

-- ===== 3. Ménage =====
create or replace function prive.faire_le_menage()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.documents where donnees is null and maj_serveur < now() - interval '90 days';
  delete from cron.job_run_details where start_time < now() - interval '7 days';
end $$;
revoke all on function prive.faire_le_menage() from public, anon, authenticated;

-- ===== 4. Les passages réguliers =====
-- À lancer une fois : select prive.programmer_entretien();
create or replace function prive.programmer_entretien()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule('sauvegarde-hebdomadaire', '0 3 * * 0', 'select prive.sauvegarder_foyers()');
  perform cron.schedule('menage-quotidien', '30 3 * * *', 'select prive.faire_le_menage()');
end $$;
revoke all on function prive.programmer_entretien() from public, anon, authenticated;

create or replace function prive.programmer_rappels(p_adresse text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform cron.schedule(
    'rappels-du-matin',
    '* 3-22 * * *',
    format(
      $cmd$select net.http_post(url := %L, body := '{"mode": "matin"}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-cle-cron', (select cle_cron from prive.reglages_push)))$cmd$,
      p_adresse || '/functions/v1/rappels'
    )
  );
end $$;
