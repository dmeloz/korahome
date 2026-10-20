import { useState } from "react";
import {
  bilanDuMois,
  depenses,
  enregistrerPoste,
  facturesAPayer,
  lireDepense,
  lireMontant,
  moisBudget,
  nommerMois,
  nouveauPlan,
  nouveauPoste,
  nouvelleDepense,
  payerFacture,
  planDe,
  POTS,
  reglerFacture,
  type PlanBudget,
  type Pot,
  type Poste,
} from "../../../domaine/budget";
import type { Id } from "../../../domaine/types";
import { useAnnoncer } from "../../annulation";
import { contexteReel } from "../../contexte";
import { vibrer } from "../../haptique";
import { Icone } from "../../Icone";
import type { PropsPage } from "../../modules";
import { Onglets, Page, useGestionnaireBarre, useInvitationBarre } from "../../pieces";
import { completerPaiement, paiementsAClasser } from "../../../domaine/paiements";
import { moisACloturer } from "../../../domaine/budgetConseil";
import { CarteConseiller, useConseiller } from "./Conseiller";
import { FeuilleApplePay } from "./Paiements";
import { nomFee } from "../../fee";
import { montant } from "./communs";
import { CeMois } from "./CeMois";
import { Depenses } from "./Depenses";
import { Charges } from "./Charges";
import { Analyse } from "./Analyse";
import { FeuillePersonne, FeuillePoste, FeuilleProjet, FeuilleReglages } from "./Feuilles";

type Onglet = "mois" | "depenses" | "charges" | "analyse" | "conseiller";

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
      : onglet === "analyse"
      ? "La fin du mois prévue, les derniers mois, l'année des factures et l'épargne, calculés depuis vos dépenses."
      : onglet === "charges"
      ? "Dis une charge à ta fée : « Netflix 20 », « Assurance maison 118 par an ». Touche une ligne pour la régler."
      : `Dis une dépense à ta fée : « Migros 84.30 », « 32 cinéma ». Le ticket de caisse photographié par ${nomFee()} compte aussi dans les courses.`;

  return (
    <Page
      titre="Budget"
      sousTitre={`${nommerMois(moisBudget(plan, aujourdhui)).replace(/^./, (c) => c.toUpperCase())} · ${montant(bilanDuMois(plan).resteCommun)} de reste au commun`}
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
          { id: "analyse", libelle: "Analyse" },
          { id: "conseiller", libelle: "Conseiller" },
        ]}
      />

      {onglet === "mois" && (
        <CeMois
          {...p}
          plan={plan}
          voirCharges={() => setOnglet("charges")}
          voirPot={(pot) => {
            if (pot === "epargne") setOnglet("analyse");
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
      {onglet === "conseiller" && <CarteConseiller conseiller={conseiller} disponible={!!p.jarvis} />}
      {onglet === "analyse" && <Analyse {...p} plan={plan} reglerProjet={() => setProjet(true)} />}

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
