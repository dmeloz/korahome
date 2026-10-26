import type { MenuSemaine } from "../domaine/chef";
import type { EtatBudget, TourJarvis } from "../domaine/jarvis";
import type { PreferencesRappels } from "../domaine/rappels";
import type { TelephoneRelie } from "../domaine/foyer";
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
  /** Ce téléphone dit au serveur qui il est (« Dany · iPhone · Kora 0.0.82 ») et qu'il vient de s'ouvrir. */
  nommerTelephone(foyerId: Id, nom: string): Promise<void>;
  /** Les téléphones reliés au foyer (dix au plus). */
  telephones(foyerId: Id): Promise<TelephoneRelie[]>;
  /** Retire un autre téléphone : sa place se libère, ses rappels s'arrêtent. */
  retirerTelephone(foyerId: Id, id: string): Promise<void>;
  /** Un nouveau code pour rejoindre le foyer ; l'ancien ne marche plus. */
  nouveauCode(foyerId: Id): Promise<string>;
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
  /** Prévient tout de suite l'autre téléphone d'un mot du couple (les mots programmés partent avec le passage de l'heure). */
  notifierMot(mot: { foyerId: Id; id: Id; de: Id | null; texte: string }): Promise<void>;
}

/** Une demande à Jarvis : la phrase, l'état du foyer préparé par le téléphone, les derniers échanges. */
export interface DemandeJarvis {
  foyerId: Id;
  demande: string;
  etat: string;
  historique: TourJarvis[];
  /** « conseil » : le conseil du dimanche ; « budget » : le conseiller du Budget. Tous deux avec le modèle plus réfléchi. */
  mode?: "conseil" | "budget";
  /** Une photo ou un PDF à lire (lettre, carte de rendez-vous, recette), en base64. */
  image?: PieceJointe;
}

/** Ce que Jarvis lit en plus de la demande : une photo (JPEG, PNG, WebP) ou un PDF. */
export interface PieceJointe {
  type: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  donnees: string;
}

/** Sa réponse : ce qu'il dit, les actions qu'il demande (à vérifier et appliquer sur le téléphone), son budget. */
export interface ReponseJarvis {
  texte: string;
  appels: { nom: string; entree: unknown }[];
  budget: EtatBudget;
}

/** Jarvis passe par le serveur du foyer (supabase/functions/jarvis), qui garde la clé de l'API. */
export interface ServeurJarvis {
  demanderJarvis(demande: DemandeJarvis): Promise<ReponseJarvis>;
  /** Lance le Chef de la semaine tout de suite (supabase/functions/chef) : il écrit les menus et les courses. */
  lancerChef(foyerId: Id): Promise<{ menu: MenuSemaine; budget: EtatBudget; sansListe: boolean }>;
  /** Un nouveau lien Apple Pay pour cette personne (supabase/functions/paiements) : l'adresse à coller dans le raccourci. L'ancien ne marche plus. */
  lienPaiements(demande: { foyerId: Id; membreId: Id }): Promise<string>;
  retirerLienPaiements(demande: { foyerId: Id; membreId: Id }): Promise<void>;
  /** Un nouveau lien Siri pour cette personne (supabase/functions/siri), avec le nom à dire : l'adresse à coller dans le raccourci. L'ancien ne marche plus. */
  lienSiri(demande: { foyerId: Id; membreId: Id; nom: string }): Promise<string>;
  retirerLienSiri(demande: { foyerId: Id; membreId: Id }): Promise<void>;
}

/** L'agenda relié à iCloud passe par le serveur du foyer (supabase/functions/agenda), qui garde les mots de passe d'app. */
export interface ServeurAgenda {
  /** Relie le compte iCloud de cette personne ; le serveur crée le calendrier « Kora » et synchronise. */
  relierIcloud(demande: { foyerId: Id; membreId: Id; appleId: string; motDePasse: string }): Promise<void>;
  /** Les calendriers iCloud que cette personne ne veut pas voir dans Kora. */
  choisirCalendriers(demande: { foyerId: Id; membreId: Id; ignores: string[] }): Promise<void>;
  synchroniserAgenda(foyerId: Id): Promise<void>;
  delierIcloud(demande: { foyerId: Id; membreId: Id }): Promise<void>;
}

/** Le serveur prévient dès qu'un document du foyer change : l'autre iPhone le voit à l'instant. */
export interface TempsReel {
  /** Appelle `rappel` à chaque changement sur le serveur ; renvoie de quoi arrêter d'écouter. */
  ecouterFoyer(foyerId: Id, rappel: () => void): () => void;
}

export type ServicesDistants = Distant & Compte & ServeurRappels & ServeurJarvis & ServeurAgenda & TempsReel;
