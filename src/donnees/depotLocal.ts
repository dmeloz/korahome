import type { ProduitHabituel } from "../domaine/catalogue";
import { estCollectionCorbeille, meriteLaCorbeille, mettreALaCorbeille, type EntreeCorbeille } from "../domaine/corbeille";
import type { Zone } from "../domaine/jardin";
import type { DocCouple } from "../domaine/bandeau";
import type { DocAgenda } from "../domaine/agenda";
import type { DocBudget } from "../domaine/budget";
import type { DocVetement } from "../domaine/vetements";
import type { DocChef } from "../domaine/chef";
import type { Souvenir } from "../domaine/memoire";
import type { Animal } from "../domaine/mitsu";
import type { Produit } from "../domaine/stock";
import type { RetourTest } from "../domaine/retours";
import { cleDe, COLLECTIONS_SYNCHRO, distantGagne, type Changement, type CollectionSynchro } from "../domaine/synchro";
import type { Element, Foyer, Id, Liste, Tache } from "../domaine/types";
import type { Depot } from "./depot";

// Version 2 : ajout des tâches. Version 3 : notes de test. Version 4 : suivi de Mitsu.
// Version 5 : partage (modifications en attente d'envoi, état de la synchro).
// Version 6 : les notes de test se partagent aussi ; celles déjà écrites partent au prochain envoi.
// Version 7 : frigo, congélateur et placard ; tout est relu du serveur une fois, pour
// retrouver le stock déjà partagé par l'autre téléphone.
// Version 8 : la Base des produits habituels ; relecture du serveur une fois, pour la même raison.
// Version 9 : le jardin ; relecture du serveur une fois, pour la même raison.
// Version 10 : la mémoire de Jarvis et le bandeau du couple ; relecture du serveur une fois, pour la même raison.
// Version 11 : les menus du Chef de la semaine ; relecture du serveur une fois, pour la même raison.
// Version 12 : l'agenda commun ; relecture du serveur une fois, pour la même raison.
// Version 13 : le budget du foyer ; relecture du serveur une fois, pour la même raison.
// Version 14 : la corbeille du foyer ; relecture du serveur une fois, pour la même raison.
// Version 15 : les vêtements ; relecture du serveur une fois, pour la même raison.
// La mise à jour crée seulement les magasins manquants.
const VERSION = 15;
const MAGASINS = ["foyer", "listes", "elements", "taches", "retours", "animaux", "stock", "catalogue", "jardin", "memoire", "couple", "menus", "agenda", "budget", "corbeille", "vetements", "attente", "synchro"] as const;
type Magasin = (typeof MAGASINS)[number];
const CLES: Partial<Record<Magasin, string>> = { attente: "cle" };

/** Où en est le partage sur ce téléphone. */
export interface EtatSynchro {
  /** Le foyer partagé auquel ce téléphone est relié. */
  foyerId: Id;
  /** Jusqu'où les modifications du serveur ont été lues (heure du serveur). */
  curseur: string | null;
  /** Dernière synchronisation réussie (heure du téléphone). */
  derniere: string | null;
}

/** Ce dont la synchronisation a besoin du stockage local, en plus du dépôt. */
export interface StockageSynchro {
  /** Les modifications faites ici et pas encore envoyées, une par document. */
  lireEnAttente(): Promise<Changement[]>;
  /** Retire ce qui est parti, sauf si le document a été modifié de nouveau entre-temps. */
  retirerEnAttente(envoyes: readonly Changement[]): Promise<void>;
  /** Applique les modifications de l'autre téléphone, sans écraser une modification locale plus récente. */
  appliquer(distants: readonly Changement[]): Promise<void>;
  /** Rejoindre un foyer : les données partagées remplacent celles de ce téléphone. */
  remplacerTout(distants: readonly Changement[]): Promise<void>;
  /** Partager ce foyer : tout ce qui existe ici part au prochain envoi. */
  toutMettreEnAttente(): Promise<void>;
  lireEtat(): Promise<EtatSynchro | null>;
  enregistrerEtat(etat: EtatSynchro | null): Promise<void>;
}

export type DepotLocal = Depot & StockageSynchro;

interface EnAttente extends Changement {
  cle: string;
}

/** Une écriture : le document à poser, ou null pour le supprimer. */
interface Operation {
  magasin: Magasin;
  id: Id;
  doc: { id: Id } | null;
  /** Pour un article supprimé avec sa liste : l'article lui-même, qui suit la liste à la corbeille. */
  articleDe?: Element;
}

const estPartage = (m: Magasin): m is CollectionSynchro => (COLLECTIONS_SYNCHRO as readonly string[]).includes(m);

function ouvrir(nomBase: string, fabrique: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const req = fabrique.open(nomBase, VERSION);
    req.onupgradeneeded = (evenement) => {
      const avant = req.result.objectStoreNames;
      const avecNotes = avant.contains("retours") && avant.contains("attente");
      for (const m of MAGASINS) {
        if (!avant.contains(m)) req.result.createObjectStore(m, { keyPath: CLES[m] ?? "id" });
      }
      if (evenement.oldVersion < 6 && avecNotes) {
        const tx = req.transaction!;
        const maj = new Date().toISOString();
        puis(tx.objectStore("retours").getAll() as IDBRequest<{ id: Id }[]>, (notes) => {
          for (const doc of notes) {
            const enAttente: EnAttente = { cle: cleDe({ collection: "retours", id: doc.id }), collection: "retours", id: doc.id, donnees: doc, maj };
            tx.objectStore("attente").put(enAttente);
          }
        });
      }
      if (evenement.oldVersion < 15 && avant.contains("synchro")) {
        const synchro = req.transaction!.objectStore("synchro");
        puis(synchro.get("etat") as IDBRequest<{ curseur: string | null } | undefined>, (etat) => {
          if (etat) synchro.put({ ...etat, curseur: null });
        });
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

/** Lit dans une transaction ouverte, sans la laisser se refermer entre la lecture et l'écriture. */
function puis<T>(req: IDBRequest<T>, suite: (resultat: T) => void): void {
  req.onsuccess = () => suite(req.result);
}

function terminer(tx: IDBTransaction): Promise<void> {
  return new Promise((resoudre, rejeter) => {
    tx.oncomplete = () => resoudre();
    tx.onerror = () => rejeter(tx.error);
    tx.onabort = () => rejeter(tx.error);
  });
}

/**
 * Dépôt sur l'appareil (IndexedDB). Fonctionne hors ligne, sans compte. Chaque
 * modification d'une donnée partagée est aussi notée « en attente » pour la synchro.
 */
export function creerDepotLocal(
  nomBase = "korahome",
  fabrique: IDBFactory = indexedDB,
  horloge: () => string = () => new Date().toISOString(),
  /** Qui utilise ce téléphone : noté sur ce qui part à la corbeille. */
  auteur: () => Id | null = () => null,
): DepotLocal {
  const base = ouvrir(nomBase, fabrique);
  const abonnes = new Set<() => void>();
  const canal = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`${nomBase}-changements`) : null;
  const prevenir = () => abonnes.forEach((r) => r());
  canal?.addEventListener("message", prevenir);
  const signaler = () => {
    prevenir();
    canal?.postMessage("change");
  };

  async function tous<T>(magasin: Magasin): Promise<T[]> {
    const db = await base;
    return attendre(db.transaction(magasin).objectStore(magasin).getAll()) as Promise<T[]>;
  }

  /**
   * Pose ou supprime des documents ; ceux qui se partagent partent aussi en attente.
   * Un document effacé qui le mérite va d'abord à la corbeille, avec les articles d'une liste.
   */
  async function modifier(operations: readonly Operation[]): Promise<void> {
    const magasins = new Set<Magasin>(operations.map((o) => o.magasin));
    if (operations.some((o) => estPartage(o.magasin))) magasins.add("attente");
    if (operations.some((o) => !o.doc && estCollectionCorbeille(o.magasin))) magasins.add("corbeille");
    if (magasins.size === 0) return signaler();
    const db = await base;
    const tx = db.transaction([...magasins], "readwrite");
    const maj = horloge();
    const par = auteur();
    const enAttente = (collection: CollectionSynchro, id: Id, donnees: unknown) => {
      const c: EnAttente = { cle: cleDe({ collection, id }), collection, id, donnees, maj };
      tx.objectStore("attente").put(c);
    };
    // Les articles d'une liste effacée sont supprimés dans la même passe : on les garde pour la corbeille.
    const articlesEffaces = operations.filter((o) => o.magasin === "elements" && !o.doc && o.articleDe).map((o) => o.articleDe!);
    for (const { magasin, id, doc } of operations) {
      if (doc) tx.objectStore(magasin).put(doc);
      else {
        if (estCollectionCorbeille(magasin)) {
          puis(tx.objectStore(magasin).get(id) as IDBRequest<{ id: Id } | undefined>, (ancien) => {
            if (!ancien || !meriteLaCorbeille(magasin, ancien, maj)) return;
            const articles = magasin === "listes" ? articlesEffaces.filter((e) => e.listeId === id) : undefined;
            const entree = mettreALaCorbeille(magasin, ancien, { maintenant: maj, par }, articles);
            tx.objectStore("corbeille").put(entree);
            enAttente("corbeille", entree.id, entree);
          });
        }
        tx.objectStore(magasin).delete(id);
      }
      if (estPartage(magasin)) enAttente(magasin, id, doc);
    }
    await terminer(tx);
    signaler();
  }

  const poser = (magasin: Magasin, docs: readonly { id: Id }[]) => modifier(docs.map((doc) => ({ magasin, id: doc.id, doc })));
  const supprimer = (magasin: Magasin, ids: readonly Id[]) => modifier(ids.map((id) => ({ magasin, id, doc: null })));
  const sansCle = ({ collection, id, donnees, maj }: EnAttente): Changement => ({ collection, id, donnees, maj });

  return {
    async lireFoyer() {
      return (await tous<Foyer>("foyer"))[0] ?? null;
    },
    enregistrerFoyer: (foyer) => poser("foyer", [foyer]),

    lireListes: () => tous<Liste>("listes"),
    enregistrerListe: (liste) => poser("listes", [liste]),
    async supprimerListe(id: Id) {
      const orphelins = (await tous<Element>("elements")).filter((e) => e.listeId === id);
      await modifier([
        { magasin: "listes", id, doc: null },
        ...orphelins.map((e): Operation => ({ magasin: "elements", id: e.id, doc: null, articleDe: e })),
      ]);
    },

    lireElements: () => tous<Element>("elements"),
    enregistrerElement: (element) => poser("elements", [element]),
    supprimerElements: (ids) => supprimer("elements", ids),

    lireTaches: () => tous<Tache>("taches"),
    enregistrerTache: (tache) => poser("taches", [tache]),
    enregistrerTaches: (taches) => poser("taches", taches),
    supprimerTache: (id) => supprimer("taches", [id]),

    lireAnimaux: () => tous<Animal>("animaux"),
    enregistrerAnimal: (animal) => poser("animaux", [animal]),

    lireProduits: () => tous<Produit>("stock"),
    enregistrerProduit: (produit) => poser("stock", [produit]),
    supprimerProduit: (id) => supprimer("stock", [id]),

    lireCatalogue: () => tous<ProduitHabituel>("catalogue"),
    enregistrerHabituel: (habituel) => poser("catalogue", [habituel]),
    supprimerHabituel: (id) => supprimer("catalogue", [id]),

    lireZones: () => tous<Zone>("jardin"),
    enregistrerZone: (zone) => poser("jardin", [zone]),
    supprimerZone: (id) => supprimer("jardin", [id]),

    lireMemoire: () => tous<Souvenir>("memoire"),
    enregistrerSouvenir: (souvenir) => poser("memoire", [souvenir]),
    supprimerSouvenir: (id) => supprimer("memoire", [id]),

    lireCouple: () => tous<DocCouple>("couple"),
    enregistrerCouple: (doc) => poser("couple", [doc]),
    supprimerCouple: (id) => supprimer("couple", [id]),

    lireMenus: () => tous<DocChef>("menus"),
    enregistrerMenu: (doc) => poser("menus", [doc]),
    supprimerMenu: (id) => supprimer("menus", [id]),

    lireAgenda: () => tous<DocAgenda>("agenda"),
    enregistrerAgenda: (doc) => poser("agenda", [doc]),
    supprimerAgenda: (id) => supprimer("agenda", [id]),

    lireBudget: () => tous<DocBudget>("budget"),
    enregistrerBudget: (doc) => poser("budget", [doc]),
    supprimerBudget: (id) => supprimer("budget", [id]),

    lireVetements: () => tous<DocVetement>("vetements"),
    enregistrerVetement: (doc) => poser("vetements", [doc]),
    supprimerVetement: (id) => supprimer("vetements", [id]),

    lireRetours: () => tous<RetourTest>("retours"),
    enregistrerRetour: (retour) => poser("retours", [retour]),
    supprimerRetour: (id) => supprimer("retours", [id]),

    lireCorbeille: () => tous<EntreeCorbeille>("corbeille"),
    remettre: (entree) =>
      modifier([
        { magasin: entree.collection, id: entree.docId, doc: entree.donnees as { id: Id } },
        ...(entree.elements ?? []).map((e): Operation => ({ magasin: "elements", id: e.id, doc: e })),
        { magasin: "corbeille", id: entree.id, doc: null },
      ]),
    viderCorbeille: (ids) => supprimer("corbeille", ids),

    abonner(rappel) {
      abonnes.add(rappel);
      return () => abonnes.delete(rappel);
    },

    async lireEnAttente() {
      return (await tous<EnAttente>("attente")).map(sansCle);
    },

    async retirerEnAttente(envoyes) {
      const db = await base;
      const tx = db.transaction("attente", "readwrite");
      const attente = tx.objectStore("attente");
      for (const c of envoyes) {
        puis(attente.get(cleDe(c)) as IDBRequest<EnAttente | undefined>, (actuel) => {
          if (actuel && actuel.maj === c.maj) attente.delete(cleDe(c));
        });
      }
      await terminer(tx);
    },

    async appliquer(distants) {
      if (distants.length === 0) return;
      const db = await base;
      const tx = db.transaction([...COLLECTIONS_SYNCHRO, "attente"], "readwrite");
      const attente = tx.objectStore("attente");
      for (const d of distants) {
        // La vérification se fait dans la même transaction qu'une écriture locale :
        // une modification faite ici pendant la synchro n'est jamais écrasée.
        puis(attente.get(cleDe(d)) as IDBRequest<EnAttente | undefined>, (local) => {
          if (!distantGagne(local, d)) return;
          if (local) attente.delete(cleDe(d));
          if (d.donnees === null) tx.objectStore(d.collection).delete(d.id);
          else tx.objectStore(d.collection).put(d.donnees);
        });
      }
      await terminer(tx);
      signaler();
    },

    async remplacerTout(distants) {
      // Les notes de test de ce téléphone restent et rejoignent celles du foyer.
      const notesEnAttente = (await tous<EnAttente>("attente")).filter((c) => c.collection === "retours");
      const db = await base;
      const tx = db.transaction([...COLLECTIONS_SYNCHRO, "attente"], "readwrite");
      for (const m of [...COLLECTIONS_SYNCHRO, "attente"] as const) if (m !== "retours") tx.objectStore(m).clear();
      for (const c of notesEnAttente) tx.objectStore("attente").put(c);
      for (const d of distants) if (d.donnees !== null) tx.objectStore(d.collection).put(d.donnees);
      await terminer(tx);
      signaler();
    },

    async toutMettreEnAttente() {
      const db = await base;
      const tx = db.transaction([...COLLECTIONS_SYNCHRO, "attente"], "readwrite");
      const maj = horloge();
      for (const collection of COLLECTIONS_SYNCHRO) {
        puis(tx.objectStore(collection).getAll() as IDBRequest<{ id: Id }[]>, (docs) => {
          for (const doc of docs) {
            const enAttente: EnAttente = { cle: cleDe({ collection, id: doc.id }), collection, id: doc.id, donnees: doc, maj };
            tx.objectStore("attente").put(enAttente);
          }
        });
      }
      await terminer(tx);
    },

    async lireEtat() {
      const etat = (await tous<EtatSynchro & { id: string }>("synchro"))[0];
      if (!etat) return null;
      const { id: _id, ...reste } = etat;
      return reste;
    },

    async enregistrerEtat(etat) {
      const db = await base;
      const tx = db.transaction("synchro", "readwrite");
      if (etat) tx.objectStore("synchro").put({ id: "etat", ...etat });
      else tx.objectStore("synchro").delete("etat");
      await terminer(tx);
    },
  };
}
