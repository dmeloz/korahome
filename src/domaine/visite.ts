// La visite guidée de Kora : quelques bulles qui montrent les vrais éléments de
// l'accueil, une étape à la fois. Elle se lance une fois sur chaque téléphone et se
// relance depuis Réglages. Ici, seulement le parcours et ses règles ; l'écran qui
// dessine les bulles est dans ui/pieces/Visite.tsx.

/** Ce que pointe une étape : l'élément de l'écran marqué `data-visite="…"`. */
export type CibleVisite = "signes" | "aujourdhui" | "widget" | "fee";

export type EtapeVisite = {
  id: string;
  titre: string;
  texte: string;
  /** Sans cible, la bulle s'affiche au milieu de l'écran. */
  cible?: CibleVisite;
  /** Des gestes à montrer en petits dessins. */
  gestes?: readonly { picto: "droite" | "gauche" | "appui" | "bord"; texte: string }[];
};

/**
 * Le parcours, avec le prénom de l'autre quand on le connaît. Une étape dont la cible
 * n'est pas à l'écran (une seule page, aucun widget) est sautée par `etapesVisibles`.
 */
export function parcoursVisite(autre: string | null, fee = "Tael"): EtapeVisite[] {
  const lautre = autre ?? "l'autre";
  return [
    {
      id: "bienvenue",
      titre: "Bienvenue dans Kora",
      texte: "Kora tient la maison avec vous : courses, tâches, agenda, Mitsu, budget et le reste. Petite visite en quelques étapes, à passer quand tu veux.",
    },
    {
      id: "signes",
      cible: "signes",
      titre: "Les petits signes",
      texte: "Au bout de la date : vos humeurs, un compte à rebours, le prochain rendez-vous… Touche-en un pour ouvrir sa page. Appui long pour choisir les tiens.",
    },
    {
      id: "aujourdhui",
      cible: "aujourdhui",
      titre: "Le moment présent",
      texte: "Ce qui compte maintenant, une chose à la fois en grand : elles passent toutes seules, un toucher les arrête. Glisse-la vers la droite ou touche son rond : c'est fait.",
    },
    {
      id: "widget",
      cible: "widget",
      titre: "Les chiffres du jour",
      texte: "Tâches, courses, budget, agenda d'un coup d'œil. Touche pour ouvrir, garde le doigt pour un aperçu. Dessous, deux piles qui suivent le moment : glisse-les.",
    },
    {
      id: "fee",
      cible: "fee",
      titre: `${fee}, ta fée`,
      texte: `Elle remplace tous les « + ». Touche-la pour lui parler, garde le doigt pour écrire, glisse-la vers un bord. Ce que ${lautre} t'envoie attend au-dessus d'elle.`,
    },
    {
      id: "gestes",
      titre: "Les gestes",
      texte: "Les mêmes partout dans Kora.",
      gestes: [
        { picto: "droite", texte: "Glisser à droite : c'est fait" },
        { picto: "gauche", texte: "Glisser à gauche : supprimer, avec Annuler" },
        { picto: "appui", texte: "Appui long : plus de choix" },
        { picto: "bord", texte: "Glisser la page vers la droite : revenir" },
      ],
    },
    {
      id: "espaces",
      titre: "Chercher et régler",
      texte: `Pour chercher, écris à ta fée : ce qu'elle trouve dans Kora monte au-dessus. Tes réglages, où la visite se relance : la petite roue en haut à droite.`,
    },
  ];
}

/** Les étapes dont la cible est à l'écran (une étape sans cible l'est toujours). */
export function etapesVisibles(etapes: readonly EtapeVisite[], presentes: ReadonlySet<CibleVisite>): EtapeVisite[] {
  return etapes.filter((e) => !e.cible || presentes.has(e.cible));
}

/** « 3 sur 9 », pour VoiceOver et la ligne de progression. */
export function progression(index: number, total: number): string {
  return `${index + 1} sur ${total}`;
}

/**
 * Où poser la bulle par rapport à sa cible : en dessous quand la cible est dans le haut
 * de l'écran, au-dessus sinon, au milieu quand il n'y a pas de cible.
 */
export function placementBulle(cible: { haut: number; bas: number } | null, hauteurEcran: number): "dessous" | "dessus" | "milieu" {
  if (!cible) return "milieu";
  return (cible.haut + cible.bas) / 2 < hauteurEcran / 2 ? "dessous" : "dessus";
}
