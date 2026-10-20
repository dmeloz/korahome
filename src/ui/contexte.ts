import type { Contexte, Jour } from "../domaine/types";
import { deuxChiffres as deux } from "../domaine/texte";
import { CLES, ecrireJson, ecrireTexte, lireJson, lireTexte } from "./stockageLocal";

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

/** La disposition du tableau de bord. Propre à chaque téléphone. */
export function lireDisposition(): unknown {
  return lireJson<unknown>(CLES.tableauDeBord, undefined);
}

export function enregistrerDisposition(disposition: readonly string[]): void {
  // Stockage indisponible : la disposition vaut pour cette visite seulement.
  ecrireJson(CLES.tableauDeBord, disposition);
}

/** La taille de chaque widget (petit ou grand). Propre à chaque téléphone, comme la disposition. */
export function lireTailles(): unknown {
  return lireJson<unknown>(CLES.taillesWidgets, undefined);
}

export function enregistrerTailles(tailles: object): void {
  // Stockage indisponible : les tailles valent pour cette visite seulement.
  ecrireJson(CLES.taillesWidgets, tailles);
}
