import { useEffect, useState } from "react";
import { carteDemarrageVisible, etapesDemarrage, nombreFaites, titreDemarrage, type EtapeDemarrage } from "../../domaine/demarrage";
import type { Tache } from "../../domaine/types";
import type { Foyer } from "../../domaine/types";
import { siriRelie } from "../ecrans/Siri";
import { nomFee } from "../fee";
import { Icone } from "../Icone";
import { ignorer } from "../journal";
import { etatRappels } from "../rappels";
import { CLES, ecrireTexte, lireTexte } from "../stockageLocal";

// La carte « Prête en 5 étapes » de l'accueil : l'arrivée sur un nouveau téléphone, guidée.
// Chaque étape se coche seule ; un toucher mène au bon réglage ; « Plus tard » la range.

const estInstallee = () => matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export function CarteDemarrage(props: {
  foyer: Foyer;
  membreId: string | null;
  partageActif: boolean;
  taches: readonly Tache[];
  ouvrir: (ou: NonNullable<EtapeDemarrage["ou"]>) => void;
}) {
  const [rangee, setRangee] = useState(() => lireTexte(CLES.demarrageRange) === "1");
  const [notifications, setNotifications] = useState(false);
  // Repliée en une ligne (0.0.71) : ouverte, elle prenait tout le premier écran de l'accueil.
  const [ouverte, setOuverte] = useState(false);
  useEffect(() => {
    let vivant = true;
    etatRappels()
      .then((e) => vivant && setNotifications(e === "actifs"))
      .catch(ignorer);
    return () => {
      vivant = false;
    };
  }, []);

  const etapes = etapesDemarrage({ installee: estInstallee(), membreId: props.membreId, partageActif: props.partageActif, notifications, siriRelie: siriRelie(), foyer: props.foyer, taches: props.taches, fee: nomFee() });
  if (!carteDemarrageVisible(etapes, rangee)) return null;
  const faites = nombreFaites(etapes);

  return (
    <section className={`carte demarrage${ouverte ? " ouverte" : ""}`} aria-label="Mise en route">
      <header className="demarrage-entete">
        <button className="demarrage-resume" aria-expanded={ouverte} onClick={() => setOuverte((o) => !o)}>
          <span className="demarrage-titres">
            <strong>{titreDemarrage(etapes)}</strong>
            <span className="discret">{faites} sur {etapes.length}</span>
          </span>
          <span className="demarrage-barre" aria-hidden><span style={{ width: `${(faites / etapes.length) * 100}%` }} /></span>
          <span className="demarrage-chevron" aria-hidden><Icone nom="bas" taille={16} /></span>
        </button>
        {ouverte && (
          <button
            className="lien"
            onClick={() => {
              // Stockage indisponible : la carte revient à la prochaine ouverture.
              ecrireTexte(CLES.demarrageRange, "1");
              setRangee(true);
            }}
          >
            Plus tard
          </button>
        )}
      </header>
      {ouverte && <ul className="demarrage-etapes">
        {etapes.map((e) => (
          <li key={e.id}>
            <button className={`demarrage-etape${e.faite ? " faite" : ""}`} onClick={e.ou && !e.faite ? () => props.ouvrir(e.ou!) : undefined} disabled={e.faite || !e.ou}>
              <span className={`rond-etape${e.faite ? " plein" : ""}`} aria-hidden>{e.faite && <Icone nom="coche" taille={14} />}</span>
              <span className="ligne-texte">
                <span>{e.titre}</span>
                {!e.faite && <span className="discret">{e.detail}</span>}
              </span>
              {!e.faite && e.ou && <Icone nom="suivant" taille={16} />}
            </button>
          </li>
        ))}
      </ul>}
    </section>
  );
}
