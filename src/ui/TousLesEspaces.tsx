import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { evenementsDe } from "../domaine/agenda";
import { grouperTrouvailles, rechercher, type OuRecherche } from "../domaine/recherche";
import { definition, ESPACES, modulesCherches, modulesDeLEspace, type WidgetId } from "../domaine/tableauDeBord";
import { vibrer } from "./haptique";
import { Icone, type NomIcone } from "./Icone";
import { PICTOS, type DonneesModule } from "./modules";
import { nomFee } from "./fee";
import { APPUI_LONG_MS } from "./gestes";

// « Tous les espaces » : on tire l'accueil vers le bas et une feuille de verre descend, avec la
// recherche, chaque module rangé par usage du quotidien, les rappels et les réglages. Aucune
// catégorie ne se perd : un widget retiré de l'accueil reste ici. Un appui long sur une tuile,
// puis on la glisse sur l'accueil : elle devient un widget.
// Équivalent natif : la bibliothèque d'apps de l'iPhone, avec .searchable et un draggable.

/** Remontée d'autant par la poignée, la feuille se referme. */
const SEUIL_FERMETURE = 60;

export interface LiensEspaces {
  ouvrirReglages: () => void;
  ouvrirRappels: () => void;
  ouvrirMots: () => void;
  ouvrirJarvis: () => void;
  rappelsNonLus: number;
  nouvelleVersion: boolean;
  /** La personne de ce téléphone, pour la pastille des réglages. */
  moi: { prenom: string; couleur: string } | null;
}

export function TousLesEspaces(props: {
  ouverte: boolean;
  /** Une tuile part vers l'accueil : la feuille se replie sans se démonter, le doigt la tient encore. */
  repliee: boolean;
  fermer: () => void;
  donnees: DonneesModule;
  aller: (ou: OuRecherche) => void;
  ouvrirModule: (id: WidgetId) => void;
  /** En rangeant l'accueil, toucher une tuile l'y ajoute. */
  ajouter?: (id: WidgetId) => void;
  /** Appui long sur une tuile : elle part vers l'accueil sous le doigt. */
  glisser: (id: WidgetId, x: number, y: number) => void;
  liens: LiensEspaces;
}) {
  const [presente, setPresente] = useState(props.ouverte);
  const [texte, setTexte] = useState("");
  const [tire, setTire] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const appui = useRef<{ minuterie: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const ignorerClic = useRef(false);
  const poignee = useRef<number | null>(null);

  useEffect(() => {
    if (props.ouverte) {
      setPresente(true);
      setTexte("");
      setTire(0);
      return;
    }
    const id = setTimeout(() => setPresente(false), 320);
    return () => clearTimeout(id);
  }, [props.ouverte]);

  useEffect(() => {
    if (!props.ouverte || props.repliee) return;
    document.documentElement.classList.add("feuille-ouverte");
    const touche = (e: KeyboardEvent) => e.key === "Escape" && props.fermer();
    window.addEventListener("keydown", touche);
    return () => {
      document.documentElement.classList.remove("feuille-ouverte");
      window.removeEventListener("keydown", touche);
    };
  }, [props.ouverte, props.repliee]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!presente) return null;

  const lacher = () => {
    if (appui.current) clearTimeout(appui.current.minuterie);
    appui.current = null;
  };
  const appuyer = (e: PointerEvent, id: WidgetId) => {
    lacher();
    const x = e.clientX;
    const y = e.clientY;
    appui.current = {
      x,
      y,
      minuterie: setTimeout(() => {
        appui.current = null;
        ignorerClic.current = true;
        champ.current?.blur();
        vibrer();
        props.glisser(id, x, y);
      }, APPUI_LONG_MS),
    };
  };
  const bouger = (e: PointerEvent) => {
    const a = appui.current;
    if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) > 10) lacher();
  };

  const tuile = (id: WidgetId) => {
    const def = definition(id);
    return (
      <button
        key={id}
        className="tuile-espace"
        onPointerDown={(e) => appuyer(e, id)}
        onPointerMove={bouger}
        onPointerUp={lacher}
        onPointerCancel={lacher}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (ignorerClic.current) {
            ignorerClic.current = false;
            return;
          }
          vibrer();
          if (props.ajouter) props.ajouter(id);
          else {
            props.fermer();
            props.ouvrirModule(id);
          }
        }}
      >
        <span className="tuile-picto"><Icone nom={PICTOS[id]} taille={22} /></span>
        <span className="tuile-nom">{def.titre}</span>
      </button>
    );
  };
  const lien = (nom: string, picto: NomIcone, ouvrir: () => void) => (
    <button
      key={nom}
      className="tuile-espace"
      onClick={() => {
        props.fermer();
        ouvrir();
      }}
    >
      <span className="tuile-picto"><Icone nom={picto} taille={22} /></span>
      <span className="tuile-nom">{nom}</span>
    </button>
  );

  const cherche = texte.trim().length >= 2;
  const d = props.donnees;
  const modules = cherche ? modulesCherches(texte) : [];
  const groupes = cherche ? grouperTrouvailles(rechercher({ ...d, evenements: evenementsDe(d.agenda) }, texte)) : [];
  const { liens } = props;
  const sortie = !props.ouverte || props.repliee;

  return createPortal(
    <>
      <div className={`voile voile-espaces${sortie ? " sortie" : ""}`} onClick={props.fermer} aria-hidden />
      <div
        className={`tous-espaces${sortie ? " sortie" : ""}${tire ? " tiree" : ""}`}
        style={tire ? { transform: `translateY(${-tire}px)` } : undefined}
        role="dialog"
        aria-label="Tous les espaces"
      >
        <div className="espaces-haut">
          <label className="champ-recherche">
            <Icone nom="loupe" taille={18} />
            <input ref={champ} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Chercher dans Kora" enterKeyHint="search" aria-label="Chercher dans Kora" />
          </label>
          <button
            className="bouton-icone avec-alerte"
            onClick={() => {
              props.fermer();
              liens.ouvrirRappels();
            }}
            aria-label={liens.rappelsNonLus ? `Rappels, ${liens.rappelsNonLus} nouveaux` : "Rappels"}
          >
            <Icone nom="cloche" taille={20} />
            {liens.rappelsNonLus > 0 && <span className="alerte compte" aria-hidden>{liens.rappelsNonLus}</span>}
          </button>
          <button
            className="avatar-reglages avec-alerte"
            style={liens.moi ? { background: `color-mix(in srgb, ${liens.moi.couleur} 26%, var(--surface))` } : undefined}
            onClick={() => {
              props.fermer();
              liens.ouvrirReglages();
            }}
            aria-label={liens.nouvelleVersion ? "Réglages, nouvelle version disponible" : "Réglages"}
          >
            {liens.moi ? liens.moi.prenom.charAt(0) : <Icone nom="reglages" taille={20} />}
            {liens.nouvelleVersion && <span className="alerte" aria-hidden />}
          </button>
        </div>

        <div className="espaces-corps">
          {/* Tous les modules sur une seule grille, rangés par usage : ménage, courses, cuisine, budget, agenda. */}
          {!cherche && (
            <div className="grille-espaces">
              {ESPACES.flatMap((e) => modulesDeLEspace(e.id)).map(tuile)}
              {!props.ajouter && lien("Nos mots", "coeur", liens.ouvrirMots)}
              {!props.ajouter && lien(nomFee(), "jarvis", liens.ouvrirJarvis)}
            </div>
          )}
          {cherche && modules.length > 0 && <div className="grille-espaces">{modules.map(tuile)}</div>}
          {cherche && modules.length === 0 && groupes.length === 0 && <p className="vide">Rien trouvé pour « {texte.trim()} ».</p>}
          {groupes.map((g) => (
            <section key={g.section}>
              <h2 className="rayon">{g.section}</h2>
              <ul className="carte groupe">
                {g.trouvailles.map((t) => (
                  <li key={t.cle}>
                    <button
                      className="ligne"
                      onClick={() => {
                        props.fermer();
                        props.aller(t.ou);
                      }}
                    >
                      <span className="ligne-texte">
                        {t.titre}
                        <span className="tache-details">{t.detail}</span>
                      </span>
                      <span className="chevron"><Icone nom="suivant" taille={16} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="discret espaces-pied">
            {props.ajouter ? "Touche un espace pour l'ajouter, ou glisse-le à sa place." : "Garde le doigt sur un espace et glisse-le sur l'accueil pour en faire un widget."}
          </p>
        </div>

        <div
          className="espaces-poignee"
          onPointerDown={(e) => {
            poignee.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => poignee.current !== null && setTire(Math.max(0, poignee.current - e.clientY))}
          onPointerUp={() => {
            poignee.current = null;
            if (tire > SEUIL_FERMETURE) props.fermer();
            else setTire(0);
          }}
          onPointerCancel={() => {
            poignee.current = null;
            setTire(0);
          }}
          onClick={() => !tire && props.fermer()}
          role="button"
          aria-label="Fermer"
        >
          <span className="poignee" />
        </div>
      </div>
    </>,
    document.body,
  );
}
