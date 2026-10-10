import { nomFichierRapport, rapportVersion } from "../domaine/retours";
import type { RetourTest } from "../domaine/retours";
import type { Membre } from "../domaine/types";
import { lireJournal } from "./journal";

// Les trois façons de transmettre le rapport : le déposer sur le Mac qui sert
// l'app (le plus simple), le partager depuis l'iPhone, ou le copier.

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

export type ResultatEnvoi = "depose" | "injoignable" | "refuse";

/** Dépose le rapport dans le dossier retours-de-test/ du Mac qui sert l'app. */
export async function envoyerAuMac(texte: string): Promise<ResultatEnvoi> {
  try {
    const reponse = await fetch("/__kora/retours", {
      method: "POST",
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
      body: texte,
    });
    // En ligne, l'adresse n'existe pas et l'hébergeur répond par la page de l'app : seule
    // la réponse du Mac (en JSON) compte comme un dépôt.
    const duMac = (reponse.headers.get("Content-Type") ?? "").includes("application/json");
    if (reponse.ok && duMac) return "depose";
    if (!duMac) return "injoignable";
    return reponse.status === 404 || reponse.status === 405 ? "injoignable" : "refuse";
  } catch {
    return "injoignable";
  }
}

export const MESSAGES_ENVOI: Record<ResultatEnvoi, string> = {
  depose: "Rapport déposé sur le Mac. Claude peut le lire.",
  injoignable: "Le Mac ne répond pas. Utilise « Partager » à la place.",
  refuse: "Le Mac a refusé le rapport. Utilise « Partager » à la place.",
};

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

const CLE_ENVOI = "korahome.dernierRapport";

export function lireDernierEnvoi(): string | null {
  try {
    return localStorage.getItem(CLE_ENVOI);
  } catch {
    return null;
  }
}

export function noterEnvoi(): void {
  try {
    localStorage.setItem(CLE_ENVOI, new Date().toISOString());
  } catch {
    // rien
  }
}

const CLE_PASTILLE = "korahome.coinDev";

/** La pastille « Dev » est visible sauf si on l'a masquée sur ce téléphone. */
export function lirePastilleVisible(): boolean {
  try {
    return localStorage.getItem(CLE_PASTILLE) !== "masquee";
  } catch {
    return true;
  }
}

export function enregistrerPastilleVisible(visible: boolean): void {
  try {
    if (visible) localStorage.removeItem(CLE_PASTILLE);
    else localStorage.setItem(CLE_PASTILLE, "masquee");
  } catch {
    // rien
  }
}
