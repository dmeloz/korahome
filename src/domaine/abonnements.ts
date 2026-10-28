// Les abonnements et les contrats du foyer (Kora 0.0.91, proposition 6 de la nuit du 26 octobre) :
// assurance, Swisscom, salle de sport, Netflix. Chacun est déjà une charge du Budget (`Poste`) ;
// ici on lui ajoute son contrat : jusqu'à quand il court et combien de mois avant il faut
// résilier. Kora calcule la date limite, la dit sur l'accueil et dans le rappel du matin avant
// que le contrat ne se renouvelle tout seul. Page Organisation › Administratif.

import { CATEGORIES_POSTE, formaterMontant, parMois, planDe, type Contrat, type DocBudget, type Poste } from "./budget";
import { decaler, decrireEcheance, ecartJours } from "./taches";
import { NOMS_MOIS } from "./texte";
import type { Contexte, Id, Jour } from "./types";

/** Les catégories de charges qui sont des contrats à résilier. */
export const CATEGORIES_CONTRAT = ["abonnement", "assurance"] as const;

export const PREAVIS_PROPOSES = [0, 1, 2, 3, 6] as const;
/** On prévient quand la limite tombe dans les 45 jours. */
export const JOURS_AVANT_LIMITE = 45;
export const JOURS_LIMITE_PRESSEE = 7;

export const estContrat = (p: Poste) => (CATEGORIES_CONTRAT as readonly string[]).includes(p.categorie);

export const contratVide = (): Contrat => ({ fin: null, preavisMois: 1, tacite: true, note: null });

/** La fin de la période en cours : une fin tacite passée avance d'un an jusqu'à aujourd'hui ou plus tard. */
export function finEnCours(c: Contrat, aujourdhui: Jour): Jour | null {
  if (!c.fin) return null;
  let fin = c.fin;
  if (!c.tacite) return fin;
  for (let i = 0; i < 40 && fin < aujourdhui; i++) fin = decaler(fin, { unite: "mois", tous: 12 });
  return fin;
}

/** Le dernier jour pour résilier : la fin moins le préavis. Null sans date de fin. */
export function dateLimite(c: Contrat, aujourdhui: Jour): Jour | null {
  const fin = finEnCours(c, aujourdhui);
  if (!fin) return null;
  return c.preavisMois > 0 ? decaler(fin, { unite: "mois", tous: -c.preavisMois }) : fin;
}

export interface LigneContrat {
  poste: Poste;
  contrat: Contrat;
  parMois: number;
  fin: Jour | null;
  limite: Jour | null;
  /** Jours restants avant la limite ; négatif quand elle est passée, null sans date. */
  dansJours: number | null;
  /** « Résiliable jusqu'au 30.11.2026 », « Se renouvelle le 01.01.2027 », « Pas de date ». */
  etat: string;
  presse: boolean;
}

const dateCourte = (j: Jour) => `${j.slice(8, 10)}.${j.slice(5, 7)}.${j.slice(0, 4)}`;

function decrireLigne(c: Contrat, fin: Jour | null, limite: Jour | null, aujourdhui: Jour): string {
  if (!fin || !limite) return c.tacite ? "Pas de date : se renouvelle sans prévenir" : "Pas de date";
  const ecart = ecartJours(aujourdhui, limite);
  if (ecart < 0) return c.tacite ? `Renouvelé jusqu'au ${dateCourte(decaler(fin, { unite: "mois", tous: 12 }))}` : `Fini le ${dateCourte(fin)}`;
  if (c.preavisMois === 0) return c.tacite ? `Résiliable à tout moment, se renouvelle le ${dateCourte(fin)}` : `Jusqu'au ${dateCourte(fin)}`;
  return `Résilier avant le ${dateCourte(limite)}${ecart <= JOURS_AVANT_LIMITE ? ` · ${ecart === 0 ? "dernier jour" : `${ecart} jour${ecart > 1 ? "s" : ""}`}` : ""}`;
}

/** Les contrats du foyer, le plus pressé d'abord, puis sans date. `qui` : seulement ces personnes (et le commun). */
export function contratsDe(postes: readonly Poste[], aujourdhui: Jour, qui?: readonly (string | null)[]): LigneContrat[] {
  return postes
    .filter((p) => estContrat(p) && (!qui || qui.includes(p.qui)))
    .map((poste) => {
      const contrat = poste.contrat ?? contratVide();
      const fin = finEnCours(contrat, aujourdhui);
      const limite = dateLimite(contrat, aujourdhui);
      const dansJours = limite ? ecartJours(aujourdhui, limite) : null;
      return { poste, contrat, parMois: parMois(poste), fin, limite, dansJours, etat: decrireLigne(contrat, fin, limite, aujourdhui), presse: dansJours !== null && dansJours >= 0 && dansJours <= JOURS_LIMITE_PRESSEE };
    })
    .sort((a, b) => (a.dansJours ?? 9999) - (b.dansJours ?? 9999) || a.poste.libelle.localeCompare(b.poste.libelle, "fr"));
}

/** Les contrats dont la limite de résiliation tombe dans les 45 jours (et pas passée depuis plus d'un jour). */
export function aResilierBientot(postes: readonly Poste[], aujourdhui: Jour, jours = JOURS_AVANT_LIMITE): LigneContrat[] {
  return contratsDe(postes, aujourdhui).filter((l) => l.dansJours !== null && l.dansJours >= 0 && l.dansJours <= jours && l.contrat.preavisMois > 0);
}

/** « Résilier Sunrise avant le 30 novembre », pour l'accueil et le rappel du matin. */
export function phraseResiliation(l: LigneContrat): string {
  if (!l.limite) return `Décider pour ${l.poste.libelle}`;
  const jour = Number(l.limite.slice(8, 10));
  const mois = NOMS_MOIS[Number(l.limite.slice(5, 7)) - 1];
  return `Résilier ${l.poste.libelle} avant le ${jour === 1 ? "1er" : jour} ${mois}`;
}

/** « avant le 30 nov. · 23 jours » en court, pour la ligne de l'accueil. */
export function quandResilier(l: LigneContrat, aujourdhui: Jour): string {
  if (!l.limite) return "sans date";
  return decrireEcheance(l.limite, aujourdhui);
}

/** Une résiliation qui approche, pour l'accueil et le rappel du matin (comme `facturesDuJour`). */
export interface ResiliationDuJour {
  id: Id;
  /** « Résilier Sunrise avant le 30 novembre ». */
  texte: string;
  limite: Jour;
  /** Jours restants, 0 le dernier jour. */
  dansJours: number;
}

/** Les contrats à résilier dans les `jours` qui viennent, depuis les documents du Budget. */
export function resiliationsDuJour(docs: readonly DocBudget[], aujourdhui: Jour, jours = JOURS_AVANT_LIMITE): ResiliationDuJour[] {
  const plan = planDe(docs);
  if (!plan) return [];
  return aResilierBientot(plan.postes, aujourdhui, jours).map((l) => ({ id: l.poste.id, texte: phraseResiliation(l), limite: l.limite!, dansJours: l.dansJours! }));
}

/** Le total par mois des contrats, pour l'en-tête de la carte. */
export const totalParMois = (lignes: readonly LigneContrat[]) => Math.round(lignes.reduce((s, l) => s + l.parMois, 0) * 100) / 100;

/** « 6 contrats · 142.50 CHF par mois », ou une invitation. */
export function resumeContrats(lignes: readonly LigneContrat[]): string {
  if (!lignes.length) return "Aucun contrat noté";
  return `${lignes.length} contrat${lignes.length > 1 ? "s" : ""} · ${formaterMontant(totalParMois(lignes))} par mois`;
}

export const nomCategorie = (p: Poste) => CATEGORIES_POSTE[p.categorie];

/** Pose ou change le contrat d'une charge. */
export function poserContrat(poste: Poste, changements: Partial<Contrat>, _ctx: Contexte): Poste {
  const avant = poste.contrat ?? contratVide();
  const preavisMois = Math.max(0, Math.min(24, Math.round(changements.preavisMois ?? avant.preavisMois)));
  const note = changements.note === undefined ? avant.note : changements.note?.trim().slice(0, 200) || null;
  return { ...poste, contrat: { ...avant, ...changements, preavisMois, note } };
}
