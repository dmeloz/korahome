// Modèle de données de KoraHome.
// Ce dossier ne dépend ni de l'interface ni du stockage : c'est la spécification
// que reprendra une future app native. Les dates sont des chaînes ISO 8601.

export type Id = string;

export interface Membre {
  id: Id;
  prenom: string;
  couleur: string;
}

export interface Foyer {
  id: Id;
  nom: string;
  membres: Membre[];
  creeLe: string;
  /** Qui a dit oui pour voir l'équilibre des tâches : il ne s'affiche qu'une fois que tous ont accepté. */
  equilibre?: Id[];
}

export interface Liste {
  id: Id;
  nom: string;
  icone: string;
  /** Une liste de courses classe ses éléments par rayon. */
  type: "courses" | "simple";
  creeLe: string;
  /** Les jours où chaque article a été acheté : Kora devine ce qu'il faudra bientôt racheter. */
  achats?: Achat[];
}

export interface Achat {
  /** Le nom de l'article, comme sur la liste : « Lait ». */
  texte: string;
  rayon: Rayon;
  /** Les derniers jours d'achat, du plus ancien au plus récent. */
  jours: Jour[];
  /** La quantité prise la dernière fois (« 2 l ») : proposée au prochain ajout. */
  quantite?: string;
}

export interface Element {
  id: Id;
  listeId: Id;
  texte: string;
  quantite: string | null;
  rayon: Rayon;
  coche: boolean;
  ajoutePar: Id | null;
  /** « chef » : ajouté par le Chef de la semaine pour ses menus. */
  source?: "chef";
  creeLe: string;
  cocheLe: string | null;
}

export const RAYONS = [
  "Fruits et légumes",
  "Boulangerie",
  "Crèmerie",
  "Boucherie et poisson",
  "Épicerie salée",
  "Épicerie sucrée",
  "Boissons",
  "Surgelés",
  "Hygiène",
  "Entretien",
  "Bébé",
  "Animaux",
  "Autre",
] as const;

export type Rayon = (typeof RAYONS)[number];

/** Une date du calendrier, « AAAA-MM-JJ », dans le fuseau du téléphone. */
export type Jour = string;

/** Une tâche qui revient : tous les N jours, semaines ou mois. */
export interface Recurrence {
  unite: "jour" | "semaine" | "mois";
  tous: number;
}

export interface Tache {
  id: Id;
  titre: string;
  /** null : une tâche à faire une seule fois. */
  recurrence: Recurrence | null;
  /** Prochaine date où la tâche est à faire. */
  echeance: Jour;
  /** Qui s'en occupe ; null : libre, chacun peut la prendre. */
  responsable: Id | null;
  /** Dernière fois que la tâche a été faite, et par qui. */
  faiteLe: string | null;
  faitePar: Id | null;
  creeLe: string;
  /** « entretien » : un geste d'entretien de la maison, qui revient tous les quelques mois. */
  categorie?: "entretien";
  /** Les dernières fois où elle a été faite : par qui, et avec combien de jours de retard. */
  historique?: FoisFaite[];
}

export interface FoisFaite {
  le: Jour;
  par: Id | null;
  /** Jours après l'échéance (0 : à l'heure ou en avance). */
  retard: number;
}

/** Horloge et générateur d'identifiants injectés, pour des tests déterministes. */
export interface Contexte {
  maintenant: () => string;
  nouvelId: () => Id;
}
