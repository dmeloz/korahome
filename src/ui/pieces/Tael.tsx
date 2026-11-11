import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { phraseAttente, type Attente } from "../../domaine/fee";
import { NIVEAUX, journalDuJour } from "../../domaine/tael";
import { heureMinute } from "../../domaine/texte";
import { decrireMinute } from "../../domaine/vieFee";
import { aujourdhuiLocal } from "../contexte";
import { changerEtatFee, direFee, nomFee, noterRenvoi, reveillerFee, taireFee, useEtatFee, useFee, useParoleFee, type Parole } from "../fee";
import { vibrer } from "../haptique";
import { APPUI_LONG_MS } from "../gestes";
import { m, Presence } from "../moteur/pieces";
import { ressortMotion } from "../moteur/ressorts";
import { Feuille } from "../Feuille";
import { choisirNiveau, ecrireAFee, marquerAnnuleeAuJournal, ouvrirFeuilleTael, toucherFee, useFeuilleTael, useJournalTael, useNiveau, useOrbe } from "../tael";

// Tael vient à toi (Kora 0.1, vision A validée par Melo) : son orbe à côté du salut, sur sa carte
// et dans la barre du haut ; toucher, elle écoute ; garder le doigt, sa feuille (son niveau, son
// journal). Sa carte dit ce qu'elle propose ou ce qu'elle a fait, puis s'en va. Sur une page sans
// carte, sa bulle sort sous la barre du haut. Équivalent natif : un bouton d'orbe en toolbar,
// une carte dans la grille, une sheet pour la feuille.

/** Le dessin : un halo, une boule de lumière et deux paires d'ailes (pointues pour Tael, rondes pour Navi). */
export function DessinFee() {
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

/**
 * L'orbe : toucher, elle écoute (ou ouvre le mot qui attend) ; garder le doigt, sa feuille.
 * `salut` : à côté du grand titre, l'orbe d'où elle s'envole vers sa carte.
 */
export function Orbe({ salut, className = "" }: { salut?: boolean; className?: string }) {
  const fee = useFee();
  const vie = useEtatFee();
  const { ecoute, attentes, ouvrirAttente } = useOrbe();
  const [appuie, setAppuie] = useState(false);
  const geste = useRef<{ long: boolean; minuterie: ReturnType<typeof setTimeout> } | null>(null);
  const attente = attentes[0];

  const debut = (e: PointerEvent<HTMLButtonElement>) => {
    if (!e.isPrimary) return;
    setAppuie(true);
    const g = {
      long: false,
      minuterie: setTimeout(() => {
        g.long = true;
        setAppuie(false);
        vibrer();
        ouvrirFeuilleTael();
      }, APPUI_LONG_MS),
    };
    geste.current = g;
  };
  const fin = (annule: boolean) => {
    const g = geste.current;
    geste.current = null;
    setAppuie(false);
    if (!g) return;
    clearTimeout(g.minuterie);
    if (g.long || annule) return;
    vibrer();
    toucher();
  };
  const toucher = () => {
    // Elle scintille pour une chose urgente : la toucher la lui fait dire, au lieu de lancer l'écoute (Kora 0.1.10).
    if (vie.alerte) {
      const dite = vie.alerte;
      changerEtatFee({ alerte: null });
      direFee({ ...dite, sansSuite: () => changerEtatFee({ cible: null }) });
      return;
    }
    if (attente) return ouvrirAttente(attente);
    // Touchée la nuit, elle reste réveillée dix minutes.
    if (vie.nuit) reveillerFee();
    toucherFee();
  };
  const libelle = vie.alerte
    ? `${fee.nom} a quelque chose d'urgent à te dire : touche pour l'entendre`
    : attente
      ? attente.sorte === "message" ? "Un message t'attend" : "Un cœur t'attend"
      : `${fee.nom} : touche pour parler, garde le doigt pour ses réglages`;
  return (
    <button
      type="button"
      className={`orbe fee-${fee.teinte}${ecoute ? " ecoute" : ""}${appuie ? " appuie" : ""}${attente ? " attend" : ""}${salut ? " orbe-salut" : ""}${vie.nuit ? " nuit" : ""}${vie.joie ? " joie" : ""}${vie.alerte ? " alerte" : ""} ${className}`.trim()}
      aria-label={libelle}
      data-journal="fee"
      onPointerDown={debut}
      onPointerUp={() => fin(false)}
      onPointerCancel={() => fin(true)}
      onPointerLeave={() => geste.current && !geste.current.long && fin(true)}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toucher();
        }
      }}
    >
      <DessinFee />
      {attente && <span className={`attente ${attente.sorte}`} aria-hidden>{attentes.length > 1 ? attentes.length : attente.sorte === "coeur" ? "♥" : "…"}</span>}
    </button>
  );
}

/** Ce que la bulle et la carte font d'une parole : elle se tait seule, ou quand on touche ailleurs. */
function useVieParole(parole: Parole, zone: string) {
  const avecActions = (parole.actions?.length ?? 0) > 0;
  useEffect(() => {
    const fermer = () => {
      taireFee(parole.cle);
      parole.sansSuite?.();
    };
    const id = setTimeout(fermer, avecActions ? 12_000 : 7000);
    const ailleurs = (e: globalThis.PointerEvent) => {
      if ((e.target as Element).closest?.(`${zone}, .orbe`)) return;
      fermer();
      // Renvoyée d'un toucher ailleurs : elle apprend l'heure où on préfère qu'elle se taise (Réglages de la fée).
      const heure = parole.spontanee ? noterRenvoi() : null;
      if (heure !== null) setTimeout(() => direFee({ cle: "discrete", texte: `Tu me renvoies souvent vers ${decrireMinute(heure * 60)}. À cette heure-là, je garderai mes nouvelles pour plus tard.` }), 400);
    };
    window.addEventListener("pointerdown", ailleurs, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointerdown", ailleurs, true);
    };
  }, [parole, avecActions, zone]);
}

function ActionsParole({ parole }: { parole: Parole }) {
  const actions = parole.actions ?? [];
  if (!actions.length) return null;
  return (
    <div className="actions-c">
      {actions.map((a, i) => (
        <button
          key={a.texte}
          type="button"
          className={`pilule${i === 0 && actions.length > 1 ? " fee" : ""}`}
          onClick={() => {
            taireFee(parole.cle);
            a.faire?.();
          }}
        >
          {a.texte}
        </button>
      ))}
    </div>
  );
}

/**
 * Sa carte, dans la grille d'un espace : ce qu'elle dit (une remarque, un mot de l'autre, ce
 * qu'elle vient de faire) avec ses actions. Rien à dire : pas de carte.
 */
export function CarteTael({ vol }: { vol?: boolean }) {
  const parole = useParoleFee();
  const { attentes, ouvrirAttente, prenomAutre } = useOrbe();
  const fee = useFee();
  const attente: Attente | undefined = attentes[0];
  const carte = useRef<HTMLDivElement>(null);
  // Elle s'envole du salut jusqu'à sa carte quand la carte apparaît (mouvement « vivant »).
  const cle = parole ? `${parole.cle}:${parole.texte}` : attente ? attente.cle : null;
  useEffect(() => {
    if (!cle || !vol) return;
    const salut = document.querySelector(".page-dessus .orbe-salut svg");
    const arrivee = carte.current?.querySelector<HTMLElement>(".orbe");
    if (!salut || !arrivee || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = salut.getBoundingClientRect();
    const z = arrivee.getBoundingClientRect();
    if (!a.width || !z.width) return;
    const v = document.createElement("div");
    v.className = `orbe-vol orbe fee-${fee.teinte}`;
    v.style.left = `${a.left + a.width / 2 - 22}px`;
    v.style.top = `${a.top + a.height / 2 - 22}px`;
    v.appendChild(salut.cloneNode(true));
    document.body.appendChild(v);
    arrivee.style.opacity = "0";
    const dx = z.left - a.left - a.width / 2 + 22;
    const dy = z.top - a.top - a.height / 2 + 22;
    const anim = v.animate(
      [{ transform: "translate(0,0) scale(.8)" }, { transform: `translate(${dx * 0.5 + 24}px, ${dy * 0.4 - 30}px) scale(1.1)`, offset: 0.5 }, { transform: `translate(${dx}px, ${dy}px) scale(1)` }],
      { duration: 750, easing: "cubic-bezier(.3,.7,.3,1)", delay: 250 },
    );
    const finir = () => {
      v.remove();
      arrivee.style.opacity = "";
    };
    anim.onfinish = finir;
    return finir;
  }, [cle, vol, fee.teinte]);
  if (parole) return <CarteParole key={cle!} ref={carte} parole={parole} />;
  if (attente) {
    return (
      <div ref={carte} className="tuile fee-carte large" role="status">
        <Orbe />
        <small>{nomFee()}</small>
        <p>{phraseAttente(attente, prenomAutre)}</p>
        <div className="actions-c">
          <button type="button" className="pilule fee" onClick={() => ouvrirAttente(attente)}>Voir</button>
        </div>
      </div>
    );
  }
  return null;
}

function CarteParole({ parole, ref }: { parole: Parole; ref: React.RefObject<HTMLDivElement | null> }) {
  useVieParole(parole, ".fee-carte");
  return (
    <div ref={ref} className={`tuile fee-carte large${parole.de ? ` fee-${parole.de.teinte}` : ""}`} role="status">
      <Orbe />
      <small className={parole.de ? "de-lautre" : undefined}>{parole.de ? parole.de.prenom : nomFee()}</small>
      <p>{parole.texte}</p>
      <ActionsParole parole={parole} />
    </div>
  );
}

/** Sur une page sans sa carte : sa bulle, sous la barre du haut, près de l'orbe. */
export function BulleTael() {
  const parole = useParoleFee();
  return createPortal(
    <Presence>{parole && <Bulle key={`${parole.cle}:${parole.texte}`} parole={parole} />}</Presence>,
    document.body,
  );
}

function Bulle({ parole }: { parole: Parole }) {
  useVieParole(parole, ".bulle-tael");
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={ressortMotion("apparition")}
      className={`bulle-tael${parole.crie ? " crie" : ""}${parole.de ? ` fee-${parole.de.teinte}` : ""}`}
      role="status"
    >
      {parole.de && <span className="de">{parole.de.prenom}</span>}
      <span>{parole.texte}</span>
      <ActionsParole parole={parole} />
    </m.div>
  );
}

/** Quand elle écoute : l'orbe en grand et les ondes, au-dessus de la saisie (BarreJarvis). */
export function EcouteTael({ exemples }: { exemples: string }) {
  const fee = useFee();
  return (
    <div className="ecoute-tael" aria-live="polite">
      <div className={`grande fee-${fee.teinte}`} aria-hidden><DessinFee /></div>
      <div className="onde" aria-hidden><i /><i /><i /><i /><i /><i /><i /></div>
      <p>Je t'écoute.</p>
      <p className="ex">{exemples}</p>
      <button type="button" className="lien" onClick={ecrireAFee}>Écrire plutôt</button>
    </div>
  );
}

/** Sa feuille : ce qu'elle fait seule, et ce qu'elle a fait aujourd'hui, avec « Annuler ». */
export function FeuilleTael({ annuler }: { annuler: (modifications: unknown[]) => Promise<void> }) {
  const ouverte = useFeuilleTael();
  const niveau = useNiveau();
  const journal = useJournalTael();
  const aujourdhui = aujourdhuiLocal();
  const duJour = journalDuJour(journal, aujourdhui, (iso) => aujourdhuiLocal(new Date(iso)));
  const fee = useFee();
  return (
    <Feuille ouverte={ouverte} onFermer={() => ouvrirFeuilleTael(false)} titre={fee.nom} className="feuille-tael">
      <p className="discret" style={{ margin: 0 }}>Ce qu'elle fait seule, et ce qu'elle a fait.</p>
      <h3>Son niveau</h3>
      <div className="niveaux" role="radiogroup" aria-label={`Ce que ${fee.nom} fait seule`}>
        {NIVEAUX.map((n) => (
          <button
            key={n.id}
            type="button"
            className="niv"
            role="radio"
            aria-checked={niveau === n.id}
            onClick={() => {
              vibrer();
              choisirNiveau(n.id);
            }}
          >
            <span className="pt" aria-hidden />
            <div>
              <b>{n.titre}</b>
              <span>{n.detail}</span>
            </div>
          </button>
        ))}
      </div>
      <h3>Aujourd'hui</h3>
      {duJour.length === 0 ? (
        <p className="discret" style={{ margin: 0 }}>Rien encore aujourd'hui.</p>
      ) : (
        <div className="journal-tael">
          {duJour.map((l) => (
            <div key={l.id} className={`jl${l.annulee ? " annule" : ""}`}>
              <time dateTime={l.quand}>{heureMinute(new Date(l.quand))}</time>
              <span>{l.texte}</span>
              {l.modifications && !l.annulee && (
                <button
                  type="button"
                  className="pilule"
                  onClick={() => {
                    vibrer();
                    marquerAnnuleeAuJournal(l.id);
                    void annuler(l.modifications!);
                  }}
                >
                  Annuler
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Feuille>
  );
}
