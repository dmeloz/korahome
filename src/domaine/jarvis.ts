// Jarvis, l'assistant du foyer : on lui écrit ou on lui parle (« ajoute du lait, la litière
// est faite »), il répond et agit. Ce fichier tient ses règles, sans réseau ni stockage :
// - ce que Jarvis sait faire (OUTILS_JARVIS) et ses consignes, envoyés au modèle par la
//   fonction serveur supabase/functions/jarvis (copiés par `npm run fonction`) ;
// - ce qu'il sait du foyer (decrireFoyer), préparé par le téléphone ;
// - comment ses actions modifient les données (appliquerActions), sur le téléphone, qui
//   les enregistre dans le Dépôt et peut tout annuler ;
// - le plafond de dépense du foyer (5 CHF par mois).
// Jarvis ne supprime rien : il ajoute, coche et met à jour. Tout se rattrape avec Annuler.

import { analyserSaisie, nouvelElement, trouverDoublon } from "./listes";
import { ajouterPesee, choseAFaire, formaterPoids, poidsActuel, rationDuJour, type Animal } from "./mitsu";
import { normaliser } from "./rayons";
import { decrirePeremption, LIEUX, nouveauProduit, type Lieu, type Produit } from "./stock";
import { decrireEcheance, decrireRecurrence, ecartJours, estTerminee, marquerFaite, nouvelleTache } from "./taches";
import type { Contexte, Element, Foyer, Id, Jour, Liste, Recurrence, Tache } from "./types";

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

// ----- Ce que Jarvis sait du foyer -----

export interface DonneesFoyer {
  foyer: Foyer;
  listes: Liste[];
  elements: Element[];
  taches: Tache[];
  animaux: Animal[];
  produits: Produit[];
}

const listeCourses = (d: DonneesFoyer) => d.listes.find((l) => l.type === "courses") ?? null;
const prenomDe = (foyer: Foyer, id: Id | null) => foyer.membres.find((m) => m.id === id)?.prenom ?? null;
const JOURS_SEMAINE = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function nomDuJour(jour: Jour): string {
  const [a, m, j] = jour.split("-").map(Number);
  return JOURS_SEMAINE[new Date(Date.UTC(a, m - 1, j)).getUTCDay()];
}

/** L'état du foyer, en quelques lignes, envoyé avec chaque demande. */
export function decrireFoyer(d: DonneesFoyer, membreId: Id | null, aujourdhui: Jour): string {
  const lignes: string[] = [];
  const moi = prenomDe(d.foyer, membreId);
  lignes.push(`Aujourd'hui : ${nomDuJour(aujourdhui)} ${aujourdhui}.`);
  lignes.push(`Foyer « ${d.foyer.nom} » : ${d.foyer.membres.map((m) => m.prenom).join(", ")}.`);
  lignes.push(moi ? `La personne qui parle : ${moi}.` : "La personne qui parle n'est pas connue.");

  const liste = listeCourses(d);
  const aPrendre = liste ? d.elements.filter((e) => e.listeId === liste.id && !e.coche) : [];
  lignes.push(
    !liste
      ? "Pas de liste de courses."
      : aPrendre.length === 0
        ? "Liste de courses : vide."
        : `Liste de courses : ${aPrendre.map((e) => (e.quantite ? `${e.texte} (${e.quantite})` : e.texte)).join(", ")}.`,
  );

  const taches = d.taches
    .filter((t) => !estTerminee(t) && ecartJours(aujourdhui, t.echeance) <= 14)
    .sort((a, b) => a.echeance.localeCompare(b.echeance));
  lignes.push(taches.length === 0 ? "Tâches des deux semaines : aucune." : "Tâches des deux semaines :");
  for (const t of taches) {
    const qui = prenomDe(d.foyer, t.responsable) ?? "libre";
    lignes.push(`- ${t.titre} : ${decrireEcheance(t.echeance, aujourdhui)}, ${qui}, ${decrireRecurrence(t.recurrence).toLowerCase()}`);
  }

  if (d.produits.length > 0) {
    lignes.push("Stock :");
    for (const p of d.produits) {
      const date = decrirePeremption(p, aujourdhui);
      lignes.push(`- ${p.nom}${p.quantite ? ` (${p.quantite})` : ""}, ${LIEUX[p.lieu].toLowerCase()}${date ? `, ${date.toLowerCase()}` : ""}`);
    }
  } else {
    lignes.push("Stock : rien de noté.");
  }

  for (const a of d.animaux) {
    const poids = poidsActuel(a);
    const ration = rationDuJour(a, aujourdhui);
    const aFaire = choseAFaire(a, aujourdhui).map((c) => c.texte);
    lignes.push(
      `Animal ${a.nom} : ${poids ? `${formaterPoids(poids.grammes)} (pesé le ${poids.jour})` : "pas encore pesé"}` +
        `${ration ? `, ration ${ration.grammes} g par jour` : ""}${aFaire.length ? `, à faire : ${aFaire.join(" ; ")}` : ""}.`,
    );
  }
  return lignes.join("\n");
}

// ----- Les actions -----

export type ActionJarvis =
  | { outil: "ajouter_courses"; articles: string[] }
  | { outil: "cocher_courses"; articles: string[] }
  | { outil: "ajouter_tache"; titre: string; echeance: Jour; responsable: string | null; frequence: Recurrence | null }
  | { outil: "tache_faite"; titre: string }
  | { outil: "ajouter_au_stock"; produits: { nom: string; lieu: Lieu; peremption: Jour | null }[] }
  | { outil: "noter_pesee"; animal: string; grammes: number };

const estTexte = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const textes = (v: unknown): string[] => (Array.isArray(v) ? v.filter(estTexte) : []);
const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const jourOuNul = (v: unknown): Jour | null => (typeof v === "string" && RE_JOUR.test(v) ? v : null);

/**
 * Relit les demandes d'outils renvoyées par le modèle ; ce qui est incomplet est ignoré.
 * Le modèle respecte les schémas, mais rien ne part dans les données sans être vérifié.
 */
export function lireActions(appels: readonly { nom: string; entree: unknown }[]): ActionJarvis[] {
  const actions: ActionJarvis[] = [];
  for (const { nom, entree } of appels) {
    const e = (entree ?? {}) as Record<string, unknown>;
    if (nom === "ajouter_courses" || nom === "cocher_courses") {
      const articles = textes(e.articles);
      if (articles.length) actions.push({ outil: nom, articles });
    } else if (nom === "ajouter_tache") {
      const echeance = jourOuNul(e.echeance);
      if (!estTexte(e.titre) || !echeance) continue;
      const f = e.frequence as { unite?: unknown; tous?: unknown } | null;
      const unite = f?.unite;
      const frequence: Recurrence | null =
        (unite === "jour" || unite === "semaine" || unite === "mois") && Number.isInteger(f?.tous) && (f?.tous as number) >= 1
          ? { unite, tous: f?.tous as number }
          : null;
      actions.push({ outil: nom, titre: e.titre, echeance, responsable: estTexte(e.responsable) ? e.responsable : null, frequence });
    } else if (nom === "tache_faite") {
      if (estTexte(e.titre)) actions.push({ outil: nom, titre: e.titre });
    } else if (nom === "ajouter_au_stock") {
      const produits = (Array.isArray(e.produits) ? e.produits : [])
        .map((p) => (p ?? {}) as Record<string, unknown>)
        .filter((p) => estTexte(p.nom) && typeof p.lieu === "string" && p.lieu in LIEUX)
        .map((p) => ({ nom: p.nom as string, lieu: p.lieu as Lieu, peremption: jourOuNul(p.peremption) }));
      if (produits.length) actions.push({ outil: nom, produits });
    } else if (nom === "noter_pesee") {
      if (estTexte(e.animal) && typeof e.grammes === "number") actions.push({ outil: nom, animal: e.animal, grammes: e.grammes });
    }
  }
  return actions;
}

/** Un document modifié par Jarvis, avec sa version d'avant pour pouvoir annuler (null : il vient d'être créé). */
export type Modification =
  | { collection: "elements"; avant: Element | null; apres: Element }
  | { collection: "taches"; avant: Tache | null; apres: Tache }
  | { collection: "stock"; avant: Produit | null; apres: Produit }
  | { collection: "animaux"; avant: Animal; apres: Animal };

export interface ResultatActions {
  modifications: Modification[];
  /** Ce qui a été fait, phrase par phrase : « Ajouté aux courses : lait, beurre. » */
  faits: string[];
  /** Ce qui n'a pas pu se faire, et pourquoi. */
  echecs: string[];
}

/** Trouve un nom dans une liste, sans tenir compte des majuscules ni des accents ; d'abord le nom exact, sinon le plus proche. */
function trouverParNom<T>(elements: readonly T[], nom: string, nomDe: (t: T) => string): T | undefined {
  const cle = normaliser(nom);
  return (
    elements.find((e) => normaliser(nomDe(e)) === cle) ??
    elements.find((e) => normaliser(nomDe(e)).includes(cle) || cle.includes(normaliser(nomDe(e))))
  );
}

const enumerer = (mots: string[]) =>
  mots.length <= 1 ? (mots[0] ?? "") : `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}`;

/**
 * Applique les actions de Jarvis aux données du foyer. Ne touche à rien : renvoie les
 * documents à enregistrer, chacun avec sa version d'avant, et le récit de ce qui a été fait.
 */
export function appliquerActions(
  actions: readonly ActionJarvis[],
  donnees: DonneesFoyer,
  membreId: Id | null,
  aujourdhui: Jour,
  ctx: Contexte,
): ResultatActions {
  const modifications: Modification[] = [];
  const faits: string[] = [];
  const echecs: string[] = [];
  // Les éléments évoluent au fil des actions : « ajoute du lait » puis « coche le lait » se suivent.
  let elements = [...donnees.elements];
  let taches = [...donnees.taches];
  let animaux = [...donnees.animaux];
  const liste = listeCourses(donnees);

  for (const action of actions) {
    try {
      switch (action.outil) {
        case "ajouter_courses": {
          if (!liste) {
            echecs.push("Il n'y a pas encore de liste de courses.");
            break;
          }
          const ajoutes: string[] = [];
          const deja: string[] = [];
          for (const article of action.articles) {
            const surLaListe = elements.filter((e) => e.listeId === liste.id);
            const doublon = trouverDoublon(surLaListe, article);
            if (doublon) {
              deja.push(doublon.texte.toLowerCase());
              continue;
            }
            const element = nouvelElement(liste, article, membreId, ctx);
            elements.push(element);
            modifications.push({ collection: "elements", avant: null, apres: element });
            ajoutes.push(element.quantite ? `${element.texte.toLowerCase()} (${element.quantite})` : element.texte.toLowerCase());
          }
          if (ajoutes.length) faits.push(`Ajouté aux courses : ${enumerer(ajoutes)}.`);
          if (deja.length) faits.push(`Déjà sur la liste : ${enumerer(deja)}.`);
          break;
        }
        case "cocher_courses": {
          const coches: string[] = [];
          for (const article of action.articles) {
            const aPrendre = elements.filter((e) => e.listeId === liste?.id && !e.coche);
            const element = trouverParNom(aPrendre, analyserSaisie(article).texte, (e) => e.texte);
            if (!element) {
              echecs.push(`« ${article} » n'est pas sur la liste.`);
              continue;
            }
            const coche: Element = { ...element, coche: true, cocheLe: ctx.maintenant() };
            elements = elements.map((e) => (e.id === coche.id ? coche : e));
            modifications.push({ collection: "elements", avant: element, apres: coche });
            coches.push(element.texte.toLowerCase());
          }
          if (coches.length) faits.push(`Coché : ${enumerer(coches)}.`);
          break;
        }
        case "ajouter_tache": {
          const responsable = action.responsable ? trouverParNom(donnees.foyer.membres, action.responsable, (m) => m.prenom) : undefined;
          const tache = nouvelleTache(action.titre, action.frequence, action.echeance, ctx, responsable?.id ?? null);
          taches.push(tache);
          modifications.push({ collection: "taches", avant: null, apres: tache });
          const qui = responsable ? `, pour ${responsable.prenom}` : "";
          faits.push(`Tâche ajoutée : ${tache.titre.toLowerCase()}, ${decrireEcheance(tache.echeance, aujourdhui)}${qui}.`);
          break;
        }
        case "tache_faite": {
          const tache = trouverParNom(taches.filter((t) => !estTerminee(t)), action.titre, (t) => t.titre);
          if (!tache) {
            echecs.push(`Je ne trouve pas la tâche « ${action.titre} ».`);
            break;
          }
          const faite = marquerFaite(tache, membreId, aujourdhui, ctx);
          taches = taches.map((t) => (t.id === faite.id ? faite : t));
          modifications.push({ collection: "taches", avant: tache, apres: faite });
          faits.push(
            faite.recurrence
              ? `C'est noté : ${tache.titre.toLowerCase()} est faite, prochaine fois ${decrireEcheance(faite.echeance, aujourdhui)}.`
              : `C'est noté : ${tache.titre.toLowerCase()} est faite.`,
          );
          break;
        }
        case "ajouter_au_stock": {
          const ranges: string[] = [];
          for (const p of action.produits) {
            const produit = nouveauProduit({ texte: p.nom, lieu: p.lieu, peremption: p.peremption }, membreId, ctx);
            modifications.push({ collection: "stock", avant: null, apres: produit });
            ranges.push(`${produit.nom.toLowerCase()} (${LIEUX[produit.lieu].toLowerCase()})`);
          }
          faits.push(`Rangé : ${enumerer(ranges)}.`);
          break;
        }
        case "noter_pesee": {
          const animal = trouverParNom(animaux, action.animal, (a) => a.nom);
          if (!animal) {
            echecs.push(`Je ne connais pas d'animal nommé ${action.animal}.`);
            break;
          }
          const pese = ajouterPesee(animal, action.grammes, aujourdhui, membreId, ctx);
          animaux = animaux.map((a) => (a.id === pese.id ? pese : a));
          // Deux pesées du même animal dans une demande : la version d'avant reste la toute première.
          const deja = modifications.find(
            (m): m is Extract<Modification, { collection: "animaux" }> => m.collection === "animaux" && m.apres.id === animal.id,
          );
          if (deja) deja.apres = pese;
          else modifications.push({ collection: "animaux", avant: animal, apres: pese });
          faits.push(`Pesée notée : ${animal.nom}, ${formaterPoids(Math.round(action.grammes))}.`);
          break;
        }
      }
    } catch (e) {
      echecs.push(e instanceof Error ? e.message : "Cette action n'a pas pu se faire.");
    }
  }
  return { modifications, faits, echecs };
}

/** Ce qui remet chaque document dans son état d'avant, dans l'ordre inverse. */
export function annulation(modifications: readonly Modification[]): { collection: Modification["collection"]; id: Id; remettre: unknown | null }[] {
  const vus = new Set<string>();
  const resultat: { collection: Modification["collection"]; id: Id; remettre: unknown | null }[] = [];
  // La version d'avant d'un document est celle de sa première modification.
  for (const m of modifications) {
    const cle = `${m.collection}/${m.apres.id}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    resultat.push({ collection: m.collection, id: m.apres.id, remettre: m.avant });
  }
  return resultat.reverse();
}

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
