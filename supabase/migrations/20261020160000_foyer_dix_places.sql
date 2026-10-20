-- Un foyer passe de 6 à 10 comptes, et libère seul les places des anciennes installations
-- (aucune activité depuis 30 jours) quand il est plein. Appliqué le 20 octobre 2026.

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
