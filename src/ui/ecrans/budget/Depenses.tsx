import { useState } from "react";
import { depenses, moisBudget, nommerMois, type Depense, type PlanBudget, type Pot } from "../../../domaine/budget";
import { decaler, ecartJours } from "../../../domaine/taches";
import { useAnnoncer } from "../../annulation";
import { Glissable } from "../../Glissable";
import { Icone } from "../../Icone";
import type { PropsPage } from "../../modules";
import { Feuille } from "../../pieces";
import { FeuilleReleve } from "./Releve";
import { InvitationApplePay } from "./Paiements";
import { ChampMontant, leJour, majuscule, montant, nomDuPot, Puces } from "./communs";
import { Ligne, ListeVivante } from "../../moteur/pieces";
import { Montant } from "../../moteur/Chiffre";
import { csvDepenses } from "../../../domaine/exports";
import { partagerFichier } from "../../partage";
import { ignorer } from "../../journal";

// ----- Les dépenses -----

/** Les dépenses mois par mois, jour par jour, avec un filtre par pot ; toucher une dépense la corrige. */
export function Depenses(p: PropsPage & { plan: PlanBudget; filtre: Pot | null; filtrer: (pot: Pot | null) => void; ouvrirApplePay: () => void }) {
  const { plan, depot, aujourdhui } = p;
  const annoncer = useAnnoncer();
  const [mois, setMois] = useState(moisBudget(plan, aujourdhui));
  const [releve, setReleve] = useState(false);
  const [ouverte, setOuverte] = useState<Depense | null>(null);
  const toutes = depenses(p.budget);
  const premier = [plan.depart.mois, ...toutes.map((d) => moisBudget(plan, d.jour))].sort()[0];
  const duMois = toutes.filter((d) => moisBudget(plan, d.jour) === mois && (!p.filtre || d.pot === p.filtre));
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
          <span className="budget-solde"><Montant valeur={total} /></span>
        </p>
        <button type="button" className="bouton-icone" onClick={() => decaleMois(1)} disabled={mois >= moisBudget(plan, aujourdhui)} aria-label="Mois suivant">
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

      {duMois.length > 0 && (
        <button
          type="button"
          className="lien budget-export"
          onClick={() => {
            partagerFichier(`budget-${mois}${p.filtre ? `-${p.filtre}` : ""}.csv`, csvDepenses(duMois, p.foyer.membres), "text/csv").catch(ignorer);
          }}
        >
          <Icone nom="partage" taille={15} />
          Envoyer ce mois en tableur ({duMois.length} ligne{duMois.length > 1 ? "s" : ""}, s'ouvre dans Numbers ou Excel)
        </button>
      )}

      {jours.length ? (
        jours.map((jour) => (
          <section key={jour}>
            <h2 className="rayon">{nomDuJour(jour)}</h2>
            <ListeVivante className="carte groupe">
              {duMois
                .filter((d) => d.jour === jour)
                .map((d) => (
                  <Ligne key={d.id}>
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
                  </Ligne>
                ))}
            </ListeVivante>
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
