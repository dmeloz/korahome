import { useSyncExternalStore } from "react";
import type { Attente } from "../domaine/fee";
import { ajouterAuJournal, elaguerJournal, marquerAnnulee, nettoyerNiveau, type LigneJournalTael, type NiveauTael } from "../domaine/tael";
import { CLES, ecrireJson, ecrireTexte, lireJson, lireTexte } from "./stockageLocal";

// Tael « vient à toi » (Kora 0.1) : son orbe, à côté du salut, sur sa carte et dans la barre du
// haut, réveille la saisie de la fée (BarreJarvis) ; sa feuille règle son niveau et relit son
// journal. Ce fichier tient ce que les pièces se passent sans se connaître, et ce que le téléphone
// garde pour lui (niveau, journal), jamais synchronisé.

function magasin<T>(lire: () => T) {
  const abonnes = new Set<() => void>();
  return {
    abonner: (f: () => void) => {
      abonnes.add(f);
      return () => void abonnes.delete(f);
    },
    prevenir: () => abonnes.forEach((f) => f()),
    lire,
  };
}

// ----- La saisie de la fée, réveillée par l'orbe -----

interface FeeBranchee {
  toucher: () => void;
  appuiLong: () => void;
}
let feeBranchee: FeeBranchee | null = null;

/** La saisie se branche quand elle est à l'écran ; l'orbe l'appelle sans la connaître. */
export function brancherFee(f: FeeBranchee): () => void {
  feeBranchee = f;
  return () => {
    if (feeBranchee === f) feeBranchee = null;
  };
}
/** Toucher l'orbe : elle écoute (ou, sans micro, on lui écrit). */
export const toucherFee = (): void => feeBranchee?.toucher();
/** « Écrire plutôt », ou « Ajouter » sur une carte : la saisie et le clavier. */
export const ecrireAFee = (): void => feeBranchee?.appuiLong();

// ----- Ce que l'orbe montre : l'écoute, ce que l'autre a envoyé -----

export interface EtatOrbe {
  ecoute: boolean;
  attentes: readonly Attente[];
  /** Le prénom de l'autre, pour dire de qui vient le mot. */
  prenomAutre: string;
  ouvrirAttente: (a: Attente) => void;
}
let etatOrbe: EtatOrbe = { ecoute: false, attentes: [], prenomAutre: "L'autre", ouvrirAttente: () => {} };
const orbe = magasin(() => etatOrbe);
export function publierOrbe(etat: EtatOrbe): void {
  if (etat.ecoute === etatOrbe.ecoute && etat.attentes === etatOrbe.attentes && etat.prenomAutre === etatOrbe.prenomAutre && etat.ouvrirAttente === etatOrbe.ouvrirAttente) return;
  etatOrbe = etat;
  orbe.prevenir();
}
export const useOrbe = (): EtatOrbe => useSyncExternalStore(orbe.abonner, orbe.lire, orbe.lire);

// ----- Sa feuille : ouverte d'un appui long sur l'orbe, où qu'il soit -----

let feuilleOuverte = false;
const feuille = magasin(() => feuilleOuverte);
export function ouvrirFeuilleTael(ouverte = true): void {
  feuilleOuverte = ouverte;
  feuille.prevenir();
}
export const useFeuilleTael = (): boolean => useSyncExternalStore(feuille.abonner, feuille.lire, () => false);

// ----- Son niveau, sur ce téléphone -----

const niveau = magasin(() => nettoyerNiveau(lireTexte(CLES.niveauTael)));
export const lireNiveau = niveau.lire;
export function choisirNiveau(n: NiveauTael): void {
  // Stockage indisponible : le niveau vaut pour cette visite.
  ecrireTexte(CLES.niveauTael, n);
  niveau.prevenir();
}
export const useNiveau = (): NiveauTael => useSyncExternalStore(niveau.abonner, niveau.lire, niveau.lire);

// ----- Son journal : ce qu'elle a fait, et comment le défaire -----

const lireBrut = (): LigneJournalTael[] => {
  const brut = lireJson<unknown>(CLES.journalTael, []);
  return Array.isArray(brut) ? (brut as LigneJournalTael[]).filter((l) => l && typeof l.id === "string" && typeof l.quand === "string" && typeof l.texte === "string") : [];
};
let journalCache: LigneJournalTael[] | null = null;
const journal = magasin(() => (journalCache ??= lireBrut()));
export const lireJournalTael = journal.lire;
function ecrireJournal(lignes: LigneJournalTael[]): void {
  journalCache = lignes;
  ecrireJson(CLES.journalTael, lignes);
  journal.prevenir();
}
/** Elle note ce qu'elle vient de faire ; le journal garde une semaine. */
export function noterAuJournal(ligne: LigneJournalTael): void {
  ecrireJournal(ajouterAuJournal(elaguerJournal(journal.lire(), ligne.quand), ligne));
}
export function marquerAnnuleeAuJournal(id: string): void {
  ecrireJournal(marquerAnnulee(journal.lire(), id));
}
export const useJournalTael = (): LigneJournalTael[] => useSyncExternalStore(journal.abonner, journal.lire, journal.lire);
