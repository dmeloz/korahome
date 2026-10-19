import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { BORD_RETOUR, LARGEUR_ACTION, borner, directionGeste, finFait, finLigne } from "./gestes";
import { vibrer } from "./haptique";

// Une ligne, avec les mêmes gestes partout (comme Mail et Rappels) :
// - vers la gauche, « Supprimer » apparaît derrière ; tirée jusqu'au bout, elle part seule ;
// - vers la droite (quand la ligne le permet), elle est faite : cochée, prise ;
// - un appui long ouvre son menu rapide (modifier, déplacer, donner à l'autre).
// Une seule ligne ouverte à la fois ; toucher ailleurs la referme.
// Équivalent natif : swipeActions(edge: .leading / .trailing) et contextMenu.

const OUVERTURE = "korahome:ligne-ouverte";
const APPUI_LONG_MS = 450;

export function Glissable(props: {
  children: ReactNode;
  onSupprimer: () => void;
  libelle?: string;
  /** Glisser vers la droite : la ligne est faite. */
  onFait?: () => void;
  libelleFait?: string;
  /** L'appui long : le menu rapide de la ligne. */
  onAppuiLong?: () => void;
  className?: string;
}) {
  const id = useId();
  const boite = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);
  const [glisse, setGlisse] = useState(false);
  const [partie, setPartie] = useState(false);
  const geste = useRef<{ x: number; y: number; t: number; base: number; mode: "?" | "h" } | null>(null);
  const appui = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Jusqu'à quand ignorer le clic qui suit un glissement (le navigateur ne l'envoie pas toujours).
  const ignorerClic = useRef(0);
  const positionCourante = useRef(0);
  positionCourante.current = position;
  const versLaDroite = !!props.onFait;

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
  const arreterAppui = () => {
    if (appui.current) clearTimeout(appui.current);
    appui.current = null;
  };

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
    arreterAppui();
    if (props.onAppuiLong && position === 0) {
      appui.current = setTimeout(() => {
        appui.current = null;
        geste.current = null;
        ignorerClic.current = performance.now() + 600;
        vibrer();
        props.onAppuiLong?.();
      }, APPUI_LONG_MS);
    }
  }

  function mouvement(e: PointerEvent) {
    const g = geste.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    if (g.mode === "?") {
      const direction = directionGeste(dx, e.clientY - g.y);
      if (direction) arreterAppui();
      // Vers la droite sur une ligne fermée qui ne sait pas être faite : c'est le retour à la page précédente.
      if (direction === "verticale" || (direction === "horizontale" && dx > 0 && g.base === 0 && !versLaDroite)) geste.current = null;
      if (direction !== "horizontale" || !geste.current) return;
      g.mode = "h";
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      window.dispatchEvent(new CustomEvent(OUVERTURE, { detail: id }));
    }
    setGlisse(true);
    setPosition(borner(g.base + dx, largeur(), versLaDroite));
  }

  function fin(e: PointerEvent) {
    arreterAppui();
    const g = geste.current;
    geste.current = null;
    if (!g || g.mode !== "h") return;
    ignorerClic.current = performance.now() + 400;
    setGlisse(false);
    const dx = e.clientX - g.x;
    const pos = borner(g.base + dx, largeur(), versLaDroite);
    if (pos > 0) {
      if (finFait(pos, e.timeStamp - g.t, largeur())) {
        vibrer();
        props.onFait?.();
      }
      setPosition(0);
      return;
    }
    const issue = finLigne(pos, dx, e.timeStamp - g.t, largeur());
    if (issue === "supprimer") supprimer();
    else setPosition(issue === "ouvrir" ? -LARGEUR_ACTION : 0);
  }

  return (
    <div ref={boite} className={`glissable${partie ? " partie" : ""}${position ? " ouverte" : ""}`} data-geste-propre={versLaDroite ? "" : undefined}>
      {versLaDroite && (
        <span className={`glissable-fait${position > largeur() * 0.25 ? " prete" : ""}`} aria-hidden style={{ width: Math.max(0, position) }}>
          {props.libelleFait ?? "Fait"}
        </span>
      )}
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
        onPointerLeave={arreterAppui}
        onContextMenu={props.onAppuiLong ? (e) => e.preventDefault() : undefined}
        onPointerCancel={() => {
          arreterAppui();
          geste.current = null;
          setGlisse(false);
          setPosition((p) => (p < -LARGEUR_ACTION / 2 ? -LARGEUR_ACTION : 0));
        }}
        onClickCapture={(e) => {
          // Le clic qui suit un glissement ou un appui long ne coche rien ; sur une ligne ouverte, il la referme.
          const apresGeste = performance.now() < ignorerClic.current;
          if (!apresGeste && position === 0) return;
          e.stopPropagation();
          e.preventDefault();
          ignorerClic.current = 0;
          if (!apresGeste && !partie) setPosition(0);
        }}
      >
        {props.children}
      </div>
    </div>
  );
}
