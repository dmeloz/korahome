// La maison (Kora 0.0.79) : les jours des déchets et nos appareils. Collection partagée
// `maison` : un seul document « dechets » (les collectes à la porte, réglées une fois pour le
// foyer), et un document par appareil (lave-linge, frigo… avec sa garantie).
// Les jours de collecte changent de rue en rue (à Renens, par secteur) : le foyer les règle
// lui-même, Kora calcule les prochaines dates, dit « Sortir le papier » la veille au soir sur
// l'accueil, et le rappel du matin le redit le jour même.

import { decrireEcheance, ecartJours } from "./taches";
import { NOMS_JOURS } from "./texte";
import type { Contexte, Id, Jour } from "./types";

export const TYPES_DECHETS = [
  { id: "ordures", nom: "Ordures ménagères", sortir: "Sortir les ordures" },
  { id: "papier", nom: "Papier et carton", sortir: "Sortir le papier et le carton" },
  { id: "verre", nom: "Verre", sortir: "Sortir le verre" },
  { id: "verts", nom: "Déchets verts", sortir: "Sortir les déchets verts" },
  { id: "encombrants", nom: "Encombrants", sortir: "Sortir les encombrants" },
] as const;
export type TypeDechet = (typeof TYPES_DECHETS)[number]["id"];

export const RYTHMES = [
  { id: "semaine", nom: "Chaque semaine" },
  { id: "quinzaine", nom: "Toutes les deux semaines" },
  { id: "mois", nom: "Une fois par mois" },
] as const;
export type Rythme = (typeof RYTHMES)[number]["id"];

export interface Collecte {
  type: TypeDechet;
  /** 0 = dimanche … 6 = samedi, comme Date.getDay(). */
  jour: number;
  rythme: Rythme;
  /** Pour « toutes les deux semaines » : une date de collecte connue, qui fixe la bonne semaine. */
  reference?: Jour;
  /** Pour « une fois par mois » : le 1er, 2e, 3e ou 4e jour du mois de ce nom. */
  semaineDuMois?: 1 | 2 | 3 | 4;
}

export interface ReglageDechets {
  id: "dechets";
  type: "dechets";
  collectes: Collecte[];
  modifieLe: string;
}

export interface Appareil {
  id: Id;
  type: "appareil";
  nom: string;
  acheteLe: Jour | null;
  /** La durée de la garantie en mois ; null si on ne sait pas. */
  garantieMois: number | null;
  prix: number | null;
  magasin: string | null;
  /** Où est la notice, le numéro de série, ce qu'on veut retenir. */
  note: string | null;
  creeLe: string;
  modifieLe: string;
}

export type DocMaison = ReglageDechets | Appareil;

export const ID_DECHETS = "dechets";
export const reglageDechets = (docs: readonly DocMaison[]): ReglageDechets | null => docs.find((d): d is ReglageDechets => d.type === "dechets") ?? null;
export const appareilsDe = (docs: readonly DocMaison[]): Appareil[] =>
  docs.filter((d): d is Appareil => d.type === "appareil").sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

export const nomDechet = (type: TypeDechet) => TYPES_DECHETS.find((t) => t.id === type)!.nom;

const jourDeLaSemaine = (jour: Jour) => new Date(`${jour}T12:00:00Z`).getUTCDay();
const decalerJours = (jour: Jour, n: number): Jour => new Date(Date.parse(`${jour}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Le premier jour de ce nom à partir de `depuis` (lui compris). */
function prochainJourNomme(depuis: Jour, jour: number): Jour {
  return decalerJours(depuis, (jour - jourDeLaSemaine(depuis) + 7) % 7);
}

/** Le n-ième jour de ce nom dans le mois de `jour`. */
function jourDuMois(jour: Jour, nomJour: number, n: number): Jour {
  const premier = prochainJourNomme(`${jour.slice(0, 7)}-01`, nomJour);
  return decalerJours(premier, (n - 1) * 7);
}

/** Vrai si ce jour est un jour de collecte. */
export function collecteCeJour(c: Collecte, jour: Jour): boolean {
  if (jourDeLaSemaine(jour) !== c.jour) return false;
  if (c.rythme === "semaine") return true;
  if (c.rythme === "quinzaine") {
    const ref = c.reference ? prochainJourNomme(c.reference, c.jour) : prochainJourNomme("2026-01-01", c.jour);
    return Math.abs(ecartJours(ref, jour)) % 14 === 0;
  }
  return jourDuMois(jour, c.jour, c.semaineDuMois ?? 1) === jour;
}

/** La prochaine collecte à partir d'aujourd'hui (aujourd'hui compris). */
export function prochaineCollecte(c: Collecte, aujourdhui: Jour): Jour {
  let jour = prochainJourNomme(aujourdhui, c.jour);
  for (let i = 0; i < 8 && !collecteCeJour(c, jour); i++) jour = decalerJours(jour, 7);
  return jour;
}

export interface ProchaineCollecte {
  collecte: Collecte;
  jour: Jour;
  /** « demain », « jeudi 30 », « dans 12 jours ». */
  quand: string;
}

/** Les prochaines collectes, la plus proche d'abord. */
export function prochainesCollectes(reglage: ReglageDechets | null, aujourdhui: Jour): ProchaineCollecte[] {
  if (!reglage) return [];
  return reglage.collectes
    .map((collecte) => {
      const jour = prochaineCollecte(collecte, aujourdhui);
      const ecart = ecartJours(aujourdhui, jour);
      const quand = ecart <= 1 ? decrireEcheance(jour, aujourdhui) : ecart < 7 ? `${NOMS_JOURS[jourDeLaSemaine(jour)].toLowerCase()} ${Number(jour.slice(8, 10))}` : decrireEcheance(jour, aujourdhui);
      return { collecte, jour, quand };
    })
    .sort((a, b) => a.jour.localeCompare(b.jour));
}

/** Ce qu'il faut sortir ce soir : les collectes de demain. */
export function aSortirCeSoir(reglage: ReglageDechets | null, aujourdhui: Jour): TypeDechet[] {
  if (!reglage) return [];
  const demain = decalerJours(aujourdhui, 1);
  return reglage.collectes.filter((c) => collecteCeJour(c, demain)).map((c) => c.type);
}

/** Les collectes du jour, pour le rappel du matin. */
export function collectesDuJour(reglage: ReglageDechets | null, aujourdhui: Jour): TypeDechet[] {
  if (!reglage) return [];
  return reglage.collectes.filter((c) => collecteCeJour(c, aujourdhui)).map((c) => c.type);
}

/** « Sortir le papier et le carton », « Sortir les ordures et le verre ». */
export function phraseSortir(types: readonly TypeDechet[]): string {
  if (!types.length) return "";
  if (types.length === 1) return TYPES_DECHETS.find((t) => t.id === types[0])!.sortir;
  const noms = types.map((t) => nomDechet(t).toLowerCase());
  return `Sortir : ${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

/** Pose ou remplace une collecte (une par type) ; `null` la retire. */
export function reglerCollecte(reglage: ReglageDechets | null, type: TypeDechet, collecte: Omit<Collecte, "type"> | null, ctx: Contexte): ReglageDechets {
  const autres = (reglage?.collectes ?? []).filter((c) => c.type !== type);
  const ordre = TYPES_DECHETS.map((t) => t.id);
  const collectes = collecte ? [...autres, { ...collecte, type }] : autres;
  return { id: "dechets", type: "dechets", collectes: collectes.sort((a, b) => ordre.indexOf(a.type) - ordre.indexOf(b.type)), modifieLe: ctx.maintenant() };
}

// ----- Les appareils -----

export const LONGUEUR_NOM_APPAREIL = 60;
/** Une garantie qui finit dans moins de deux mois mérite qu'on le dise. */
export const JOURS_GARANTIE_BIENTOT = 60;

export function nouvelAppareil(nom: string, ctx: Contexte): Appareil | null {
  const n = nom.trim().replace(/\s+/g, " ").slice(0, LONGUEUR_NOM_APPAREIL);
  if (!n) return null;
  return { id: ctx.nouvelId(), type: "appareil", nom: n, acheteLe: null, garantieMois: null, prix: null, magasin: null, note: null, creeLe: ctx.maintenant(), modifieLe: ctx.maintenant() };
}

export function modifierAppareil(a: Appareil, changements: Partial<Omit<Appareil, "id" | "type" | "creeLe" | "modifieLe">>, ctx: Contexte): Appareil {
  const nom = changements.nom === undefined ? a.nom : changements.nom.trim().replace(/\s+/g, " ").slice(0, LONGUEUR_NOM_APPAREIL) || a.nom;
  return { ...a, ...changements, nom, modifieLe: ctx.maintenant() };
}

/** Le dernier jour de la garantie, ou null quand on ne sait pas. */
export function finDeGarantie(a: Appareil): Jour | null {
  if (!a.acheteLe || !a.garantieMois) return null;
  const d = new Date(`${a.acheteLe}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + a.garantieMois);
  return decalerJours(d.toISOString().slice(0, 10), -1);
}

export type EtatGarantie = { etat: "inconnue" } | { etat: "en-cours"; fin: Jour; texte: string } | { etat: "bientot"; fin: Jour; texte: string } | { etat: "finie"; fin: Jour; texte: string };

/** « Garantie jusqu'au 12.03.2028 », « Garantie finit dans 23 jours », « Plus sous garantie ». */
export function etatGarantie(a: Appareil, aujourdhui: Jour): EtatGarantie {
  const fin = finDeGarantie(a);
  if (!fin) return { etat: "inconnue" };
  const ecart = ecartJours(aujourdhui, fin);
  const date = `${fin.slice(8, 10)}.${fin.slice(5, 7)}.${fin.slice(0, 4)}`;
  if (ecart < 0) return { etat: "finie", fin, texte: "Plus sous garantie" };
  if (ecart <= JOURS_GARANTIE_BIENTOT) return { etat: "bientot", fin, texte: ecart === 0 ? "Garantie finit aujourd'hui" : `Garantie finit dans ${ecart} jour${ecart > 1 ? "s" : ""}` };
  return { etat: "en-cours", fin, texte: `Garantie jusqu'au ${date}` };
}

/** « Acheté le 12.03.2026 chez Galaxus · 899 CHF ». */
export function decrireAchat(a: Appareil): string {
  const parts = [
    a.acheteLe ? `Acheté le ${a.acheteLe.slice(8, 10)}.${a.acheteLe.slice(5, 7)}.${a.acheteLe.slice(0, 4)}${a.magasin ? ` chez ${a.magasin}` : ""}` : a.magasin ? `Chez ${a.magasin}` : null,
    a.prix !== null ? `${a.prix % 1 === 0 ? a.prix : a.prix.toFixed(2)} CHF` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
