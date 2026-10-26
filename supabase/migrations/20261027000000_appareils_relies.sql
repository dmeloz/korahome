-- Kora 0.0.82 : les téléphones reliés au foyer (Réglages › Partage). Peut être relancé sans risque.
-- Chaque installation de Kora est un compte (souvent anonyme) membre du foyer. Depuis la veille du
-- 26 octobre 2026, un membre voit la liste de ces téléphones, en retire un (place libérée tout de
-- suite, ses rappels coupés) et peut changer le code du foyer (l'ancien ne permet plus d'entrer ;
-- les téléphones déjà reliés le restent).

alter table public.membres_foyer add column if not exists nom text;
alter table public.membres_foyer add column if not exists vu_le timestamptz;

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
