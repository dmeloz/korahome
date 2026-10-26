// L'entretien de la maison : les gestes qu'on oublie parce qu'ils ne reviennent que tous
// les quelques mois (détartrer, changer un filtre, tester le détecteur de fumée). Chacun
// est une tâche qui revient, marquée « entretien » : elle a son onglet dans Tâches et son
// widget, et ne rejoint la liste des tâches que la semaine où elle est due.

import { decaler, decrireEcheance, ecartJours, estTerminee, nouvelleTache } from "./taches";
import type { Contexte, Jour, Recurrence, Tache } from "./types";

export interface EntretienPropose {
  titre: string;
  recurrence: Recurrence;
}

const mois = (tous: number): Recurrence => ({ unite: "mois", tous });

/** Les gestes courants d'un appartement, proposés d'un toucher. */
export const ENTRETIENS_PROPOSES: readonly EntretienPropose[] = [
  { titre: "Détartrer la bouilloire et la machine à café", recurrence: mois(2) },
  { titre: "Nettoyer le filtre du lave-vaisselle", recurrence: mois(1) },
  { titre: "Nettoyer le joint et le filtre du lave-linge", recurrence: mois(2) },
  { titre: "Nettoyer le frigo", recurrence: mois(3) },
  { titre: "Dégivrer le congélateur", recurrence: mois(6) },
  { titre: "Changer le filtre de la hotte", recurrence: mois(3) },
  { titre: "Détartrer la pomme de douche", recurrence: mois(3) },
  { titre: "Nettoyer les grilles d'aération", recurrence: mois(6) },
  { titre: "Tester le détecteur de fumée", recurrence: mois(6) },
  { titre: "Purger les radiateurs", recurrence: mois(12) },
];

export const estEntretien = (t: Tache) => t.categorie === "entretien";

/** Un geste d'entretien, à faire pour la première fois dans une semaine. */
export function nouvelEntretien(propose: EntretienPropose, aujourdhui: Jour, ctx: Contexte): Tache {
  return {
    ...nouvelleTache(propose.titre, propose.recurrence, decaler(aujourdhui, { unite: "jour", tous: 7 }), ctx),
    categorie: "entretien",
  };
}

/** Les propositions pas encore suivies par le foyer. */
export function entretiensAProposer(taches: readonly Tache[]): EntretienPropose[] {
  const suivis = new Set(taches.filter(estEntretien).map((t) => t.titre.toLowerCase()));
  return ENTRETIENS_PROPOSES.filter((p) => !suivis.has(p.titre.toLowerCase()));
}

export interface LigneEntretien {
  tache: Tache;
  /** « dans 12 jours », « en retard de 3 jours » */
  quand: string;
  du: boolean;
  /** « fait il y a 12 jours », quand on l'a déjà fait une fois ; sinon null. Discret : on sait d'un coup d'œil depuis combien de temps. */
  depuis: string | null;
}

/** Depuis combien de temps la dernière fois : « fait hier », « fait il y a 3 mois ». */
export function derniereFois(t: Tache, aujourdhui: Jour): string | null {
  const dernier = t.historique?.reduce<Jour | null>((m, f) => (!m || f.le > m ? f.le : m), null) ?? null;
  if (!dernier) return null;
  const jours = ecartJours(dernier, aujourdhui);
  if (jours <= 0) return "fait aujourd'hui";
  if (jours === 1) return "fait hier";
  if (jours < 60) return `fait il y a ${jours} jours`;
  const mois = Math.round(jours / 30.4);
  return mois < 24 ? `fait il y a ${mois} mois` : `fait il y a ${Math.round(mois / 12)} ans`;
}

/** Le plus pressé d'abord ; « dû » quand la date est passée ou tombe dans la semaine. */
export function organiserEntretien(taches: readonly Tache[], aujourdhui: Jour): LigneEntretien[] {
  return taches
    .filter((t) => estEntretien(t) && !estTerminee(t))
    .sort((a, b) => a.echeance.localeCompare(b.echeance))
    .map((tache) => ({
      tache,
      quand: decrireEcheance(tache.echeance, aujourdhui),
      du: ecartJours(aujourdhui, tache.echeance) <= 7,
      depuis: derniereFois(tache, aujourdhui),
    }));
}
