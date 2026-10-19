import { useState } from "react";
import { formaterMontant, nomDuMois, POTS, type DocBudget, type PlanBudget, type Pot } from "../../domaine/budget";
import { POTS_DE_CARTE } from "../../domaine/paiements";
import { aCocher, importerReleve, lireReleve, preparerReleve, type LigneReleve } from "../../domaine/releve";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { vibrer } from "../haptique";
import type { Depot } from "../../donnees/depot";
import type { Id } from "../../domaine/types";
import { Feuille } from "../pieces";

// L'import du relevé Revolut (CSV) : ce qu'Apple Pay n'a pas vu. Règles dans src/domaine/releve.ts.

const quand = (jour: string) => `${Number(jour.slice(8, 10))} ${nomDuMois(Number(jour.slice(5, 7)))}`;

export function FeuilleReleve(props: { plan: PlanBudget; budget: DocBudget[]; depot: Depot; membreId: Id | null; ouverte: boolean; fermer: () => void }) {
  const { plan } = props;
  const annoncer = useAnnoncer();
  const [lignes, setLignes] = useState<LigneReleve[] | null>(null);
  const [cochees, setCochees] = useState<boolean[]>([]);
  const [deja, setDeja] = useState(0);
  const [pot, setPot] = useState<Pot>("courses");
  const [erreur, setErreur] = useState<string | null>(null);

  function fermer() {
    setLignes(null);
    setErreur(null);
    props.fermer();
  }

  async function lire(fichier: File | undefined) {
    if (!fichier) return;
    setErreur(null);
    const lu = lireReleve(await fichier.text());
    if (!lu) {
      setLignes(null);
      setErreur("Ce fichier n'est pas un relevé Revolut. Dans Revolut, choisis le format CSV (ou Excel, puis « Exporter en CSV »).");
      return;
    }
    const { nouvelles, deja: notees } = preparerReleve(lu, props.budget);
    setLignes(nouvelles);
    setCochees(nouvelles.map(aCocher));
    setDeja(notees.length);
  }

  async function importer() {
    if (!lignes) return;
    const choisies = lignes.filter((_, i) => cochees[i]);
    const ajouts = importerReleve(choisies, pot, props.membreId, contexteReel);
    for (const d of ajouts) await props.depot.enregistrerBudget(d);
    vibrer();
    annoncer(`${ajouts.length} dépense${ajouts.length > 1 ? "s" : ""} ajoutée${ajouts.length > 1 ? "s" : ""} (${(plan.comptes[pot] || POTS[pot].nom).toLowerCase()}).`, async () => {
      for (const d of ajouts) await props.depot.supprimerBudget(d.id);
    });
    fermer();
  }

  const nombre = cochees.filter(Boolean).length;
  const total = (lignes ?? []).reduce((t, l, i) => (cochees[i] ? t + l.montant : t), 0);

  return (
    <Feuille ouverte={props.ouverte} onFermer={fermer} titre="Relevé Revolut">
      <div className="formulaire">
        <p className="discret">
          Pour ce qu'Apple Pay n'a pas vu : achats en ligne, carte en plastique, prélèvements. Dans Revolut, ouvre le compte de la carte › Relevé › format CSV, le mois voulu, puis choisis le fichier ici. Kora ne garde ni numéro ni solde.
        </p>
        <label className="bouton-secondaire budget-fichier">
          {lignes ? "Choisir un autre relevé" : "Choisir le relevé"}
          <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => void lire(e.target.files?.[0])} />
        </label>
        {erreur && <p className="discret">{erreur}</p>}

        {lignes && (
          <>
            <div className="budget-choix">
              <span className="discret">Ce relevé, c'est la carte</span>
              <div className="puces" role="group" aria-label="Pot de ce relevé">
                {POTS_DE_CARTE.map((x) => (
                  <button type="button" key={x} className={`puce${pot === x ? " active" : ""}`} aria-pressed={pot === x} onClick={() => setPot(x)}>
                    {plan.comptes[x] || POTS[x].nom}
                  </button>
                ))}
              </div>
            </div>
            <p className="surtitre">
              {lignes.length ? `${lignes.length} sortie${lignes.length > 1 ? "s" : ""} pas encore notée${lignes.length > 1 ? "s" : ""}` : "Tout est déjà noté"}
              {deja ? ` · ${deja} déjà dans Kora` : ""}
            </p>
            {lignes.length > 0 && (
              <ul className="carte groupe budget-releve">
                {lignes.map((l, i) => (
                  <li key={`${l.jour}-${i}`}>
                    <button
                      type="button"
                      className={`ligne proposee${cochees[i] ? " retenue" : ""}`}
                      aria-pressed={cochees[i]}
                      onClick={() => setCochees(cochees.map((c, j) => (j === i ? !c : c)))}
                    >
                      <span className="case" aria-hidden>
                        {cochees[i] ? "✓" : ""}
                      </span>
                      <span className="ligne-texte">
                        {l.libelle}
                        <span className="tache-details">
                          {" "}
                          · {quand(l.jour)}
                          {l.mouvement ? " · virement" : ""}
                        </span>
                      </span>
                      <span className="budget-montant">{l.devise === "CHF" ? formaterMontant(l.montant) : `${formaterMontant(l.montant, false)} ${l.devise}`}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {nombre > 0 && (
              <button type="button" className="bouton-principal" onClick={() => void importer()}>
                Ajouter {nombre} dépense{nombre > 1 ? "s" : ""} · {formaterMontant(total)}
              </button>
            )}
            <p className="discret">Les virements, recharges et autres monnaies sont décochés : touche une ligne pour la changer.</p>
          </>
        )}
      </div>
    </Feuille>
  );
}
