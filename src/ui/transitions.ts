import { flushSync } from "react-dom";
import { ignorer } from "./journal";

// Le passage d'une page à l'autre glisse comme sur l'iPhone : la nouvelle page arrive par
// la droite, le retour la ramène par la gauche (View Transitions de Safari 18).
// Un widget de l'accueil, lui, grandit jusqu'à devenir sa page, et la page y rentre au retour,
// comme une app qui s'ouvre sur l'iPhone (le mouvement « widget » du moteur, styles/base.css).

export type Sens = "avant" | "arriere";

/** Le nom partagé par le widget et sa page pendant la transition. */
const NOM_WIDGET = "widget-page";

/** Pour un widget qui s'ouvre en page (ou une page qui rentre dans son widget) : l'élément
 *  de départ, avant le changement, et celui d'arrivée, cherché après. */
export interface Metamorphose {
  depart: () => Element | null;
  arrivee: () => Element | null;
}

const nommer = (el: Element | null, nom: string) => {
  if (el instanceof HTMLElement) el.style.viewTransitionName = nom;
};

// Moins d'animations demandées dans l'iPhone : un fondu à la place du glissement.

export function avecTransition(sens: Sens, changer: () => void, metamorphose?: Metamorphose): void {
  const doc = document as Document & { startViewTransition?: (maj: () => void) => TransitionDeVue };
  const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition) {
    changer();
    return;
  }
  const depart = !reduit && metamorphose ? visible(metamorphose.depart()) : null;
  // Moins d'animations demandées : un simple fondu, sans glissement.
  document.documentElement.dataset.sens = reduit ? "fondu" : depart ? "widget" : sens;
  if (!depart) {
    sansAccroc(doc.startViewTransition(() => flushSync(changer)));
    return;
  }
  nommer(depart, NOM_WIDGET);
  let arrivee: Element | null = null;
  const transition = doc.startViewTransition(() => {
    // Un seul élément porte le nom à la fois : le départ le rend avant que l'arrivée le prenne.
    nommer(depart, "");
    flushSync(changer);
    arrivee = metamorphose!.arrivee();
    nommer(arrivee, NOM_WIDGET);
  });
  sansAccroc(transition);
  void transition.finished.catch(ignorer).finally(() => nommer(arrivee, ""));
}

interface TransitionDeVue {
  ready: Promise<void>;
  finished: Promise<void>;
}

// Une transition interrompue (l'écran tourne, une autre commence) rejette ses promesses : la page
// a déjà changé, on le note seulement au journal au lieu d'une erreur non rattrapée.
function sansAccroc(transition: TransitionDeVue): void {
  transition.ready.catch(ignorer);
  transition.finished.catch(ignorer);
}

/** Un widget hors de l'écran ne se métamorphose pas : la page glisse comme d'habitude. */
function visible(el: Element | null): Element | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight && r.width > 0 ? el : null;
}
