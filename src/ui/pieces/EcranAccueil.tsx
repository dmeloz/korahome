import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { ChoseDuJour } from "../../domaine/aujourdhui";
import { ROTATION_MS, suivante, type CarteId, type EnDirect } from "../../domaine/ecranAccueil";
import { APPUI_LONG_MS } from "../gestes";
import { vibrer } from "../haptique";
import { Icone, type NomIcone } from "../Icone";
import { moinsDAnimations } from "../moteur/ressorts";
import { toucherFiable } from "../toucher";

// Les pièces de l'accueil « tout sur un écran » (Kora 0.0.72) : la pastille « en direct », les
// quatre chiffres du jour, « Ce soir » qui tourne tout seul et les piles « En ce moment ». Les
// règles (le moment, la composition des piles, qui fait les courses) sont dans
// domaine/ecranAccueil.ts. Seuls les morceaux qui flottent (la fée, la feuille d'aperçu, la date
// repliée) gardent le verre ; le reste est posé sur le fond. Équivalents natifs : Grid de quatre
// colonnes, TabView .page pour « Ce soir » et les piles, .contextMenu avec preview pour l'aperçu.

/** Au-delà de ce déplacement, le doigt fait défiler ou glisse : pas d'appui long. */
const TOLERANCE_PX = 10;
/** Au-delà de ce glissement vers la droite, la chose est faite. */
const SEUIL_FAIT = 84;
/** Comme dans Rappels : le temps de changer d'avis entre le rond rempli et le départ. */
const DELAI_VALIDER_MS = 1200;
/** Au-delà de ce glissement de côté, la pile passe à la carte voisine. */
const SEUIL_PILE = 40;

/** Un appui long qui ne gêne ni le toucher ni le défilement. */
function useAppuiLong(agir: () => void) {
  const appui = useRef<{ minuterie: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const servi = useRef(false);
  const lacher = () => {
    if (appui.current) clearTimeout(appui.current.minuterie);
    appui.current = null;
  };
  return {
    /** Vrai une fois, juste après un appui long : le clic qui suit est ignoré. */
    consommer: () => {
      const s = servi.current;
      servi.current = false;
      return s;
    },
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        lacher();
        servi.current = false;
        appui.current = {
          x: e.clientX,
          y: e.clientY,
          minuterie: setTimeout(() => {
            appui.current = null;
            servi.current = true;
            vibrer();
            agir();
          }, APPUI_LONG_MS),
        };
      },
      onPointerMove: (e: PointerEvent) => {
        const a = appui.current;
        if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) > TOLERANCE_PX) lacher();
      },
      onPointerUp: lacher,
      onPointerCancel: lacher,
      onPointerLeave: lacher,
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    },
  };
}

// ----- En direct -----

export function PastilleDirect({ direct, ouvrir }: { direct: EnDirect; ouvrir: () => void }) {
  const part = direct.total ? direct.coches / direct.total : 0;
  return (
    <button className="en-direct" onClick={ouvrir} aria-label={`En direct : ${direct.qui} fait les courses, ${direct.coches} articles sur ${direct.total}`}>
      <span className="en-direct-point" aria-hidden />
      <span className="en-direct-texte"><strong>{direct.qui}</strong> fait les courses</span>
      <span className="en-direct-jauge" aria-hidden><span style={{ width: `${Math.round(part * 100)}%` }} /></span>
      <span className="en-direct-compte">{direct.coches} sur {direct.total}</span>
    </button>
  );
}

// ----- Les chiffres du jour -----

export interface TuileChiffre {
  id: "taches" | "courses" | "budget" | "agenda";
  libelle: string;
  valeur: string;
  pied: string;
  urgent: boolean;
}

export function ChiffresDuJour(props: { tuiles: TuileChiffre[]; ouvrir: (id: TuileChiffre["id"]) => void; apercu: (id: TuileChiffre["id"]) => void }) {
  return (
    <nav className="chiffres-accueil" aria-label="Les chiffres du jour">
      {props.tuiles.map((t) => (
        <Tuile key={t.id} tuile={t} ouvrir={() => props.ouvrir(t.id)} apercu={() => props.apercu(t.id)} />
      ))}
    </nav>
  );
}

function Tuile({ tuile, ouvrir, apercu }: { tuile: TuileChiffre; ouvrir: () => void; apercu: () => void }) {
  const long = useAppuiLong(apercu);
  return (
    <button
      data-widget={tuile.id}
      className={`chiffre-tuile${tuile.urgent ? " urgent" : ""}`}
      aria-label={`${tuile.libelle} : ${tuile.valeur} ${tuile.pied}. Appui long pour un aperçu.`}
      {...long.handlers}
      onClick={() => {
        if (!long.consommer()) ouvrir();
      }}
    >
      <span className="chiffre-libelle">{tuile.libelle}</span>
      <span className="chiffre-valeur">{tuile.valeur}</span>
      <span className="chiffre-pied">{tuile.pied}</span>
    </button>
  );
}

// ----- Ce soir -----

export function CeSoir(props: {
  choses: ChoseDuJour[];
  titre: string;
  /** Rien à faire : la phrase dite à la place. */
  vide: string;
  qui: (c: ChoseDuJour) => string | null;
  toucher: (c: ChoseDuJour) => void;
  cocher: (c: ChoseDuJour) => void;
  changerHeure: (c: ChoseDuJour) => void;
  voirTout: () => void;
  /** « Glisse quand c'est fait », les premières fois. */
  indice: boolean;
  /** Le glissement a été fait une fois : l'indice ne revient plus. */
  gesteFait: () => void;
}) {
  const { choses } = props;
  const [index, setIndex] = useState(0);
  const [arrete, setArrete] = useState(false);
  const [dx, setDx] = useState(0);
  const [cochee, setCochee] = useState<string | null>(null);
  const geste = useRef<{ x: number; y: number; h: boolean; passe: boolean } | null>(null);
  const minuterie = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(minuterie.current), []);
  const n = choses.length;
  const i = n ? Math.min(index, n - 1) : 0;
  const c = choses[i];

  // Elles passent toutes seules, une toutes les six secondes ; un toucher arrête la ronde, et
  // rien ne tourne quand l'iPhone demande moins d'animations.
  useEffect(() => {
    if (arrete || n < 2 || moinsDAnimations()) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((x) => suivante(Math.min(x, n - 1), n));
    }, ROTATION_MS);
    return () => clearInterval(id);
  }, [arrete, n]);

  const faire = (chose: ChoseDuJour) => {
    clearTimeout(minuterie.current);
    setCochee(null);
    props.cocher(chose);
  };
  const basculer = (chose: ChoseDuJour) => {
    setArrete(true);
    if (cochee === chose.cle) {
      clearTimeout(minuterie.current);
      setCochee(null);
      return;
    }
    vibrer();
    setCochee(chose.cle);
    minuterie.current = window.setTimeout(() => faire(chose), DELAI_VALIDER_MS);
  };

  const debut = (e: PointerEvent<HTMLDivElement>) => {
    setArrete(true);
    if (!c?.tacheId || (e.target as Element).closest(".ce-soir-rond, .ce-soir-heure, .ce-soir-points")) return;
    geste.current = { x: e.clientX, y: e.clientY, h: false, passe: false };
  };
  const mouvement = (e: PointerEvent<HTMLDivElement>) => {
    const g = geste.current;
    if (!g) return;
    const x = e.clientX - g.x;
    if (!g.h) {
      if (Math.abs(e.clientY - g.y) > TOLERANCE_PX) geste.current = null;
      else if (x > TOLERANCE_PX) {
        g.h = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }
    // Un petit cran sous le doigt quand le seuil est passé, et un autre si on revient.
    if (x > SEUIL_FAIT !== g.passe) {
      g.passe = x > SEUIL_FAIT;
      vibrer();
    }
    setDx(Math.max(0, x));
  };
  const fin = () => {
    const g = geste.current;
    geste.current = null;
    if (!g?.h) return;
    if (g.passe && c) {
      props.gesteFait();
      faire(c);
    }
    setDx(0);
  };

  return (
    <section className="ce-soir ce-moment" aria-label={props.titre} aria-roledescription="carrousel">
      <header className="accueil-titre">
        <h2>{props.titre}</h2>
        <button className="lien" onClick={props.voirTout}>Tout voir</button>
      </header>
      {!c ? (
        <p className="ce-soir-vide">{props.vide}</p>
      ) : (
        <div
          className={`ce-soir-ligne ${c.etat}${dx ? " glisse" : ""}${cochee === c.cle ? " cochee" : ""}`}
          style={dx ? { ["--glisse" as string]: `${dx}px` } : undefined}
          onPointerDown={debut}
          onPointerMove={mouvement}
          onPointerUp={fin}
          onPointerCancel={fin}
          onClickCapture={(e) => {
            if (dx) e.stopPropagation();
          }}
        >
          {c.tacheId ? (
            <button
              className={`ce-soir-rond ${c.etat}${cochee === c.cle ? " coche" : ""}`}
              {...toucherFiable(() => basculer(c), 11)}
              role="checkbox"
              aria-checked={cochee === c.cle}
              aria-label={`Faire « ${c.texte} »`}
            >
              <Icone nom="coche" taille={15} />
            </button>
          ) : (
            <span className={`ce-soir-rond point ${c.etat}`} aria-hidden />
          )}
          <div className="ce-soir-corps" key={c.cle}>
            <button className="ce-soir-texte" onClick={() => props.toucher(c)}>{c.texte}</button>
            <span className={`ce-soir-sous ${c.etat}`}>
              {c.tacheId && c.heure && (
                <>
                  <button className="ce-soir-heure" onClick={() => props.changerHeure(c)} aria-label={`Heure : ${c.heure}, changer`}>
                    {c.heure}
                  </button>
                  <span aria-hidden>·</span>
                </>
              )}
              {[c.heure && !c.tacheId ? c.heure : null, props.qui(c), c.heure && c.quand === c.heure ? null : c.quand].filter(Boolean).join(" · ")}
            </span>
            {props.indice && c.tacheId && (
              <span className="ce-soir-indice">
                <Icone nom="suivant" taille={13} />
                Glisse quand c'est fait
              </span>
            )}
          </div>
          {n > 1 && (
            <span className="ce-soir-points" role="tablist" aria-label="Les choses du moment" aria-orientation="vertical">
              {choses.slice(0, 5).map((x, k) => (
                <button
                  key={x.cle}
                  role="tab"
                  aria-selected={k === i}
                  aria-label={x.texte}
                  className={k === i ? "actif" : ""}
                  onClick={() => {
                    setArrete(true);
                    setIndex(k);
                  }}
                >
                  <span />
                </button>
              ))}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

// ----- Les piles « En ce moment » -----

export interface LignePile {
  texte: string;
  fin: string;
  urgent?: boolean;
}

export interface CartePile {
  id: CarteId;
  titre: string;
  contexte: string;
  picto: NomIcone;
  lignes: LignePile[];
  urgent: boolean;
  /** L'espace qu'elle ouvre, pour la métamorphose carte → page. */
  widget?: string;
  ouvrir: () => void;
}

export function Pile(props: { cartes: CartePile[]; nom: string; ranger: () => void }) {
  const [index, setIndex] = useState(0);
  const [sens, setSens] = useState<"suivante" | "precedente">("suivante");
  const glisse = useRef<{ x: number; y: number } | null>(null);
  const long = useAppuiLong(props.ranger);
  const n = props.cartes.length;
  const i = Math.min(index, n - 1);
  const carte = props.cartes[i];
  if (!carte) return null;
  const aller = (k: number) => {
    if (k === i) return;
    setSens(k > i ? "suivante" : "precedente");
    setIndex(k);
  };
  return (
    <div className="pile">
      {n > 1 && <span className="pile-dessous" aria-hidden />}
      <article
        className={`pile-carte${carte.urgent ? " urgent" : ""}`}
        data-widget={carte.widget}
        aria-label={`${props.nom} : ${carte.titre}`}
        {...long.handlers}
        onPointerDown={(e) => {
          long.handlers.onPointerDown(e);
          glisse.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          long.handlers.onPointerUp();
          const g = glisse.current;
          glisse.current = null;
          if (!g || n < 2) return;
          const dx = e.clientX - g.x;
          if (Math.abs(dx) > SEUIL_PILE && Math.abs(dx) > Math.abs(e.clientY - g.y)) {
            vibrer();
            aller(dx < 0 ? (i + 1) % n : (i - 1 + n) % n);
          }
        }}
        onClickCapture={(e) => {
          if (long.consommer()) e.stopPropagation();
        }}
      >
        <div className={`pile-contenu ${sens}`} key={carte.id}>
          <header className="pile-entete">
            <span className="pile-picto"><Icone nom={carte.picto} taille={16} /></span>
            <span className="pile-titres">
              <h3>
                {carte.titre}
                {carte.urgent && <span className="point-etat urgent" aria-label="À faire" />}
              </h3>
              <span className="pile-contexte">{carte.contexte}</span>
            </span>
            <button className="lien" onClick={carte.ouvrir}>Ouvrir</button>
          </header>
          {carte.lignes.slice(0, 2).map((l) => (
            <button key={l.texte} className={`pile-ligne${l.urgent ? " urgent" : ""}`} onClick={carte.ouvrir}>
              <span className="pile-ligne-texte">{l.texte}</span>
              {l.fin && <span className="pile-ligne-fin">{l.fin}</span>}
            </button>
          ))}
        </div>
        {n > 1 && (
          <span className="pile-tirets" role="tablist" aria-label="Cartes de la pile" aria-orientation="vertical">
            {props.cartes.map((x, k) => (
              <button key={x.id} role="tab" aria-selected={k === i} aria-label={x.titre} className={k === i ? "actif" : ""} onClick={() => aller(k)}>
                <span />
              </button>
            ))}
          </span>
        )}
      </article>
    </div>
  );
}

/** L'aperçu d'un chiffre (appui long) : quelques lignes et le chemin vers la page. */
export function ContenuApercu(props: { contexte: string; lignes: LignePile[]; ouvrir: () => void; libelle: string }): ReactNode {
  return (
    <div className="apercu-accueil">
      <p className="discret">{props.contexte}</p>
      {props.lignes.length > 0 && (
        <ul className="carte groupe">
          {props.lignes.map((l) => (
            <li key={l.texte} className={`ligne apercu-ligne${l.urgent ? " urgent" : ""}`}>
              <span className="ligne-texte">{l.texte}</span>
              {l.fin && <span className="discret">{l.fin}</span>}
            </li>
          ))}
        </ul>
      )}
      <button className="bouton-doux" onClick={props.ouvrir}>Ouvrir {props.libelle}</button>
    </div>
  );
}
