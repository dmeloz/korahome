// Le filet des enregistrements lancés sans attendre (un toucher, un glissement) : si l'écriture
// échoue (iPhone plein, base fermée), l'erreur est notée dans le journal et un bandeau dit quoi
// faire, au lieu d'un silence où la modification semble faite (veille du 26 octobre 2026).

import { expliquerErreur } from "../domaine/erreurs";
import { ignorer } from "./journal";

type Ecouteur = (texte: string) => void;
let ecouteur: Ecouteur | null = null;

/** Le bandeau des messages s'abonne ici (FournisseurAnnulation). */
export function ecouterEchecs(f: Ecouteur): () => void {
  ecouteur = f;
  return () => {
    if (ecouteur === f) ecouteur = null;
  };
}

/** Lance l'enregistrement sans l'attendre ; un échec est noté et dit à la personne. */
export function sauver(promesse: Promise<unknown>, quoi = "La modification"): void {
  promesse.catch((e: unknown) => {
    ignorer(e);
    ecouteur?.(`Pas enregistré. ${expliquerErreur(e, quoi)}`);
  });
}
