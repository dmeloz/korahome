// Ce que Kora sait déjà des produits courants : où on les range et combien de temps
// ils se gardent une fois achetés. Sert de proposition tant que le foyer n'a pas
// ses propres habitudes (voir catalogue.ts). Durées prudentes, produit non entamé.

import type { Lieu, Unite } from "./stock";

export interface Connaissance {
  lieu: Lieu;
  /** Jours de conservation ; null quand ça se garde sans date utile (sel, sucre). */
  jours: number | null;
  unite?: Unite;
}

const F = (jours: number | null, unite?: Unite): Connaissance => ({ lieu: "frigo", jours, unite });
const C = (jours: number | null, unite?: Unite): Connaissance => ({ lieu: "congelateur", jours, unite });
const P = (jours: number | null, unite?: Unite): Connaissance => ({ lieu: "placard", jours, unite });

/** Les mots sont écrits sans accent et au singulier, comme les compare `cleProduit`. */
const CONNAISSANCES: Record<string, Connaissance> = {
  // Frigo
  lait: F(7, "l"), yaourt: F(14), yogourt: F(14), creme: F(7), "creme fraiche": F(10), beurre: F(30, "g"),
  fromage: F(14, "g"), "fromage rape": F(14, "g"), mozzarella: F(5), gruyere: F(30, "g"), parmesan: F(30, "g"),
  feta: F(14), mascarpone: F(7), ricotta: F(5), oeuf: F(21), jambon: F(4), lardon: F(7, "g"), saucisse: F(4),
  poulet: F(2, "g"), viande: F(2, "g"), "viande hachee": F(1, "g"), hache: F(1, "g"), steak: F(2), boeuf: F(3, "g"),
  porc: F(3, "g"), veau: F(2, "g"), poisson: F(1, "g"), saumon: F(2, "g"), crevette: F(2, "g"), tofu: F(7, "g"),
  salade: F(4), epinard: F(3, "g"), courgette: F(7), carotte: F(14), tomate: F(5), poivron: F(7), champignon: F(4, "g"),
  concombre: F(7), brocoli: F(5), fraise: F(3, "g"), framboise: F(2, "g"), myrtille: F(5, "g"), raisin: F(7, "g"),
  citron: F(21), jus: F(7, "l"), "jus d'orange": F(7, "l"), compote: F(14), pesto: F(7, "g"), houmous: F(5, "g"),
  "pate feuilletee": F(10), "pate brisee": F(10), "pate a pizza": F(7), tarte: F(3), gnocchi: F(14, "g"),
  "pate fraiche": F(5, "g"), quiche: F(3), dessert: F(7), flan: F(10),
  // Congélateur
  surgele: C(180), glace: C(180), frite: C(180, "g"), "petit pois": C(180, "g"), nugget: C(180),
  "poisson pane": C(180), "legume surgele": C(180, "g"), "pizza surgelee": C(180), glacon: C(null),
  // Placard
  pate: P(365, "g"), spaghetti: P(365, "g"), riz: P(365, "kg"), farine: P(180, "kg"), sucre: P(null, "kg"), sel: P(null),
  huile: P(365, "l"), vinaigre: P(null, "l"), conserve: P(730), thon: P(730), mais: P(730), haricot: P(365),
  lentille: P(365, "g"), "pois chiche": P(365), quinoa: P(365, "g"), semoule: P(365, "g"), cafe: P(180, "g"),
  the: P(365), chocolat: P(180, "g"), biscuit: P(90), cereale: P(180, "g"), muesli: P(180, "g"), confiture: P(365),
  miel: P(null), pain: P(3), "pain de mie": P(7), baguette: P(1), chip: P(60, "g"), "sauce tomate": P(365),
  coulis: P(365), "lait de coco": P(365), "lait uht": P(90, "l"), oignon: P(30), ail: P(60), echalote: P(30),
  "pomme de terre": P(30, "kg"), banane: P(5), pomme: P(21), poire: P(7), orange: P(14), kiwi: P(10), avocat: P(4),
  eau: P(null, "l"), vin: P(null), biere: P(180), croquette: P(180, "kg"),
  epice: P(730), bouillon: P(365), levure: P(180),
};

/** « Pâtes fraîches » → « pate fraiche » : minuscules, sans accent, chaque mot au singulier. */
export function cleProduit(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((mot) => (mot.length > 3 && /[sx]$/.test(mot) && !/(?:ss|is|us|ys)$/.test(mot) ? mot.slice(0, -1) : mot))
    .join(" ");
}

/**
 * Ce que Kora sait d'un produit : l'expression connue la plus longue contenue dans son
 * nom (« pâte feuilletée » l'emporte sur « pâte »). null quand le produit est inconnu.
 */
export function connaissanceDe(nom: string): Connaissance | null {
  const mots = ` ${cleProduit(nom)} `;
  let trouve: { cle: string; c: Connaissance } | null = null;
  for (const [cle, c] of Object.entries(CONNAISSANCES)) {
    if (mots.includes(` ${cle} `) && (!trouve || cle.length > trouve.cle.length)) trouve = { cle, c };
  }
  return trouve?.c ?? null;
}
