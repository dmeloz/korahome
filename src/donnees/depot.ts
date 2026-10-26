import type { Animal } from "../domaine/mitsu";
import type { DocCouple } from "../domaine/bandeau";
import type { DocAgenda } from "../domaine/agenda";
import type { DocBudget } from "../domaine/budget";
import type { DocVetement } from "../domaine/vetements";
import type { DocMaison } from "../domaine/maison";
import type { DocChef } from "../domaine/chef";
import type { Souvenir } from "../domaine/memoire";
import type { RetourTest } from "../domaine/retours";
import type { ProduitHabituel } from "../domaine/catalogue";
import type { EntreeCorbeille } from "../domaine/corbeille";
import type { Zone } from "../domaine/jardin";
import type { Produit } from "../domaine/stock";
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

  /** Frigo, congélateur et placard : un document par produit. */
  lireProduits(): Promise<Produit[]>;
  enregistrerProduit(produit: Produit): Promise<void>;
  supprimerProduit(id: Id): Promise<void>;

  /** La Base : les produits habituels du foyer, appris à chaque ajout au stock. */
  lireCatalogue(): Promise<ProduitHabituel[]>;
  enregistrerHabituel(habituel: ProduitHabituel): Promise<void>;
  supprimerHabituel(id: Id): Promise<void>;

  /** Le jardin : un document par zone (un bac, un pot, une jardinière), avec ses plantes. */
  lireZones(): Promise<Zone[]>;
  enregistrerZone(zone: Zone): Promise<void>;
  supprimerZone(id: Id): Promise<void>;

  /** La mémoire de Jarvis : un document par fait retenu sur le foyer. */
  lireMemoire(): Promise<Souvenir[]>;
  enregistrerSouvenir(souvenir: Souvenir): Promise<void>;
  supprimerSouvenir(id: Id): Promise<void>;

  /** Le bandeau du couple : mots, humeurs, comptes à rebours, clin d'œil de Jarvis. */
  lireCouple(): Promise<DocCouple[]>;
  enregistrerCouple(doc: DocCouple): Promise<void>;
  supprimerCouple(id: Id): Promise<void>;

  /** Le Chef de la semaine : ses menus (écrits par le serveur), son réglage et les recettes du foyer. */
  lireMenus(): Promise<DocChef[]>;
  enregistrerMenu(doc: DocChef): Promise<void>;
  supprimerMenu(id: Id): Promise<void>;

  /** L'agenda commun : un document par événement, et l'état de chaque compte iCloud relié. */
  lireAgenda(): Promise<DocAgenda[]>;
  enregistrerAgenda(doc: DocAgenda): Promise<void>;
  supprimerAgenda(id: Id): Promise<void>;

  /** Le budget : le plan du foyer, les mois versés et les dépenses. */
  lireBudget(): Promise<DocBudget[]>;
  enregistrerBudget(doc: DocBudget): Promise<void>;
  supprimerBudget(id: Id): Promise<void>;

  /** Les vêtements : tailles, envies et pièces à trier de chacun (voir domaine/vetements.ts). */
  lireVetements(): Promise<DocVetement[]>;
  enregistrerVetement(doc: DocVetement): Promise<void>;
  supprimerVetement(id: Id): Promise<void>;

  /** La maison : les jours des déchets et nos appareils (voir domaine/maison.ts). */
  lireMaison(): Promise<DocMaison[]>;
  enregistrerMaison(doc: DocMaison): Promise<void>;
  supprimerMaison(id: Id): Promise<void>;

  /** Les notes de test écrites depuis le coin « Dev ». */
  lireRetours(): Promise<RetourTest[]>;
  enregistrerRetour(retour: RetourTest): Promise<void>;
  supprimerRetour(id: Id): Promise<void>;

  /** La corbeille du foyer : ce qui a été effacé ces trente derniers jours (voir domaine/corbeille.ts). */
  lireCorbeille(): Promise<EntreeCorbeille[]>;
  /** Remet le document (et les articles d'une liste) là où il était, et le retire de la corbeille. */
  remettre(entree: EntreeCorbeille): Promise<void>;
  /** Retire des entrées de la corbeille pour de bon. */
  viderCorbeille(ids: Id[]): Promise<void>;

  /** Prévient l'abonné à chaque changement, y compris venant d'un autre onglet ou appareil. */
  abonner(rappel: () => void): () => void;
}
