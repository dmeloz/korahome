import { useEffect, useRef, type RefObject } from "react";

// Le focus d'une feuille (Kora 0.1.11, lot 8 du check) : tant qu'elle est ouverte, Tab tourne dedans au lieu
// de filer sur la page dessous, Échap la ferme, et en se fermant elle rend le focus au bouton qui l'a ouverte.
// VoiceOver et un clavier branché à l'iPad s'y retrouvent ; au doigt, rien ne change.

const ATTEIGNABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Les feuilles ouvertes, la dernière au-dessus : elle seule répond au clavier. */
const ouvertes: HTMLElement[] = [];

/**
 * Garde le focus dans `zone` tant que `ouvert`. `fermer` : ce que fait Échap (null : la touche ne ferme rien).
 * La zone porte `tabIndex={-1}` pour recevoir le focus à l'ouverture.
 */
export function usePiegeFocus(ouvert: boolean, zone: RefObject<HTMLElement | null>, fermer: (() => void) | null): void {
  const echap = useRef(fermer);
  useEffect(() => {
    echap.current = fermer;
  });
  useEffect(() => {
    const el = zone.current;
    if (!ouvert || !el) return;
    const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ouvertes.push(el);
    // Le focus entre dans la feuille, sauf si un champ à elle l'a déjà pris.
    if (!el.contains(document.activeElement)) el.focus({ preventScroll: true });
    const touche = (e: KeyboardEvent) => {
      if (ouvertes[ouvertes.length - 1] !== el) return;
      if (e.key === "Escape") {
        if (!echap.current) return;
        e.stopPropagation();
        echap.current();
        return;
      }
      if (e.key !== "Tab") return;
      const liste = [...el.querySelectorAll<HTMLElement>(ATTEIGNABLES)].filter((x) => x.getClientRects().length > 0);
      const actif = document.activeElement;
      const dedans = actif instanceof Node && el.contains(actif) && actif !== el;
      if (!liste.length) {
        e.preventDefault();
        el.focus({ preventScroll: true });
      } else if (e.shiftKey ? !dedans || actif === liste[0] : !dedans || actif === liste[liste.length - 1]) {
        e.preventDefault();
        (e.shiftKey ? liste[liste.length - 1] : liste[0]).focus();
      }
    };
    document.addEventListener("keydown", touche, true);
    return () => {
      document.removeEventListener("keydown", touche, true);
      const i = ouvertes.lastIndexOf(el);
      if (i >= 0) ouvertes.splice(i, 1);
      // Un champ de saisie ne reprend pas le focus : sur l'iPhone, le clavier remonterait.
      if (avant?.isConnected && !avant.matches("input, textarea, select, [contenteditable]")) avant.focus({ preventScroll: true });
    };
  }, [ouvert, zone]);
}
