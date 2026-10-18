import { normaliser } from "./rayons";

// Ce que Kora sait des plantes qu'on cultive en pot ou en bac sur le plateau vaudois
// (Renens, environ 400 m) : l'ensoleillement qu'elles aiment, l'arrosage en été,
// si elles craignent le gel, et le calendrier de l'année. Les mois sont numérotés de
// 1 (janvier) à 12. Les dates suivent la règle du coin : rien de frileux dehors avant
// les Saints de glace, mi-mai.

/** Plein soleil : 6 h et plus par jour ; mi-ombre : 3 à 6 h ; ombre : moins de 3 h. */
export type Exposition = "soleil" | "mi-ombre" | "ombre";

export const EXPOSITIONS: Record<Exposition, { nom: string; detail: string }> = {
  soleil: { nom: "Plein soleil", detail: "6 h de soleil et plus" },
  "mi-ombre": { nom: "Mi-ombre", detail: "3 à 6 h de soleil" },
  ombre: { nom: "Ombre", detail: "moins de 3 h de soleil" },
};

export type CategoriePlante = "aromatique" | "legume" | "fruit" | "fleur";

export interface Espece {
  cle: string;
  nom: string;
  /** D'autres façons de l'écrire ou de la dire. */
  autres: string[];
  categorie: CategoriePlante;
  exposition: Exposition;
  /** Tous les combien de jours l'arroser en été, en pot. */
  arrosageJours: number;
  /** Craint le moindre gel : à rentrer ou protéger sous 2 °C. */
  gelive: boolean;
  /** Revient chaque année. */
  vivace: boolean;
  /** Semer au chaud, derrière une fenêtre. */
  semisAbri: number[];
  /** Semer directement dehors, dans le bac ou le pot. */
  semisDehors: number[];
  /** Mettre en place un plant acheté ou élevé au chaud. */
  plantation: number[];
  recolte: number[];
  conseil: string;
}

const mois = (de: number, a: number): number[] => {
  const liste: number[] = [];
  for (let m = de; ; m = (m % 12) + 1) {
    liste.push(m);
    if (m === a) return liste;
  }
};

const e = (
  cle: string,
  nom: string,
  categorie: CategoriePlante,
  exposition: Exposition,
  arrosageJours: number,
  options: Partial<Omit<Espece, "cle" | "nom" | "categorie" | "exposition" | "arrosageJours">> & { conseil: string },
): Espece => ({
  cle,
  nom,
  categorie,
  exposition,
  arrosageJours,
  autres: [],
  gelive: false,
  vivace: false,
  semisAbri: [],
  semisDehors: [],
  plantation: [],
  recolte: [],
  ...options,
});

export const ESPECES: readonly Espece[] = [
  // ----- Aromatiques -----
  e("basilic", "Basilic", "aromatique", "soleil", 2, {
    gelive: true, semisAbri: mois(3, 4), semisDehors: mois(5, 6), plantation: mois(5, 6), recolte: mois(6, 9),
    conseil: "Pince les fleurs pour garder des feuilles tendres, et rentre-le dès que les nuits passent sous 10 °C.",
  }),
  e("persil", "Persil", "aromatique", "mi-ombre", 3, {
    semisAbri: [3], semisDehors: mois(4, 7), plantation: mois(4, 6), recolte: mois(5, 11),
    conseil: "Il germe lentement (trois semaines) : garde la terre humide en attendant.",
  }),
  e("ciboulette", "Ciboulette", "aromatique", "mi-ombre", 3, {
    vivace: true, semisDehors: mois(3, 5), plantation: [3, 4, 5, 9, 10], recolte: mois(3, 10),
    conseil: "Coupe-la à 2 cm du sol : elle repousse plusieurs fois dans l'année.",
  }),
  e("menthe", "Menthe", "aromatique", "mi-ombre", 2, {
    vivace: true, plantation: [3, 4, 5, 9, 10], recolte: mois(5, 10),
    conseil: "Plante-la seule dans son pot : ses racines envahissent tout.",
  }),
  e("thym", "Thym", "aromatique", "soleil", 7, {
    vivace: true, plantation: [3, 4, 5, 9], recolte: mois(1, 12),
    conseil: "Arrose peu : il craint bien plus l'humidité que la sécheresse.",
  }),
  e("romarin", "Romarin", "aromatique", "soleil", 7, {
    vivace: true, plantation: [4, 5, 9], recolte: mois(1, 12),
    conseil: "Terre légère et peu d'eau ; en pot, abrite-le du vent froid en hiver.",
  }),
  e("sauge", "Sauge", "aromatique", "soleil", 5, {
    vivace: true, plantation: [4, 5, 9], recolte: mois(4, 10),
    conseil: "Taille-la au printemps pour qu'elle reste touffue.",
  }),
  e("origan", "Origan", "aromatique", "soleil", 5, {
    autres: ["marjolaine"], vivace: true, semisAbri: [3, 4], plantation: [4, 5], recolte: mois(6, 9),
    conseil: "Le goût est le plus fort juste avant la floraison : c'est le moment d'en sécher.",
  }),
  e("coriandre", "Coriandre", "aromatique", "mi-ombre", 3, {
    semisDehors: [4, 5, 6, 8, 9], recolte: mois(5, 10),
    conseil: "Elle monte vite en graines à la chaleur : sèmes-en un peu toutes les trois semaines.",
  }),
  e("aneth", "Aneth", "aromatique", "soleil", 3, {
    semisDehors: mois(4, 7), recolte: mois(6, 9),
    conseil: "Sème-le directement en place : il n'aime pas être déplacé.",
  }),
  e("laurier", "Laurier", "aromatique", "soleil", 7, {
    autres: ["laurier sauce"], vivace: true, plantation: [4, 5], recolte: mois(1, 12),
    conseil: "En pot, il supporte le froid jusqu'à −5 °C : au-delà, rentre-le ou emballe le pot.",
  }),
  e("estragon", "Estragon", "aromatique", "soleil", 4, {
    vivace: true, plantation: [4, 5], recolte: mois(6, 9),
    conseil: "Prends l'estragon français, bien plus parfumé que le russe.",
  }),
  e("melisse", "Mélisse", "aromatique", "mi-ombre", 3, {
    autres: ["melisse citronnelle"], vivace: true, plantation: [4, 5, 9], recolte: mois(5, 9),
    conseil: "Coupe-la après la floraison pour une seconde récolte.",
  }),
  e("verveine", "Verveine citronnelle", "aromatique", "soleil", 3, {
    autres: ["verveine citron"], gelive: true, vivace: true, plantation: [5, 6], recolte: mois(6, 9),
    conseil: "Elle gèle dehors : rentre le pot dans un endroit clair et frais pour l'hiver.",
  }),

  // ----- Légumes -----
  e("tomate", "Tomate", "legume", "soleil", 2, {
    autres: ["tomates cerises", "tomate cerise"], gelive: true, semisAbri: [3, 4], plantation: [5, 6], recolte: mois(7, 10),
    conseil: "Tuteure-la, retire les gourmands et arrose au pied, jamais sur les feuilles.",
  }),
  e("courgette", "Courgette", "legume", "soleil", 2, {
    gelive: true, semisAbri: [4], semisDehors: [5, 6], plantation: [5, 6], recolte: mois(7, 9),
    conseil: "Un pied suffit pour deux personnes, mais il lui faut près d'un mètre carré.",
  }),
  e("poivron", "Poivron", "legume", "soleil", 2, {
    autres: ["piment"], gelive: true, semisAbri: [2, 3], plantation: [5, 6], recolte: mois(7, 10),
    conseil: "Il lui faut l'endroit le plus chaud : contre un mur au soleil, c'est idéal.",
  }),
  e("aubergine", "Aubergine", "legume", "soleil", 2, {
    gelive: true, semisAbri: [2, 3], plantation: [5, 6], recolte: [8, 9],
    conseil: "La plus frileuse de toutes : plante-la fin mai, au soleil et à l'abri du vent.",
  }),
  e("concombre", "Concombre", "legume", "soleil", 2, {
    gelive: true, semisAbri: [4], semisDehors: [5, 6], plantation: [5, 6], recolte: mois(7, 9),
    conseil: "Fais-le grimper sur un treillis : il prend moins de place et les fruits restent propres.",
  }),
  e("salade", "Salade", "legume", "mi-ombre", 2, {
    autres: ["laitue", "batavia", "feuille de chene", "romaine"], semisAbri: [2, 3], semisDehors: mois(3, 8), plantation: mois(3, 9), recolte: mois(5, 10),
    conseil: "Sème quelques graines toutes les trois semaines pour en avoir tout l'été.",
  }),
  e("roquette", "Roquette", "legume", "mi-ombre", 2, {
    semisDehors: mois(3, 9), recolte: mois(4, 11),
    conseil: "Prête en un mois ; à l'ombre l'été, elle pique moins.",
  }),
  e("mache", "Mâche", "legume", "mi-ombre", 3, {
    autres: ["doucette", "rampon"], semisDehors: [8, 9], recolte: [10, 11, 12, 1, 2, 3],
    conseil: "La salade de l'hiver : elle supporte le gel sans souci.",
  }),
  e("epinard", "Épinard", "legume", "mi-ombre", 2, {
    semisDehors: [3, 4, 8, 9], recolte: [4, 5, 6, 10, 11],
    conseil: "Sème-le au printemps ou à la fin de l'été : il monte en graines en pleine chaleur.",
  }),
  e("radis", "Radis", "legume", "soleil", 2, {
    semisDehors: mois(3, 9), recolte: mois(4, 10),
    conseil: "Prêt en quatre semaines : parfait pour commencer un bac.",
  }),
  e("carotte", "Carotte", "legume", "soleil", 3, {
    semisDehors: mois(3, 7), recolte: mois(6, 11),
    conseil: "Il lui faut 25 cm de terre légère, sans cailloux : un bac surélevé est idéal.",
  }),
  e("haricot", "Haricot", "legume", "soleil", 3, {
    autres: ["haricots verts", "haricot vert"], gelive: true, semisDehors: mois(5, 7), recolte: mois(7, 9),
    conseil: "Sème-le quand la terre est chaude, après les Saints de glace.",
  }),
  e("petit-pois", "Petit pois", "legume", "soleil", 3, {
    autres: ["pois", "petits pois"], semisDehors: [3, 4], recolte: [6, 7],
    conseil: "Il aime la fraîcheur du printemps : sème-le tôt, avec un support pour grimper.",
  }),
  e("betterave", "Betterave", "legume", "soleil", 3, {
    semisDehors: mois(4, 6), recolte: mois(7, 10),
    conseil: "Éclaircis à 10 cm : chaque graine donne plusieurs plants.",
  }),
  e("blette", "Blette", "legume", "mi-ombre", 3, {
    autres: ["bette", "cotes de bette"], semisDehors: mois(4, 6), recolte: mois(6, 11),
    conseil: "Cueille les feuilles extérieures : le cœur continue de pousser.",
  }),
  e("poireau", "Poireau", "legume", "soleil", 3, {
    semisAbri: [2, 3], plantation: mois(5, 7), recolte: [9, 10, 11, 12, 1, 2, 3],
    conseil: "Butte-le au fil de l'été pour un fût bien blanc.",
  }),
  e("oignon", "Oignon", "legume", "soleil", 5, {
    autres: ["echalote"], plantation: [3, 4], recolte: [7, 8],
    conseil: "Arrête d'arroser quand les feuilles jaunissent : il se conserve mieux.",
  }),
  e("ail", "Ail", "legume", "soleil", 7, {
    plantation: [10, 11, 2, 3], recolte: [6, 7],
    conseil: "Plante les gousses pointe en haut, à l'automne pour de plus grosses têtes.",
  }),
  e("chou-kale", "Chou kale", "legume", "mi-ombre", 3, {
    autres: ["kale", "chou frise"], semisDehors: mois(4, 6), plantation: [6, 7], recolte: [9, 10, 11, 12, 1, 2],
    conseil: "Le gel le rend plus doux : récolte-le tout l'hiver.",
  }),
  e("courge", "Courge", "legume", "soleil", 3, {
    autres: ["potiron", "butternut", "potimarron"], gelive: true, semisAbri: [4], semisDehors: [5, 6], plantation: [5, 6], recolte: [9, 10],
    conseil: "Très gourmande en place : un pied par grand bac, pas plus.",
  }),
  e("pomme-de-terre", "Pomme de terre", "legume", "soleil", 4, {
    autres: ["patate", "pommes de terre"], plantation: [4, 5], recolte: mois(7, 9),
    conseil: "Ça marche très bien en sac de culture : on ajoute de la terre au fil de la pousse.",
  }),

  // ----- Petits fruits -----
  e("fraise", "Fraisier", "fruit", "soleil", 2, {
    autres: ["fraises", "fraisier"], vivace: true, plantation: [3, 4, 8, 9], recolte: mois(5, 7),
    conseil: "Coupe les stolons pour des fruits plus gros, ou garde-les pour de nouveaux plants.",
  }),

  // ----- Fleurs utiles -----
  e("capucine", "Capucine", "fleur", "soleil", 3, {
    gelive: true, semisDehors: [5, 6], recolte: mois(6, 10),
    conseil: "Ses fleurs se mangent, et elle attire les pucerons loin des légumes.",
  }),
  e("souci", "Souci", "fleur", "soleil", 4, {
    autres: ["calendula"], semisDehors: mois(3, 6), recolte: mois(6, 10),
    conseil: "Il éloigne certains insectes des tomates : sème-le à leur pied.",
  }),
  e("lavande", "Lavande", "fleur", "soleil", 10, {
    vivace: true, plantation: [4, 5, 9], recolte: [7, 8],
    conseil: "Taille-la juste après la floraison, sans couper dans le vieux bois.",
  }),
];

const PAR_CLE = new Map(ESPECES.map((x) => [x.cle, x]));

export function espece(cle: string | null | undefined): Espece | null {
  return cle ? (PAR_CLE.get(cle) ?? null) : null;
}

/** « tomates » → « tomate » : sans majuscules, accents ni pluriel. */
const cleDeTexte = (texte: string) =>
  normaliser(texte)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((mot) => (mot.length > 3 ? mot.replace(/[sx]$/, "") : mot))
    .join(" ");

/**
 * Reconnaît une plante dans ce qu'on a écrit : « 2 pieds de tomates cerises » → Tomate.
 * Le nom le plus long qui figure dans le texte gagne (« tomate cerise » avant « tomate »).
 */
export function trouverEspece(texte: string): Espece | null {
  const cherche = ` ${cleDeTexte(texte)} `;
  let meilleure: { espece: Espece; longueur: number } | null = null;
  for (const x of ESPECES) {
    for (const nom of [x.nom, x.cle.replace(/-/g, " "), ...x.autres]) {
      const cle = cleDeTexte(nom);
      if (cle && cherche.includes(` ${cle} `) && (!meilleure || cle.length > meilleure.longueur)) {
        meilleure = { espece: x, longueur: cle.length };
      }
    }
  }
  return meilleure?.espece ?? null;
}

export const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** L'exposition d'une zone convient-elle à la plante ? Le soleil trop fort se compense mieux que l'ombre. */
export function expositionConvient(plante: Exposition, zone: Exposition): boolean {
  if (plante === zone) return true;
  if (plante === "mi-ombre") return zone === "soleil";
  if (plante === "ombre") return zone === "mi-ombre";
  return false;
}
