// Ce que la fée annonce une fois après une mise à jour (0.0.79) : une phrase, un bouton
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
  { version: "0.0.93", texte: "Nouveau : « Où est quoi » dans Maison › Entretien. Note la cave, le placard et ce qu'il y a dedans, puis demande-moi où est la perceuse.", ou: { id: "maison", onglet: "entretien" } },
  { version: "0.0.91", texte: "Nouveau : tes abonnements dans Organisation › Administratif. Note la fin et le préavis, je te dis quand résilier avant le renouvellement.", ou: { id: "taches", onglet: "administratif" } },
  { version: "0.0.94", texte: "Nouveau : notre réserve de secours, sous le stock de Cuisine › Frigo. Une semaine de provisions pour deux ; ce qui manque part aux courses.", ou: { id: "chef", onglet: "frigo" } },
  { version: "0.0.87", texte: "Nouveau : le carnet de la maison, dans Maison › Entretien. Le concierge, la gérance, le compteur : demande-les-moi quand tu les cherches.", ou: { id: "maison", onglet: "entretien" } },
  { version: "0.0.85", texte: "Nouveau : en magasin, touche le soleil des courses, l'écran reste allumé. Kora apprend l'ordre de tes rayons en te regardant cocher.", ou: { id: "courses" } },
  { version: "0.0.79", texte: "Nouveau : tes vêtements, dans Maison. Tes tailles, tes envies, ce qui est à trier. L'autre les voit aussi.", ou: { id: "maison", onglet: "vetements" } },
];

/**
 * La nouveauté à dire : celle de la version qui tourne, si elle n'a pas été dite sur ce
 * téléphone et que le foyer a déjà des données (sinon, il découvre Kora en entier).
 */
export function nouveauteADire(version: string, dejaDite: string | null, foyerVivant: boolean): Nouveaute | null {
  if (!foyerVivant || dejaDite === version) return null;
  return NOUVEAUTES.find((n) => n.version === version) ?? null;
}
