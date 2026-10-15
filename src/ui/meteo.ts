import { useEffect, useState } from "react";
import { adresseMeteo, lireMeteo, type Meteo } from "../domaine/meteo";

// La météo du jardin, lue chez Open-Meteo par le téléphone et gardée quelques heures :
// hors ligne, la dernière lue sert encore (le domaine ne s'y fie plus après 12 heures).

const CLE = "korahome.meteo";
/** Relue au plus toutes les 3 heures. */
const DUREE_MS = 3 * 3600_000;

function lireCache(): Meteo | null {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? "null") as Meteo | null;
    return brut && Array.isArray(brut.jours) && typeof brut.lue === "string" ? brut : null;
  } catch {
    return null;
  }
}

function ecrireCache(meteo: Meteo): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(meteo));
  } catch {
    // Stockage indisponible : on la relira la prochaine fois.
  }
}

export async function chargerMeteo(): Promise<Meteo | null> {
  const reponse = await fetch(adresseMeteo());
  if (!reponse.ok) return null;
  return lireMeteo(await reponse.json(), new Date().toISOString());
}

/** La météo du jardin, seulement quand le foyer a un jardin ; relue au retour dans l'app. */
export function useMeteo(actif: boolean): Meteo | null {
  const [meteo, setMeteo] = useState<Meteo | null>(lireCache);

  useEffect(() => {
    if (!actif) return;
    let annule = false;
    const rafraichir = () => {
      const actuelle = lireCache();
      if (document.visibilityState !== "visible") return;
      if (actuelle && Date.now() - Date.parse(actuelle.lue) < DUREE_MS) return;
      chargerMeteo()
        .then((m) => {
          if (!m || annule) return;
          ecrireCache(m);
          setMeteo(m);
        })
        .catch(() => {});
    };
    rafraichir();
    document.addEventListener("visibilitychange", rafraichir);
    return () => {
      annule = true;
      document.removeEventListener("visibilitychange", rafraichir);
    };
  }, [actif]);

  return meteo;
}
