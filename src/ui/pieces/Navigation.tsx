import { Fragment, useEffect, useState } from "react";
import { vibrer } from "../haptique";
import { Icone, type NomIcone } from "../Icone";

// La navigation de Kora 0.1 (panneau validé par Melo le 4 novembre 2026) : sur l'iPhone, un seul
// bouton rond en bas à gauche qui déploie les six espaces en pile ; sur l'iPad et l'iPhone Duo
// ouvert (dès 640 points), un rail de ronds à gauche, avec les noms dès 900 points. Les deux
// sont là, le style (styles/espaces.css) montre l'un ou l'autre selon la largeur.
// Équivalent natif : un Menu flottant sur iPhone, une NavigationSplitView en colonne sur iPad.

export type EspaceId = "aujourdhui" | "chef" | "maison" | "taches" | "budget" | "reglages";

export interface EspaceNav {
  id: EspaceId;
  libelle: string;
  picto: NomIcone;
  /** Une pastille rouge : quelque chose attend là (une nouvelle version dans Réglages). */
  alerte?: boolean;
}

export const ESPACES: readonly EspaceNav[] = [
  { id: "aujourdhui", libelle: "Aujourd'hui", picto: "soleil" },
  { id: "chef", libelle: "Cuisine", picto: "toque" },
  { id: "maison", libelle: "Maison", picto: "maison" },
  { id: "taches", libelle: "Organisation", picto: "coche" },
  { id: "budget", libelle: "Budget", picto: "portefeuille" },
  { id: "reglages", libelle: "Réglages", picto: "reglages" },
];

export function Navigation(props: {
  actuel: EspaceId | undefined;
  aller: (id: EspaceId) => void;
  /** Le bouton rond de l'iPhone : seulement sur les pages de départ ; dessous, la barre du haut suffit. */
  pile: boolean;
  alertes?: Partial<Record<EspaceId, boolean>>;
}) {
  const [ouvert, setOuvert] = useState(false);
  // Une autre page, une feuille : la pile se replie.
  useEffect(() => {
    if (!props.pile) setOuvert(false);
  }, [props.pile]);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    window.addEventListener("keydown", fermer);
    return () => window.removeEventListener("keydown", fermer);
  }, [ouvert]);
  const choisir = (id: EspaceId) => {
    setOuvert(false);
    if (id !== props.actuel) props.aller(id);
  };
  const alerte = (id: EspaceId) => (props.alertes?.[id] ? <span className="alerte" aria-hidden /> : null);
  return (
    <>
      <nav className="rail" aria-label="Espaces">
        {ESPACES.map((e, i) => (
          <Fragment key={e.id}>
            {i === ESPACES.length - 1 && <div className="sep" aria-hidden />}
            <button type="button" aria-current={e.id === props.actuel ? "page" : undefined} aria-label={e.libelle} onClick={() => choisir(e.id)}>
              <Icone nom={e.picto} taille={20} />
              <span className="nom">{e.libelle}</span>
              {alerte(e.id)}
            </button>
          </Fragment>
        ))}
      </nav>
      {props.pile && <>
      <button type="button" className={`voile-pile${ouvert ? " ouvert" : ""}`} aria-label="Fermer" tabIndex={ouvert ? undefined : -1} onClick={() => setOuvert(false)} />
      <nav className={`pile-kora${ouvert ? " ouvert" : ""}`} aria-label="Espaces">
        <button
          type="button"
          className="kora"
          aria-label={ouvert ? "Fermer" : "Ouvrir Kora"}
          aria-expanded={ouvert}
          onClick={() => {
            vibrer();
            setOuvert((o) => !o);
          }}
        >
          <Icone nom={ouvert ? "fermer" : "espaces"} taille={22} />
          {!ouvert && Object.values(props.alertes ?? {}).some(Boolean) && <span className="alerte" aria-hidden />}
        </button>
        {ESPACES.map((e) => (
          <button key={e.id} type="button" className="item" aria-current={e.id === props.actuel ? "page" : undefined} tabIndex={ouvert ? undefined : -1} onClick={() => choisir(e.id)}>
            <span className="rond">
              <Icone nom={e.picto} taille={20} />
              {alerte(e.id)}
            </span>
            <span className="nom">{e.libelle}</span>
          </button>
        ))}
      </nav>
      </>}
    </>
  );
}
