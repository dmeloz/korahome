import { auCentime, depenses, type ArticleTicket, type DocBudget, type Depense } from "./budget";
import { proposer, type ProduitHabituel } from "./catalogue";
import type { ActionJarvis } from "./jarvis";
import type { Lieu } from "./stock";
import { decaler, ecartJours } from "./taches";
import type { Jour } from "./types";

// Le ticket de caisse scanné (Kora 0.1.0, feuille de vérification depuis 0.0.63).
//
// La fée lit la photo ou le PDF du ticket et propose trois choses : les produits à ranger,
// les courses à cocher, le total à compter au Budget. Rien ne s'enregistre avant le oui de la
// personne sur la feuille « Sur le ticket » : chaque ligne se décoche, le total se corrige.
// Si le même montant est déjà arrivé ce jour-là par Apple Pay, le ticket complète ce paiement
// au lieu de compter deux fois.

/** Un produit du ticket, à ranger au stock ou non. */
export interface ProduitDuTicket {
  nom: string;
  lieu: Lieu;
  /** Écrite sur le ticket, sinon devinée (habitude du foyer, puis ce que Kora connaît). */
  peremption: Jour | null;
  garder: boolean;
}

/** Ce que la fée a lu sur le ticket, prêt à vérifier. */
export interface TicketLu {
  produits: ProduitDuTicket[];
  /** Les articles de la liste de courses achetés, à cocher. */
  courses: { texte: string; garder: boolean }[];
  /** Le total payé ; null si la fée ne l'a pas trouvé. */
  total: { montant: number; magasin: string | null; jour: Jour; articles: ArticleTicket[] } | null;
}

/** Au-delà, la date lue sur le ticket est sans doute fausse : on garde aujourd'hui. */
const JOURS_MAX_EN_ARRIERE = 62;

/** Le jour du ticket tel qu'on le compte : aujourd'hui si la date lue manque, est à venir ou trop ancienne. */
export function jourDuTicket(lu: Jour | null, aujourdhui: Jour): Jour {
  if (!lu || !/^\d{4}-\d{2}-\d{2}$/.test(lu)) return aujourdhui;
  const ecart = ecartJours(lu, aujourdhui);
  return ecart < 0 || ecart > JOURS_MAX_EN_ARRIERE ? aujourdhui : lu;
}

/** Les outils proposés par la fée pour un ticket, rangés pour la feuille de vérification. Null s'il n'y a rien. */
export function lireTicket(actions: readonly ActionJarvis[], catalogue: readonly ProduitHabituel[], aujourdhui: Jour): TicketLu | null {
  const produits = actions.flatMap((a) => (a.outil === "ajouter_au_stock" ? a.produits : [])).map((p) => {
    const duree = p.peremption ? null : proposer(catalogue, p.nom)?.dureeJours;
    return { nom: p.nom, lieu: p.lieu, peremption: p.peremption ?? (duree ? decaler(aujourdhui, { unite: "jour", tous: duree }) : null), garder: true };
  });
  const courses = [...new Set(actions.flatMap((a) => (a.outil === "cocher_courses" ? a.articles : [])))].map((texte) => ({ texte, garder: true }));
  const depense = actions.find((a): a is Extract<ActionJarvis, { outil: "noter_depense" }> => a.outil === "noter_depense" && a.montant > 0);
  const total = depense ? { montant: auCentime(depense.montant), magasin: depense.magasin, jour: jourDuTicket(depense.jour, aujourdhui), articles: depense.articles } : null;
  if (!produits.length && !total) return null;
  return { produits, courses, total };
}

/** Le paiement Apple Pay que ce ticket viendra compléter, s'il y en a un. */
export function paiementDuTicket(ticket: TicketLu, docs: readonly DocBudget[]): Depense | null {
  // La même règle que completerPaiement (paiements.ts), qui fera le travail à l'enregistrement.
  const t = ticket.total;
  if (!t) return null;
  return depenses(docs).find((d) => d.source === "applepay" && d.jour === t.jour && Math.abs(d.montant - t.montant) < 0.005 && !d.articles?.length && !d.posteId) ?? null;
}

/** Ce qui s'enregistre au oui : seulement les lignes gardées, et le total s'il compte. */
export function actionsDuTicket(ticket: TicketLu, compterTotal: boolean): ActionJarvis[] {
  const actions: ActionJarvis[] = [];
  const gardes = ticket.produits.filter((p) => p.garder);
  if (gardes.length) actions.push({ outil: "ajouter_au_stock", produits: gardes.map(({ nom, lieu, peremption }) => ({ nom, lieu, peremption })) });
  const courses = ticket.courses.filter((c) => c.garder).map((c) => c.texte);
  if (courses.length) actions.push({ outil: "cocher_courses", articles: courses });
  const t = ticket.total;
  if (t && compterTotal && t.montant > 0) {
    actions.push({ outil: "noter_depense", montant: t.montant, libelle: t.magasin ?? "Courses", magasin: t.magasin, pot: "courses", jour: t.jour, charge: null, articles: t.articles });
  }
  return actions;
}
