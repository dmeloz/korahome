import { useState } from "react";
import {
  abonnementsALAnnee,
  avanceeProjet,
  courbeEpargne,
  coursesParMagasin,
  coursesParMois,
  motDuMois,
  previsionFactures,
  prixQuiMontent,
  repartitionDuCommun,
  rythmeCourses,
  bilanDuMois,
  CATEGORIES_POSTE,
  confirmerMois,
  decrireEcheanceFacture,
  depenses,
  enregistrerPoste,
  etatDesPots,
  facturesAPayer,
  formaterMontant,
  historiqueEpargne,
  lireDepense,
  lireMontant,
  modifierPlan,
  moisDe,
  nomDuMois,
  nommerMois,
  nouveauPlan,
  nouveauPoste,
  nouvelleDepense,
  payerFacture,
  planDe,
  POTS,
  POTS_SUIVIS,
  reglerFacture,
  retirerPoste,
  sansDate,
  type Depense,
  type Facture,
  type PlanBudget,
  type Pot,
  type Poste,
} from "../../domaine/budget";
import { decaler, ecartJours } from "../../domaine/taches";
import type { Foyer, Id } from "../../domaine/types";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import type { PropsPage } from "../modules";
import { Feuille, Onglets, Page, PointEtat, useGestionnaireBarre, useInvitationBarre } from "../pieces";
import { completerPaiement, paiementsAClasser } from "../../domaine/paiements";
import { FeuilleReleve } from "./BudgetReleve";
import { moisACloturer, tableauDesMois } from "../../domaine/budgetConseil";
import { CarteConseiller, FinDuMois, TableauDesMois, useConseiller } from "./BudgetConseiller";
import { FeuilleApplePay, InvitationApplePay, PaiementsAClasser } from "./BudgetPaiements";
import { AnneauDuCommun, CourbeEpargne, CoursesParMois, JaugeRythme, Magasins, MoisLourds, MotDeJarvis, phraseRythme, PrixQuiMontent, TrajetSalaire } from "./BudgetVisuels";
import { nomFee } from "../fee";

type Onglet = "mois" | "depenses" | "charges" | "conseiller";

const prenomDe = (foyer: Foyer, id: Id | null) => (id ? (foyer.membres.find((m) => m.id === id)?.prenom ?? "") : "Commun");
const montant = (n: number) => formaterMontant(n);

/** Le budget du foyer : ce mois (les pots, les factures, les dépenses), les charges, l'épargne. */
export function Budget(p: PropsPage) {
  const { depot, aujourdhui, foyer } = p;
  const annoncer = useAnnoncer();
  const [onglet, setOnglet] = useState<Onglet>("mois");
  const [reglages, setReglages] = useState(false);
  const [poste, setPoste] = useState<Poste | null>(null);
  const [personne, setPersonne] = useState<Id | null>(null);
  const [projet, setProjet] = useState(false);
  const [applePay, setApplePay] = useState(false);
  const [filtre, setFiltre] = useState<Pot | null>(null);
  const conseiller = useConseiller(p);
  const plan = planDe(p.budget);
  useInvitationBarre(onglet === "conseiller" && p.jarvis ? "Une question, ex. où économiser ?" : null);

  useGestionnaireBarre("module:budget", async (texte) => {
    if (!plan) return false;
    // Dans le Conseiller, la barre pose une question.
    if (onglet === "conseiller") {
      if (!p.jarvis) return false;
      void conseiller.demander(texte.trim());
      return true;
    }
    if (onglet === "charges") {
      const m = /^(.+?)\s+(\d[\d’' ]*(?:[.,]\d{1,2})?)(?:\.-)?\s*(?:chf)?\s*(par an|par année|\/an|par mois|\/mois)?$/i.exec(texte.trim());
      const somme = m ? lireMontant(m[2]) : null;
      if (!m || somme === null) return false;
      const annuel = !!m[3] && /an/i.test(m[3]);
      const nouveau = nouveauPoste({ libelle: m[1], montant: somme, frequence: annuel ? "an" : "mois", pot: annuel ? "factures" : "commun" }, contexteReel);
      await depot.enregistrerBudget(enregistrerPoste(plan, nouveau, contexteReel));
      vibrer();
      setPoste(nouveau);
      return true;
    }
    const saisie = lireDepense(texte, plan);
    if (!saisie) return false;
    const facture = saisie.posteId ? facturesAPayer(plan, p.budget, aujourdhui, 31).find((f) => f.poste.id === saisie.posteId) : undefined;
    const depense = facture
      ? { ...payerFacture(facture, aujourdhui, p.membreId, contexteReel), montant: saisie.montant }
      : reglerFacture(nouvelleDepense({ ...saisie, jour: aujourdhui }, p.membreId, contexteReel), plan, p.budget);
    // Déjà arrivée par Apple Pay, du même montant aujourd'hui : on complète ce paiement.
    const deja = completerPaiement(depense, p.budget);
    if (deja) {
      const avant = depenses(p.budget).find((d) => d.id === deja.id)!;
      await depot.enregistrerBudget(deja);
      vibrer();
      annoncer(`Déjà payé par Apple Pay : ${deja.libelle} complété.`, () => depot.enregistrerBudget(avant));
      return true;
    }
    await depot.enregistrerBudget(depense);
    vibrer();
    annoncer(
      depense.posteId ? `${depense.libelle} payée (${montant(depense.montant)}).` : `${montant(depense.montant)} : ${depense.libelle}, ${POTS[depense.pot].nom.toLowerCase()}.`,
      () => depot.supprimerBudget(depense.id),
    );
    return true;
  });

  if (!plan) {
    return (
      <Page titre="Budget" sousTitre="Le budget du foyer">
        <section className="carte">
          <p>Le budget du foyer : chacun son salaire et sa part au compte commun, les courses, les factures, le plaisir et l'épargne. Kora fait les calculs et reporte ce qui reste d'un mois à l'autre.</p>
          <button type="button" className="bouton-principal" onClick={() => void depot.enregistrerBudget(nouveauPlan(foyer.membres.map((m) => m.id), aujourdhui, contexteReel))}>
            Commencer
          </button>
        </section>
      </Page>
    );
  }

  const enregistrer = (nouveau: PlanBudget) => depot.enregistrerBudget(nouveau);
  const aide =
    onglet === "conseiller"
      ? "Pose ta question au conseiller par ta fée : « Où peut-on économiser ? », « Nos courses mois par mois ». Il répond avec des chiffres, un tableau et des conseils."
      : onglet === "charges"
      ? "Dis une charge à ta fée : « Netflix 20 », « Assurance maison 118 par an ». Touche une ligne pour la régler."
      : `Dis une dépense à ta fée : « Migros 84.30 », « 32 cinéma ». Le ticket de caisse photographié par ${nomFee()} compte aussi dans les courses.`;

  return (
    <Page
      titre="Budget"
      sousTitre={`${nommerMois(moisDe(aujourdhui)).replace(/^./, (c) => c.toUpperCase())} · ${montant(bilanDuMois(plan).resteCommun)} de reste au commun`}
      actions={
        <button className="bouton-icone" onClick={() => setReglages(true)} aria-label="Comptes et réglages du budget">
          <Icone nom="reglages" taille={20} />
        </button>
      }
      aide={{ cle: "budget", texte: aide }}
      className="budget"
    >
      <Onglets
        libelle="Vue du budget"
        actif={onglet}
        changer={setOnglet}
        onglets={[
          { id: "mois", libelle: "Ce mois", compte: facturesAPayer(plan, p.budget, aujourdhui, 7).length + paiementsAClasser(p.budget).length + (moisACloturer(plan, p.budget, aujourdhui) ? 1 : 0) },
          { id: "depenses", libelle: "Dépenses" },
          { id: "charges", libelle: "Charges" },
          { id: "conseiller", libelle: "Conseiller" },
        ]}
      />

      {onglet === "mois" && (
        <CeMois
          {...p}
          plan={plan}
          voirCharges={() => setOnglet("charges")}
          voirPot={(pot) => {
            if (pot === "epargne") setOnglet("conseiller");
            else {
              setFiltre(pot);
              setOnglet("depenses");
            }
          }}
          voirDepenses={() => {
            setFiltre(null);
            setOnglet("depenses");
          }}
        />
      )}
      {onglet === "depenses" && <Depenses {...p} plan={plan} filtre={filtre} filtrer={setFiltre} ouvrirApplePay={() => setApplePay(true)} />}
      {onglet === "charges" && <Charges {...p} plan={plan} ouvrirPoste={setPoste} ouvrirPersonne={setPersonne} />}
      {onglet === "conseiller" && (
        <>
          <CarteConseiller conseiller={conseiller} disponible={!!p.jarvis} />
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
          <Epargne {...p} plan={plan} reglerProjet={() => setProjet(true)} />
          <Courses {...p} plan={plan} />
        </>
      )}

      <FeuillePoste plan={plan} poste={poste} foyer={foyer} fermer={() => setPoste(null)} enregistrer={enregistrer} />
      <FeuillePersonne plan={plan} membreId={personne} foyer={foyer} fermer={() => setPersonne(null)} enregistrer={enregistrer} />
      <FeuilleProjet plan={plan} ouverte={projet} fermer={() => setProjet(false)} enregistrer={enregistrer} />
      <FeuilleReglages
        plan={plan}
        ouverte={reglages}
        fermer={() => setReglages(false)}
        enregistrer={enregistrer}
        ouvrirApplePay={() => {
          setReglages(false);
          setApplePay(true);
        }}
      />
      <FeuilleApplePay {...p} plan={plan} ouverte={applePay} fermer={() => setApplePay(false)} />
    </Page>
  );
}

// ----- Ce mois -----

const nomDuPot = (plan: PlanBudget, pot: Pot) => plan.comptes[pot] || POTS[pot].nom;
const leJour = (jour: string) => `${Number(jour.slice(8, 10))} ${nomDuMois(Number(jour.slice(5, 7)))}`;

/** Ce qui demande un geste d'abord (la clôture, les paiements à classer, les factures), puis les pots. */
function CeMois(p: PropsPage & { plan: PlanBudget; voirCharges: () => void; voirPot: (pot: Pot) => void; voirDepenses: () => void }) {
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

const majuscule = (t: string) => t.replace(/^./, (c) => c.toUpperCase());

// ----- Les dépenses -----

/** Les dépenses mois par mois, jour par jour, avec un filtre par pot ; toucher une dépense la corrige. */
function Depenses(p: PropsPage & { plan: PlanBudget; filtre: Pot | null; filtrer: (pot: Pot | null) => void; ouvrirApplePay: () => void }) {
  const { plan, depot, aujourdhui } = p;
  const annoncer = useAnnoncer();
  const [mois, setMois] = useState(moisDe(aujourdhui));
  const [releve, setReleve] = useState(false);
  const [ouverte, setOuverte] = useState<Depense | null>(null);
  const toutes = depenses(p.budget);
  const premier = [plan.depart.mois, ...toutes.map((d) => moisDe(d.jour))].sort()[0];
  const duMois = toutes.filter((d) => moisDe(d.jour) === mois && (!p.filtre || d.pot === p.filtre));
  const jours = [...new Set(duMois.map((d) => d.jour))];
  const total = duMois.reduce((t, d) => t + d.montant, 0);
  const decaleMois = (n: number) => setMois(decaler(`${mois}-01`, { unite: "mois", tous: n }).slice(0, 7));

  async function retirer(d: Depense) {
    await depot.supprimerBudget(d.id);
    annoncer(`${d.libelle} retirée.`, () => depot.enregistrerBudget(d));
  }

  const nomDuJour = (jour: string) => {
    const ecart = ecartJours(jour, aujourdhui);
    return ecart === 0 ? "Aujourd'hui" : ecart === 1 ? "Hier" : majuscule(leJour(jour));
  };

  return (
    <>
      <div className="budget-mois-nav">
        <button type="button" className="bouton-icone" onClick={() => decaleMois(-1)} disabled={mois <= premier} aria-label="Mois précédent">
          <Icone nom="retour" taille={18} />
        </button>
        <p>
          <span className="surtitre">{majuscule(nommerMois(mois, aujourdhui))}</span>
          <span className="budget-solde">{montant(total)}</span>
        </p>
        <button type="button" className="bouton-icone" onClick={() => decaleMois(1)} disabled={mois >= moisDe(aujourdhui)} aria-label="Mois suivant">
          <Icone nom="suivant" taille={18} />
        </button>
      </div>
      <div className="puces budget-filtre" role="group" aria-label="Pot">
        <button type="button" className={`puce${!p.filtre ? " active" : ""}`} aria-pressed={!p.filtre} onClick={() => p.filtrer(null)}>
          Tout
        </button>
        {(["courses", "plaisir", "factures", "commun", "epargne"] as Pot[]).map((pot) => (
          <button type="button" key={pot} className={`puce${p.filtre === pot ? " active" : ""}`} aria-pressed={p.filtre === pot} onClick={() => p.filtrer(p.filtre === pot ? null : pot)}>
            {nomDuPot(plan, pot)}
          </button>
        ))}
      </div>

      {jours.length ? (
        jours.map((jour) => (
          <section key={jour}>
            <h2 className="rayon">{nomDuJour(jour)}</h2>
            <ul className="carte groupe">
              {duMois
                .filter((d) => d.jour === jour)
                .map((d) => (
                  <li key={d.id}>
                    <Glissable onSupprimer={() => void retirer(d)} libelle="Retirer">
                      <button type="button" className="ligne" onClick={() => setOuverte(d)} aria-haspopup="dialog">
                        <span className={`budget-pastille pot-${d.pot}`} aria-hidden />
                        <span className="ligne-texte">
                          {d.libelle}
                          <span className="tache-details">
                            {" "}
                            · {nomDuPot(plan, d.pot)}
                            {d.posteId ? " · facture" : ""}
                            {d.source === "ticket" || d.articles?.length ? " · ticket" : ""}
                            {d.source === "applepay" ? " · Apple Pay" : ""}
                            {d.source === "releve" ? " · relevé" : ""}
                          </span>
                        </span>
                        <span className="budget-montant">{montant(d.montant)}</span>
                      </button>
                    </Glissable>
                  </li>
                ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="discret budget-note">
          {p.filtre ? `Rien dans ${nomDuPot(plan, p.filtre).toLowerCase()} en ${nommerMois(mois)}.` : `Rien de noté en ${nommerMois(mois)}. Dis « Migros 84.30 » à ta fée, ou photographie un ticket.`}
        </p>
      )}

      <button type="button" className="bouton-secondaire budget-importer" onClick={() => setReleve(true)}>
        Importer un relevé Revolut
      </button>
      <FeuilleReleve plan={plan} budget={p.budget} depot={depot} membreId={p.membreId} ouverte={releve} fermer={() => setReleve(false)} />
      {p.jarvis && !Object.keys(plan.cartes ?? {}).length && <InvitationApplePay ouvrir={p.ouvrirApplePay} />}
      <FeuilleDepense plan={plan} depense={ouverte} depot={depot} fermer={() => setOuverte(null)} budget={p.budget} />
    </>
  );
}

/** Corriger une dépense : son nom, son montant, son pot. */
function FeuilleDepense(props: { plan: PlanBudget; depense: Depense | null; budget: PropsPage["budget"]; depot: PropsPage["depot"]; fermer: () => void }) {
  const annoncer = useAnnoncer();
  const actuelle = props.depense ? (depenses(props.budget).find((d) => d.id === props.depense!.id) ?? props.depense) : null;
  const changer = (c: Partial<Depense>) => actuelle && void props.depot.enregistrerBudget({ ...actuelle, ...c });
  return (
    <Feuille ouverte={!!actuelle} onFermer={props.fermer} titre={actuelle?.libelle}>
      {actuelle && (
        <div className="formulaire">
          <label>
            Nom
            <input defaultValue={actuelle.libelle} key={`${actuelle.id}-nom`} onBlur={(e) => e.target.value.trim() && changer({ libelle: e.target.value.trim() })} />
          </label>
          <label>
            Montant en francs
            <ChampMontant key={`${actuelle.id}-montant`} valeur={actuelle.montant} changer={(m) => changer({ montant: m })} libelle="Montant" />
          </label>
          <Puces
            libelle="Pot"
            valeur={actuelle.pot}
            changer={(pot) => changer({ pot })}
            choix={(["courses", "plaisir", "factures", "commun", "epargne"] as Pot[]).map((v) => ({ v, libelle: nomDuPot(props.plan, v) }))}
          />
          <p className="discret">
            {majuscule(leJour(actuelle.jour))}
            {actuelle.magasin && actuelle.magasin !== actuelle.libelle ? ` · ${actuelle.magasin}` : ""}
            {actuelle.carte ? ` · carte ${actuelle.carte}` : ""}
            {actuelle.articles?.length ? ` · ${actuelle.articles.length} articles sur le ticket` : ""}
          </p>
          <button
            type="button"
            className="lien danger"
            onClick={() => {
              props.fermer();
              void props.depot.supprimerBudget(actuelle.id);
              annoncer(`${actuelle.libelle} retirée.`, () => props.depot.enregistrerBudget(actuelle));
            }}
          >
            Retirer cette dépense
          </button>
        </div>
      )}
    </Feuille>
  );
}

// ----- Les charges -----

function Charges(p: PropsPage & { plan: PlanBudget; ouvrirPoste: (x: Poste) => void; ouvrirPersonne: (id: Id) => void }) {
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

// ----- Les feuilles -----

/** Un montant qu'on tape : il s'enregistre quand on quitte le champ. */
function ChampMontant(props: { valeur: number; changer: (n: number) => void; libelle: string }) {
  const [texte, setTexte] = useState<string | null>(null);
  const affiche = texte ?? formaterMontant(props.valeur, false).replace(/’/g, "");
  return (
    <input
      className="budget-champ"
      inputMode="decimal"
      aria-label={props.libelle}
      value={affiche}
      onChange={(e) => setTexte(e.target.value)}
      onBlur={() => {
        const n = texte === null ? null : lireMontant(texte);
        if (n !== null) props.changer(n);
        setTexte(null);
      }}
    />
  );
}

function Puces<T extends string | number>(props: { valeur: T; choix: readonly { v: T; libelle: string }[]; changer: (v: T) => void; libelle: string }) {
  return (
    <div className="budget-choix">
      <span className="discret">{props.libelle}</span>
      <div className="puces" role="group" aria-label={props.libelle}>
      {props.choix.map((c) => (
        <button type="button" key={String(c.v)} className={`puce${c.v === props.valeur ? " active" : ""}`} aria-pressed={c.v === props.valeur} onClick={() => props.changer(c.v)}>
          {c.libelle}
        </button>
      ))}
      </div>
    </div>
  );
}

function FeuillePoste(props: { plan: PlanBudget; poste: Poste | null; foyer: Foyer; fermer: () => void; enregistrer: (p: PlanBudget) => Promise<void> }) {
  const annoncer = useAnnoncer();
  const actuel = props.poste ? (props.plan.postes.find((x) => x.id === props.poste!.id) ?? props.poste) : null;
  const changer = (c: Partial<Poste>) => actuel && void props.enregistrer(enregistrerPoste(props.plan, { ...actuel, ...c }, contexteReel));
  return (
    <Feuille ouverte={!!actuel} onFermer={props.fermer} titre={actuel?.libelle}>
      {actuel && (
        <div className="formulaire">
          <label>
            Nom
            <input defaultValue={actuel.libelle} key={`${actuel.id}-nom`} onBlur={(e) => e.target.value.trim() && changer({ libelle: e.target.value.trim() })} />
          </label>
          <label>
            Montant en francs
            <ChampMontant key={`${actuel.id}-montant`} valeur={actuel.montant} changer={(montant) => changer({ montant })} libelle="Montant" />
          </label>
          <Puces libelle="Fréquence" valeur={actuel.frequence} changer={(frequence) => changer({ frequence })} choix={[{ v: "mois", libelle: "Chaque mois" }, { v: "an", libelle: "Une fois par an" }]} />
          <Puces
            libelle="Qui la paie"
            valeur={actuel.qui ?? "commun"}
            changer={(v) => changer({ qui: v === "commun" ? null : v, pot: v === "commun" ? (actuel.pot ?? "commun") : null })}
            choix={[{ v: "commun", libelle: "Compte commun" }, ...props.foyer.membres.map((m) => ({ v: m.id, libelle: m.prenom }))]}
          />
          {actuel.qui === null && (
            <Puces
              libelle="Payée par"
              valeur={actuel.pot ?? "commun"}
              changer={(pot) => changer({ pot })}
              choix={(["commun", "courses", "factures"] as Pot[]).map((v) => ({ v, libelle: props.plan.comptes[v] || POTS[v].nom }))}
            />
          )}
          {actuel.frequence === "an" && (
            <Puces
              libelle="Mois où elle tombe"
              valeur={actuel.mois ?? 0}
              changer={(mois) => changer({ mois: mois || null })}
              choix={[{ v: 0, libelle: "Je ne sais pas" }, ...Array.from({ length: 12 }, (_, i) => ({ v: i + 1, libelle: nomDuMois(i + 1) }))]}
            />
          )}
          <label>
            Jour du mois où elle tombe
            <input
              key={`${actuel.id}-jour`}
              inputMode="numeric"
              defaultValue={actuel.jour ?? ""}
              placeholder="Pas de jour fixe"
              onBlur={(e) => {
                const n = Number(e.target.value);
                changer({ jour: Number.isInteger(n) && n >= 1 && n <= 31 ? n : null });
              }}
            />
          </label>
          {actuel.qui === null && actuel.frequence === "mois" && actuel.pot !== "commun" && (
            <button type="button" className="ligne chef-interrupteur" onClick={() => changer({ prelevement: !actuel.prelevement })} aria-pressed={actuel.prelevement}>
              <span className="ligne-texte">Prélevée seule chaque mois</span>
              <span className={`interrupteur${actuel.prelevement ? " actif" : ""}`} aria-hidden />
            </button>
          )}
          <Puces libelle="Catégorie" valeur={actuel.categorie} changer={(categorie) => changer({ categorie })} choix={Object.entries(CATEGORIES_POSTE).map(([v, libelle]) => ({ v: v as Poste["categorie"], libelle }))} />
          <button
            type="button"
            className="lien danger"
            onClick={() => {
              const avant = props.plan;
              props.fermer();
              void props.enregistrer(retirerPoste(props.plan, actuel.id, contexteReel));
              annoncer(`${actuel.libelle} retirée.`, () => props.enregistrer(avant));
            }}
          >
            Retirer cette charge
          </button>
        </div>
      )}
    </Feuille>
  );
}

function FeuillePersonne(props: { plan: PlanBudget; membreId: Id | null; foyer: Foyer; fermer: () => void; enregistrer: (p: PlanBudget) => Promise<void> }) {
  const personne = props.plan.personnes.find((x) => x.membreId === props.membreId);
  const bilan = bilanDuMois(props.plan).personnes.find((x) => x.membreId === props.membreId);
  const changer = (c: { revenu?: number; versement?: number }) =>
    void props.enregistrer(modifierPlan(props.plan, { personnes: props.plan.personnes.map((x) => (x.membreId === props.membreId ? { ...x, ...c } : x)) }, contexteReel));
  return (
    <Feuille ouverte={!!personne} onFermer={props.fermer} titre={personne ? prenomDe(props.foyer, personne.membreId) : undefined}>
      {personne && bilan && (
        <div className="formulaire">
          <label>
            Salaire du mois
            <ChampMontant key={`${personne.membreId}-revenu`} valeur={personne.revenu} changer={(revenu) => changer({ revenu })} libelle="Salaire" />
          </label>
          <label>
            Versé chaque mois au compte commun
            <ChampMontant key={`${personne.membreId}-versement-${personne.versement}`} valeur={personne.versement} changer={(versement) => changer({ versement })} libelle="Versement" />
          </label>
          {Math.abs(bilan.auProrata - personne.versement) >= 1 && (
            <button type="button" className="lien" onClick={() => changer({ versement: Math.round(bilan.auProrata) })}>
              Au prorata des salaires : {formaterMontant(Math.round(bilan.auProrata))}
            </button>
          )}
          <p className="discret">Reste après les charges et le versement : {formaterMontant(bilan.reste)}.</p>
        </div>
      )}
    </Feuille>
  );
}

function FeuilleProjet(props: { plan: PlanBudget; ouverte: boolean; fermer: () => void; enregistrer: (p: PlanBudget) => Promise<void> }) {
  const projet = props.plan.projet ?? { nom: "", objectif: 0, date: null };
  const changer = (c: Partial<typeof projet>) => {
    const nouveau = { ...projet, ...c };
    void props.enregistrer(modifierPlan(props.plan, { projet: nouveau.nom.trim() || nouveau.objectif > 0 ? nouveau : null }, contexteReel));
  };
  return (
    <Feuille ouverte={props.ouverte} onFermer={props.fermer} titre="Projet d'épargne">
      <div className="formulaire">
        <label>
          Le projet
          <input defaultValue={projet.nom} placeholder="Ex. Vacances au Japon" onBlur={(e) => changer({ nom: e.target.value.trim() })} />
        </label>
        <label>
          Montant visé
          <ChampMontant valeur={projet.objectif} changer={(objectif) => changer({ objectif })} libelle="Montant visé" />
        </label>
        <label>
          Pour quand (facultatif)
          <input type="date" defaultValue={projet.date ?? ""} min="2026-01-01" onChange={(e) => changer({ date: e.target.value || null })} />
        </label>
        {props.plan.projet && (
          <button type="button" className="lien danger" onClick={() => { void props.enregistrer(modifierPlan(props.plan, { projet: null }, contexteReel)); props.fermer(); }}>
            Retirer le projet
          </button>
        )}
      </div>
    </Feuille>
  );
}

function FeuilleReglages(props: { plan: PlanBudget; ouverte: boolean; fermer: () => void; enregistrer: (p: PlanBudget) => Promise<void>; ouvrirApplePay: () => void }) {
  const { plan } = props;
  const changer = (c: Parameters<typeof modifierPlan>[1]) => void props.enregistrer(modifierPlan(plan, c, contexteReel));
  return (
    <Feuille ouverte={props.ouverte} onFermer={props.fermer} titre="Comptes et réglages">
      <div className="formulaire">
        <p className="surtitre">Comptes et cartes</p>
        <p className="discret">Le nom de chaque compte ou carte, pour s'y retrouver. Jamais de numéro de compte ni de code : Kora ne se connecte à aucune banque.</p>
        {POTS_SUIVIS.map((pot) => (
          <label key={pot}>
            {POTS[pot].nom}
            <input defaultValue={plan.comptes[pot] ?? ""} placeholder={POTS[pot].description} onBlur={(e) => changer({ comptes: { ...plan.comptes, [pot]: e.target.value.trim() || undefined } })} />
          </label>
        ))}
        <button type="button" className="bouton-secondaire" onClick={props.ouvrirApplePay}>
          Paiements Apple Pay{Object.keys(plan.cartes ?? {}).length ? ` · ${Object.keys(plan.cartes ?? {}).length} carte${Object.keys(plan.cartes ?? {}).length > 1 ? "s" : ""}` : ""}
        </button>
        <label>
          Jour de paie
          <input
            inputMode="numeric"
            defaultValue={plan.jourDePaie ?? ""}
            placeholder="Ex. 25"
            onBlur={(e) => {
              const n = Number(e.target.value);
              changer({ jourDePaie: Number.isInteger(n) && n >= 1 && n <= 31 ? n : null });
            }}
          />
        </label>
        <p className="discret">Le mois s'ouvre ce jour-là : Kora propose de noter les versements dans chaque pot.</p>
        <p className="surtitre">Le reste du commun</p>
        <Puces
          libelle="Part du plaisir"
          valeur={Math.round(plan.partPlaisir * 100)}
          changer={(v) => changer({ partPlaisir: v / 100 })}
          choix={[20, 30, 40, 50].map((v) => ({ v, libelle: `${v} % plaisir` }))}
        />
        <p className="surtitre">Soldes au début de {nommerMois(plan.depart.mois)}</p>
        <p className="discret">Ce qu'il y avait vraiment sur chaque compte ; Kora compte à partir de là.</p>
        {POTS_SUIVIS.map((pot) => (
          <label key={`depart-${pot}`}>
            {plan.comptes[pot] || POTS[pot].nom}
            <ChampMontant valeur={plan.depart.soldes[pot] ?? 0} changer={(n) => changer({ depart: { ...plan.depart, soldes: { ...plan.depart.soldes, [pot]: n } } })} libelle={`Solde de départ, ${POTS[pot].nom}`} />
          </label>
        ))}
      </div>
    </Feuille>
  );
}
