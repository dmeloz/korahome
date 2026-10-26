import { useEffect } from "react";
import { ignorer } from "./journal";

/**
 * Garde l'écran allumé tant que `actif` est vrai (Screen Wake Lock, iOS 18.4 et plus dans l'app
 * installée) : le mode cuisine d'une recette, les courses en magasin. Le verrou tombe quand l'app
 * passe en arrière-plan ; il est redemandé au retour.
 */
export function useEcranAllume(actif: boolean) {
  useEffect(() => {
    if (!actif) return;
    let verrou: WakeLockSentinel | null = null;
    let fini = false;
    const demander = () => {
      navigator.wakeLock
        ?.request("screen")
        .then((v) => {
          if (fini) void v.release();
          else verrou = v;
        })
        .catch(ignorer);
    };
    demander();
    const revenir = () => document.visibilityState === "visible" && demander();
    document.addEventListener("visibilitychange", revenir);
    return () => {
      fini = true;
      document.removeEventListener("visibilitychange", revenir);
      void verrou?.release();
    };
  }, [actif]);
}
