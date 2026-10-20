// Les recettes du foyer : une base qui se remplit toute seule, comme la Base du frigo.
// Chaque repas du Chef y entre avec ses ingrédients et ses étapes, chaque recette lue par
// Jarvis (un lien, une photo de livre, une dictée) aussi, et on peut en écrire une soi-même.
// Une recette déjà là n'est pas copiée : elle monte dans la liste.
//
// Elle sait ce qu'on a déjà à la maison (le stock), met aux courses seulement ce qui manque,
// recalcule les quantités pour un autre nombre de personnes, et se pose sur un soir de la
// semaine. Une recette faite ne retire rien du stock : on garde la main.
//
// Les recettes vivent dans la collection « menus », à côté des menus du Chef (type « recette »).

import { cleProduit } from "./connaissances";
import { analyserSaisie } from "./listes";
import { detecterRayon, normaliser } from "./rayons";
import type { Produit } from "./stock";
import { ecartJours } from "./taches";
import type { Contexte, Element, Id, Jour, Liste } from "./types";

export interface IngredientRecette {
  /** Le nom court, comme sur une liste : « Lardons fumés ». */
  nom: string;
  /** La quantité pour le nombre de portions de la recette : « 200 g », « 2 », « 1/2 » ; null sans quantité. */
  quantite: string | null;
}

export type SourceRecette = "chef" | "lien" | "photo" | "jarvis" | "main";

export const SOURCES_RECETTE: Record<SourceRecette, string> = {
  chef: "Proposée par le Chef",
  lien: "Lue sur un site",
  photo: "Lue sur une photo",
  jarvis: "Dictée à la fée",
  main: "Écrite à la main",
};

export interface Recette {
  id: Id;
  type: "recette";
  titre: string;
  /** Le titre comparable : une seule recette par titre. */
  cle: string;
  /** Pour combien de personnes sont écrites les quantités. */
  portions: number;
  ingredients: IngredientRecette[];
  etapes: string[];
  source: SourceRecette;
  lien: string | null;
  /** Combien de fois elle a été proposée ou ajoutée : les plus fréquentes montent. */
  vue: number;
  /** Combien de fois le foyer l'a cuisinée, et la dernière fois. */
  fois: number;
  derniereFois: Jour | null;
  /** Le soir où elle est prévue ; null quand elle n'est pas posée sur la semaine. */
  prevuLe: Jour | null;
  creeLe: string;
  modifieLe: string;
}

/** Ce qu'on sait d'une recette avant de la ranger : le Chef, Jarvis ou la saisie à la main. */
export interface BrouillonRecette {
  titre: string;
  portions?: number | null;
  ingredients: IngredientRecette[];
  etapes: string[];
  source: SourceRecette;
  lien?: string | null;
}

export const PORTIONS_PAR_DEFAUT = 2;
export const PORTIONS_MAX = 20;
const INGREDIENTS_MAX = 40;
const ETAPES_MAX = 20;

export const idRecette = (ctx: Contexte): Id => `recette-${ctx.nouvelId()}`;

export function cleRecette(titre: string): string {
  return normaliser(titre)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function estRecette(doc: unknown): doc is Recette {
  return !!doc && typeof doc === "object" && (doc as { type?: unknown }).type === "recette";
}

/** Les recettes parmi les documents de la collection « menus ». */
export function recettesDe(docs: readonly unknown[]): Recette[] {
  return docs.filter(estRecette);
}

const chaine = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const portionsValides = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= PORTIONS_MAX ? Math.round(v) : null);

/** Relit une recette venue du modèle ou d'un formulaire sans lui faire confiance ; null sans titre ni ingrédient. */
export function lireBrouillon(brut: unknown, source: SourceRecette): BrouillonRecette | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const titre = chaine(o.titre, 80);
  const ingredients = (Array.isArray(o.ingredients) ? o.ingredients : [])
    .map((i: unknown) => {
      if (typeof i === "string") return lireLigneIngredient(i);
      const r = (i ?? {}) as Record<string, unknown>;
      const nom = chaine(r.nom, 60);
      return nom ? { nom: majuscule(nom), quantite: chaine(r.quantite, 24) || null } : null;
    })
    .filter((i): i is IngredientRecette => !!i)
    .slice(0, INGREDIENTS_MAX);
  if (!titre || !ingredients.length) return null;
  const etapes = (Array.isArray(o.etapes) ? o.etapes : []).map((e: unknown) => chaine(e, 400)).filter(Boolean).slice(0, ETAPES_MAX);
  const lien = chaine(o.lien, 500);
  return { titre: majuscule(titre), portions: portionsValides(o.portions), ingredients, etapes, source, lien: lien.startsWith("https://") ? lien : null };
}

function majuscule(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
const NOMBRE = String.raw`(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔])`;
const UNITES_RECETTE = String.raw`(?:\s*(?:kg|g|mg|l|dl|cl|ml|c\.?\s*à\s*(?:soupe|café|s\.|c\.)|cs|cc|càs|càc|cuillères?\s+à\s+(?:soupe|café)|tasses?|verres?|pincées?|gousses?|tranches?|branches?|bottes?|brins?|feuilles?|boîtes?|sachets?|paquets?|pots?|morceaux?|filets?|pièces?|pc)\b\.?)?`;
const LIGNE_DEBUT = new RegExp(`^(${NOMBRE}${UNITES_RECETTE})\\s+(?:de\\s+|d['’]\\s*)?(.+)$`, "i");

/** Une ligne écrite à la main : « 200 g de lardons », « 1/2 citron », « sel ». */
export function lireLigneIngredient(ligne: string): IngredientRecette | null {
  const s = ligne.trim().replace(/^[-•*·]\s*/, "").replace(/\s+/g, " ");
  if (!s) return null;
  const m = s.match(LIGNE_DEBUT);
  if (m) return { nom: majuscule(m[3].trim()).slice(0, 60), quantite: m[1].replace(/\s+/g, " ").trim() };
  const { texte, quantite } = analyserSaisie(s);
  return { nom: texte.slice(0, 60), quantite };
}

/** Une ligne d'ingrédient pour l'affichage et le formulaire : « 200 g lardons ». */
export function ecrireIngredient(i: IngredientRecette): string {
  return i.quantite ? `${i.quantite} ${i.nom.charAt(0).toLowerCase()}${i.nom.slice(1)}` : i.nom;
}

function lireNombre(t: string): number | null {
  const s = t.replace(/\s+/g, "");
  if (s in FRACTIONS) return FRACTIONS[s];
  const fraction = s.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[2]) ? Number(fraction[1]) / Number(fraction[2]) : null;
  const mixte = s.match(/^(\d+(?:[.,]\d+)?)([½¼¾⅓⅔])$/);
  if (mixte) return Number(mixte[1].replace(",", ".")) + FRACTIONS[mixte[2]];
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function ecrireNombre(n: number): string {
  if (n >= 100) return String(Math.round(n / 5) * 5);
  if (n >= 10) return String(Math.round(n));
  const arrondi = Math.max(0.5, Math.round(n * 2) / 2);
  return arrondi === 0.5 ? "½" : String(arrondi).replace(".5", "½");
}

/** La quantité pour un autre nombre de personnes : « 200 g » pour 2 → « 600 g » pour 6. */
export function ajusterQuantite(quantite: string | null, de: number, a: number): string | null {
  if (!quantite || de === a || de <= 0) return quantite;
  const m = quantite.match(new RegExp(`^${NOMBRE}(.*)$`));
  if (!m) return quantite;
  const nombre = m[1].trimEnd();
  const n = lireNombre(nombre);
  if (n === null) return quantite;
  const valeur = (n * a) / de;
  let reste = quantite.slice(nombre.length);
  // 1600 g se lit mieux en kilos ; « 2 gousse » prend son pluriel.
  if (/^\s*g$/.test(reste) && valeur >= 1000) return `${String(Math.round(valeur / 100) / 10).replace(".", ",")} kg`;
  if (valeur > 1) reste = reste.replace(/^(\s+)(gousse|tranche|branche|botte|brin|feuille|boîte|sachet|paquet|pot|filet|pincée|tasse|verre|pièce)\b(?!s)/i, "$1$2s");
  return `${ecrireNombre(valeur)}${reste}`;
}

export function ingredientsPour(recette: Pick<Recette, "ingredients" | "portions">, portions: number): IngredientRecette[] {
  return recette.ingredients.map((i) => ({ ...i, quantite: ajusterQuantite(i.quantite, recette.portions, portions) }));
}

// ----- La base se remplit -----

export function nouvelleRecette(b: BrouillonRecette, ctx: Contexte): Recette {
  const maintenant = ctx.maintenant();
  return {
    id: idRecette(ctx),
    type: "recette",
    titre: b.titre,
    cle: cleRecette(b.titre),
    portions: portionsValides(b.portions) ?? PORTIONS_PAR_DEFAUT,
    ingredients: b.ingredients,
    etapes: b.etapes,
    source: b.source,
    lien: b.lien ?? null,
    vue: 1,
    fois: 0,
    derniereFois: null,
    prevuLe: null,
    creeLe: maintenant,
    modifieLe: maintenant,
  };
}

export function trouverRecette(recettes: readonly Recette[], titre: string): Recette | null {
  const cle = cleRecette(titre);
  if (!cle) return null;
  return recettes.find((r) => r.cle === cle) ?? recettes.find((r) => r.cle.includes(cle) || cle.includes(r.cle)) ?? null;
}

/**
 * Une recette arrive (le Chef, Jarvis) : nouvelle, elle entre dans la base ; déjà là sous
 * le même titre, elle n'est pas copiée, elle monte (vue + 1) et ne reprend que ce qui lui
 * manquait (étapes, lien). Ce que le foyer a écrit n'est jamais écrasé.
 */
export function apprendreRecette(recettes: readonly Recette[], b: BrouillonRecette, ctx: Contexte): { recette: Recette; avant: Recette | null } {
  const cle = cleRecette(b.titre);
  const avant = recettes.find((r) => r.cle === cle) ?? null;
  if (!avant) return { recette: nouvelleRecette(b, ctx), avant: null };
  return {
    avant,
    recette: {
      ...avant,
      ingredients: avant.ingredients.length ? avant.ingredients : b.ingredients,
      etapes: avant.etapes.length ? avant.etapes : b.etapes,
      lien: avant.lien ?? b.lien ?? null,
      vue: avant.vue + 1,
      modifieLe: ctx.maintenant(),
    },
  };
}

/** La recette modifiée à la main (titre, portions, ingrédients, étapes). */
export function modifierRecette(recette: Recette, b: Omit<BrouillonRecette, "source">, ctx: Contexte): Recette {
  return {
    ...recette,
    titre: b.titre,
    cle: cleRecette(b.titre),
    portions: portionsValides(b.portions) ?? recette.portions,
    ingredients: b.ingredients,
    etapes: b.etapes,
    lien: b.lien === undefined ? recette.lien : b.lien,
    modifieLe: ctx.maintenant(),
  };
}

/** « On l'a fait » : compté, et retiré du soir où elle était prévue s'il est passé. Le stock ne bouge pas. */
export function marquerCuisinee(recette: Recette, jour: Jour, ctx: Contexte): Recette {
  const prevuLe = recette.prevuLe && recette.prevuLe <= jour ? null : recette.prevuLe;
  return { ...recette, fois: recette.fois + 1, derniereFois: jour, prevuLe, modifieLe: ctx.maintenant() };
}

export function prevoirRecette(recette: Recette, jour: Jour | null, ctx: Contexte): Recette {
  return { ...recette, prevuLe: jour, modifieLe: ctx.maintenant() };
}

// ----- Ce qu'on a à la maison -----

const DE_BASE = [
  "sel",
  "poivre",
  "sel et poivre",
  "fleur de sel",
  "poivre noir",
  "huile",
  "huile d'olive",
  "huile de tournesol",
  "huile neutre",
  "eau",
  "eau chaude",
  "eau froide",
  "epice",
  "noix de muscade",
  "muscade",
  "paprika",
  "cumin",
  "curry",
  "herbe de provence",
  "thym",
  "laurier",
].map(cleProduit);

/** Le sel, le poivre, l'huile, l'eau et les épices : supposés à la maison, jamais mis aux courses. */
export function estDeBase(nom: string): boolean {
  const cle = cleProduit(nom);
  return DE_BASE.includes(cle) || /^(huile|sel|poivre|epice)\b/.test(cle);
}

const contient = (grand: string, petit: string) => ` ${grand} `.includes(` ${petit} `);

/** Le produit du stock qui correspond à un ingrédient : « Crème entière » trouve « Crème ». */
export function produitPour(nom: string, produits: readonly Produit[]): Produit | null {
  const ik = cleProduit(nom);
  if (!ik) return null;
  let proche: Produit | null = null;
  for (const p of produits) {
    const pk = cleProduit(p.nom);
    if (!pk) continue;
    if (pk === ik) return p;
    if (!proche && (contient(ik, pk) || contient(pk, ik))) proche = p;
  }
  return proche;
}

export interface Disponibilite {
  /** Les ingrédients comptés (sans le sel, l'huile, les épices). */
  total: number;
  aLaMaison: number;
  manquants: IngredientRecette[];
}

export function disponibilite(recette: Pick<Recette, "ingredients">, produits: readonly Produit[]): Disponibilite {
  const comptes = recette.ingredients.filter((i) => !estDeBase(i.nom));
  const manquants = comptes.filter((i) => !produitPour(i.nom, produits));
  return { total: comptes.length, aLaMaison: comptes.length - manquants.length, manquants };
}

/** « 5 sur 7 à la maison », « Tout est à la maison ». */
export function decrireDisponibilite(d: Disponibilite): string {
  if (!d.total) return "Rien à acheter";
  if (d.aLaMaison === d.total) return "Tout est à la maison";
  return `${d.aLaMaison} sur ${d.total} à la maison`;
}

/**
 * Les articles à mettre aux courses pour cette recette et ce nombre de personnes : ce qui
 * manque au stock et n'est pas déjà sur la liste (non coché). Rien pour le sel ou l'huile.
 */
export function preparerCourses(
  recette: Recette,
  portions: number,
  produits: readonly Produit[],
  liste: Liste,
  elements: readonly Element[],
  membreId: Id | null,
  ctx: Contexte,
): Element[] {
  const sur = elements.filter((e) => e.listeId === liste.id && !e.coche).map((e) => cleProduit(e.texte));
  const ajouts: Element[] = [];
  for (const i of ingredientsPour(recette, portions)) {
    if (estDeBase(i.nom) || produitPour(i.nom, produits)) continue;
    const cle = cleProduit(i.nom);
    if (!cle || sur.some((s) => s === cle || contient(s, cle) || contient(cle, s))) continue;
    sur.push(cle);
    ajouts.push({
      id: ctx.nouvelId(),
      listeId: liste.id,
      texte: i.nom,
      quantite: i.quantite,
      rayon: detecterRayon(i.nom),
      coche: false,
      ajoutePar: membreId,
      creeLe: ctx.maintenant(),
      cocheLe: null,
    });
  }
  return ajouts;
}

// ----- Ranger et choisir -----

export type FiltreRecettes = "toutes" | "ce-soir" | "aimees";

/**
 * L'ordre de la base : « Ce soir avec ce qu'on a » met devant celles qu'on peut faire sans
 * courses ; sinon les recettes aimées et souvent faites montent, puis les plus proposées.
 */
export function ordonnerRecettes(
  recettes: readonly Recette[],
  produits: readonly Produit[],
  filtre: FiltreRecettes,
  aime: (r: Recette) => boolean,
  pasPourNous: (r: Recette) => boolean = () => false,
): Recette[] {
  const dispo = new Map(recettes.map((r) => [r.id, disponibilite(r, produits)]));
  const manque = (r: Recette) => dispo.get(r.id)!.manquants.length;
  const habitude = (a: Recette, b: Recette) =>
    Number(aime(b)) - Number(aime(a)) || b.fois - a.fois || b.vue - a.vue || b.modifieLe.localeCompare(a.modifieLe) || a.titre.localeCompare(b.titre, "fr");
  let choix = recettes.filter((r) => filtre !== "aimees" || aime(r));
  if (filtre === "ce-soir") choix = choix.filter((r) => !pasPourNous(r) && manque(r) <= 2);
  return [...choix].sort((a, b) => (filtre === "ce-soir" ? manque(a) - manque(b) : 0) || Number(pasPourNous(a)) - Number(pasPourNous(b)) || habitude(a, b));
}

/** Les soirs des sept prochains jours qui ont une recette prévue, dans l'ordre. */
export function soirsPrevus(recettes: readonly Recette[], aujourdhui: Jour): { jour: Jour; recette: Recette }[] {
  return recettes
    .filter((r) => r.prevuLe && ecartJours(aujourdhui, r.prevuLe) >= 0 && ecartJours(aujourdhui, r.prevuLe) < 7)
    .map((r) => ({ jour: r.prevuLe!, recette: r }))
    .sort((a, b) => a.jour.localeCompare(b.jour) || a.recette.titre.localeCompare(b.recette.titre, "fr"));
}

/** La recette prévue ce soir, s'il y en a une. */
export function recetteDuSoir(recettes: readonly Recette[], aujourdhui: Jour): Recette | null {
  return recettes.find((r) => r.prevuLe === aujourdhui) ?? null;
}

/** Les sept prochains jours, pour poser une recette sur un soir. */
export function septProchainsJours(aujourdhui: Jour): Jour[] {
  const [a, m, j] = aujourdhui.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(a, m - 1, j + i)).toISOString().slice(0, 10));
}

// ----- Ce que Jarvis et le Chef en lisent -----

export const RECETTES_POUR_JARVIS = 30;

/** Les recettes du foyer, en lignes courtes, celles qu'on peut faire avec le stock d'abord. */
export function decrireRecettes(
  recettes: readonly Recette[],
  produits: readonly Produit[],
  aujourdhui: Jour,
  avis: (r: Recette) => "aime" | "non" | null,
): string[] {
  if (!recettes.length) return ["Recettes du foyer : aucune pour l'instant."];
  const lignes = [`Recettes du foyer (${recettes.length}), celles qu'on peut faire avec le stock d'abord :`];
  const ordre = ordonnerRecettes(recettes, produits, "toutes", (r) => avis(r) === "aime", (r) => avis(r) === "non").sort(
    (a, b) => disponibilite(a, produits).manquants.length - disponibilite(b, produits).manquants.length,
  );
  for (const r of ordre.slice(0, RECETTES_POUR_JARVIS)) {
    const d = disponibilite(r, produits);
    const manque = d.manquants.length ? `, manque ${d.manquants.map((i) => i.nom.toLowerCase()).slice(0, 5).join(", ")}` : "";
    const a = avis(r);
    const extra = [a === "aime" ? "aimée" : a === "non" ? "pas pour eux" : "", r.fois ? `faite ${r.fois} fois` : ""].filter(Boolean).join(", ");
    lignes.push(`- ${r.titre} : ${decrireDisponibilite(d).toLowerCase()}${manque}${extra ? ` (${extra})` : ""}`);
  }
  const prevus = soirsPrevus(recettes, aujourdhui);
  if (prevus.length) lignes.push(`Recettes prévues : ${prevus.map((p) => `${p.jour} ${p.recette.titre}`).join(", ")}.`);
  return lignes;
}

/** Les recettes que le Chef peut reprendre : celles que le foyer aime, puis les plus faites. */
export function recettesPourLeChef(recettes: readonly Recette[], aime: (r: Recette) => boolean, refuse: (r: Recette) => boolean, max = 15): string[] {
  return recettes
    .filter((r) => !refuse(r) && (aime(r) || r.fois > 0))
    .sort((a, b) => Number(aime(b)) - Number(aime(a)) || b.fois - a.fois || b.vue - a.vue)
    .slice(0, max)
    .map((r) => r.titre);
}
