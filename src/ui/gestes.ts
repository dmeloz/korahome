// Les gestes de l'iPhone, en règles simples et testées : glisser depuis le bord
// gauche pour revenir, glisser une ligne vers la gauche pour la supprimer, vers la droite
// pour la marquer faite (cochée, prise).

/** Un geste qui part à moins de 24 px du bord gauche est un retour. */
export const BORD_RETOUR = 24;
/** En dessous de 8 px, on ne sait pas encore si le doigt part de côté ou fait défiler. */
const SEUIL_DIRECTION = 8;
/** La largeur du bouton « Supprimer » révélé derrière une ligne. */
export const LARGEUR_ACTION = 104;

export type Direction = "horizontale" | "verticale";

/** La direction d'un geste, une fois qu'il a assez bougé pour la connaître. */
export function directionGeste(dx: number, dy: number): Direction | null {
  if (Math.hypot(dx, dy) < SEUIL_DIRECTION) return null;
  return Math.abs(dx) > Math.abs(dy) ? "horizontale" : "verticale";
}

/** Vitesse en px par ms ; une durée nulle compte pour 1 ms. */
const vitesse = (dx: number, duree: number) => dx / Math.max(duree, 1);

/**
 * Revenir à la page précédente : le doigt a parcouru plus d'un tiers de l'écran,
 * ou il a été lancé vers la droite d'un geste vif.
 */
export function finRetour(dx: number, duree: number, largeur: number): boolean {
  return dx > largeur * 0.35 || (dx > 40 && vitesse(dx, duree) > 0.5);
}

export type FinLigne = "fermer" | "ouvrir" | "supprimer";

/**
 * Ce que devient une ligne au lâcher, d'après sa position (négative vers la gauche) :
 * tirée au-delà de la moitié, elle part comme dans Mail ; à moitié du bouton, elle
 * reste ouverte sur « Supprimer » ; sinon elle se referme. Un geste vif vers la gauche
 * l'ouvre, vers la droite la ferme.
 */
export function finLigne(position: number, deplacement: number, duree: number, largeur: number): FinLigne {
  if (position <= -largeur * 0.55) return "supprimer";
  const v = vitesse(deplacement, duree);
  if (v < -0.5) return "ouvrir";
  if (v > 0.5) return "fermer";
  return position < -LARGEUR_ACTION / 2 ? "ouvrir" : "fermer";
}

/**
 * La position d'une ligne pendant le geste : jamais au-delà de sa largeur vers la gauche ;
 * vers la droite seulement quand la ligne sait être « faite », et jusqu'à mi-largeur.
 */
export function borner(position: number, largeur: number, versLaDroite = false): number {
  return Math.min(versLaDroite ? largeur * 0.5 : 0, Math.max(-largeur, position));
}

/** Tirée vers la droite au-delà d'un quart, ou lancée d'un geste vif : la ligne est faite. */
export function finFait(position: number, duree: number, largeur: number): boolean {
  return position >= largeur * 0.25 || (position > 40 && vitesse(position, duree) > 0.5);
}
