// Le guide de première ouverture (Kora 0.1.1, demande de Melo du 4 novembre 2026) : cinq pages
// qui disent comment Kora se tient, montrées une fois par téléphone quand il ouvre une version
// qui a changé d'allure, et à un foyer neuf. Ce qui s'y dit est ici ; la pièce (ui/pieces/Guide)
// ne fait que l'afficher.

import type { NomIcone } from "../ui/Icone";

/** La version du guide : un téléphone qui a vu celle-ci ne le revoit pas. À changer quand l'allure change. */
export const VERSION_GUIDE = "0.1";

/** Une petite carte montrée en exemple sur une page du guide : une vraie carte de Kora, pas un dessin. */
export interface ExempleGuide {
  etiquette: string;
  texte: string;
  /** La ligne grise dessous. */
  detail?: string;
  /** Sa teinte : le laiton pour ce qui attend, l'ivoire pour demain. */
  ton?: "forte" | "contraste";
}

export interface PageGuide {
  /** Ce que la page illustre : le foyer à deux, la navigation, les cartes, la fée, la fin. */
  dessin: "espaces" | "pile" | "cartes" | "fee" | "fin";
  titre: string;
  texte: string;
  picto: NomIcone;
  /** Les cartes d'exemple de la page, deux au plus. */
  exemples?: readonly ExempleGuide[];
}

/**
 * `fee` : le nom de la fée sur ce téléphone (Tael, Navi). Réécrit en 0.1.21 (axe « sans effet
 * IA ») : un titre qui dit ce que Kora fait, une idée par page, un exemple de la vie du foyer.
 * `VERSION_GUIDE` ne change pas : un téléphone qui l'a vu ne le revoit pas pour une retouche de texte.
 */
export function pagesGuide(fee: string): readonly PageGuide[] {
  return [
    { dessin: "espaces", picto: "espaces", titre: "Kora tient la maison à deux", texte: "Les courses, les repas, les tâches, l'agenda et le budget, les mêmes sur vos deux iPhone.", exemples: [{ etiquette: "Courses", texte: "Lait, pain, parmesan", detail: "Ajouté par l'autre à l'instant" }] },
    { dessin: "pile", picto: "haut", titre: "Tout part du rond", texte: "En bas à gauche. Il ouvre chaque espace, et un point laiton dit où quelque chose attend. Sur l'iPad, les espaces sont dans le rail à gauche." },
    { dessin: "cartes", picto: "coche", titre: "Le laiton, c'est aujourd'hui", texte: "Une seule carte en laiton par page : ce qui attend maintenant. L'ivoire, c'est demain. Touche une carte, elle devient sa page.", exemples: [{ etiquette: "Maintenant", texte: "Sortir le carton", detail: "avant 19 h", ton: "forte" }, { etiquette: "Demain", texte: "Dentiste", detail: "9 h 30", ton: "contraste" }] },
    { dessin: "fee", picto: "jarvis", titre: `Dis-le à ${fee}, une fois`, texte: `« Lait, pain, et sortir les poubelles jeudi. » Touche son orbe, parle : elle range chaque chose à sa place et te laisse annuler.`, exemples: [{ etiquette: `${fee} a fait`, texte: "Deux courses, une tâche jeudi", detail: "Annuler" }] },
    { dessin: "fin", picto: "sourire", titre: "Commence par une phrase", texte: "Ta première course, une tâche pour demain, ou ce qu'on mange ce soir. Le reste vient avec les jours." },
  ];
}

/** Le guide se montre tant que ce téléphone n'a pas vu la version en cours. */
export const guideAMontrer = (vu: string | null): boolean => vu !== VERSION_GUIDE;
