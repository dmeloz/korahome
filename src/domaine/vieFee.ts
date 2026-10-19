// La vie de la fée : quand elle dort, ce qu'elle signale, à quelle heure elle rappelle une
// tâche, son éclat, ses rituels, et quand elle apprend à se taire. Tout se calcule sur le
// téléphone, à partir de ce que Kora sait déjà ; rien n'est envoyé.

import type { Usage } from "./apprentissage";
import { avanceeDuJour, type CarteDuJour, type ChoseDuJour } from "./aujourdhui";
import { decrireCompte, type CompteARebours } from "./bandeau";
import type { Meteo } from "./meteo";
import { ecartJours } from "./taches";
import type { Id, Jour, Tache } from "./types";

/** Seule la première lettre passe en minuscule : « litière de Mitsu ». */
export const minuscule = (texte: string) => texte.charAt(0).toLowerCase() + texte.slice(1);
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// ----- La nuit, apprise du téléphone -----

export interface Nuit {
  /** Début et fin, en minutes depuis minuit (le début est le soir, la fin le matin). */
  debut: number;
  fin: number;
  /** Faux tant qu'il n'y a pas assez de jours d'usage : la nuit vaut alors 23 h à 7 h. */
  apprise: boolean;
}

export const NUIT_DE_DEPART: Nuit = { debut: 23 * 60, fin: 7 * 60, apprise: false };
/** Il faut au moins tant de jours d'usage sur les 14 derniers pour apprendre la nuit. */
export const JOURS_POUR_NUIT = 7;
const MARGE_NUIT = 15;

const mediane = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * La nuit de la personne : de la fin de sa dernière heure d'usage du soir (médiane) jusqu'au
 * début de sa première heure du matin (médiane), avec un quart d'heure de marge.
 */
export function nuitApprise(usages: readonly Usage[], aujourdhui: Jour): Nuit {
  const parJour = new Map<Jour, number[]>();
  for (const u of usages) {
    const ecart = ecartJours(u.jour, aujourdhui);
    if (ecart < 0 || ecart > 14) continue;
    parJour.set(u.jour, [...(parJour.get(u.jour) ?? []), u.heure]);
  }
  const soirs: number[] = [];
  const matins: number[] = [];
  for (const heures of parJour.values()) {
    // Le soir compte de 18 h à 3 h du matin (3 h devient 27 h pour rester après minuit).
    const soir = heures.filter((h) => h >= 18 || h < 4).map((h) => (h < 4 ? h + 24 : h));
    const matin = heures.filter((h) => h >= 4 && h < 12);
    if (soir.length) soirs.push(Math.max(...soir));
    if (matin.length) matins.push(Math.min(...matin));
  }
  if (soirs.length < JOURS_POUR_NUIT || matins.length < JOURS_POUR_NUIT) return NUIT_DE_DEPART;
  const debut = Math.min(27 * 60, Math.max(21 * 60, Math.round(mediane(soirs) + 1) * 60 + MARGE_NUIT));
  const fin = Math.min(10 * 60, Math.max(5 * 60, Math.round(mediane(matins)) * 60 - MARGE_NUIT));
  return { debut: debut % (24 * 60), fin, apprise: true };
}

/** Est-ce la nuit à cette minute de la journée ? */
export function estLaNuit(minute: number, nuit: Nuit): boolean {
  return nuit.debut > nuit.fin ? minute >= nuit.debut || minute < nuit.fin : minute >= nuit.debut && minute < nuit.fin;
}

/** La nuit tombée le soir, l'accueil montre déjà demain ; après minuit, c'est déjà aujourd'hui. */
export function jourAMontrerLaNuit(minute: number, nuit: Nuit): "demain" | "aujourdhui" {
  return minute >= 12 * 60 && estLaNuit(minute, nuit) ? "demain" : "aujourdhui";
}

/** « 23 h 15 », pour dire la nuit apprise. */
export function decrireMinute(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return mm ? `${h} h ${String(mm).padStart(2, "0")}` : `${h} h`;
}

// ----- Son éclat : le foyer à jour ou en retard -----

export type Eclat = "pale" | "normal" | "vive";
/** Une chose urgente qui attend depuis plus longtemps rend la fée pâle. */
const ATTENTE_PALE_MIN = 120;

export function eclatDuFoyer(carte: CarteDuJour, maintenant: string): Eclat {
  const urgentes = carte.choses.filter((c) => c.etat === "urgent");
  const enAttente = urgentes.some((c) => (c.heure ? minutes(maintenant) - minutes(c.heure) > ATTENTE_PALE_MIN : c.quand === "en retard"));
  if (enAttente) return "pale";
  // Tout ce qui était prévu est fait : plus aucune tâche dans la carte, et au moins une cochée.
  const avancee = avanceeDuJour(carte);
  return avancee.faites > 0 && avancee.part === 1 && urgentes.length === 0 ? "vive" : "normal";
}

// ----- Les alertes -----

/** Trois alertes par jour au plus, et chaque chose une seule fois. */
export const ALERTES_PAR_JOUR = 3;

export function alerteAFaire(carte: CarteDuJour, signalees: ReadonlySet<string>): ChoseDuJour | null {
  if (signalees.size >= ALERTES_PAR_JOUR) return null;
  return carte.choses.find((c) => c.etat === "urgent" && !signalees.has(c.cle)) ?? null;
}

// ----- L'heure d'une tâche -----

/** Pendant ces minutes après l'heure, la fée peut encore la rappeler (l'app ouverte un peu après). */
export const FENETRE_HEURE_MIN = 15;

export function tacheDeLHeure(
  carte: CarteDuJour,
  taches: readonly Tache[],
  moi: Id | null,
  maintenant: string,
  dites: ReadonlySet<string>,
): ChoseDuJour | null {
  const m = minutes(maintenant);
  return (
    carte.choses.find((c) => {
      if (!c.tacheId || !c.heure || dites.has(c.cle)) return false;
      const ecart = m - minutes(c.heure);
      if (ecart < 0 || ecart > FENETRE_HEURE_MIN) return false;
      const t = taches.find((x) => x.id === c.tacheId);
      return !!t && (t.responsable === null || t.responsable === moi);
    }) ?? null
  );
}

// ----- Les rituels -----

/** Le jour J d'un compte à rebours : elle fête une fois. */
export function jourJ(comptes: readonly CompteARebours[], aujourdhui: Jour): string | null {
  const c = comptes.find((x) => x.jour === aujourdhui);
  return c ? `${decrireCompte(c, aujourdhui)} !` : null;
}

/** Le réveil : ce qui attend aujourd'hui, le prochain rendez-vous, la météo, en une phrase ou deux. */
export function resumeDuMatin(carte: CarteDuJour, extras: { rdv?: string | null; meteo?: string | null }): string {
  const aFaire = carte.choses.filter((c) => c.etat !== "calme");
  const parties = [
    aFaire.length === 0
      ? "Rien ne presse aujourd'hui."
      : aFaire.length === 1
        ? `Une chose aujourd'hui : ${minuscule(aFaire[0].texte)}.`
        : `${aFaire.length} choses aujourd'hui, d'abord ${minuscule(aFaire[0].texte)}.`,
    extras.rdv ?? null,
    extras.meteo ?? null,
  ];
  return `Bonjour. ${parties.filter(Boolean).join(" ")}`;
}

// ----- La météo sur ses ailes -----

export type AllureMeteo = "givre" | "pluie" | null;

export function allureMeteo(meteo: Meteo | null, aujourdhui: Jour): AllureMeteo {
  const j = meteo?.jours.find((x) => x.jour === aujourdhui);
  if (!j) return null;
  if (j.min < 0) return "givre";
  return j.pluie >= 1 ? "pluie" : null;
}

// ----- La discrétion apprise -----

export interface Renvoi {
  jour: Jour;
  heure: number;
}

/** Trois bulles renvoyées à une même heure en deux semaines : elle se tait à cette heure. */
export const RENVOIS_POUR_SE_TAIRE = 3;

export function nettoyerRenvois(brut: unknown, aujourdhui: Jour): Renvoi[] {
  if (!Array.isArray(brut)) return [];
  return brut.filter(
    (r): r is Renvoi =>
      !!r && typeof r === "object" && typeof (r as Renvoi).jour === "string" && Number.isInteger((r as Renvoi).heure) && ecartJours((r as Renvoi).jour, aujourdhui) <= 14,
  );
}

export function heuresDiscretes(renvois: readonly Renvoi[]): Set<number> {
  const compte = new Map<number, number>();
  for (const r of renvois) compte.set(r.heure, (compte.get(r.heure) ?? 0) + 1);
  return new Set([...compte].filter(([, n]) => n >= RENVOIS_POUR_SE_TAIRE).map(([h]) => h));
}

// ----- Les gestes sur elle -----

/** Secouée : quatre changements de sens en une seconde et demie. */
export function estSecouee(inversions: readonly number[], maintenant: number): boolean {
  return inversions.filter((t) => maintenant - t < 1500).length >= 4;
}

/** Caressée : au moins trois allers-retours, lentement (plus d'une seconde en tout). */
export function estCaressee(inversions: readonly number[], debut: number, maintenant: number): boolean {
  return inversions.length >= 3 && maintenant - debut > 1200 && !estSecouee(inversions, maintenant);
}

// ----- Les nouveautés de l'autre -----

/** Les articles que l'autre a ajoutés aux courses et que je n'ai pas encore vus. */
export function nouveautesDeLAutre<E extends { id: Id; ajoutePar: Id | null; coche: boolean; listeId: Id }>(
  elements: readonly E[],
  listeId: Id | null,
  moi: Id | null,
  vus: ReadonlySet<string>,
): E[] {
  if (!listeId || !moi) return [];
  return elements.filter((e) => e.listeId === listeId && !e.coche && e.ajoutePar !== null && e.ajoutePar !== moi && !vus.has(e.id));
}
