// Le guide de première ouverture (Kora 0.1.1, demande de Melo du 4 novembre 2026) : cinq pages
// qui disent comment Kora se tient, montrées une fois par téléphone quand il ouvre une version
// qui a changé d'allure, et à un foyer neuf. Ce qui s'y dit est ici ; la pièce (ui/pieces/Guide)
// ne fait que l'afficher.

import type { NomIcone } from "../ui/Icone";

/** La version du guide : un téléphone qui a vu celle-ci ne le revoit pas. À changer quand l'allure change. */
export const VERSION_GUIDE = "0.1";

export interface PageGuide {
  /** Ce que la page illustre : la navigation, les cartes, la fée, l'arrivée, la fin. */
  dessin: "espaces" | "pile" | "cartes" | "fee" | "fin";
  titre: string;
  texte: string;
  picto: NomIcone;
}

/** `fee` : le nom de la fée sur ce téléphone (Tael, Navi). */
export function pagesGuide(fee: string): readonly PageGuide[] {
  return [
    { dessin: "espaces", picto: "espaces", titre: "Bienvenue dans Kora", texte: "Six espaces, chacun sur une page de cartes : Aujourd'hui, Cuisine, Maison, Organisation, Budget et les Réglages." },
    { dessin: "pile", picto: "haut", titre: "Un seul bouton", texte: "Le rond en bas à gauche déploie les six espaces. Sur l'iPad et l'iPhone déplié, ils sont dans le rail à gauche." },
    { dessin: "cartes", picto: "coche", titre: "Les cartes", texte: "La carte en laiton dit ce qui presse, l'ivoire ce qu'il faut retenir. Coche les courses et les tâches d'ici ; une carte s'ouvre en sa page." },
    { dessin: "fee", picto: "jarvis", titre: `${fee} vient à toi`, texte: `Son orbe est à côté du salut et en haut de chaque page. Un toucher : elle écoute. Un appui long : ce qu'elle fait seule, et de quoi l'annuler.` },
    { dessin: "fin", picto: "sourire", titre: "C'est à vous", texte: "Dis-lui la première course, la première tâche, ce qu'on mange ce soir. Le reste vient avec les jours." },
  ];
}

/** Le guide se montre tant que ce téléphone n'a pas vu la version en cours. */
export const guideAMontrer = (vu: string | null): boolean => vu !== VERSION_GUIDE;
