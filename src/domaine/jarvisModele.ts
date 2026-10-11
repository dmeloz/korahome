// Ce que la fonction serveur « jarvis » a besoin de savoir : le modèle, son coût et le
// plafond du foyer, les outils et les consignes, la forme de la demande. Sans aucune
// dépendance : `npm run fonction` le copie tel quel dans supabase/functions/jarvis/domaine.js.

import type { Jour } from "./types";

// ----- Le modèle et son coût -----

/** Un modèle léger et rapide : les demandes du quotidien sont courtes. */
export const MODELE_JARVIS = "claude-haiku-5-5";
/** Prix du modèle, en dollars par million de jetons (entrée, sortie). */
const PRIX_USD_PAR_MILLION = { entree: 0.1, sortie: 0.5 };
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
export function coutMicroChf(u: Consommation): number {
  const entree = u.input_tokens + 1.25 * (u.cache_creation_input_tokens ?? 0) + 0.1 * (u.cache_read_input_tokens ?? 0);
  const usd = (entree * PRIX_USD_PAR_MILLION.entree + u.output_tokens * PRIX_USD_PAR_MILLION.sortie) / 1e6;
  return Math.ceil(usd * CHF_PAR_USD * 1e6);
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
Pour une question sur le foyer, réponds à partir de l'état du foyer fourni ; s'il ne contient pas la réponse, dis-le.`;

// ----- La conversation -----

export interface TourJarvis {
  role: "personne" | "jarvis";
  texte: string;
}

/** Les derniers échanges, pour que « et du beurre aussi » se comprenne. */
export const TOURS_RETENUS = 6;

/** Le message envoyé au modèle : les derniers échanges, l'état du foyer, puis la demande. */
export function messageDemande(etat: string, demande: string, historique: readonly TourJarvis[] = []): string {
  const tours = historique.slice(-TOURS_RETENUS).map((t) => `${t.role === "personne" ? "Personne" : "Jarvis"} : ${t.texte}`);
  const avant = tours.length ? `Échanges précédents :\n${tours.join("\n")}\n\n` : "";
  return `${avant}État du foyer :\n${etat}\n\nDemande : ${demande.trim()}`;
}
