// Ce que la fonction serveur « jarvis » a besoin de savoir : le modèle, son coût et le
// plafond du foyer, les outils et les consignes, la forme de la demande. Sans aucune
// dépendance : `npm run fonction` le copie tel quel dans supabase/functions/jarvis/domaine.js.

import type { Jour } from "./types";

// ----- Le modèle et son coût -----

/** Un modèle léger et rapide : les demandes du quotidien sont courtes. */
export const MODELE_JARVIS = "claude-haiku-5-5";
/** Le conseil du dimanche demande plus de réflexion : un modèle plus capable, une fois par semaine. */
export const MODELE_CONSEIL = "claude-sonnet-5-5";
export type ModeleJarvis = typeof MODELE_JARVIS | typeof MODELE_CONSEIL;
/** Prix des modèles, en dollars par million de jetons (entrée, sortie). */
const PRIX_USD_PAR_MILLION: Record<ModeleJarvis, { entree: number; sortie: number }> = {
  "claude-haiku-5-5": { entree: 0.1, sortie: 0.5 },
  "claude-sonnet-5-5": { entree: 2, sortie: 10 },
};
/** Conversion prudente : un dollar compte pour 0,90 CHF (il en vaut un peu moins). */
const CHF_PAR_USD = 0.9;
/** Le plafond choisi par Melo : 5 CHF par mois pour tout le foyer. */
export const PLAFOND_CHF = 5;
/** À partir de 80 % du plafond, Jarvis prévient. */
const SEUIL_ALERTE = 0.8;

export interface Consommation {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** Le coût d'une demande, en millionièmes de franc (un entier, pour additionner sans erreur d'arrondi). */
export function coutMicroChf(u: Consommation, modele: ModeleJarvis = MODELE_JARVIS): number {
  const prix = PRIX_USD_PAR_MILLION[modele];
  const entree = u.input_tokens + 1.25 * (u.cache_creation_input_tokens ?? 0) + 0.1 * (u.cache_read_input_tokens ?? 0);
  const usd = (entree * prix.entree + u.output_tokens * prix.sortie) / 1e6;
  // Arrondi au millionième d'abord : les virgules flottantes ne comptent pas un micro-franc de trop.
  return Math.ceil(Math.round(usd * CHF_PAR_USD * 1e9) / 1e3);
}

export interface EtatBudget {
  depenseChf: number;
  plafondChf: number;
  /** Plus de 80 % du plafond : Jarvis le signale. */
  alerte: boolean;
  /** Plafond atteint : Jarvis se tait jusqu'au mois suivant. */
  atteint: boolean;
}

export function etatBudget(microChf: number, plafondChf = PLAFOND_CHF): EtatBudget {
  const depenseChf = microChf / 1e6;
  return {
    depenseChf,
    plafondChf,
    alerte: depenseChf >= plafondChf * SEUIL_ALERTE,
    atteint: depenseChf >= plafondChf,
  };
}

/** « 0,42 CHF » */
export function formaterChf(chf: number): string {
  return `${chf.toFixed(2).replace(".", ",")} CHF`;
}

/** Le mois en cours, « AAAA-MM » : le compteur repart à zéro chaque mois. */
export function moisDe(jour: Jour): string {
  return jour.slice(0, 7);
}

// ----- Ce que Jarvis sait faire -----

const texte = (description: string) => ({ type: "string", description });
const ouNul = (description: string) => ({ type: ["string", "null"], description });

/** Les outils proposés au modèle (format de l'API Claude, schémas stricts). */
export const OUTILS_JARVIS = [
  {
    name: "ajouter_courses",
    description: "Ajoute des articles à la liste de courses du foyer. Un article déjà sur la liste n'est pas ajouté deux fois.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["articles"],
      properties: {
        articles: {
          type: "array",
          items: texte("Un article avec sa quantité éventuelle, comme on l'écrirait sur la liste : « lait », « 2 kg de pommes »."),
        },
      },
    },
  },
  {
    name: "cocher_courses",
    description: "Coche des articles de la liste de courses : ils ont été achetés ou ne sont plus utiles.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["articles"],
      properties: { articles: { type: "array", items: texte("Le nom de l'article tel qu'il figure sur la liste.") } },
    },
  },
  {
    name: "ajouter_tache",
    description: "Crée une tâche de la maison, unique ou qui revient.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["titre", "echeance", "responsable", "frequence"],
      properties: {
        titre: texte("Le nom court de la tâche : « Sortir les poubelles »."),
        echeance: texte("Le jour où la faire, AAAA-MM-JJ."),
        responsable: ouNul("Le prénom de la personne qui s'en charge ; null si la tâche reste libre."),
        frequence: {
          type: ["object", "null"],
          description: "Pour une tâche qui revient : tous les N jours, semaines ou mois. null pour une tâche unique.",
          additionalProperties: false,
          required: ["unite", "tous"],
          properties: { unite: { type: "string", enum: ["jour", "semaine", "mois"] }, tous: { type: "integer" } },
        },
      },
    },
  },
  {
    name: "tache_faite",
    description: "Marque une tâche existante comme faite par la personne qui parle. Une tâche qui revient repart pour la prochaine fois.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["titre"],
      properties: { titre: texte("Le nom de la tâche tel qu'il figure dans la liste des tâches.") },
    },
  },
  {
    name: "ajouter_au_stock",
    description: "Range des produits au frigo, au congélateur ou au placard.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["produits"],
      properties: {
        produits: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["nom", "lieu", "peremption"],
            properties: {
              nom: texte("Le produit avec sa quantité éventuelle : « 2 yaourts », « poulet »."),
              lieu: { type: "string", enum: ["frigo", "congelateur", "placard"] },
              peremption: ouNul("La date limite, AAAA-MM-JJ ; null si on ne la connaît pas."),
            },
          },
        },
      },
    },
  },
  {
    name: "attribuer_tache",
    description: "Confie une tâche existante à une personne du foyer, ou la rend libre.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["titre", "responsable"],
      properties: {
        titre: texte("Le nom de la tâche tel qu'il figure dans la liste des tâches."),
        responsable: ouNul("Le prénom de la personne qui s'en charge ; null pour la rendre libre."),
      },
    },
  },
  {
    name: "noter_pesee",
    description: "Note le poids d'un animal du foyer, pesé aujourd'hui.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["animal", "grammes"],
      properties: { animal: texte("Le nom de l'animal."), grammes: { type: "integer", description: "Le poids en grammes." } },
    },
  },
] as const;

export const CONSIGNES_JARVIS = `Tu es Jarvis, l'assistant d'un foyer en Suisse romande, dans l'app KoraHome sur iPhone.
On te parle souvent à la voix : la demande peut être approximative ou mal transcrite, devine l'intention la plus probable.
Réponds toujours en français, en tutoyant, en une ou deux phrases courtes, sans liste ni mise en forme.
Pour agir, utilise les outils. Quand tu utilises un outil, n'écris rien d'autre : l'app confirme elle-même ce qui a été fait.
Tu peux faire plusieurs actions d'un coup. Les dates sont au format AAAA-MM-JJ ; « demain », « samedi » se comptent depuis la date du jour donnée.
Tu ne supprimes jamais rien et tu ne dépenses jamais d'argent : si on te le demande, explique que ça se fait dans l'app.
Si la demande n'est pas claire ou ne correspond à aucun outil, pose une seule question courte.
Pour une question sur le foyer, réponds à partir de l'état du foyer fourni ; s'il ne contient pas la réponse, dis-le.
Avec une photo (lettre, facture, carte de rendez-vous, flyer) : relève les rendez-vous, échéances et paiements, et crée pour chacun une tâche unique à sa date, avec l'heure et le lieu dans le titre s'ils sont indiqués.
Avec un ticket de caisse : range au stock (ajouter_au_stock) les produits alimentaires achetés, avec leur quantité dans le nom (« 1 l lait », « 500 g beurre ») et le lieu où on les range d'habitude ; laisse la date de péremption vide si elle n'est pas écrite, l'app la devine. Coche aussi les courses correspondantes (cocher_courses).
Avec une recette : compare ses ingrédients au stock et à la liste de courses, et n'ajoute aux courses que ce qui manque, avec les quantités de la recette.`;

/** Le conseil du dimanche : Jarvis prépare la semaine, le foyer valide ensemble. */
export const CONSIGNES_CONSEIL = `Tu es Jarvis, l'assistant d'un foyer en Suisse romande. C'est le conseil de la semaine : le foyer décide ensemble de la semaine qui vient, et tu prépares une proposition qu'il validera ligne par ligne.
Utilise les outils pour proposer :
- de confier chaque tâche des sept prochains jours à une personne (attribuer_tache), en équilibrant la charge et en tenant compte de qui a fait quoi ;
- les courses de la semaine (ajouter_courses) : les ingrédients de cinq repas simples de saison qui utilisent d'abord ce qui arrive à sa date dans le stock, et ce qui manque pour la maison ;
- les tâches qui manquent pour la semaine (ajouter_tache), seulement si l'état du foyer le justifie.
En plus des outils, écris en français, en tutoyant, un court résumé : la répartition proposée, les cinq repas (un par ligne, « Lundi : … »), et ce qui demande de l'attention. Pas plus de dix lignes.`;

// ----- Les recettes -----

export interface Recette {
  titre: string;
  ingredients: string[];
  portions: string | null;
}

const decoder = (t: string) =>
  t
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/** Cherche une recette dans les données structurées (JSON-LD) d'une page : Betty Bossi, Marmiton, Fooby… */
export function extraireRecette(html: string): Recette | null {
  const blocs = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, contenu] of blocs) {
    let donnees: unknown;
    try {
      donnees = JSON.parse(contenu.trim());
    } catch {
      continue;
    }
    const aVisiter: unknown[] = [donnees];
    while (aVisiter.length) {
      const n = aVisiter.shift();
      if (Array.isArray(n)) {
        aVisiter.push(...n);
        continue;
      }
      if (!n || typeof n !== "object") continue;
      const o = n as Record<string, unknown>;
      const type = o["@type"];
      const estRecette = type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
      if (estRecette && Array.isArray(o.recipeIngredient)) {
        const ingredients = o.recipeIngredient.filter((i): i is string => typeof i === "string").map(decoder).filter(Boolean);
        if (!ingredients.length) continue;
        const rendement = Array.isArray(o.recipeYield) ? o.recipeYield[0] : o.recipeYield;
        return {
          titre: typeof o.name === "string" ? decoder(o.name) : "Recette",
          ingredients,
          portions: typeof rendement === "string" || typeof rendement === "number" ? String(rendement) : null,
        };
      }
      if (o["@graph"]) aVisiter.push(o["@graph"]);
    }
  }
  return null;
}

/** Le texte lisible d'une page, sans balises, pour une recette sans données structurées. */
export function texteDePage(html: string, max = 6000): string {
  return decoder(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).slice(0, max);
}

/** Le premier lien d'une demande (« ajoute les ingrédients de https://… »). */
export function lienDans(demande: string): string | null {
  return demande.match(/https:\/\/[^\s<>"']+/)?.[0] ?? null;
}

/** Ce que le modèle lit d'une recette trouvée derrière un lien. */
export function decrireRecette(r: Recette): string {
  return `Recette « ${r.titre} »${r.portions ? ` (${r.portions})` : ""}, ingrédients :\n${r.ingredients.map((i) => `- ${i}`).join("\n")}`;
}

// ----- La conversation -----

export interface TourJarvis {
  role: "personne" | "jarvis";
  texte: string;
}

/** Les derniers échanges, pour que « et du beurre aussi » se comprenne. */
export const TOURS_RETENUS = 6;

/** Le message envoyé au modèle : les derniers échanges, l'état du foyer, puis la demande. */
export function messageDemande(etat: string, demande: string, historique: readonly TourJarvis[] = [], lien?: string | null): string {
  const tours = historique.slice(-TOURS_RETENUS).map((t) => `${t.role === "personne" ? "Personne" : "Jarvis"} : ${t.texte}`);
  const avant = tours.length ? `Échanges précédents :\n${tours.join("\n")}\n\n` : "";
  const page = lien ? `\n\nCe qu'il y a derrière le lien :\n${lien}` : "";
  return `${avant}État du foyer :\n${etat}\n\nDemande : ${demande.trim()}${page}`;
}

/** Ce que Jarvis lit d'une page : la recette si elle est décrite, sinon son texte. */
export function lirePage(html: string): string {
  const recette = extraireRecette(html);
  return recette ? decrireRecette(recette) : texteDePage(html);
}

/** Les adresses qu'on accepte d'ouvrir : https, nom de domaine public (ni IP, ni réseau local). */
export function lienAutorise(adresse: string): boolean {
  let url: URL;
  try {
    url = new URL(adresse);
  } catch {
    return false;
  }
  const hote = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.port || url.username) return false;
  if (!hote.includes(".") || hote.endsWith(".local") || hote.endsWith(".internal") || hote === "localhost") return false;
  return !/^[\d.]+$/.test(hote) && !hote.includes(":") && !hote.startsWith("[");
}
