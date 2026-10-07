import type { Contexte } from "../domaine/types";

export const contexteReel: Contexte = {
  maintenant: () => new Date().toISOString(),
  nouvelId: () => crypto.randomUUID(),
};

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
