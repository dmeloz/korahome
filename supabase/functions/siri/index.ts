// KoraHome : Jarvis dans Siri (Supabase Edge Function, Deno).
//
// - Un téléphone l'appelle avec sa session (« lien ») : le serveur crée un jeton pour cette
//   personne, garde seulement son empreinte (prive.jetons_siri) et le nom choisi pour l'assistant
//   (Tael, Navi…), puis renvoie l'adresse à coller une fois dans le raccourci « Dis Siri, Tael ».
//   Un nouveau lien remplace l'ancien ; « retirer » l'efface.
// - Le raccourci l'appelle avec le jeton dans l'adresse et { demande } : le serveur lit le foyer,
//   interroge Jarvis (mêmes consignes et outils que dans l'app, plafond de 5 CHF par mois commun),
//   écrit lui-même ses actions dans les documents du foyer et renvoie la phrase que Siri dit,
//   en texte simple. Ce qui supprime attend un « oui » au tour suivant ; « annule » défait le
//   dernier tour. Rien d'autre n'est lu ni écrit que les documents du foyer du jeton.
//
// Les règles viennent de src/domaine/siri.ts, copié dans domaine.js par `npm run fonction`.
// Déploiement : docs/siri.md (sans vérification du JWT : le raccourci n'a pas de session).

import Anthropic from "npm:@anthropic-ai/sdk";
import { aujourdhui, ctx } from "../_shared/contexte.ts";
import { avecAlerte, PanneSignalee } from "../_shared/alerte.ts";
import { CORS, limiteDuCompte, preflight, repondre } from "../_shared/http.ts";
import { empreinte, nouveauJeton } from "../_shared/jetons.ts";
import { echec, estMembre, serveur, utilisateur } from "../_shared/supabase.ts";
import {
  COLLECTIONS_SIRI,
  confirmer,
  CONSIGNES_JARVIS,
  consignesSiri,
  coutMicroChf,
  decrireFoyer,
  donneesDepuisDocuments,
  etatBudget,
  formaterChf,
  lignesAEcrire,
  lignesAnnulation,
  messageDemande,
  MODELE_JARVIS,
  moisDe,
  nomAssistant,
  noteServeur,
  OUTILS_JARVIS,
  reponseCourte,
  suiteRecente,
  tourSiri,
} from "./domaine.js";

/** Siri dit ce texte tel quel : le raccourci n'a rien à extraire. */
function dire(phrase: string, statut = 200): Response {
  return new Response(phrase, { status: statut, headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });
}

/** Ajoute une dépense au compteur de Jarvis et renvoie le total du mois (0 : simple lecture). */
async function compter(foyerId: string, microChf: number): Promise<number> {
  return Number(await echec(serveur.rpc("jarvis_compter", { p_foyer_id: foyerId, p_mois: moisDe(aujourdhui()), p_micro_chf: microChf })));
}

async function ecrire(foyerId: string, lignes: { collection: string; id: string; donnees: unknown }[]) {
  if (!lignes.length) return;
  const maj = new Date().toISOString();
  await echec(
    serveur.from("documents").upsert(
      lignes.map((l) => ({ foyer_id: foyerId, collection: l.collection, id: l.id, donnees: l.donnees, maj_client: maj })),
      { onConflict: "foyer_id,collection,id" },
    ),
  );
}

/** Une demande dite à Siri. */
async function ecouter(jeton: string, corps: Record<string, unknown>): Promise<Response> {
  const [qui] = (await echec(serveur.rpc("siri_qui", { p_empreinte: await empreinte(jeton) }))) as { foyer_id: string; membre_id: string; nom: string; suite: unknown }[];
  if (!qui) return dire("Ce raccourci n'est plus relié à Kora. Crée un nouveau lien dans Kora, Réglages, Siri.", 401);
  const demande = (typeof corps.demande === "string" ? corps.demande : "").slice(0, 1000).trim();
  if (!demande) return dire("Je n'ai rien entendu.");

  const cle = Deno.env.get("ANTHROPIC_API_KEY");
  if (!cle) return dire("Je ne suis pas encore branché : ma clé manque sur le serveur.", 503);

  const lignes = (await echec(
    serveur.from("documents").select("collection, donnees").eq("foyer_id", qui.foyer_id).in("collection", [...COLLECTIONS_SIRI]).not("donnees", "is", null),
  )) as { collection: string; donnees: unknown }[];
  const donnees = donneesDepuisDocuments(lignes);
  if (!donnees) return dire("Je ne trouve pas votre foyer sur le serveur.", 404);

  const jour = aujourdhui();
  const nom = nomAssistant(qui.nom);
  const suite = suiteRecente(qui.suite, ctx.maintenant());
  const garder = (s: unknown) => echec(serveur.rpc("siri_suite", { p_foyer_id: qui.foyer_id, p_membre_id: qui.membre_id, p_suite: s }));

  // Un mot seul répond à la question d'avant, ou défait le dernier tour : sans passer par le modèle.
  const courte = reponseCourte(demande);
  if (suite?.attente && (courte === "oui" || courte === "non" || courte === "annule")) {
    if (courte !== "oui") {
      await garder({ ...suite, attente: null, le: ctx.maintenant() });
      return dire("D'accord, je n'y touche pas.");
    }
    const fait = confirmer(suite.attente, donnees, qui.membre_id, jour, ctx);
    await ecrire(qui.foyer_id, lignesAEcrire(fait.modifications));
    await garder({ attente: null, modifications: fait.modifications, tours: [...suite.tours, { role: "personne", texte: demande }, { role: "jarvis", texte: fait.dit }], le: ctx.maintenant() });
    return dire(fait.dit);
  }
  if (courte === "annule") {
    if (!suite?.modifications.length) return dire("Je n'ai rien fait à annuler ces dernières minutes.");
    await ecrire(qui.foyer_id, lignesAnnulation(suite.modifications));
    await garder({ attente: null, modifications: [], tours: [], le: ctx.maintenant() });
    return dire("C'est annulé, tout est comme avant.");
  }

  const avant = etatBudget(await compter(qui.foyer_id, 0));
  if (avant.atteint) return dire(`J'ai atteint le plafond de ${formaterChf(avant.plafondChf)} ce mois-ci. Je reviens le 1er du mois prochain.`);

  const client = new Anthropic({ apiKey: cle });
  const reponse = await avecAlerte(qui.foyer_id, "Siri", noteServeur, () => client.messages.create({
    model: MODELE_JARVIS,
    max_tokens: 2000,
    system: consignesSiri(CONSIGNES_JARVIS, nom),
    tools: OUTILS_JARVIS,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: messageDemande(decrireFoyer(donnees, qui.membre_id, jour).slice(0, 20000), demande, suite?.tours ?? []) }],
  }));
  await compter(qui.foyer_id, coutMicroChf(reponse.usage, MODELE_JARVIS));
  if (reponse.stop_reason === "refusal") return dire("Je ne peux pas t'aider pour ça.");

  const textes: string[] = [];
  const appels: { nom: string; entree: unknown }[] = [];
  for (const bloc of reponse.content) {
    if (bloc.type === "text") textes.push(bloc.text);
    else if (bloc.type === "tool_use") appels.push({ nom: bloc.name, entree: bloc.input });
  }
  const tour = tourSiri(textes.join(" ").trim(), appels, donnees, qui.membre_id, jour, ctx);
  await ecrire(qui.foyer_id, lignesAEcrire(tour.modifications));
  await garder({
    attente: tour.attente,
    modifications: tour.modifications,
    tours: [...(suite?.tours ?? []), { role: "personne", texte: demande }, { role: "jarvis", texte: tour.dit }],
    le: ctx.maintenant(),
  });
  return dire(tour.dit);
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  try {
    const texte = await req.text();
    if (texte.length > 4000) return dire("C'est trop long pour moi.", 413);
    let corps: Record<string, unknown> = {};
    try {
      corps = texte ? JSON.parse(texte) : {};
    } catch {
      // Un raccourci qui envoie la phrase en texte simple marche aussi.
      corps = { demande: texte };
    }

    const jeton = new URL(req.url).searchParams.get("j") ?? (typeof corps.jeton === "string" ? corps.jeton : "");
    if (jeton) return await ecouter(jeton.slice(0, 100), corps);

    const user = await utilisateur(req);
    if (!user) return repondre({ erreur: "Connexion requise" }, 401);
    const foyerId = typeof corps.foyerId === "string" ? corps.foyerId.slice(0, 100) : "";
    const membreId = typeof corps.membreId === "string" ? corps.membreId.slice(0, 100) : "";
    if (!foyerId || !membreId) return repondre({ erreur: "Demande inconnue" }, 400);
    if (!(await estMembre(foyerId, user.id))) return repondre({ erreur: "Ce foyer appartient à un autre compte" }, 403);

    if (corps.mode === "lien") {
      const nouveau = nouveauJeton();
      await echec(serveur.rpc("siri_jeton", { p_foyer_id: foyerId, p_membre_id: membreId, p_empreinte: await empreinte(nouveau), p_nom: nomAssistant(corps.nom) }));
      return repondre({ jeton: nouveau });
    }
    if (corps.mode === "retirer") {
      await echec(serveur.rpc("siri_jeton", { p_foyer_id: foyerId, p_membre_id: membreId, p_empreinte: null, p_nom: null }));
      return repondre({ retire: true });
    }
    return repondre({ erreur: "Demande inconnue" }, 400);
  } catch (e) {
    console.error(e);
    const limite = limiteDuCompte(e, "Ta fée");
    if (limite) return dire(limite, 503);
    if (e instanceof PanneSignalee) return dire("J'ai un souci de mon côté. Claude est prévenu ; réessaie un peu plus tard.", 502);
    if (e instanceof Anthropic.RateLimitError) return dire("Je suis très demandé, réessaie dans un instant.", 429);
    if (e instanceof Anthropic.APIError) return dire("Je ne réponds pas pour l'instant, réessaie.", 502);
    return dire("Quelque chose a coincé, réessaie dans Kora.", 500);
  }
});
