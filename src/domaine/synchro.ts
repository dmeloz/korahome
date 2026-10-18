// Le partage entre les deux iPhone du foyer. Chaque téléphone garde toutes ses données
// et fonctionne hors ligne ; chaque modification devient un « changement » daté, mis en
// attente puis envoyé. Quand deux téléphones ont modifié la même chose, la modification
// la plus récente gagne, document par document.

export type CollectionSynchro = "foyer" | "listes" | "elements" | "taches" | "animaux" | "stock" | "catalogue" | "jardin" | "memoire" | "couple" | "menus" | "agenda" | "retours";

/**
 * Ce qui se partage. Les notes de test aussi : elles arrivent ainsi sur le serveur, où
 * Claude les lit, et les deux iPhone voient toutes les notes. Les réglages restent propres
 * à chaque téléphone.
 */
export const COLLECTIONS_SYNCHRO: readonly CollectionSynchro[] = ["foyer", "listes", "elements", "taches", "animaux", "stock", "catalogue", "jardin", "memoire", "couple", "menus", "agenda", "retours"];

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

/** Ne garde que la dernière modification de chaque document. */
export function compacter(changements: readonly Changement[]): Changement[] {
  const parCle = new Map<string, Changement>();
  for (const c of changements) {
    const avant = parCle.get(cleDe(c));
    // À égalité, le dernier arrivé gagne.
    parCle.set(cleDe(c), avant && avant.maj > c.maj ? avant : c);
  }
  return [...parCle.values()];
}

/**
 * Rapproche ce qui attend d'être envoyé et ce qui arrive de l'autre téléphone :
 * pour chaque document, la modification la plus récente gagne. Une modification
 * locale battue par une plus récente n'a plus à partir.
 */
export function fusionner(
  enAttente: readonly Changement[],
  distants: readonly Changement[],
): { aAppliquer: Changement[]; enAttente: Changement[] } {
  const locaux = new Map(compacter(enAttente).map((c) => [cleDe(c), c]));
  const aAppliquer: Changement[] = [];
  for (const d of compacter(distants)) {
    const local = locaux.get(cleDe(d));
    if (!distantGagne(local, d)) continue;
    locaux.delete(cleDe(d));
    aAppliquer.push(d);
  }
  return { aAppliquer, enAttente: [...locaux.values()] };
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
