-- Kora 0.1.15 : la porte du serveur. Créer un foyer est réservé aux téléphones déjà membres,
-- le code vient d'un hasard sûr, et retirer un téléphone coupe ses raccourcis et change le code.
-- Relançable sans risque.

-- Un code d'invitation libre : 6 caractères sans O, 0, I, L, 1 (le même alphabet que
-- src/domaine/synchro.ts), tirés d'un hasard sûr (gen_random_uuid) et non de random() (Kora 0.1.15).
create or replace function prive.nouveau_code()
returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  octets bytea;
  nouveau text;
begin
  loop
    octets := uuid_send(gen_random_uuid());
    nouveau := '';
    for i in 0..5 loop
      nouveau := nouveau || substr(alphabet, 1 + get_byte(octets, i) % length(alphabet), 1);
    end loop;
    exit when not exists (select 1 from public.foyers f where f.code = nouveau);
  end loop;
  return nouveau;
end $$;
revoke all on function prive.nouveau_code() from public, anon, authenticated;

-- Ouvrir le partage d'un foyer. Renvoie son code d'invitation. Relancé par un membre, renvoie le
-- même foyer. Le dépôt et la clé publique sont publics : depuis Kora 0.1.15, seul un téléphone déjà
-- membre d'un foyer de ce serveur en ouvre un autre (le tout premier foyer d'un serveur neuf
-- s'ouvre librement). Les autres rejoignent avec un code.
create or replace function public.creer_foyer(p_id text, p_nom text)
returns table (id text, nom text, code text)
language plpgsql security definer set search_path = public, prive as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if exists (select 1 from foyers f where f.id = p_id) then
    if not est_membre(p_id) then
      raise exception 'Ce foyer appartient à un autre compte';
    end if;
  else
    if exists (select 1 from foyers) and not exists (select 1 from membres_foyer m where m.user_id = auth.uid()) then
      raise exception 'Serveur réservé à son foyer';
    end if;
    insert into foyers (id, nom, code) values (p_id, p_nom, nouveau_code());
    insert into membres_foyer (foyer_id, user_id) values (p_id, auth.uid());
  end if;
  return query select f.id, f.nom, f.code from foyers f where f.id = p_id;
end $$;

-- Retirer un autre téléphone du foyer : sa place se libère, ses rappels s'arrêtent, ses raccourcis
-- Siri et Apple Pay sont coupés (déclencheur couper_raccourcis, plus bas) et le code du foyer
-- change, pour qu'il ne puisse pas rentrer avec l'ancien (Kora 0.1.15).
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
  if found then
    update foyers set code = nouveau_code() where id = p_foyer_id;
  end if;
end $$;

-- Un nouveau code pour rejoindre le foyer.
create or replace function public.nouveau_code_foyer(p_foyer_id text)
returns text
language plpgsql security definer set search_path = public, prive as $$
declare
  nouveau text;
begin
  if not est_membre(p_foyer_id) then
    raise exception 'Ce foyer appartient à un autre compte';
  end if;
  nouveau := nouveau_code();
  update foyers set code = nouveau where id = p_foyer_id;
  return nouveau;
end $$;

-- ===== Les raccourcis suivent leur téléphone (Kora 0.1.15) =====
-- Une clé Siri ou Apple Pay est celle d'une personne, créée depuis un téléphone. Ce téléphone la
-- signe (lier_raccourcis, appelé par l'app après avoir créé le lien, et à l'ouverture tant qu'il
-- garde le lien) ; quand il quitte le foyer ou qu'on l'en retire, ses clés sont effacées.
alter table prive.jetons_siri add column if not exists user_id uuid;
alter table prive.jetons_paiement add column if not exists user_id uuid;

create or replace function public.lier_raccourcis(p_foyer_id text, p_membre_id text, p_siri boolean, p_paiements boolean)
returns void
language plpgsql security definer set search_path = public, prive as $$
begin
  if not est_membre(p_foyer_id) then
    raise exception 'Ce foyer appartient à un autre compte';
  end if;
  if p_siri then
    update jetons_siri set user_id = auth.uid() where foyer_id = p_foyer_id and membre_id = p_membre_id and user_id is null;
  end if;
  if p_paiements then
    update jetons_paiement set user_id = auth.uid() where foyer_id = p_foyer_id and membre_id = p_membre_id and user_id is null;
  end if;
end $$;
revoke all on function public.lier_raccourcis(text, text, boolean, boolean) from public, anon;
grant execute on function public.lier_raccourcis(text, text, boolean, boolean) to authenticated;

create or replace function prive.couper_raccourcis()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from prive.jetons_siri where foyer_id = old.foyer_id and user_id = old.user_id;
  delete from prive.jetons_paiement where foyer_id = old.foyer_id and user_id = old.user_id;
  return old;
end $$;
revoke all on function prive.couper_raccourcis() from public, anon, authenticated;

drop trigger if exists couper_raccourcis on public.membres_foyer;
create trigger couper_raccourcis after delete on public.membres_foyer
  for each row execute function prive.couper_raccourcis();
