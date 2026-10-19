import { useSyncExternalStore } from "react";
import { feeDe, type Fee, type TeinteFee } from "../domaine/fee";

// La fée de ce téléphone (Tael ou Navi) et ce qu'elle est en train de dire. Toute page peut la
// faire parler (un signe touché, le mot du jour) ; c'est la fée, en bas, qui montre la bulle.

let courante: Fee = feeDe(null);
const abonnesFee = new Set<() => void>();

/** La fée suit la personne de ce téléphone ; ses couleurs passent par `html[data-fee]`. */
export function definirFee(prenom: string | null | undefined): void {
  const f = feeDe(prenom);
  if (typeof document !== "undefined") document.documentElement.dataset.fee = f.teinte;
  if (f.nom === courante.nom) return;
  courante = f;
  queueMicrotask(() => abonnesFee.forEach((a) => a()));
}

/** Le nom que l'écran donne à l'assistant : « Tael t'écoute », « Demande à Navi ». */
export const nomFee = (): string => courante.nom;

export function useFee(): Fee {
  return useSyncExternalStore(
    (a) => {
      abonnesFee.add(a);
      return () => abonnesFee.delete(a);
    },
    () => courante,
  );
}

// ----- Ce qu'elle dit -----

export interface ActionParole {
  texte: string;
  faire?: () => void;
}

export interface Parole {
  /** Une même chose n'est pas dite deux fois de suite. */
  cle: string;
  texte: string;
  /** Un message de l'autre : son prénom en tête de bulle, à la couleur de sa fée. */
  de?: { prenom: string; teinte: TeinteFee };
  actions?: ActionParole[];
  /** Fermée sans toucher d'action (le temps passé, un toucher ailleurs). */
  sansSuite?: () => void;
}

let parole: Parole | null = null;
const abonnesParole = new Set<() => void>();
const prevenir = () => abonnesParole.forEach((a) => a());

export function direFee(p: Parole): void {
  parole = p;
  prevenir();
}

// Elle ne parle d'elle-même que si l'écran est calme : rien à dire déjà, aucun geste depuis
// quelques secondes, ni saisie ni feuille ouverte.
const CALME_MS = 4000;
let dernierGeste = 0;
if (typeof window !== "undefined") {
  const geste = () => (dernierGeste = Date.now());
  window.addEventListener("pointerdown", geste, true);
  window.addEventListener("scroll", geste, { passive: true });
}

/** Dit la chose si le moment s'y prête ; faux sinon, pour réessayer plus tard. */
export function direSiCalme(p: Parole): boolean {
  const html = document.documentElement.classList;
  if (parole || Date.now() - dernierGeste < CALME_MS || html.contains("saisie-ouverte") || html.contains("feuille-ouverte")) return false;
  direFee(p);
  return true;
}

/** Ferme la bulle (seulement la sienne quand on donne une clé). */
export function taireFee(cle?: string): void {
  if (!parole || (cle && parole.cle !== cle)) return;
  parole = null;
  prevenir();
}

export function useParoleFee(): Parole | null {
  return useSyncExternalStore(
    (a) => {
      abonnesParole.add(a);
      return () => abonnesParole.delete(a);
    },
    () => parole,
  );
}

// ----- Ce que j'ai déjà vu de l'autre -----

const CLE_VUES = "korahome.feeVues";

/** Null la toute première fois : tout ce qui est déjà là compte alors comme vu. */
export function lireVues(): Set<string> | null {
  try {
    const brut = localStorage.getItem(CLE_VUES);
    if (brut === null) return null;
    const v: unknown = JSON.parse(brut);
    return new Set(Array.isArray(v) ? v.filter((c): c is string => typeof c === "string") : []);
  } catch {
    return new Set();
  }
}

export function enregistrerVues(vues: Iterable<string>): void {
  try {
    localStorage.setItem(CLE_VUES, JSON.stringify([...vues]));
  } catch {
    // Stockage indisponible : l'icône reviendra à la prochaine ouverture.
  }
}

// ----- Où elle se tient -----

export interface PlaceFee {
  cote: "gauche" | "droite";
  /** Distance au bas de l'écran, en points. */
  bas: number;
  /** Rangée contre le bord, à moitié cachée. */
  rangee: boolean;
}

const CLE_PLACE = "korahome.fee";
export const PLACE_DE_DEPART: PlaceFee = { cote: "droite", bas: 96, rangee: false };

export function lirePlace(): PlaceFee {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_PLACE) ?? "null") as Partial<PlaceFee> | null;
    if (!v) return PLACE_DE_DEPART;
    return {
      cote: v.cote === "gauche" ? "gauche" : "droite",
      bas: typeof v.bas === "number" && v.bas >= 0 ? v.bas : PLACE_DE_DEPART.bas,
      rangee: v.rangee === true,
    };
  } catch {
    return PLACE_DE_DEPART;
  }
}

export function enregistrerPlace(p: PlaceFee): void {
  try {
    localStorage.setItem(CLE_PLACE, JSON.stringify(p));
  } catch {
    // La place vaut pour cette visite.
  }
}
