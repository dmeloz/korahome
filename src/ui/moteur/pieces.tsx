import { AnimatePresence, type HTMLMotionProps } from "motion/react";
import * as m from "motion/react-m";
import type { ReactNode } from "react";
import { ressortMotion } from "./ressorts";

// Les pièces du moteur pour les écrans : une liste dont les lignes arrivent, s'en vont et
// changent de place en glissant ; ce qui apparaît et disparaît ; le repère des onglets.

export { AnimatePresence as Presence, m };

/** Une liste vivante : les lignes ajoutées s'ouvrent, celles qui partent se referment, les
 *  autres glissent à leur nouvelle place. Ses enfants sont des `Ligne` avec une clé stable. */
export function ListeVivante({ className, children, ...reste }: { className?: string; children: ReactNode; "aria-label"?: string; role?: string }) {
  return (
    <ul className={className} {...reste}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </ul>
  );
}

/** Une ligne d'une liste vivante (un `li`). */
export function Ligne({ children, ...props }: HTMLMotionProps<"li">) {
  return (
    <m.li
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={ressortMotion("ligne")}
      style={{ overflow: "hidden" }}
      {...props}
    >
      {children}
    </m.li>
  );
}

/** Ce qui apparaît et s'en va avec le même ressort : une bulle, un message, un bandeau.
 *  À placer dans une `Presence` pour que la sortie se voie. `depuis` : le côté d'où il arrive. */
export function Apparait({ depuis = "bas", children, ...props }: HTMLMotionProps<"div"> & { depuis?: "bas" | "haut" | "centre" }) {
  const decale = depuis === "bas" ? { y: 12 } : depuis === "haut" ? { y: -12 } : {};
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.94, ...decale }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, ...decale }}
      transition={ressortMotion("apparition")}
      {...props}
    >
      {children}
    </m.div>
  );
}

/** Le repère de l'onglet actif : il glisse d'un onglet à l'autre. `groupe` distingue deux
 *  rangées d'onglets affichées en même temps. */
export function RepereOnglet({ groupe }: { groupe: string }) {
  return <m.span layoutId={`repere-${groupe}`} className="segments-repere" transition={ressortMotion("onglet")} aria-hidden />;
}

/** Le bandeau de message en bas de l'écran (« Annuler », une erreur) : il monte et redescend.
 *  `cle` : un nouveau message remplace l'ancien en le faisant repartir. */
export function Message({ visible, cle, role = "status", children }: { visible: boolean; cle?: string | number; role?: "status" | "alert"; children: ReactNode }) {
  return <AnimatePresence>{visible && <Apparait key={cle ?? "message"} className="toast" role={role}>{children}</Apparait>}</AnimatePresence>;
}
