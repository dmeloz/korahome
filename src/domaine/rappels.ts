import { decrireCourt, evenementsDuMatin, type Evenement } from "./agenda";
import { decrireEcheanceFacture } from "./budget";
import { gestesDuJardin, type Zone } from "./jardin";
import { meteoFraiche, type Meteo } from "./meteo";
import { choseAFaire, type Animal } from "./mitsu";
import { resumeStock, type Produit } from "./stock";
import { ecartJours, estTerminee } from "./taches";
import type { Foyer, Id, Jour, Tache } from "./types";

// Le rappel du matin : une seule notification par personne, à son heure (8 h au départ), qui résume ce
// qui l'attend ce jour-là. Chacun reçoit ses tâches et les tâches libres (pas
// celles que l'autre a prises), ce qui presse pour Mitsu, ce qui arrive à sa
// date au frigo ou au placard, et au jardin le gel annoncé et ce qui est à
// arroser. Rien à signaler :
// pas de notification. Ce module sert aussi au serveur qui envoie les rappels
// (supabase/functions/rappels) : il reste sans dépendance.

/** Le serveur lit la météo du jardin à la même adresse que le téléphone. */
export { adresseMeteo, lireMeteo } from "./meteo";
/** Et il annonce les mots du couple, tout de suite ou à l'heure prévue. */
export { fenetreMotsProgrammes, notificationMot } from "./bandeau";
/** Et il lit l'agenda du jour. */
export { evenementsDe } from "./agenda";
/** Et les factures du Budget à payer bientôt. */
export { facturesDuJour } from "./budget";

/** Ce que chaque personne choisit de recevoir, sur son téléphone. */
export interface PreferencesRappels {
  taches: boolean;
  mitsu: boolean;
  /** Ce qui arrive à sa date au frigo, au congélateur ou au placard. */
  stock: boolean;
  /** Le gel annoncé et les zones du jardin à arroser. */
  jardin: boolean;
  /** Les mots du couple : une notification quand l'autre en écrit un. */
  mots: boolean;
  /** Ce qui est à l'agenda ce jour-là, pour nous deux ou pour soi. */
  agenda: boolean;
  /** Les factures du Budget à payer dans les trois jours, ou en retard. */
  budget: boolean;
  /** L'heure du rappel, heure pleine, à Zurich. */
  heure: number;
  /** Les jours où le rappel arrive : 0 dimanche, 1 lundi… 6 samedi. */
  jours: number[];
}

/** L'heure proposée au départ, décidée avec le foyer ; chacun peut la changer. */
export const HEURE_DU_RAPPEL = 8;
/** Les heures possibles : de 5 h à 22 h. */
export const HEURE_MIN = 5;
export const HEURE_MAX = 22;

export const TOUS_LES_JOURS = [1, 2, 3, 4, 5, 6, 0];
export const PREFERENCES_DE_DEPART: PreferencesRappels = { taches: true, mitsu: true, stock: true, jardin: true, mots: true, agenda: true, budget: true, heure: HEURE_DU_RAPPEL, jours: TOUS_LES_JOURS };
export const FUSEAU_DU_FOYER = "Europe/Zurich";

export function heureValide(heure: unknown): heure is number {
  return Number.isInteger(heure) && (heure as number) >= HEURE_MIN && (heure as number) <= HEURE_MAX;
}

/** Une heure plus tôt (-1) ou plus tard (+1), sans sortir des heures possibles. */
export function decalerHeure(heure: number, sens: -1 | 1): number {
  return Math.min(HEURE_MAX, Math.max(HEURE_MIN, heure + sens));
}

/** Les jours de la semaine, dans l'ordre suisse : lundi d'abord. */
export const JOURS_SEMAINE: readonly { numero: number; court: string; initiale: string; nom: string }[] = [
  { numero: 1, court: "lun", initiale: "L", nom: "lundi" },
  { numero: 2, court: "mar", initiale: "M", nom: "mardi" },
  { numero: 3, court: "mer", initiale: "M", nom: "mercredi" },
  { numero: 4, court: "jeu", initiale: "J", nom: "jeudi" },
  { numero: 5, court: "ven", initiale: "V", nom: "vendredi" },
  { numero: 6, court: "sam", initiale: "S", nom: "samedi" },
  { numero: 0, court: "dim", initiale: "D", nom: "dimanche" },
];

const SEMAINE = [1, 2, 3, 4, 5];
const WEEK_END = [6, 0];
const memes = (a: readonly number[], b: readonly number[]) => a.length === b.length && b.every((j) => a.includes(j));

/** Relit les jours enregistrés : sans doublon, dans l'ordre de la semaine ; tous les jours si rien de valable. */
export function nettoyerJours(bruts: unknown): number[] {
  if (!Array.isArray(bruts)) return [...TOUS_LES_JOURS];
  const jours = TOUS_LES_JOURS.filter((j) => bruts.includes(j));
  return jours.length ? jours : [...TOUS_LES_JOURS];
}

/** Ajoute ou retire un jour ; le dernier jour ne peut pas être retiré (couper les rappels sert à ça). */
export function basculerJour(jours: readonly number[], jour: number): number[] {
  if (jours.includes(jour)) return jours.length > 1 ? jours.filter((j) => j !== jour) : [...jours];
  return TOUS_LES_JOURS.filter((j) => j === jour || jours.includes(j));
}

/** Les raccourcis, comme dans l'app Horloge de l'iPhone. */
export const RACCOURCIS_JOURS: readonly { libelle: string; jours: number[] }[] = [
  { libelle: "Tous les jours", jours: TOUS_LES_JOURS },
  { libelle: "En semaine", jours: SEMAINE },
  { libelle: "Le week-end", jours: WEEK_END },
];

/** « Tous les jours », « En semaine », « Le week-end », ou « lun, mer, ven ». */
export function decrireJours(jours: readonly number[]): string {
  const raccourci = RACCOURCIS_JOURS.find((r) => memes(jours, r.jours));
  if (raccourci) return raccourci.libelle;
  return JOURS_SEMAINE.filter((j) => jours.includes(j.numero)).map((j) => j.court).join(", ");
}

/** Le jour de la semaine d'une date « AAAA-MM-JJ ». */
export function jourDeLaSemaine(jour: Jour): number {
  return new Date(`${jour}T12:00:00Z`).getUTCDay();
}

/** « 8:00 », « 18:00 ». */
export function formaterHeure(heure: number): string {
  return `${heure}:00`;
}

export interface RappelDuMatin {
  titre: string;
  corps: string;
  /** Le nombre de choses rappelées, pour la pastille. */
  nombre: number;
}

/** Au plus trois noms par ligne, puis « et 2 autres ». */
const MAX_PAR_LIGNE = 3;

function enumerer(noms: string[]): string {
  if (noms.length <= MAX_PAR_LIGNE) return noms.join(", ");
  const reste = noms.length - MAX_PAR_LIGNE;
  return `${noms.slice(0, MAX_PAR_LIGNE).join(", ")} et ${reste} autre${reste > 1 ? "s" : ""}`;
}

/** Les tâches de cette personne et les tâches libres, dues aujourd'hui ou en retard. */
export function tachesDuMatin(taches: Tache[], membreId: Id | null, aujourdhui: Jour): { aujourdhui: Tache[]; enRetard: Tache[] } {
  const miennes = taches
    .filter((t) => !estTerminee(t) && (membreId === null || t.responsable === null || t.responsable === membreId))
    .sort((a, b) => a.echeance.localeCompare(b.echeance) || a.titre.localeCompare(b.titre, "fr"));
  return {
    aujourdhui: miennes.filter((t) => ecartJours(aujourdhui, t.echeance) === 0),
    enRetard: miennes.filter((t) => ecartJours(aujourdhui, t.echeance) < 0),
  };
}

export function rappelDuMatin(entree: {
  foyer: Foyer | null;
  membreId: Id | null;
  taches: Tache[];
  animaux: Animal[];
  /** L'agenda commun ; absent, rien n'est dit de l'agenda. */
  evenements?: readonly Evenement[];
  /** Les factures du Budget à payer bientôt (facturesDuJour). */
  factures?: readonly { libelle: string; echeance: Jour }[];
  /** Le stock du foyer ; absent, rien n'est dit du frigo. */
  produits?: readonly Produit[];
  /** Le jardin et sa météo ; une météo de plus de 12 heures n'est pas prise en compte. */
  zones?: readonly Zone[];
  meteo?: Meteo | null;
  /** L'instant présent (ISO 8601), pour juger la météo ; sans lui, elle est prise telle quelle. */
  maintenant?: string;
  aujourdhui: Jour;
  preferences: PreferencesRappels;
}): RappelDuMatin | null {
  const { preferences, aujourdhui } = entree;
  const lignes: string[] = [];
  let nombre = 0;

  if (preferences.agenda && entree.evenements) {
    const occ = evenementsDuMatin(entree.evenements, entree.membreId, aujourdhui);
    if (occ.length) lignes.push(`Agenda : ${enumerer(occ.map((o) => decrireCourt(o, aujourdhui)))}`);
    nombre += occ.length;
  }

  if (preferences.taches) {
    const t = tachesDuMatin(entree.taches, entree.membreId, aujourdhui);
    if (t.aujourdhui.length) lignes.push(`Aujourd'hui : ${enumerer(t.aujourdhui.map((x) => x.titre))}`);
    if (t.enRetard.length) lignes.push(`En retard : ${enumerer(t.enRetard.map((x) => x.titre))}`);
    nombre += t.aujourdhui.length + t.enRetard.length;
  }

  if (preferences.budget && entree.factures?.length) {
    lignes.push(`Factures : ${enumerer(entree.factures.map((f) => `${f.libelle} ${decrireEcheanceFacture(f.echeance, aujourdhui)}`))}`);
    nombre += entree.factures.length;
  }

  if (preferences.mitsu) {
    for (const animal of entree.animaux) {
      const urgentes = choseAFaire(animal, aujourdhui).filter((c) => c.urgent);
      if (!urgentes.length) continue;
      lignes.push(`${animal.nom} : ${urgentes.slice(0, 2).map((c) => c.texte).join(" · ")}${urgentes.length > 2 ? "…" : ""}`);
      nombre += urgentes.length;
    }
  }

  if (preferences.stock && entree.produits) {
    const { aConsommer } = resumeStock(entree.produits, aujourdhui);
    if (aConsommer.length) lignes.push(`À consommer : ${enumerer(aConsommer.map((p) => p.nom))}`);
    nombre += aConsommer.length;
  }

  if (preferences.jardin && entree.zones?.length) {
    const meteo = !entree.maintenant || meteoFraiche(entree.meteo ?? null, entree.maintenant) ? (entree.meteo ?? null) : null;
    const gestes = gestesDuJardin(entree.zones, meteo, aujourdhui).filter((g) => g.urgent);
    if (gestes.length) lignes.push(`Jardin : ${gestes.slice(0, 2).map((g) => g.texte).join(" · ")}${gestes.length > 2 ? "…" : ""}`);
    nombre += gestes.length;
  }

  if (nombre === 0) return null;
  const prenom = entree.foyer?.membres.find((m) => m.id === entree.membreId)?.prenom;
  return { titre: prenom ? `Bonjour ${prenom}` : "Bonjour", corps: lignes.join("\n"), nombre };
}

/** La date et l'heure d'un instant dans le fuseau du foyer (l'heure d'été est prise en compte). */
export function jourEtHeure(instant: Date, fuseau: string = FUSEAU_DU_FOYER): { jour: Jour; heure: number } {
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: fuseau, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return { jour: `${parties.year}-${parties.month}-${parties.day}`, heure: Number(parties.hour) };
}

/**
 * Le serveur passe chaque heure : un téléphone reçoit son rappel au premier passage
 * à partir de son heure, une seule fois par jour (un passage manqué est rattrapé
 * dans la matinée, jamais l'après-midi), et seulement les jours choisis.
 */
export function rappelDu(
  instant: Date,
  heure: number,
  dernierEnvoi: Jour | null,
  fuseau: string = FUSEAU_DU_FOYER,
  jours: readonly number[] = TOUS_LES_JOURS,
): Jour | null {
  const local = jourEtHeure(instant, fuseau);
  if (local.heure < heure || local.heure >= Math.max(heure + 1, 12)) return null;
  if (!nettoyerJours(jours).includes(jourDeLaSemaine(local.jour))) return null;
  return dernierEnvoi === local.jour ? null : local.jour;
}
