import { useSyncExternalStore } from "react";
import { SORTES_BANDEAU, VITESSES_BANDEAU, type SorteBandeau, type VitesseBandeau } from "../domaine/bandeau";

// Ce que chacun choisit de voir passer dans son bandeau, et à quelle vitesse.
// Propre à ce téléphone (localStorage), jamais synchronisé : chacun règle le sien.

export interface ReglagesBandeau {
  masquees: SorteBandeau[];
  vitesse: VitesseBandeau;
}

const CLE = "korahome.bandeau";
const DEFAUT: ReglagesBandeau = { masquees: [], vitesse: "normale" };
const ecouteurs = new Set<() => void>();
let courant: ReglagesBandeau | null = null;

function lire(): ReglagesBandeau {
  if (courant) return courant;
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? "null") as Partial<ReglagesBandeau> | null;
    const sortes = SORTES_BANDEAU.map((s) => s.sorte);
    courant = {
      masquees: Array.isArray(brut?.masquees) ? brut.masquees.filter((s): s is SorteBandeau => sortes.includes(s)) : [],
      vitesse: brut?.vitesse && brut.vitesse in VITESSES_BANDEAU ? brut.vitesse : DEFAUT.vitesse,
    };
  } catch {
    courant = DEFAUT;
  }
  return courant;
}

export function changerReglagesBandeau(changement: Partial<ReglagesBandeau>): void {
  courant = { ...lire(), ...changement };
  try {
    localStorage.setItem(CLE, JSON.stringify(courant));
  } catch {
    // Stockage indisponible : le réglage vaut jusqu'à la fermeture de l'app.
  }
  ecouteurs.forEach((f) => f());
}

export function useReglagesBandeau(): ReglagesBandeau {
  return useSyncExternalStore(
    (f) => {
      ecouteurs.add(f);
      return () => ecouteurs.delete(f);
    },
    lire,
    lire,
  );
}
