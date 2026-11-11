// Le partage entre les deux iPhone du foyer. Chaque téléphone garde toutes ses données
// et fonctionne hors ligne ; chaque modification devient un « changement » daté, mis en
// attente puis envoyé. Quand deux téléphones ont modifié le même document, leurs retouches
// se rejoignent champ par champ (Kora 0.1.12) ; pour un même champ, la plus récente gagne.

import { NOMS_COLLECTIONS, type CollectionSynchro } from "./collections";

export type { CollectionSynchro };

/**
 * Ce qui se partage : toutes les collections du registre (domaine/collections.ts). Les notes de
 * test aussi : elles arrivent ainsi sur le serveur, où Claude les lit, et les deux iPhone voient
 * toutes les notes. Les réglages restent propres à chaque téléphone. La corbeille aussi : ce que
 * l'un efface, l'autre peut le remettre.
 */
export const COLLECTIONS_SYNCHRO: readonly CollectionSynchro[] = NOMS_COLLECTIONS;

export interface Changement {
  collection: CollectionSynchro;
  id: string;
  /** Le document complet, ou null quand il a été supprimé. */
  donnees: unknown;
  /** Moment de la modification sur le téléphone qui l'a faite (ISO 8601). */
  maj: string;
}

export const cleDe = (c: { collection: CollectionSynchro; id: string }) => `${c.collection}/${c.id}`;

/**
 * Une modification venue de l'autre téléphone remplace la version locale, sauf si
 * celle-ci a été modifiée plus tard et n'est pas encore partie. À égalité, le serveur gagne.
 */
export function distantGagne(local: Changement | undefined, distant: Changement): boolean {
  return !local || distant.maj >= local.maj;
}

/** Une modification en attente d'envoi, avec le document tel que le serveur l'avait quand on l'a retouché. */
export interface EnAttente extends Changement {
  /** Le document à la dernière synchro (null s'il n'existait pas). Absent : on ne sait pas, la plus récente gagne. */
  base?: unknown;
}

type Objet = Record<string, unknown>;
const estObjet = (v: unknown): v is Objet => typeof v === "object" && v !== null && !Array.isArray(v);
/** Le nom d'un élément dans sa liste : son `id`, ou son `membreId` (les personnes du plan du Budget). */
const nomDe = (e: unknown): string | null => {
  if (!estObjet(e)) return null;
  return typeof e.id === "string" ? e.id : typeof e.membreId === "string" ? e.membreId : null;
};
/** Une liste de choses qui portent chacune leur nom (charges du budget, soins de Mitsu, membres du foyer…). */
const estListeNommee = (v: unknown): v is Objet[] =>
  Array.isArray(v) && v.every((e) => nomDe(e) !== null) && new Set(v.map(nomDe)).size === v.length;
const clesDe = (o: Objet) => Object.keys(o).filter((k) => o[k] !== undefined);

/** Le même contenu, quel que soit l'ordre des champs ; un champ vide (undefined) compte comme absent. */
export function memeContenu(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => memeContenu(v, b[i]));
  if (!estObjet(a) || !estObjet(b)) return false;
  const cles = clesDe(a);
  return cles.length === clesDe(b).length && cles.every((k) => memeContenu(a[k], b[k]));
}

/**
 * Rejoint deux versions d'un document parties de la même base : ce que l'un seul a touché est gardé,
 * champ par champ, et élément par élément dans une liste dont chaque élément porte son nom. Quand les
 * deux ont touché le même champ, `prefere` tranche. Ce que l'un a retiré et que l'autre a retouché reste.
 */
export function fusionnerDocuments(base: unknown, mien: unknown, leur: unknown, prefere: "mien" | "leur"): unknown {
  if (memeContenu(mien, leur) || memeContenu(mien, base)) return leur;
  if (memeContenu(leur, base)) return mien;
  if (estObjet(mien) && estObjet(leur)) {
    const b = estObjet(base) ? base : {};
    const fusion: Objet = {};
    for (const k of new Set([...clesDe(leur), ...clesDe(mien)])) {
      const [m, l] = [mien[k], leur[k]];
      const seul = m === undefined ? l : m;
      if (m !== undefined && l !== undefined) fusion[k] = fusionnerDocuments(b[k], m, l, prefere);
      // Présent d'un seul côté : ajouté par lui, ou retiré par l'autre (qui gagne si lui n'y a pas touché).
      else if (b[k] === undefined || !memeContenu(seul, b[k])) fusion[k] = seul;
    }
    return fusion;
  }
  if (estListeNommee(mien) && estListeNommee(leur)) {
    const parNom = (liste: unknown) => new Map((estListeNommee(liste) ? liste : []).map((e) => [nomDe(e), e]));
    const [b, m, l] = [parNom(base), parNom(mien), parNom(leur)];
    // Présent d'un seul côté : ajouté par lui, ou retiré par l'autre (qui gagne si lui n'y a pas touché).
    const garde = (e: Objet) => !b.has(nomDe(e)) || !memeContenu(e, b.get(nomDe(e)));
    return [
      ...leur.flatMap((e) => (m.has(nomDe(e)) ? [fusionnerDocuments(b.get(nomDe(e)), m.get(nomDe(e)), e, prefere)] : garde(e) ? [e] : [])),
      ...mien.filter((e) => !l.has(nomDe(e)) && garde(e)),
    ];
  }
  return prefere === "mien" ? mien : leur;
}

/**
 * Ce que devient une modification en attente quand la version du serveur arrive : le document à garder
 * sur le téléphone, et ce qui reste à envoyer (null si le serveur dit déjà tout). Ce qui repart porte
 * une heure juste après celle du serveur, pour qu'il ne le refuse pas quand l'horloge du téléphone retarde.
 */
export function rapprocher(local: EnAttente, distant: Changement): { donnees: unknown; enAttente: EnAttente | null } {
  if (!("base" in local)) {
    return distantGagne(local, distant) ? { donnees: distant.donnees, enAttente: null } : { donnees: local.donnees, enAttente: local };
  }
  const fusion = fusionnerDocuments(local.base, local.donnees, distant.donnees, distantGagne(local, distant) ? "leur" : "mien");
  if (memeContenu(fusion, distant.donnees)) return { donnees: distant.donnees, enAttente: null };
  const maj = local.maj > distant.maj ? local.maj : new Date(Date.parse(distant.maj) + 1).toISOString();
  return { donnees: fusion, enAttente: { collection: local.collection, id: local.id, donnees: fusion, base: distant.donnees, maj } };
}

/**
 * Lettres et chiffres sans ambiguïté à l'oral ni à l'écrit (ni O ni 0, ni I, L ou 1).
 * Le serveur tire les codes d'invitation dans ce même alphabet (supabase/schema.sql).
 */
export const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Le code que Melo donne à Sarah pour rejoindre le foyer : 6 caractères, affichés « K7Q-M4P ». */
export function afficherCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/** Accepte « k7q m4p », « K7Q-M4P »… ; null si ce n'est pas un code possible. */
export function normaliserCode(saisie: string): string | null {
  const code = saisie
    .toUpperCase()
    .replace(/[\s-]/g, "");
  return code.length === 6 && [...code].every((c) => ALPHABET_CODE.includes(c)) ? code : null;
}

/**
 * Reprend un peu avant le dernier curseur : un changement enregistré au même moment
 * que la dernière lecture n'est jamais perdu. Le relire deux fois ne change rien.
 */
export function curseurAvecMarge(curseur: string | null, margeMs = 5000): string | null {
  if (!curseur) return null;
  return new Date(Date.parse(curseur) - margeMs).toISOString();
}

/** « à l'instant », « il y a 5 min », « il y a 2 h », sinon « le 7 octobre ». */
export function decrireDerniereSynchro(quand: string | null, maintenant: string): string {
  if (!quand) return "jamais";
  const minutes = Math.floor((Date.parse(maintenant) - Date.parse(quand)) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  return `le ${new Date(quand).toLocaleDateString("fr-CH", { day: "numeric", month: "long" })}`;
}
