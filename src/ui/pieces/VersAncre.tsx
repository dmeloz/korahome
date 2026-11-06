import { useEffect } from "react";

// Arriver sur la bonne carte (Kora 0.1.2) : une tuile qui montre le carnet ou « Où est quoi »
// ouvre la page Entretien sur cette carte-là, pas en haut de la page (Apple, guide des widgets :
// « ouvrir l'app au bon endroit »). La carte porte l'id `ancre-<nom>`.

export function VersAncre(props: { ancre?: string }) {
  const { ancre } = props;
  useEffect(() => {
    if (!ancre) return;
    // Deux images plus tard : la page est posée et la métamorphose de la tuile a commencé.
    let suivante = 0;
    const premiere = requestAnimationFrame(() => {
      suivante = requestAnimationFrame(() => {
        const reduit = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        document.getElementById(`ancre-${ancre}`)?.scrollIntoView({ block: "start", behavior: reduit ? "auto" : "smooth" });
      });
    });
    return () => {
      cancelAnimationFrame(premiere);
      cancelAnimationFrame(suivante);
    };
  }, [ancre]);
  return null;
}
