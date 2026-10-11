import { flushSync } from "react-dom";

// Le passage d'une page à l'autre glisse comme sur l'iPhone : la nouvelle page arrive par
// la droite, le retour la ramène par la gauche (View Transitions de Safari 18).

export type Sens = "avant" | "arriere";

export function avecTransition(sens: Sens, changer: () => void): void {
  const doc = document as Document & { startViewTransition?: (maj: () => void) => unknown };
  const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduit) {
    changer();
    return;
  }
  document.documentElement.dataset.sens = sens;
  doc.startViewTransition(() => flushSync(changer));
}
