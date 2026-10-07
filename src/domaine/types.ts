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
}

export interface Liste {
  id: Id;
  nom: string;
  icone: string;
  /** Une liste de courses classe ses éléments par rayon. */
  type: "courses" | "simple";
  creeLe: string;
}

export interface Element {
  id: Id;
  listeId: Id;
  texte: string;
  quantite: string | null;
  rayon: Rayon;
  coche: boolean;
  ajoutePar: Id | null;
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

/** Horloge et générateur d'identifiants injectés, pour des tests déterministes. */
export interface Contexte {
  maintenant: () => string;
  nouvelId: () => Id;
}
