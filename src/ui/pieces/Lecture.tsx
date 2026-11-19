import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { pasSuivant } from "../../domaine/lecture";
import { vibrer } from "../haptique";

// La lecture au doigt (Kora 0.1.21) : le doigt posé sur un graphique choisit un point, la carte
// en dit la valeur, une vibration marque chaque nouveau point ; le doigt levé, elle revient au
// dernier chiffre. Les flèches font de même au clavier et avec VoiceOver. Règles dans
// domaine/lecture.ts.

/** `versIndex` reçoit la place du doigt de 0 (bord gauche) à 1 (bord droit) et rend l'index du point. */
export function useLecture<T extends Element>(n: number, versIndex: (part: number) => number) {
  const [index, setIndex] = useState(-1);
  const dernier = useRef(-1);
  const choisir = useCallback((i: number) => {
    if (i === dernier.current) return;
    dernier.current = i;
    if (i >= 0) vibrer();
    setIndex(i);
  }, []);
  const lire = (e: PointerEvent<T>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width > 0) choisir(versIndex((e.clientX - r.left) / r.width));
  };
  const lacher = () => choisir(-1);
  const props = {
    tabIndex: 0,
    style: { touchAction: "pan-y" as const },
    onPointerDown: (e: PointerEvent<T>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      lire(e);
    },
    onPointerMove: (e: PointerEvent<T>) => {
      if (e.pointerType === "mouse" || e.currentTarget.hasPointerCapture?.(e.pointerId)) lire(e);
    },
    onPointerUp: lacher,
    onPointerCancel: lacher,
    onPointerLeave: lacher,
    onBlur: lacher,
    onKeyDown: (e: KeyboardEvent<T>) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        choisir(pasSuivant(dernier.current, n, e.key === "ArrowRight" ? 1 : -1));
      } else if (e.key === "Escape") lacher();
    },
  };
  return { index, props };
}

/** Le viseur d'une courbe : un trait fin vertical et le point choisi. */
export function Viseur({ x, y, haut, bas }: { x: number; y: number; haut: number; bas: number }) {
  return (
    <g aria-hidden>
      <line x1={x} x2={x} y1={haut} y2={bas} className="viseur-trait" />
      <circle cx={x} cy={y} r={5} className="viseur-point" />
    </g>
  );
}
