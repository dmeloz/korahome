import { useSyncExternalStore } from "react";
import { feeDe, type Fee, type TeinteFee } from "../domaine/fee";
import { heuresDiscretes, nettoyerRenvois, type AllureMeteo, type Eclat } from "../domaine/vieFee";
import { aujourdhuiLocal } from "./contexte";
import { CLES, ecrireJson, ecrireTexte, effacer, lireJson, lireTexte } from "./stockageLocal";

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
  /** Elle l'a dit d'elle-même : la renvoyer compte pour sa discrétion. */
  spontanee?: boolean;
  /** « Hey ! Listen ! » : la bulle crie. */
  crie?: boolean;
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

/**
 * Dit la chose si le moment s'y prête ; faux sinon, pour réessayer plus tard. Ce qui n'est pas
 * urgent attend aussi qu'on ne soit pas à une heure où elle a appris à se taire.
 */
export function direSiCalme(p: Parole, urgent = false): boolean {
  const html = document.documentElement.classList;
  if (parole || Date.now() - dernierGeste < CALME_MS || html.contains("saisie-ouverte") || html.contains("feuille-ouverte")) return false;
  // La nuit, ou pendant qu'elle scintille pour une alerte, seul l'urgent passe.
  if (!urgent && (etat.nuit || etat.alerte || heuresDiscretes(lireRenvois()).has(new Date().getHours()))) return false;
  direFee({ ...p, spontanee: true });
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

// ----- Son état : éclat, nuit, météo, alerte, joie -----

export interface EtatFee {
  eclat: Eclat;
  nuit: boolean;
  allure: AllureMeteo;
  /** Elle scintille près d'un widget : la toucher fait dire l'alerte. */
  alerte: Parole | null;
  /** Où elle vole (un sélecteur de l'écran), au lieu de sa place. */
  cible: string | null;
  joie: boolean;
  /** Le réveil : elle s'étire. */
  etire: boolean;
}

let etat: EtatFee = { eclat: "normal", nuit: false, allure: null, alerte: null, cible: null, joie: false, etire: false };
const abonnesEtat = new Set<() => void>();

export function changerEtatFee(changement: Partial<EtatFee>): void {
  const suivant = { ...etat, ...changement };
  if ((Object.keys(changement) as (keyof EtatFee)[]).every((k) => suivant[k] === etat[k])) return;
  etat = suivant;
  abonnesEtat.forEach((a) => a());
}

export const lireEtatFee = () => etat;

export function useEtatFee(): EtatFee {
  return useSyncExternalStore(
    (a) => {
      abonnesEtat.add(a);
      return () => abonnesEtat.delete(a);
    },
    () => etat,
  );
}

const JOIE_MS = 1400;
const ENTRE_JOIES_MS = 10_000;
let derniereJoie = 0;

/** Une tâche faite par moi : elle fait une petite boucle et scintille (une fois toutes les 10 s au plus). */
export function feteFee(): void {
  if (Date.now() - derniereJoie < ENTRE_JOIES_MS) return;
  derniereJoie = Date.now();
  changerEtatFee({ joie: true });
  setTimeout(() => changerEtatFee({ joie: false }), JOIE_MS);
}

/** Touchée la nuit, elle reste réveillée dix minutes. */
let eveilleeJusqua = 0;
export function reveillerFee(): void {
  eveilleeJusqua = Date.now() + 10 * 60_000;
  changerEtatFee({ nuit: false });
}
export const estEveillee = () => Date.now() < eveilleeJusqua;

// ----- Son tintement (coupé tant qu'on ne l'a pas allumé dans Réglages) -----

export function sonActif(): boolean {
  return lireTexte(CLES.feeSon) === "1";
}
export function changerSon(actif: boolean): void {
  // vaut pour cette visite
  if (actif) ecrireTexte(CLES.feeSon, "1");
  else effacer(CLES.feeSon);
}

let audio: AudioContext | null = null;
/** Deux notes claires, comme une clochette. Safari ne joue un son qu'après un premier toucher. */
export function tinter(force = false): void {
  if (!force && !sonActif()) return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const t = audio.currentTime;
    [1318.5, 1760].forEach((f, i) => {
      const o = audio!.createOscillator();
      const g = audio!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.5);
      o.connect(g).connect(audio!.destination);
      o.start(t + i * 0.12);
      o.stop(t + i * 0.12 + 0.55);
    });
  } catch {
    // Pas de son : elle scintille quand même.
  }
}

// ----- Sa discrétion apprise -----

export function lireRenvois() {
  try {
    return nettoyerRenvois(lireJson<unknown>(CLES.feeRenvois, []), aujourdhuiLocal());
  } catch {
    // Un jour mal écrit fait lever le nettoyage.
    return [];
  }
}

/**
 * Une bulle qu'elle a dite d'elle-même, renvoyée d'un toucher ailleurs. Renvoie l'heure quand
 * elle vient d'apprendre à s'y taire (pour le dire une fois), sinon null.
 */
export function noterRenvoi(): number | null {
  const heure = new Date().getHours();
  const renvois = [...lireRenvois(), { jour: aujourdhuiLocal(), heure }];
  if (!ecrireJson(CLES.feeRenvois, renvois)) return null;
  try {
    if (!heuresDiscretes(renvois).has(heure)) return null;
    const dites: number[] = JSON.parse(lireTexte(CLES.feeDiscreteDit) ?? "[]");
    if (dites.includes(heure)) return null;
    return ecrireJson(CLES.feeDiscreteDit, [...dites, heure]) ? heure : null;
  } catch {
    return null;
  }
}

/** Réglages › La fée › Remettre à zéro : elle reparle à toute heure. */
export function oublierDiscretion(): void {
  effacer(CLES.feeRenvois);
  effacer(CLES.feeDiscreteDit);
}

// ----- Ce que j'ai déjà vu de l'autre -----

/** Null la toute première fois : tout ce qui est déjà là compte alors comme vu. */
export function lireVues(): Set<string> | null {
  const brut = lireTexte(CLES.feeVues, false);
  if (brut === false) return new Set();
  if (brut === null) return null;
  try {
    const v: unknown = JSON.parse(brut);
    return new Set(Array.isArray(v) ? v.filter((c): c is string => typeof c === "string") : []);
  } catch {
    return new Set();
  }
}

export function enregistrerVues(vues: Iterable<string>): void {
  // Stockage indisponible : l'icône reviendra à la prochaine ouverture.
  ecrireJson(CLES.feeVues, [...vues]);
}

// ----- Où elle se tient -----

export interface PlaceFee {
  cote: "gauche" | "droite";
  /** Distance au bas de l'écran, en points. */
  bas: number;
  /** Rangée contre le bord, à moitié cachée. */
  rangee: boolean;
}

export const PLACE_DE_DEPART: PlaceFee = { cote: "droite", bas: 96, rangee: false };

export function lirePlace(): PlaceFee {
  const v = lireJson<Partial<PlaceFee> | null>(CLES.placeFee, null);
  if (!v) return PLACE_DE_DEPART;
  return {
    cote: v.cote === "gauche" ? "gauche" : "droite",
    bas: typeof v.bas === "number" && v.bas >= 0 ? v.bas : PLACE_DE_DEPART.bas,
    rangee: v.rangee === true,
  };
}

export function enregistrerPlace(p: PlaceFee): void {
  // La place vaut pour cette visite.
  ecrireJson(CLES.placeFee, p);
}
