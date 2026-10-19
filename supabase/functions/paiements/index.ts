// KoraHome : les paiements Apple Pay qui arrivent seuls dans le budget (Supabase Edge Function, Deno).
//
// - Un téléphone l'appelle avec sa session (« lien ») : le serveur crée un jeton pour cette
//   personne, garde seulement son empreinte (prive.jetons_paiement) et renvoie l'adresse à coller
//   une fois dans l'automatisation « Transaction » de l'app Raccourcis. Un nouveau lien remplace
//   l'ancien ; « retirer » l'efface.
// - L'automatisation l'appelle à chaque paiement Apple Pay, avec le jeton dans l'adresse et
//   { montant, marchand, carte } : les règles (src/domaine/paiements.ts) en font une dépense du
//   pot de la carte, ou un paiement à classer d'un toucher dans Kora. Rien d'autre n'est lu ni
//   écrit que la collection « budget » du foyer du jeton.
//
// Les règles viennent de src/domaine/paiements.ts, copié dans domaine.js par `npm run fonction`.
// Déploiement : docs/budget.md (sans vérification du JWT : le raccourci n'a pas de session).

import { createClient } from "npm:@supabase/supabase-js@2";
import { recevoirPaiement } from "./domaine.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const serveur = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function repondre(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function echec<T>(requete: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await requete;
  if (error) throw new Error(error.message);
  return data;
}

async function empreinte(jeton: string): Promise<string> {
  const octets = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jeton)));
  return [...octets].map((o) => o.toString(16).padStart(2, "0")).join("");
}

function nouveauJeton(): string {
  const octets = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...octets)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Le jour à Renens (Europe/Zurich), « AAAA-MM-JJ ». */
const aujourdhui = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());

const ctx = { maintenant: () => new Date().toISOString(), nouvelId: () => crypto.randomUUID() };

/** Un paiement envoyé par le raccourci. */
async function recevoir(jeton: string, corps: Record<string, unknown>) {
  const [qui] = (await echec(serveur.rpc("paiements_qui", { p_empreinte: await empreinte(jeton) }))) as { foyer_id: string; membre_id: string }[];
  if (!qui) return repondre({ erreur: "Lien inconnu : crée un nouveau lien dans Kora." }, 401);
  const lignes = (await echec(
    serveur.from("documents").select("donnees").eq("foyer_id", qui.foyer_id).eq("collection", "budget").not("donnees", "is", null),
  )) as { donnees: any }[];
  const reception = recevoirPaiement({ montant: corps.montant, marchand: corps.marchand, carte: corps.carte }, lignes.map((l) => l.donnees), qui.membre_id, aujourdhui(), ctx);
  if (reception.genre === "depense" || reception.genre === "paiement") {
    await echec(
      serveur.from("documents").upsert({ foyer_id: qui.foyer_id, collection: "budget", id: reception.doc.id, donnees: reception.doc, maj_client: new Date().toISOString() }, { onConflict: "foyer_id,collection,id" }),
    );
  }
  return repondre({ resultat: reception.genre, message: reception.message }, reception.genre === "refuse" ? 422 : 200);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const texte = await req.text();
    if (texte.length > 4000) return repondre({ erreur: "Trop long" }, 413);
    let corps: Record<string, unknown> = {};
    try {
      corps = texte ? JSON.parse(texte) : {};
    } catch {
      return repondre({ erreur: "Le raccourci doit envoyer du JSON" }, 400);
    }

    const jeton = new URL(req.url).searchParams.get("j") ?? (typeof corps.jeton === "string" ? corps.jeton : "");
    if (jeton) return await recevoir(jeton.slice(0, 100), corps);

    const session = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
    const { data } = await serveur.auth.getUser(session);
    if (!data.user) return repondre({ erreur: "Connexion requise" }, 401);
    const foyerId = typeof corps.foyerId === "string" ? corps.foyerId.slice(0, 100) : "";
    const membreId = typeof corps.membreId === "string" ? corps.membreId.slice(0, 100) : "";
    if (!foyerId || !membreId) return repondre({ erreur: "Demande inconnue" }, 400);
    const { data: membre } = await serveur.from("membres_foyer").select("user_id").eq("foyer_id", foyerId).eq("user_id", data.user.id).maybeSingle();
    if (!membre) return repondre({ erreur: "Ce foyer appartient à un autre compte" }, 403);

    if (corps.mode === "lien") {
      const nouveau = nouveauJeton();
      await echec(serveur.rpc("paiements_jeton", { p_foyer_id: foyerId, p_membre_id: membreId, p_empreinte: await empreinte(nouveau) }));
      return repondre({ jeton: nouveau });
    }
    if (corps.mode === "retirer") {
      await echec(serveur.rpc("paiements_jeton", { p_foyer_id: foyerId, p_membre_id: membreId, p_empreinte: null }));
      return repondre({ retire: true });
    }
    return repondre({ erreur: "Demande inconnue" }, 400);
  } catch (e) {
    console.error(e);
    return repondre({ erreur: (e as Error).message }, 500);
  }
});
