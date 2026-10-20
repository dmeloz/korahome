import { feteFee } from "../fee";
import { useState } from "react";
import { entretiensAProposer, nouvelEntretien, organiserEntretien } from "../../domaine/entretien";
import { decrireEcheance, decrireRecurrence, marquerFaite } from "../../domaine/taches";
import { noterUsage } from "../usage";
import type { Jour, Tache } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { Feuille } from "../Feuille";
import { vibrer } from "../haptique";
import { Ligne, ListeVivante } from "../moteur/pieces";

/** L'onglet Entretien de Tâches : ce qui revient tous les quelques mois, du plus pressé au plus lointain. */
export function Entretien(props: { depot: Depot; membreId: string | null; taches: Tache[]; aujourdhui: Jour }) {
  const { depot, aujourdhui } = props;
  const annoncer = useAnnoncer();
  const [ouverte, setOuverte] = useState<string | null>(null);
  const lignes = organiserEntretien(props.taches, aujourdhui);
  const propositions = entretiensAProposer(props.taches);

  async function faire(t: Tache) {
    vibrer();
    const apres = marquerFaite(t, props.membreId, aujourdhui, contexteReel);
    noterUsage("tache", t.id);
    await depot.enregistrerTache(apres);
    feteFee();
    annoncer(`« ${t.titre} » fait.`, () => depot.enregistrerTache(t));
  }

  async function retirer(t: Tache) {
    await depot.supprimerTache(t.id);
    annoncer(`« ${t.titre} » retiré.`, () => depot.enregistrerTache(t));
  }

  const t = props.taches.find((x) => x.id === ouverte);
  return (
    <>
      <Feuille ouverte={!!t} onFermer={() => setOuverte(null)} titre={t?.titre}>
        {t && (
          <div className="formulaire tache-feuille">
            <p className="discret">{decrireRecurrence(t.recurrence)} · {decrireEcheance(t.echeance, aujourdhui)}</p>
            <button type="button" className="bouton-principal" onClick={() => { setOuverte(null); void faire(t); }}>
              Fait aujourd'hui
            </button>
            <label>
              Prochaine fois le
              <input type="date" value={t.echeance} min="2000-01-01" onChange={(e) => e.target.value && depot.enregistrerTache({ ...t, echeance: e.target.value })} />
            </label>
            <button type="button" className="lien danger" onClick={() => { setOuverte(null); void retirer(t); }}>
              Retirer
            </button>
          </div>
        )}
      </Feuille>
      <p className="discret">Les gestes qui reviennent tous les quelques mois, à dire à ta fée : « détartrer la bouilloire tous les 3 mois ». Kora les met dans les tâches la semaine où ils sont dus.</p>

      {lignes.length > 0 && (
        <ListeVivante className="carte groupe">
          {lignes.map(({ tache, quand, du }) => (
            <Ligne key={tache.id}>
              <Glissable onSupprimer={() => void retirer(tache)} libelle="Retirer">
                <div className="ligne tache">
                  <button className="case" onClick={() => void faire(tache)} aria-label={`Marquer « ${tache.titre} » comme fait`} />
                  <button className="tache-texte" onClick={() => setOuverte(tache.id)} aria-haspopup="dialog">
                    <span className="ligne-texte">{tache.titre}</span>
                    <span className={`tache-details${du ? " retard" : ""}`}>
                      {decrireRecurrence(tache.recurrence)} · {quand}
                    </span>
                  </button>
                </div>
              </Glissable>
            </Ligne>
          ))}
        </ListeVivante>
      )}

      {propositions.length > 0 && (
        <section className="carte">
          <p className="surtitre">{lignes.length ? "Ajouter" : "Pour commencer, touche ce qui concerne la maison"}</p>
          <div className="puces">
            {propositions.map((p) => (
              <button key={p.titre} className="puce" onClick={() => void depot.enregistrerTache(nouvelEntretien(p, aujourdhui, contexteReel))}>
                {p.titre}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
