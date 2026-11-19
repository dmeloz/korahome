// Le dos des cartes (Kora 0.1.21, axe « cartes qui se retournent ») : ce qu'une carte montre
// quand on la retourne, sans ouvrir sa page. Quatre lignes au plus, pour tenir dans la carte.

import { depenses, formaterMontant, type DocBudget } from "./budget";
import { historiquePesees, formaterPoids, type Animal } from "./mitsu";
import { disponibilite, type Recette } from "./recettes";
import type { Produit } from "./stock";
import type { Id } from "./types";

export interface LigneDos {
  texte: string;
  /** Ce qui s'écrit au bout de la ligne : un montant, un poids, une quantité. */
  fin: string | null;
  /** La ligne dit un manque (un ingrédient qui n'est pas à la maison). */
  manque?: boolean;
}

/** Combien de lignes tient le dos d'une carte. */
export const LIGNES_DOS = 4;

/** Les dernières dépenses de la personne du téléphone, les plus récentes d'abord. */
export function dosAMoi(docs: readonly DocBudget[], moi: Id): LigneDos[] {
  return depenses(docs)
    .filter((d) => d.par === moi)
    .slice(0, LIGNES_DOS)
    .map((d) => ({ texte: d.libelle || d.magasin || "Dépense", fin: formaterMontant(d.montant) }));
}

/** Les ingrédients de la recette du soir : ce qui manque d'abord, puis le reste. */
export function dosRecette(recette: Pick<Recette, "ingredients">, produits: readonly Produit[]): LigneDos[] {
  const manquants = new Set(disponibilite(recette, produits).manquants.map((i) => i.nom));
  const lignes = recette.ingredients.map((i) => ({ texte: i.nom, fin: manquants.has(i.nom) ? "manque" : (i.quantite ?? null), manque: manquants.has(i.nom) }));
  const tries = [...lignes.filter((l) => l.manque), ...lignes.filter((l) => !l.manque)];
  if (tries.length <= LIGNES_DOS) return tries;
  const reste = tries.length - (LIGNES_DOS - 1);
  return [...tries.slice(0, LIGNES_DOS - 1), { texte: `et ${reste} autres`, fin: null }];
}

/** Les dernières pesées de l'animal, la plus récente d'abord. `dire` écrit le jour (« 12 nov. »). */
export function dosAnimal(animal: Animal, dire: (jour: string) => string): LigneDos[] {
  return historiquePesees(animal)
    .slice(0, LIGNES_DOS)
    .map((p) => ({ texte: dire(p.jour), fin: formaterPoids(p.grammes) }));
}
