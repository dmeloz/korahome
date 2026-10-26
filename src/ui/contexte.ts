import type { Contexte, Jour } from "../domaine/types";
import { deuxChiffres as deux } from "../domaine/texte";
import { CLES, ecrireTexte, lireTexte } from "./stockageLocal";

export const contexteReel: Contexte = {
  maintenant: () => new Date().toISOString(),
  nouvelId: () => crypto.randomUUID(),
};

/** La date du jour dans le fuseau du téléphone, « AAAA-MM-JJ ». */
export function aujourdhuiLocal(maintenant = new Date()): Jour {
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
}

/** Qui utilise ce téléphone. Propre à l'appareil, jamais synchronisé. */
export function lireMembreCourant(): string | null {
  return lireTexte(CLES.membreCourant);
}

export function choisirMembreCourant(id: string): void {
  // Stockage indisponible (navigation privée) : on redemandera.
  ecrireTexte(CLES.membreCourant, id);
}
