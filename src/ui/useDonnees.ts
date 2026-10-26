import { useCallback, useEffect, useRef, useState } from "react";
import { COLLECTIONS, NOMS_COLLECTIONS, type CollectionSynchro } from "../domaine/collections";
import type { ProduitHabituel } from "../domaine/catalogue";
import type { EntreeCorbeille } from "../domaine/corbeille";
import type { Zone } from "../domaine/jardin";
import type { DocCouple } from "../domaine/bandeau";
import type { DocAgenda } from "../domaine/agenda";
import type { DocBudget } from "../domaine/budget";
import type { DocVetement } from "../domaine/vetements";
import type { DocMaison } from "../domaine/maison";
import type { DocChef } from "../domaine/chef";
import type { Souvenir } from "../domaine/memoire";
import type { Animal } from "../domaine/mitsu";
import type { RetourTest } from "../domaine/retours";
import type { Produit } from "../domaine/stock";
import type { Element, Foyer, Liste, Tache } from "../domaine/types";
import type { Changees, Depot } from "../donnees/depot";

export interface Donnees {
  pret: boolean;
  foyer: Foyer | null;
  listes: Liste[];
  elements: Element[];
  taches: Tache[];
  retours: RetourTest[];
  animaux: Animal[];
  produits: Produit[];
  catalogue: ProduitHabituel[];
  zones: Zone[];
  souvenirs: Souvenir[];
  couple: DocCouple[];
  menus: DocChef[];
  agenda: DocAgenda[];
  budget: DocBudget[];
  corbeille: EntreeCorbeille[];
  vetements: DocVetement[];
  maison: DocMaison[];
}

const VIDE: Donnees = { pret: false, foyer: null, listes: [], elements: [], taches: [], retours: [], animaux: [], produits: [], catalogue: [], zones: [], souvenirs: [], couple: [], menus: [], agenda: [], budget: [], corbeille: [], vetements: [], maison: [] };

// Ces collections se montrent dans l'ordre où elles ont été créées.
const PAR_CREATION = new Set<CollectionSynchro>(["listes", "animaux", "jardin"]);

/** Lit une collection et la range sous son nom de lecture (« stock » devient `produits`). */
async function lireCollection(depot: Depot, collection: CollectionSynchro): Promise<Partial<Donnees>> {
  const docs = await depot.lire(collection);
  if (collection === "foyer") return { foyer: (docs as Foyer[])[0] ?? null };
  if (PAR_CREATION.has(collection)) (docs as { creeLe: string }[]).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  const nom = COLLECTIONS.find((c) => c.nom === collection)!.donnees;
  return { [nom]: docs } as Partial<Donnees>;
}

/**
 * Charge toutes les données, puis, à chaque changement du dépôt, ne relit que les collections
 * qui ont changé : les autres gardent le même tableau, et ce qui en dépend ne se recalcule pas.
 */
export function useDonnees(depot: Depot): Donnees {
  const [donnees, setDonnees] = useState<Donnees>(VIDE);
  // Le numéro de la dernière lecture demandée par collection : une lecture plus ancienne qui
  // arrive en retard n'écrase pas une plus récente.
  const derniere = useRef(new Map<CollectionSynchro, number>());

  const charger = useCallback(
    async (changees: Changees) => {
      const aLire = changees ?? NOMS_COLLECTIONS;
      if (aLire.length === 0) return;
      const numeros = aLire.map((c) => {
        const n = (derniere.current.get(c) ?? 0) + 1;
        derniere.current.set(c, n);
        return n;
      });
      const lus = await Promise.all(aLire.map((c) => lireCollection(depot, c)));
      setDonnees((avant) => {
        const apres = { ...avant, pret: avant.pret || changees === null };
        aLire.forEach((c, i) => {
          if (derniere.current.get(c) === numeros[i]) Object.assign(apres, lus[i]);
        });
        return apres;
      });
    },
    [depot],
  );

  useEffect(() => {
    void charger(null);
    return depot.abonner((changees) => void charger(changees));
  }, [depot, charger]);

  return donnees;
}
