// Le mode magasin : la liste de courses dans l'ordre où l'on passe devant les rayons. Kora
// l'apprend en regardant l'ordre des coches pendant les courses (un ticket de caisse, lui, suit
// l'ordre du tapis, pas celui des allées). Le premier rayon coché d'un passage prend le rang 0,
// le suivant 1, et ainsi de suite ; chaque passage déplace un peu le rang moyen. Le parcours est
// partagé avec la liste : les deux vont dans le même magasin.

import { RAYONS, type Element, type Liste, type ParcoursMagasin, type Rayon } from "./types";

/** Des coches à moins de 45 minutes les unes des autres font un même passage au magasin. */
export const MINUTES_DU_PASSAGE = 45;
/** Il faut deux passages avant de changer l'ordre de la liste : un seul peut être un hasard. */
export const PASSAGES_AVANT_ORDRE = 2;
/** La part du dernier passage dans le rang moyen. */
const POIDS_DU_PASSAGE = 0.3;

const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * Note le rayon d'un article qu'on vient de cocher. Seul le premier article d'un rayon dans un
 * passage compte : revenir prendre le lait oublié ne déplace pas la crèmerie.
 */
export function noterParcours(liste: Liste, coche: Element, elements: readonly Element[], maintenant: string): Liste {
  if (liste.type !== "courses" || coche.rayon === "Autre") return liste;
  const depuis = new Date(Date.parse(maintenant) - MINUTES_DU_PASSAGE * 60_000).toISOString();
  const passage = elements.filter(
    (e) => e.listeId === liste.id && e.id !== coche.id && e.coche && e.cocheLe && e.cocheLe >= depuis && e.cocheLe <= maintenant,
  );
  if (passage.some((e) => e.rayon === coche.rayon)) return liste;
  const rang = new Set(passage.map((e) => e.rayon).filter((r) => r !== "Autre")).size;
  const avant: ParcoursMagasin = liste.parcours ?? { rangs: {}, passages: 0 };
  const ancien = avant.rangs[coche.rayon];
  return {
    ...liste,
    parcours: {
      rangs: { ...avant.rangs, [coche.rayon]: ancien === undefined ? rang : arrondi(ancien * (1 - POIDS_DU_PASSAGE) + rang * POIDS_DU_PASSAGE) },
      passages: avant.passages + (passage.length === 0 ? 1 : 0),
    },
  };
}

/** Le parcours est-il assez appris pour ranger la liste ? */
export function parcoursAppris(liste: Pick<Liste, "parcours">): boolean {
  return (liste.parcours?.passages ?? 0) >= PASSAGES_AVANT_ORDRE;
}

/**
 * Les rayons dans l'ordre du magasin : ceux qu'on a déjà parcourus selon leur rang moyen, puis
 * les autres dans l'ordre habituel, « Autre » toujours au bout.
 */
export function ordreDesRayons(liste: Pick<Liste, "parcours">): readonly Rayon[] {
  if (!parcoursAppris(liste)) return RAYONS;
  const rangs = liste.parcours!.rangs;
  const appris = RAYONS.filter((r) => r !== "Autre" && rangs[r] !== undefined).sort((a, b) => rangs[a]! - rangs[b]! || RAYONS.indexOf(a) - RAYONS.indexOf(b));
  return [...appris, ...RAYONS.filter((r) => !appris.includes(r) && r !== "Autre"), "Autre"];
}
