import type { Element, Foyer, Id, Liste, Tache } from "../domaine/types";
import type { Depot } from "./depot";

// Version 2 : ajout des tâches. La mise à jour crée seulement les magasins manquants.
const VERSION = 2;
const MAGASINS = ["foyer", "listes", "elements", "taches"] as const;
type Magasin = (typeof MAGASINS)[number];

function ouvrir(nomBase: string, fabrique: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const req = fabrique.open(nomBase, VERSION);
    req.onupgradeneeded = () => {
      for (const m of MAGASINS) {
        if (!req.result.objectStoreNames.contains(m)) req.result.createObjectStore(m, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resoudre(req.result);
    req.onerror = () => rejeter(req.error);
  });
}

function attendre<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resoudre, rejeter) => {
    req.onsuccess = () => resoudre(req.result);
    req.onerror = () => rejeter(req.error);
  });
}

function terminer(tx: IDBTransaction): Promise<void> {
  return new Promise((resoudre, rejeter) => {
    tx.oncomplete = () => resoudre();
    tx.onerror = () => rejeter(tx.error);
    tx.onabort = () => rejeter(tx.error);
  });
}

/** Dépôt sur l'appareil (IndexedDB). Fonctionne hors ligne, sans compte. */
export function creerDepotLocal(
  nomBase = "korahome",
  fabrique: IDBFactory = indexedDB,
): Depot {
  const base = ouvrir(nomBase, fabrique);
  const abonnes = new Set<() => void>();
  const canal = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`${nomBase}-changements`) : null;
  const prevenir = () => abonnes.forEach((r) => r());
  canal?.addEventListener("message", prevenir);

  async function tous<T>(magasin: Magasin): Promise<T[]> {
    const db = await base;
    return attendre(db.transaction(magasin).objectStore(magasin).getAll()) as Promise<T[]>;
  }

  async function ecrire(magasin: Magasin, action: (s: IDBObjectStore) => void): Promise<void> {
    const db = await base;
    const tx = db.transaction(magasin, "readwrite");
    action(tx.objectStore(magasin));
    await terminer(tx);
    prevenir();
    canal?.postMessage("change");
  }

  return {
    async lireFoyer() {
      return (await tous<Foyer>("foyer"))[0] ?? null;
    },
    enregistrerFoyer: (foyer) => ecrire("foyer", (s) => s.put(foyer)),

    lireListes: () => tous<Liste>("listes"),
    enregistrerListe: (liste) => ecrire("listes", (s) => s.put(liste)),
    async supprimerListe(id: Id) {
      const orphelins = (await tous<Element>("elements")).filter((e) => e.listeId === id).map((e) => e.id);
      const db = await base;
      const tx = db.transaction(["listes", "elements"], "readwrite");
      tx.objectStore("listes").delete(id);
      orphelins.forEach((eid) => tx.objectStore("elements").delete(eid));
      await terminer(tx);
      prevenir();
      canal?.postMessage("change");
    },

    lireElements: () => tous<Element>("elements"),
    enregistrerElement: (element) => ecrire("elements", (s) => s.put(element)),
    supprimerElements: (ids) => ecrire("elements", (s) => ids.forEach((id) => s.delete(id))),

    lireTaches: () => tous<Tache>("taches"),
    enregistrerTache: (tache) => ecrire("taches", (s) => s.put(tache)),
    enregistrerTaches: (taches) => ecrire("taches", (s) => taches.forEach((t) => s.put(t))),
    supprimerTache: (id) => ecrire("taches", (s) => s.delete(id)),

    abonner(rappel) {
      abonnes.add(rappel);
      return () => abonnes.delete(rappel);
    },
  };
}
