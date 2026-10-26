import { auCentime, depenses, formaterMontant, planDe, POTS, reglerFacture, type DocBudget, type Depense, type PaiementAClasser, type PlanBudget, type Pot } from "./budget";
import type { Contexte, Id, Jour } from "./types";
import { sansAccents } from "./texte";

// Les paiements Apple Pay arrivent seuls dans le budget (Kora 0.0.29).
//
// Sur chaque iPhone, une automatisation de l'app Raccourcis (« Transaction », quand on paie
// avec une carte de Wallet) envoie le montant, le commerçant et le nom de la carte à la fonction
// serveur « paiements » (supabase/functions/paiements). Kora retient une fois pour toutes quel
// pot paie chaque carte : ensuite chaque paiement devient une dépense sans rien toucher. Une carte
// encore inconnue, ou un paiement dans une autre monnaie, attend d'être classé d'un toucher.
// Aucun identifiant bancaire : le nom de la carte est gardé sans ses chiffres.

/** Ce qu'une carte paie : un pot (« perso » : les dépenses à soi de qui paie), ou rien (hors du budget). */
export type ChoixCarte = Pot | "aucun";

/** Les pots qu'on peut donner à une carte, dans l'ordre des puces. */
export const POTS_DE_CARTE: readonly Pot[] = ["perso", "courses", "plaisir", "factures", "commun", "epargne"];

/** « CHF 12.50 », « 12,50 CHF », « €8.90 », « 1’234.50 », 12.5 → le montant et sa monnaie ; null si illisible. */
export function lireMontantPaye(valeur: unknown): { montant: number; devise: string } | null {
  if (typeof valeur === "number") return Number.isFinite(valeur) && valeur > 0 ? { montant: auCentime(valeur), devise: "CHF" } : null;
  if (typeof valeur !== "string") return null;
  const texte = valeur.trim().slice(0, 40);
  const devise = /€|eur/i.test(texte) ? "EUR" : /\$|usd/i.test(texte) ? "USD" : /£|gbp/i.test(texte) ? "GBP" : (/\b(?!CHF)[A-Z]{3}\b/.exec(texte)?.[0] ?? "CHF");
  const nombre = /\d[\d’' .,]*/.exec(texte)?.[0].replace(/[’' ]/g, "").replace(/[.,]$/, "");
  if (!nombre) return null;
  const derniere = Math.max(nombre.lastIndexOf("."), nombre.lastIndexOf(","));
  let propre = nombre;
  if (derniere >= 0) {
    const apres = nombre.length - derniere - 1;
    // Une virgule ou un point suivi d'un ou deux chiffres sépare les centimes ; sinon ce sont des milliers.
    propre = apres <= 2 ? `${nombre.slice(0, derniere).replace(/[.,]/g, "")}.${nombre.slice(derniere + 1)}` : nombre.replace(/[.,]/g, "");
  }
  const montant = Number(propre);
  return Number.isFinite(montant) && montant > 0 && montant < 100_000 ? { montant: auCentime(montant), devise } : null;
}

/** Le nom de la carte sans aucun chiffre (« Revolut •••• 1234 » → « Revolut »). */
export function nomDeCarte(valeur: unknown): string {
  const texte = typeof valeur === "string" ? valeur : "";
  const propre = texte
    .replace(/\d/g, "")
    .replace(/[•*·#]+/g, " ")
    .replace(/\s+[-–]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return propre || "Carte";
}

/** « MIGROS M RENENS » → « Migros M Renens » ; un nom déjà écrit normalement reste tel quel. */
export function nomDeCommercant(valeur: unknown): string | null {
  const texte = (typeof valeur === "string" ? valeur : "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!texte) return null;
  if (texte !== texte.toUpperCase()) return texte;
  return texte.toLowerCase().replace(/(^|[\s'’.-])(\p{L})/gu, (_, avant: string, l: string) => avant + l.toUpperCase());
}

const cleDeCarte = (carte: string) => sansAccents(carte.toLowerCase()).trim();

/** Ce que le foyer a décidé pour cette carte ; undefined si elle est encore inconnue. */
export function choixDeCarte(plan: PlanBudget, carte: string): ChoixCarte | undefined {
  const cle = cleDeCarte(carte);
  const trouve = Object.entries(plan.cartes ?? {}).find(([nom]) => cleDeCarte(nom) === cle);
  return trouve?.[1];
}

/** Retenir le pot d'une carte (ou l'oublier avec null). */
export function retenirCarte(plan: PlanBudget, carte: string, choix: ChoixCarte | null, ctx: Contexte): PlanBudget {
  const cle = cleDeCarte(carte);
  const cartes = Object.fromEntries(Object.entries(plan.cartes ?? {}).filter(([nom]) => cleDeCarte(nom) !== cle));
  if (choix) cartes[nomDeCarte(carte)] = choix;
  return { ...plan, cartes, majLe: ctx.maintenant() };
}

export const paiementsAClasser = (docs: readonly DocBudget[]) =>
  docs.filter((d): d is PaiementAClasser => d.genre === "paiement").sort((a, b) => b.jour.localeCompare(a.jour) || b.creeLe.localeCompare(a.creeLe));

const memeMontant = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** Ce que la fonction serveur fait d'un paiement reçu, et la phrase qu'elle renvoie au raccourci. */
export type Reception =
  | { genre: "depense"; doc: Depense; message: string }
  | { genre: "paiement"; doc: PaiementAClasser; message: string }
  | { genre: "ignore" | "doublon" | "refuse"; message: string };

/** Un paiement envoyé par le raccourci d'un iPhone : une dépense, un paiement à classer, ou rien. */
export function recevoirPaiement(
  entree: { montant?: unknown; marchand?: unknown; carte?: unknown },
  docs: readonly DocBudget[],
  par: Id | null,
  jour: Jour,
  ctx: Contexte,
): Reception {
  const plan = planDe(docs);
  if (!plan) return { genre: "refuse", message: "Le budget n'est pas encore en place dans Kora." };
  const lu = lireMontantPaye(entree.montant);
  if (!lu) return { genre: "refuse", message: "Montant illisible." };
  const carte = nomDeCarte(entree.carte);
  const magasin = nomDeCommercant(entree.marchand);
  const choix = choixDeCarte(plan, carte);
  if (choix === "aucun") return { genre: "ignore", message: `Carte ${carte} : hors du budget du foyer.` };

  // Le même paiement déjà là : envoyé deux fois, ou déjà noté à la main ou par un ticket ce jour-là.
  const deja =
    lu.devise === "CHF" &&
    depenses(docs).some((d) => d.jour === jour && memeMontant(d.montant, lu.montant) && (d.source !== "applepay" || d.magasin === magasin));
  const dejaAClasser = paiementsAClasser(docs).some((p) => p.jour === jour && memeMontant(p.montant, lu.montant) && p.devise === lu.devise && p.marchand === magasin);
  if (deja || dejaAClasser) return { genre: "doublon", message: "Déjà noté." };

  if (choix && lu.devise === "CHF") {
    const brut: Depense = {
      id: ctx.nouvelId(),
      genre: "depense",
      jour,
      montant: lu.montant,
      pot: choix,
      libelle: magasin ?? POTS[choix].nom,
      magasin,
      posteId: null,
      echeance: null,
      source: "applepay",
      carte,
      par,
      creeLe: ctx.maintenant(),
    };
    // Le paiement d'une facture attendue la règle (Kora 0.0.37).
    const doc = reglerFacture(brut, plan, docs);
    if (doc.posteId) return { genre: "depense", doc, message: `Facture ${doc.libelle} payée.` };
    return { genre: "depense", doc, message: `${formaterMontant(lu.montant)} noté dans ${POTS[choix].nom.toLowerCase()}.` };
  }
  const doc: PaiementAClasser = { id: ctx.nouvelId(), genre: "paiement", jour, montant: lu.montant, devise: lu.devise, marchand: magasin, carte, par, creeLe: ctx.maintenant() };
  return { genre: "paiement", doc, message: choix ? "Autre monnaie : à classer dans Kora." : `Carte ${carte} nouvelle : choisis son pot dans Kora.` };
}

/** Classer un paiement : il devient une dépense du pot choisi (montant en francs, revu s'il venait d'une autre monnaie). */
export function classerPaiement(paiement: PaiementAClasser, pot: Pot, montantChf: number, ctx: Contexte): Depense {
  return {
    id: paiement.id,
    genre: "depense",
    jour: paiement.jour,
    montant: auCentime(Math.max(0, montantChf)),
    pot,
    libelle: paiement.marchand ?? POTS[pot].nom,
    magasin: paiement.marchand,
    posteId: null,
    echeance: null,
    source: "applepay",
    carte: paiement.carte,
    par: paiement.par,
    creeLe: ctx.maintenant(),
  };
}

/**
 * Un ticket de caisse (ou une dépense écrite) pour un paiement déjà arrivé par Apple Pay le même
 * jour, du même montant : plutôt qu'une seconde dépense, le ticket complète la première (ses lignes,
 * le nom du magasin). Le pot reste celui de la carte qui a payé. Null s'il n'y a rien à compléter.
 */
export function completerPaiement(nouvelle: Depense, docs: readonly DocBudget[]): Depense | null {
  if (nouvelle.source === "applepay") return null;
  const paye = depenses(docs).find((d) => d.source === "applepay" && d.jour === nouvelle.jour && memeMontant(d.montant, nouvelle.montant) && !d.articles?.length && !d.posteId);
  if (!paye) return null;
  return {
    ...paye,
    libelle: nouvelle.libelle || paye.libelle,
    magasin: nouvelle.magasin ?? paye.magasin,
    posteId: nouvelle.posteId,
    echeance: nouvelle.echeance,
    ...(nouvelle.articles?.length ? { articles: nouvelle.articles } : {}),
  };
}

/** Les cartes que le foyer connaît, avec leur pot, et le dernier paiement reçu de chacune. */
export function cartesDuFoyer(plan: PlanBudget, docs: readonly DocBudget[]): { carte: string; choix: ChoixCarte; dernier: Jour | null }[] {
  const recus = [...depenses(docs), ...paiementsAClasser(docs)].filter((d) => d.carte);
  return Object.entries(plan.cartes ?? {})
    .map(([carte, choix]) => ({
      carte,
      choix,
      dernier: recus.filter((d) => cleDeCarte(d.carte!) === cleDeCarte(carte)).reduce<Jour | null>((m, d) => (!m || d.jour > m ? d.jour : m), null),
    }))
    .sort((a, b) => a.carte.localeCompare(b.carte));
}

/**
 * La phrase à coller dans « Décrire un raccourci » (l'IA de l'app Raccourcis, iOS 26) : elle crée
 * le raccourci « Kora paiement » avec son déclencheur « Lorsque n'importe quelle carte est présentée »,
 * l'adresse de cet iPhone déjà dedans.
 */
export function demandeRaccourci(adresse: string): string {
  return [
    "Crée un raccourci nommé « Kora paiement » qui se lance tout seul, sans demander, lorsque n'importe quelle carte de Wallet est présentée pour payer (déclencheur Transaction), et reçoit cette transaction en entrée.",
    "Il contient une seule action « Obtenir le contenu de l'URL » :",
    `- URL : ${adresse}`,
    "- Méthode : POST",
    "- Corps de la requête : JSON, avec trois champs de type Texte :",
    "  • montant = le Montant de la transaction (entrée du raccourci)",
    "  • marchand = le Commerçant de la transaction",
    "  • carte = le nom de la Carte de la transaction",
    "Pas d'autre action, pas de notification, ne rien afficher.",
  ].join("\n");
}
