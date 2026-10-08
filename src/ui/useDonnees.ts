import { useCallback, useEffect, useState } from "react";
import type { RetourTest } from "../domaine/retours";
import type { Element, Foyer, Liste, Tache } from "../domaine/types";
import type { Depot } from "../donnees/depot";

export interface Donnees {
  pret: boolean;
  foyer: Foyer | null;
  listes: Liste[];
  elements: Element[];
  taches: Tache[];
  retours: RetourTest[];
}

/** Charge toutes les données et les recharge à chaque changement du dépôt. */
export function useDonnees(depot: Depot): Donnees {
  const [donnees, setDonnees] = useState<Donnees>({ pret: false, foyer: null, listes: [], elements: [], taches: [], retours: [] });

  const charger = useCallback(async () => {
    const [foyer, listes, elements, taches, retours] = await Promise.all([
      depot.lireFoyer(),
      depot.lireListes(),
      depot.lireElements(),
      depot.lireTaches(),
      depot.lireRetours(),
    ]);
    listes.sort((a, b) => a.creeLe.localeCompare(b.creeLe));
    setDonnees({ pret: true, foyer, listes, elements, taches, retours });
  }, [depot]);

  useEffect(() => {
    void charger();
    return depot.abonner(() => void charger());
  }, [depot, charger]);

  return donnees;
}
