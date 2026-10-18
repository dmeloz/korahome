import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { vibrer } from "./haptique";

// La feuille de l'iPhone : tout ce qui s'ouvre par-dessus une page (un formulaire, un
// détail, une question) monte du bas de l'écran, toujours de la même façon. On la ferme
// en touchant le voile, avec son bouton, ou en la tirant vers le bas par sa poignée.

/** Au-delà de ce déplacement (ou d'un geste vif), la feuille tirée vers le bas se ferme. */
const SEUIL_FERMETURE = 110;
/** La durée de la descente, en ms : celle de l'animation `feuille-descend`. */
const DUREE_SORTIE = 240;

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
  // Elle reste affichée le temps de descendre après la fermeture.
  const [presente, setPresente] = useState(props.ouverte);
  const [sortie, setSortie] = useState(false);
  const [tire, setTire] = useState(0);
  const geste = useRef<{ y: number; t: number } | null>(null);
  // Pendant la descente, la feuille garde ce qu'elle montrait (le produit choisi, la fiche…).
  const dernier = useRef({ titre: props.titre, contenu: props.children });
  if (props.ouverte) dernier.current = { titre: props.titre, contenu: props.children };
  const { titre, contenu } = dernier.current;

  useEffect(() => {
    if (props.ouverte) {
      setPresente(true);
      setSortie(false);
      setTire(0);
      return;
    }
    if (!presente) return;
    setSortie(true);
    const id = setTimeout(() => {
      setPresente(false);
      setSortie(false);
      setTire(0);
    }, DUREE_SORTIE);
    return () => clearTimeout(id);
  }, [props.ouverte]); // eslint-disable-line react-hooks/exhaustive-deps

  // La page dessous ne défile plus tant que la feuille est ouverte.
  useEffect(() => {
    if (!props.ouverte) return;
    document.documentElement.classList.add("feuille-ouverte");
    return () => document.documentElement.classList.remove("feuille-ouverte");
  }, [props.ouverte]);

  if (!presente) return null;

  const debut = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    geste.current = { y: e.clientY, t: e.timeStamp };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const mouvement = (e: PointerEvent<HTMLDivElement>) => {
    if (geste.current) setTire(Math.max(0, e.clientY - geste.current.y));
  };
  const fin = (e: PointerEvent<HTMLDivElement>) => {
    const g = geste.current;
    geste.current = null;
    if (!g) return;
    const dy = e.clientY - g.y;
    const vif = dy > 30 && dy / Math.max(e.timeStamp - g.t, 1) > 0.6;
    if (dy > SEUIL_FERMETURE || vif) {
      vibrer();
      props.onFermer();
    } else setTire(0);
  };

  return createPortal(
    <div className={`voile${sortie ? " sortie" : ""}`} onClick={props.onFermer}>
      <div
        className={`feuille${props.alerte ? " feuille-alerte" : ""}${tire ? " tiree" : ""}${props.className ? ` ${props.className}` : ""}`}
        role={props.alerte ? "alertdialog" : "dialog"}
        aria-modal
        aria-label={titre}
        style={tire ? { transform: `translateY(${tire}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="feuille-prise" onPointerDown={debut} onPointerMove={mouvement} onPointerUp={fin} onPointerCancel={fin}>
          <div className="poignee" aria-hidden />
          {titre && !props.alerte && (
            <div className="feuille-entete">
              <h2>{titre}</h2>
              <button className="lien" onClick={props.onFermer}>{props.fermer ?? "OK"}</button>
            </div>
          )}
        </div>
        <div className="feuille-corps">{contenu}</div>
      </div>
    </div>,
    document.body,
  );
}
