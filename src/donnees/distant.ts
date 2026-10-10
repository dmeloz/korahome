import type { Changement } from "../domaine/synchro";
import type { Id } from "../domaine/types";

/** Le serveur partagé du foyer, vu par la synchro. */
export interface Distant {
  /** Ce qui a changé sur le serveur depuis ce curseur (tout si null), et le nouveau curseur. */
  lire(foyerId: Id, depuis: string | null): Promise<{ changements: Changement[]; curseur: string | null }>;
  /** Envoie des modifications ; le serveur garde la plus récente de chaque document. */
  envoyer(foyerId: Id, changements: readonly Changement[]): Promise<void>;
}

export interface FoyerPartage {
  id: Id;
  nom: string;
  /** Le code à donner à l'autre membre pour qu'il rejoigne le foyer. */
  code: string;
}

/** Le compte de la personne sur ce téléphone, et le foyer partagé auquel elle appartient. */
export interface Compte {
  /** L'adresse e-mail connectée, ou null. */
  connecte(): Promise<string | null>;
  /** Crée le compte et connecte ce téléphone. Aucun e-mail n'est envoyé. */
  creerCompte(email: string, motDePasse: string): Promise<void>;
  connecter(email: string, motDePasse: string): Promise<void>;
  deconnecter(): Promise<void>;
  /** Les foyers partagés dont ce compte est membre (en pratique, un seul). */
  mesFoyers(): Promise<FoyerPartage[]>;
  /** Ouvre le partage de ce foyer et renvoie son code d'invitation. */
  creerFoyer(id: Id, nom: string): Promise<FoyerPartage>;
  /** Rejoint le foyer de ce code ; renvoie son identifiant. */
  rejoindreFoyer(code: string): Promise<Id>;
}

export type ServicesDistants = Distant & Compte;
