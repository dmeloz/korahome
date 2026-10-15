import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { BORD_RETOUR, LARGEUR_ACTION, borner, directionGeste, finLigne } from "./gestes";

// Une ligne qu'on glisse vers la gauche, comme dans Mail : le bouton « Supprimer »
// apparaît derrière, et tirée jusqu'au bout elle part toute seule. Une seule ligne
// ouverte à la fois ; toucher ailleurs la referme.

const OUVERTURE = "korahome:ligne-ouverte";

export function Glissable(props: { children: ReactNode; onSupprimer: () => void; libelle?: string; className?: string }) {
  const id = useId();
  const boite = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);
  const [glisse, setGlisse] = useState(false);
  const [partie, setPartie] = useState(false);
  const geste = useRef<{ x: number; y: number; t: number; base: number; mode: "?" | "h" } | null>(null);
  // Jusqu'à quand ignorer le clic qui suit un glissement (le navigateur ne l'envoie pas toujours).
  const ignorerClic = useRef(0);
  const positionCourante = useRef(0);
  positionCourante.current = position;

  // Une autre ligne s'ouvre, ou on touche ailleurs : celle-ci se referme.
  useEffect(() => {
    const autre = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setPosition(0);
    };
    const ailleurs = (e: globalThis.PointerEvent) => {
      if (positionCourante.current !== 0 && !boite.current?.contains(e.target as Node)) setPosition(0);
    };
    window.addEventListener(OUVERTURE, autre);
    window.addEventListener("pointerdown", ailleurs, true);
    return () => {
      window.removeEventListener(OUVERTURE, autre);
      window.removeEventListener("pointerdown", ailleurs, true);
    };
  }, [id]);

  const largeur = () => boite.current?.offsetWidth ?? 360;

  function supprimer() {
    setGlisse(false);
    setPosition(-largeur());
    setPartie(true);
    setTimeout(props.onSupprimer, 180);
  }

  function debut(e: PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.clientX <= BORD_RETOUR) return; // le bord gauche sert à revenir
    geste.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, base: position, mode: "?" };
  }

  function mouvement(e: PointerEvent) {
    const g = geste.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    if (g.mode === "?") {
      const direction = directionGeste(dx, e.clientY - g.y);
      // Vers la droite sur une ligne fermée : c'est le retour à la page précédente, pas la ligne.
      if (direction === "verticale" || (direction === "horizontale" && dx > 0 && g.base === 0)) geste.current = null;
      if (direction !== "horizontale" || !geste.current) return;
      g.mode = "h";
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      window.dispatchEvent(new CustomEvent(OUVERTURE, { detail: id }));
    }
    setGlisse(true);
    setPosition(borner(g.base + dx, largeur()));
  }

  function fin(e: PointerEvent) {
    const g = geste.current;
    geste.current = null;
    if (!g || g.mode !== "h") return;
    ignorerClic.current = performance.now() + 400;
    setGlisse(false);
    const dx = e.clientX - g.x;
    const issue = finLigne(borner(g.base + dx, largeur()), dx, e.timeStamp - g.t, largeur());
    if (issue === "supprimer") supprimer();
    else setPosition(issue === "ouvrir" ? -LARGEUR_ACTION : 0);
  }

  return (
    <div ref={boite} className={`glissable${partie ? " partie" : ""}${position ? " ouverte" : ""}`}>
      <button
        className="glissable-action"
        tabIndex={position === 0 ? -1 : 0}
        aria-hidden={position === 0}
        onClick={supprimer}
        style={{ width: Math.max(LARGEUR_ACTION, -position) }}
      >
        {props.libelle ?? "Supprimer"}
      </button>
      <div
        className={`glissable-contenu${glisse ? " glisse" : ""}${props.className ? ` ${props.className}` : ""}`}
        style={{ transform: position ? `translateX(${position}px)` : undefined }}
        onPointerDown={debut}
        onPointerMove={mouvement}
        onPointerUp={fin}
        onPointerCancel={() => {
          geste.current = null;
          setGlisse(false);
          setPosition((p) => (p < -LARGEUR_ACTION / 2 ? -LARGEUR_ACTION : 0));
        }}
        onClickCapture={(e) => {
          // Le clic qui suit un glissement ne coche rien ; sur une ligne ouverte, il la referme.
          const apresGlissement = performance.now() < ignorerClic.current;
          if (!apresGlissement && position === 0) return;
          e.stopPropagation();
          e.preventDefault();
          ignorerClic.current = 0;
          if (!apresGlissement && !partie) setPosition(0);
        }}
      >
        {props.children}
      </div>
    </div>
  );
}
