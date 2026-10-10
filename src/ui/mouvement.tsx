import { ViewTransition, addTransitionType, startTransition, type ReactNode } from "react";

// Les deux sortes de mouvement de KoraHome, en plus du glissement entre écrans
// (App.tsx). Toutes passent par les View Transitions : sans elles (Safari avant
// la 18), l'écran change simplement d'un coup. Les durées sont dans styles.css.

/** Le type des transitions déclenchées par un changement de contenu dans l'écran. */
export const CONTENU = "contenu";

/** Applique un changement d'état comme un changement de contenu animé. */
export function changerContenu(changer: () => void) {
  startTransition(() => {
    addTransitionType(CONTENU);
    changer();
  });
}

const surContenu = { [CONTENU]: CONTENU, default: "none" };

/** Un nom de transition valide en CSS, même à partir d'un libellé comme « Fruits et légumes ». */
const nomValide = (nom: string) => nom.replace(/[^\p{L}\p{N}_-]/gu, "_");

/**
 * Un élément de liste : quand le contenu change, il glisse jusqu'à sa nouvelle
 * place (même d'une section à l'autre), apparaît ou s'efface. Pendant un
 * changement d'écran, il suit simplement l'écran.
 */
export function Glisse({ nom, children }: { nom: string; children: ReactNode }) {
  return (
    <ViewTransition name={nomValide(nom)} default="none" update={surContenu} enter={surContenu} exit={surContenu} share={surContenu}>
      {children}
    </ViewTransition>
  );
}

/** Un libellé qui devient le titre de l'écran qu'il ouvre, et inversement au retour. */
export function TitreLie({ nom, children }: { nom: string; children: ReactNode }) {
  return (
    <ViewTransition name={nomValide(nom)} share="titre-lie" default="none">
      {children}
    </ViewTransition>
  );
}
