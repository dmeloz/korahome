import {
  avanceeProjet,
  courbeEpargne,
  coursesParMagasin,
  coursesParMois,
  previsionFactures,
  prixQuiMontent,
  bilanDuMois,
  etatDesPots,
  historiqueEpargne,
  moisDe,
  nommerMois,
  type PlanBudget,
} from "../../../domaine/budget";
import type { PropsPage } from "../../modules";
import { tableauDesMois } from "../../../domaine/budgetConseil";
import { FinDuMois, TableauDesMois } from "./Conseiller";
import { CourbeEpargne, CoursesParMois, Magasins, MoisLourds, PrixQuiMontent } from "./Visuels";
import { montant } from "./communs";

// ----- L'analyse (sous la carte du conseiller) -----

/** La fin du mois, les derniers mois, l'année des factures, l'épargne et les courses. */
export function Analyse(p: PropsPage & { plan: PlanBudget; reglerProjet: () => void }) {
  const { plan, aujourdhui } = p;
  return (
    <>
      <h2 className="rayon">La fin du mois</h2>
      <FinDuMois {...p} plan={plan} />
      {tableauDesMois(plan, p.budget, aujourdhui).length > 1 && (
        <>
          <h2 className="rayon">Les derniers mois</h2>
          <TableauDesMois plan={plan} mois={tableauDesMois(plan, p.budget, aujourdhui)} aujourdhui={aujourdhui} />
        </>
      )}
      {previsionFactures(plan, p.budget, aujourdhui).some((m) => m.sorties > 0) && (
        <>
          <h2 className="rayon">L'année des factures</h2>
          <MoisLourds mois={previsionFactures(plan, p.budget, aujourdhui)} aujourdhui={aujourdhui} />
        </>
      )}
      <Epargne {...p} plan={plan} reglerProjet={p.reglerProjet} />
      <Courses {...p} plan={plan} />
    </>
  );
}

// ----- Les courses -----

function Courses(p: PropsPage & { plan: PlanBudget }) {
  const { plan, aujourdhui } = p;
  const parMoisCourses = coursesParMois(p.budget, aujourdhui);
  const budget = bilanDuMois(plan).versements.courses;
  const magasins = coursesParMagasin(p.budget, aujourdhui);
  if (!parMoisCourses.some((m) => m.total > 0)) {
    return <p className="discret budget-note">Les courses apparaîtront ici dès le premier ticket photographié, ou une dépense dite à ta fée (« Migros 84.30 »).</p>;
  }
  return (
    <>
      <h2 className="rayon">Les courses, six derniers mois</h2>
      <CoursesParMois mois={parMoisCourses} budget={budget} aujourdhui={aujourdhui} />
      {magasins.length > 1 && (
        <>
          <h2 className="rayon">Par magasin</h2>
          <Magasins magasins={magasins} />
        </>
      )}
      <h2 className="rayon">Prix qui montent</h2>
      <PrixQuiMontent hausses={prixQuiMontent(p.budget, aujourdhui)} />
    </>
  );
}

// ----- L'épargne -----

function Epargne(p: PropsPage & { plan: PlanBudget; reglerProjet: () => void }) {
  const { plan, aujourdhui } = p;
  const a = avanceeProjet(plan, p.budget, aujourdhui);
  const pots = etatDesPots(plan, p.budget, aujourdhui);
  const historique = historiqueEpargne(plan, p.budget).slice(-12).reverse();
  const courbe = courbeEpargne(plan, p.budget, aujourdhui);
  return (
    <>
      <section className="carte budget-projet">
        {a ? (
          <>
            <p className="surtitre">{a.projet.nom}</p>
            <p className="budget-solde">
              {montant(a.epargne)} <span className="discret">sur {montant(a.projet.objectif)}</span>
            </p>
            <span className="widget-jauge" aria-hidden>
              <span style={{ width: `${Math.round(a.part * 100)}%` }} />
            </span>
            {a.manque === 0 ? (
              <p>L'objectif est atteint.</p>
            ) : (
              <>
                {a.parMoisPourLaDate !== null && a.projet.date && (
                  <p className="discret">
                    Pour {nommerMois(moisDe(a.projet.date), aujourdhui)} : {montant(a.parMoisPourLaDate)} par mois.
                  </p>
                )}
                {a.atteintVers && <p className="discret">Au rythme prévu, atteint en {nommerMois(a.atteintVers, aujourdhui)}.</p>}
              </>
            )}
            <button type="button" className="lien" onClick={p.reglerProjet}>Changer le projet</button>
          </>
        ) : (
          <>
            <p className="surtitre">{plan.comptes.epargne || "Épargne"}</p>
            <p className="budget-solde">{montant(pots.epargne.solde)}</p>
            <p className="discret">Un projet (des vacances, un meuble, la réserve) : Kora dit où vous en êtes et ce qu'il faut par mois.</p>
            <button type="button" className="bouton-principal" onClick={p.reglerProjet}>Choisir un projet</button>
          </>
        )}
      </section>

      <CourbeEpargne points={courbe} objectif={plan.projet?.objectif ?? null} aujourdhui={aujourdhui} />

      {historique.length > 0 && (
        <>
          <h2 className="rayon">Mis de côté</h2>
          <ul className="carte groupe">
            {historique.map((h) => (
              <li key={h.mois} className="ligne">
                <span className="ligne-texte">
                  {nommerMois(h.mois, aujourdhui).replace(/^./, (c) => c.toUpperCase())}
                  {h.verse < h.prevu - 0.5 && <span className="tache-details"> · {montant(h.prevu - h.verse)} de moins que prévu</span>}
                </span>
                <span className="budget-montant">{montant(h.verse)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
