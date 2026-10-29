import { nomFichierRapport, rapportVersion } from "../domaine/retours";
import type { RetourTest } from "../domaine/retours";
import type { Membre } from "../domaine/types";
import { lireJournal } from "./journal";
import { CLES, ecrireTexte, effacer, lireTexte } from "./stockageLocal";

// Le rapport complet (notes et journal de ce téléphone), à partager ou copier. Les notes
// elles-mêmes partent seules vers le serveur du foyer avec le partage.

export function construireRapport(retours: readonly RetourTest[], membres: readonly Membre[]): { texte: string; nom: string } {
  const maintenant = new Date().toISOString();
  const installee =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const appareil = /iPhone/.test(navigator.userAgent) ? "iPhone" : /iPad/.test(navigator.userAgent) ? "iPad" : "Ordinateur";
  return {
    texte: rapportVersion({
      version: __VERSION__,
      maintenant,
      retours,
      journal: lireJournal(),
      membres,
      environnement: { installee, appareil },
    }),
    nom: nomFichierRapport(__VERSION__, maintenant),
  };
}

/** Ouvre le partage de l'iPhone avec le rapport en fichier, sinon en texte. */
export async function partagerRapport(texte: string, nom: string): Promise<boolean> {
  const fichier = new File([texte], nom, { type: "text/markdown" });
  try {
    if (navigator.canShare?.({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: nom });
      return true;
    }
    if (navigator.share) {
      await navigator.share({ title: nom, text: texte });
      return true;
    }
  } catch {
    return false; // partage annulé
  }
  return copierRapport(texte);
}

export async function copierRapport(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

/**
 * La pastille « Dev » et les retours de test ne se montrent que sur le téléphone qui les a
 * allumés (cinq touchers sur la ligne de la version, dans Réglages). Depuis 0.0.96 : avant,
 * ils étaient là par défaut, sur l'iPhone de Sarah aussi.
 */
export function lirePastilleVisible(): boolean {
  return lireTexte(CLES.pastilleDev) === "visible";
}

export function enregistrerPastilleVisible(visible: boolean): void {
  if (visible) ecrireTexte(CLES.pastilleDev, "visible");
  else effacer(CLES.pastilleDev);
}
