import { useState } from "react";
import {
  avanceeMoisBudget,
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
import { EtatVide, Onglets, Page, useGestionnaireBarre, useInvitationBarre } from "../../pieces";
import { ouvrirVerrou, verrouOuvert } from "../../verrou";
import { completerPaiement, paiementsAClasser } from "../../../domaine/paiements";
import { moisACloturer } from "../../../domaine/budgetConseil";
import { CarteConseiller, useConseiller } from "./Conseiller";
import { FeuilleApplePay } from "./Paiements";
import { TicketDeCaisse } from "../../TicketDeCaisse";
import { montant, prenomDe } from "./communs";
import { CeMois, FeuillePlus } from "./CeMois";
import { etatAMoi } from "../../../domaine/aMoi";
import { Depenses } from "./Depenses";
import { Charges } from "./Charges";
import { Analyse } from "./Analyse";
import { FeuilleEtiquette, FeuillePersonne, FeuillePoste, FeuilleProjet, FeuilleReglages, type OuvertureEtiquette } from "./Feuilles";
import { sauver } from "../../sauver";

type Onglet = "mois" | "depenses" | "charges" | "analyse" | "conseiller";
const estOnglet = (o: string | undefined): o is Onglet => o === "mois" || o === "depenses" || o === "charges" || o === "analyse" || o === "conseiller";

/** Le budget du foyer : ce mois (les pots, les factures, les dépenses), les charges, l'épargne. */
export function Budget(p: PropsPage) {
  const { depot, aujourdhui, foyer } = p;
  const annoncer = useAnnoncer();
  const [onglet, setOnglet] = useState<Onglet>(estOnglet(p.onglet) ? p.onglet : "mois");
  const [ferme, setFerme] = useState(() => !verrouOuvert());
  const [reglages, setReglages] = useState(false);
  const [poste, setPoste] = useState<Poste | null>(null);
  const [personne, setPersonne] = useState<Id | null>(null);
  const [projet, setProjet] = useState(false);
  const [applePay, setApplePay] = useState(false);
  const [etiquette, setEtiquette] = useState<OuvertureEtiquette>(null);
  const [filtre, setFiltre] = useState<Pot | null>(null);
  const [plus, setPlus] = useState(false);
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
        <EtatVide
          picto="portefeuille"
          titre="Pas encore de budget"
          action={
            <button type="button" className="bouton-principal" onClick={() => sauver(depot.enregistrerBudget(nouveauPlan(foyer.membres.map((m) => m.id), aujourdhui, contexteReel)))}>
              Commencer
            </button>
          }
        >
          Chacun son salaire et sa part au compte commun, puis les courses, les factures, le plaisir et l'épargne. Kora fait les calculs et reporte le reste d'un mois à l'autre.
        </EtatVide>
      </Page>
    );
  }

  if (ferme) {
    return (
      <Page titre="Budget" sousTitre="Verrouillé sur ce téléphone" className="budget">
        <section className="carte budget-verrou">
          <Icone nom="cadenas" taille={28} />
          <p>Le Budget s'ouvre avec Face ID ou Touch ID. Il reste ouvert dix minutes.</p>
          <button type="button" className="bouton-principal" onClick={() => void ouvrirVerrou().then((ok) => ok && setFerme(false))}>
            Déverrouiller
          </button>
        </section>
      </Page>
    );
  }

  const enregistrer = (nouveau: PlanBudget) => depot.enregistrerBudget(nouveau);
  const aMoi = !!p.membreId && !!etatAMoi(plan, p.budget, p.membreId, aujourdhui);
  const aide =
    onglet === "conseiller"
      ? "Pose ta question au conseiller par ta fée : « Où peut-on économiser ? », « Nos courses mois par mois ». Il répond avec des chiffres, un tableau et des conseils."
      : onglet === "analyse"
      ? "La fin du mois prévue, les derniers mois, l'année des factures et l'épargne, calculés depuis vos dépenses."
      : onglet === "charges"
      ? "Dis une charge à ta fée : « Netflix 20 », « Assurance maison 118 par an ». Touche une ligne pour la régler."
      : `Dis une dépense à ta fée : « Migros 84.30 », « 12 café pour moi ». Le bouton ticket en haut lit un ticket de caisse (photo ou PDF).`;
  const voirPot = (pot: Pot) => {
    if (pot === "epargne") setOnglet("analyse");
    else {
      setFiltre(pot);
      setOnglet("depenses");
    }
  };

  return (
    <Page
      titre="Budget"
      sousTitre={`${nommerMois(moisBudget(plan, aujourdhui)).replace(/^./, (c) => c.toUpperCase())} · ${
        aMoi ? `jour ${avanceeMoisBudget(plan, aujourdhui).jour} sur ${avanceeMoisBudget(plan, aujourdhui).jours}` : `${montant(bilanDuMois(plan).resteCommun)} de reste au commun`
      }`}
      actions={
        <>
          {p.jarvis && <TicketDeCaisse jarvis={p.jarvis} donnees={p} depot={depot} catalogue={p.catalogue} classe="bouton-icone" />}
          <button className="bouton-icone" onClick={() => setReglages(true)} aria-label="Comptes et réglages du budget">
            <Icone nom="reglages" taille={20} />
          </button>
        </>
      }
      aide={{ cle: "budget", texte: aide }}
      className="budget"
    >
      <Onglets
        libelle="Vue du budget"
        actif={onglet === "analyse" || onglet === "conseiller" ? "plus" : onglet}
        changer={(o) => (o === "plus" ? setPlus(true) : setOnglet(o))}
        onglets={[
          { id: "mois", libelle: "Ce mois", compte: facturesAPayer(plan, p.budget, aujourdhui, 7).length + paiementsAClasser(p.budget).length + (moisACloturer(plan, p.budget, aujourdhui) ? 1 : 0) },
          { id: "depenses", libelle: "Dépenses" },
          { id: "charges", libelle: "Charges" },
          { id: "plus", libelle: onglet === "analyse" ? "Analyse" : onglet === "conseiller" ? "Conseiller" : "Plus" },
        ]}
      />

      {onglet === "mois" && (
        <CeMois
          {...p}
          plan={plan}
          voirCharges={() => setOnglet("charges")}
          voirPot={voirPot}
          ouvrirPlus={() => setPlus(true)}
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
        budget={p.budget}
        prenom={prenomDe(foyer, p.membreId) || "moi"}
        ouverte={reglages}
        fermer={() => setReglages(false)}
        enregistrer={enregistrer}
        ouvrirApplePay={() => {
          setReglages(false);
          setApplePay(true);
        }}
        ouvrirEtiquette={(o) => {
          setReglages(false);
          setEtiquette(o);
        }}
      />
      <FeuilleEtiquette
        plan={plan}
        ouverture={etiquette}
        enregistrer={enregistrer}
        fermer={() => {
          setEtiquette(null);
          setReglages(true);
        }}
      />
      <FeuilleApplePay {...p} plan={plan} ouverte={applePay} fermer={() => setApplePay(false)} />
      <FeuillePlus
        {...p}
        plan={plan}
        ouverte={plus}
        fermer={() => setPlus(false)}
        voirPot={(pot) => {
          setPlus(false);
          voirPot(pot);
        }}
        aller={(o) => {
          setPlus(false);
          if (o === "comptes") setReglages(true);
          else setOnglet(o);
        }}
      />
    </Page>
  );
}
