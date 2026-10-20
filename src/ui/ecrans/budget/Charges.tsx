import { useState } from "react";
import { abonnementsALAnnee, bilanDuMois, CATEGORIES_POSTE, nomDuMois, POTS, repartitionDuCommun, type PlanBudget, type Pot, type Poste } from "../../../domaine/budget";
import type { Id } from "../../../domaine/types";
import type { PropsPage } from "../../modules";
import { AnneauDuCommun, TrajetSalaire } from "./Visuels";
import { montant, prenomDe } from "./communs";

// ----- Les charges -----

export function Charges(p: PropsPage & { plan: PlanBudget; ouvrirPoste: (x: Poste) => void; ouvrirPersonne: (id: Id) => void }) {
  const { plan, foyer } = p;
  const [tout, setTout] = useState(false);
  const bilan = bilanDuMois(plan);
  // Ce téléphone montre d'abord ses charges et le commun ; celles de l'autre restent à un toucher.
  const visible = (id: Id | null) => tout || !p.membreId || id === null || id === p.membreId;
  const autres = bilan.personnes.filter((b) => !visible(b.membreId));
  const masquees = p.membreId ? bilan.personnes.filter((b) => b.membreId !== p.membreId) : [];
  const communes = plan.postes.filter((x) => x.qui === null);
  const abonnements = abonnementsALAnnee(plan).filter((x) => visible(x.poste.qui));
  const nomDuPot = (pot: Pot) => plan.comptes[pot] || POTS[pot].nom;
  const ligne = (x: Poste) => (
    <li key={x.id}>
      <button className="ligne" onClick={() => p.ouvrirPoste(x)} aria-haspopup="dialog">
        <span className="ligne-texte">
          {x.libelle}
          <span className="tache-details">
            {" "}
            · {CATEGORIES_POSTE[x.categorie]}
            {x.frequence === "an" ? ` · par an${x.mois ? `, ${nomDuMois(x.mois)}` : ", mois à donner"}` : x.jour ? ` · le ${x.jour}` : ""}
            {x.prelevement ? " · prélevée" : ""}
          </span>
        </span>
        <span className="budget-montant">{montant(x.montant)}</span>
      </button>
    </li>
  );

  return (
    <>
      {bilan.personnes.filter((b) => visible(b.membreId)).map((b) => {
        const siennes = plan.postes.filter((x) => x.qui === b.membreId);
        return (
          <section key={b.membreId}>
            <h2 className="rayon">{prenomDe(foyer, b.membreId)}</h2>
            <TrajetSalaire b={b} />
            <ul className="carte groupe">
              <li>
                <button className="ligne" onClick={() => p.ouvrirPersonne(b.membreId)} aria-haspopup="dialog">
                  <span className="ligne-texte">Salaire</span>
                  <span className="budget-montant">{montant(b.revenu)}</span>
                </button>
              </li>
              {siennes.map(ligne)}
              <li>
                <button className="ligne" onClick={() => p.ouvrirPersonne(b.membreId)} aria-haspopup="dialog">
                  <span className="ligne-texte">Versé au compte commun</span>
                  <span className="budget-montant">{montant(b.versement)}</span>
                </button>
              </li>
              <li className="ligne budget-total">
                <span className="ligne-texte">Reste</span>
                <span className="budget-montant">{montant(b.reste)}</span>
              </li>
            </ul>
          </section>
        );
      })}

      <h2 className="rayon">Compte commun</h2>
      <AnneauDuCommun parts={repartitionDuCommun(plan)} entree={bilan.entreeCommun} noms={nomDuPot} />
      <ul className="carte groupe">
        <li className="ligne">
          <span className="ligne-texte">Entrée du mois</span>
          <span className="budget-montant">{montant(bilan.entreeCommun)}</span>
        </li>
        {(["commun", "courses", "factures"] as Pot[]).flatMap((pot) => communes.filter((x) => x.pot === pot).map(ligne))}
        <li className="ligne budget-total">
          <span className="ligne-texte">
            Charges du mois
            <span className="tache-details"> · dont {montant(bilan.provisionAnnuelle)} mis de côté pour l'année</span>
          </span>
          <span className="budget-montant">{montant(bilan.chargesCommunes)}</span>
        </li>
        <li className="ligne budget-total">
          <span className="ligne-texte">
            Reste
            <span className="tache-details">
              {" "}
              · {montant(bilan.versements.plaisir)} plaisir, {montant(bilan.versements.epargne)} épargne
            </span>
          </span>
          <span className="budget-montant">{montant(bilan.resteCommun)}</span>
        </li>
      </ul>

      {masquees.length > 0 && (
        <button type="button" className="lien budget-note" onClick={() => setTout(!tout)} aria-expanded={tout}>
          {autres.length ? `Voir aussi les charges de ${autres.map((b) => prenomDe(foyer, b.membreId)).join(" et ")}` : "Ne voir que les miennes et le commun"}
        </button>
      )}

      {abonnements.length > 0 && (
        <>
          <h2 className="rayon">Abonnements à l'année</h2>
          <ul className="carte groupe">
            {abonnements.map(({ poste, parAn }) => (
              <li key={poste.id}>
                <button className="ligne" onClick={() => p.ouvrirPoste(poste)} aria-haspopup="dialog">
                  <span className="ligne-texte">
                    {poste.libelle}
                    <span className="tache-details"> · {prenomDe(foyer, poste.qui)}</span>
                  </span>
                  <span className="budget-montant">{montant(parAn)}</span>
                </button>
              </li>
            ))}
            <li className="ligne budget-total">
              <span className="ligne-texte">
                Par an
                <span className="tache-details"> · {montant(abonnements.reduce((t, x) => t + x.parAn, 0) / 12)} par mois</span>
              </span>
              <span className="budget-montant">{montant(abonnements.reduce((t, x) => t + x.parAn, 0))}</span>
            </li>
          </ul>
        </>
      )}
    </>
  );
}
