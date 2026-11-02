import { useSyncExternalStore } from "react";
import { evenementsDe } from "../domaine/agenda";
import { resiliationsDuJour } from "../domaine/abonnements";
import { carteDuJour, repasDuSoir, type ChoseDuJour } from "../domaine/aujourdhui";
import { nosMots } from "../domaine/bandeau";
import { facturesDuJour } from "../domaine/budget";
import { ASTUCE_CAPSULE_FOIS, capsuleAujourdhui, capsuleCourses, capsuleNous, type EtatCapsule, type VueCapsule } from "../domaine/capsule";
import { enDirect } from "../domaine/ecranAccueil";
import { reglageDechets } from "../domaine/maison";
import type { DonneesModule } from "./modules";
import { CLES, ecrireTexte, effacer, lireTexte } from "./stockageLocal";

// La nouvelle interface (0.0.100) : la capsule vivante en bas, à la place de la fée flottante,
// sur les trois vues Aujourd'hui, Courses et Nous. Un essai par téléphone, réglé dans
// Réglages › Apparence : sans lui, Kora reste comme avant.

const abonnes = new Set<() => void>();

export const lireInterfaceCapsule = (): boolean => lireTexte(CLES.interfaceCapsule) === "1";

export function choisirInterfaceCapsule(oui: boolean): void {
  if (oui) ecrireTexte(CLES.interfaceCapsule, "1");
  else effacer(CLES.interfaceCapsule);
  for (const f of abonnes) f();
}

function abonner(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export const useInterfaceCapsule = (): boolean => useSyncExternalStore(abonner, lireInterfaceCapsule, () => false);

// ----- La fée dans la capsule -----
// La saisie de la fée (BarreJarvis) reste la même ; dans la capsule, c'est son orbe qui la réveille.

type FeeBranchee = { toucher: () => void; appuiLong: () => void };
let feeBranchee: FeeBranchee | null = null;

export function brancherFeeCapsule(f: FeeBranchee): () => void {
  feeBranchee = f;
  return () => {
    if (feeBranchee === f) feeBranchee = null;
  };
}
export const toucherFeeCapsule = (): void => feeBranchee?.toucher();
export const appuiLongFeeCapsule = (): void => feeBranchee?.appuiLong();

// ----- L'astuce, les trois premières fois -----

export const astuceCapsuleAMontrer = (): boolean => Number(lireTexte(CLES.astuceCapsule) ?? 0) < ASTUCE_CAPSULE_FOIS;
export function compterAstuceCapsule(): void {
  ecrireTexte(CLES.astuceCapsule, String(Number(lireTexte(CLES.astuceCapsule) ?? 0) + 1));
}
/** Le geste est appris : plus jamais l'astuce. */
export function finirAstuceCapsule(): void {
  ecrireTexte(CLES.astuceCapsule, String(ASTUCE_CAPSULE_FOIS));
}

// ----- Ce que dit la capsule -----

export interface EtatsCapsule {
  etats: Record<VueCapsule, EtatCapsule>;
  /** La première chose du jour : toucher la capsule d'Aujourd'hui l'ouvre. */
  premiere: ChoseDuJour | null;
}

export function etatsDeLaCapsule(d: DonneesModule, maintenant: Date): EtatsCapsule {
  const iso = maintenant.toISOString();
  const heure = `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`;
  const choses = carteDuJour(
    {
      ...d,
      evenements: evenementsDe(d.agenda),
      factures: facturesDuJour(d.budget, d.aujourdhui, 1),
      resiliations: resiliationsDuJour(d.budget, d.aujourdhui),
      dechets: reglageDechets(d.maison),
    },
    3,
  ).choses;
  const liste = d.listes.find((l) => l.type === "courses");
  const courses = liste ? d.elements.filter((e) => e.listeId === liste.id) : [];
  const direct = enDirect(d, iso);
  const autre = d.foyer.membres.find((m) => m.id !== d.membreId)?.prenom ?? null;
  const mot = nosMots(d.couple, d.membreId, iso).find((m) => m.de !== d.membreId && !m.coeur) ?? null;
  const coeurDonne = !!mot && !!d.membreId && mot.coeurs.includes(d.membreId);
  return {
    etats: {
      aujourdhui: capsuleAujourdhui(choses, repasDuSoir(d.menus, d.aujourdhui), heure),
      courses: capsuleCourses(courses, direct?.qui ?? null),
      nous: capsuleNous(mot, coeurDonne, autre),
    },
    premiere: choses[0] ?? null,
  };
}
