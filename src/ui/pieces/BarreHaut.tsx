import { useEffect, useRef, useState } from "react";
import { Icone } from "../Icone";
import { Orbe } from "./Tael";

// La barre du haut, la même sur chaque page ouverte par-dessus un espace (Kora 0.1) : le retour à
// gauche, le nom de la page au milieu quand son grand titre est passé sous la barre, et Tael à
// droite, qui vient à toi ici aussi. Les espaces se changent par la pile ou le rail (Navigation).
// Équivalent natif : la barre d'une NavigationStack (.navigationBarTitleDisplayMode(.large)).

export function BarreHaut(props: {
  /** Le nom de la page d'avant, sur le bouton retour. */
  retour: string;
  revenir?: () => void;
  /** Le nom de cette page, montré quand son grand titre a défilé. */
  titre: string;
  /** Une page d'en dessous : la barre est là, mais on ne la touche pas. */
  inerte?: boolean;
}) {
  const barre = useRef<HTMLElement>(null);
  const [titreVisible, setTitreVisible] = useState(false);

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

  const tab = props.inerte ? -1 : undefined;
  return (
    <header ref={barre} className={`barre-haut${titreVisible ? " avec-titre" : ""}`}>
      <button className="retour" onClick={props.inerte ? undefined : props.revenir} tabIndex={tab}>
        <Icone nom="retour" taille={22} />
        <span className="retour-libelle">{props.retour}</span>
      </button>
      <span className="barre-haut-titre" aria-hidden={!titreVisible}>{props.titre}</span>
      <Orbe className={props.inerte ? "inerte" : undefined} />
    </header>
  );
}
