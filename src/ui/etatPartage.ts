import { useEffect, useState, useSyncExternalStore } from "react";
import { decrireEtatPartage, type EtatPartage } from "../domaine/etatPartage";
import type { DepotLocal } from "../donnees/depotLocal";
import type { Synchro } from "../donnees/synchro";

// L'état du partage tenu à jour : la synchro, ce qui attend d'être envoyé, et le réseau.

const sansAbonnement = () => () => {};

export function useEtatPartage(depot: DepotLocal, synchro: Synchro | null): EtatPartage {
  const statut = useSyncExternalStore(synchro?.abonner ?? sansAbonnement, () => synchro?.statut() ?? INACTIF);
  const [enAttente, setEnAttente] = useState(0);
  const [enLigne, setEnLigne] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [maintenant, setMaintenant] = useState(() => new Date().toISOString());

  useEffect(() => {
    const compter = () => void depot.lireEnAttente().then((c) => setEnAttente(c.length), () => {});
    compter();
    const fin = depot.abonner(compter);
    return fin;
  }, [depot, statut]);
  useEffect(() => {
    const changer = () => setEnLigne(navigator.onLine);
    window.addEventListener("online", changer);
    window.addEventListener("offline", changer);
    // « il y a 5 min » avance tout seul.
    const horloge = setInterval(() => setMaintenant(new Date().toISOString()), 60_000);
    return () => {
      window.removeEventListener("online", changer);
      window.removeEventListener("offline", changer);
      clearInterval(horloge);
    };
  }, []);

  return decrireEtatPartage({
    disponible: !!synchro,
    etat: statut.etat,
    enAttente,
    derniere: statut.etat === "inactif" ? null : statut.derniere,
    enLigne,
    maintenant,
  });
}

const INACTIF = { etat: "inactif" } as const;
