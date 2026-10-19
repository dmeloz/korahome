// Si la visite guidée est à montrer sur ce téléphone : une fois au premier lancement,
// puis chaque fois qu'on la redemande depuis Réglages.

const CLE = "korahome.visite.vue";
const PREFIXE_AIDES = "korahome.aide.";

let demandee = false;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

function dejaVue(): boolean {
  try {
    return localStorage.getItem(CLE) === "1";
  } catch {
    // Sans stockage, on ne l'impose pas à chaque ouverture.
    return true;
  }
}

export function abonnerVisite(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export const visiteEnAttente = (): boolean => demandee || !dejaVue();

/** Depuis Réglages : relance la visite, et remet les petites aides de chaque page. */
export function demanderVisite() {
  try {
    for (const cle of Object.keys(localStorage)) if (cle.startsWith(PREFIXE_AIDES)) localStorage.removeItem(cle);
  } catch {
    // Stockage indisponible : la visite se relance quand même.
  }
  demandee = true;
  prevenir();
}

/** Terminée ou passée : elle ne revient plus d'elle-même. */
export function finirVisite() {
  try {
    localStorage.setItem(CLE, "1");
  } catch {
    // Stockage indisponible : elle reviendra au prochain lancement.
  }
  demandee = false;
  prevenir();
}
