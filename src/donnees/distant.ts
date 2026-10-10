import type { PreferencesRappels } from "../domaine/rappels";
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
  /** La session de ce téléphone : avec un compte (adresse e-mail) ou seulement par le code du foyer (email null). */
  connecte(): Promise<{ email: string | null } | null>;
  /** Ouvre une session sans compte : il suffira ensuite du code du foyer. */
  entrerSansCompte(): Promise<void>;
  /** Crée le compte et connecte ce téléphone. Aucun e-mail n'est envoyé. */
  creerCompte(email: string, motDePasse: string): Promise<void>;
  connecter(email: string, motDePasse: string): Promise<void>;
  deconnecter(): Promise<void>;
  /** Les foyers partagés dont ce compte est membre (en pratique, un seul). */
  mesFoyers(): Promise<FoyerPartage[]>;
  /** Ouvre le partage de ce foyer et renvoie son code d'invitation. */
  creerFoyer(id: Id, nom: string): Promise<FoyerPartage>;
  /** Rejoint le foyer de ce code ; renvoie son identifiant (erreur « Code inconnu » sinon). */
  rejoindreFoyer(code: string): Promise<Id>;
}

/** L'inscription d'un téléphone aux rappels du matin (Web Push). */
export interface InscriptionRappels {
  foyerId: Id;
  membreId: Id | null;
  /** L'adresse d'envoi et les clés fournies par l'iPhone (PushSubscription.toJSON()). */
  endpoint: string;
  cles: { p256dh: string; auth: string };
  preferences: PreferencesRappels;
}

/** Le serveur qui envoie les rappels du matin (supabase/functions/rappels). */
export interface ServeurRappels {
  /** La clé publique d'envoi, à donner à l'iPhone pour s'inscrire. */
  cleRappels(): Promise<string>;
  /** Inscrit ce téléphone, ou met à jour ses choix. */
  inscrireRappels(inscription: InscriptionRappels): Promise<void>;
  desinscrireRappels(endpoint: string): Promise<void>;
  /** Envoie tout de suite le rappel du jour à ce téléphone. */
  essaiRappel(endpoint: string): Promise<void>;
}

export type ServicesDistants = Distant & Compte & ServeurRappels;
