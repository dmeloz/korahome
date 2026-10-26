-- Kora 0.0.81 (veille du 26 octobre 2026) : deux garde-fous trouvés par la revue de sécurité.
-- Peut être relancé sans risque.

-- 1. L'assistant (Jarvis, le Chef, Siri) est réservé aux foyers inscrits ici. Le dépôt est public
--    et la connexion anonyme ouverte : sans cette liste, n'importe qui pouvait créer un foyer et
--    dépenser jusqu'à 5 CHF de crédit Claude par foyer créé. Un foyer absent voit « plafond
--    atteint » avant tout appel au modèle. Pour en ajouter un : insert into prive.foyers_assistant.
create table if not exists prive.foyers_assistant (
  foyer_id text primary key references public.foyers (id) on delete cascade,
  ajoute_le timestamptz not null default now()
);
revoke all on prive.foyers_assistant from public, anon, authenticated;
insert into prive.foyers_assistant (foyer_id)
  select id from public.foyers where nom = 'Cassa'
  on conflict do nothing;

create or replace function public.jarvis_compter(p_foyer_id text, p_mois text, p_micro_chf bigint)
returns bigint
language plpgsql security definer set search_path = prive as $$
declare
  total bigint;
begin
  if not exists (select 1 from foyers_assistant a where a.foyer_id = p_foyer_id) then
    return 1000000000; -- 1000 CHF : bien au-delà du plafond, l'assistant refuse sans appeler Claude.
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

-- 2. Les notifications ne partent que vers les services de notification connus (Apple, Google,
--    Mozilla, Microsoft) : sans cela, un compte pouvait faire envoyer des requêtes par le serveur
--    à l'adresse de son choix.
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
  if p_endpoint !~ '^https://([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)/' then
    raise exception 'Adresse de notification inconnue';
  end if;
  insert into abonnements_push (endpoint, foyer_id, user_id, membre_id, cles, preferences, heure)
  values (p_endpoint, p_foyer_id, auth.uid(), p_membre_id, p_cles, p_preferences, p_heure)
  on conflict (endpoint) do update set
    foyer_id = excluded.foyer_id, user_id = excluded.user_id, membre_id = excluded.membre_id,
    cles = excluded.cles, preferences = excluded.preferences, heure = excluded.heure;
end $$;
