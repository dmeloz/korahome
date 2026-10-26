// KoraHome : Jarvis, l'assistant du foyer (Supabase Edge Function, Deno).
//
// Le téléphone envoie la demande, avec l'état du foyer qu'il a préparé et les derniers
// échanges. La fonction vérifie que la personne est membre du foyer et que le plafond du
// mois (5 CHF) n'est pas atteint, interroge Claude, compte la dépense, puis renvoie la
// réponse et les actions demandées. C'est le téléphone qui les applique (avec Annuler).
// Il lit aussi une photo jointe (lettre, rendez-vous), la recette derrière un lien, et prépare
// le conseil du dimanche (mode « conseil », modèle plus réfléchi, proposition validée ensemble)
// et répond au conseiller du Budget (mode « budget » : texte, tableau et conseils, par l'outil repondre_budget).
//
// La clé de l'API Claude reste ici, dans le secret ANTHROPIC_API_KEY : jamais dans l'app.
// Les consignes et les outils viennent de src/domaine/jarvisModele.ts, copié dans domaine.js par
// `npm run fonction`. Déploiement : docs/jarvis.md.

import Anthropic from "npm:@anthropic-ai/sdk";
import { avecAlerte, PanneSignalee, signalerPanne } from "../_shared/alerte.ts";
import { limiteDuCompte, messageErreur, preflight, repondre } from "../_shared/http.ts";
import { cleCronValide, estMembre, serveur, utilisateur } from "../_shared/supabase.ts";
import {
  CONSIGNES_BUDGET,
  CONSIGNES_CONSEIL,
  CONSIGNES_JARVIS,
  coutMicroChf,
  etatBudget,
  formaterChf,
  lienAutorise,
  lienDans,
  lirePage,
  messageDemande,
  MODELE_CONSEIL,
  MODELE_JARVIS,
  moisDe,
  noteServeur,
  OUTIL_BUDGET,
  OUTILS_JARVIS,
  phrasePanne,
} from "./domaine.js";

/** Le mois en cours à Zurich, « AAAA-MM ». */
function moisCourant(): string {
  return moisDe(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(new Date()));
}

/** Ajoute une dépense au compteur du foyer et renvoie le total du mois (0 : simple lecture). */
async function compter(foyerId: string, microChf: number): Promise<number> {
  const { data, error } = await serveur.rpc("jarvis_compter", { p_foyer_id: foyerId, p_mois: moisCourant(), p_micro_chf: microChf });
  if (error) throw new Error(error.message);
  return Number(data);
}

const texte = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

const TAILLE_PAGE_MAX = 1_500_000;
const TAILLE_IMAGE_MAX = 4_000_000; // en base64, environ 3 Mo d'image ou de PDF
const IMAGES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Ouvre le lien d'une recette (https public seulement, 3 redirections, 8 secondes, 1,5 Mo). */
async function ouvrirLien(adresse: string): Promise<string | null> {
  let url = adresse;
  for (let saut = 0; saut < 4; saut++) {
    if (!lienAutorise(url)) return null;
    const reponse = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "KoraHome/Jarvis (recette)", Accept: "text/html" },
    });
    const suite = reponse.headers.get("location");
    if (reponse.status >= 300 && reponse.status < 400 && suite) {
      url = new URL(suite, url).toString();
      continue;
    }
    if (!reponse.ok || !(reponse.headers.get("content-type") ?? "").includes("html")) return null;
    const html = (await reponse.text()).slice(0, TAILLE_PAGE_MAX);
    return lirePage(html);
  }
  return null;
}

/** La photo ou le PDF joint, si c'est un format que Claude lit. */
function lireImage(v: unknown): { media_type: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"; data: string } | null {
  if (!v || typeof v !== "object") return null;
  const { type, donnees } = v as { type?: unknown; donnees?: unknown };
  if (typeof type !== "string" || !IMAGES.includes(type) || typeof donnees !== "string") return null;
  if (!donnees || donnees.length > TAILLE_IMAGE_MAX || !/^[A-Za-z0-9+/=]+$/.test(donnees)) return null;
  return { media_type: type as "image/jpeg" | "application/pdf", data: donnees };
}

/**
 * L'essai du matin (Kora 0.0.85) : chaque jour, le passage régulier pose une question minuscule à
 * Claude avec les vraies consignes et les vrais outils de Jarvis. S'il refuse (comme le 26 octobre
 * 2026, quand la grammaire des outils était devenue trop grande), chaque foyer inscrit reçoit la
 * note « Bug serveur » avant que quelqu'un ne parle à sa fée. Coût : environ 2 centimes par mois.
 */
async function essaiDuMatin(cle: string) {
  const client = new Anthropic({ apiKey: cle });
  try {
    const reponse = await client.messages.create({
      model: MODELE_JARVIS,
      max_tokens: 300,
      system: CONSIGNES_JARVIS,
      tools: OUTILS_JARVIS,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: "Essai automatique du serveur, personne n'attend de réponse : réponds seulement « prêt », sans outil." }],
    });
    console.log(JSON.stringify({ essai: "ok", fin: reponse.stop_reason, entree: reponse.usage.input_tokens, sortie: reponse.usage.output_tokens }));
    return { essai: "ok" };
  } catch (e) {
    console.error("Essai du matin", e);
    const foyers = ((await serveur.rpc("foyers_assistant_liste")).data ?? []) as string[];
    const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
    let signales = 0;
    for (const foyerId of foyers) if (await signalerPanne(foyerId, noteServeur("Jarvis", e, jour, { maintenant: () => new Date().toISOString() }))) signales++;
    return { essai: "panne", signales };
  }
}

Deno.serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  try {
    const cle = Deno.env.get("ANTHROPIC_API_KEY");
    if (!cle) return repondre({ erreur: "Jarvis n'est pas encore branché : sa clé manque sur le serveur." }, 503);

    const cleCron = req.headers.get("x-cle-cron");
    if (cleCron) {
      if (!(await cleCronValide(cleCron))) return repondre({ erreur: "Clé inconnue" }, 401);
      return repondre(await essaiDuMatin(cle));
    }

    const user = await utilisateur(req);
    if (!user) return repondre({ erreur: "Connexion requise" }, 401);

    const corps = await req.json().catch(() => ({}));
    const foyerId = texte(corps.foyerId, 100);
    const demande = texte(corps.demande, 1000).trim();
    if (!foyerId || !demande) return repondre({ erreur: "Demande vide" }, 400);
    if (!(await estMembre(foyerId, user.id))) return repondre({ erreur: "Ce foyer appartient à un autre compte" }, 403);

    const avant = etatBudget(await compter(foyerId, 0));
    if (avant.atteint) {
      return repondre({
        texte: `J'ai atteint le plafond de ${formaterChf(avant.plafondChf)} ce mois-ci. Je reviens le 1er du mois prochain.`,
        appels: [],
        budget: avant,
      });
    }

    const historique = (Array.isArray(corps.historique) ? corps.historique : [])
      .filter((t: { role?: unknown }) => t?.role === "personne" || t?.role === "jarvis")
      .map((t: { role: "personne" | "jarvis"; texte?: unknown }) => ({ role: t.role, texte: texte(t.texte, 500) }));

    // Le conseil du dimanche et le conseiller budget prennent le modèle plus réfléchi ; le reste, le modèle léger.
    const conseil = corps.mode === "conseil";
    const budgetFoyer = corps.mode === "budget";
    const reflechi = conseil || budgetFoyer;
    const modele = reflechi ? MODELE_CONSEIL : MODELE_JARVIS;
    const lien = reflechi ? null : lienDans(demande);
    const page = lien ? await ouvrirLien(lien).catch(() => null) : null;
    const image = reflechi ? null : lireImage(corps.image);
    // Le conseiller lit les dépenses détaillées : son état peut être plus long.
    const message = messageDemande(texte(corps.etat, budgetFoyer ? 40000 : 20000), demande, historique, lien ? (page ?? "(page illisible : dis-le et propose de coller les ingrédients)") : null);

    const client = new Anthropic({ apiKey: cle });
    // Une panne (pas l'affluence, pas la limite du compte) laisse une note « Bug serveur ».
    const reponse = await avecAlerte(foyerId, "Jarvis", noteServeur, () => client.messages.create({
      model: modele,
      // La réflexion de Claude compte dans max_tokens : un ticket de vingt lignes demande de la place.
      max_tokens: reflechi ? 4000 : image ? 8000 : 2000,
      system: budgetFoyer ? CONSIGNES_BUDGET : conseil ? CONSIGNES_CONSEIL : CONSIGNES_JARVIS,
      tools: budgetFoyer ? [OUTIL_BUDGET] : OUTILS_JARVIS,
      ...(budgetFoyer ? { tool_choice: { type: "tool", name: OUTIL_BUDGET.name } } : {}),
      output_config: { effort: reflechi ? "medium" : "low" },
      messages: [
        {
          role: "user",
          content: image
            ? [
                // Un PDF (une recette enregistrée, un livre scanné) se lit comme un document, page par page.
                image.media_type === "application/pdf"
                  ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: image.data } }
                  : { type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } },
                { type: "text", text: message },
              ]
            : message,
        },
      ],
    }));

    const budget = etatBudget(await compter(foyerId, coutMicroChf(reponse.usage, modele)));
    if (reponse.stop_reason === "refusal") {
      return repondre({ texte: "Je ne peux pas t'aider pour ça.", appels: [], budget });
    }
    const textes: string[] = [];
    const appels: { nom: string; entree: unknown }[] = [];
    for (const bloc of reponse.content) {
      if (bloc.type === "text") textes.push(bloc.text);
      else if (bloc.type === "tool_use") appels.push({ nom: bloc.name, entree: bloc.input });
    }
    // Le journal du serveur garde la forme de la réponse, jamais son contenu.
    console.log(JSON.stringify({ fin: reponse.stop_reason, image: !!image, outils: appels.map((a) => a.nom), entree: reponse.usage.input_tokens, sortie: reponse.usage.output_tokens }));
    if (reponse.stop_reason === "max_tokens") {
      return repondre({ texte: "Il y avait trop à écrire d'un coup et je me suis arrêté avant la fin. Réessaie, ou envoie le ticket en deux photos.", appels: [], budget });
    }
    return repondre({ texte: textes.join(" ").trim(), appels, budget });
  } catch (e) {
    console.error(e);
    const limite = limiteDuCompte(e, "Jarvis");
    if (limite) return repondre({ erreur: limite }, 503);
    if (e instanceof PanneSignalee) return repondre({ erreur: phrasePanne("Jarvis") }, 502);
    if (e instanceof Anthropic.RateLimitError) return repondre({ erreur: "Jarvis est très demandé, réessaie dans un instant." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return repondre({ erreur: "La clé de Jarvis est refusée : il faut la remplacer sur le serveur." }, 503);
    if (e instanceof Anthropic.APIError) return repondre({ erreur: "Jarvis ne répond pas pour l'instant, réessaie." }, 502);
    return repondre({ erreur: messageErreur(e) }, 500);
  }
});
