import type { ReactNode } from "react";
import { Icone, type NomIcone } from "../Icone";

/**
 * Ce qu'une page montre quand elle n'a encore rien (0.0.84) : un pictogramme au trait dans un rond
 * laiton doux, un titre, une ligne qui dit quoi faire, et au plus une action. Le même partout, pour
 * qu'une page vide ne ressemble jamais à une page cassée. Équivalent SwiftUI : ContentUnavailableView.
 */
export function EtatVide({ picto, titre, children, action }: { picto: NomIcone; titre: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <section className="etat-vide" aria-label={titre}>
      <span className="etat-vide-picto">
        <Icone nom={picto} taille={22} />
      </span>
      <p className="etat-vide-titre">{titre}</p>
      {children && <p className="etat-vide-texte">{children}</p>}
      {action}
    </section>
  );
}
