import { useEffect, useState } from "react";
import { grouperParJour, type RappelRecu } from "../../domaine/centreRappels";
import { aujourdhuiLocal } from "../contexte";
import { lireRappels, marquerRappelsLus } from "../centreRappels";
import { Page } from "../pieces";

// La cloche de l'accueil : ce que Kora a envoyé ces trente derniers jours.

export function CentreRappels(props: { ouvrirNotifications: () => void }) {
  const [journal, setJournal] = useState<RappelRecu[] | null>(null);
  const aujourdhui = aujourdhuiLocal();

  useEffect(() => {
    let vivant = true;
    void lireRappels(aujourdhui).then((j) => {
      if (!vivant) return;
      setJournal(j);
      if (j.some((r) => !r.lu)) void marquerRappelsLus(j);
    });
    return () => {
      vivant = false;
    };
  }, [aujourdhui]);

  const groupes = journal ? grouperParJour(journal, aujourdhui, (iso) => aujourdhuiLocal(new Date(iso))) : [];
  return (
    <Page titre="Rappels" sousTitre="Ce que Kora a envoyé ce mois-ci" actions={<button className="lien" onClick={props.ouvrirNotifications}>Réglages</button>}>
      {journal && journal.length === 0 && (
        <p className="vide">Aucun rappel reçu sur ce téléphone pour l'instant. Le rappel du matin, les mots de l'autre et les menus du Chef arriveront ici.</p>
      )}
      {groupes.map((g) => (
        <section key={g.titre}>
          <h2 className="rayon">{g.titre}</h2>
          <ul className="carte groupe">
            {g.rappels.map((r) => (
              <li key={r.le + r.titre} className={`ligne rappel-recu${r.lu ? "" : " nouveau"}`}>
                <span className="rappel-heure">{new Date(r.le).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="ligne-texte">
                  <strong>{r.titre}</strong>
                  {r.corps && <span className="discret rappel-corps">{r.corps}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Page>
  );
}
