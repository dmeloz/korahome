import { useDragControls, type PanInfo } from "motion/react";
import { useEffect, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { vibrer } from "./haptique";
import { m, Presence } from "./moteur/pieces";
import { ressortMotion } from "./moteur/ressorts";

// La feuille de l'iPhone : tout ce qui s'ouvre par-dessus une page (un formulaire, un
// détail, une question) monte du bas de l'écran, toujours de la même façon. On la ferme
// en touchant le voile, avec son bouton, ou en la tirant vers le bas par sa poignée :
// elle suit le doigt, et un geste vif suffit (le ressort « feuille » du moteur).

/** Au-delà de ce déplacement (ou d'un geste vif), la feuille tirée vers le bas se ferme. */
const SEUIL_FERMETURE = 110;
/** La vitesse d'un geste vif vers le bas, en pixels par seconde. */
const VITESSE_FERMETURE = 600;

export function Feuille(props: {
  ouverte: boolean;
  onFermer: () => void;
  titre?: string;
  /** Une question (supprimer, changer de personne) : pas de bouton OK, ses propres boutons. */
  alerte?: boolean;
  /** Le libellé du bouton du haut, « OK » par défaut. */
  fermer?: string;
  className?: string;
  children: ReactNode;
}) {
  const tirer = useDragControls();

  // La page dessous ne défile plus tant que la feuille est ouverte.
  useEffect(() => {
    if (!props.ouverte) return;
    document.documentElement.classList.add("feuille-ouverte");
    return () => document.documentElement.classList.remove("feuille-ouverte");
  }, [props.ouverte]);

  const debut = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    tirer.start(e);
  };
  const lacher = (_: unknown, info: PanInfo) => {
    if (info.offset.y > SEUIL_FERMETURE || (info.offset.y > 30 && info.velocity.y > VITESSE_FERMETURE)) {
      vibrer();
      props.onFermer();
    }
  };

  // Pendant la descente, la feuille garde ce qu'elle montrait : Presence garde son dernier rendu.
  return createPortal(
    <Presence>
      {props.ouverte && (
        <m.div
          key="voile"
          className="voile"
          onClick={props.onFermer}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: "none" }}
          transition={ressortMotion("feuille")}
        >
          <m.div
            className={`feuille${props.alerte ? " feuille-alerte" : ""}${props.className ? ` ${props.className}` : ""}`}
            role={props.alerte ? "alertdialog" : "dialog"}
            aria-modal
            aria-label={props.titre}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={ressortMotion("feuille")}
            drag="y"
            dragControls={tirer}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 1 }}
            onDragEnd={lacher}
          >
            <div className="feuille-prise" onPointerDown={debut}>
              <div className="poignee" aria-hidden />
              {props.titre && !props.alerte && (
                <div className="feuille-entete">
                  <h2>{props.titre}</h2>
                  <button className="lien" onClick={props.onFermer}>{props.fermer ?? "OK"}</button>
                </div>
              )}
            </div>
            <div className="feuille-corps">{props.children}</div>
          </m.div>
        </m.div>
      )}
    </Presence>,
    document.body,
  );
}
