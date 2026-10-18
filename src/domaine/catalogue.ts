// La Base : les produits habituels du foyer, appris tout seuls à chaque ajout au stock.
// Elle retient le lieu, la quantité, l'unité et la durée de conservation de chacun ;
// au prochain ajout, Kora les propose, et un produit habituel se remet d'un toucher.

import { cleProduit, connaissanceDe } from "./connaissances";
import { creerProduit, quantiteDe, type Lieu, type Produit, type Unite } from "./stock";
import { decaler, ecartJours } from "./taches";
import type { Contexte, Id, Jour } from "./types";

export interface ProduitHabituel {
  id: Id;
  nom: string;
  /** Le nom comparable (`cleProduit`) : un seul habituel par produit. */
  cle: string;
  lieu: Lieu;
  nombre: number | null;
  unite: Unite | null;
  /** Combien de jours il se garde, appris de la dernière date donnée ; null sans date. */
  dureeJours: number | null;
  code: string | null;
  image: string | null;
  /** Combien de fois il a été ajouté au stock : les plus fréquents passent devant. */
  fois: number;
  dernierAjout: Jour;
  /** Combien de fois il a quitté le stock fini, ou jeté parce que sa date était passée. */
  finis?: number;
  jetes?: number;
}

/** Ce que Kora propose pour un nom : ses habitudes d'abord, sinon ce qu'il sait déjà. */
export interface Proposition {
  lieu: Lieu;
  dureeJours: number | null;
  nombre: number | null;
  unite: Unite | null;
  source: "habitude" | "connaissance";
  habituel: ProduitHabituel | null;
}

export function trouverHabituel(catalogue: readonly ProduitHabituel[], nom: string, code?: string | null): ProduitHabituel | null {
  if (code) {
    const parCode = catalogue.find((h) => h.code === code);
    if (parCode) return parCode;
  }
  const cle = cleProduit(nom);
  return cle ? (catalogue.find((h) => h.cle === cle) ?? null) : null;
}

export function proposer(catalogue: readonly ProduitHabituel[], nom: string): Proposition | null {
  const h = trouverHabituel(catalogue, nom);
  if (h) return { lieu: h.lieu, dureeJours: h.dureeJours, nombre: h.nombre, unite: h.unite, source: "habitude", habituel: h };
  const c = connaissanceDe(nom);
  if (c) return { lieu: c.lieu, dureeJours: c.jours, nombre: null, unite: c.unite ?? null, source: "connaissance", habituel: null };
  return null;
}

/**
 * Un produit vient d'entrer au stock : son habituel est créé ou mis à jour avec ce
 * qui a été choisi cette fois. Rend l'habituel à enregistrer.
 */
export function apprendre(catalogue: readonly ProduitHabituel[], p: Produit, aujourdhui: Jour, ctx: Contexte): ProduitHabituel {
  const avant = trouverHabituel(catalogue, p.nom, p.code);
  const { nombre, unite } = quantiteDe(p);
  const duree = p.peremption ? ecartJours(aujourdhui, p.peremption) : null;
  return {
    id: avant?.id ?? ctx.nouvelId(),
    nom: p.nom,
    cle: cleProduit(p.nom),
    lieu: p.lieu,
    nombre: nombre ?? avant?.nombre ?? null,
    unite: nombre !== null ? unite : (avant?.unite ?? null),
    // Une date passée ou du jour ne dit rien de la conservation : on garde l'ancienne.
    dureeJours: duree !== null && duree > 0 ? duree : (avant?.dureeJours ?? null),
    code: p.code ?? avant?.code ?? null,
    image: p.image ?? avant?.image ?? null,
    fois: (avant?.fois ?? 0) + 1,
    dernierAjout: aujourdhui,
    ...(avant?.finis ? { finis: avant.finis } : {}),
    ...(avant?.jetes ? { jetes: avant.jetes } : {}),
  };
}

const parHabitude = (a: ProduitHabituel, b: ProduitHabituel) =>
  b.fois - a.fois || b.dernierAjout.localeCompare(a.dernierAjout) || a.nom.localeCompare(b.nom, "fr");

/** Les habituels qui commencent comme ce qui est tapé, les plus fréquents d'abord. */
export function suggerer(catalogue: readonly ProduitHabituel[], tape: string, n = 4): ProduitHabituel[] {
  const debut = cleProduit(tape);
  if (debut.length < 2) return [];
  return catalogue
    .filter((h) => h.cle !== debut && (h.cle.startsWith(debut) || h.cle.includes(` ${debut}`)))
    .sort(parHabitude)
    .slice(0, n);
}

/** Les habituels à remettre d'un toucher : les plus fréquents qui ne sont pas déjà au stock. */
export function habituelsARemettre(catalogue: readonly ProduitHabituel[], produits: readonly Produit[], n = 8): ProduitHabituel[] {
  const presents = new Set(produits.map((p) => cleProduit(p.nom)));
  return catalogue.filter((h) => !presents.has(h.cle)).sort(parHabitude).slice(0, n);
}

/** Toute la Base, dans l'ordre des habitudes. */
export function ordonnerCatalogue(catalogue: readonly ProduitHabituel[]): ProduitHabituel[] {
  return [...catalogue].sort(parHabitude);
}

/** Un produit habituel remis au stock, avec sa quantité, son lieu et sa date habituels. */
export function produitDepuisHabituel(h: ProduitHabituel, aujourdhui: Jour, ajoutePar: Id | null, ctx: Contexte): Produit {
  return creerProduit(
    {
      nom: h.nom,
      nombre: h.nombre,
      unite: h.unite,
      lieu: h.lieu,
      peremption: h.dureeJours ? decaler(aujourdhui, { unite: "jour", tous: h.dureeJours }) : null,
      code: h.code,
      image: h.image,
    },
    ajoutePar,
    ctx,
  );
}

/** « 5 jours », « 1 semaine », « 3 semaines », « 2 mois », « 1 an », arrondis ; null sans durée. */
export function decrireDuree(jours: number | null): string | null {
  if (jours === null) return null;
  if (jours >= 330) return Math.round(jours / 365) === 1 ? "1 an" : `${Math.round(jours / 365)} ans`;
  if (jours >= 28) return `${Math.round(jours / 30.4)} mois`;
  if (jours % 7 === 0) return jours === 7 ? "1 semaine" : `${jours / 7} semaines`;
  return jours === 1 ? "1 jour" : `${jours} jours`;
}

/** Les durées proposées dans la Base. */
export const DUREES: { libelle: string; jours: number | null }[] = [
  { libelle: "Sans date", jours: null },
  { libelle: "3 jours", jours: 3 },
  { libelle: "1 semaine", jours: 7 },
  { libelle: "2 semaines", jours: 14 },
  { libelle: "1 mois", jours: 30 },
  { libelle: "3 mois", jours: 90 },
  { libelle: "6 mois", jours: 180 },
  { libelle: "1 an", jours: 365 },
];

/** Un produit quitte le stock : fini à temps, ou jeté parce que sa date était passée. */
export function noterFin(h: ProduitHabituel, jete: boolean): ProduitHabituel {
  return jete ? { ...h, jetes: (h.jetes ?? 0) + 1 } : { ...h, finis: (h.finis ?? 0) + 1 };
}

/** Il finit périmé au moins deux fois, et au moins une fois sur deux : mieux vaut en prendre moins. */
export function souventJete(h: ProduitHabituel): boolean {
  const jetes = h.jetes ?? 0;
  return jetes >= 2 && jetes / (jetes + (h.finis ?? 0)) >= 0.5;
}

/** « 3 fois sur 4 » */
export function decrireGaspillage(h: ProduitHabituel): string {
  const jetes = h.jetes ?? 0;
  return `${jetes} fois sur ${jetes + (h.finis ?? 0)}`;
}
