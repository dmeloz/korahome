// La visite guidée de Kora : quelques bulles qui montrent les vrais éléments de
// l'accueil, une étape à la fois. Elle se lance une fois sur chaque téléphone et se
// relance depuis Réglages. Ici, seulement le parcours et ses règles ; l'écran qui
// dessine les bulles est dans ui/pieces/Visite.tsx.

/** Ce que pointe une étape : l'élément de l'écran marqué `data-visite="…"`. */
export type CibleVisite = "bandeau" | "aujourdhui" | "pages" | "widget" | "barre" | "chercher" | "reglages";

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
export function parcoursVisite(autre: string | null): EtapeVisite[] {
  const lautre = autre ?? "l'autre";
  return [
    {
      id: "bienvenue",
      titre: "Bienvenue dans Kora",
      texte: "Kora tient la maison avec vous : courses, tâches, agenda, Mitsu, budget et le reste. Petite visite en quelques étapes, à passer quand tu veux.",
    },
    {
      id: "bandeau",
      cible: "bandeau",
      titre: "La banderole",
      texte: `Vos petits mots, vos humeurs et les comptes à rebours défilent ici. Touche-la pour écrire à ${lautre}.`,
    },
    {
      id: "aujourdhui",
      cible: "aujourdhui",
      titre: "Aujourd'hui",
      texte: "Ce qui compte aujourd'hui, du plus pressé au plus calme. Le rond coche une tâche, la ligne ouvre son module.",
    },
    {
      id: "pages",
      cible: "pages",
      titre: "Les pages de l'accueil",
      texte: "Les widgets se rangent en pages par usage : Ménage, Courses, Cuisine, Budget, Agenda. Glisse de côté, ou touche un nom, pour changer de page.",
    },
    {
      id: "widget",
      cible: "widget",
      titre: "Les widgets",
      texte: "Chaque widget ouvre son module. Un point rouge veut dire qu'il y a quelque chose à faire. « Modifier l'accueil », tout en bas, pour en ajouter ou les déplacer.",
    },
    {
      id: "barre",
      cible: "barre",
      titre: "La barre Jarvis",
      texte: "Elle remplace tous les « + ». Écris ou dicte « lait et pain » ou « dentiste jeudi 14 h » : Kora range au bon endroit. L'étoile ouvre Jarvis pour lui parler.",
    },
    {
      id: "gestes",
      titre: "Les gestes",
      texte: "Les mêmes partout dans Kora.",
      gestes: [
        { picto: "droite", texte: "Glisser à droite : c'est fait" },
        { picto: "gauche", texte: "Glisser à gauche : supprimer, avec Annuler" },
        { picto: "appui", texte: "Appui long : plus de choix" },
        { picto: "bord", texte: "Depuis le bord gauche : revenir" },
      ],
    },
    {
      id: "chercher",
      cible: "chercher",
      titre: "Chercher et rappels",
      texte: "La loupe cherche partout (ou tire l'accueil vers le bas). La cloche garde les rappels que Kora t'a envoyés.",
    },
    {
      id: "reglages",
      cible: "reglages",
      titre: "Tes réglages",
      texte: `Partage avec ${lautre}, notifications, calendrier de l'iPhone, thème. La visite se relance ici. Bonne découverte.`,
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
