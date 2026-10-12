// KoraHome : Jarvis, l'assistant du foyer (Supabase Edge Function, Deno).
//
// Le téléphone envoie la demande, avec l'état du foyer qu'il a préparé et les derniers
// échanges. La fonction vérifie que la personne est membre du foyer et que le plafond du
// mois (5 CHF) n'est pas atteint, interroge Claude, compte la dépense, puis renvoie la
// réponse et les actions demandées. C'est le téléphone qui les applique (avec Annuler).
// Il lit aussi une photo jointe (lettre, rendez-vous), la recette derrière un lien, et prépare
// le conseil du dimanche (mode « conseil », modèle plus réfléchi, proposition validée ensemble).
//
// La clé de l'API Claude reste ici, dans le secret ANTHROPIC_API_KEY : jamais dans l'app.
// Les consignes et les outils viennent de src/domaine/jarvisModele.ts, copié dans domaine.js par
// `npm run fonction`. Déploiement : docs/jarvis.md.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
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
  OUTILS_JARVIS,
} from "./domaine.js";

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
const TAILLE_IMAGE_MAX = 4_000_000; // en base64, environ 3 Mo d'image
const IMAGES = ["image/jpeg", "image/png", "image/webp"];

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

/** La photo jointe, si elle est d'un format que Claude lit. */
function lireImage(v: unknown): { media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } | null {
  if (!v || typeof v !== "object") return null;
  const { type, donnees } = v as { type?: unknown; donnees?: unknown };
  if (typeof type !== "string" || !IMAGES.includes(type) || typeof donnees !== "string") return null;
  if (!donnees || donnees.length > TAILLE_IMAGE_MAX || !/^[A-Za-z0-9+/=]+$/.test(donnees)) return null;
  return { media_type: type as "image/jpeg", data: donnees };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const cle = Deno.env.get("ANTHROPIC_API_KEY");
    if (!cle) return repondre({ erreur: "Jarvis n'est pas encore branché : sa clé manque sur le serveur." }, 503);

    const jeton = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
    const { data } = await serveur.auth.getUser(jeton);
    if (!data.user) return repondre({ erreur: "Connexion requise" }, 401);

    const corps = await req.json().catch(() => ({}));
    const foyerId = texte(corps.foyerId, 100);
    const demande = texte(corps.demande, 1000).trim();
    if (!foyerId || !demande) return repondre({ erreur: "Demande vide" }, 400);
    const { data: membre } = await serveur.from("membres_foyer").select("user_id").eq("foyer_id", foyerId).eq("user_id", data.user.id).maybeSingle();
    if (!membre) return repondre({ erreur: "Ce foyer appartient à un autre compte" }, 403);

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

    // Le conseil du dimanche prend le modèle plus réfléchi ; le reste, le modèle léger.
    const conseil = corps.mode === "conseil";
    const modele = conseil ? MODELE_CONSEIL : MODELE_JARVIS;
    const lien = conseil ? null : lienDans(demande);
    const page = lien ? await ouvrirLien(lien).catch(() => null) : null;
    const image = conseil ? null : lireImage(corps.image);
    const message = messageDemande(texte(corps.etat, 20000), demande, historique, lien ? (page ?? "(page illisible : dis-le et propose de coller les ingrédients)") : null);

    const client = new Anthropic({ apiKey: cle });
    const reponse = await client.messages.create({
      model: modele,
      max_tokens: conseil ? 4000 : 2000,
      system: conseil ? CONSIGNES_CONSEIL : CONSIGNES_JARVIS,
      tools: OUTILS_JARVIS,
      output_config: { effort: conseil ? "medium" : "low" },
      messages: [
        {
          role: "user",
          content: image ? [{ type: "image", source: { type: "base64", ...image } }, { type: "text", text: message }] : message,
        },
      ],
    });

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
    return repondre({ texte: textes.join(" ").trim(), appels, budget });
  } catch (e) {
    console.error(e);
    if (e instanceof Anthropic.RateLimitError) return repondre({ erreur: "Jarvis est très demandé, réessaie dans un instant." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return repondre({ erreur: "La clé de Jarvis est refusée : il faut la remplacer sur le serveur." }, 503);
    if (e instanceof Anthropic.APIError) return repondre({ erreur: "Jarvis ne répond pas pour l'instant, réessaie." }, 502);
    return repondre({ erreur: (e as Error).message }, 500);
  }
});
