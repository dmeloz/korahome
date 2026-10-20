import { useEffect, useRef } from "react";
import { spring } from "animejs/easings/spring";
import { stagger } from "animejs/utils";
import { waapi } from "animejs/waapi";

// Le mouvement de Kora, avec Anime.js (seul fichier qui l'importe) :
// - les ressorts : la fée lâchée et les lignes qui reviennent rebondissent comme sur l'iPhone.
//   Ils sont donnés aux styles en variables CSS (--ressort-*), sous forme de courbe linear() ;
// - les graphiques qui se dessinent : un trait marqué data-dessin se trace, les éléments
//   data-cascade montent l'un après l'autre, data-apparait arrive en fondu.
// Si l'iPhone demande moins d'animations, rien ne rebondit ni ne se dessine.
// Équivalents natifs : .spring(duration:bounce:) et .trim(from:to:) animé dans SwiftUI.

const RESSORTS = {
  /** La fée lâchée : un rebond franc, comme un objet qu'on lance. */
  fee: { bounce: 0.35, duration: 450 },
  /** Une ligne qui se referme ou s'ouvre : un rebond léger. */
  ligne: { bounce: 0.15, duration: 350 },
  /** Une barre de graphique qui monte. */
  barre: { bounce: 0.25, duration: 500 },
} as const;

type NomRessort = keyof typeof RESSORTS;

const moinsDAnimations = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** La courbe CSS d'un ressort et sa durée réelle (jusqu'à l'arrêt). */
export function courbeRessort(nom: NomRessort, points = 60): { courbe: string; duree: number } {
  const r = spring(RESSORTS[nom]);
  const valeurs = Array.from({ length: points + 1 }, (_, i) => Number(r.ease(i / points).toFixed(4)));
  valeurs[points] = 1;
  return { courbe: `linear(${valeurs.join(", ")})`, duree: Math.round(r.settlingDuration) };
}

/** Donne les ressorts aux styles. Sans linear() (vieux Safari), les styles gardent leur courbe d'avant. */
export function installerRessorts(racine: HTMLElement = document.documentElement): void {
  if (typeof CSS === "undefined" || !CSS.supports?.("transition-timing-function", "linear(0, 1)")) return;
  for (const nom of Object.keys(RESSORTS) as NomRessort[]) {
    const { courbe, duree } = courbeRessort(nom);
    racine.style.setProperty(`--ressort-${nom}`, courbe);
    racine.style.setProperty(`--ressort-${nom}-duree`, `${duree}ms`);
  }
}

/** Dessine un graphique à son arrivée. Les traits data-dessin ont pathLength="1" (styles/pieces.css). */
export function dessinerGraphique(boite: Element | null): void {
  if (!boite || moinsDAnimations() || typeof Element.prototype.animate !== "function") return;
  const traits = boite.querySelectorAll<SVGGeometryElement>("[data-dessin]");
  const cascade = boite.querySelectorAll<HTMLElement | SVGElement>("[data-cascade]");
  const fondus = boite.querySelectorAll<HTMLElement | SVGElement>("[data-apparait]");
  if (traits.length) waapi.animate(traits, { strokeDashoffset: [1, 0], duration: 900, ease: "out(3)" });
  if (cascade.length) {
    const { duree } = courbeRessort("barre");
    waapi.animate(cascade, { transform: ["scaleY(0)", "scaleY(1)"], transformOrigin: ["50% 100%", "50% 100%"], duration: duree, delay: stagger(35), ease: spring(RESSORTS.barre).ease });
  }
  if (fondus.length) waapi.animate(fondus, { opacity: [0, 1], duration: 500, delay: 250, ease: "out(2)" });
}

/** Le graphique se dessine une fois, à l'ouverture de la page. */
export function useDessin<T extends Element>() {
  const ref = useRef<T>(null);
  useEffect(() => dessinerGraphique(ref.current), []);
  return ref;
}
