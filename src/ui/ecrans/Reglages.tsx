import { useState } from "react";
import type { Foyer } from "../../domaine/types";
import { choisirMembreCourant } from "../contexte";
import { Icone } from "../Icone";
import { MESSAGES_VERIFICATION, type ResultatVerification } from "../miseAJour";

const ETATS_PARTAGE = { indisponible: "Bientôt", inactif: "Désactivé", actif: "Activé" } as const;

export function Reglages(props: {
  foyer: Foyer;
  membreId: string | null;
  changerMembre: (id: string) => void;
  verifierMiseAJour: () => Promise<ResultatVerification>;
  notesOuvertes: number;
  ouvrirRetours: () => void;
  ouvrirPartage: () => void;
  partage: "indisponible" | "inactif" | "actif";
  pastilleVisible: boolean;
  changerPastille: (visible: boolean) => void;
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
      <h2 className="rayon">Partage</h2>
      <ul className="carte groupe">
        <li>
          <button className="ligne" onClick={props.ouvrirPartage}>
            <span className="ligne-texte">Partage entre vos iPhone</span>
            <span className="discret">{ETATS_PARTAGE[props.partage]}</span>
            <span className="chevron"><Icone nom="suivant" taille={18} /></span>
          </button>
        </li>
      </ul>
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
      <h2 className="rayon">Développement</h2>
      <ul className="carte groupe">
        <li>
          <button className="ligne" onClick={props.ouvrirRetours}>
            <span className="ligne-texte">Retours de test</span>
            {props.notesOuvertes > 0 && <span className="pastille">{props.notesOuvertes}</span>}
            <span className="chevron"><Icone nom="suivant" taille={18} /></span>
          </button>
        </li>
        <li>
          <button
            className="ligne"
            role="switch"
            aria-checked={props.pastilleVisible}
            onClick={() => props.changerPastille(!props.pastilleVisible)}
          >
            <span className="ligne-texte">Pastille « Dev » sur chaque écran</span>
            <span className={`interrupteur${props.pastilleVisible ? " actif" : ""}`} aria-hidden />
          </button>
        </li>
      </ul>
    </main>
  );
}
