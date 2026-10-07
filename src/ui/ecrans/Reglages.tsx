import type { Foyer } from "../../domaine/types";
import { choisirMembreCourant } from "../contexte";

export function Reglages(props: { foyer: Foyer; membreId: string | null; changerMembre: (id: string) => void }) {
  return (
    <main>
      <h1>Réglages</h1>
      <h2 className="rayon">Foyer</h2>
      <div className="carte">
        <p><strong>{props.foyer.nom}</strong></p>
      </div>
      <h2 className="rayon">Qui utilise ce téléphone ?</h2>
      <ul className="carte groupe">
        {props.foyer.membres.map((m) => (
          <li key={m.id}>
            <button
              className="ligne"
              onClick={() => {
                choisirMembreCourant(m.id);
                props.changerMembre(m.id);
              }}
            >
              <span className="initiale" style={{ background: m.couleur }}>{m.prenom.charAt(0)}</span>
              <span className="ligne-texte">{m.prenom}</span>
              {props.membreId === m.id && <span aria-label="sélectionné">✓</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="discret pied">
        KoraHome {__VERSION__}. Les données sont pour l'instant enregistrées sur ce téléphone uniquement ;
        la synchronisation entre vos deux iPhones arrive à l'étape suivante.
      </p>
    </main>
  );
}
