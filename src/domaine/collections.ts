// Le registre des collections du foyer : chaque collection une seule fois. Son nom est à la fois
// celui du magasin IndexedDB du téléphone et celui de la colonne `collection` de la table
// `documents` du serveur ; `donnees` est le nom sous lequel l'app la lit (useDonnees, sauvegarde).
// Ajouter un module : une ligne ici, son type dans `Documents` (donnees/depot.ts), la contrainte
// `documents_collection_check` du serveur (une migration), puis la version d'IndexedDB
// (donnees/depotLocal.ts). Voir docs/ajouter-un-module.md.

export const COLLECTIONS = [
  { nom: "foyer", donnees: "foyer" },
  { nom: "listes", donnees: "listes" },
  { nom: "elements", donnees: "elements" },
  { nom: "taches", donnees: "taches" },
  { nom: "animaux", donnees: "animaux" },
  { nom: "stock", donnees: "produits" },
  { nom: "catalogue", donnees: "catalogue" },
  { nom: "jardin", donnees: "zones" },
  { nom: "memoire", donnees: "souvenirs" },
  { nom: "couple", donnees: "couple" },
  { nom: "menus", donnees: "menus" },
  { nom: "agenda", donnees: "agenda" },
  { nom: "budget", donnees: "budget" },
  { nom: "retours", donnees: "retours" },
  { nom: "corbeille", donnees: "corbeille" },
  { nom: "vetements", donnees: "vetements" },
  { nom: "maison", donnees: "maison" },
] as const;

type Entree = (typeof COLLECTIONS)[number];

/** Le nom d'une collection partagée. */
export type CollectionSynchro = Entree["nom"];

/** Le nom sous lequel l'app lit une collection (« stock » se lit « produits »). */
export type NomDonnees = Entree["donnees"];

/** Le nom de lecture de chaque collection. */
export type DonneesDe<C extends CollectionSynchro> = Extract<Entree, { nom: C }>["donnees"];

export const NOMS_COLLECTIONS: readonly CollectionSynchro[] = COLLECTIONS.map((c) => c.nom);

export const estCollection = (nom: string): nom is CollectionSynchro => (NOMS_COLLECTIONS as readonly string[]).includes(nom);

/** Ce que la sauvegarde écrit en listes : tout sauf le foyer (à part) et la corbeille (qui ne se sauvegarde pas). */
export const DONNEES_SAUVEGARDEES = COLLECTIONS.filter((c) => c.nom !== "foyer" && c.nom !== "corbeille").map((c) => c.donnees) as readonly Exclude<NomDonnees, "foyer" | "corbeille">[];
