import { type CSSProperties, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePiegeFocus } from "../focus";
import { guideAMontrer, pagesGuide, VERSION_GUIDE, type ExempleGuide } from "../../domaine/guide";
import { useFee } from "../fee";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { m, Presence } from "../moteur/pieces";
import { ressortMotion } from "../moteur/ressorts";
import { CLES, ecrireTexte, lireTexte, oublierMemoires } from "../stockageLocal";
import { ESPACES } from "./Navigation";
import { DessinFee } from "./Tael";

// Le guide de première ouverture (0.1.1) : par-dessus tout, cinq pages qu'on feuillette d'un
// geste ou d'un bouton, « Passer » en haut. Il se montre une fois par téléphone quand Kora a
// changé d'allure (VERSION_GUIDE), et à un foyer neuf. En le fermant, le téléphone oublie ce que
// Kora avait appris de son usage : il repart comme neuf, ses réglages gardés.

/** Si ce téléphone doit voir le guide maintenant. */
export const guideADonner = (): boolean => guideAMontrer(lireTexte(CLES.guideVu));

export function Guide({ fermer }: { fermer: () => void }) {
  const fee = useFee();
  const pages = pagesGuide(fee.nom);
  const [i, setI] = useState(0);
  const [sens, setSens] = useState(1);
  const page = pages[i];
  const zone = useRef<HTMLDivElement>(null);
  // Tab reste dans le guide. Échap ne le ferme pas : le fermer efface ce que Kora avait appris, ça se décide d'un toucher.
  usePiegeFocus(true, zone, null);
  const derniere = i === pages.length - 1;
  const aller = (vers: number) => {
    if (vers < 0 || vers >= pages.length) return;
    setSens(vers > i ? 1 : -1);
    setI(vers);
  };
  const finir = () => {
    vibrer();
    ecrireTexte(CLES.guideVu, VERSION_GUIDE);
    oublierMemoires();
    fermer();
  };
  return createPortal(
    <div className="guide" role="dialog" aria-modal="true" aria-labelledby="guide-titre" ref={zone} tabIndex={-1}>
      <div className="guide-haut">
        <span className="etiq">Kora {VERSION_GUIDE}</span>
        {!derniere && <button type="button" className="lien" onClick={finir}>Passer</button>}
      </div>
      <Presence mode="wait" initial={false} custom={sens}>
        <m.div
          key={i}
          className="guide-page"
          custom={sens}
          initial={{ opacity: 0, x: 40 * sens }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 * sens }}
          transition={ressortMotion("apparition")}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60 || info.velocity.x < -400) aller(i + 1);
            else if (info.offset.x > 60 || info.velocity.x > 400) aller(i - 1);
          }}
        >
          <Dessin quoi={page.dessin} exemples={page.exemples ?? []} />
          <h1 id="guide-titre">{page.titre}</h1>
          <p>{page.texte}</p>
        </m.div>
      </Presence>
      <div className="guide-bas">
        <div className="points" aria-label={`Page ${i + 1} sur ${pages.length}`} role="img">
          {pages.map((p, j) => <span key={p.dessin} className={j === i ? "actif" : undefined} />)}
        </div>
        {derniere ? (
          <button type="button" className="bouton-principal" onClick={finir}>Commencer</button>
        ) : (
          <button type="button" className="bouton-principal" onClick={() => aller(i + 1)}>Suivant</button>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Les cartes d'exemple d'une page : de vraies cartes de Kora, en petit. */
function Exemples({ exemples }: { exemples: readonly ExempleGuide[] }) {
  if (!exemples.length) return null;
  return (
    <div className={`guide-exemples${exemples.length > 1 ? " duo" : ""}`}>
      {exemples.map((e) => (
        <span key={e.etiquette} className={`tuile guide-exemple${e.ton ? ` ${e.ton}` : ""}`}>
          <span className="etiq">{e.etiquette}</span>
          <b>{e.texte}</b>
          {e.detail && <span className="doux">{e.detail}</span>}
        </span>
      ))}
    </div>
  );
}

/** L'illustration de chaque page, faite des vraies pièces de Kora : rien à charger. */
function Dessin({ quoi, exemples }: { quoi: ReturnType<typeof pagesGuide>[number]["dessin"]; exemples: readonly ExempleGuide[] }) {
  if (quoi === "espaces" || quoi === "cartes") {
    return <div className="guide-dessin" aria-hidden><Exemples exemples={exemples} /></div>;
  }
  if (quoi === "pile") {
    return (
      <div className="guide-dessin pile" aria-hidden>
        <span className="rond kora"><Icone nom="menu" taille={22} /></span>
        {ESPACES.slice(1, 4).map((e, j) => <span key={e.id} className="item" style={{ "--j": j } as CSSProperties}><span className="rond"><Icone nom={e.picto} taille={16} /></span><b>{e.libelle}</b>{j === 2 && <i className="guide-point" />}</span>)}
      </div>
    );
  }
  if (quoi === "fee") {
    return (
      <div className="guide-dessin fee" aria-hidden>
        <span className="orbe"><DessinFee /></span>
        <Exemples exemples={exemples} />
      </div>
    );
  }
  return (
    <div className="guide-dessin fin" aria-hidden>
      <span className="rond kora"><Icone nom="sourire" taille={24} /></span>
    </div>
  );
}
