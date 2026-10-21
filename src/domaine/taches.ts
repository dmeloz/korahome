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

/**
 * Le rappel à l'heure d'une tâche ne sonne que chez la personne concernée : qui s'en occupe, ou,
 * pour une tâche libre, qui l'a ajoutée. Une tâche libre sans auteur connu sonne chez les deux.
 */
export function concerne(t: Tache, membreId: Id | null): boolean {
  if (membreId === null) return true;
  if (t.responsable) return t.responsable === membreId;
  return !t.creePar || t.creePar === membreId;
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

/** Assez de fois pour voir un rythme et qui fait quoi, sans alourdir la tâche. */
export const HISTORIQUE_GARDE = 12;

/**
 * Marque la tâche comme faite. Une tâche qui revient repart depuis le jour où
 * elle a été faite (faite en retard mardi, chaque semaine → mardi suivant) ;
 * une tâche unique reste faite.
 */
export function marquerFaite(tache: Tache, par: Id | null, aujourdhui: Jour, ctx: Contexte): Tache {
  const maintenant = ctx.maintenant();
  const fois = { le: aujourdhui, par, retard: Math.max(0, ecartJours(tache.echeance, aujourdhui)), a: maintenant };
  const historique = [...(tache.historique ?? []), fois].slice(-HISTORIQUE_GARDE);
  const faite = { ...tache, faiteLe: maintenant, faitePar: par, historique };
  if (!tache.recurrence) return faite;
  const depart = ecartJours(tache.echeance, aujourdhui) < 0 ? tache.echeance : aujourdhui;
  return { ...faite, echeance: decaler(depart, tache.recurrence) };
}

// ----- L'heure d'une tâche -----
// Facultative. Kora la propose : l'heure où la tâche est vraiment cochée d'habitude. Une heure
// choisie à la main (ou « sans heure ») n'est plus jamais remplacée par la proposition.

const RE_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Assez de coches pour parler d'une habitude. */
export const COCHES_POUR_HEURE = 3;

/** « 20:05 » → 1205 minutes ; null si ce n'est pas une heure. */
export function enMinutes(heure: string): number | null {
  if (!RE_HEURE.test(heure)) return null;
  return Number(heure.slice(0, 2)) * 60 + Number(heure.slice(3, 5));
}

export function versHeure(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * L'heure à un instant ISO, en minutes depuis minuit : celle du téléphone, ou celle d'un fuseau
 * (le serveur, réglé en UTC, demande celle du foyer).
 */
export function minutesLocales(instant: string, fuseau?: string): number | null {
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return null;
  if (!fuseau) return d.getHours() * 60 + d.getMinutes();
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: fuseau, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
}

/**
 * L'heure où la tâche est faite d'habitude : la médiane des heures de ses coches, arrondie
 * au quart d'heure, dès trois coches. Avant, aucune.
 */
export function heureProposee(tache: Tache, fuseau?: string): string | null {
  const minutes = (tache.historique ?? [])
    .map((f) => (f.a ? minutesLocales(f.a, fuseau) : null))
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);
  if (minutes.length < COCHES_POUR_HEURE) return null;
  const milieu = Math.floor(minutes.length / 2);
  const mediane = minutes.length % 2 ? minutes[milieu] : (minutes[milieu - 1] + minutes[milieu]) / 2;
  return versHeure(Math.round(mediane / 15) * 15);
}

/** L'heure affichée : celle choisie à la main, sinon celle que propose Kora. */
export function heureDe(tache: Tache, fuseau?: string): string | null {
  return tache.heure !== undefined ? tache.heure : heureProposee(tache, fuseau);
}

/** L'heure vient-elle de Kora (et non d'un choix) ? */
export const heureApprise = (tache: Tache) => tache.heure === undefined && heureProposee(tache) !== null;

/**
 * Change l'heure : « HH:MM » la fixe, null la retire (« sans heure »), undefined rend la main
 * à Kora, qui propose de nouveau l'heure habituelle.
 */
export function changerHeure(tache: Tache, heure: string | null | undefined): Tache {
  if (typeof heure === "string" && enMinutes(heure) === null) throw new ErreurValidation(`Heure invalide : « ${heure} ».`);
  const { heure: _avant, ...reste } = tache;
  return heure === undefined ? reste : { ...reste, heure };
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
    // L'entretien de la maison a son onglet : il ne rejoint les tâches que la semaine où il est dû.
    if (t.categorie === "entretien" && ecart > 7) continue;
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
