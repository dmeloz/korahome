import { useCallback, useEffect, useState } from "react";
import type { Element, Foyer, Liste, Tache } from "../domaine/types";
import type { Depot } from "../donnees/depot";

export interface Donnees {
  pret: boolean;
  foyer: Foyer | null;
  listes: Liste[];
  elements: Element[];
  taches: Tache[];
}

/** Charge toutes les données et les recharge à chaque changement du dépôt. */
export function useDonnees(depot: Depot): Donnees {
  const [donnees, setDonnees] = useState<Donnees>({ pret: false, foyer: null, listes: [], elements: [], taches: [] });

  const charger = useCallback(async () => {
    const [foyer, listes, elements, taches] = await Promise.all([
      depot.lireFoyer(),
      depot.lireListes(),
      depot.lireElements(),
      depot.lireTaches(),
    ]);
    listes.sort((a, b) => a.creeLe.localeCompare(b.creeLe));
    setDonnees({ pret: true, foyer, listes, elements, taches });
  }, [depot]);

  useEffect(() => {
    void charger();
    return depot.abonner(() => void charger());
  }, [depot, charger]);

  return donnees;
}
