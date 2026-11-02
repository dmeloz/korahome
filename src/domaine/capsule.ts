// La capsule vivante (0.0.100, refonte de l'interface validée par Melo le 2 novembre 2026) :
// la barre du bas réinventée. Ce n'est pas une rangée d'onglets mais un seul objet, comme la
// Dynamic Island : il dit ce qui compte maintenant dans la vue où l'on est (« Poubelles, avant
// 19 h »), avec un fil laiton qui avance vers l'heure. On glisse dessus pour passer d'une vue à
// l'autre (Aujourd'hui, Courses, Nous), on la touche pour ouvrir ce qu'elle dit, on la pousse vers
// le haut pour « Tout Kora ». Elle prend la couleur de l'autre quand l'autre coche les courses en
// direct, ou quand un mot de l'autre attend. Ce fichier dit quoi afficher ; l'écran le dessine.

import type { ChoseDuJour } from "./aujourdhui";
import type { Mot } from "./bandeau";
import type { Element } from "./types";

export type VueCapsule = "aujourdhui" | "courses" | "nous";
export const VUES_CAPSULE: readonly VueCapsule[] = ["aujourdhui", "courses", "nous"];
export const LIBELLES_VUES: Record<VueCapsule, string> = { aujourdhui: "Aujourd'hui", courses: "Courses", nous: "Nous" };

/** « Glisse pour changer » : les trois premières fois seulement. */
export const ASTUCE_CAPSULE_FOIS = 3;
/** Le fil part trois heures avant l'heure d'une chose et arrive plein à l'heure. */
export const FIL_MINUTES = 180;

export interface EtatCapsule {
  /** La petite ligne du haut : « Ce soir · à toi », « Courses · Sarah coche en direct ». */
  petit: string;
  /** La grande ligne : ce qui compte maintenant. */
  grand: string;
  /** De 0 à 1 : le fil laiton. */
  progression: number;
  /** « autre » : la capsule prend la couleur de l'autre (sa fée). */
  ton: "fee" | "autre";
}

/** La vue d'à côté, sans faire le tour : au bout, on reste au bout. */
export function vueVoisine(vue: VueCapsule, sens: 1 | -1): VueCapsule {
  const i = VUES_CAPSULE.indexOf(vue) + sens;
  return VUES_CAPSULE[Math.max(0, Math.min(VUES_CAPSULE.length - 1, i))];
}

const minutes = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const borner = (n: number) => Math.max(0, Math.min(1, n));
const majuscule = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** Le fil vers une heure : vide trois heures avant, plein à l'heure et après. */
export function progressionVers(maintenant: string, heure: string): number {
  return borner(1 - (minutes(heure) - minutes(maintenant)) / FIL_MINUTES);
}

/** Aujourd'hui : la première chose du jour, sinon le menu du soir, sinon le calme. */
export function capsuleAujourdhui(choses: readonly ChoseDuJour[], menu: string | null, maintenant: string): EtatCapsule {
  const premiere = choses[0];
  if (premiere) {
    const reste = choses.length - 1;
    return {
      petit: [majuscule(premiere.quand) || "Aujourd'hui", reste ? `puis ${reste} autre${reste > 1 ? "s" : ""}` : null].filter(Boolean).join(" · "),
      grand: premiere.texte,
      progression: premiere.etat === "urgent" ? 1 : premiere.heure ? progressionVers(maintenant, premiere.heure) : 0.5,
      ton: "fee",
    };
  }
  if (menu) return { petit: "Ce soir", grand: menu, progression: 1, ton: "fee" };
  return { petit: "Aujourd'hui", grand: "Rien ne presse", progression: 1, ton: "fee" };
}

/** Courses : ce qui reste à prendre ; à la couleur de l'autre quand il ou elle coche en ce moment. */
export function capsuleCourses(elements: readonly Pick<Element, "coche">[], autreEnDirect: string | null): EtatCapsule {
  const total = elements.length;
  const reste = elements.filter((e) => !e.coche).length;
  const petit = autreEnDirect ? `Courses · ${autreEnDirect} coche en direct` : "Courses";
  const ton = autreEnDirect ? "autre" : "fee";
  if (total === 0) return { petit, grand: "Liste vide", progression: 0, ton };
  if (reste === 0) return { petit, grand: "Tout est pris", progression: 1, ton };
  return { petit, grand: `Encore ${reste} à prendre`, progression: (total - reste) / total, ton };
}

export const LONGUEUR_EXTRAIT = 38;

/** Le début d'un mot, coupé à un espace : « Pense au parmesan en… ». */
export function extrait(texte: string, longueur = LONGUEUR_EXTRAIT): string {
  const t = texte.trim().replace(/\s+/g, " ");
  if (t.length <= longueur) return t;
  const coupe = t.slice(0, longueur);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > longueur / 2 ? coupe.slice(0, espace) : coupe).replace(/[\s,.;:!?]+$/, "")}…`;
}

/** Nous : le dernier mot de l'autre tant qu'on n'y a pas répondu d'un cœur, sinon l'invitation à écrire. */
export function capsuleNous(mot: Pick<Mot, "texte"> | null, coeurDonne: boolean, autre: string | null): EtatCapsule {
  if (mot && !coeurDonne) return { petit: `${autre ?? "L'autre"} t'a écrit`, grand: `« ${extrait(mot.texte)} »`, progression: 1, ton: "autre" };
  return { petit: "Nous", grand: autre ? `Écrire à ${autre}` : "Nos mots", progression: mot ? 1 : 0, ton: "fee" };
}
