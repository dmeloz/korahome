import type { Animal } from "../domaine/mitsu";
import type { RetourTest } from "../domaine/retours";
import type { Element, Foyer, Id, Liste, Tache } from "../domaine/types";

/**
 * Seul point d'accès aux données. L'interface ne parle qu'à ce contrat :
 * aujourd'hui il est servi par IndexedDB sur l'appareil, demain par Supabase
 * (synchro entre les deux iPhones), sans toucher aux écrans ni au domaine.
 */
export interface Depot {
  lireFoyer(): Promise<Foyer | null>;
  enregistrerFoyer(foyer: Foyer): Promise<void>;

  lireListes(): Promise<Liste[]>;
  enregistrerListe(liste: Liste): Promise<void>;
  supprimerListe(id: Id): Promise<void>;

  lireElements(): Promise<Element[]>;
  enregistrerElement(element: Element): Promise<void>;
  supprimerElements(ids: Id[]): Promise<void>;

  lireTaches(): Promise<Tache[]>;
  enregistrerTache(tache: Tache): Promise<void>;
  enregistrerTaches(taches: Tache[]): Promise<void>;
  supprimerTache(id: Id): Promise<void>;

  /** Le suivi de Mitsu (et d'un autre animal un jour) : un document par animal. */
  lireAnimaux(): Promise<Animal[]>;
  enregistrerAnimal(animal: Animal): Promise<void>;

  /** Les notes de test écrites depuis le coin « Dev ». */
  lireRetours(): Promise<RetourTest[]>;
  enregistrerRetour(retour: RetourTest): Promise<void>;
  supprimerRetour(id: Id): Promise<void>;

  /** Prévient l'abonné à chaque changement, y compris venant d'un autre onglet ou appareil. */
  abonner(rappel: () => void): () => void;
}
