import { useState } from "react";
import type { Foyer } from "../../domaine/types";
import { choisirMembreCourant } from "../contexte";
import { MESSAGES_VERIFICATION, type ResultatVerification } from "../miseAJour";

export function Reglages(props: {
  foyer: Foyer;
  membreId: string | null;
  changerMembre: (id: string) => void;
  verifierMiseAJour: () => Promise<ResultatVerification>;
}) {
  const [verification, setVerification] = useState<string | null>(null);
  const verifier = async () => {
    setVerification("Vérification…");
    setVerification(MESSAGES_VERIFICATION[await props.verifierMiseAJour()]);
  };
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
      <h2 className="rayon">Application</h2>
      <div className="carte version">
        <p><strong>Kora {__VERSION__}</strong></p>
        <button className="lien" onClick={verifier}>Vérifier les mises à jour</button>
        {verification && <p className="discret" role="status">{verification}</p>}
      </div>
      <p className="discret pied">
        Les données sont pour l'instant enregistrées sur ce téléphone uniquement ;
        la synchronisation entre vos deux iPhones arrive à l'étape suivante.
      </p>
    </main>
  );
}
