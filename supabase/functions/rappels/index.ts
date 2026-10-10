// KoraHome : la fonction qui envoie les rappels du matin (Supabase Edge Function, Deno).
//
// - Chaque heure, le serveur l'appelle (pg_cron, voir supabase/schema.sql) avec sa clé
//   « x-cle-cron » : chaque téléphone abonné reçoit son rappel de 8 h, une fois par jour.
// - Un téléphone l'appelle avec sa session pour lire la clé publique d'envoi (« cle »)
//   ou recevoir tout de suite un rappel d'essai (« essai »).
//
// Les règles (quoi rappeler, à quelle heure) viennent de src/domaine/rappels.ts, copié
// dans domaine.js par `npm run fonction`. Déploiement : docs/notifications.md.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { FUSEAU_DU_FOYER, jourEtHeure, PREFERENCES_DE_DEPART, rappelDu, rappelDuMatin } from "./domaine.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const serveur = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

interface Abonnement {
  endpoint: string;
  foyer_id: string;
  user_id: string;
  membre_id: string | null;
  cles: { p256dh: string; auth: string };
  preferences: { taches?: boolean; mitsu?: boolean };
  heure: number;
  dernier_envoi: string | null;
}

function repondre(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function echec<T>(requete: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await requete;
  if (error) throw new Error(error.message);
  return data;
}

/** Les clés d'envoi, créées au tout premier passage. */
async function reglages(): Promise<{ publique: string; privee: string; cleCron: string }> {
  let [r] = await echec(serveur.rpc("reglages_push"));
  if (!r.vapid_publique) {
    const cles = webpush.generateVAPIDKeys();
    [r] = await echec(serveur.rpc("reglages_push", { p_publique: cles.publicKey, p_privee: cles.privateKey }));
  }
  return { publique: r.vapid_publique, privee: r.vapid_privee, cleCron: r.cle_cron };
}

/** Le foyer, ses tâches et ses animaux, tels que les téléphones les ont partagés. */
async function donneesDuFoyer(foyerId: string) {
  const lignes = await echec(
    serveur.from("documents").select("collection, donnees").eq("foyer_id", foyerId).in("collection", ["foyer", "taches", "animaux"]).not("donnees", "is", null),
  );
  const de = (c: string) => (lignes as { collection: string; donnees: any }[]).filter((l) => l.collection === c).map((l) => l.donnees);
  return { foyer: de("foyer")[0] ?? null, taches: de("taches"), animaux: de("animaux") };
}

function rappelPour(a: Abonnement, donnees: Awaited<ReturnType<typeof donneesDuFoyer>>, aujourdhui: string) {
  return rappelDuMatin({
    ...donnees,
    membreId: a.membre_id,
    aujourdhui,
    preferences: { ...PREFERENCES_DE_DEPART, ...a.preferences },
  });
}

/** Envoie ; un téléphone qui a retiré l'autorisation (404, 410) est oublié. */
async function envoyer(a: Abonnement, message: { titre: string; corps: string; nombre: number }, cles: { publique: string; privee: string }) {
  try {
    await webpush.sendNotification(
      { endpoint: a.endpoint, keys: a.cles },
      JSON.stringify({ ...message, url: "/" }),
      { vapidDetails: { subject: "https://korahome-cassa.netlify.app", publicKey: cles.publique, privateKey: cles.privee }, TTL: 4 * 3600, urgency: "normal" },
    );
    return "envoye";
  } catch (e) {
    const statut = (e as { statusCode?: number }).statusCode;
    if (statut === 404 || statut === 410) {
      await echec(serveur.from("abonnements_push").delete().eq("endpoint", a.endpoint));
      return "oublie";
    }
    console.error("Envoi impossible", statut, (e as Error).message);
    return "erreur";
  }
}

async function passageDuMatin(cles: { publique: string; privee: string }) {
  const maintenant = new Date();
  const abonnements = (await echec(serveur.from("abonnements_push").select("*"))) as Abonnement[];
  const parFoyer = new Map<string, Promise<Awaited<ReturnType<typeof donneesDuFoyer>>>>();
  const bilan: Record<string, number> = {};
  for (const a of abonnements) {
    const jour = rappelDu(maintenant, a.heure, a.dernier_envoi, FUSEAU_DU_FOYER);
    if (!jour) continue;
    if (!parFoyer.has(a.foyer_id)) parFoyer.set(a.foyer_id, donneesDuFoyer(a.foyer_id));
    const message = rappelPour(a, await parFoyer.get(a.foyer_id)!, jour);
    const resultat = message ? await envoyer(a, message, cles) : "rien";
    // Une seule tentative par jour, même sans rien à dire : pas de rappel l'après-midi.
    if (resultat !== "oublie") await echec(serveur.from("abonnements_push").update({ dernier_envoi: jour }).eq("endpoint", a.endpoint));
    bilan[resultat] = (bilan[resultat] ?? 0) + 1;
  }
  return bilan;
}

async function essai(utilisateur: string, endpoint: string, cles: { publique: string; privee: string }) {
  const [a] = (await echec(serveur.from("abonnements_push").select("*").eq("endpoint", endpoint).eq("user_id", utilisateur))) as Abonnement[];
  if (!a) return repondre({ erreur: "Ce téléphone n'est pas inscrit aux rappels." }, 404);
  const { jour } = jourEtHeure(new Date(), FUSEAU_DU_FOYER);
  const message = rappelPour(a, await donneesDuFoyer(a.foyer_id), jour) ?? {
    titre: "Tout est en ordre",
    corps: `Rien à faire aujourd'hui. Les rappels arriveront ici chaque matin à ${a.heure} h.`,
    nombre: 0,
  };
  const resultat = await envoyer(a, message, cles);
  return resultat === "envoye" ? repondre({ ok: true }) : repondre({ erreur: "L'envoi a échoué. Réactive les rappels sur ce téléphone." }, 502);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const corps = await req.json().catch(() => ({}));
    const cles = await reglages();

    const cleCron = req.headers.get("x-cle-cron");
    if (cleCron) {
      if (cleCron !== cles.cleCron) return repondre({ erreur: "Clé inconnue" }, 401);
      return repondre(await passageDuMatin(cles));
    }

    if (corps.mode === "cle") return repondre({ cle: cles.publique });

    const jeton = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
    const { data } = await serveur.auth.getUser(jeton);
    if (!data.user) return repondre({ erreur: "Connexion requise" }, 401);
    if (corps.mode === "essai" && typeof corps.endpoint === "string") return await essai(data.user.id, corps.endpoint, cles);
    return repondre({ erreur: "Demande inconnue" }, 400);
  } catch (e) {
    console.error(e);
    return repondre({ erreur: (e as Error).message }, 500);
  }
});
