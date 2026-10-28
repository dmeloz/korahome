import { ilYA } from "./etatPartage";
import type { Element, Foyer, Id } from "./types";

// La corbeille du foyer : ce que l'un des deux efface y reste trente jours, avec qui l'a
// effacé et quand, et se remet d'un toucher. « Annuler » ne dure que six secondes ; la
// corbeille rattrape le reste, comme « Supprimés récemment » dans Notes ou Photos.
// Elle se partage comme le reste : l'autre téléphone y voit la même chose.

export const JOURS_CORBEILLE = 30;

/** Ce qui va à la corbeille quand on l'efface. Les articles d'une liste partent avec elle. */
export type CollectionCorbeille = "listes" | "taches" | "stock" | "jardin" | "memoire" | "couple" | "menus" | "agenda" | "budget" | "vetements" | "maison";
export const COLLECTIONS_CORBEILLE: readonly CollectionCorbeille[] = ["listes", "taches", "stock", "jardin", "memoire", "couple", "menus", "agenda", "budget", "vetements", "maison"];

export interface EntreeCorbeille {
  /** « collection/id du document » : un document effacé deux fois n'y est qu'une fois. */
  id: Id;
  collection: CollectionCorbeille;
  docId: Id;
  /** Le document tel qu'il était. */
  donnees: unknown;
  /** Pour une liste : ses articles, remis avec elle. */
  elements?: Element[];
  effaceLe: string;
  effacePar: Id | null;
}

export const idCorbeille = (collection: CollectionCorbeille, docId: Id): Id => `${collection}/${docId}`;

export const estCollectionCorbeille = (c: string): c is CollectionCorbeille => (COLLECTIONS_CORBEILLE as readonly string[]).includes(c);

/** Un ajout annulé aussitôt (le bandeau « Annuler ») n'encombre pas la corbeille. */
const SECONDES_ANNULATION = 60;

/**
 * Vrai quand ce document mérite la corbeille : pas une humeur ni un clin d'œil, pas un
 * réglage, pas un compte iCloud ni un mois du budget, et pas un ajout annulé dans la minute.
 */
export function meriteLaCorbeille(collection: CollectionCorbeille, doc: unknown, maintenant: string): boolean {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as { type?: string; genre?: string; titre?: unknown; creeLe?: unknown };
  if (typeof d.creeLe === "string" && Date.parse(maintenant) - Date.parse(d.creeLe) < SECONDES_ANNULATION * 1000) return false;
  switch (collection) {
    case "couple":
      return d.type === "mot" || d.type === "compte";
    case "menus":
      return d.type === "recette" || d.type === "menu";
    case "agenda":
      return typeof d.titre === "string";
    case "budget":
      return d.genre === "depense";
    case "vetements":
      return d.type === "envie" || d.type === "tri";
    case "maison":
      return d.type === "appareil" || d.type === "carnet" || d.type === "rangement";
    default:
      return true;
  }
}

export function mettreALaCorbeille(
  collection: CollectionCorbeille,
  doc: { id: Id },
  quand: { maintenant: string; par: Id | null },
  elements?: readonly Element[],
): EntreeCorbeille {
  const entree: EntreeCorbeille = { id: idCorbeille(collection, doc.id), collection, docId: doc.id, donnees: doc, effaceLe: quand.maintenant, effacePar: quand.par };
  if (elements && elements.length > 0) entree.elements = [...elements];
  return entree;
}

/** Les entrées de plus de trente jours, à retirer pour de bon. */
export function aPurger(entrees: readonly EntreeCorbeille[], maintenant: string): EntreeCorbeille[] {
  const limite = Date.parse(maintenant) - JOURS_CORBEILLE * 86_400_000;
  return entrees.filter((e) => Date.parse(e.effaceLe) <= limite);
}

/** Les entrées encore là, la plus récente en premier. */
export function trierCorbeille(entrees: readonly EntreeCorbeille[], maintenant: string): EntreeCorbeille[] {
  const purgees = new Set(aPurger(entrees, maintenant).map((e) => e.id));
  return entrees.filter((e) => !purgees.has(e.id)).sort((a, b) => b.effaceLe.localeCompare(a.effaceLe));
}

/** « Tâches », « Courses »… : l'espace d'où vient le document. */
export function espaceDe(collection: CollectionCorbeille, doc: unknown): string {
  const d = (doc ?? {}) as { type?: string; categorie?: string };
  switch (collection) {
    case "listes":
      return d.type === "courses" ? "Courses" : "Autres listes";
    case "taches":
      return d.categorie === "entretien" ? "Entretien" : d.categorie === "administratif" ? "Administratif" : "Tâches";
    case "stock":
      return "Frigo et placards";
    case "jardin":
      return "Jardin";
    case "memoire":
      return "Mémoire";
    case "couple":
      return "Nos mots";
    case "menus":
      return d.type === "menu" ? "Menus de la semaine" : "Nos recettes";
    case "agenda":
      return "Agenda";
    case "budget":
      return "Budget";
    case "vetements":
      return "Vêtements";
    case "maison":
      return "Entretien";
  }
}

/** Le titre du document, comme il s'affichait. */
export function titreDe(entree: EntreeCorbeille): string {
  // Le document est lu tel qu'il a été rangé : ses champs sont vérifiés un à un.
  const d = (entree.donnees ?? {}) as { nom?: string; titre?: string; texte?: string; type?: string; libelle?: string; lieu?: string; montant?: unknown };
  switch (entree.collection) {
    case "listes":
      return `Liste « ${d.nom ?? "sans nom"} »${entree.elements?.length ? ` (${entree.elements.length} article${entree.elements.length > 1 ? "s" : ""})` : ""}`;
    case "taches":
    case "agenda":
      return d.titre ?? "Sans titre";
    case "stock":
    case "jardin":
      return d.nom ?? "Sans nom";
    case "memoire":
      return d.texte ?? "Souvenir";
    case "couple":
      return d.type === "compte" ? `Compte à rebours « ${d.titre ?? ""} »` : `Mot « ${d.texte ?? ""} »`;
    case "menus":
      return d.type === "menu" ? "Menu de la semaine" : (d.titre ?? "Recette");
    case "vetements":
      return d.titre ?? "Vêtement";
    case "maison":
      return d.type === "carnet" ? `Carnet : ${d.titre ?? ""}` : d.type === "rangement" ? `Rangement : ${d.lieu ?? ""}` : (d.nom ?? "Appareil");
    case "budget":
      return typeof d.montant === "number" ? `${d.libelle ?? "Dépense"} · ${d.montant.toFixed(2)} CHF` : (d.libelle ?? "Dépense");
  }
}

/** « Effacé par Sarah il y a 2 h », ou « Effacé hier » quand on ne sait pas qui. */
export function decrireEffacement(entree: EntreeCorbeille, foyer: Pick<Foyer, "membres">, maintenant: string): string {
  const qui = foyer.membres.find((m) => m.id === entree.effacePar)?.prenom;
  return `Effacé${qui ? ` par ${qui}` : ""} ${ilYA(entree.effaceLe, maintenant)}`;
}

/** Les jours qu'il reste avant que l'entrée parte pour de bon. */
export function joursRestants(entree: EntreeCorbeille, maintenant: string): number {
  return Math.max(0, Math.ceil((Date.parse(entree.effaceLe) + JOURS_CORBEILLE * 86_400_000 - Date.parse(maintenant)) / 86_400_000));
}
