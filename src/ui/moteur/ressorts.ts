// Les mouvements de Kora, tous nommés ici : Motion et Anime.js lisent la même table, pour que
// tout bouge de la même façon dans l'app. Un ressort se dit comme sur l'iPhone : un rebond
// (0 = aucun, 1 = beaucoup) et une durée perçue en millisecondes.
// Équivalent natif : .spring(duration: duree / 1000, bounce: rebond) dans SwiftUI.

export const RESSORTS = {
  /** La fée lâchée : un rebond franc, comme un objet qu'on lance. */
  fee: { bounce: 0.35, duration: 450 },
  /** Une ligne qui glisse, se range ou laisse sa place. */
  ligne: { bounce: 0.15, duration: 350 },
  /** Une barre de graphique qui monte. */
  barre: { bounce: 0.25, duration: 500 },
  /** Une feuille qui monte du bas ou y retourne. */
  feuille: { bounce: 0.12, duration: 420 },
  /** Ce qui apparaît ou s'en va : bulles, messages, éléments d'une liste. */
  apparition: { bounce: 0.2, duration: 300 },
  /** Le repère d'un onglet qui glisse à sa nouvelle place. */
  onglet: { bounce: 0.18, duration: 320 },
  /** Un widget qui s'ouvre en page. */
  widget: { bounce: 0.14, duration: 480 },
} as const;

export type NomRessort = keyof typeof RESSORTS;

/** Le même ressort, écrit pour Motion. */
export function ressortMotion(nom: NomRessort) {
  const r = RESSORTS[nom];
  return { type: "spring" as const, bounce: r.bounce, visualDuration: r.duration / 1000 };
}

export const moinsDAnimations = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
