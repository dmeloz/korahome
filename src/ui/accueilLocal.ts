import { nettoyerSignes, type Signe } from "../domaine/signes";

// Ce que chaque téléphone règle pour son accueil, sans jamais le partager : la place et la
// taille de la date, les petits signes choisis, et l'intensité du verre des widgets.

function lire(cle: string): unknown {
  try {
    const brut = localStorage.getItem(cle);
    return brut === null ? undefined : JSON.parse(brut);
  } catch {
    return undefined;
  }
}

function ecrire(cle: string, valeur: unknown): void {
  try {
    if (valeur === undefined) localStorage.removeItem(cle);
    else localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Stockage indisponible : le réglage vaut pour cette visite.
  }
}

// ----- La date -----

export type PlaceDate = "gauche" | "centre";
export interface ReglageDate {
  place: PlaceDate;
  /** La taille du chiffre du jour, en points. */
  taille: number;
}
export const TAILLE_DATE = { min: 22, max: 60, depart: 28 } as const;
const CLE_DATE = "korahome.date";

export function lireDate(): ReglageDate {
  const brut = lire(CLE_DATE) as Partial<ReglageDate> | undefined;
  const taille = typeof brut?.taille === "number" ? Math.min(TAILLE_DATE.max, Math.max(TAILLE_DATE.min, Math.round(brut.taille))) : TAILLE_DATE.depart;
  return { place: brut?.place === "centre" ? "centre" : "gauche", taille };
}

export function enregistrerDate(r: ReglageDate): void {
  ecrire(CLE_DATE, r);
}

// ----- Les petits signes -----

const CLE_SIGNES = "korahome.signes";

export function lireSignes(): Signe[] {
  return nettoyerSignes(lire(CLE_SIGNES));
}

export function enregistrerSignes(signes: readonly Signe[]): void {
  ecrire(CLE_SIGNES, signes);
}

// ----- Le verre des widgets -----
// De 0 (le plus transparent) à 100 (presque plein). Sans choix, le thème décide : le plus
// transparent en sombre, le plus opaque en clair (choix de Melo).

const CLE_VERRE = "korahome.verre";

export function lireVerre(): number | null {
  const v = lire(CLE_VERRE);
  return typeof v === "number" && v >= 0 && v <= 100 ? Math.round(v) : null;
}

export function enregistrerVerre(valeur: number | null): void {
  ecrire(CLE_VERRE, valeur === null ? undefined : Math.round(valeur));
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
