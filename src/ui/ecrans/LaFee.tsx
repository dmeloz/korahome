import { useState } from "react";
import { decrireMinute, heuresDiscretes, JOURS_POUR_NUIT, nuitApprise } from "../../domaine/vieFee";
import { aujourdhuiLocal } from "../contexte";
import { changerSon, lireRenvois, nomFee, oublierDiscretion, sonActif, tinter } from "../fee";
import { Icone } from "../Icone";
import { lireUsages } from "../usage";

// Réglages › La fée : son tintement, la nuit qu'elle a apprise et les heures où elle se tait.
// Tout reste sur ce téléphone.

const GESTES: [string, string][] = [
  ["Un toucher", "elle t'écoute"],
  ["Appui long", "tu lui écris"],
  ["Deux touchers", "elle se cache un moment"],
  ["La faire glisser", "elle change de place, ou se range contre le bord"],
];

export function LaFee() {
  const [son, setSon] = useState(sonActif);
  const [discretes, setDiscretes] = useState(() => [...heuresDiscretes(lireRenvois())].sort((a, b) => a - b));
  const nuit = nuitApprise(lireUsages(), aujourdhuiLocal());
  const fee = nomFee();

  return (
    <main className="reglages">
      <h1>{fee}</h1>
      <p className="discret rappels-intro">Ta fée. Elle te dit ce qui presse, l'heure de tes tâches et les mots de l'autre.</p>

      <h2 className="rayon">Son</h2>
      <ul className="carte groupe">
        <li>
          <button
            className="ligne ligne-reglage"
            role="switch"
            aria-checked={son}
            onClick={() => {
              changerSon(!son);
              setSon(!son);
              if (!son) tinter(true);
            }}
          >
            <span className="picto-reglage"><Icone nom="cloche" taille={18} /></span>
            <span className="ligne-texte">Tintement</span>
            <span className={`interrupteur${son ? " actif" : ""}`} aria-hidden />
          </button>
        </li>
      </ul>
      <p className="discret rappels-intro">Deux notes claires pour une alerte ou l'heure d'une tâche. Coupé, elle scintille seulement.</p>

      <h2 className="rayon">La nuit</h2>
      <div className="carte groupe fee-nuit">
        <p>
          <Icone nom="lune" taille={18} /> De {decrireMinute(nuit.debut)} à {decrireMinute(nuit.fin)}
        </p>
      </div>
      <p className="discret rappels-intro">
        {nuit.apprise
          ? `${fee} l'a apprise de l'usage de ce téléphone. Elle dort sur la date et l'accueil montre demain ; un toucher la réveille.`
          : `En attendant d'apprendre l'heure où tu dors (il lui faut ${JOURS_POUR_NUIT} jours d'usage), elle dort de 23 h à 7 h.`}
      </p>

      <h2 className="rayon">Discrétion</h2>
      <ul className="carte groupe">
        <li>
          <button
            className="ligne ligne-reglage"
            disabled={discretes.length === 0}
            onClick={() => {
              oublierDiscretion();
              setDiscretes([]);
            }}
          >
            <span className="picto-reglage"><Icone nom="actualiser" taille={18} /></span>
            <span className="ligne-texte">
              {discretes.length ? `Elle se tait à ${discretes.map((h) => `${h} h`).join(", ")}` : "Elle parle à toute heure"}
            </span>
            {discretes.length > 0 && <span className="discret valeur-reglage">Remettre à zéro</span>}
          </button>
        </li>
      </ul>
      <p className="discret rappels-intro">
        Quand tu fermes ses bulles trois fois à la même heure, elle garde ses nouvelles pour plus tard à cette heure-là. Ce qui presse passe
        quand même.
      </p>

      <h2 className="rayon">Ses gestes</h2>
      <ul className="carte groupe">
        {GESTES.map(([geste, effet]) => (
          <li key={geste} className="ligne ligne-reglage fee-geste">
            <span className="ligne-texte">{geste}</span>
            <span className="discret valeur-reglage">{effet}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
