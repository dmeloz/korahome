import { useEffect, useRef } from "react";
import { clinDuJour, DEMANDE_CLIN, nouveauClin } from "../domaine/bandeau";
import { decrireFoyer } from "../domaine/jarvis";
import type { Depot } from "../donnees/depot";
import type { ServeurJarvis } from "../donnees/distant";
import type { DonneesModule } from "./modules";
import { CLES, ecrireTexte, lireTexte } from "./stockageLocal";

// Le clin d'œil du jour : une phrase de l'assistant pour vous deux, demandée une fois par jour
// pour tout le foyer (le premier téléphone ouvert s'en charge), puis dite par la fée.

/** Le temps de laisser la synchro apporter le clin d'œil déjà demandé par l'autre téléphone. */
const ATTENTE_CLIN_MS = 8000;
/** Le clin d'œil se demande à partir de 6 h. */
const HEURE_CLIN = 6;

/** La fée l'a-t-elle déjà dit sur ce téléphone aujourd'hui ? */
export const clinDejaDit = (jour: string) => lireTexte(CLES.clinVu) === jour;
export const noterClinDit = (jour: string) => {
  ecrireTexte(CLES.clinVu, jour);
};

export function useClinDuJour(props: { donnees: DonneesModule; depot: Depot; jarvis: { serveur: ServeurJarvis; foyerId: string } | null }) {
  const { donnees, depot, jarvis } = props;
  const dejaLa = !!clinDuJour(donnees.couple, donnees.aujourdhui);
  const lu = useRef(donnees);
  lu.current = donnees;

  useEffect(() => {
    if (!jarvis || dejaLa || new Date().getHours() < HEURE_CLIN) return;
    if (lireTexte(CLES.clinDemande) === donnees.aujourdhui) return;
    const id = setTimeout(async () => {
      const d = lu.current;
      if (clinDuJour(d.couple, d.aujourdhui) || lireTexte(CLES.clinDemande) === d.aujourdhui) return;
      // Sans stockage, on redemandera ; le serveur a son plafond.
      ecrireTexte(CLES.clinDemande, d.aujourdhui);
      try {
        const reponse = await jarvis.serveur.demanderJarvis({
          foyerId: jarvis.foyerId,
          demande: DEMANDE_CLIN,
          etat: decrireFoyer({ ...d, version: __VERSION__ }, d.membreId, d.aujourdhui),
          historique: [],
        });
        const clin = nouveauClin(d.aujourdhui, reponse.texte);
        if (clin) await depot.enregistrerCouple(clin);
      } catch {
        // Sans l'assistant aujourd'hui (plafond, hors ligne), la fée s'en passe.
      }
    }, ATTENTE_CLIN_MS);
    return () => clearTimeout(id);
  }, [jarvis, dejaLa, donnees.aujourdhui, depot]);
}
