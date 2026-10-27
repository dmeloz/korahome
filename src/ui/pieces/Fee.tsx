import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import type { Attente, TeinteFee } from "../../domaine/fee";
import { decrireMinute, estCaressee, estSecouee } from "../../domaine/vieFee";
import { changerEtatFee, direFee, enregistrerPlace, lirePlace, noterRenvoi, reveillerFee, taireFee, useEtatFee, useFee, useParoleFee, type Parole, type PlaceFee } from "../fee";
import { vibrer } from "../haptique";
import { m, Presence } from "../moteur/pieces";
import { ressortMotion } from "../moteur/ressorts";
import { APPUI_LONG_MS } from "../gestes";

// La fée, en bas de chaque page où l'on ajoute quelque chose : une boule de lumière à quatre
// ailes de libellule, comme les fées de Zelda. Toucher : elle écoute. Garder le doigt : on lui
// écrit. La glisser : elle change de côté ; contre le bord, elle se range à moitié cachée.
// Pendant qu'on fait défiler, elle s'efface. Ce que l'autre envoie attend au-dessus d'elle.
// Équivalent natif : une vue en overlay avec DragGesture, TimelineView pour le battement.

const TAILLE = 60;
const MARGE = 6;
/** Au-delà, le doigt la déplace. */
const SEUIL_GLISSE = 7;
/** Pas plus bas, pour laisser la pastille Dev et la barre de l'iPhone. */
const BAS_MIN = 64;
const HAUT_MIN = 80;
/** Deux touchers aussi rapprochés : elle se cache un moment. */
const DOUBLE_TOUCHER_MS = 320;
const CACHEE_MS = 8000;
/** La colère reste une surprise : une fois toutes les dix minutes au plus. */
const ENTRE_COLERES_MS = 10 * 60_000;
let derniereColere = 0;

interface Position {
  x: number;
  y: number;
}

/** Sa place près d'un élément de l'écran : posée sur la date la nuit, au coin d'un widget sinon. */
function lieuPres(selecteur: string, nuit: boolean): Position | null {
  const cible = document.querySelector(selecteur);
  if (!cible) return null;
  const r = cible.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return null;
  if (nuit) return { x: r.left + r.width / 2 - TAILLE / 2, y: Math.max(4, r.top - TAILLE + 22) };
  return { x: Math.min(window.innerWidth - TAILLE, r.right - TAILLE + 10), y: Math.max(HAUT_MIN - 30, r.top - TAILLE / 2 + 4) };
}

function lieu(place: PlaceFee, ancre: number | null): Position {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cachee = place.rangee && ancre === null;
  const x = place.cote === "gauche" ? (cachee ? -TAILLE / 2 : MARGE) : cachee ? w - TAILLE / 2 : w - TAILLE - MARGE;
  const y = ancre !== null ? ancre - TAILLE + 4 : Math.min(h - BAS_MIN - TAILLE, Math.max(HAUT_MIN, h - place.bas - TAILLE));
  return { x, y };
}

export function Fee(props: {
  /** Le haut de la saisie quand elle est ouverte : la fée se pose juste au-dessus. */
  ancre: number | null;
  ecoute: boolean;
  /** Toucher simple, dans le geste (le micro et le clavier ne s'ouvrent qu'ainsi sur l'iPhone). */
  toucher: () => void;
  appuiLong: () => void;
  /** Le doigt se lève après l'appui long : le clavier peut s'ouvrir. */
  lacherApresAppui: () => void;
  attentes: readonly Attente[];
  ouvrirAttente: (a: Attente) => void;
  /** La teinte de la fée de l'autre, pour l'icône de son message. */
  teinteAutre: TeinteFee;
  /** Deux touchers rapides : elle arrête d'écouter et se cache. */
  cacher: () => void;
}) {
  const fee = useFee();
  const parole = useParoleFee();
  const vie = useEtatFee();
  const [cachee, setCachee] = useState(false);
  const [humeur, setHumeur] = useState<"fachee" | "ronronne" | null>(null);
  const dernierToucher = useRef(0);
  const [place, setPlace] = useState<PlaceFee>(lirePlace);
  const [, setTaille] = useState(0);
  const [glisse, setGlisse] = useState(false);
  const [appuie, setAppuie] = useState(false);
  const [discrete, setDiscrete] = useState(false);
  const el = useRef<HTMLDivElement>(null);
  const geste = useRef<{
    x0: number;
    y0: number;
    depart: Position;
    long: boolean;
    glisse: boolean;
    minuterie: ReturnType<typeof setTimeout>;
    histo: [number, number][];
    debut: number;
    inversions: number[];
    sens: number;
    dernierX: number;
  } | null>(null);

  // Saisie ouverte, elle se pose au-dessus ; la nuit, sur la date ; en alerte, au coin du widget.
  const ailleurs = props.ancre === null && vie.cible ? lieuPres(vie.cible, vie.nuit) : null;
  const pos = ailleurs ?? lieu(cachee ? { ...place, rangee: true } : place, props.ancre);

  useEffect(() => {
    const suivre = () => setTaille(window.innerWidth * 10_000 + window.innerHeight + window.scrollY / 1e6);
    window.addEventListener("resize", suivre);
    // Posée près d'un élément, elle le suit quand la page défile.
    if (vie.cible) window.addEventListener("scroll", suivre, { passive: true });
    const id = vie.cible ? setTimeout(suivre, 60) : undefined;
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", suivre);
      window.removeEventListener("scroll", suivre);
    };
  }, [vie.cible]);

  // Pendant qu'on fait défiler, elle s'efface ; elle revient un instant après.
  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const defile = () => {
      setDiscrete(true);
      clearTimeout(id);
      id = setTimeout(() => setDiscrete(false), 700);
    };
    window.addEventListener("scroll", defile, { passive: true });
    return () => {
      clearTimeout(id);
      window.removeEventListener("scroll", defile);
    };
  }, []);

  const changerPlace = (p: PlaceFee) => {
    setPlace(p);
    enregistrerPlace(p);
  };

  const debut = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setAppuie(true);
    const g = {
      x0: e.clientX,
      y0: e.clientY,
      depart: pos,
      long: false,
      glisse: false,
      histo: [] as [number, number][],
      debut: performance.now(),
      inversions: [] as number[],
      sens: 0,
      dernierX: e.clientX,
      minuterie: setTimeout(() => {
        g.long = true;
        setAppuie(false);
        vibrer();
        props.appuiLong();
      }, APPUI_LONG_MS),
    };
    geste.current = g;
  };
  const mouvement = (e: PointerEvent<HTMLDivElement>) => {
    const g = geste.current;
    if (!g || g.long) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.glisse) {
      // Saisie ouverte, elle reste à sa place.
      if (props.ancre !== null || Math.hypot(dx, dy) < SEUIL_GLISSE) return;
      g.glisse = true;
      clearTimeout(g.minuterie);
      setAppuie(false);
      setGlisse(true);
      taireFee();
    }
    const x = g.depart.x + dx;
    const y = g.depart.y + dy;
    g.histo.push([performance.now(), x]);
    if (g.histo.length > 5) g.histo.shift();
    // Les changements de sens : secouée vite, elle se fâche ; caressée lentement, elle ronronne.
    if (Math.abs(e.clientX - g.dernierX) > 3) {
      const sens = Math.sign(e.clientX - g.dernierX);
      if (g.sens && sens !== g.sens) g.inversions.push(performance.now());
      g.sens = sens;
      g.dernierX = e.clientX;
    }
    if (el.current) el.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const fin = (e: PointerEvent<HTMLDivElement>, annule = false) => {
    const g = geste.current;
    geste.current = null;
    setAppuie(false);
    if (!g) return;
    clearTimeout(g.minuterie);
    if (g.long) {
      if (!annule) props.lacherApresAppui();
      return;
    }
    if (!g.glisse) {
      if (annule) return;
      const maintenant = performance.now();
      const double = maintenant - dernierToucher.current < DOUBLE_TOUCHER_MS;
      dernierToucher.current = double ? 0 : maintenant;
      if (double) {
        // Deux touchers : elle se cache un moment (le premier l'avait fait écouter).
        props.cacher();
        vibrer();
        setCachee(true);
        setTimeout(() => setCachee(false), CACHEE_MS);
        return;
      }
      if (cachee) {
        setCachee(false);
        return;
      }
      if (vie.nuit) {
        vibrer();
        changerEtatFee({ etire: true });
        setTimeout(() => changerEtatFee({ etire: false }), 1200);
        reveillerFee();
        return;
      }
      if (vie.alerte) {
        vibrer();
        const dite = vie.alerte;
        changerEtatFee({ alerte: null });
        direFee({ ...dite, sansSuite: () => changerEtatFee({ cible: null }) });
        return;
      }
      if (parole) {
        taireFee();
        if (parole.spontanee) noterRenvoi();
      }
      if (place.rangee && props.ancre === null) {
        vibrer();
        changerPlace({ ...place, rangee: false });
        return;
      }
      props.toucher();
      return;
    }
    // Lâchée : elle file du côté où on l'a lancée, et se range si on l'a poussée contre le bord.
    setGlisse(false);
    const w = window.innerWidth;
    const x = g.depart.x + (e.clientX - g.x0);
    const y = g.depart.y + (e.clientY - g.y0);
    let vx = 0;
    if (g.histo.length > 1) {
      const [ta, xa] = g.histo[0];
      const [tb, xb] = g.histo[g.histo.length - 1];
      vx = (xb - xa) / Math.max(1, tb - ta);
    }
    const cote = x + TAILLE / 2 + vx * 180 < w / 2 ? "gauche" : "droite";
    const rangee = x < -TAILLE * 0.35 || x > w - TAILLE * 0.65;
    vibrer();
    changerEtatFee({ cible: null, alerte: null });
    changerPlace({ cote, rangee, bas: Math.max(BAS_MIN, window.innerHeight - y - TAILLE) });
    const maintenant = performance.now();
    if (estSecouee(g.inversions, maintenant) && Date.now() - derniereColere > ENTRE_COLERES_MS) {
      derniereColere = Date.now();
      setHumeur("fachee");
      [0, 120, 240].forEach((t) => setTimeout(vibrer, t));
      direFee({ cle: "colere", crie: true, texte: "Hey ! Listen ! Arrête de me secouer…", actions: [{ texte: "Pardon", faire: () => setHumeur(null) }], sansSuite: () => setHumeur(null) });
      setTimeout(() => setHumeur((h) => (h === "fachee" ? null : h)), 6000);
    } else if (estCaressee(g.inversions, g.debut, maintenant)) {
      setHumeur("ronronne");
      [0, 350, 700].forEach((t) => setTimeout(vibrer, t));
      setTimeout(() => setHumeur((h) => (h === "ronronne" ? null : h)), 2600);
    }
  };

  const classes = [
    "fee",
    `fee-${fee.teinte}`,
    glisse && "vole",
    appuie && "appuie",
    props.ecoute && "ecoute",
    (place.rangee || cachee) && props.ancre === null && !ailleurs && "rangee",
    cachee && "cachee",
    discrete && !glisse && props.ancre === null && !parole && !vie.nuit && "discrete",
    vie.nuit && props.ancre === null && "nuit",
    vie.alerte && "en-alerte scintille",
    vie.joie && "joie scintille",
    vie.etire && "etire",
    vie.allure,
    humeur,
  ].filter(Boolean).join(" ");

  return createPortal(
    <>
      {props.attentes.map((a, i) => (
        <button
          key={a.cle}
          className={`attend ${a.sorte}${a.sorte === "message" ? ` fee-${props.teinteAutre}` : ""}`}
          style={{ transform: `translate(${pos.x + TAILLE / 2 - 9 + (i - (props.attentes.length - 1) / 2) * 24}px, ${pos.y - 10}px)` }}
          aria-label={a.sorte === "message" ? "Un message t'attend" : "Un cœur t'attend"}
          onClick={() => {
            vibrer();
            props.ouvrirAttente(a);
          }}
        >
          {a.sorte === "message" ? <PictoMessage /> : <PictoCoeur />}
        </button>
      ))}
      <div
        ref={el}
        className={classes}
        style={glisse ? undefined : { transform: `translate(${pos.x}px, ${pos.y}px)` }}
        role="button"
        tabIndex={0}
        aria-label={`${fee.nom} : touche pour parler, garde le doigt pour écrire`}
        data-journal="fee"
        data-eclat={vie.nuit ? undefined : vie.eclat}
        onPointerDown={debut}
        onPointerMove={mouvement}
        onPointerUp={(e) => fin(e)}
        onPointerCancel={(e) => fin(e, true)}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            props.toucher();
          }
        }}
      >
        <div className="ondes" aria-hidden><i /><i /><i /></div>
        <div className="etincelles" aria-hidden><i /><i /><i /><i /><i /></div>
        <DessinFee />
      </div>
      <Presence>{parole && !glisse && <Bulle key={`${parole.cle}:${parole.texte}`} parole={parole} pos={pos} />}</Presence>
    </>,
    document.body,
  );
}

/** La bulle : petite, sans cadre de couleur, le nom seulement pour un message de l'autre. */
function Bulle({ parole, pos }: { parole: Parole; pos: Position }) {
  const actions = parole.actions ?? [];
  const avecActions = actions.length > 0;
  useEffect(() => {
    const fermer = () => {
      taireFee(parole.cle);
      parole.sansSuite?.();
    };
    const id = setTimeout(fermer, avecActions ? 10_000 : 7000);
    const ailleurs = (e: globalThis.PointerEvent) => {
      if ((e.target as Element).closest?.(".hey, .fee, .attend")) return;
      fermer();
      // Renvoyée d'un toucher ailleurs : elle apprend l'heure où on préfère qu'elle se taise.
      const heure = parole.spontanee ? noterRenvoi() : null;
      if (heure !== null) setTimeout(() => direFee({ cle: "discrete", texte: `Tu me renvoies souvent vers ${decrireMinute(heure * 60)}. À cette heure-là, je garderai mes nouvelles pour plus tard.` }), 400);
    };
    window.addEventListener("pointerdown", ailleurs, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointerdown", ailleurs, true);
    };
  }, [parole, avecActions]);

  // Elle sort à côté d'elle, du côté où il y a de la place, alignée sur son bas (0.0.71) : posée
  // au-dessus, elle couvrait les lignes de la page. Près du haut, elle descend sous elle.
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aGauche = pos.x + TAILLE / 2 > w / 2;
  const dessous = pos.y < 170;
  const style: React.CSSProperties = {};
  if (aGauche) style.right = Math.max(10, w - pos.x + 2);
  else style.left = Math.max(10, pos.x + TAILLE + 2);
  if (dessous) style.top = pos.y + TAILLE - 6;
  else style.bottom = Math.max(10, h - pos.y - TAILLE + 4);

  // Elle naît de la fée et y retourne, avec le ressort « apparition » du moteur.
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={ressortMotion("apparition")}
      className={`hey${aGauche ? " gauche" : ""}${dessous ? " dessous" : ""}${parole.crie ? " crie" : ""}${parole.de ? ` fee-${parole.de.teinte}` : ""}`} style={style} role="status">
      {parole.de && <span className="de">{parole.de.prenom}</span>}
      <span className="hey-texte">{parole.texte}</span>
      {actions.length > 0 && (
        <span className="actions-hey">
          {actions.map((a) => (
            <button
              key={a.texte}
              onClick={() => {
                taireFee(parole.cle);
                a.faire?.();
              }}
            >
              {a.texte}
            </button>
          ))}
        </span>
      )}
    </m.div>
  );
}

/** Le dessin : un halo, une boule de lumière et deux paires d'ailes (pointues pour Tael, rondes pour Navi). */
function DessinFee() {
  const aile = { fill: "url(#fee-aile)", stroke: "var(--fee-nervure)", strokeWidth: 0.7, strokeOpacity: 0.8 };
  const nervure = { stroke: "var(--fee-nervure)", strokeOpacity: 0.5, strokeWidth: 0.5, fill: "none" };
  return (
    <svg viewBox="0 0 120 120" aria-hidden>
      <defs>
        <radialGradient id="fee-halo">
          <stop offset="0" stopColor="var(--fee-lueur)" stopOpacity=".75" />
          <stop offset=".4" stopColor="var(--fee-milieu)" stopOpacity=".25" />
          <stop offset="1" stopColor="var(--fee-profond)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fee-coeur" cx=".45" cy=".42">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".38" stopColor="var(--fee-clair)" />
          <stop offset=".75" stopColor="var(--fee-milieu)" />
          <stop offset="1" stopColor="var(--fee-profond)" />
        </radialGradient>
        <linearGradient id="fee-aile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".75" />
          <stop offset=".6" stopColor="var(--fee-aile)" stopOpacity=".35" />
          <stop offset="1" stopColor="var(--fee-milieu)" stopOpacity=".25" />
        </linearGradient>
      </defs>
      <circle className="halo" cx="60" cy="60" r="44" fill="url(#fee-halo)" />
      <g className="flotte">
        <g className="ailes ailes-rondes">
          <g className="aile aile-hg"><path d="M57 56 C 50 44, 40 30, 28 28 C 18 27, 18 40, 30 48 C 40 55, 50 58, 57 59 Z" {...aile} /><path d="M55 55 C 46 46, 38 38, 30 34" {...nervure} /></g>
          <g className="aile aile-hd"><path d="M63 56 C 70 44, 80 30, 92 28 C 102 27, 102 40, 90 48 C 80 55, 70 58, 63 59 Z" {...aile} /><path d="M65 55 C 74 46, 82 38, 90 34" {...nervure} /></g>
          <g className="aile aile-bg"><path d="M57 63 C 50 68, 40 76, 36 84 C 34 90, 44 88, 50 80 C 54 74, 56 68, 57 64 Z" {...aile} /></g>
          <g className="aile aile-bd"><path d="M63 63 C 70 68, 80 76, 84 84 C 86 90, 76 88, 70 80 C 66 74, 64 68, 63 64 Z" {...aile} /></g>
        </g>
        <g className="ailes ailes-pointues">
          <g className="aile aile-hg"><path d="M57 56 C 48 46, 36 30, 16 18 C 22 32, 26 42, 34 50 L 30 52 C 40 56, 50 58, 57 59 Z" {...aile} /><path d="M55 55 C 46 46, 36 36, 24 26" {...nervure} /></g>
          <g className="aile aile-hd"><path d="M63 56 C 72 46, 84 30, 104 18 C 98 32, 94 42, 86 50 L 90 52 C 80 56, 70 58, 63 59 Z" {...aile} /><path d="M65 55 C 74 46, 84 36, 96 26" {...nervure} /></g>
          <g className="aile aile-bg"><path d="M57 63 C 50 70, 40 80, 28 92 C 40 86, 48 80, 54 72 C 56 69, 57 66, 57 64 Z" {...aile} /></g>
          <g className="aile aile-bd"><path d="M63 63 C 70 70, 80 80, 92 92 C 80 86, 72 80, 66 72 C 64 69, 63 66, 63 64 Z" {...aile} /></g>
        </g>
        <circle className="coeur" cx="60" cy="60" r="12" fill="url(#fee-coeur)" />
        <circle cx="57" cy="57" r="3.4" fill="#fff" opacity=".95" />
      </g>
    </svg>
  );
}

function PictoCoeur() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 20.5s-7.5-4.4-7.5-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.8c0 5.7-7.5 10.1-7.5 10.1z" fill="currentColor" />
    </svg>
  );
}

function PictoMessage() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z" fill="currentColor" />
    </svg>
  );
}
