-- Kora 0.0.85 : l'essai du matin de la fée. Chaque jour à 5 h 17 UTC (6 h 17 ou 7 h 17 à Renens),
-- le passage régulier appelle la fonction « jarvis » avec la clé du passage : elle pose une question
-- minuscule à Claude avec les vrais outils, et écrit la note « Bug serveur » dans chaque foyer
-- inscrit si Claude refuse. Peut être relancé sans risque.

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
