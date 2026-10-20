import {
  CATEGORIES_POSTE,
  bilanDuMois,
  enregistrerPoste,
  formaterMontant,
  modifierPlan,
  nomDuMois,
  debutMoisBudget,
  nommerMois,
  POTS,
  POTS_SUIVIS,
  retirerPoste,
  type PlanBudget,
  type Pot,
  type Poste,
} from "../../../domaine/budget";
import type { Foyer, Id } from "../../../domaine/types";
import { useAnnoncer } from "../../annulation";
import { contexteReel } from "../../contexte";
import { Feuille } from "../../pieces";
import { ChampMontant, prenomDe, Puces } from "./communs";

// ----- Les feuilles -----

export function FeuillePoste(props: { plan: PlanBudget; poste: Poste | null; foyer: Foyer; fermer: () => void; enregistrer: (p: PlanBudget) => Promise<void> }) {
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

export function FeuillePersonne(props: { plan: PlanBudget; membreId: Id | null; foyer: Foyer; fermer: () => void; enregistrer: (p: PlanBudget) => Promise<void> }) {
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

export function FeuilleProjet(props: { plan: PlanBudget; ouverte: boolean; fermer: () => void; enregistrer: (p: PlanBudget) => Promise<void> }) {
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

export function FeuilleReglages(props: { plan: PlanBudget; ouverte: boolean; fermer: () => void; enregistrer: (p: PlanBudget) => Promise<void>; ouvrirApplePay: () => void }) {
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
        <p className="discret">Le mois s'ouvre ce jour-là et porte le nom du mois que cet argent paie : avec la paie le 25, du 25 octobre au 24 novembre, c'est novembre. Kora propose alors de noter les versements dans chaque pot.</p>
        <p className="surtitre">Le reste du commun</p>
        <Puces
          libelle="Part du plaisir"
          valeur={Math.round(plan.partPlaisir * 100)}
          changer={(v) => changer({ partPlaisir: v / 100 })}
          choix={[20, 30, 40, 50].map((v) => ({ v, libelle: `${v} % plaisir` }))}
        />
        <p className="surtitre">
          Soldes au début de {nommerMois(plan.depart.mois)}
          {plan.jourDePaie && plan.jourDePaie > 1 ? ` (le ${Number(debutMoisBudget(plan, plan.depart.mois).slice(8, 10))} ${nomDuMois(Number(debutMoisBudget(plan, plan.depart.mois).slice(5, 7)))})` : ""}
        </p>
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
