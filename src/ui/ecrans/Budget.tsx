import { useState } from "react";
import {
  avanceeProjet,
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
  moisAConfirmer,
  moisDe,
  nomDuMois,
  nommerMois,
  nouveauPlan,
  nouveauPoste,
  nouvelleDepense,
  parMois,
  payerFacture,
  planDe,
  POTS,
  POTS_SUIVIS,
  retirerPoste,
  sansDate,
  type Depense,
  type Facture,
  type PlanBudget,
  type Pot,
  type Poste,
} from "../../domaine/budget";
import type { Foyer, Id } from "../../domaine/types";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import type { PropsPage } from "../modules";
import { Feuille, Onglets, Page, PointEtat, useGestionnaireBarre } from "../pieces";

type Onglet = "mois" | "charges" | "epargne";

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
  const plan = planDe(p.budget);

  useGestionnaireBarre("module:budget", async (texte) => {
    if (!plan) return false;
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
      : nouvelleDepense({ ...saisie, jour: aujourdhui }, p.membreId, contexteReel);
    await depot.enregistrerBudget(depense);
    vibrer();
    annoncer(`${montant(depense.montant)} : ${depense.libelle}, ${POTS[depense.pot].nom.toLowerCase()}.`, () => depot.supprimerBudget(depense.id));
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
    onglet === "charges"
      ? "Écris une charge dans la barre : « Netflix 20 », « Assurance maison 118 par an ». Touche une ligne pour la régler."
      : "Écris une dépense dans la barre : « Migros 84.30 », « 32 cinéma ». Le ticket de caisse photographié par Jarvis compte aussi dans les courses.";

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
          { id: "mois", libelle: "Ce mois", compte: facturesAPayer(plan, p.budget, aujourdhui, 7).length },
          { id: "charges", libelle: "Charges" },
          { id: "epargne", libelle: "Épargne" },
        ]}
      />

      {onglet === "mois" && <CeMois {...p} plan={plan} voirCharges={() => setOnglet("charges")} />}
      {onglet === "charges" && <Charges {...p} plan={plan} ouvrirPoste={setPoste} ouvrirPersonne={setPersonne} />}
      {onglet === "epargne" && <Epargne {...p} plan={plan} reglerProjet={() => setProjet(true)} />}

      <FeuillePoste plan={plan} poste={poste} foyer={foyer} fermer={() => setPoste(null)} enregistrer={enregistrer} />
      <FeuillePersonne plan={plan} membreId={personne} foyer={foyer} fermer={() => setPersonne(null)} enregistrer={enregistrer} />
      <FeuilleProjet plan={plan} ouverte={projet} fermer={() => setProjet(false)} enregistrer={enregistrer} />
      <FeuilleReglages plan={plan} ouverte={reglages} fermer={() => setReglages(false)} enregistrer={enregistrer} />
    </Page>
  );
}

// ----- Ce mois -----

function CeMois(p: PropsPage & { plan: PlanBudget; voirCharges: () => void }) {
  const { plan, depot, aujourdhui } = p;
  const annoncer = useAnnoncer();
  const bilan = bilanDuMois(plan);
  const pots = etatDesPots(plan, p.budget, aujourdhui);
  const aConfirmer = moisAConfirmer(plan, p.budget, aujourdhui);
  const [epargne, setEpargne] = useState<number | null>(null);
  const aPayer = facturesAPayer(plan, p.budget, aujourdhui, 45);
  const datesManquantes = sansDate(plan);
  const duMois = depenses(p.budget).filter((d) => moisDe(d.jour) === moisDe(aujourdhui));
  const avancee = avanceeProjet(plan, p.budget, aujourdhui);

  async function confirmer(mois: string) {
    const doc = confirmerMois(mois, { ...bilan.versements, epargne: epargne ?? bilan.versements.epargne }, p.membreId, contexteReel);
    await depot.enregistrerBudget(doc);
    vibrer();
    annoncer(`Versements de ${nommerMois(mois)} notés.`, () => depot.supprimerBudget(doc.id));
  }

  async function payer(f: Facture) {
    const d = payerFacture(f, aujourdhui, p.membreId, contexteReel);
    await depot.enregistrerBudget(d);
    vibrer();
    annoncer(`${f.poste.libelle} payée.`, () => depot.supprimerBudget(d.id));
  }

  async function retirer(d: Depense) {
    await depot.supprimerBudget(d.id);
    annoncer(`${d.libelle} retirée.`, () => depot.enregistrerBudget(d));
  }

  const detail: Record<Pot, string> = {
    commun: "",
    courses: `${montant(pots.courses.depenseDuMois)} dépensés sur ${montant(pots.courses.budgetDuMois)} ce mois`,
    plaisir: `${montant(pots.plaisir.budgetDuMois)} versés ce mois`,
    factures: aPayer[0] ? `Prochaine : ${aPayer[0].poste.libelle}, ${decrireEcheanceFacture(aPayer[0].echeance, aujourdhui)}` : "Rien à payer ces prochaines semaines",
    epargne: avancee ? `${Math.round(avancee.part * 100)} % de « ${avancee.projet.nom} »` : `${montant(pots.epargne.budgetDuMois)} prévus ce mois`,
  };

  return (
    <>
      {aConfirmer && (
        <section className="carte budget-versement">
          <p className="surtitre">{nommerMois(aConfirmer, aujourdhui)} : les versements du mois</p>
          <ul className="groupe">
            {POTS_SUIVIS.map((pot) => (
              <li key={pot} className="ligne">
                <span className="ligne-texte">{plan.comptes[pot] || POTS[pot].nom}</span>
                {pot === "epargne" ? (
                  <ChampMontant valeur={epargne ?? bilan.versements.epargne} changer={setEpargne} libelle="Versé à l'épargne" />
                ) : (
                  <span className="budget-montant">{montant(bilan.versements[pot])}</span>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="bouton-principal" onClick={() => void confirmer(aConfirmer)}>C'est versé</button>
          <p className="discret">Change l'épargne si vous avez versé un autre montant. Ce qui reste dans chaque pot passe au mois suivant.</p>
        </section>
      )}

      <div className="budget-pots">
        {POTS_SUIVIS.map((pot) => {
          const e = pots[pot];
          const jauge = pot === "courses" && e.budgetDuMois > 0 ? Math.min(1, e.depenseDuMois / e.budgetDuMois) : null;
          return (
            <section key={pot} className={`carte budget-pot${e.solde < 0 ? " negatif" : ""}`}>
              <p className="surtitre">{plan.comptes[pot] || POTS[pot].nom}</p>
              <p className="budget-solde">{montant(e.solde)}</p>
              {jauge !== null && (
                <span className="widget-jauge" aria-hidden>
                  <span style={{ width: `${Math.round(jauge * 100)}%` }} />
                </span>
              )}
              <p className="discret">{detail[pot]}</p>
            </section>
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
      {datesManquantes.length > 0 && (
        <button type="button" className="carte budget-rappel" onClick={p.voirCharges}>
          <PointEtat etat="jour" />
          <span>
            {datesManquantes.length === 1 ? "Une facture de l'année n'a pas de mois" : `${datesManquantes.length} factures de l'année n'ont pas de mois`} :{" "}
            {datesManquantes.map((x) => x.libelle).join(", ")}. Donne le mois pour que Kora prévienne avant.
          </span>
        </button>
      )}

      <h2 className="rayon">Dépenses du mois</h2>
      {duMois.length ? (
        <ul className="carte groupe">
          {duMois.map((d) => (
            <li key={d.id}>
              <Glissable onSupprimer={() => void retirer(d)} libelle="Retirer">
                <div className="ligne">
                  <span className="ligne-texte">
                    {d.libelle}
                    <span className="tache-details">
                      {" "}
                      · {POTS[d.pot].nom} · {Number(d.jour.slice(8, 10))} {nomDuMois(Number(d.jour.slice(5, 7)))}
                      {d.source === "ticket" ? " · ticket" : ""}
                    </span>
                  </span>
                  <span className="budget-montant">{montant(d.montant)}</span>
                </div>
              </Glissable>
            </li>
          ))}
        </ul>
      ) : (
        <p className="discret budget-note">Rien de noté ce mois. Photographie un ticket depuis la barre, ou écris « Migros 84.30 ».</p>
      )}
    </>
  );
}

// ----- Les charges -----

function Charges(p: PropsPage & { plan: PlanBudget; ouvrirPoste: (x: Poste) => void; ouvrirPersonne: (id: Id) => void }) {
  const { plan, foyer } = p;
  const bilan = bilanDuMois(plan);
  const communes = plan.postes.filter((x) => x.qui === null);
  const abonnements = plan.postes.filter((x) => x.categorie === "abonnement");
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
      {bilan.personnes.map((b) => {
        const siennes = plan.postes.filter((x) => x.qui === b.membreId);
        return (
          <section key={b.membreId}>
            <h2 className="rayon">{prenomDe(foyer, b.membreId)}</h2>
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

      {abonnements.length > 0 && (
        <p className="discret budget-note">
          Abonnements : {montant(abonnements.reduce((t, x) => t + parMois(x), 0))} par mois, soit {montant(abonnements.reduce((t, x) => t + parMois(x) * 12, 0))} par an.
        </p>
      )}
    </>
  );
}

// ----- L'épargne -----

function Epargne(p: PropsPage & { plan: PlanBudget; reglerProjet: () => void }) {
  const { plan, aujourdhui } = p;
  const a = avanceeProjet(plan, p.budget, aujourdhui);
  const pots = etatDesPots(plan, p.budget, aujourdhui);
  const historique = historiqueEpargne(plan, p.budget).slice(-12).reverse();
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

function FeuilleReglages(props: { plan: PlanBudget; ouverte: boolean; fermer: () => void; enregistrer: (p: PlanBudget) => Promise<void> }) {
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
