import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { etapesVisibles, parcoursVisite, placementBulle, progression, type CibleVisite } from "../../domaine/visite";
import { nomFee } from "../fee";
import { noter } from "../journal";

// La visite guidée : un voile sombre percé autour de l'élément montré, et une bulle
// juste à côté. Équivalent natif : TipKit (popoverTip) enchaîné, ou une surcouche
// avec .mask autour du cadre de la cible.

/** Où trouver chaque cible à l'écran ; la fée est hors de la page. */
const SELECTEURS: Record<CibleVisite, string> = {
  signes: ".page-dessus .signes-accueil",
  aujourdhui: ".page-dessus .ce-moment",
  widget: ".page-dessus .chiffres-accueil",
  fee: "body > .fee",
};

const MARGE = 6;

function trouver(cible: CibleVisite): HTMLElement | null {
  // Le premier élément vraiment visible : un widget de la page affichée, pas celle d'à côté.
  for (const el of document.querySelectorAll<HTMLElement>(SELECTEURS[cible])) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= window.innerWidth + 1) return el;
  }
  return null;
}

type Cadre = { haut: number; bas: number; gauche: number; largeur: number };

export function Visite({ autre, fermer }: { autre: string | null; fermer: () => void }) {
  // Les étapes se choisissent une fois, à l'ouverture : celles dont la cible est là.
  const etapes = useMemo(() => {
    const presentes = new Set((Object.keys(SELECTEURS) as CibleVisite[]).filter((c) => trouver(c)));
    return etapesVisibles(parcoursVisite(autre, nomFee()), presentes);
  }, [autre]);
  const [index, setIndex] = useState(0);
  const [cadre, setCadre] = useState<Cadre | null>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const etape = etapes[index];
  const derniere = index === etapes.length - 1;

  // Amène la cible au milieu de l'écran, puis suit sa place tant que la page bouge.
  useLayoutEffect(() => {
    const el = etape.cible ? trouver(etape.cible) : null;
    if (!el) {
      setCadre(null);
      return;
    }
    if (!el.classList.contains("fee")) {
      const r = el.getBoundingClientRect();
      const libre = window.innerHeight - 260;
      if (r.top < 70 || r.bottom > libre) window.scrollBy({ top: r.top - Math.max(70, (libre - r.height) / 2), behavior: "smooth" });
    }
    const mesurer = () => {
      const r = el.getBoundingClientRect();
      setCadre({ haut: r.top - MARGE, bas: r.bottom + MARGE, gauche: r.left - MARGE, largeur: r.width + MARGE * 2 });
    };
    mesurer();
    const suite = window.setInterval(mesurer, 120);
    const fin = window.setTimeout(() => window.clearInterval(suite), 900);
    window.addEventListener("scroll", mesurer, { passive: true });
    window.addEventListener("resize", mesurer);
    return () => {
      window.clearInterval(suite);
      window.clearTimeout(fin);
      window.removeEventListener("scroll", mesurer);
      window.removeEventListener("resize", mesurer);
    };
  }, [etape]);

  useEffect(() => {
    bouton.current?.focus({ preventScroll: true });
    noter("geste", `Visite ${etape.id}`, "Visite");
  }, [etape]);

  const terminer = (passee: boolean) => {
    noter("geste", passee ? `Visite passée à ${etape.id}` : "Visite terminée", "Visite");
    fermer();
  };

  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") terminer(true);
    };
    window.addEventListener("keydown", clavier);
    return () => window.removeEventListener("keydown", clavier);
  });

  const placement = placementBulle(cadre, window.innerHeight);
  const styleBulle =
    placement === "dessous" && cadre
      ? { top: Math.min(cadre.bas + 12, window.innerHeight - 240) }
      : placement === "dessus" && cadre
        ? { bottom: Math.max(window.innerHeight - cadre.haut + 12, 16) }
        : undefined;

  // Les gestes sur le voile ne doivent ni défiler l'accueil ni ouvrir la recherche.
  const retenir = (e: React.SyntheticEvent) => e.stopPropagation();

  return createPortal(
    <div className="visite" role="dialog" aria-modal="true" aria-label="Visite guidée" onTouchStart={retenir} onTouchMove={retenir}>
      {cadre ? (
        <div className="visite-trou" style={{ top: cadre.haut, left: cadre.gauche, width: cadre.largeur, height: cadre.bas - cadre.haut }} aria-hidden />
      ) : (
        <div className="visite-voile" aria-hidden />
      )}
      <section key={etape.id} className={`visite-bulle ${placement}`} style={styleBulle} aria-live="polite">
        <p className="visite-progression">
          <span className="cache-visuel">Étape {progression(index, etapes.length)}</span>
          {etapes.map((e, i) => (
            <span key={e.id} className={`visite-point${i === index ? " actif" : i < index ? " fait" : ""}`} aria-hidden />
          ))}
        </p>
        <h2>{etape.titre}</h2>
        <p className="visite-texte">{etape.texte}</p>
        {etape.gestes && (
          <ul className="visite-gestes">
            {etape.gestes.map((g) => (
              <li key={g.picto}>
                <span className={`geste-dessin ${g.picto}`} aria-hidden><span /></span>
                {g.texte}
              </li>
            ))}
          </ul>
        )}
        <div className="visite-actions">
          {!derniere && <button className="lien visite-passer" onClick={() => terminer(true)}>Passer</button>}
          <span className="visite-espace" />
          {index > 0 && <button className="lien" onClick={() => setIndex(index - 1)}>Précédent</button>}
          <button ref={bouton} className="bouton-principal" onClick={() => (derniere ? terminer(false) : setIndex(index + 1))}>
            {derniere ? "C'est parti" : index === 0 ? "Commencer" : "Suivant"}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
