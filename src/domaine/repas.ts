// « Ce soir on a mangé » (depuis Kora 0.0.98, idée de Melo du 27 octobre 2026) : une ligne par
// soir, écrite dans Cuisine › Menus ou dite à la fée sur cette page, même sans menu ni Chef. Si
// le plat porte le nom d'une recette du foyer, la recette est comptée comme cuisinée. Le Chef s'en
// sert ensuite pour varier (`dejaServi` dans variete.ts) et le lit dans son message.
//
// Un document par soir dans la collection « menus » : « repas-AAAA-MM-JJ ». Écrire à nouveau le
// même soir remplace la ligne.

import { cleRecette, marquerCuisinee, trouverRecette, type Recette } from "./recettes";
import type { Contexte, Id, Jour } from "./types";

export interface RepasMange {
  id: Id;
  type: "repas";
  jour: Jour;
  titre: string;
  /** La recette du foyer qui porte ce nom, quand il y en a une. */
  recetteId: Id | null;
  /** Qui l'a noté. */
  par: Id | null;
  modifieLe: string;
}

export const TITRE_REPAS_MAX = 80;
/** Ce que la page montre sous le soir du jour. */
export const JOURS_DU_JOURNAL = 7;

export const idRepas = (jour: Jour): Id => `repas-${jour}`;

export function estRepas(doc: unknown): doc is RepasMange {
  const d = doc as Partial<RepasMange> | null;
  return !!d && typeof d === "object" && d.type === "repas" && typeof d.jour === "string" && typeof d.titre === "string";
}

/** Les soirs notés, du plus récent au plus ancien. */
export function repasDe(docs: readonly unknown[]): RepasMange[] {
  return docs.filter(estRepas).sort((a, b) => b.jour.localeCompare(a.jour));
}

const decalerJour = (jour: Jour, jours: number): Jour => {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + jours)).toISOString().slice(0, 10);
};

/** Le soir du jour, s'il est noté. */
export function repasDuJour(docs: readonly unknown[], jour: Jour): RepasMange | null {
  return repasDe(docs).find((r) => r.jour === jour) ?? null;
}

/** Les soirs notés avant aujourd'hui, sur les `jours` derniers jours. */
export function repasRecents(docs: readonly unknown[], aujourdhui: Jour, jours = JOURS_DU_JOURNAL): RepasMange[] {
  const debut = decalerJour(aujourdhui, -jours);
  return repasDe(docs).filter((r) => r.jour < aujourdhui && r.jour >= debut);
}

const propre = (t: string) => t.trim().replace(/\s+/g, " ").replace(/[.!]+$/, "").slice(0, TITRE_REPAS_MAX);
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Noter le soir : la ligne du jour (remplacée si elle existe) et, quand le plat est une recette
 * du foyer, cette recette comptée comme cuisinée. null pour un titre vide.
 */
export function noterRepas(
  d: { titre: string; jour: Jour; recettes: readonly Recette[]; membreId: Id | null },
  ctx: Contexte,
): { repas: RepasMange; recette: Recette | null } | null {
  const titre = majuscule(propre(d.titre));
  if (!titre) return null;
  const trouvee = trouverRecette(d.recettes, titre);
  // Seulement le même plat : « pâtes » ne compte pas « pâtes au pesto ».
  const recette = trouvee && trouvee.cle === cleRecette(titre) ? trouvee : null;
  const repas: RepasMange = { id: idRepas(d.jour), type: "repas", jour: d.jour, titre: recette ? recette.titre : titre, recetteId: recette?.id ?? null, par: d.membreId, modifieLe: ctx.maintenant() };
  return { repas, recette: recette && recette.derniereFois !== d.jour ? marquerCuisinee(recette, d.jour, ctx) : null };
}

// « ce soir on a mangé des pâtes », « hier soir raclette », « on a mangé : une soupe ».
const PHRASE = /^(?:(ce soir|hier soir|hier)\s*,?\s*)?(?:(?:on a|j'ai|j’ai|nous avons)\s+)?(?:mang[ée]s?|cuisin[ée])\s*:?\s*(?:(?:des|du|de la|de l'|de l’|une|un|les|le|la|l'|l’)\s*)?(.+)$/i;
const PHRASE_HIER = /^hier soir\s*,?\s*:?\s*(.+)$/i;

/** Une phrase dite à la fée sur la page des menus : le plat et le soir, ou null si ce n'en est pas une. */
export function lirePhraseRepas(texte: string, aujourdhui: Jour): { titre: string; jour: Jour } | null {
  const t = texte.trim();
  const m = PHRASE.exec(t);
  if (m) {
    const titre = propre(m[2]);
    if (!titre) return null;
    return { titre, jour: m[1] && /^hier/i.test(m[1]) ? decalerJour(aujourdhui, -1) : aujourdhui };
  }
  const h = PHRASE_HIER.exec(t);
  if (h && propre(h[1])) return { titre: propre(h[1]), jour: decalerJour(aujourdhui, -1) };
  return null;
}

const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** « Hier », « lun. 26 ». */
export function nomDuSoirPasse(jour: Jour, aujourdhui: Jour): string {
  if (jour === decalerJour(aujourdhui, -1)) return "Hier";
  const [a, m, j] = jour.split("-").map(Number);
  return `${JOURS_COURTS[new Date(Date.UTC(a, m - 1, j)).getUTCDay()]} ${j}`;
}

/** Ce que le Chef lit : « Mangé ces derniers soirs : raclette (hier), pâtes au pesto (lun. 26) ». */
export function decrireRepasRecents(docs: readonly unknown[], aujourdhui: Jour): string | null {
  const recents = repasRecents(docs, aujourdhui, 14);
  if (!recents.length) return null;
  return `Mangé ces derniers soirs (ne pas les reproposer) : ${recents.map((r) => `${r.titre.toLowerCase()} (${nomDuSoirPasse(r.jour, aujourdhui).toLowerCase()})`).join(", ")}.`;
}
