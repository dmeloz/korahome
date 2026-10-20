// Code commun des fonctions serveur : le client Supabase du serveur (clé de service) et les
// vérifications de l'appelant (session du téléphone, membre du foyer, clé du passage pg_cron).

import { createClient } from "npm:@supabase/supabase-js@2";

export const serveur = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

/** Les données d'une requête Supabase, ou une erreur avec son message. */
export async function echec<T>(requete: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await requete;
  if (error) throw new Error(error.message);
  return data;
}

/** La personne connectée qui appelle (session dans l'en-tête Authorization), ou null. */
export async function utilisateur(req: Request) {
  const jeton = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const { data } = await serveur.auth.getUser(jeton);
  return data.user;
}

/** Vrai si ce compte est membre du foyer. */
export async function estMembre(foyerId: string, userId: string): Promise<boolean> {
  const { data: membre } = await serveur.from("membres_foyer").select("user_id").eq("foyer_id", foyerId).eq("user_id", userId).maybeSingle();
  return !!membre;
}

/** Vrai si la clé « x-cle-cron » est celle du passage régulier (pg_cron). */
export async function cleCronValide(cleCron: string): Promise<boolean> {
  const [r] = await echec(serveur.rpc("reglages_push"));
  return !!r?.cle_cron && cleCron === r.cle_cron;
}
