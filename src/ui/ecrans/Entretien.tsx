import { entretiensAProposer, nouvelEntretien, organiserEntretien } from "../../domaine/entretien";
import { decrireRecurrence, marquerFaite } from "../../domaine/taches";
import type { Jour, Tache } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";

/** L'entretien de la maison : ce qui revient tous les quelques mois, du plus pressé au plus lointain. */
export function Entretien(props: { depot: Depot; membreId: string | null; taches: Tache[]; aujourdhui: Jour }) {
  const { depot, aujourdhui } = props;
  const annoncer = useAnnoncer();
  const lignes = organiserEntretien(props.taches, aujourdhui);
  const propositions = entretiensAProposer(props.taches);

  async function faire(t: Tache) {
    vibrer();
    const apres = marquerFaite(t, props.membreId, aujourdhui, contexteReel);
    await depot.enregistrerTache(apres);
    annoncer(`« ${t.titre} » fait.`, () => depot.enregistrerTache(t));
  }

  async function retirer(t: Tache) {
    await depot.supprimerTache(t.id);
    annoncer(`« ${t.titre} » retiré.`, () => depot.enregistrerTache(t));
  }

  return (
    <main>
      <h1>Entretien</h1>
      <p className="discret">Les gestes qui reviennent tous les quelques mois. Kora les rappelle la semaine où ils sont dus.</p>

      {lignes.length > 0 && (
        <ul className="carte groupe">
          {lignes.map(({ tache, quand, du }) => (
            <li key={tache.id}>
              <Glissable onSupprimer={() => void retirer(tache)} libelle="Retirer">
                <div className="ligne tache">
                  <button className="case" onClick={() => void faire(tache)} aria-label={`Marquer « ${tache.titre} » comme fait`} />
                  <span className="tache-texte">
                    <span className="ligne-texte">{tache.titre}</span>
                    <span className={`tache-details${du ? " retard" : ""}`}>
                      {decrireRecurrence(tache.recurrence)} · {quand}
                    </span>
                  </span>
                </div>
              </Glissable>
            </li>
          ))}
        </ul>
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
    </main>
  );
}
