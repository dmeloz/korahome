import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { ressortMotion } from "./ressorts";

// Le moteur de mouvement de Kora : Motion pour ce qui change de place, entre, sort ou suit le
// doigt ; Anime.js (anime.ts) pour les ressorts des styles et les graphiques qui se dessinent.
// Tous deux lisent les ressorts nommés de ressorts.ts. Si l'iPhone demande moins d'animations,
// Motion ne déplace plus rien (reducedMotion « user ») et Anime.js ne dessine plus.
// Les écrans utilisent les pièces de pieces.tsx (m.*), jamais motion.* : l'essentiel de Motion
// arrive après le premier écran.

const fonctions = () => import("./fonctions").then((m) => m.default);

export function Moteur({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={fonctions} strict>
      <MotionConfig reducedMotion="user" transition={ressortMotion("ligne")}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
