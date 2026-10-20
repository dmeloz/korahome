import { useSyncExternalStore } from "react";
import { ajouterUsage, nettoyerUsages, type Usage } from "../domaine/apprentissage";
import type { Jour } from "../domaine/types";
import { aujourdhuiLocal } from "./contexte";
import { CLES, ecrireJson, lireJson } from "./stockageLocal";

// Ce que Kora apprend de la personne qui tient ce téléphone : les widgets ouverts, l'heure des
// tâches faites, ses décisions au bilan, ses réglages. Tout reste sur ce téléphone, jamais
// synchronisé ni envoyé : l'autre iPhone n'en sait rien.

function ecrire(cle: string, valeur: unknown): void {
  // Stockage indisponible : vaut pour cette visite seulement.
  ecrireJson(cle, valeur);
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
  return nettoyerUsages(lireJson<unknown>(CLES.usage, []));
}

/** Note un geste : ne lève jamais, ne redessine rien. */
export function noterUsage(type: Usage["type"], cle: string, maintenant = new Date()): void {
  try {
    if (!lireAdaptations().observer) return;
    const usages = ajouterUsage(lireUsages(), { jour: aujourdhuiLocal(maintenant), heure: maintenant.getHours(), type, cle });
    ecrireJson(CLES.usage, usages);
  } catch {
    // rien
  }
}

export function effacerUsages(): void {
  ecrire(CLES.usage, []);
}

// ----- Les décisions du bilan, pour ce qui est personnel -----

export interface DecisionPerso {
  decision: "garde" | "refuse";
  /** Ce qui a été appris, pour la page « Ce que Tael sait » (onglet « Rien qu'à toi »). */
  fait: string;
  le: Jour;
}

export function lireDecisionsPerso(): Record<string, DecisionPerso> {
  const brut = lireJson<Record<string, DecisionPerso>>(CLES.decisionsPerso, {});
  return brut && typeof brut === "object" ? brut : {};
}

export function deciderPerso(cle: string, decision: DecisionPerso["decision"], fait: string): void {
  ecrire(CLES.decisionsPerso, { ...lireDecisionsPerso(), [cle]: { decision, fait, le: aujourdhuiLocal() } });
}

export function oublierDecisionPerso(cle: string): void {
  const toutes = lireDecisionsPerso();
  delete toutes[cle];
  ecrire(CLES.decisionsPerso, toutes);
}

// ----- Le bilan du dimanche -----

export function lireDernierBilan(): Jour | null {
  const j = lireJson<unknown>(CLES.dernierBilan, null);
  return typeof j === "string" ? j : null;
}

export function noterBilanVu(): void {
  ecrire(CLES.dernierBilan, aujourdhuiLocal());
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
  const brut = lireJson<Partial<Adaptations> | null>(CLES.adaptations, null);
  return {
    observer: typeof brut?.observer === "boolean" ? brut.observer : ADAPTATIONS_DE_DEPART.observer,
    accueilVivant: typeof brut?.accueilVivant === "boolean" ? brut.accueilVivant : ADAPTATIONS_DE_DEPART.accueilVivant,
    remarques: typeof brut?.remarques === "boolean" ? brut.remarques : ADAPTATIONS_DE_DEPART.remarques,
  };
}

export function changerAdaptations(changement: Partial<Adaptations>): void {
  ecrire(CLES.adaptations, { ...lireAdaptations(), ...changement });
}

// ----- La remarque du jour : une par jour au plus -----

interface RemarqueVue {
  jour: Jour;
  cle: string;
  fermee: boolean;
}

/** La remarque à montrer aujourd'hui : la première du jour, tant qu'on ne l'a pas fermée. */
export function remarqueAMontrer(cle: string | null, aujourdhui: Jour): boolean {
  const vue = lireJson<RemarqueVue | null>(CLES.remarque, null);
  if (vue?.jour === aujourdhui) return !vue.fermee && vue.cle === cle;
  if (cle === null) return false;
  ecrireJson(CLES.remarque, { jour: aujourdhui, cle, fermee: false } satisfies RemarqueVue);
  return true;
}

export function fermerRemarque(cle: string, aujourdhui: Jour): void {
  ecrire(CLES.remarque, { jour: aujourdhui, cle, fermee: true } satisfies RemarqueVue);
}
