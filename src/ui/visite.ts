import { CLES, ecrireTexte, effacerPrefixe, lireTexte } from "./stockageLocal";

// Si la visite guidée est à montrer sur ce téléphone : une fois au premier lancement,
// puis chaque fois qu'on la redemande depuis Réglages.

let demandee = false;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

/** Sans stockage, on ne l'impose pas à chaque ouverture. */
const dejaVue = (): boolean => lireTexte(CLES.visiteVue, "1") === "1";

export function abonnerVisite(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export const visiteEnAttente = (): boolean => demandee || !dejaVue();

/** Depuis Réglages : relance la visite, et remet les petites aides de chaque page. */
export function demanderVisite() {
  // Stockage indisponible : la visite se relance quand même.
  effacerPrefixe(CLES.prefixeAide);
  demandee = true;
  prevenir();
}

/** Terminée ou passée : elle ne revient plus d'elle-même. */
export function finirVisite() {
  // Stockage indisponible : elle reviendra au prochain lancement.
  ecrireTexte(CLES.visiteVue, "1");
  demandee = false;
  prevenir();
}
