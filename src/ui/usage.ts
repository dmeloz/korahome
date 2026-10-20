import { useSyncExternalStore } from "react";
import { ajouterUsage, nettoyerUsages, type Usage } from "../domaine/apprentissage";
import type { Jour } from "../domaine/types";
import { aujourdhuiLocal } from "./contexte";

// Ce que Kora apprend de la personne qui tient ce téléphone : les widgets ouverts, l'heure des
// tâches faites, ses décisions au bilan, ses réglages. Tout reste sur ce téléphone, jamais
// synchronisé ni envoyé : l'autre iPhone n'en sait rien.

const CLE_USAGE = "korahome.usage";
const CLE_DECISIONS = "korahome.appris";
const CLE_BILAN = "korahome.dernierBilan";
const CLE_ADAPTATIONS = "korahome.adaptations";
const CLE_REMARQUE = "korahome.remarque";

function lire<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(cle);
    return brut === null ? defaut : (JSON.parse(brut) as T);
  } catch {
    return defaut;
  }
}

function ecrire(cle: string, valeur: unknown): void {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    // Stockage indisponible : vaut pour cette visite seulement.
  }
  version++;
  for (const a of abonnes) a();
}

let version = 0;
const abonnes = new Set<() => void>();
const abonner = (a: () => void) => {
  abonnes.add(a);
  return () => abonnes.delete(a);
};

/** Redessine l'écran quand ce que Kora sait de ce téléphone change (décision, réglage, widget retiré). */
export function useApprentissageLocal(): number {
  return useSyncExternalStore(abonner, () => version);
}

/** Prévient les écrans qu'un réglage propre au téléphone a changé ailleurs (la disposition de l'accueil). */
export function signalerChangement(): void {
  version++;
  for (const a of abonnes) a();
}

// ----- L'usage -----

export function lireUsages(): Usage[] {
  return nettoyerUsages(lire<unknown>(CLE_USAGE, []));
}

/** Note un geste : ne lève jamais, ne redessine rien. */
export function noterUsage(type: Usage["type"], cle: string, maintenant = new Date()): void {
  try {
    if (!lireAdaptations().observer) return;
    const usages = ajouterUsage(lireUsages(), { jour: aujourdhuiLocal(maintenant), heure: maintenant.getHours(), type, cle });
    localStorage.setItem(CLE_USAGE, JSON.stringify(usages));
  } catch {
    // rien
  }
}

export function effacerUsages(): void {
  ecrire(CLE_USAGE, []);
}

// ----- Les décisions du bilan, pour ce qui est personnel -----

export interface DecisionPerso {
  decision: "garde" | "refuse";
  /** Ce qui a été appris, pour la page « Ce que Tael sait » (onglet « Rien qu'à toi »). */
  fait: string;
  le: Jour;
}

export function lireDecisionsPerso(): Record<string, DecisionPerso> {
  const brut = lire<Record<string, DecisionPerso>>(CLE_DECISIONS, {});
  return brut && typeof brut === "object" ? brut : {};
}

export function deciderPerso(cle: string, decision: DecisionPerso["decision"], fait: string): void {
  ecrire(CLE_DECISIONS, { ...lireDecisionsPerso(), [cle]: { decision, fait, le: aujourdhuiLocal() } });
}

export function oublierDecisionPerso(cle: string): void {
  const toutes = lireDecisionsPerso();
  delete toutes[cle];
  ecrire(CLE_DECISIONS, toutes);
}

// ----- Le bilan du dimanche -----

export function lireDernierBilan(): Jour | null {
  const j = lire<unknown>(CLE_BILAN, null);
  return typeof j === "string" ? j : null;
}

export function noterBilanVu(): void {
  ecrire(CLE_BILAN, aujourdhuiLocal());
}

// ----- Ce que la personne laisse Kora faire -----

export interface Adaptations {
  /** Noter les widgets ouverts et l'heure des tâches faites. */
  observer: boolean;
  /** L'ordre de l'accueil suit le moment de la journée. */
  accueilVivant: boolean;
  /** Le petit mot du jour de Jarvis sur l'accueil. */
  remarques: boolean;
}

const ADAPTATIONS_DE_DEPART: Adaptations = { observer: true, accueilVivant: true, remarques: true };

export function lireAdaptations(): Adaptations {
  const brut = lire<Partial<Adaptations> | null>(CLE_ADAPTATIONS, null);
  return {
    observer: typeof brut?.observer === "boolean" ? brut.observer : ADAPTATIONS_DE_DEPART.observer,
    accueilVivant: typeof brut?.accueilVivant === "boolean" ? brut.accueilVivant : ADAPTATIONS_DE_DEPART.accueilVivant,
    remarques: typeof brut?.remarques === "boolean" ? brut.remarques : ADAPTATIONS_DE_DEPART.remarques,
  };
}

export function changerAdaptations(changement: Partial<Adaptations>): void {
  ecrire(CLE_ADAPTATIONS, { ...lireAdaptations(), ...changement });
}

// ----- La remarque du jour : une par jour au plus -----

interface RemarqueVue {
  jour: Jour;
  cle: string;
  fermee: boolean;
}

/** La remarque à montrer aujourd'hui : la première du jour, tant qu'on ne l'a pas fermée. */
export function remarqueAMontrer(cle: string | null, aujourdhui: Jour): boolean {
  const vue = lire<RemarqueVue | null>(CLE_REMARQUE, null);
  if (vue?.jour === aujourdhui) return !vue.fermee && vue.cle === cle;
  if (cle === null) return false;
  try {
    localStorage.setItem(CLE_REMARQUE, JSON.stringify({ jour: aujourdhui, cle, fermee: false } satisfies RemarqueVue));
  } catch {
    // rien
  }
  return true;
}

export function fermerRemarque(cle: string, aujourdhui: Jour): void {
  ecrire(CLE_REMARQUE, { jour: aujourdhui, cle, fermee: true } satisfies RemarqueVue);
}
