// La fiche de la semaine : la version légère de la « fiche de production croisée » de la
// cuisine pro (le modèle complet vit dans Sanji). Les repas de la semaine côte à côte, chaque
// ingrédient une seule fois avec sa quantité par repas et le total, ce qui est déjà à la
// maison, et ce qu'on gagne à préparer en une fois quand un ingrédient sert à plusieurs repas.
//
// Les repas : d'abord les recettes posées sur un soir des sept prochains jours, puis celles du
// menu du Chef. Les quantités restent celles de chaque recette, pour son nombre de personnes.

import type { MenuSemaine } from "./chef";
import { cleProduit } from "./connaissances";
import { detecterRayon } from "./rayons";
import { estDeBase, lireNombre, NOMBRE, produitPour, soirsPrevus, type Recette } from "./recettes";
import type { Produit } from "./stock";
import type { Contexte, Element, Id, Jour, Liste } from "./types";

export const PLATS_FICHE_MAX = 7;

export interface PlatFiche {
  /** « P1 », « P2 »… comme sur une fiche de production. */
  code: string;
  recette: Recette;
  /** Le soir prévu ; null pour un repas du Chef pas encore posé sur un soir. */
  quand: Jour | null;
}

export interface LigneFiche {
  nom: string;
  cle: string;
  /** La quantité pour chaque repas, dans l'ordre des plats ; null quand il n'en a pas besoin ou sans quantité. */
  quantites: (string | null)[];
  /** Le total de la semaine ; null quand les quantités ne s'additionnent pas (« 1 boîte » et « 200 g »). */
  total: string | null;
  /** Combien de repas l'utilisent. */
  repas: number;
  deBase: boolean;
  aLaMaison: boolean;
}

export interface FicheSemaine {
  plats: PlatFiche[];
  /** Un ingrédient par ligne : ceux de plusieurs repas d'abord, le sel et l'huile à la fin. */
  ingredients: LigneFiche[];
  /** Ce qui sert à au moins deux repas : à éplucher, tailler ou cuire en une fois. */
  communs: LigneFiche[];
  /** Ce qui manque au stock (sans le sel, l'huile, les épices). */
  aAcheter: LigneFiche[];
}

/** Les repas de la semaine : les soirs prévus, puis les repas du Chef, sans doublon. */
export function platsDeLaSemaine(recettes: readonly Recette[], menu: MenuSemaine | null, aujourdhui: Jour): PlatFiche[] {
  const choisis: { recette: Recette; quand: Jour | null }[] = soirsPrevus(recettes, aujourdhui).map(({ jour, recette }) => ({ recette, quand: jour }));
  for (const repas of menu?.repas ?? []) {
    const r = repas.recetteId ? recettes.find((x) => x.id === repas.recetteId) : undefined;
    if (r && !choisis.some((c) => c.recette.id === r.id)) choisis.push({ recette: r, quand: null });
  }
  return choisis.slice(0, PLATS_FICHE_MAX).map((c, i) => ({ code: `P${i + 1}`, ...c }));
}

export function ficheDeLaSemaine(plats: readonly PlatFiche[], produits: readonly Produit[]): FicheSemaine {
  const lignes = new Map<string, { nom: string; quantites: (string | null)[]; utilise: boolean[] }>();
  plats.forEach((plat, n) => {
    for (const i of plat.recette.ingredients) {
      const cle = cleProduit(i.nom);
      if (!cle) continue;
      let l = lignes.get(cle);
      if (!l) {
        l = { nom: i.nom, quantites: plats.map(() => null), utilise: plats.map(() => false) };
        lignes.set(cle, l);
      }
      // Le même ingrédient deux fois dans une recette (« beurre » pour la pâte et la sauce) s'additionne.
      l.quantites[n] = l.utilise[n] ? additionner([l.quantites[n], i.quantite]) : i.quantite;
      l.utilise[n] = true;
    }
  });
  const ingredients: LigneFiche[] = [...lignes.entries()].map(([cle, l]) => {
    const deBase = estDeBase(l.nom);
    return {
      nom: l.nom,
      cle,
      quantites: l.quantites,
      total: additionner(l.quantites.filter((_, n) => l.utilise[n])),
      repas: l.utilise.filter(Boolean).length,
      deBase,
      aLaMaison: deBase || !!produitPour(l.nom, produits),
    };
  });
  ingredients.sort((a, b) => Number(a.deBase) - Number(b.deBase) || b.repas - a.repas || a.nom.localeCompare(b.nom, "fr"));
  return {
    plats: [...plats],
    ingredients,
    communs: ingredients.filter((l) => l.repas >= 2 && !l.deBase),
    aAcheter: ingredients.filter((l) => !l.aLaMaison),
  };
}

// ----- Additionner des quantités écrites à la main -----

type Mesure = { valeur: number; famille: "g" | "ml" | "piece" | "mot"; mot: string };

const QUANTITE = new RegExp(`^${NOMBRE}\\s*(.*)$`);
const POIDS: Record<string, number> = { mg: 0.001, g: 1, gr: 1, kg: 1000 };
const VOLUMES: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000 };

function mesurer(quantite: string): Mesure | null {
  const m = quantite.trim().match(QUANTITE);
  if (!m) return null;
  const n = lireNombre(m[1]);
  if (n === null) return null;
  const unite = m[2].trim().replace(/\.$/, "");
  const u = unite.toLowerCase();
  if (u in POIDS) return { valeur: n * POIDS[u], famille: "g", mot: "" };
  if (u in VOLUMES) return { valeur: n * VOLUMES[u], famille: "ml", mot: "" };
  if (!u) return { valeur: n, famille: "piece", mot: "" };
  // « gousses » et « gousse » s'additionnent ; « c. à soupe » reste tel quel.
  return { valeur: n, famille: "mot", mot: u.replace(/^(\p{L}+?)s$/u, "$1") };
}

function nombre(n: number): string {
  if (n >= 100) return String(Math.round(n / 5) * 5);
  if (n >= 10) return String(Math.round(n));
  const demi = Math.max(0.5, Math.round(n * 2) / 2);
  return Number.isInteger(demi) ? String(demi) : demi === 0.5 ? "½" : `${Math.floor(demi)}½`;
}

const decimal = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

function ecrire(m: Mesure): string {
  if (m.famille === "g") return m.valeur >= 1000 ? `${decimal(m.valeur / 1000)} kg` : `${nombre(m.valeur)} g`;
  if (m.famille === "ml") {
    if (m.valeur >= 1000) return `${decimal(m.valeur / 1000)} l`;
    if (m.valeur >= 100) return `${decimal(m.valeur / 100)} dl`;
    return `${nombre(m.valeur)} ml`;
  }
  if (m.famille === "piece") return nombre(m.valeur);
  const pluriel = m.valeur > 1 && /^\p{L}+$/u.test(m.mot) ? `${m.mot}s` : m.mot;
  return `${nombre(m.valeur)} ${pluriel}`;
}

/**
 * Le total de quantités écrites à la main : « 200 g » + « 1 kg » = « 1,2 kg », « 2 dl » + « 50 cl »
 * = « 7 dl », « 2 gousses » + « 1 gousse » = « 3 gousses ». Une seule quantité est rendue telle
 * quelle ; null quand il n'y en a aucune ou qu'elles ne s'additionnent pas.
 */
export function additionner(quantites: readonly (string | null)[]): string | null {
  const ecrites = quantites.filter((q): q is string => !!q && !!q.trim());
  if (!ecrites.length || ecrites.length < quantites.length) return null;
  if (ecrites.length === 1) return ecrites[0];
  const mesures = ecrites.map(mesurer);
  const premiere = mesures[0];
  if (!premiere || mesures.some((m) => !m || m.famille !== premiere.famille || m.mot !== premiere.mot)) return null;
  return ecrire({ ...premiere, valeur: mesures.reduce((s, m) => s + m!.valeur, 0) });
}

// ----- Ce qu'on en fait -----

const contient = (grand: string, petit: string) => ` ${grand} `.includes(` ${petit} `);

/** Le manquant de toute la semaine aux courses, une ligne par ingrédient avec son total, sans ce qui y est déjà. */
export function coursesDeLaFiche(fiche: FicheSemaine, liste: Liste, elements: readonly Element[], membreId: Id | null, ctx: Contexte): Element[] {
  const sur = elements.filter((e) => e.listeId === liste.id && !e.coche).map((e) => cleProduit(e.texte));
  return fiche.aAcheter
    .filter((l) => !sur.some((s) => s === l.cle || contient(s, l.cle) || contient(l.cle, s)))
    .map((l) => ({
      id: ctx.nouvelId(),
      listeId: liste.id,
      texte: l.nom,
      quantite: l.total,
      rayon: detecterRayon(l.nom),
      coche: false,
      ajoutePar: membreId,
      creeLe: ctx.maintenant(),
      cocheLe: null,
    }));
}

/** Le détail d'une ligne : « P1 200 g · P3 150 g ». */
export function detailLigne(fiche: FicheSemaine, ligne: LigneFiche): string {
  return fiche.plats
    .map((p, n) => (ligne.quantites[n] !== null || ingredientDans(p, ligne.cle) ? `${p.code}${ligne.quantites[n] ? ` ${ligne.quantites[n]}` : ""}` : null))
    .filter(Boolean)
    .join(" · ");
}

const ingredientDans = (p: PlatFiche, cle: string) => p.recette.ingredients.some((i) => cleProduit(i.nom) === cle);

/** La fiche en texte, pour la partager ou l'imprimer depuis Notes. */
export function texteFiche(fiche: FicheSemaine, nomDuJour: (jour: Jour) => string): string {
  const lignes = [`Fiche de la semaine · ${fiche.plats.length} repas`, ""];
  for (const p of fiche.plats) lignes.push(`${p.code} · ${p.quand ? nomDuJour(p.quand) : "Chef"} · ${p.recette.titre} (${p.recette.portions} pers.)`);
  if (fiche.communs.length) {
    lignes.push("", "À préparer en une fois");
    for (const l of fiche.communs) lignes.push(`- ${l.nom}${l.total ? ` : ${l.total}` : ""} (${detailLigne(fiche, l)})`);
  }
  lignes.push("", "Ingrédients");
  for (const l of fiche.ingredients) {
    const etat = l.deBase ? "" : l.aLaMaison ? " · à la maison" : " · à acheter";
    lignes.push(`- ${l.nom}${l.total ? ` : ${l.total}` : ""}${etat} (${detailLigne(fiche, l)})`);
  }
  return lignes.join("\n");
}
