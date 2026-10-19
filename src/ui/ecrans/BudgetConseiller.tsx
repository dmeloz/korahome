import { useState } from "react";
import { formaterMontant, nommerMois, POTS, POTS_SUIVIS, type PlanBudget, type Pot } from "../../domaine/budget";
import {
  decrireBudgetConseiller,
  finDuMois,
  lireConseiller,
  phraseFinDuMois,
  QUESTIONS_CONSEILLER,
  type BilanDeMois,
  type ReponseConseiller,
} from "../../domaine/budgetConseil";
import { formaterChf } from "../../domaine/jarvis";
import { Icone } from "../Icone";
import type { PropsPage } from "../modules";
import { vibrer } from "../haptique";
import { nomFee } from "../fee";

// Le conseiller du Budget (Kora 0.0.37) : Jarvis lit tout le budget et répond par quelques
// phrases, un tableau s'il le faut et des conseils chiffrés. Règles dans src/domaine/budgetConseil.ts.

const montant = (n: number) => formaterMontant(n);
const majuscule = (t: string) => t.replace(/^./, (c) => c.toUpperCase());
const nomDuPot = (plan: PlanBudget, pot: Pot) => plan.comptes[pot] || POTS[pot].nom;

interface Echange {
  question: string;
  reponse: ReponseConseiller;
}

/** La dernière réponse reste sur ce téléphone (les montants ne quittent pas l'appareil autrement). */
const CLE = "korahome.conseillerBudget";

function relire(): Echange | null {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as Echange) : null;
  } catch {
    return null;
  }
}

function garder(e: Echange) {
  try {
    localStorage.setItem(CLE, JSON.stringify(e));
  } catch {
    // Navigation privée : la réponse reste affichée tant que la page est ouverte.
  }
}

export interface Conseiller {
  echange: Echange | null;
  enCours: string | null;
  erreur: string | null;
  alerte: string | null;
  demander: (question: string) => Promise<void>;
}

/** Le conseiller, partagé par la barre du bas et l'onglet Conseiller. */
export function useConseiller(p: PropsPage): Conseiller {
  const [echange, setEchange] = useState<Echange | null>(relire);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [alerte, setAlerte] = useState<string | null>(null);

  async function demander(question: string) {
    if (!p.jarvis || enCours) return;
    setEnCours(question);
    setErreur(null);
    try {
      const prenoms = (id: string) => p.foyer.membres.find((m) => m.id === id)?.prenom ?? "";
      const r = await p.jarvis.serveur.demanderJarvis({
        foyerId: p.jarvis.foyerId,
        mode: "budget",
        demande: question,
        etat: decrireBudgetConseiller(p.budget, prenoms, p.aujourdhui),
        historique: echange ? [{ role: "personne", texte: echange.question }, { role: "jarvis", texte: echange.reponse.texte }] : [],
      });
      const nouveau = { question, reponse: lireConseiller(r.appels, r.texte) };
      setEchange(nouveau);
      garder(nouveau);
      setAlerte(r.budget.alerte ? `${nomFee()} a utilisé ${formaterChf(r.budget.depenseChf)} sur ${formaterChf(r.budget.plafondChf)} ce mois-ci.` : null);
      vibrer();
    } catch (e) {
      setErreur(e instanceof Error && e.message ? e.message : "Le conseiller ne répond pas, réessaie.");
    } finally {
      setEnCours(null);
    }
  }

  return { echange, enCours, erreur, alerte, demander };
}

/** La carte du conseiller : des questions toutes prêtes, ou la barre du bas ; la réponse en dessous. */
export function CarteConseiller(props: { conseiller: Conseiller; disponible: boolean }) {
  const { echange, enCours, erreur, alerte, demander } = props.conseiller;
  if (!props.disponible) {
    return (
      <section className="carte budget-conseiller">
        <p className="surtitre">Le conseiller</p>
        <p className="discret">Le conseiller passe par {nomFee()} : elle arrive avec le partage du foyer.</p>
      </section>
    );
  }
  return (
    <section className="carte budget-conseiller" aria-busy={!!enCours}>
      <p className="surtitre">
        <Icone nom="jarvis" taille={16} /> Le conseiller
      </p>
      <div className="puces" role="group" aria-label="Questions au conseiller">
        {QUESTIONS_CONSEILLER.map((q) => (
          <button type="button" key={q} className="puce" disabled={!!enCours} onClick={() => void demander(q)}>
            {q}
          </button>
        ))}
      </div>
      <p className="discret">Ou pose ta question dans la barre : « Combien chez Coop depuis août ? »</p>
      {enCours && (
        <p className="budget-conseiller-attente" aria-live="polite">
          {enCours} : {nomFee()} lit le budget…
        </p>
      )}
      {erreur && <p className="discret">{erreur}</p>}
      {!enCours && echange && <Reponse echange={echange} />}
      {alerte && <p className="discret">{alerte}</p>}
    </section>
  );
}

function Reponse({ echange }: { echange: Echange }) {
  const { reponse } = echange;
  return (
    <div className="budget-reponse" aria-live="polite">
      <p className="budget-question">{echange.question}</p>
      <p>{reponse.texte}</p>
      {reponse.tableau && (
        <figure className="budget-tableau">
          {reponse.tableau.titre && <figcaption className="surtitre">{reponse.tableau.titre}</figcaption>}
          <div className="budget-tableau-defile">
            <table>
              <thead>
                <tr>
                  {reponse.tableau.colonnes.map((c, i) => (
                    <th key={i} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reponse.tableau.lignes.map((l, i) => (
                  <tr key={i}>
                    {l.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      )}
      {reponse.conseils.length > 0 && (
        <ol className="budget-conseils">
          {reponse.conseils.map((c, i) => (
            <li key={i}>
              <span className="budget-conseil-titre">
                {c.titre}
                {c.gainParMois !== null && <span className="budget-gain"> · {montant(c.gainParMois)} par mois</span>}
              </span>
              <span className="discret">{c.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Où chaque pot finira le mois, d'après le rythme des dépenses. */
export function FinDuMois(p: PropsPage & { plan: PlanBudget }) {
  const fins = finDuMois(p.plan, p.budget, p.aujourdhui);
  return (
    <ul className="carte groupe">
      {fins.map((f) => (
        <li key={f.pot} className="ligne">
          <span className={`budget-pastille pot-${f.pot}`} aria-hidden />
          <span className="ligne-texte">
            {nomDuPot(p.plan, f.pot)}
            <span className={`tache-details${f.soldeFin < 0 ? " retard" : ""}`}> · {phraseFinDuMois(f)}</span>
          </span>
          <span className={`budget-montant${f.soldeFin < 0 ? " negatif" : ""}`}>{montant(f.soldeFin)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Les mois passés, pot par pot : ce qui est sorti, et en dessous ce qui est passé au mois suivant. */
export function TableauDesMois(props: { plan: PlanBudget; mois: BilanDeMois[]; aujourdhui: string }) {
  if (!props.mois.length) return null;
  return (
    <figure className="carte budget-tableau">
      <div className="budget-tableau-defile">
        <table>
          <thead>
            <tr>
              <th scope="col">Dépensé</th>
              {props.mois.map((m) => (
                <th key={m.mois} scope="col">
                  {majuscule(nommerMois(m.mois)).slice(0, 4)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POTS_SUIVIS.map((pot) => (
              <tr key={pot}>
                <th scope="row">
                  <span className={`budget-pastille pot-${pot}`} aria-hidden /> {nomDuPot(props.plan, pot)}
                </th>
                {props.mois.map((m) => (
                  <td key={m.mois}>{formaterMontant(m.pots[pot].depense, false)}</td>
                ))}
              </tr>
            ))}
            <tr className="budget-tableau-total">
              <th scope="row">Reporté</th>
              {props.mois.map((m) => (
                <td key={m.mois}>{formaterMontant(POTS_SUIVIS.filter((x) => x !== "epargne").reduce((t, x) => t + m.pots[x].solde, 0), false)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <figcaption className="discret">En francs. « Reporté » : ce qui restait sur les pots courses, plaisir et factures à la fin du mois.</figcaption>
    </figure>
  );
}
