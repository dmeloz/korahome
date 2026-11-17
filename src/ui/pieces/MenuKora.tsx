import { useMemo, useRef, useState } from "react";
import { cleMenu, comptesDuMenu, pastille, SECTIONS_MENU, type EspaceMenu } from "../../domaine/menu";
import { rechercher, type OuRecherche } from "../../domaine/recherche";
import { definition, modulesCherches, type WidgetId } from "../../domaine/tableauDeBord";
import { usePiegeFocus } from "../focus";
import { Icone, type NomIcone } from "../Icone";
import { PICTOS, type DonneesModule } from "../modules";
import { m } from "../moteur/pieces";
import { ressortMotion } from "../moteur/ressorts";
import { donneesRecherche } from "./RechercheFee";

// Le menu latéral de l'iPhone (Kora 0.1.18, maquette validée par Melo le 17 novembre 2026, d'après
// sa référence « SideBar UI ») : un panneau de verre fumé qui glisse depuis la gauche, l'accueil
// recule derrière. Sa ligne (soi et le foyer), la recherche de tout Kora, puis chaque espace en
// petites capitales (son titre ouvre sa page de cartes) et ses pages, avec les pastilles laiton
// de ce qui attend. Il se ferme en touchant à côté, en le poussant vers la gauche ou par la flèche.
// Il glisse en CSS (styles/espaces.css) ; Motion soulève chaque ligne sous le doigt, comme la référence.
// Règles et pastilles : src/domaine/menu.ts. Équivalent natif : NavigationSplitView en barre latérale.

const PICTOS_MENU: Record<string, NomIcone> = {
  "chef:courses": "panier", "chef:semaine": "toque", "chef:recettes": "note", "chef:frigo": "frigo",
  "maison:entretien": "outil", "maison:mitsu": "chat", "maison:jardin": "feuille", "maison:vetements": "coeur",
  "taches:taches": "coche", "taches:agenda": "calendrier", "taches:administratif": "dossier",
  "budget:mois": "portefeuille", "budget:depenses": "ticket", "budget:charges": "activite",
};

/** Où l'on est, pour mettre sa ligne en laiton. */
export type IciMenu = { espace: "aujourdhui" | "reglages" } | { espace: EspaceMenu; onglet?: string } | null;

const TROUVAILLES_MAX = 8;

export function MenuKora(props: {
  ouvert: boolean;
  fermer: () => void;
  ici: IciMenu;
  donnees: DonneesModule;
  alerteReglages?: boolean;
  aujourdhui: () => void;
  reglages: () => void;
  espace: (id: EspaceMenu) => void;
  page: (id: EspaceMenu, onglet: string) => void;
  module: (id: WidgetId) => void;
  aller: (ou: OuRecherche) => void;
  partage: () => void;
}) {
  const zone = useRef<HTMLElement>(null);
  const [cherche, setCherche] = useState("");
  // Le doigt qui pousse le menu vers la gauche : il le suit, et au-delà de 60 points il se ferme.
  const depart = useRef<{ x: number; y: number } | null>(null);
  const [decale, setDecale] = useState<number | null>(null);
  usePiegeFocus(props.ouvert, zone, props.fermer);
  const d = props.donnees;
  const comptes = useMemo(
    () => comptesDuMenu({ listes: d.listes, elements: d.elements, taches: d.taches, budget: d.budget, membreId: d.membreId, aujourdhui: d.aujourdhui }),
    [d.listes, d.elements, d.taches, d.budget, d.membreId, d.aujourdhui],
  );
  const moi = d.foyer.membres.find((x) => x.id === d.membreId);
  const autres = d.foyer.membres.filter((x) => x.id !== d.membreId).map((x) => x.prenom);
  const texte = cherche.trim();
  const modules = texte.length >= 2 ? modulesCherches(texte).slice(0, 3) : [];
  const trouvailles = texte.length >= 2 ? rechercher(donneesRecherche(d), texte).slice(0, TROUVAILLES_MAX) : [];

  // Choisir referme le menu, oublie la recherche, puis ouvre la page.
  const partir = (aller: () => void) => {
    setCherche("");
    props.fermer();
    aller();
  };
  const ici = props.ici;
  const courant = (ok: boolean) => (ok ? ("page" as const) : undefined);

  return (
    <nav
      ref={zone}
      tabIndex={-1}
      className={`menu-kora${props.ouvert ? " ouvert" : ""}${decale !== null ? " glisse" : ""}`}
      style={decale ? { translate: `${decale}px 0` } : undefined}
      aria-label="Menu de Kora"
      aria-hidden={!props.ouvert}
      inert={!props.ouvert}
      onTouchStart={(e) => {
        depart.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
      }}
      onTouchMove={(e) => {
        const d0 = depart.current;
        if (!d0) return;
        const dx = e.touches[0].clientX - d0.x;
        // Un défilement de la liste garde son geste ; un geste vers la gauche pousse le menu.
        if (decale === null && Math.abs(e.touches[0].clientY - d0.y) > Math.abs(dx)) depart.current = null;
        else if (dx < -8 || decale !== null) setDecale(Math.min(0, dx));
      }}
      onTouchEnd={() => {
        if (decale !== null && decale < -60) props.fermer();
        depart.current = null;
        setDecale(null);
      }}
    >
      <div className="menu-tete">
        <span className="menu-marque">Kora</span>
        <button type="button" className="menu-fermer" aria-label="Fermer le menu" onClick={props.fermer}>
          <Icone nom="retour" taille={16} />
        </button>
      </div>
      <m.button type="button" className="menu-qui" whileTap={{ scale: 0.98, y: -2 }} onClick={() => partir(props.partage)}>
        <span className="menu-avatar" aria-hidden>{(moi?.prenom ?? "K").slice(0, 1)}</span>
        <span className="menu-qui-texte">
          <b>{moi?.prenom ?? "Ce téléphone"}</b>
          <span>Foyer {d.foyer.nom}{autres.length ? ` · avec ${autres.join(", ")}` : ""}</span>
        </span>
        <Icone nom="suivant" taille={14} />
      </m.button>
      <label className="menu-cherche">
        <Icone nom="loupe" taille={16} />
        <input
          id="menu-cherche"
          type="search"
          value={cherche}
          onChange={(e) => setCherche(e.target.value)}
          placeholder="Chercher dans Kora"
          aria-label="Chercher dans Kora"
          enterKeyHint="search"
          autoComplete="off"
        />
      </label>
      <div className="menu-defile">
        {texte.length >= 2 ? (
          <div role="list" aria-label="Trouvé dans Kora" className="menu-trouvailles">
            {!modules.length && !trouvailles.length && <p className="menu-vide">Rien trouvé pour « {texte} ».</p>}
            {modules.map((id) => (
              <button key={id} role="listitem" type="button" className="trouvaille" onClick={() => partir(() => props.module(id))}>
                <Icone nom={PICTOS[id]} taille={16} />
                <span className="trouvaille-texte">{definition(id).titre}</span>
                <Icone nom="suivant" taille={14} />
              </button>
            ))}
            {trouvailles.map((t) => (
              <button key={t.cle} role="listitem" type="button" className="trouvaille" onClick={() => partir(() => props.aller(t.ou))}>
                <Icone nom="loupe" taille={16} />
                <span className="trouvaille-texte">
                  {t.titre}
                  <span className="discret">{t.detail}</span>
                </span>
                <Icone nom="suivant" taille={14} />
              </button>
            ))}
          </div>
        ) : (
          <>
            <Entree libelle="Aujourd'hui" picto="soleil" actuel={courant(ici?.espace === "aujourdhui")} onClick={() => partir(props.aujourdhui)} />
            {SECTIONS_MENU.map((s) => (
              <section key={s.espace} aria-label={s.titre}>
                <button
                  type="button"
                  className="menu-section"
                  aria-current={courant(ici?.espace === s.espace && !("onglet" in ici && ici.onglet))}
                  onClick={() => partir(() => props.espace(s.espace))}
                >
                  {s.titre}
                  <Icone nom="suivant" taille={12} />
                </button>
                {s.entrees.map((e) => {
                  const cle = cleMenu(s.espace, e.onglet);
                  return (
                    <Entree
                      key={cle}
                      libelle={e.libelle}
                      picto={PICTOS_MENU[cle] ?? "liste"}
                      compte={comptes[cle]}
                      actuel={courant(ici?.espace === s.espace && "onglet" in ici && ici.onglet === e.onglet)}
                      onClick={() => partir(() => props.page(s.espace, e.onglet))}
                    />
                  );
                })}
              </section>
            ))}
            <div className="menu-sep" aria-hidden />
            <Entree libelle="Réglages" picto="reglages" alerte={props.alerteReglages} actuel={courant(ici?.espace === "reglages")} onClick={() => partir(props.reglages)} />
          </>
        )}
      </div>
    </nav>
  );
}

function Entree(p: { libelle: string; picto: NomIcone; compte?: number; alerte?: boolean; actuel?: "page"; onClick: () => void }) {
  return (
    <m.button type="button" className="menu-entree" aria-current={p.actuel} whileTap={{ scale: 0.98, y: -2 }} transition={ressortMotion("apparition")} onClick={p.onClick}>
      <Icone nom={p.picto} taille={20} />
      <span className="menu-libelle">{p.libelle}</span>
      {p.compte ? <span className="menu-compte" aria-label={`${p.compte} en attente`}>{pastille(p.compte)}</span> : null}
      {p.alerte ? <span className="alerte" aria-label="Nouvelle version" /> : null}
    </m.button>
  );
}
