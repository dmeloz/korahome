// La fée de Kora : une petite boule de lumière qui remplace la barre Jarvis, comme les fées de
// Zelda. Tael (violette, ailes pointues) pour Dany, Navi (bleue, ailes rondes) pour Sarah. Elle
// porte le nom que l'écran donnait à Jarvis ; le code et le serveur gardent « jarvis ».
// Ce qui vient de l'autre (un mot, un cœur) ne s'ouvre pas tout seul : une petite icône attend
// au-dessus de la fée jusqu'à ce qu'on la touche.

import { estVisible, type DocCouple, type Mot } from "./bandeau";
import { nomPropose } from "./siri";
import type { Foyer, Id } from "./types";

export type TeinteFee = "violette" | "bleue";

export interface Fee {
  nom: string;
  teinte: TeinteFee;
  ailes: "pointues" | "rondes";
}

const TAEL: Fee = { nom: "Tael", teinte: "violette", ailes: "pointues" };
const NAVI: Fee = { nom: "Navi", teinte: "bleue", ailes: "rondes" };

/** La fée d'une personne : Navi pour Sarah, Tael pour Dany et pour qui n'a pas encore de prénom. */
export function feeDe(prenom: string | null | undefined): Fee {
  return nomPropose(prenom) === "Navi" ? NAVI : TAEL;
}

/** La fée de l'autre, toujours différente de la mienne. */
export function feeDeLAutre(moi: string | null | undefined, autre: string | null | undefined): Fee {
  const mienne = feeDe(moi);
  const sienne = feeDe(autre);
  return sienne.nom === mienne.nom ? (mienne.nom === "Navi" ? TAEL : NAVI) : sienne;
}

/** L'autre personne du foyer, pour un foyer de deux. */
export function autreMembre(foyer: Pick<Foyer, "membres">, moi: Id | null): Foyer["membres"][number] | null {
  return foyer.membres.find((m) => m.id !== moi) ?? null;
}

// ----- Ce qui attend au-dessus de la fée -----

export type SorteAttente = "message" | "coeur";

export interface Attente {
  /** Unique par chose reçue : c'est elle qu'on retient une fois vue. */
  cle: string;
  sorte: SorteAttente;
  /** Le mot reçu, ou le mien que l'autre a aimé. */
  mot: Mot;
  /** Qui l'envoie. */
  de: Id;
  /** Quand c'est arrivé, pour l'ordre. */
  le: string;
}

/** Au-delà, ce qui n'a pas été vu ne revient plus. */
export const JOURS_ATTENTE = 3;

const ilYA = (maintenant: string, jours: number) => new Date(Date.parse(maintenant) - jours * 86_400_000).toISOString();

/** Tout ce qui est arrivé de l'autre ces derniers jours, vu ou non, du plus ancien au plus récent. */
export function arriveesDuCouple(docs: readonly DocCouple[], moi: Id | null, maintenant: string): Attente[] {
  if (!moi) return [];
  const depuis = ilYA(maintenant, JOURS_ATTENTE);
  const attentes: Attente[] = [];
  for (const d of docs) {
    if (d.type !== "mot" || !estVisible(d, maintenant) || d.visibleDes < depuis) continue;
    if (d.de && d.de !== moi) {
      attentes.push({ cle: `${d.coeur ? "coeur" : "mot"}:${d.id}`, sorte: d.coeur ? "coeur" : "message", mot: d, de: d.de, le: d.visibleDes });
    } else if (d.de === moi) {
      // Un cœur en retour sur un de mes mots : on ne sait pas quand il est arrivé, il suit le mot.
      for (const qui of d.coeurs) {
        if (qui !== moi) attentes.push({ cle: `coeurs:${d.id}:${qui}`, sorte: "coeur", mot: d, de: qui, le: d.visibleDes });
      }
    }
  }
  return attentes.sort((a, b) => a.le.localeCompare(b.le));
}

/**
 * Ce qui attend d'être touché : une icône par sorte au plus (le plus ancien d'abord), le
 * suivant prend sa place une fois celui-ci vu.
 */
export function attentesDuCouple(docs: readonly DocCouple[], moi: Id | null, maintenant: string, vues: ReadonlySet<string>): Attente[] {
  const restantes = arriveesDuCouple(docs, moi, maintenant).filter((a) => !vues.has(a.cle));
  const message = restantes.find((a) => a.sorte === "message");
  const coeur = restantes.find((a) => a.sorte === "coeur");
  return [message, coeur].filter((a): a is Attente => !!a);
}

/** Les clés vues encore utiles : celles des choses arrivées ces derniers jours. */
export function vuesAGarder(vues: ReadonlySet<string>, docs: readonly DocCouple[], moi: Id | null, maintenant: string): string[] {
  const recentes = new Set(arriveesDuCouple(docs, moi, maintenant).map((a) => a.cle));
  return [...vues].filter((c) => recentes.has(c));
}

/** Ce que dit la fée quand on touche l'icône. */
export function phraseAttente(a: Attente, prenomAutre: string): string {
  if (a.sorte === "message") return a.mot.texte;
  return a.mot.de === a.de ? `${prenomAutre} t'envoie un cœur.` : `${prenomAutre} aime ton mot : « ${a.mot.texte} »`;
}
