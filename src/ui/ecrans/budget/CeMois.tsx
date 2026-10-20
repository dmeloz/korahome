import { useState } from "react";
import {
  avanceeProjet,
  motDuMois,
  rythmeCourses,
  bilanDuMois,
  confirmerMois,
  decrireEcheanceFacture,
  depenses,
  etatDesPots,
  facturesAPayer,
  nommerMois,
  payerFacture,
  POTS_SUIVIS,
  sansDate,
  type Facture,
  type PlanBudget,
  type Pot,
} from "../../../domaine/budget";
import { useAnnoncer } from "../../annulation";
import { contexteReel } from "../../contexte";
import { vibrer } from "../../haptique";
import { Icone } from "../../Icone";
import type { PropsPage } from "../../modules";
import { PointEtat } from "../../pieces";
import { moisACloturer } from "../../../domaine/budgetConseil";
import { PaiementsAClasser } from "./Paiements";
import { JaugeRythme, MotDeJarvis, phraseRythme } from "./Visuels";
import { ChampMontant, leJour, majuscule, montant, nomDuPot } from "./communs";

// ----- Ce mois -----

/** Ce qui demande un geste d'abord (la clôture, les paiements à classer, les factures), puis les pots. */
export function CeMois(p: PropsPage & { plan: PlanBudget; voirCharges: () => void; voirPot: (pot: Pot) => void; voirDepenses: () => void }) {
  const { plan, depot, aujourdhui } = p;
  const annoncer = useAnnoncer();
  const pots = etatDesPots(plan, p.budget, aujourdhui);
  const aPayer = facturesAPayer(plan, p.budget, aujourdhui, 45);
  const datesManquantes = sansDate(plan);
  const dernieres = depenses(p.budget).filter((d) => d.jour <= aujourdhui).slice(0, 4);
  const avancee = avanceeProjet(plan, p.budget, aujourdhui);
  const rythme = rythmeCourses(plan, p.budget, aujourdhui);
  const mot = motDuMois(plan, p.budget, aujourdhui);

  async function payer(f: Facture) {
    const d = payerFacture(f, aujourdhui, p.membreId, contexteReel);
    await depot.enregistrerBudget(d);
    vibrer();
    annoncer(`${f.poste.libelle} payée.`, () => depot.supprimerBudget(d.id));
  }

  const detail: Record<Pot, string> = {
    commun: "",
    courses: rythme ? phraseRythme(rythme) : `${montant(pots.courses.depenseDuMois)} dépensés ce mois`,
    plaisir: `${montant(pots.plaisir.depenseDuMois)} dépensés sur ${montant(pots.plaisir.budgetDuMois)}`,
    factures: aPayer[0] ? `Prochaine : ${aPayer[0].poste.libelle}, ${decrireEcheanceFacture(aPayer[0].echeance, aujourdhui)}` : "Rien à payer ces prochaines semaines",
    epargne: avancee ? `${Math.round(avancee.part * 100)} % de « ${avancee.projet.nom} »` : `${montant(pots.epargne.budgetDuMois)} prévus ce mois`,
  };

  return (
    <>
      <Cloture {...p} plan={plan} mot={mot} />
      {mot && !moisACloturer(plan, p.budget, aujourdhui) && <MotDeJarvis texte={mot} />}
      <PaiementsAClasser {...p} plan={plan} />

      <div className="budget-pots">
        {POTS_SUIVIS.map((pot) => {
          const e = pots[pot];
          const jauge = pot === "courses" && rythme ? rythme : null;
          return (
            <button type="button" key={pot} className={`carte budget-pot${e.solde < 0 ? " negatif" : ""}`} onClick={() => p.voirPot(pot)}>
              <span className="surtitre">{nomDuPot(plan, pot)}</span>
              <span className="budget-solde">{montant(e.solde)}</span>
              {jauge && <JaugeRythme rythme={jauge} />}
              <span className="discret">{detail[pot]}</span>
            </button>
          );
        })}
      </div>

      <h2 className="rayon">Factures à payer</h2>
      {aPayer.length ? (
        <ul className="carte groupe">
          {aPayer.map((f) => {
            const retard = f.echeance < aujourdhui;
            return (
              <li key={`${f.poste.id}-${f.echeance}`}>
                <div className="ligne">
                  <button className="case" onClick={() => void payer(f)} aria-label={`${f.poste.libelle} payée`} />
                  <span className="ligne-texte">
                    {f.poste.libelle}
                    <span className={`tache-details${retard ? " retard" : ""}`}>
                      {" "}
                      · {decrireEcheanceFacture(f.echeance, aujourdhui)}
                    </span>
                  </span>
                  <span className="budget-montant">{montant(f.montant)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="discret budget-note">Aucune facture à payer à la main ces prochaines semaines.</p>
      )}
      {aPayer.length > 0 && <p className="discret budget-note">Payée par Apple Pay ou trouvée dans un relevé, une facture se coche seule.</p>}
      {datesManquantes.length > 0 && (
        <button type="button" className="carte budget-rappel" onClick={p.voirCharges}>
          <PointEtat etat="jour" />
          <span>
            {datesManquantes.length === 1 ? "Une facture de l'année n'a pas de mois" : `${datesManquantes.length} factures de l'année n'ont pas de mois`} :{" "}
            {datesManquantes.map((x) => x.libelle).join(", ")}. Donne le mois pour que Kora prévienne avant.
          </span>
        </button>
      )}

      <h2 className="rayon">Dernières dépenses</h2>
      {dernieres.length ? (
        <ul className="carte groupe">
          {dernieres.map((d) => (
            <li key={d.id}>
              <button type="button" className="ligne" onClick={p.voirDepenses}>
                <span className="ligne-texte">
                  {d.libelle}
                  <span className="tache-details">
                    {" "}
                    · {nomDuPot(plan, d.pot)} · {leJour(d.jour)}
                  </span>
                </span>
                <span className="budget-montant">{montant(d.montant)}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="ligne budget-tout-voir" onClick={p.voirDepenses}>
              <span className="ligne-texte">Toutes les dépenses</span>
              <Icone nom="suivant" taille={16} />
            </button>
          </li>
        </ul>
      ) : (
        <p className="discret budget-note">Rien de noté pour l'instant. Photographie un ticket avec ta fée, ou dis-lui « Migros 84.30 ».</p>
      )}
    </>
  );
}

/**
 * La clôture du mois : le mois qui vient de finir en bref, pot par pot, puis les versements du
 * nouveau mois, notés d'un seul geste. Ce qui reste dans chaque pot passe au mois suivant.
 */
function Cloture(p: PropsPage & { plan: PlanBudget; mot: string | null }) {
  const { plan, depot, aujourdhui } = p;
  const annoncer = useAnnoncer();
  const [epargne, setEpargne] = useState<number | null>(null);
  const cloture = moisACloturer(plan, p.budget, aujourdhui);
  if (!cloture) return null;
  const bilan = bilanDuMois(plan);
  const { nouveau, precedent } = cloture;

  async function confirmer() {
    const doc = confirmerMois(nouveau, { ...bilan.versements, epargne: epargne ?? bilan.versements.epargne }, p.membreId, contexteReel);
    await depot.enregistrerBudget(doc);
    vibrer();
    annoncer(precedent ? `${majuscule(nommerMois(precedent.mois))} clôturé, ${nommerMois(nouveau)} ouvert.` : `Versements de ${nommerMois(nouveau)} notés.`, () => depot.supprimerBudget(doc.id));
  }

  return (
    <section className="carte budget-cloture">
      {precedent && (
        <>
          <p className="surtitre">{majuscule(nommerMois(precedent.mois, aujourdhui))} en bref</p>
          <ul className="groupe">
            {POTS_SUIVIS.map((pot) => {
              const x = precedent.pots[pot];
              return (
                <li key={pot} className="ligne">
                  <span className={`budget-pastille pot-${pot}`} aria-hidden />
                  <span className="ligne-texte">
                    {nomDuPot(plan, pot)}
                    <span className="tache-details">
                      {" "}
                      · {pot === "epargne" ? `${montant(x.verse)} mis de côté` : `${montant(x.depense)} sortis${x.verse ? ` sur ${montant(x.verse)}` : ""}`}
                    </span>
                  </span>
                  <span className={`budget-montant${x.solde < 0 ? " negatif" : ""}`}>{montant(x.solde)}</span>
                </li>
              );
            })}
          </ul>
          {p.mot && <MotDeJarvis texte={p.mot} />}
          <p className="discret">À droite, ce qui passe à {nommerMois(nouveau)}.</p>
        </>
      )}
      <p className="surtitre">{majuscule(nommerMois(nouveau, aujourdhui))} : les versements</p>
      <ul className="groupe">
        {POTS_SUIVIS.map((pot) => (
          <li key={pot} className="ligne">
            <span className="ligne-texte">{nomDuPot(plan, pot)}</span>
            {pot === "epargne" ? (
              <ChampMontant valeur={epargne ?? bilan.versements.epargne} changer={setEpargne} libelle="Versé à l'épargne" />
            ) : (
              <span className="budget-montant">{montant(bilan.versements[pot])}</span>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="bouton-principal" onClick={() => void confirmer()}>
        {precedent ? `Clôturer ${nommerMois(precedent.mois)}` : "C'est versé"}
      </button>
      <p className="discret">Change l'épargne si vous avez versé un autre montant.</p>
    </section>
  );
}
