import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { resteAFaire, type CarteDuJour, type ChoseDuJour } from "../../domaine/aujourdhui";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { Chiffre } from "../moteur/Chiffre";
import { m, Presence } from "../moteur/pieces";
import { moinsDAnimations, ressortMotion } from "../moteur/ressorts";
import { toucherFiable } from "../toucher";

// « Ce soir » en haut de l'accueil, sans cadre : posé sur le fond, pour ne pas faire un bloc
// de plus à côté des widgets. Les choses tournent comme une roulette de l'iPhone : on les fait
// défiler du doigt, celle du milieu est en grand, les autres s'inclinent et pâlissent vers le
// haut et le bas, avec un petit cran à chaque chose qui passe au centre. Comme dans Rappels,
// toucher le rond le remplit et barre la chose ; elle part un instant après, et un second
// toucher dans ce délai la garde. On peut aussi la glisser vers la droite pour la faire tout de
// suite. Ses données (domaine/aujourdhui.ts) sont celles que reprendront le widget de l'iPhone
// et Siri. Équivalent natif : un ScrollView avec .scrollTargetBehavior(.viewAligned) et
// .visualEffect (rotation3DEffect selon la distance au centre), le rond comme dans Rappels.

/** Au-delà de ce glissement vers la droite, la chose est faite. */
const SEUIL_FAIT = 84;
/** Comme dans Rappels : le temps de changer d'avis entre le rond rempli et le départ. */
const DELAI_VALIDER_MS = 1200;
/** Hauteur d'un cran de la roulette, en pixels (la même que dans accueil.css). */
const CRAN = 56;
/** Au-delà de ce nombre, les choses tournent en roulette ; en dessous, elles sont posées. */
const DES_LA_ROULETTE = 2;

export function CarteAujourdhui(props: {
  carte: CarteDuJour;
  /** « Ce matin », « Cet après-midi », « Ce soir ». */
  titre: string;
  /** L'heure du téléphone, « HH:MM » : une heure passée s'affiche en rouge. */
  maintenant: string;
  toucher: (chose: ChoseDuJour) => void;
  /** Coche une tâche sur place. */
  cocher: (chose: ChoseDuJour) => void;
  /** Toucher l'heure d'une tâche : la changer. */
  changerHeure?: (chose: ChoseDuJour) => void;
  /** Qui s'en occupe, pour la ligne sous la chose du centre. */
  qui?: (chose: ChoseDuJour) => string | null;
  voirTout?: () => void;
}) {
  const { carte } = props;
  const reste = resteAFaire(carte);
  const avecHeures = carte.choses.some((c) => c.heure || c.tacheId);
  const roulette = carte.choses.length >= DES_LA_ROULETTE;
  const zone = useRef<HTMLOListElement>(null);
  const valider = useValidationDiffere(props.cocher);

  // La roulette : à chaque image du défilement, chaque ligne s'incline et pâlit selon sa
  // distance au centre, écrite directement sur la ligne (pas de rendu React par image).
  useLayoutEffect(() => {
    const el = zone.current;
    if (!el || !roulette) return;
    const doux = moinsDAnimations();
    let image = 0;
    let auCentre = -1;
    const maj = () => {
      image = 0;
      const milieu = el.scrollTop + el.clientHeight / 2;
      el.querySelectorAll<HTMLElement>(":scope > li").forEach((li, i) => {
        const d = Math.max(-2, Math.min(2, (li.offsetTop + li.offsetHeight / 2 - milieu) / CRAN));
        const a = Math.abs(d);
        li.style.opacity = String(Math.max(0.15, 1 - a * 0.45));
        li.style.transform = doux ? "" : `perspective(420px) rotateX(${(-d * 24).toFixed(1)}deg) scale(${(1 - a * 0.08).toFixed(3)})`;
        // Le centre se lit sur la ligne (data-centre), pas dans l'état React : rien à rendre.
        li.toggleAttribute("data-centre", a < 0.5);
        if (a < 0.5 && i !== auCentre) {
          if (auCentre !== -1) vibrer();
          auCentre = i;
        }
      });
    };
    const surDefilement = () => {
      if (!image) image = requestAnimationFrame(maj);
    };
    maj();
    // Une chose partie : la roulette se recale une fois sa ligne refermée.
    const recaler = window.setTimeout(() => {
      const cran = Math.round(el.scrollTop / CRAN) * CRAN;
      if (Math.abs(el.scrollTop - cran) > 1) el.scrollTo({ top: cran, behavior: moinsDAnimations() ? "auto" : "smooth" });
      maj();
    }, 450);
    el.addEventListener("scroll", surDefilement, { passive: true });
    return () => {
      clearTimeout(recaler);
      el.removeEventListener("scroll", surDefilement);
      if (image) cancelAnimationFrame(image);
    };
  }, [roulette, carte.choses.length]);

  const heure = (c: ChoseDuJour) => {
    const passee = !!c.heure && c.heure < props.maintenant;
    if (c.tacheId && props.changerHeure) {
      return (
        <button className={`moment-heure${passee ? " passee" : ""}`} onClick={() => props.changerHeure?.(c)} aria-label={c.heure ? `Heure : ${c.heure}, changer` : "Donner une heure"}>
          {c.heure ?? ""}
        </button>
      );
    }
    return <span className={`moment-heure${passee ? " passee" : ""}`}>{c.heure ?? ""}</span>;
  };
  const rond = (c: ChoseDuJour) =>
    c.tacheId ? (
      <button
        className={`moment-rond ${c.etat}${valider.enCours(c) ? " coche" : ""}`}
        {...toucherFiable(() => valider.basculer(c), 11)}
        role="checkbox"
        aria-checked={valider.enCours(c)}
        aria-label={`Faire « ${c.texte} »`}
      >
        <Icone nom="coche" taille={13} />
      </button>
    ) : (
      <span className={`moment-rond point ${c.etat}`} aria-hidden />
    );

  return (
    <section className={`ce-moment${avecHeures ? " avec-heures" : ""}`} aria-label={props.titre}>
      <header className="ce-moment-entete">
        <h2>{props.titre}</h2>
        {reste > 0 && <span className="discret"><Chiffre valeur={reste} /> à faire</span>}
      </header>
      {carte.choses.length === 0 ? (
        <p className="ce-moment-vide">{carte.faites ? "Tout est fait. Belle journée." : "Rien de prévu, rien ne presse."}</p>
      ) : (
        <ol ref={zone} className={`fil${roulette ? " roulette" : ""}`}>
          <Presence initial={false}>
            {carte.choses.map((c, i) => (
              <Ligne
                key={c.cle}
                chose={c}
                rang={roulette ? "roue" : i === 0 ? "phare" : "suivante"}
                cochee={valider.enCours(c)}
                faire={c.tacheId ? () => valider.maintenant(c) : undefined}
              >
                {heure(c)}
                {rond(c)}
                <button className="moment-corps" onClick={() => props.toucher(c)}>
                  <span className="moment-texte">{c.texte}</span>
                  <span className={`moment-sous ${c.etat}`}>
                    {[props.qui?.(c), c.heure && c.quand === c.heure ? null : c.quand].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </Ligne>
            ))}
          </Presence>
        </ol>
      )}
      {carte.autres > 0 && props.voirTout && (
        <button className="lien ce-moment-plus" onClick={props.voirTout}>
          {carte.autres === 1 ? "Et une autre chose" : `Et ${carte.autres} autres choses`}
        </button>
      )}
    </section>
  );
}

/**
 * Le rond de Rappels : un toucher le remplit, la chose part après DELAI_VALIDER_MS ;
 * un second toucher avant la garde. `maintenant` la fait sans attendre (le glissement).
 */
function useValidationDiffere(cocher: (c: ChoseDuJour) => void) {
  const [cles, setCles] = useState<ReadonlySet<string>>(new Set());
  const minuteries = useRef(new Map<string, number>());
  useEffect(() => () => minuteries.current.forEach((m) => clearTimeout(m)), []);
  const oublier = (cle: string) => {
    clearTimeout(minuteries.current.get(cle));
    minuteries.current.delete(cle);
    setCles((avant) => {
      const apres = new Set(avant);
      apres.delete(cle);
      return apres;
    });
  };
  return {
    enCours: (c: ChoseDuJour) => cles.has(c.cle),
    basculer: (c: ChoseDuJour) => {
      if (minuteries.current.has(c.cle)) return oublier(c.cle);
      vibrer();
      setCles((avant) => new Set(avant).add(c.cle));
      minuteries.current.set(
        c.cle,
        window.setTimeout(() => {
          oublier(c.cle);
          cocher(c);
        }, DELAI_VALIDER_MS),
      );
    },
    maintenant: (c: ChoseDuJour) => {
      if (minuteries.current.has(c.cle)) oublier(c.cle);
      cocher(c);
    },
  };
}

/** Une chose de la liste (en grand au centre de la roulette, data-centre) : glissée vers la droite elle est faite. */
function Ligne({ chose, rang, cochee, faire, children }: { chose: ChoseDuJour; rang: "phare" | "suivante" | "roue"; cochee: boolean; faire?: () => void; children: ReactNode }) {
  const [dx, setDx] = useState(0);
  const geste = useRef<{ x: number; y: number; h: boolean } | null>(null);
  const debut = (e: PointerEvent<HTMLLIElement>) => {
    if (!faire || (e.target as Element).closest(".moment-heure, .moment-rond")) return;
    geste.current = { x: e.clientX, y: e.clientY, h: false };
  };
  const mouvement = (e: PointerEvent<HTMLLIElement>) => {
    const g = geste.current;
    if (!g) return;
    const x = e.clientX - g.x;
    if (!g.h) {
      if (Math.abs(e.clientY - g.y) > 10) geste.current = null;
      else if (x > 10) {
        g.h = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }
    setDx(Math.max(0, x));
  };
  const fin = () => {
    const g = geste.current;
    geste.current = null;
    if (!g?.h) return;
    if (dx > SEUIL_FAIT && faire) {
      vibrer();
      faire();
    }
    setDx(0);
  };
  return (
    <m.li
      // Seule la hauteur est animée : l'opacité et l'inclinaison sont celles de la roulette.
      initial={{ height: 0 }}
      animate={{ height: "auto" }}
      exit={{ height: 0, minHeight: 0 }}
      transition={ressortMotion("ligne")}
      className={`${rang} ${chose.etat}${cochee ? " cochee" : ""}${dx ? " glisse" : ""}`}
      style={dx ? { ["--glisse" as string]: `${dx}px` } : undefined}
      onPointerDown={debut}
      onPointerMove={mouvement}
      onPointerUp={fin}
      onPointerCancel={fin}
      onClickCapture={(e) => {
        // Le clic qui suit un glissement n'ouvre pas la page.
        if (dx) e.stopPropagation();
      }}
    >
      {children}
    </m.li>
  );
}
