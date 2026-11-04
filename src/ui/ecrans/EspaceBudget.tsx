import { apercuAutre, depensesParJour, etatAMoi } from "../../domaine/aMoi";
import { decrireEcheanceFacture, etatDesPots, facturesAPayer, formaterMontant, nommerMois, planDe, POTS } from "../../domaine/budget";
import { paiementsAClasser } from "../../domaine/paiements";
import { Icone } from "../Icone";
import type { DonneesModule } from "../modules";
import type { Page } from "../pages";
import { enLettres, EnteteEspace, Grille, Jauge, Tuile } from "../pieces/Cartes";
import { CarteTael } from "../pieces/Tael";
import { noterUsage } from "../usage";

// Budget (Kora 0.1) : la page de cartes de l'espace. Le seul grand chiffre de l'écran, « à toi ce
// mois », avec sa courbe des douze derniers jours ; en laiton ce qui attend (des paiements à
// classer, sinon la prochaine facture) ; les pots du commun ; l'autre en ivoire (sa part, jamais
// son salaire) ; l'épargne ; Tael. Chaque carte mène à l'onglet du Budget qui en dit plus.

export function EspaceBudget(props: { donnees: DonneesModule; ouvrir: (p: Page) => void }) {
  const { donnees } = props;
  const { aujourdhui, membreId, foyer } = donnees;
  const ouvrir = (onglet: string) => {
    noterUsage("widget", "budget");
    props.ouvrir({ nom: "module", id: "budget", onglet });
  };
  const plan = planDe(donnees.budget);
  const autre = foyer.membres.find((m) => m.id !== membreId) ?? null;

  if (!plan) {
    return (
      <main className="page espace budget">
        <EnteteEspace titre="Budget" sous="Le budget du foyer, à commencer" />
        <Grille label="Budget">
          <Tuile forte large i={0} onClick={() => ouvrir("mois")} label="Commencer le budget">
            <p className="etiq">Le budget du foyer</p>
            <p className="titre-c">Pots, charges, épargne : tout part d'ici.</p>
            <p className="doux">Les salaires, la part de chacun au commun, les factures qui reviennent. Un quart d'heure, une fois.</p>
          </Tuile>
          <CarteTael />
        </Grille>
      </main>
    );
  }

  const aMoi = membreId ? etatAMoi(plan, donnees.budget, membreId, aujourdhui) : null;
  const courbe = membreId ? depensesParJour(donnees.budget, membreId, aujourdhui) : [];
  const pots = etatDesPots(plan, donnees.budget, aujourdhui);
  const aClasser = paiementsAClasser(donnees.budget);
  const factures = facturesAPayer(plan, donnees.budget, aujourdhui);
  const facture = factures[0] ?? null;
  const apercu = autre ? apercuAutre(plan, donnees.budget, autre.id, aujourdhui) : null;
  const mois = nommerMois(aMoi?.mois ?? aujourdhui.slice(0, 7), aujourdhui);
  const part = (pot: "courses" | "plaisir") => (pots[pot].budgetDuMois > 0 ? pots[pot].depenseDuMois / pots[pot].budgetDuMois : 0);

  let i = 0;
  return (
    <main className="page espace budget">
      <EnteteEspace titre="Budget" sous={aMoi ? aMoi.phrase : `${mois.replace(/^./, (c) => c.toUpperCase())}, d'une paie à l'autre`} />

      <Grille label="Budget">
        <Tuile large i={i++} widget="budget" onClick={() => ouvrir("mois")} label={aMoi ? `À toi ce mois : ${formaterMontant(aMoi.reste)}, ${formaterMontant(aMoi.parJour)} par jour` : `Carte courses : ${formaterMontant(pots.courses.solde)}`} className={aMoi && !aMoi.suivi ? "sans-suivi" : undefined}>
          <p className="etiq"><Icone nom="portefeuille" taille={18} />{aMoi ? (aMoi.suivi ? "À toi ce mois" : "Prévu pour toi") : "Carte courses"}</p>
          <p className="grand-chiffre">{Math.max(0, Math.floor(aMoi ? aMoi.reste : pots.courses.solde))}<small>CHF</small></p>
          <Courbe points={courbe.map((j) => j.total)} />
          <p className="doux">{aMoi ? (aMoi.suivi ? `${formaterMontant(aMoi.parJour)} par jour d'ici ta paie, ${aMoi.joursRestants} jour${aMoi.joursRestants > 1 ? "s" : ""}.` : "Dis « 12 café pour moi » à Tael et l'anneau saura.") : `${formaterMontant(pots.courses.depenseDuMois)} dépensés ce mois.`}</p>
        </Tuile>

        {aClasser.length ? (
          <Tuile forte large i={i++} onClick={() => ouvrir("depenses")} label={`${aClasser.length} paiement${aClasser.length > 1 ? "s" : ""} à classer`}>
            <p className="etiq">À classer</p>
            <p className="titre-c">{aClasser[0].marchand ?? aClasser[0].carte}, {formaterMontant(aClasser[0].montant)}</p>
            <p className="doux">{aClasser.length === 1 ? "Un paiement attend sa catégorie." : `${enLettres(aClasser.length).replace(/^./, (c) => c.toUpperCase())} paiements attendent leur catégorie.`}</p>
          </Tuile>
        ) : facture ? (
          <Tuile forte large i={i++} onClick={() => ouvrir("charges")} label={`Prochaine facture : ${facture.poste.libelle}, ${formaterMontant(facture.montant)}, ${decrireEcheanceFacture(facture.echeance, aujourdhui)}`}>
            <p className="etiq">Prochaine facture, {decrireEcheanceFacture(facture.echeance, aujourdhui)}</p>
            <p className="titre-c">{facture.poste.libelle}</p>
            <p className="doux">{formaterMontant(facture.montant)}{factures.length > 1 ? ` · ${factures.length - 1} autre${factures.length > 2 ? "s" : ""} à venir` : ""}</p>
          </Tuile>
        ) : (
          <Tuile forte large i={i++} onClick={() => ouvrir("charges")} label="Aucune facture à payer">
            <p className="etiq">Factures</p>
            <p className="titre-c">Rien à payer à la main ces deux mois.</p>
          </Tuile>
        )}

        {aClasser.length > 0 && facture && (
          <Tuile i={i++} onClick={() => ouvrir("charges")} label={`Prochaine facture : ${facture.poste.libelle}`}>
            <p className="etiq"><Icone nom="ticket" taille={18} />Prochaine facture</p>
            <p className="phrase"><b>{facture.poste.libelle}</b>, {formaterMontant(facture.montant)}, {decrireEcheanceFacture(facture.echeance, aujourdhui)}.</p>
          </Tuile>
        )}

        <Tuile large i={i++} onClick={() => ouvrir("mois")} label={`En commun : courses ${formaterMontant(pots.courses.solde)}, plaisir ${formaterMontant(pots.plaisir.solde)}`}>
          <p className="etiq"><Icone nom="maison" taille={18} />En commun</p>
          <div className="ligne-b"><span>{POTS.courses.nom}<small>{formaterMontant(pots.courses.depenseDuMois)} sur {formaterMontant(pots.courses.budgetDuMois)}</small></span><span className="val">{formaterMontant(pots.courses.solde, false)}</span></div>
          <Jauge part={part("courses")} />
          <div className="ligne-b"><span>{POTS.plaisir.nom}<small>{formaterMontant(pots.plaisir.depenseDuMois)} sur {formaterMontant(pots.plaisir.budgetDuMois)}</small></span><span className="val">{formaterMontant(pots.plaisir.solde, false)}</span></div>
          <Jauge part={part("plaisir")} />
        </Tuile>

        <CarteTael />

        {autre && apercu && (
          <Tuile contraste i={i++} onClick={() => ouvrir("charges")} label={`${autre.prenom} : ${formaterMontant(apercu.versement)} au commun`}>
            <p className="etiq">{autre.prenom}</p>
            <p className="titre-c">{formaterMontant(apercu.versement)} au commun</p>
            <p className="doux">{apercu.nombre ? `${formaterMontant(apercu.depensesCommunes)} payés pour nous ce mois.` : "Rien payé pour nous ce mois."}</p>
          </Tuile>
        )}

        <Tuile i={i++} onClick={() => ouvrir("analyse")} label={`Épargne : ${formaterMontant(pots.epargne.solde)}`}>
          <p className="etiq"><Icone nom="sauvegarde" taille={18} />Épargne</p>
          <p className="phrase"><b>{formaterMontant(pots.epargne.solde, false)}</b> CHF de côté{pots.epargne.budgetDuMois ? `, ${formaterMontant(pots.epargne.budgetDuMois, false)} par mois` : ""}.</p>
        </Tuile>
      </Grille>
    </main>
  );
}

/** Une courbe nue des dépenses d'un jour à l'autre ; plate quand il n'y a rien. */
function Courbe({ points }: { points: number[] }) {
  const largeur = 100;
  const hauteur = 32;
  const max = Math.max(1, ...points);
  const pas = points.length > 1 ? largeur / (points.length - 1) : largeur;
  const d = points.length
    ? points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * pas).toFixed(1)},${(hauteur - 2 - (p / max) * (hauteur - 4)).toFixed(1)}`).join(" ")
    : `M0,${hauteur - 2} L${largeur},${hauteur - 2}`;
  return (
    <svg className="courbe" viewBox={`0 0 ${largeur} ${hauteur}`} preserveAspectRatio="none" aria-hidden>
      <path className="fond" d={`M0,${hauteur - 2} L${largeur},${hauteur - 2}`} />
      <path d={d} />
    </svg>
  );
}
