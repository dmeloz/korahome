import type { Jour } from "./types";

// Tael « vient à toi » (Kora 0.1, vision A validée par Melo le 4 novembre 2026) : la fée n'est
// plus une boule qui flotte sur chaque page, elle se tient à côté du salut et sur sa carte. Un
// appui long ouvre sa feuille : son niveau d'autonomie, et le journal de ce qu'elle a fait
// aujourd'hui, avec « Annuler ». Ces règles valent pour le téléphone et pour l'app native.

/** Ce qu'elle fait seule. */
export type NiveauTael = "observe" | "propose" | "agit";

export const NIVEAUX: readonly { id: NiveauTael; titre: string; detail: string }[] = [
  { id: "observe", titre: "Elle observe", detail: "Elle répond quand tu lui parles. Rien de plus." },
  { id: "propose", titre: "Elle propose", detail: "Elle pose sa question sur sa carte, tu dis oui ou plus tard." },
  { id: "agit", titre: "Elle agit, puis te dit", detail: "Elle note seule les petites choses et te laisse « Annuler »." },
];

export const NIVEAU_DE_DEPART: NiveauTael = "propose";

export function nettoyerNiveau(brut: unknown): NiveauTael {
  return brut === "observe" || brut === "propose" || brut === "agit" ? brut : NIVEAU_DE_DEPART;
}

/** « Elle propose » : la valeur montrée dans Réglages. */
export const titreNiveau = (niveau: NiveauTael): string => NIVEAUX.find((n) => n.id === niveau)?.titre ?? "";

/**
 * Une action de l'assistant attend-elle un oui ? Ce qui supprime attend toujours (règle de
 * `jarvis.ts`) ; quand elle propose, tout attend ; quand elle agit, le reste passe et se défait.
 */
export function attendUnOui(niveau: NiveauTael, dejaAConfirmer: boolean): boolean {
  return dejaAConfirmer || niveau === "propose";
}

/** Quand elle observe, elle répond mais ne touche à rien : l'assistant n'a pas ses outils. */
export const peutAgir = (niveau: NiveauTael): boolean => niveau !== "observe";

/**
 * Réglée sur « Elle observe », elle ne touche à rien : au lieu de laisser croire que c'est fait,
 * elle dit ce qu'on lui demandait et comment la laisser faire (0.1.16).
 */
export function refusDObserver(demandes: readonly string[]): string {
  if (!demandes.length) return "";
  return `Je n'ai touché à rien : tu m'as réglée sur « Elle observe ». Ce que j'aurais fait : ${demandes.join(" ; ")}. Pour me laisser faire, garde le doigt sur mon orbe, en haut.`;
}

/** Une ligne du journal : ce qu'elle a fait, quand, et ce qu'il faut pour le défaire. */
export interface LigneJournalTael {
  id: string;
  /** L'instant, ISO. */
  quand: string;
  texte: string;
  /** Les modifications faites, telles que `ui/jarvis.ts` sait les défaire ; absentes quand il n'y a rien à défaire. */
  modifications?: unknown[];
  annulee?: boolean;
}

export const JOURNAL_MAX = 60;

export function ajouterAuJournal(journal: readonly LigneJournalTael[], ligne: LigneJournalTael): LigneJournalTael[] {
  return [ligne, ...journal.filter((l) => l.id !== ligne.id)].slice(0, JOURNAL_MAX);
}

/** Les lignes d'un jour, la plus récente en tête. */
export function journalDuJour(journal: readonly LigneJournalTael[], jour: Jour, jourLocal: (iso: string) => Jour): LigneJournalTael[] {
  return journal.filter((l) => jourLocal(l.quand) === jour).sort((a, b) => b.quand.localeCompare(a.quand));
}

export function marquerAnnulee(journal: readonly LigneJournalTael[], id: string): LigneJournalTael[] {
  return journal.map((l) => (l.id === id ? { ...l, annulee: true } : l));
}

/** Les lignes trop vieilles pour servir (plus de sept jours) partent. */
export function elaguerJournal(journal: readonly LigneJournalTael[], maintenant: string, jours = 7): LigneJournalTael[] {
  const limite = new Date(new Date(maintenant).getTime() - jours * 86_400_000).toISOString();
  return journal.filter((l) => l.quand >= limite);
}

/** « Bonsoir », selon l'heure. */
export function salutation(heure: number): string {
  if (heure < 5) return "Bonne nuit";
  if (heure < 18) return "Bonjour";
  return "Bonsoir";
}
