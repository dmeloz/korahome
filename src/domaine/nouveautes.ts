// Ce que la fée annonce une fois après une mise à jour (0.0.77) : une phrase, un bouton
// vers la nouveauté, puis silence. Seulement sur un téléphone qui vivait déjà avec Kora :
// un foyer neuf a la visite guidée et la carte de mise en route.

import type { WidgetId } from "./tableauDeBord";

export interface Nouveaute {
  version: string;
  texte: string;
  /** Où va le bouton « Voir ». */
  ou: { id: WidgetId; onglet?: string };
}

export const NOUVEAUTES: readonly Nouveaute[] = [
  { version: "0.0.77", texte: "Nouveau : tes vêtements, dans Maison. Tes tailles, tes envies, ce qui est à trier. L'autre les voit aussi.", ou: { id: "maison", onglet: "vetements" } },
];

/**
 * La nouveauté à dire : celle de la version qui tourne, si elle n'a pas été dite sur ce
 * téléphone et que le foyer a déjà des données (sinon, il découvre Kora en entier).
 */
export function nouveauteADire(version: string, dejaDite: string | null, foyerVivant: boolean): Nouveaute | null {
  if (!foyerVivant || dejaDite === version) return null;
  return NOUVEAUTES.find((n) => n.version === version) ?? null;
}
