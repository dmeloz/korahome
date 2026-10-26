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

import { aujourdhui, ctx } from "../_shared/contexte.ts";
import { messageErreur, preflight, repondre } from "../_shared/http.ts";
import { empreinte, nouveauJeton } from "../_shared/jetons.ts";
import { echec, estMembre, serveur, utilisateur } from "../_shared/supabase.ts";
import { recevoirPaiement } from "./domaine.js";

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
  const options = preflight(req);
  if (options) return options;
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

    const user = await utilisateur(req);
    if (!user) return repondre({ erreur: "Connexion requise" }, 401);
    const foyerId = typeof corps.foyerId === "string" ? corps.foyerId.slice(0, 100) : "";
    const membreId = typeof corps.membreId === "string" ? corps.membreId.slice(0, 100) : "";
    if (!foyerId || !membreId) return repondre({ erreur: "Demande inconnue" }, 400);
    if (!(await estMembre(foyerId, user.id))) return repondre({ erreur: "Ce foyer appartient à un autre compte" }, 403);

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
    return repondre({ erreur: messageErreur(e) }, 500);
  }
});
