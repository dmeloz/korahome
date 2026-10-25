import { nettoyerRetirees, type CarteId } from "../domaine/ecranAccueil";
import { nettoyerSignes, type Signe } from "../domaine/signes";
import { CLES, ecrireJson, effacer, lireJson } from "./stockageLocal";

// Ce que chaque téléphone règle pour son accueil, sans jamais le partager : la place et la
// taille de la date, les petits signes choisis, et l'intensité du verre des widgets.

const lire = (cle: string): unknown => lireJson<unknown>(cle, undefined);

/** Stockage indisponible : le réglage vaut pour cette visite. */
function ecrire(cle: string, valeur: unknown): void {
  if (valeur === undefined) effacer(cle);
  else ecrireJson(cle, valeur);
}

// ----- La date -----

export type PlaceDate = "gauche" | "centre";
export interface ReglageDate {
  place: PlaceDate;
  /** La taille du chiffre du jour, en points. */
  taille: number;
}
export const TAILLE_DATE = { min: 22, max: 60, depart: 28 } as const;

export function lireDate(): ReglageDate {
  const brut = lire(CLES.date) as Partial<ReglageDate> | undefined;
  const taille = typeof brut?.taille === "number" ? Math.min(TAILLE_DATE.max, Math.max(TAILLE_DATE.min, Math.round(brut.taille))) : TAILLE_DATE.depart;
  return { place: brut?.place === "centre" ? "centre" : "gauche", taille };
}

export function enregistrerDate(r: ReglageDate): void {
  ecrire(CLES.date, r);
}

// ----- Les petits signes -----

export function lireSignes(): Signe[] {
  return nettoyerSignes(lire(CLES.signes));
}

export function enregistrerSignes(signes: readonly Signe[]): void {
  ecrire(CLES.signes, signes);
}

// ----- Les piles « En ce moment » (depuis 0.0.72) -----

export function lireRetirees(): CarteId[] {
  return nettoyerRetirees(lire(CLES.cartesRetirees));
}

export function enregistrerRetirees(retirees: readonly CarteId[]): void {
  ecrire(CLES.cartesRetirees, retirees.length ? retirees : undefined);
}

/** « Glisse quand c'est fait » : vu combien de fois, et le geste déjà fait une fois. */
export function lireIndiceGlisse(): { vues: number; geste: boolean } {
  const brut = lire(CLES.indiceGlisse) as { vues?: unknown; geste?: unknown } | undefined;
  return { vues: typeof brut?.vues === "number" ? brut.vues : 0, geste: brut?.geste === true };
}

export function enregistrerIndiceGlisse(etat: { vues: number; geste: boolean }): void {
  ecrire(CLES.indiceGlisse, etat);
}

// ----- Le verre des widgets -----
// De 0 (le plus transparent) à 100 (presque plein). Sans choix, le thème décide : le plus
// transparent en sombre, le plus opaque en clair (choix de Melo).

export function lireVerre(): number | null {
  const v = lire(CLES.verre);
  return typeof v === "number" && v >= 0 && v <= 100 ? Math.round(v) : null;
}

export function enregistrerVerre(valeur: number | null): void {
  ecrire(CLES.verre, valeur === null ? undefined : Math.round(valeur));
  appliquerVerre();
}

/**
 * Pose le réglage sur la page. Sur l'iPad 9 (puce A13), le flou derrière une dizaine de cartes
 * est trop lourd : les widgets y restent pleins.
 */
export function appliquerVerre(): void {
  const html = document.documentElement;
  const v = lireVerre();
  if (v === null) html.style.removeProperty("--verre-choisi");
  else html.style.setProperty("--verre-choisi", `${v}%`);
  if (appareilLeger()) html.dataset.leger = "";
  else delete html.dataset.leger;
}

/** L'iPad 9 : écran de 810 × 1080 points, sans puce M. */
function appareilLeger(): boolean {
  const ipad = /iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const cote = Math.min(screen.width, screen.height);
  return ipad && cote === 810;
}
