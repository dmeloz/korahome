import { useEffect, useRef, useState } from "react";
import { moinsDAnimations } from "./ressorts";

// Le langage des gestes de Kora (0.1.5, demande de Melo du 11 novembre 2026) : quatre mouvements
// courts, en laiton, qui disent sans phrase ce qui se passe.
// - Elle respire : c'est fait (une case cochée, une carte que Tael vient de toucher).
// - Elle tremble : c'est raté (Tael n'a pas pu répondre, un enregistrement n'est pas passé).
// - Le liseré tourne : Tael travaille ; il se ferme quand elle a fini (BulleAttente, pieces.tsx).
// - Le sceau se dessine : tout est fini (dernière course prise, dernière tâche du jour faite).
// Chacun dure moins d'une demi-seconde. Les mouvements eux-mêmes sont dans styles/langage.css
// (propriétés `scale` et `translate`, qui s'ajoutent au `transform` de Motion sans le gêner).
// Si l'iPhone demande moins d'animations, rien ne bouge et l'action se fait tout de suite.
// Équivalents natifs : .phaseAnimator pour respirer et trembler, .trim(from:to:) pour le sceau
// et le liseré, .sensoryFeedback(.success / .error) pour la vibration.

export const DUREES = {
  /** 1 → 1,035 → 0,99 → 1 : un souffle, pas un rebond. */
  respiration: 420,
  /** Trois allers-retours de quelques points. */
  tremblement: 320,
  /** Le liseré qui se referme quand Tael a fini. */
  fermeture: 280,
  /** Écart entre deux cartes qui respirent l'une après l'autre. */
  cascade: 110,
  /** Le sceau se dessine (cercle puis coche), reste un instant et s'efface. */
  sceau: 450,
} as const;

/** Rejoue une animation de styles/langage.css sur un élément, puis retire sa classe. */
function jouer(el: Element | null | undefined, classe: string, duree: number, delai = 0): void {
  if (!el || moinsDAnimations()) return;
  const lancer = () => {
    el.classList.remove(classe);
    // Relire la mise en page relance l'animation même si la classe venait d'être là.
    void (el as HTMLElement).offsetWidth;
    el.classList.add(classe);
    setTimeout(() => el.classList.remove(classe), duree + 60);
  };
  if (delai) setTimeout(lancer, delai);
  else lancer();
}

/** C'est fait : l'élément respire une fois. `trait` : un fin trait laiton « fait » se trace dessous. */
export function respirer(el: Element | null | undefined, { delai = 0, trait = false } = {}): void {
  jouer(el, trait ? "respire-fait" : "respire", DUREES.respiration + (trait ? 200 : 0), delai);
}

/** C'est raté : l'élément tremble un court instant. */
export function trembler(el: Element | null | undefined): void {
  jouer(el, "tremble", DUREES.tremblement);
}

/** Attendre un mouvement avant la suite (rien à attendre si l'iPhone demande moins d'animations). */
export const attendre = (ms: number): Promise<void> => (moinsDAnimations() ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

/**
 * Une ligne qu'on coche respire avant de partir : la case se remplit tout de suite, l'action
 * part à la fin du souffle. Un deuxième toucher pendant le souffle ne fait rien.
 */
export function useRespiration() {
  const [enCours, setEnCours] = useState<ReadonlySet<string>>(() => new Set());
  const lances = useRef(new Set<string>());
  return {
    respire: (id: string) => enCours.has(id),
    lancer(id: string, action: () => void) {
      if (moinsDAnimations()) return action();
      if (lances.current.has(id)) return;
      lances.current.add(id);
      setEnCours((s) => new Set(s).add(id));
      setTimeout(() => {
        lances.current.delete(id);
        setEnCours((s) => {
          const t = new Set(s);
          t.delete(id);
          return t;
        });
        action();
      }, DUREES.respiration);
    },
  };
}

// ----- Les cartes que Tael vient de toucher -----

/** Les cartes (data-widget) de chaque collection : ce que Tael touche, elles le montrent. */
const CARTES_DE: Readonly<Record<string, readonly string[]>> = {
  elements: ["courses", "listes"],
  taches: ["taches", "entretien"],
  agenda: ["agenda"],
  budget: ["budget"],
  menus: ["chef"],
  stock: ["stock"],
  jardin: ["jardin"],
  animaux: ["mitsu"],
  maison: ["entretien"],
};

/** Les cartes à faire respirer pour ces collections, dans l'ordre et sans doublon. */
export function cartesTouchees(collections: readonly string[]): string[] {
  return [...new Set(collections.flatMap((c) => CARTES_DE[c] ?? []))];
}

/** Ce qui a été touché attend la prochaine page de cartes, deux minutes au plus. */
const GARDE_MS = 120_000;
let touchees: { cartes: Set<string>; quand: number } | null = null;
const abonnes = new Set<() => void>();

/** Tael (ou la fée) vient de modifier ces collections : leurs cartes respireront. */
export function signalerTouchees(collections: readonly string[]): void {
  const cartes = cartesTouchees(collections);
  if (!cartes.length || moinsDAnimations()) return;
  touchees = { cartes: new Set([...(touchees?.cartes ?? []), ...cartes]), quand: Date.now() };
  abonnes.forEach((f) => f());
}

/** Fait respirer, l'une après l'autre, les cartes touchées de cette grille si elle est à l'écran. */
function faireRespirer(grille: HTMLElement): void {
  if (!touchees) return;
  if (Date.now() - touchees.quand > GARDE_MS) {
    touchees = null;
    return;
  }
  // Une page recouverte (une page ouverte par-dessus) attend d'être à nouveau dessus.
  if (!grille.closest(".page-dessus")) return;
  const trouvees = [...grille.querySelectorAll<HTMLElement>("[data-widget]")].filter((c) => touchees!.cartes.has(c.dataset.widget ?? ""));
  if (!trouvees.length) return;
  for (const c of trouvees) touchees.cartes.delete(c.dataset.widget ?? "");
  if (!touchees.cartes.size) touchees = null;
  // Un léger temps d'abord : la page finit d'arriver.
  trouvees.forEach((c, i) => respirer(c, { delai: 220 + i * DUREES.cascade, trait: true }));
}

/** La grille d'un espace écoute ce que Tael touche, et regarde à chaque affichage. */
export function useCartesTouchees<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  // Sans liste de dépendances : la grille reste montée sous une page ouverte par-dessus, et
  // c'est en redevenant la page du dessus (un nouvel affichage) qu'elle montre ce qui a changé.
  useEffect(() => {
    if (ref.current) faireRespirer(ref.current);
  });
  useEffect(() => {
    const f = () => ref.current && faireRespirer(ref.current);
    abonnes.add(f);
    return () => void abonnes.delete(f);
  }, []);
  return ref;
}

// ----- Le sceau de la fin -----

const SCEAU = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<circle cx="32" cy="32" r="27" stroke-width="1.5" pathLength="1" transform="rotate(-90 32 32)"/>
<circle cx="32" cy="32" r="22" stroke-width="0.75" pathLength="1" opacity="0.55" transform="rotate(90 32 32)"/>
<path d="M22 33 29 40 43 25" stroke-width="2.25" pathLength="1"/>
</svg>`;

/**
 * Tout est fini : un sceau laiton se dessine une fois au milieu de ce qui vient d'être terminé
 * (sinon au milieu de l'écran), reste un instant et s'efface. Pas de confettis.
 */
export function sceller(depuis?: Element | null): void {
  if (moinsDAnimations() || typeof document === "undefined") return;
  const r = depuis?.getBoundingClientRect();
  const x = r && r.width ? r.left + r.width / 2 : window.innerWidth / 2;
  // Dans le haut de ce qui est fini, là où le regard est encore, sans sortir de l'écran.
  const y = r && r.height ? Math.min(r.top + Math.min(r.height / 2, 180), window.innerHeight * 0.6) : window.innerHeight * 0.4;
  const sceau = document.createElement("div");
  sceau.className = "sceau";
  sceau.setAttribute("aria-hidden", "true");
  sceau.dataset.journal = "non";
  sceau.style.left = `${x}px`;
  sceau.style.top = `${y}px`;
  sceau.innerHTML = SCEAU;
  document.body.appendChild(sceau);
  setTimeout(() => sceau.remove(), DUREES.sceau + 900);
}
