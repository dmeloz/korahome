import type { Element, Foyer, Id, Liste } from "../domaine/types";

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

  /** Prévient l'abonné à chaque changement, y compris venant d'un autre onglet ou appareil. */
  abonner(rappel: () => void): () => void;
}
