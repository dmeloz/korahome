import { useCallback, useEffect, useRef, useState } from "react";
import type { Animal } from "../domaine/mitsu";
import type { RetourTest } from "../domaine/retours";
import type { Element, Foyer, Liste, Tache } from "../domaine/types";
import type { Depot } from "../donnees/depot";
import { changerContenu } from "./mouvement";

export interface Donnees {
  pret: boolean;
  foyer: Foyer | null;
  listes: Liste[];
  elements: Element[];
  taches: Tache[];
  retours: RetourTest[];
  animaux: Animal[];
}

/** Charge toutes les données et les recharge à chaque changement du dépôt. */
export function useDonnees(depot: Depot): Donnees {
  const [donnees, setDonnees] = useState<Donnees>({ pret: false, foyer: null, listes: [], elements: [], taches: [], retours: [], animaux: [] });
  const charge = useRef(false);

  const charger = useCallback(async () => {
    const [foyer, listes, elements, taches, retours, animaux] = await Promise.all([
      depot.lireFoyer(),
      depot.lireListes(),
      depot.lireElements(),
      depot.lireTaches(),
      depot.lireRetours(),
      depot.lireAnimaux(),
    ]);
    listes.sort((a, b) => a.creeLe.localeCompare(b.creeLe));
    animaux.sort((a, b) => a.creeLe.localeCompare(b.creeLe));
    const suivantes = { pret: true, foyer, listes, elements, taches, retours, animaux };
    // Le premier chargement s'affiche tout de suite ; ensuite, chaque changement
    // (ici ou depuis l'autre iPhone) anime les listes vers leur nouvel état.
    if (charge.current) changerContenu(() => setDonnees(suivantes));
    else setDonnees(suivantes);
    charge.current = true;
  }, [depot]);

  useEffect(() => {
    void charger();
    return depot.abonner(() => void charger());
  }, [depot, charger]);

  return donnees;
}
