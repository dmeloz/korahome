import { useEffect, useRef, useState } from "react";
import { evenementsDe } from "../domaine/agenda";
import { grouperTrouvailles, rechercher, type OuRecherche } from "../domaine/recherche";
import { Feuille } from "./Feuille";
import { Icone } from "./Icone";
import type { DonneesModule } from "./modules";

// Chercher partout : on tire l'accueil vers le bas (ou on touche la loupe). Un article,
// un rendez-vous, un produit du frigo, un vaccin de Mitsu, un numéro retenu par Jarvis.

export function Recherche(props: { ouverte: boolean; fermer: () => void; donnees: DonneesModule; aller: (ou: OuRecherche) => void }) {
  const [texte, setTexte] = useState("");
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!props.ouverte) return;
    setTexte("");
    // Ouverte d'un geste : le clavier vient avec, comme la recherche de l'iPhone.
    const id = setTimeout(() => champ.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [props.ouverte]);

  const d = props.donnees;
  const trouvailles = rechercher({ ...d, evenements: evenementsDe(d.agenda) }, texte);
  const groupes = grouperTrouvailles(trouvailles);
  return (
    <Feuille ouverte={props.ouverte} onFermer={props.fermer} titre="Chercher" fermer="Fermer" className="feuille-recherche">
      <div className="champ-recherche">
        <Icone nom="loupe" taille={18} />
        <input ref={champ} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Courses, rendez-vous, produits, numéros…" enterKeyHint="search" aria-label="Chercher dans Kora" />
      </div>
      {texte.trim().length >= 2 && trouvailles.length === 0 && <p className="vide">Rien trouvé pour « {texte.trim()} ».</p>}
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
    </Feuille>
  );
}
