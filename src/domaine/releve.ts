import { auCentime, depenses, factureReglee, POTS, type DocBudget, type Depense, type Facture, type PlanBudget, type Pot } from "./budget";
import { ecartJours } from "./taches";
import { nomDeCommercant } from "./paiements";
import type { Contexte, Id, Jour } from "./types";

// Le relevé Revolut d'un mois (export CSV de l'app Revolut), pour ce qu'Apple Pay n'a pas vu :
// achats en ligne, carte en plastique, prélèvements. Kora lit les sorties terminées, laisse de côté
// les virements et les recharges, et ne reprend pas ce qui est déjà noté (même montant à un jour
// près : un paiement Apple Pay, un ticket, ou un relevé déjà importé). Rien d'autre n'est gardé :
// ni numéro de compte, ni solde.

/** Une sortie lue dans le relevé. */
export interface LigneReleve {
  jour: Jour;
  montant: number;
  libelle: string;
  devise: string;
  /** « CARD_PAYMENT », « TRANSFER »… tel que Revolut l'écrit. */
  type: string;
  /** Un virement, une recharge ou un change : pas une dépense, proposé décoché. */
  mouvement: boolean;
}

/** Les colonnes de Revolut, en anglais ou en français. */
const COLONNES: Record<"type" | "debut" | "fin" | "description" | "montant" | "frais" | "devise" | "etat", RegExp> = {
  type: /^type$/,
  debut: /^(started date|date de debut)$/,
  fin: /^(completed date|date de fin|date d'achevement|date de realisation)$/,
  description: /^(description|libelle)$/,
  montant: /^(amount|montant)$/,
  frais: /^(fee|frais)$/,
  devise: /^(currency|devise)$/,
  etat: /^(state|etat|statut)$/,
};

const sansAccents = (t: string) => t.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/^﻿/, "");

/** Découpe une ligne CSV (guillemets compris). */
function cellules(ligne: string, separateur: string): string[] {
  const resultat: string[] = [];
  let courant = "";
  let dansGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (dansGuillemets && ligne[i + 1] === '"') {
        courant += '"';
        i++;
      } else dansGuillemets = !dansGuillemets;
    } else if (c === separateur && !dansGuillemets) {
      resultat.push(courant);
      courant = "";
    } else courant += c;
  }
  resultat.push(courant);
  return resultat.map((x) => x.trim());
}

/** « 2026-10-05 14:32:11 », « 05/10/2026 14:32 », « 05.10.2026 » → « 2026-10-05 ». */
function lireJour(texte: string): Jour | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texte);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const europe = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(texte);
  if (europe) return `${europe[3]}-${europe[2].padStart(2, "0")}-${europe[1].padStart(2, "0")}`;
  return null;
}

/** « -84.30 », « -1,234.50 », « -84,30 » → -84.3. */
function lireNombre(texte: string): number | null {
  const propre = texte.replace(/[’'\s]/g, "");
  if (!propre) return 0;
  const virgule = propre.lastIndexOf(",");
  const point = propre.lastIndexOf(".");
  const normal = virgule > point ? propre.replace(/\./g, "").replace(",", ".") : propre.replace(/,/g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

const MOUVEMENTS = /transfer|virement|topup|top-up|recharge|exchange|change|refund|rembours/i;
const TERMINE = /^(completed|termine|terminee|effectue|effectuee)?$/;

/** Le relevé, ligne par ligne : seulement les sorties terminées. Null si ce n'est pas un relevé Revolut. */
export function lireReleve(texte: string): LigneReleve[] | null {
  const lignes = texte.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (lignes.length < 2) return null;
  const separateur = (lignes[0].match(/;/g)?.length ?? 0) > (lignes[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const entetes = cellules(lignes[0], separateur).map(sansAccents);
  const index = Object.fromEntries(Object.entries(COLONNES).map(([cle, motif]) => [cle, entetes.findIndex((e) => motif.test(e))])) as Record<keyof typeof COLONNES, number>;
  const colonneJour = index.fin >= 0 ? index.fin : index.debut;
  if (colonneJour < 0 || index.montant < 0 || index.description < 0) return null;

  const sorties: LigneReleve[] = [];
  for (const brute of lignes.slice(1)) {
    const c = cellules(brute, separateur);
    if (index.etat >= 0 && !TERMINE.test(sansAccents(c[index.etat] ?? ""))) continue;
    const jour = lireJour(c[colonneJour] ?? "") ?? (index.debut >= 0 ? lireJour(c[index.debut] ?? "") : null);
    const montant = lireNombre(c[index.montant] ?? "");
    const frais = index.frais >= 0 ? (lireNombre(c[index.frais] ?? "") ?? 0) : 0;
    if (!jour || montant === null || montant >= 0) continue;
    const type = index.type >= 0 ? (c[index.type] ?? "") : "";
    const libelle = nomDeCommercant(c[index.description]) ?? "Revolut";
    sorties.push({
      jour,
      montant: auCentime(-montant + Math.abs(frais)),
      libelle,
      devise: (index.devise >= 0 ? c[index.devise] : "") || "CHF",
      type,
      mouvement: MOUVEMENTS.test(type) || /^(to |vers |transfer|virement)/i.test(libelle),
    });
  }
  return sorties.sort((a, b) => a.jour.localeCompare(b.jour));
}

/** Déjà noté : même montant, à un jour près (Apple Pay date l'achat, Revolut parfois le lendemain). */
const correspond = (d: Depense, l: LigneReleve) => Math.abs(d.montant - l.montant) < 0.005 && Math.abs(ecartJours(d.jour, l.jour)) <= 1;

/**
 * Ce que l'import proposera : les nouvelles sorties, et celles déjà notées. Chaque dépense déjà là
 * n'efface qu'une ligne : deux cafés pareils le même jour, dont un seul payé par Apple Pay, laissent
 * le second à importer.
 */
export function preparerReleve(lignes: readonly LigneReleve[], docs: readonly DocBudget[]): { nouvelles: LigneReleve[]; deja: LigneReleve[] } {
  const libres = [...depenses(docs)];
  const nouvelles: LigneReleve[] = [];
  const deja: LigneReleve[] = [];
  for (const l of lignes) {
    const i = libres.findIndex((d) => correspond(d, l));
    if (i >= 0) {
      libres.splice(i, 1);
      deja.push(l);
    } else nouvelles.push(l);
  }
  return { nouvelles, deja };
}

/** Proposée cochée : une vraie dépense en francs (pas un virement, une recharge ou une autre monnaie). */
export const aCocher = (l: LigneReleve) => !l.mouvement && l.devise === "CHF";

/** La facture qu'une ligne du relevé règle, si Kora la reconnaît (un virement compte comme le pot factures). */
export function factureDeLigne(l: LigneReleve, pot: Pot, plan: PlanBudget, docs: readonly DocBudget[]): Facture | null {
  if (l.devise !== "CHF") return null;
  return factureReglee({ montant: l.montant, jour: l.jour, libelle: l.libelle, pot: l.mouvement ? "factures" : pot }, plan, docs);
}

/** Les lignes choisies deviennent des dépenses du pot de ce relevé ; celles qui règlent une facture la marquent payée. */
export function importerReleve(lignes: readonly LigneReleve[], pot: Pot, par: Id | null, ctx: Contexte, plan?: PlanBudget, docs: readonly DocBudget[] = []): Depense[] {
  const ajouts: Depense[] = [];
  for (const l of lignes) {
    const brute: Depense = {
      id: ctx.nouvelId(),
      genre: "depense",
      jour: l.jour,
      montant: l.montant,
      pot,
      libelle: l.libelle || POTS[pot].nom,
      magasin: l.libelle || null,
      posteId: null,
      echeance: null,
      source: "releve",
      par,
      creeLe: ctx.maintenant(),
    };
    const f = plan ? factureDeLigne(l, pot, plan, [...docs, ...ajouts]) : null;
    ajouts.push(f ? { ...brute, pot: f.poste.pot ?? "factures", libelle: f.poste.libelle, posteId: f.poste.id, echeance: f.echeance } : brute);
  }
  return ajouts;
}
