import type { MouseEvent } from "react";
import { noter } from "./journal";

// Un petit bouton qui répond au doigt même quand Safari ne lui envoie rien. Sur l'iPhone, les
// ronds de l'accueil et les petits signes du haut ne recevaient ni « click » ni « pointerup » :
// les journaux de test ne montraient aucun toucher sur eux. On écoute donc le doigt sur toute la
// page (touchstart et touchend, que Safari envoie toujours) et on cherche quel bouton inscrit se
// trouve sous le point levé, d'après sa place à l'écran. Le « click » qui suit, s'il vient, est
// ignoré ; seul, il sert encore à la souris, au clavier et à VoiceOver.

/** Au-delà, le doigt a glissé : ce n'est plus un toucher. */
const TOLERANCE_PX = 10;
/** Au-delà, c'est un appui long, laissé à qui l'écoute. */
const DUREE_MAX_MS = 450;
/** Le click que Safari fabrique après un toucher déjà servi arrive dans ce délai. */
const GARDE_CLICK_MS = 700;

interface Inscrit {
  agir: () => void;
  /** Pixels ajoutés autour du bouton : un petit rond se touche un peu à côté. */
  marge: number;
  servi: number;
}

const inscrits = new Map<Element, Inscrit>();
let ecoute = false;
let depart: { x: number; y: number; t: number } | null = null;

const CONTROLE = "button, a, input, select, textarea, label, [role=button], [role=checkbox], [role=switch]";

/** Le bouton inscrit sous le point, le plus proche s'il y en a plusieurs. */
function inscritSous(x: number, y: number): [Element, Inscrit] | null {
  let meilleur: [Element, Inscrit] | null = null;
  let distance = Infinity;
  for (const [el, inscrit] of inscrits) {
    if (!el.isConnected) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const m = inscrit.marge;
    if (x < r.left - m || x > r.right + m || y < r.top - m || y > r.bottom + m) continue;
    const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    if (d < distance) {
      distance = d;
      meilleur = [el, inscrit];
    }
  }
  return meilleur;
}

function decrire(el: Element): string {
  const classe = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
  return `${el.tagName.toLowerCase()}${classe ? `.${classe}` : ""}`;
}

function surFin(e: TouchEvent) {
  const d = depart;
  depart = null;
  const t = e.changedTouches[0];
  if (!d || !t || e.timeStamp - d.t > DUREE_MAX_MS || Math.hypot(t.clientX - d.x, t.clientY - d.y) > TOLERANCE_PX) return;
  const trouve = inscritSous(t.clientX, t.clientY);
  if (!trouve) return;
  const [el, inscrit] = trouve;
  // Une feuille ouverte par-dessus : le bouton de dessous n'est pas touché.
  if (document.documentElement.classList.contains("feuille-ouverte") && !el.closest(".feuille")) return;
  // Un vrai bouton par-dessus (une bulle, un menu) garde son toucher. Un calque invisible qui
  // ne sert à rien, lui, ne doit plus avaler le doigt : c'était le cas sur l'iPhone.
  const dessus = document.elementFromPoint(t.clientX, t.clientY);
  if (dessus && !el.contains(dessus)) {
    const autre = dessus.closest(CONTROLE);
    if (autre && !el.contains(autre)) return;
    noter("geste", `Sous le doigt : ${decrire(dessus)}`);
  }
  inscrit.servi = e.timeStamp || performance.now();
  noter("geste", `${el.getAttribute("aria-label") ?? decrire(el)} (doigt)`);
  inscrit.agir();
}

function ecouter() {
  if (ecoute || typeof window === "undefined") return;
  ecoute = true;
  const options = { capture: true, passive: true } as const;
  window.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      depart = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY, t: e.timeStamp } : null;
    },
    options,
  );
  window.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (depart && t && Math.hypot(t.clientX - depart.x, t.clientY - depart.y) > TOLERANCE_PX) depart = null;
    },
    options,
  );
  window.addEventListener("touchend", surFin, options);
  window.addEventListener("touchcancel", () => (depart = null), options);
}

/**
 * À étaler sur un petit bouton : `<button {...toucherFiable(agir)}>`. Le doigt passe par
 * l'écoute de la page ; la souris, le clavier et VoiceOver par le click.
 */
export function toucherFiable(agir: () => void, marge = 0) {
  ecouter();
  return {
    ref: (el: HTMLElement | null) => {
      if (!el) return;
      const avant = inscrits.get(el);
      inscrits.set(el, { agir, marge, servi: avant?.servi ?? -Infinity });
      return () => {
        // Un nouveau rendu réinscrit tout de suite le même bouton ; on ne l'efface que s'il part.
        queueMicrotask(() => {
          if (!el.isConnected) inscrits.delete(el);
        });
      };
    },
    onClick: (e: MouseEvent) => {
      const inscrit = inscrits.get(e.currentTarget);
      if (inscrit && (e.timeStamp || performance.now()) - inscrit.servi < GARDE_CLICK_MS) {
        e.preventDefault();
        return;
      }
      agir();
    },
  };
}
