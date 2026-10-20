import type { MouseEvent, PointerEvent } from "react";

// Un petit bouton qui répond dès que le doigt se lève, sans attendre le « click » que Safari
// fabrique ensuite : sur l'iPhone, ce click se perdait sur les ronds de l'accueil et les petits
// signes du haut. Le click qui suit est alors ignoré, pour ne pas agir deux fois ; seul, il sert
// encore au clavier et à VoiceOver.

/** Au-delà, le doigt a glissé : ce n'est plus un toucher. */
const TOLERANCE_PX = 10;
/** Au-delà, c'est un appui long, laissé à qui l'écoute. */
const DUREE_MAX_MS = 450;

interface Etat {
  depart: { x: number; y: number; t: number } | null;
  dejaFait: boolean;
}

// Rangé sur le bouton lui-même : un nouveau rendu entre le doigt posé et levé ne perd rien.
const etats = new WeakMap<Element, Etat>();
const etatDe = (el: Element): Etat => {
  let e = etats.get(el);
  if (!e) etats.set(el, (e = { depart: null, dejaFait: false }));
  return e;
};

export function toucherFiable(agir: () => void) {
  return {
    onPointerDown: (e: PointerEvent) => {
      etatDe(e.currentTarget).depart = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY, t: e.timeStamp };
    },
    onPointerUp: (e: PointerEvent) => {
      const etat = etatDe(e.currentTarget);
      const d = etat.depart;
      etat.depart = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > TOLERANCE_PX || e.timeStamp - d.t > DUREE_MAX_MS) return;
      etat.dejaFait = true;
      // Si Safari n'envoie pas de click, le prochain toucher ne doit pas être avalé.
      setTimeout(() => (etat.dejaFait = false), 700);
      agir();
    },
    onPointerCancel: (e: PointerEvent) => {
      etatDe(e.currentTarget).depart = null;
    },
    onClick: (e: MouseEvent) => {
      const etat = etatDe(e.currentTarget);
      if (etat.dejaFait) {
        etat.dejaFait = false;
        e.preventDefault();
        return;
      }
      agir();
    },
  };
}
