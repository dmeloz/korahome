import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { Icone } from "../Icone";
import { RepereOnglet } from "../moteur/pieces";
import { CLES, ecrireTexte, lireTexte } from "../stockageLocal";

// Le gabarit unique d'une page : un grand titre (30), une ligne de contexte, des actions
// à droite, puis le contenu. Équivalent natif : une vue de NavigationStack avec
// .navigationTitle en grand et ses boutons de barre d'outils.

// Un espace (Cuisine, Maison) rassemble plusieurs pages sous un seul titre : la page de
// l'onglet ouvert garde son contenu, mais prend le titre de l'espace et ses onglets sous le
// titre. Équivalent natif : une NavigationStack dont la vue change avec un Picker segmenté.
const ContexteEspace = createContext<{ titre: string; onglets: ReactNode } | null>(null);

export function Espace<T extends string>(props: {
  titre: string;
  libelle: string;
  onglets: readonly { id: T; libelle: string; compte?: number }[];
  actif: T;
  changer: (id: T) => void;
  children: ReactNode;
}) {
  const onglets = <Onglets libelle={props.libelle} onglets={props.onglets} actif={props.actif} changer={props.changer} />;
  return <ContexteEspace.Provider value={{ titre: props.titre, onglets }}>{props.children}</ContexteEspace.Provider>;
}

export function Page(props: {
  titre: string;
  /** Une ligne sous le titre : « 12 à prendre · Migros : 7 ». */
  sousTitre?: ReactNode;
  /** Un ou deux boutons à droite du titre. */
  actions?: ReactNode;
  /** L'aide de la première visite, montrée une seule fois sur ce téléphone. */
  aide?: { cle: string; texte: string };
  className?: string;
  children: ReactNode;
}) {
  const espace = useContext(ContexteEspace);
  return (
    // Une page ouverte à l'intérieur (une feuille, un détail) ne reprend pas l'espace.
    <ContexteEspace.Provider value={null}>
    <main className={`page${props.className ? ` ${props.className}` : ""}`}>
      <header className="page-entete">
        <div className="page-titres">
          <h1>{espace?.titre ?? props.titre}</h1>
          {props.sousTitre && <p className="page-sous-titre">{props.sousTitre}</p>}
        </div>
        {props.actions && <div className="page-actions">{props.actions}</div>}
      </header>
      {espace?.onglets}
      {props.aide && <AideUneFois cle={props.aide.cle} texte={props.aide.texte} />}
      {props.children}
    </main>
    </ContexteEspace.Provider>
  );
}

/** Sans stockage, l'aide ne s'impose pas. */
const dejaVue = (cle: string): boolean => lireTexte(CLES.prefixeAide + cle, "1") === "1";

/** Une carte d'aide douce à la première visite d'une page ; « Compris » la range pour de bon. */
export function AideUneFois({ cle, texte }: { cle: string; texte: string }) {
  const [vue, setVue] = useState(() => dejaVue(cle));
  if (vue) return null;
  return (
    <div className="aide-une-fois" role="note">
      <span className="aide-picto" aria-hidden><Icone nom="info" taille={18} /></span>
      <p>{texte}</p>
      <button
        className="lien"
        onClick={() => {
          // Stockage indisponible : l'aide se range pour cette visite.
          ecrireTexte(CLES.prefixeAide + cle, "1");
          setVue(true);
        }}
      >
        Compris
      </button>
    </div>
  );
}

/** Des onglets en segments, comme le Picker segmenté de l'iPhone. */
/** Les onglets d'une page : le repère de l'onglet actif glisse jusqu'au nouveau (moteur, ressort « onglet »). */
export function Onglets<T extends string>(props: { onglets: readonly { id: T; libelle: string; compte?: number }[]; actif: T; changer: (id: T) => void; libelle: string }) {
  const groupe = useId();
  return (
    <div className="segments" role="tablist" aria-label={props.libelle}>
      {props.onglets.map((o) => (
        <button key={o.id} role="tab" aria-selected={o.id === props.actif} className={o.id === props.actif ? "actif" : ""} onClick={() => props.changer(o.id)}>
          {o.id === props.actif && <RepereOnglet groupe={groupe} />}
          {o.libelle}
          {o.compte ? <span className="segment-compte">{o.compte}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Le point d'état : rouge (urgent), laiton (aujourd'hui) ou calme. */
export function PointEtat({ etat }: { etat: "urgent" | "jour" | "calme" }) {
  return <span className={`point-etat ${etat}`} aria-hidden />;
}
