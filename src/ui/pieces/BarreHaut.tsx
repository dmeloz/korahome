import { useEffect, useRef, useState } from "react";
import type { WidgetId } from "../../domaine/tableauDeBord";
import { vibrer } from "../haptique";
import { Icone, type NomIcone } from "../Icone";
import { Presence, m } from "../moteur/pieces";
import { ressortMotion } from "../moteur/ressorts";

// La barre du haut, la même sur chaque page (depuis 0.0.71) : le retour à gauche, le nom de
// la page au milieu quand son grand titre est passé sous la barre, et à droite le sélecteur
// des six espaces, pour passer de Cuisine à Budget sans repasser par l'accueil.
// Équivalent natif : la barre d'une NavigationStack (.navigationBarTitleDisplayMode(.large))
// avec un Menu dans .toolbar(.topBarTrailing).

export interface EspaceBarre {
  id: WidgetId;
  libelle: string;
  picto: NomIcone;
}

export function BarreHaut(props: {
  /** Le nom de la page d'avant, sur le bouton retour. */
  retour: string;
  revenir?: () => void;
  /** Le nom de cette page, montré quand son grand titre a défilé. */
  titre: string;
  espaces: readonly EspaceBarre[];
  /** L'espace ouvert, coché dans le sélecteur. */
  actuel?: WidgetId;
  allerA: (id: WidgetId) => void;
  /** Une page d'en dessous : la barre est là, mais on ne la touche pas. */
  inerte?: boolean;
}) {
  const barre = useRef<HTMLElement>(null);
  const [titreVisible, setTitreVisible] = useState(false);
  const [menu, setMenu] = useState(false);

  // Le titre passe dans la barre quand le grand titre de la page glisse dessous.
  useEffect(() => {
    if (props.inerte) return;
    const verifier = () => {
      const h1 = barre.current?.parentElement?.querySelector(".page-entete h1");
      const bas = barre.current?.getBoundingClientRect().bottom ?? 0;
      setTitreVisible(!!h1 && h1.getBoundingClientRect().bottom < bas);
    };
    verifier();
    window.addEventListener("scroll", verifier, { passive: true });
    return () => window.removeEventListener("scroll", verifier);
  }, [props.inerte]);

  // Un toucher ailleurs referme le menu.
  useEffect(() => {
    if (!menu) return;
    const ailleurs = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.(".barre-haut-menu, .barre-haut-espaces")) setMenu(false);
    };
    window.addEventListener("pointerdown", ailleurs, true);
    return () => window.removeEventListener("pointerdown", ailleurs, true);
  }, [menu]);

  const tab = props.inerte ? -1 : undefined;
  return (
    <header ref={barre} className={`barre-haut${titreVisible ? " avec-titre" : ""}`}>
      <button className="retour" onClick={props.inerte ? undefined : props.revenir} tabIndex={tab}>
        <Icone nom="retour" taille={22} />
        <span className="retour-libelle">{props.retour}</span>
      </button>
      <span className="barre-haut-titre" aria-hidden={!titreVisible}>{props.titre}</span>
      <button
        className="barre-haut-espaces"
        aria-label="Changer d'espace"
        aria-expanded={menu}
        tabIndex={tab}
        onClick={() => {
          vibrer();
          setMenu((o) => !o);
        }}
      >
        <Icone nom="espaces" taille={20} />
      </button>
      <Presence>
        {menu && (
          <m.nav
            className="barre-haut-menu"
            aria-label="Espaces"
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={ressortMotion("apparition")}
          >
            {props.espaces.map((e) => (
              <button
                key={e.id}
                className={e.id === props.actuel ? "actuel" : undefined}
                aria-current={e.id === props.actuel ? "page" : undefined}
                onClick={() => {
                  setMenu(false);
                  if (e.id !== props.actuel) props.allerA(e.id);
                }}
              >
                <Icone nom={e.picto} taille={18} />
                <span>{e.libelle}</span>
                {e.id === props.actuel && <Icone nom="coche" taille={16} />}
              </button>
            ))}
          </m.nav>
        )}
      </Presence>
    </header>
  );
}
