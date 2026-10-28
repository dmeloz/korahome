import { useEffect, useState } from "react";
import { LARGEUR_HUB } from "../domaine/hub";

// Le format large (0.0.95) : vrai quand le bloc qui porte les pages fait au moins 760 points de
// large (l'iPad, un iPad couché, une fenêtre large), faux sur l'iPhone, l'iPhone Duo déplié (669)
// et deux apps côte à côte sur l'iPad. On mesure ce bloc, pas l'écran : une app côte à côte
// retombe seule en mode téléphone. Les styles du format large sont dans src/styles/large.css.

export function useLarge(ref: React.RefObject<HTMLElement | null>, seuil = LARGEUR_HUB): boolean {
  const [large, setLarge] = useState(() => (typeof window === "undefined" ? false : window.innerWidth >= seuil));
  useEffect(() => {
    // Le bloc qui porte les pages : la largeur de l'app, pas celle de .contenu (bornée à 720).
    const page = ref.current?.closest<HTMLElement>(".contenu");
    const el = page?.parentElement ?? page ?? ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const mesurer = () => setLarge(el.getBoundingClientRect().width >= seuil);
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [ref, seuil]);
  return large;
}
