import type { Element, Foyer, Id, Liste } from "./types";

// La pastille « en direct » des courses (depuis Kora 0.0.72) : l'autre coche la liste en ce
// moment. Le reste de l'ancien accueil (piles, chiffres, rotation) est parti avec Kora 0.1.

/** Des articles cochés depuis moins de 20 minutes : quelqu'un est en train de faire les courses. */
export const EN_DIRECT_MINUTES = 20;
/** Il en faut au moins deux : un seul coché, c'est peut-être un oubli rattrapé. */
const EN_DIRECT_MIN = 2;

export interface EnDirect {
  /** Le prénom de l'autre, ou « Quelqu'un » quand le téléphone qui coche ne le dit pas. */
  qui: string;
  coches: number;
  total: number;
}

/**
 * La pastille « en direct » : l'autre coche les courses en ce moment (« Sarah fait les courses ·
 * 4 sur 6 »). Un article coché sans `cochePar` vient d'une ancienne version de Kora, donc d'un
 * autre téléphone : il compte pour l'autre quand on est deux.
 */
export function enDirect(
  d: { listes: readonly Liste[]; elements: readonly Element[]; foyer: Pick<Foyer, "membres">; membreId: Id | null },
  maintenant: string,
): EnDirect | null {
  const liste = d.listes.find((l) => l.type === "courses");
  if (!liste) return null;
  const siens = d.elements.filter((e) => e.listeId === liste.id);
  const depuis = new Date(Date.parse(maintenant) - EN_DIRECT_MINUTES * 60_000).toISOString();
  const autres = d.foyer.membres.filter((m) => m.id !== d.membreId);
  const recents = siens.filter((e) => e.coche && e.cocheLe && e.cocheLe >= depuis && e.cocheLe <= maintenant && (e.cochePar ?? null) !== d.membreId);
  const parQui = new Map<string, number>();
  for (const e of recents) {
    const qui = e.cochePar ?? (autres.length === 1 ? autres[0].id : "");
    parQui.set(qui, (parQui.get(qui) ?? 0) + 1);
  }
  const [qui, n] = [...parQui.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (n < EN_DIRECT_MIN) return null;
  return {
    qui: d.foyer.membres.find((m) => m.id === qui)?.prenom ?? "Quelqu'un",
    coches: siens.filter((e) => e.coche).length,
    total: siens.length,
  };
}

/** Coche ou décoche en notant qui : la pastille « en direct » de l'autre téléphone le lit. */
export function noterCocheur(avant: Element, apres: Element, par: Id | null): Element {
  return apres.coche && !avant.coche ? { ...apres, cochePar: par } : { ...apres, cochePar: null };
}

// ----- Les gestes, découverts en douceur -----

/** « Glisse quand c'est fait » se montre les premières fois seulement. */
export const INDICE_FOIS = 3;

/** Le petit mot du geste : tant qu'il n'a pas été vu assez et que le geste n'a jamais été fait. */
export function montrerIndice(vues: number, geste: boolean): boolean {
  return !geste && vues < INDICE_FOIS;
}

/** « Ce soir » tourne d'une chose à la suivante toutes les six secondes. */
export const ROTATION_MS = 6000;

export function suivante(index: number, nombre: number): number {
  return nombre ? (index + 1) % nombre : 0;
}
