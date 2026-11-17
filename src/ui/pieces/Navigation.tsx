import { Fragment, useEffect, useState, type ComponentProps } from "react";
import { vibrer } from "../haptique";
import { Icone, type NomIcone } from "../Icone";
import { MenuKora } from "./MenuKora";

// La navigation de Kora 0.1 (panneau validé par Melo le 4 novembre 2026) : sur l'iPhone, un seul
// bouton rond en bas à gauche qui ouvre le menu latéral (MenuKora, depuis 0.1.18 à la place de
// la pile de six ronds ; aussi en glissant depuis le bord gauche de l'accueil) ; sur l'iPad et l'iPhone Duo
// ouvert (dès 640 points), un rail de ronds à gauche, avec les noms dès 900 points. Les deux
// sont là, le style (styles/espaces.css) montre l'un ou l'autre selon la largeur.
// Équivalent natif : une barre latérale repliée sur iPhone, une NavigationSplitView en colonne sur iPad.

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
  /** Le menu latéral de l'iPhone : tout sauf l'ouverture, que la navigation tient. */
  menu: Omit<ComponentProps<typeof MenuKora>, "ouvert" | "fermer" | "alerteReglages">;
  /** Sur l'accueil seulement (ailleurs le bord gauche ramène en arrière) : glisser depuis le bord ouvre le menu. */
  bordOuvre: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  // Une autre page, une feuille : la pile se replie.
  useEffect(() => {
    if (!props.pile) setOuvert(false);
  }, [props.pile]);
  // Le menu ouvert : la page derrière recule (styles/pieces.css) et ne défile plus. Échap le ferme (usePiegeFocus).
  useEffect(() => {
    if (!ouvert) return;
    document.documentElement.classList.add("menu-ouvert");
    return () => document.documentElement.classList.remove("menu-ouvert");
  }, [ouvert]);
  // Glisser depuis le bord gauche de l'accueil ouvre le menu, comme sur la référence de Melo.
  useEffect(() => {
    if (!props.bordOuvre || ouvert) return;
    let depart: { x: number; y: number } | null = null;
    const debut = (e: TouchEvent) => {
      const t = e.touches[0];
      depart = e.touches.length === 1 && t.clientX < 24 && innerWidth < 640 ? { x: t.clientX, y: t.clientY } : null;
    };
    const bouge = (e: TouchEvent) => {
      if (!depart) return;
      const t = e.touches[0];
      const dx = t.clientX - depart.x;
      if (Math.abs(t.clientY - depart.y) > 40) depart = null;
      else if (dx > 50) {
        depart = null;
        vibrer();
        setOuvert(true);
      }
    };
    window.addEventListener("touchstart", debut, { passive: true });
    window.addEventListener("touchmove", bouge, { passive: true });
    return () => {
      window.removeEventListener("touchstart", debut);
      window.removeEventListener("touchmove", bouge);
    };
  }, [props.bordOuvre, ouvert]);
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
      <button type="button" className={`voile-pile${ouvert ? " ouvert" : ""}`} aria-label="Fermer" inert={!ouvert} onClick={() => setOuvert(false)} />
      <MenuKora {...props.menu} ouvert={ouvert} fermer={() => setOuvert(false)} alerteReglages={props.alertes?.reglages} />
      <div className={`pile-kora${ouvert ? " ouvert" : ""}`}>
        <button
          type="button"
          className="kora"
          aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={ouvert}
          onClick={() => {
            vibrer();
            setOuvert((o) => !o);
          }}
        >
          <Icone nom="menu" taille={22} />
          {!ouvert && Object.values(props.alertes ?? {}).some(Boolean) && <span className="alerte" aria-hidden />}
        </button>
      </div>
      </>}
    </>
  );
}
