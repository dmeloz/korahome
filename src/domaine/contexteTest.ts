import type { Contexte } from "./types";

/** Contexte déterministe pour les tests : identifiants et horloge prévisibles. */
export function contexteTest(debut = "2026-10-07T08:00:00.000Z"): Contexte {
  let n = 0;
  let t = Date.parse(debut);
  return {
    nouvelId: () => `id-${++n}`,
    maintenant: () => new Date((t += 1000)).toISOString(),
  };
}
