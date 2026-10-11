// Frigo, congélateur et placard : ce qu'il y a à la maison et ce qui arrive à sa
// date. Ce qui est fini part sur la liste de courses du foyer, la seule.

import { ErreurValidation } from "./foyer";
import { analyserSaisie } from "./listes";
import { decaler, ecartJours } from "./taches";
import type { Contexte, Id, Jour } from "./types";

export type Lieu = "frigo" | "congelateur" | "placard";

export const LIEUX: Record<Lieu, string> = {
  frigo: "Frigo",
  congelateur: "Congélateur",
  placard: "Placard",
};

export const ORDRE_LIEUX: readonly Lieu[] = ["frigo", "congelateur", "placard"];

export interface Produit {
  id: Id;
  nom: string;
  /** « 2 », « 500 g », « 1 l » ; null quand on ne l'a pas noté. */
  quantite: string | null;
  lieu: Lieu;
  /** La date limite (à consommer ou de préférence) ; null quand il n'y en a pas. */
  peremption: Jour | null;
  ajoutePar: Id | null;
  creeLe: string;
}

/** Un produit dont la date tombe dans 3 jours ou moins est à consommer bientôt. */
export const JOURS_BIENTOT = 3;

export function nouveauProduit(
  saisie: { texte: string; lieu: Lieu; peremption: Jour | null },
  ajoutePar: Id | null,
  ctx: Contexte,
): Produit {
  const { texte, quantite } = analyserSaisie(saisie.texte);
  if (texte.length === 0) throw new ErreurValidation("Le produit est vide.");
  return {
    id: ctx.nouvelId(),
    nom: texte,
    quantite,
    lieu: saisie.lieu,
    peremption: saisie.peremption,
    ajoutePar,
    creeLe: ctx.maintenant(),
  };
}

/** Les dates proposées d'un toucher, comme des raccourcis. */
export function datesRapides(aujourdhui: Jour): { libelle: string; jour: Jour }[] {
  return [
    { libelle: "Demain", jour: decaler(aujourdhui, { unite: "jour", tous: 1 }) },
    { libelle: "3 jours", jour: decaler(aujourdhui, { unite: "jour", tous: 3 }) },
    { libelle: "1 semaine", jour: decaler(aujourdhui, { unite: "semaine", tous: 1 }) },
    { libelle: "1 mois", jour: decaler(aujourdhui, { unite: "mois", tous: 1 }) },
    { libelle: "3 mois", jour: decaler(aujourdhui, { unite: "mois", tous: 3 }) },
  ];
}

export type EtatProduit = "perime" | "aujourdhui" | "bientot" | "ok" | "sansDate";

export function etatProduit(p: Produit, aujourdhui: Jour): EtatProduit {
  if (!p.peremption) return "sansDate";
  const ecart = ecartJours(aujourdhui, p.peremption);
  if (ecart < 0) return "perime";
  if (ecart === 0) return "aujourdhui";
  return ecart <= JOURS_BIENTOT ? "bientot" : "ok";
}

/** Périmé, à consommer aujourd'hui ou dans les trois jours. */
export function estAConsommer(p: Produit, aujourdhui: Jour): boolean {
  const e = etatProduit(p, aujourdhui);
  return e === "perime" || e === "aujourdhui" || e === "bientot";
}

const parDate = (a: Produit, b: Produit) =>
  (a.peremption ?? "9999-12-31").localeCompare(b.peremption ?? "9999-12-31") || a.nom.localeCompare(b.nom, "fr");

/** « périmé depuis 2 jours », « aujourd'hui », « demain », « dans 3 jours », « jusqu'au 12.11 ». */
export function decrirePeremption(p: Produit, aujourdhui: Jour): string | null {
  if (!p.peremption) return null;
  const ecart = ecartJours(aujourdhui, p.peremption);
  if (ecart < -1) return `périmé depuis ${-ecart} jours`;
  if (ecart === -1) return "périmé depuis hier";
  if (ecart === 0) return "à consommer aujourd'hui";
  if (ecart === 1) return "demain";
  if (ecart <= 7) return `dans ${ecart} jours`;
  return `jusqu'au ${p.peremption.slice(8, 10)}.${p.peremption.slice(5, 7)}`;
}

export interface GroupeStock {
  cle: "aConsommer" | Lieu;
  titre: string;
  produits: Produit[];
}

/**
 * Ce qui arrive à sa date d'abord, tous lieux confondus, puis chaque lieu, chacun
 * trié par date. Un filtre sur un lieu ne garde que ses produits.
 */
export function organiserStock(produits: readonly Produit[], aujourdhui: Jour, lieu: Lieu | "tous" = "tous"): GroupeStock[] {
  const choisis = produits.filter((p) => lieu === "tous" || p.lieu === lieu);
  const urgents = choisis.filter((p) => estAConsommer(p, aujourdhui)).sort(parDate);
  const groupes: GroupeStock[] = [];
  if (urgents.length) groupes.push({ cle: "aConsommer", titre: "À consommer", produits: urgents });
  for (const l of ORDRE_LIEUX) {
    const ici = choisis.filter((p) => p.lieu === l && !estAConsommer(p, aujourdhui)).sort(parDate);
    if (ici.length) groupes.push({ cle: l, titre: LIEUX[l], produits: ici });
  }
  return groupes;
}

export function deplacer(p: Produit, lieu: Lieu): Produit {
  return { ...p, lieu };
}

/** Ce que le stock montre sur l'accueil et dans le rappel du matin. */
export function resumeStock(produits: readonly Produit[], aujourdhui: Jour): { aConsommer: Produit[]; urgent: boolean } {
  const aConsommer = produits.filter((p) => estAConsommer(p, aujourdhui)).sort(parDate);
  const urgent = aConsommer.some((p) => {
    const e = etatProduit(p, aujourdhui);
    return e === "perime" || e === "aujourdhui";
  });
  return { aConsommer, urgent };
}
