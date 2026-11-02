import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// La barre du mode « Choisir » (Courses depuis 0.0.70, Tâches depuis 0.0.99) : posée en bas de
// l'écran, au-dessus de la page, visible et touchable même quand la saisie de la fée est fermée.
// Équivalent natif : la barre d'outils du mode modification d'une List.
export function BarreChoix(props: { libelle: string; children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="barre-choix" role="toolbar" aria-label={props.libelle}>
      {props.children}
    </div>,
    document.body,
  );
}
