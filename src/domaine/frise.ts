// La frise des jours (Kora 0.1.22, idée validée par Melo le 20 novembre 2026) : une case par
// jour, plus ou moins foncée selon ce qu'on a dépensé ce jour-là, sur les six derniers mois.
// Les factures payées (une dépense liée à une charge) n'y sont pas : la frise montre le quotidien.

import { lundiDe } from "./agenda";
import { depenses, type DocBudget } from "./budget";
import { decaler } from "./taches";
import type { Jour } from "./types";

export interface CaseFrise {
  jour: Jour;
  total: number;
  nombre: number;
  /** 0 : rien ce jour-là ; 1 à 4 : du plus clair au plus foncé. */
  niveau: 0 | 1 | 2 | 3 | 4;
  /** Un jour qui n'est pas encore arrivé (la fin de la semaine en cours). */
  aVenir: boolean;
}

/** Combien de semaines la frise montre : six mois tiennent sur la largeur d'un iPhone. */
export const SEMAINES_FRISE = 26;

/** Le niveau d'un jour : sa place parmi les jours où l'on a dépensé (quarts), pour qu'un gros achat n'écrase pas le reste. */
export function niveauDe(total: number, tries: readonly number[]): CaseFrise["niveau"] {
  if (total <= 0 || !tries.length) return 0;
  const rang = tries.filter((t) => t <= total).length / tries.length;
  return rang <= 0.25 ? 1 : rang <= 0.5 ? 2 : rang <= 0.75 ? 3 : 4;
}

/** Les semaines de la frise, de la plus ancienne à celle d'aujourd'hui, chacune du lundi au dimanche. */
export function friseDesDepenses(docs: readonly DocBudget[], aujourdhui: Jour, semaines = SEMAINES_FRISE): CaseFrise[][] {
  const debut = decaler(lundiDe(aujourdhui), { unite: "jour", tous: -7 * (semaines - 1) });
  const parJour = new Map<Jour, { total: number; nombre: number }>();
  for (const d of depenses(docs)) {
    if (d.posteId || d.jour < debut || d.jour > aujourdhui) continue;
    const j = parJour.get(d.jour) ?? { total: 0, nombre: 0 };
    parJour.set(d.jour, { total: j.total + d.montant, nombre: j.nombre + 1 });
  }
  const tries = [...parJour.values()].map((j) => j.total).filter((t) => t > 0).sort((a, b) => a - b);
  return Array.from({ length: semaines }, (_, s) =>
    Array.from({ length: 7 }, (_, k) => {
      const jour = decaler(debut, { unite: "jour", tous: s * 7 + k });
      const j = parJour.get(jour) ?? { total: 0, nombre: 0 };
      const total = Math.round(j.total * 100) / 100;
      return { jour, total, nombre: j.nombre, niveau: niveauDe(total, tries), aVenir: jour > aujourdhui };
    }),
  );
}

/** La case sous le doigt : `partX` et `partY` vont de 0 à 1 dans la grille. */
export function caseSous(partX: number, partY: number, semaines: number): { semaine: number; jour: number } {
  const borne = (v: number, n: number) => Math.max(0, Math.min(n - 1, Math.floor(v * n)));
  return { semaine: borne(partX, semaines), jour: borne(partY, 7) };
}
