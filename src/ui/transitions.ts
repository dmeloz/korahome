import { flushSync } from "react-dom";

// Le passage d'une page à l'autre glisse comme sur l'iPhone : la nouvelle page arrive par
// la droite, le retour la ramène par la gauche (View Transitions de Safari 18).

export type Sens = "avant" | "arriere";

// Moins d'animations demandées dans l'iPhone : un fondu à la place du glissement.

export function avecTransition(sens: Sens, changer: () => void): void {
  const doc = document as Document & { startViewTransition?: (maj: () => void) => unknown };
  const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition) {
    changer();
    return;
  }
  // Moins d'animations demandées : un simple fondu, sans glissement.
  document.documentElement.dataset.sens = reduit ? "fondu" : sens;
  doc.startViewTransition(() => flushSync(changer));
}
