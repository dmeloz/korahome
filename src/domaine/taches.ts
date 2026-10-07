import { ErreurValidation } from "./foyer";
import type { Contexte, Id, Jour, Recurrence, Tache } from "./types";

// Les dates du jour sont des chaînes « AAAA-MM-JJ » dans le fuseau du téléphone.
// L'interface fournit « aujourd'hui » : ce module ne lit jamais l'horloge lui-même.

const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

function versDate(jour: Jour): Date {
  if (!RE_JOUR.test(jour)) throw new ErreurValidation(`Date invalide : « ${jour} ».`);
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}

function versJour(d: Date): Jour {
  return d.toISOString().slice(0, 10);
}

/** Ajoute des jours, des semaines ou des mois à une date du jour. */
export function decaler(jour: Jour, recurrence: Recurrence): Jour {
  const d = versDate(jour);
  if (recurrence.unite === "jour") d.setUTCDate(d.getUTCDate() + recurrence.tous);
  else if (recurrence.unite === "semaine") d.setUTCDate(d.getUTCDate() + 7 * recurrence.tous);
  else {
    // Un mois plus tard, en restant sur le dernier jour si le mois est plus court (31 janv. → 28 févr.).
    const jourDuMois = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + recurrence.tous);
    const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(jourDuMois, dernier));
  }
  return versJour(d);
}

/** Nombre de jours entre deux dates (positif si « b » est après « a »). */
export function ecartJours(a: Jour, b: Jour): number {
  return Math.round((versDate(b).getTime() - versDate(a).getTime()) / 86_400_000);
}

export const RECURRENCES: { libelle: string; valeur: Recurrence | null }[] = [
  { libelle: "Une fois", valeur: null },
  { libelle: "Chaque jour", valeur: { unite: "jour", tous: 1 } },
  { libelle: "Chaque semaine", valeur: { unite: "semaine", tous: 1 } },
  { libelle: "Toutes les 2 semaines", valeur: { unite: "semaine", tous: 2 } },
  { libelle: "Chaque mois", valeur: { unite: "mois", tous: 1 } },
];

export function decrireRecurrence(r: Recurrence | null): string {
  if (!r) return "Une fois";
  const connue = RECURRENCES.find(
    (x) => x.valeur && x.valeur.unite === r.unite && x.valeur.tous === r.tous,
  );
  if (connue) return connue.libelle;
  const unite = { jour: "jours", semaine: "semaines", mois: "mois" }[r.unite];
  return `Tous les ${r.tous} ${unite}`;
}

export function nouvelleTache(
  titre: string,
  recurrence: Recurrence | null,
  echeance: Jour,
  ctx: Contexte,
  responsable: Id | null = null,
): Tache {
  const t = titre.trim().replace(/\s+/g, " ");
  if (t.length === 0) throw new ErreurValidation("La tâche doit avoir un nom.");
  if (recurrence && (!Number.isInteger(recurrence.tous) || recurrence.tous < 1)) {
    throw new ErreurValidation("La fréquence doit être d'au moins 1.");
  }
  versDate(echeance);
  return {
    id: ctx.nouvelId(),
    titre: t.charAt(0).toUpperCase() + t.slice(1),
    recurrence,
    echeance,
    responsable,
    faiteLe: null,
    faitePar: null,
    creeLe: ctx.maintenant(),
  };
}

/**
 * Marque la tâche comme faite. Une tâche qui revient repart depuis le jour où
 * elle a été faite (faite en retard mardi, chaque semaine → mardi suivant) ;
 * une tâche unique reste faite.
 */
export function marquerFaite(tache: Tache, par: Id | null, aujourdhui: Jour, ctx: Contexte): Tache {
  const faite = { ...tache, faiteLe: ctx.maintenant(), faitePar: par };
  if (!tache.recurrence) return faite;
  const depart = ecartJours(tache.echeance, aujourdhui) < 0 ? tache.echeance : aujourdhui;
  return { ...faite, echeance: decaler(depart, tache.recurrence) };
}

/** Une tâche unique faite est terminée ; une tâche qui revient ne l'est jamais. */
export function estTerminee(tache: Tache): boolean {
  return !tache.recurrence && tache.faiteLe !== null;
}

/** Chacun choisit ses tâches : prendre une tâche libre, ou la rendre libre. */
export function prendre(tache: Tache, membre: Id): Tache {
  return { ...tache, responsable: membre };
}

export function liberer(tache: Tache): Tache {
  return { ...tache, responsable: null };
}

export type Filtre = "toutes" | "miennes" | "libres";

export interface GroupeTaches {
  cle: "retard" | "aujourdhui" | "semaine" | "plus-tard";
  titre: string;
  taches: Tache[];
}

/**
 * Prépare l'écran : tâches à faire groupées par échéance (en retard,
 * aujourd'hui, les 7 prochains jours, plus tard), puis les tâches uniques déjà faites.
 */
export function organiserTaches(
  taches: Tache[],
  aujourdhui: Jour,
  filtre: Filtre = "toutes",
  moi: Id | null = null,
): { groupes: GroupeTaches[]; terminees: Tache[] } {
  const visibles = taches.filter((t) => {
    if (filtre === "miennes") return moi !== null && t.responsable === moi;
    if (filtre === "libres") return t.responsable === null;
    return true;
  });
  const aFaire = visibles
    .filter((t) => !estTerminee(t))
    .sort((a, b) => a.echeance.localeCompare(b.echeance) || a.titre.localeCompare(b.titre, "fr"));
  const groupes: GroupeTaches[] = [
    { cle: "retard", titre: "En retard", taches: [] },
    { cle: "aujourdhui", titre: "Aujourd'hui", taches: [] },
    { cle: "semaine", titre: "Cette semaine", taches: [] },
    { cle: "plus-tard", titre: "Plus tard", taches: [] },
  ];
  for (const t of aFaire) {
    const ecart = ecartJours(aujourdhui, t.echeance);
    const i = ecart < 0 ? 0 : ecart === 0 ? 1 : ecart <= 7 ? 2 : 3;
    groupes[i].taches.push(t);
  }
  const terminees = visibles
    .filter(estTerminee)
    .sort((a, b) => (b.faiteLe ?? "").localeCompare(a.faiteLe ?? ""));
  return { groupes: groupes.filter((g) => g.taches.length > 0), terminees };
}

/** Ce que l'accueil affiche : combien de tâches sont dues aujourd'hui ou en retard. */
export function compterDues(taches: Tache[], aujourdhui: Jour): { aujourdhui: number; enRetard: number } {
  let du = 0;
  let retard = 0;
  for (const t of taches) {
    if (estTerminee(t)) continue;
    const ecart = ecartJours(aujourdhui, t.echeance);
    if (ecart < 0) retard++;
    else if (ecart === 0) du++;
  }
  return { aujourdhui: du, enRetard: retard };
}

/** « en retard de 2 jours », « aujourd'hui », « demain », « dans 5 jours ». */
export function decrireEcheance(echeance: Jour, aujourdhui: Jour): string {
  const ecart = ecartJours(aujourdhui, echeance);
  if (ecart < -1) return `en retard de ${-ecart} jours`;
  if (ecart === -1) return "depuis hier";
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return "demain";
  return `dans ${ecart} jours`;
}

/** Tâches de la semaine choisies par le foyer, proposées quand la liste est vide. */
export const TACHES_DE_LA_SEMAINE = [
  "Ménage",
  "Linge",
  "Poubelles et recyclage",
  "Courses",
  "Litière de Mitsu",
  "Arrosage",
] as const;

export function tachesDeDepart(aujourdhui: Jour, ctx: Contexte): Tache[] {
  return TACHES_DE_LA_SEMAINE.map((titre) =>
    nouvelleTache(titre, { unite: "semaine", tous: 1 }, aujourdhui, ctx),
  );
}
