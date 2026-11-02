import { useState } from "react";
import { etatAMoi } from "../../domaine/aMoi";
import { basculerCoeur, nosMots } from "../../domaine/bandeau";
import { formaterMontant, planDe } from "../../domaine/budget";
import { filDuFoyer, quiDe } from "../../domaine/fil";
import type { Depot } from "../../donnees/depot";
import { aujourdhuiLocal } from "../contexte";
import { vibrer } from "../haptique";
import type { DonneesModule } from "../modules";
import { Page } from "../pieces";
import { sauver } from "../sauver";

// Nous (0.0.100, nouvelle interface) : la troisième vue de la capsule. Ce qui est à deux, en
// phrases et sans tableau : le dernier mot de l'autre, ce qui te reste ce mois en une phrase,
// et ce que chacun a fait cette semaine. Chaque carte mène à sa page complète.

const heure = (iso: string) => new Date(iso).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });

export function Nous(props: { donnees: DonneesModule; depot: Depot; ouvrirMots: () => void; ouvrirFil: () => void; ouvrirBudget: () => void }) {
  const [maintenant] = useState(() => new Date().toISOString());
  const { foyer, membreId, couple, budget, aujourdhui } = props.donnees;
  const autre = foyer.membres.find((m) => m.id !== membreId)?.prenom ?? null;

  const mot = nosMots(couple, membreId, maintenant).find((m) => m.de !== membreId && !m.coeur) ?? null;
  const coeurDonne = !!mot && !!membreId && mot.coeurs.includes(membreId);
  const coeur = () => {
    if (!mot || !membreId) return;
    vibrer();
    sauver(props.depot.enregistrerCouple(basculerCoeur(mot, membreId)));
  };

  const plan = planDe(budget);
  const aMoi = plan && membreId ? etatAMoi(plan, budget, membreId, aujourdhui) : null;
  const fil = filDuFoyer(props.donnees, maintenant).slice(0, 3);
  const jourLocal = (iso: string) => aujourdhuiLocal(new Date(iso));

  return (
    <Page titre="Nous" sousTitre={autre ? `Toi et ${autre}` : "Le foyer"} className="nous avec-cadre">
      <section className="carte nous-mot" aria-label="Le dernier mot">
        {mot ? (
          <>
            <p className="nous-quand">{`De ${autre ?? "l'autre"}, à ${heure(mot.visibleDes)}`}</p>
            <blockquote className="nous-citation">« {mot.texte} »</blockquote>
            <div className="nous-actions">
              {membreId && (
                <button type="button" className={coeurDonne ? "bouton-doux" : "bouton-principal"} onClick={coeur} aria-pressed={coeurDonne}>
                  {coeurDonne ? "Cœur envoyé" : "Un cœur"}
                </button>
              )}
              <button type="button" className="bouton-doux" onClick={props.ouvrirMots}>
                Répondre
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="nous-quand">Nos mots</p>
            <p className="nous-citation leger">{autre ? `Pas de mot de ${autre} aujourd'hui.` : "Pas de mot aujourd'hui."}</p>
            <div className="nous-actions">
              <button type="button" className="bouton-principal" onClick={props.ouvrirMots}>
                {autre ? `Écrire à ${autre}` : "Écrire un mot"}
              </button>
            </div>
          </>
        )}
      </section>

      {aMoi && (
        <>
          <h2 className="rayon">Ce mois</h2>
          <button type="button" className="carte nous-mois" onClick={props.ouvrirBudget}>
            <span className="nous-quand">Jusqu'à ta paie</span>
            <span className="nous-phrase">
              {aMoi.suivi ? (
                <>
                  Il te reste <b>{formaterMontant(Math.max(0, Math.round(aMoi.reste)))}</b>
                  {aMoi.parJour > 0 ? `, environ ${formaterMontant(Math.round(aMoi.parJour), false)} par jour.` : "."}
                </>
              ) : (
                <>
                  Prévu pour toi : <b>{formaterMontant(Math.max(0, Math.round(aMoi.prevu)))}</b>.
                </>
              )}
            </span>
            {aMoi.phrase && <span className="discret">{aMoi.phrase}</span>}
          </button>
        </>
      )}

      <h2 className="rayon">Chez nous, cette semaine</h2>
      {fil.length === 0 ? (
        <p className="vide">Rien encore cette semaine. Dès que l'un de vous coche une tâche ou ajoute aux courses, ça s'écrit ici.</p>
      ) : (
        <ul className="carte groupe">
          {fil.map((e) => (
            <li key={e.cle} className="ligne">
              <span className="ligne-texte">
                <strong>{quiDe(e, foyer, membreId)}</strong> {e.texte}
                <span className="tache-details">{jourLocal(e.quand) === aujourdhui ? heure(e.quand) : e.espace}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="bouton-doux nous-tout" onClick={props.ouvrirFil}>
        Toute la semaine
      </button>
    </Page>
  );
}
