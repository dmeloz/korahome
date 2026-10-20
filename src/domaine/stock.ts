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

/** Les unités d'un produit : on compte les pièces, on pèse le reste. */
export type Unite = "piece" | "g" | "kg" | "ml" | "l";

export const UNITES: Record<Unite, string> = { piece: "pièce", g: "g", kg: "kg", ml: "ml", l: "l" };
export const ORDRE_UNITES: readonly Unite[] = ["piece", "g", "kg", "ml", "l"];

export interface Produit {
  id: Id;
  nom: string;
  /**
   * La quantité en texte (« 2 », « 500 g »), tenue à jour à chaque écriture pour les
   * versions de Kora d'avant les unités ; null quand on ne l'a pas notée.
   */
  quantite: string | null;
  /** Depuis Kora 0.0.10 : la quantité en nombre et son unité. Absents des produits plus anciens. */
  nombre?: number | null;
  unite?: Unite | null;
  lieu: Lieu;
  /** La date limite (à consommer ou de préférence) ; null quand il n'y en a pas. */
  peremption: Jour | null;
  /** Code-barres scanné et photo de la fiche Open Food Facts, quand il y en a. */
  code?: string | null;
  image?: string | null;
  ajoutePar: Id | null;
  creeLe: string;
}

/** Un produit dont la date tombe dans 3 jours ou moins est à consommer bientôt. */
export const JOURS_BIENTOT = 3;

export interface NouveauProduit {
  nom: string;
  nombre: number | null;
  unite: Unite | null;
  lieu: Lieu;
  peremption: Jour | null;
  code?: string | null;
  image?: string | null;
}

export function creerProduit(saisie: NouveauProduit, ajoutePar: Id | null, ctx: Contexte): Produit {
  const nom = majuscule(saisie.nom.trim().replace(/\s+/g, " "));
  if (nom.length === 0) throw new ErreurValidation("Le produit est vide.");
  return avecQuantite({
    id: ctx.nouvelId(),
    nom,
    quantite: null,
    nombre: saisie.nombre,
    unite: saisie.nombre === null ? null : (saisie.unite ?? "piece"),
    lieu: saisie.lieu,
    peremption: saisie.peremption,
    code: saisie.code ?? null,
    image: saisie.image ?? null,
    ajoutePar,
    creeLe: ctx.maintenant(),
  });
}

/** Ajout d'une ligne de texte, comme en 0.0.9 : « 2 yaourts ». */
export function nouveauProduit(
  saisie: { texte: string; lieu: Lieu; peremption: Jour | null },
  ajoutePar: Id | null,
  ctx: Contexte,
): Produit {
  const { texte, quantite } = analyserSaisie(saisie.texte);
  const { nombre, unite } = lireQuantite(quantite);
  return creerProduit({ nom: texte, nombre, unite, lieu: saisie.lieu, peremption: saisie.peremption }, ajoutePar, ctx);
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « 500 g » → 500 g ; « 1,5 l » → 1.5 l ; « 2 » → 2 pièces ; « 33 cl » → 330 ml. */
export function lireQuantite(texte: string | null): { nombre: number | null; unite: Unite | null } {
  const m = texte?.trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*([a-zéèêîôû]*)$/);
  if (!m) return { nombre: null, unite: null };
  const n = Number(m[1].replace(",", "."));
  const u = m[2];
  if (u === "cl") return { nombre: n * 10, unite: "ml" };
  if (u === "g" || u === "kg" || u === "ml" || u === "l") return { nombre: n, unite: u };
  return { nombre: n, unite: "piece" };
}

/** Le nombre et l'unité d'un produit, y compris d'un produit écrit avant les unités. */
export function quantiteDe(p: Produit): { nombre: number | null; unite: Unite | null } {
  if (p.nombre !== undefined) return { nombre: p.nombre ?? null, unite: p.nombre == null ? null : (p.unite ?? "piece") };
  return lireQuantite(p.quantite);
}

const nombreEnTexte = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/** « 2 », « 500 g », « 1,5 l » ; null sans quantité. */
export function decrireQuantite(nombre: number | null, unite: Unite | null): string | null {
  if (nombre === null) return null;
  return !unite || unite === "piece" ? nombreEnTexte(nombre) : `${nombreEnTexte(nombre)} ${unite}`;
}

/** Recopie la quantité en texte, que lisent encore les téléphones restés en 0.0.9. */
export function avecQuantite(p: Produit): Produit {
  const { nombre, unite } = quantiteDe(p);
  return { ...p, nombre, unite, quantite: decrireQuantite(nombre, unite) };
}

/** De combien les boutons − et + changent la quantité : par petits pas sous 100 g (ou 0,5 kg). */
export function pasDe(unite: Unite | null, nombre: number, sens: 1 | -1): number {
  const petit = (seuil: number) => (sens === 1 ? nombre < seuil : nombre <= seuil);
  if (unite === "g" || unite === "ml") return petit(100) ? 25 : 100;
  if (unite === "kg" || unite === "l") return petit(0.5) ? 0.25 : 0.5;
  return 1;
}

/**
 * Un toucher sur − ou + : la quantité change d'un pas. Sans quantité notée, on compte
 * une pièce. Arrivé à zéro, le produit est fini : null.
 */
export function ajuster(p: Produit, sens: 1 | -1): Produit | null {
  const { nombre, unite } = quantiteDe(p);
  const actuel = nombre ?? 1;
  const pas = pasDe(unite, actuel, sens);
  const suivant = Math.round((actuel + sens * pas) * 100) / 100;
  if (suivant <= 0) return null;
  return avecQuantite({ ...p, nombre: suivant, unite: unite ?? "piece" });
}

/**
 * Ce qui reste de sa durée de vie, de 1 (tout frais) à 0 (à sa date) ; null sans date.
 * La durée court du jour de l'ajout à la date limite.
 */
export function fraicheur(p: Produit, aujourdhui: Jour): number | null {
  if (!p.peremption) return null;
  const total = ecartJours(p.creeLe.slice(0, 10), p.peremption);
  const reste = ecartJours(aujourdhui, p.peremption);
  if (reste <= 0) return 0;
  if (total <= 0) return 1;
  return Math.min(1, reste / total);
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
export function decrirePeremption(p: Pick<Produit, "peremption">, aujourdhui: Jour): string | null {
  if (!p.peremption) return null;
  const ecart = ecartJours(aujourdhui, p.peremption);
  if (ecart < -1) return `périmé depuis ${-ecart} jours`;
  if (ecart === -1) return "périmé depuis hier";
  if (ecart === 0) return "à consommer aujourd'hui";
  if (ecart === 1) return "demain";
  if (ecart <= 7) return `dans ${ecart} jours`;
  const jourMois = `${p.peremption.slice(8, 10)}.${p.peremption.slice(5, 7)}`;
  // Au-delà de six mois, l'année évite de lire « jusqu'au 11.10 » comme cette semaine.
  return ecart > 180 ? `jusqu'au ${jourMois}.${p.peremption.slice(2, 4)}` : `jusqu'au ${jourMois}`;
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
  return avecQuantite({ ...p, lieu });
}

const JOURS_SEMAINE = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/** « Aujourd'hui », « Demain », « Vendredi 16.10 ». */
export function nommerJour(jour: Jour, aujourdhui: Jour): string {
  const ecart = ecartJours(aujourdhui, jour);
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return "Demain";
  const [a, m, j] = jour.split("-").map(Number);
  return `${JOURS_SEMAINE[new Date(Date.UTC(a, m - 1, j)).getUTCDay()]} ${jour.slice(8, 10)}.${jour.slice(5, 7)}`;
}

export interface JourCalendrier {
  cle: string;
  titre: string;
  produits: Produit[];
  /** Déjà passé, aujourd'hui ou dans les trois jours. */
  urgent: boolean;
}

/**
 * Les dates à venir, jour par jour : ce qui est déjà passé d'abord, puis chaque jour
 * des deux prochaines semaines qui a quelque chose, puis « Plus tard ».
 */
export function calendrierDates(produits: readonly Produit[], aujourdhui: Jour, jours = 14): JourCalendrier[] {
  const dates = produits.filter((p) => p.peremption).sort(parDate);
  const resultat: JourCalendrier[] = [];
  const passes = dates.filter((p) => ecartJours(aujourdhui, p.peremption!) < 0);
  if (passes.length) resultat.push({ cle: "passe", titre: "Date passée", produits: passes, urgent: true });
  const parJour = new Map<Jour, Produit[]>();
  for (const p of dates) {
    const ecart = ecartJours(aujourdhui, p.peremption!);
    if (ecart >= 0 && ecart < jours) parJour.set(p.peremption!, [...(parJour.get(p.peremption!) ?? []), p]);
  }
  for (const [jour, ceJour] of parJour) {
    resultat.push({ cle: jour, titre: nommerJour(jour, aujourdhui), produits: ceJour, urgent: ecartJours(aujourdhui, jour) <= JOURS_BIENTOT });
  }
  const tard = dates.filter((p) => ecartJours(aujourdhui, p.peremption!) >= jours);
  if (tard.length) resultat.push({ cle: "tard", titre: "Plus tard", produits: tard, urgent: false });
  return resultat;
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
