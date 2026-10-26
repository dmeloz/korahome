import {
  auCentime,
  avanceeMoisBudget,
  bilanDuMois,
  debutMoisBudget,
  depenses,
  finMoisBudget,
  formaterMontant,
  moisBudget,
  moisPrecedent,
  nomDuMois,
  type DocBudget,
  type PlanBudget,
} from "./budget";
import { decaler, ecartJours } from "./taches";
import type { Id, Jour } from "./types";

// « À toi ce mois » (Kora 0.0.76, version 4 de la maquette du Budget) : ce qui reste du salaire
// de la personne une fois sa part au commun et ses charges payées, puis ce qu'elle a dépensé pour
// elle depuis la paie (les dépenses du pot « perso » qu'elle a payées).
//
// L'anneau ne doit jamais mentir : Kora ne voit les dépenses à soi que si elles arrivent (carte
// réglée sur « À moi » pour Apple Pay, relevé, ou écrites à la fée). Sans dépense à soi depuis
// quinze jours, le suivi est « en attente » : la page montre seulement ce qui était prévu et
// l'avancée du mois, et dit comment brancher les dépenses, plutôt qu'un reste trop beau.

/** Au-delà, sans dépense à soi, Kora ne prétend plus savoir ce qui reste. */
export const JOURS_SANS_SUIVI = 15;
/** Au-delà, le reste est montré mais Kora prévient qu'il est peut-être trop beau. */
export const JOURS_SILENCE = 7;

export interface AMoi {
  membreId: Id;
  /** « AAAA-MM » : le mois de budget, d'une paie à la suivante. */
  mois: string;
  /** Le jour du mois de budget (1 le jour de paie) et le nombre de jours du mois. */
  jour: number;
  jours: number;
  /** Aujourd'hui compris. */
  joursRestants: number;
  fin: Jour;
  /** Ce qui reste du salaire une fois la part au commun et les charges faites. */
  prevu: number;
  /** Les dépenses à soi depuis la paie. */
  depense: number;
  reste: number;
  /** Ce qu'on peut dépenser chaque jour d'ici la paie (0 si plus rien). */
  parJour: number;
  /** Kora voit-il les dépenses à soi ? Sinon, l'anneau montre seulement l'avancée du mois. */
  suivi: boolean;
  /** Le jour de la dernière dépense à soi ; null si aucune. */
  derniere: Jour | null;
  /** De 0 à 1 : la part du mois passée (hier compris). */
  partTemps: number;
  /** De 0 à 1 : la part de « prévu » qui reste. */
  partReste: number;
  /** Dépensé de plus (positif) ou de moins que le mois d'avant au même jour ; null sans mois d'avant à comparer. */
  ecartMoisPrecedent: number | null;
  /** Au rythme de ce mois, ce qui resterait la veille de la paie ; null quand c'est trop tôt pour le dire. */
  restePrevuALaFin: number | null;
  /** Une seule phrase, la plus utile ; vide quand il n'y a rien à dire. */
  phrase: string;
}

const dAMoi = (docs: readonly DocBudget[], moi: Id) => depenses(docs).filter((d) => d.pot === "perso" && d.par === moi);

const leJour = (jour: Jour) => `${Number(jour.slice(8, 10))} ${nomDuMois(Number(jour.slice(5, 7)))}`;
const environ = (n: number) => formaterMontant(n >= 100 ? Math.round(n / 10) * 10 : Math.round(n));

/** « À toi ce mois » pour une personne du plan ; null si elle n'y est pas ou que son salaire n'est pas donné. */
export function etatAMoi(plan: PlanBudget, docs: readonly DocBudget[], moi: Id, aujourdhui: Jour): AMoi | null {
  const personne = bilanDuMois(plan).personnes.find((p) => p.membreId === moi);
  if (!personne || personne.revenu <= 0) return null;
  const mois = moisBudget(plan, aujourdhui);
  const debut = debutMoisBudget(plan, mois);
  const fin = finMoisBudget(plan, mois);
  const { jour, jours } = avanceeMoisBudget(plan, aujourdhui);
  const joursRestants = Math.max(1, jours - jour + 1);
  const miennes = dAMoi(docs, moi).filter((d) => d.jour <= aujourdhui);
  const depense = auCentime(miennes.filter((d) => d.jour >= debut).reduce((t, d) => t + d.montant, 0));
  const prevu = personne.reste;
  const reste = auCentime(prevu - depense);
  const derniere = miennes[0]?.jour ?? null;
  const silence = derniere ? ecartJours(derniere, aujourdhui) : null;
  const suivi = silence !== null && silence < JOURS_SANS_SUIVI;
  const partTemps = jours > 0 ? Math.min(1, (jour - 1) / jours) : 0;

  // Le mois d'avant au même jour : seulement s'il y avait déjà des dépenses à soi.
  let ecartMoisPrecedent: number | null = null;
  if (suivi) {
    const debutAvant = debutMoisBudget(plan, moisPrecedent(mois));
    const memeJour = decaler(debutAvant, { unite: "jour", tous: jour - 1 });
    const avant = dAMoi(docs, moi).filter((d) => d.jour >= debutAvant && d.jour < debut);
    if (avant.length) ecartMoisPrecedent = auCentime(depense - avant.filter((d) => d.jour <= memeJour).reduce((t, d) => t + d.montant, 0));
  }

  // Le rythme ne dit quelque chose qu'après quelques jours de dépenses notées.
  const restePrevuALaFin = suivi && jour >= 5 ? auCentime(prevu - (depense / jour) * jours) : null;

  let phrase = "";
  if (!suivi) {
    phrase = derniere
      ? `Rien de noté pour toi depuis le ${leJour(derniere)} : l'anneau montre ce qui était prévu, pas ce qui reste.`
      : "Kora ne voit pas encore tes dépenses à toi : règle ta carte sur « À moi » dans Comptes, ou écris « 12 café pour moi » à ta fée.";
  } else if (silence !== null && silence >= JOURS_SILENCE) {
    phrase = `Rien de noté pour toi depuis ${silence} jours : il reste peut-être moins.`;
  } else if (reste < 0) {
    phrase = `Tu as dépassé de ${environ(-reste)}. Le mois repart le ${leJour(decaler(fin, { unite: "jour", tous: 1 }))}.`;
  } else if (restePrevuALaFin !== null) {
    phrase =
      restePrevuALaFin < 0
        ? `Plus vite que prévu : à ce rythme, il manquerait environ ${environ(-restePrevuALaFin)} le ${leJour(fin)}.`
        : restePrevuALaFin < prevu * 0.1
          ? `Un peu plus vite que prévu : il resterait environ ${environ(restePrevuALaFin)} le ${leJour(fin)}.`
          : `Au bon rythme : il devrait te rester environ ${environ(restePrevuALaFin)} le ${leJour(fin)}.`;
  }

  return {
    membreId: moi,
    mois,
    jour,
    jours,
    joursRestants,
    fin,
    prevu,
    depense,
    reste,
    parJour: auCentime(Math.max(0, reste) / joursRestants),
    suivi,
    derniere,
    partTemps,
    partReste: prevu > 0 ? Math.min(1, Math.max(0, reste / prevu)) : 0,
    ecartMoisPrecedent,
    restePrevuALaFin,
    phrase,
  };
}

/** Ce qu'une personne a dépensé chaque jour (tous les pots), des `combien` derniers jours à aujourd'hui. */
export function depensesParJour(docs: readonly DocBudget[], moi: Id, aujourdhui: Jour, combien = 12): { jour: Jour; total: number; nombre: number }[] {
  const siennes = depenses(docs).filter((d) => d.par === moi);
  return Array.from({ length: combien }, (_, i) => {
    const jour = decaler(aujourdhui, { unite: "jour", tous: i - combien + 1 });
    const du = siennes.filter((d) => d.jour === jour);
    return { jour, total: auCentime(du.reduce((t, d) => t + d.montant, 0)), nombre: du.length };
  });
}

/** Les documents du budget qu'un téléphone montre : les dépenses à soi des autres n'y sont pas. */
export function budgetVisible<T extends DocBudget>(docs: readonly T[], moi: Id | null): T[] {
  return docs.filter((d) => d.genre !== "depense" || d.pot !== "perso" || d.par === moi);
}

export interface ApercuAutre {
  membreId: Id;
  /** Sa part prévue au commun chaque mois. */
  versement: number;
  /** Ses dépenses pour le commun ce mois (pas les siennes à soi). */
  depensesCommunes: number;
  nombre: number;
}

/** Ce qu'on voit de l'autre : sa part au commun et ce qu'il a payé pour le foyer ce mois. Jamais son salaire. */
export function apercuAutre(plan: PlanBudget, docs: readonly DocBudget[], autre: Id, aujourdhui: Jour): ApercuAutre | null {
  const personne = plan.personnes.find((p) => p.membreId === autre);
  if (!personne) return null;
  const debut = debutMoisBudget(plan, moisBudget(plan, aujourdhui));
  const communes = depenses(docs).filter((d) => d.par === autre && d.pot !== "perso" && d.jour >= debut && d.jour <= aujourdhui);
  return { membreId: autre, versement: personne.versement, depensesCommunes: auCentime(communes.reduce((t, d) => t + d.montant, 0)), nombre: communes.length };
}
