import type { Contexte, Jour } from "../domaine/types";
import { deuxChiffres as deux } from "../domaine/texte";

export const contexteReel: Contexte = {
  maintenant: () => new Date().toISOString(),
  nouvelId: () => crypto.randomUUID(),
};

/** La date du jour dans le fuseau du téléphone, « AAAA-MM-JJ ». */
export function aujourdhuiLocal(maintenant = new Date()): Jour {
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
}

const CLE_MEMBRE = "korahome.membreCourant";

/** Qui utilise ce téléphone. Propre à l'appareil, jamais synchronisé. */
export function lireMembreCourant(): string | null {
  try {
    return localStorage.getItem(CLE_MEMBRE);
  } catch {
    return null;
  }
}

export function choisirMembreCourant(id: string): void {
  try {
    localStorage.setItem(CLE_MEMBRE, id);
  } catch {
    // Stockage indisponible (navigation privée) : on redemandera.
  }
}

const CLE_TABLEAU = "korahome.tableauDeBord";

/** La disposition du tableau de bord. Propre à chaque téléphone. */
export function lireDisposition(): unknown {
  try {
    const brut = localStorage.getItem(CLE_TABLEAU);
    return brut === null ? undefined : JSON.parse(brut);
  } catch {
    return undefined;
  }
}

export function enregistrerDisposition(disposition: readonly string[]): void {
  try {
    localStorage.setItem(CLE_TABLEAU, JSON.stringify(disposition));
  } catch {
    // Stockage indisponible : la disposition vaut pour cette visite seulement.
  }
}

// Depuis Kora 0.0.23, les widgets sont petits au départ : une nouvelle clé, les anciennes tailles sont oubliées.
const CLE_TAILLES = "korahome.taillesWidgets.2";

/** La taille de chaque widget (petit ou grand). Propre à chaque téléphone, comme la disposition. */
export function lireTailles(): unknown {
  try {
    const brut = localStorage.getItem(CLE_TAILLES);
    return brut === null ? undefined : JSON.parse(brut);
  } catch {
    return undefined;
  }
}

export function enregistrerTailles(tailles: object): void {
  try {
    localStorage.setItem(CLE_TAILLES, JSON.stringify(tailles));
  } catch {
    // Stockage indisponible : les tailles valent pour cette visite seulement.
  }
}
