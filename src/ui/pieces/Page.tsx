import { useState, type ReactNode } from "react";
import { Icone } from "../Icone";

// Le gabarit unique d'une page : un grand titre (30), une ligne de contexte, des actions
// à droite, puis le contenu. Équivalent natif : une vue de NavigationStack avec
// .navigationTitle en grand et ses boutons de barre d'outils.

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
  return (
    <main className={`page${props.className ? ` ${props.className}` : ""}`}>
      <header className="page-entete">
        <div className="page-titres">
          <h1>{props.titre}</h1>
          {props.sousTitre && <p className="page-sous-titre">{props.sousTitre}</p>}
        </div>
        {props.actions && <div className="page-actions">{props.actions}</div>}
      </header>
      {props.aide && <AideUneFois cle={props.aide.cle} texte={props.aide.texte} />}
      {props.children}
    </main>
  );
}

const PREFIXE = "korahome.aide.";

function dejaVue(cle: string): boolean {
  try {
    return localStorage.getItem(PREFIXE + cle) === "1";
  } catch {
    return true;
  }
}

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
          try {
            localStorage.setItem(PREFIXE + cle, "1");
          } catch {
            // Stockage indisponible : l'aide se range pour cette visite.
          }
          setVue(true);
        }}
      >
        Compris
      </button>
    </div>
  );
}

/** Des onglets en segments, comme le Picker segmenté de l'iPhone. */
export function Onglets<T extends string>(props: { onglets: readonly { id: T; libelle: string; compte?: number }[]; actif: T; changer: (id: T) => void; libelle: string }) {
  return (
    <div className="segments" role="tablist" aria-label={props.libelle}>
      {props.onglets.map((o) => (
        <button key={o.id} role="tab" aria-selected={o.id === props.actif} className={o.id === props.actif ? "actif" : ""} onClick={() => props.changer(o.id)}>
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
