import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { basculerSigne, SIGNES, SIGNES_MAX, type Signe, type ValeurSigne } from "../../domaine/signes";
import { enregistrerDate, enregistrerSignes, lireDate, type ReglageDate } from "../accueilLocal";
import { Feuille } from "../Feuille";
import { vibrer } from "../haptique";
import { Icone, PICTO_HUMEUR, pictoMeteo, type NomIcone } from "../Icone";

// Le haut de l'accueil, comme l'écran verrouillé de l'iPhone : une grande date seule, qu'on
// glisse à gauche ou au centre, et au bout de sa ligne les petits signes que chacun choisit.
// En défilant, la date se replie dans une petite barre de verre.
// Équivalent natif : un Text en .largeTitle et une HStack de SF Symbols, toolbar(.principal).

const APPUI_LONG_MS = 450;
/** Au-delà, le doigt a glissé la date. */
const GLISSE_DATE_PX = 40;

export function GrandeDate({ date }: { date: Date }) {
  const [reglage, setReglage] = useState<ReglageDate>(lireDate);
  const depart = useRef<number | null>(null);
  const jour = date.toLocaleDateString("fr-CH", { weekday: "long" });
  const mois = date.toLocaleDateString("fr-CH", { month: "long" });
  const placer = (place: ReglageDate["place"]) => {
    if (place === reglage.place) return;
    vibrer();
    const r = { ...reglage, place };
    setReglage(r);
    enregistrerDate(r);
  };
  // La taille se règle dans Ce téléphone : on la relit en revenant sur l'accueil.
  useEffect(() => {
    const relire = () => setReglage(lireDate());
    window.addEventListener("korahome:date", relire);
    return () => window.removeEventListener("korahome:date", relire);
  }, []);
  return (
    <div
      className={`grande-date ${reglage.place}`}
      style={{ ["--taille-date" as string]: `${reglage.taille}px` }}
      data-geste-propre
      onPointerDown={(e) => (depart.current = e.clientX)}
      onPointerUp={(e) => {
        if (depart.current === null) return;
        const dx = e.clientX - depart.current;
        depart.current = null;
        if (dx > GLISSE_DATE_PX) placer("centre");
        else if (dx < -GLISSE_DATE_PX) placer("gauche");
      }}
      onPointerCancel={() => (depart.current = null)}
    >
      <span className="date-chiffre">{date.getDate()}</span>
      <span className="date-mots">
        <b>{jour.charAt(0).toUpperCase() + jour.slice(1)}</b>
        <span>{mois}</span>
      </span>
    </div>
  );
}

/** La date repliée dans une petite barre de verre, quand on a fait défiler l'accueil. */
export function DateRepliee({ date, cible }: { date: Date; cible: RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = cible.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setVisible(!e.isIntersecting), { rootMargin: "-20px 0px 0px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [cible]);
  const jour = date.toLocaleDateString("fr-CH", { weekday: "long" });
  return (
    <div className={`date-repliee${visible ? " visible" : ""}`} aria-hidden>
      {jour.charAt(0).toUpperCase() + jour.slice(1)} {date.getDate()}
    </div>
  );
}

const PICTO_SIGNE: Record<Signe, NomIcone> = { humeurs: "sourire", compte: "sablier", rdv: "calendrier", meteo: "soleil", mitsu: "chat" };

/**
 * Les petits signes au bout de la ligne de la date. Toucher : leur page. Appui long :
 * choisir les siens, trois au plus.
 */
export function Signes(props: {
  valeurs: readonly ValeurSigne[];
  choisis: readonly Signe[];
  changer: (s: Signe[]) => void;
  /** Toucher un signe : sa page s'ouvre (Nos mots, Agenda, Jardin, Mitsu). */
  toucher: (v: ValeurSigne) => void;
}) {
  const [choix, setChoix] = useState(false);
  const appui = useRef<{ minuterie: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const ignorer = useRef(false);
  const lacher = () => {
    if (appui.current) clearTimeout(appui.current.minuterie);
    appui.current = null;
  };
  const appuyer = (e: PointerEvent) => {
    lacher();
    appui.current = {
      x: e.clientX,
      y: e.clientY,
      minuterie: setTimeout(() => {
        appui.current = null;
        ignorer.current = true;
        vibrer();
        setChoix(true);
      }, APPUI_LONG_MS),
    };
  };
  const bouger = (e: PointerEvent) => {
    const a = appui.current;
    if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) > 10) lacher();
  };
  const basculer = (id: Signe) => {
    const suivants = basculerSigne(props.choisis, id);
    if (suivants.length === props.choisis.length && !props.choisis.includes(id)) return;
    vibrer();
    enregistrerSignes(suivants);
    props.changer(suivants);
  };

  return (
    <>
      <div
        className="signes-accueil"
        onPointerDown={appuyer}
        onPointerMove={bouger}
        onPointerUp={lacher}
        onPointerCancel={lacher}
        onPointerLeave={lacher}
        onContextMenu={(e) => e.preventDefault()}
      >
        {props.valeurs.length === 0 && (
          <button className="signe vide" onClick={() => setChoix(true)} aria-label="Choisir des petits signes">
            <Icone nom="ajouter" taille={14} />
          </button>
        )}
        {props.valeurs.map((v) => (
          <button
            key={v.id}
            className={`signe signe-${v.id}${v.urgent ? " urgent" : ""}`}
            aria-label={v.phrase}
            onClick={() => {
              if (ignorer.current) {
                ignorer.current = false;
                return;
              }
              vibrer();
              props.toucher(v);
            }}
          >
            {v.humeurs?.some(Boolean) ? (
              v.humeurs.map((h, i) => (
                <span key={i} className={`signe-humeur${h ? "" : " sans"}`}>{h && <Icone nom={PICTO_HUMEUR[h] ?? "sourire"} taille={13} />}</span>
              ))
            ) : v.humeurs ? (
              // Personne n'a encore dit son humeur : un sourire à toucher plutôt que deux ronds vides.
              <Icone nom="sourire" taille={16} />
            ) : (
              <Icone nom={v.code !== undefined ? pictoMeteo(v.code) : PICTO_SIGNE[v.id]} taille={14} />
            )}
            {v.court && <span className="signe-court">{v.court}</span>}
          </button>
        ))}
      </div>

      <Feuille ouverte={choix} onFermer={() => setChoix(false)} titre="Tes petits signes">
        <p className="discret">À côté de la date, {SIGNES_MAX} au plus. Ce choix reste sur ce téléphone.</p>
        <ul className="carte groupe">
          {SIGNES.map((s) => {
            const coche = props.choisis.includes(s.id);
            const plein = !coche && props.choisis.length >= SIGNES_MAX;
            return (
              <li key={s.id}>
                <button className="ligne ligne-reglage" role="checkbox" aria-checked={coche} disabled={plein} onClick={() => basculer(s.id)}>
                  <span className="picto-reglage"><Icone nom={PICTO_SIGNE[s.id]} taille={17} /></span>
                  <span className="ligne-texte">
                    {s.nom}
                    <span className="tache-details">{s.detail}</span>
                  </span>
                  {coche && <span className="coche-reglage"><Icone nom="coche" taille={18} /></span>}
                </button>
              </li>
            );
          })}
        </ul>
      </Feuille>
    </>
  );
}

/** Ce que dit un signe, en petite bulle sous la ligne de la date (en attendant la fée). */
export function BulleSigne({ valeur, fermer, ouvrir }: { valeur: ValeurSigne | null; fermer: () => void; ouvrir: (v: ValeurSigne) => void }) {
  useEffect(() => {
    if (!valeur) return;
    const id = setTimeout(fermer, 7000);
    const ailleurs = (e: globalThis.PointerEvent) => {
      if (!(e.target as Element).closest(".bulle-signe, .signes-accueil")) fermer();
    };
    window.addEventListener("pointerdown", ailleurs, true);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointerdown", ailleurs, true);
    };
  }, [valeur, fermer]);
  if (!valeur) return null;
  return (
    <div className="bulle-signe" role="status">
      <p>{valeur.phrase}</p>
      <button className="lien" onClick={() => ouvrir(valeur)}>Ouvrir</button>
    </div>
  );
}
