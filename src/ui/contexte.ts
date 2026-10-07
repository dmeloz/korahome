import type { Contexte, Jour } from "../domaine/types";

export const contexteReel: Contexte = {
  maintenant: () => new Date().toISOString(),
  nouvelId: () => crypto.randomUUID(),
};

/** La date du jour dans le fuseau du téléphone, « AAAA-MM-JJ ». */
export function aujourdhuiLocal(maintenant = new Date()): Jour {
  const deux = (n: number) => String(n).padStart(2, "0");
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
