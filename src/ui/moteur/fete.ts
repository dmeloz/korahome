import { moinsDAnimations } from "./ressorts";

// Les confettis (canvas-confetti) : une petite gerbe dorée pour ce qui mérite d'être fêté,
// la dernière tâche du jour faite, le dernier article des courses pris. Rarement, sinon ça
// ne fête plus rien. La bibliothèque n'arrive qu'à la première fête. Rien si l'iPhone demande
// moins d'animations.
// Équivalent natif : un CAEmitterLayer, ou le .symbolEffect(.bounce) d'un symbole en SwiftUI.

/** L'or de Kora et le violet de la fée. */
const COULEURS = ["#d3a14a", "#f0d9a4", "#a5762a", "#b9a8ff"];

/** Une gerbe de confettis, partie de l'élément touché (sinon du haut de l'écran). */
export function feter(depuis?: Element | null): void {
  if (moinsDAnimations()) return;
  let origine = { x: 0.5, y: 0.3 };
  if (depuis) {
    const r = depuis.getBoundingClientRect();
    origine = { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight };
  }
  void import("canvas-confetti").then(({ default: confetti }) =>
    confetti({
      particleCount: 60,
      spread: 75,
      startVelocity: 30,
      gravity: 0.9,
      ticks: 170,
      scalar: 0.8,
      origin: origine,
      colors: COULEURS,
      disableForReducedMotion: true,
      zIndex: 80,
    }),
  );
}
