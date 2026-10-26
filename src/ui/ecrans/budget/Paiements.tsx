import { useState } from "react";
import { formaterMontant, lireMontant, nomDuMois, POTS, reglerFacture, type Etiquette, type PaiementAClasser, type PlanBudget, type Pot } from "../../../domaine/budget";
import { etiquetteProposee, etiquettesDuPlan } from "../../../domaine/etiquettes";
import { cartesDuFoyer, choixDeCarte, classerPaiement, demandeRaccourci, paiementsAClasser, POTS_DE_CARTE, retenirCarte, type ChoixCarte } from "../../../domaine/paiements";
import { FeuilleEtiquette } from "./Feuilles";
import { useAnnoncer } from "../../annulation";
import { contexteReel } from "../../contexte";
import { vibrer } from "../../haptique";
import type { PropsPage } from "../../modules";
import { Feuille } from "../../pieces";
import { CLES, ecrireTexte, effacer, lireTexte } from "../../stockageLocal";

// Les paiements Apple Pay dans le budget : ceux qui attendent leur pot, et la mise en route
// du raccourci sur chaque iPhone. Les règles sont dans src/domaine/paiements.ts.

/** L'adresse du raccourci de cet iPhone : elle reste sur ce téléphone, pour la recopier. */
function lienEnregistre(): string | null {
  return lireTexte(CLES.lienPaiements);
}

function garderLien(adresse: string | null) {
  // Navigation privée : le lien marche quand même, il faudra seulement le recréer pour le recopier.
  if (adresse) ecrireTexte(CLES.lienPaiements, adresse);
  else effacer(CLES.lienPaiements);
}

const nomDuPot = (plan: PlanBudget, pot: Pot) => plan.comptes[pot] || POTS[pot].nom;
const quand = (jour: string) => `${Number(jour.slice(8, 10))} ${nomDuMois(Number(jour.slice(5, 7)))}`;

/**
 * Les paiements à classer (0.0.78) : une carte sobre par paiement, et une rangée qui défile avec
 * vos catégories (la dernière choisie pour ce commerçant en tête), les pots, « Hors budget » et
 * « Nouvelle catégorie ». Un toucher classe ce paiement seul : pour qu'une carte se range seule,
 * on la règle dans Paiements Apple Pay.
 */
export function PaiementsAClasser(p: PropsPage & { plan: PlanBudget }) {
  const { plan, depot } = p;
  const annoncer = useAnnoncer();
  const [francs, setFrancs] = useState<Record<string, string>>({});
  const [nouvelle, setNouvelle] = useState<PaiementAClasser | null>(null);
  const liste = paiementsAClasser(p.budget);
  if (!liste.length) return null;

  const montantEnFrancs = (x: PaiementAClasser) => (x.devise === "CHF" ? x.montant : lireMontant(francs[x.id] ?? ""));

  async function horsBudget(paiement: PaiementAClasser) {
    const memeCarte = liste.filter((x) => x.carte === paiement.carte);
    const ancienPlan = plan;
    await depot.enregistrerBudget(retenirCarte(plan, paiement.carte, "aucun", contexteReel));
    for (const x of memeCarte) await depot.supprimerBudget(x.id);
    vibrer();
    annoncer(`Carte ${paiement.carte} : hors du budget.`, async () => {
      await depot.enregistrerBudget(ancienPlan);
      for (const x of memeCarte) await depot.enregistrerBudget(x);
    });
  }

  async function classer(paiement: PaiementAClasser, pot: Pot, etiquette?: Etiquette) {
    const montantChf = montantEnFrancs(paiement);
    if (montantChf === null) return;
    // Un paiement qui règle une facture attendue la marque payée (Kora 0.0.37).
    const d = reglerFacture(classerPaiement(paiement, pot, montantChf, contexteReel, etiquette), plan, p.budget);
    await depot.enregistrerBudget(d);
    vibrer();
    annoncer(`${formaterMontant(montantChf)} dans ${(etiquette?.nom ?? nomDuPot(plan, d.pot)).toLowerCase()}.`, () => depot.enregistrerBudget(paiement));
  }

  return (
    <section className="carte budget-a-classer">
      <p className="surtitre">{liste.length === 1 ? "Un paiement à classer" : `${liste.length} paiements à classer`}</p>
      <ul className="groupe">
        {liste.map((x) => {
          const connue = choixDeCarte(plan, x.carte);
          const etranger = x.devise !== "CHF";
          const pret = montantEnFrancs(x) !== null;
          const proposee = etiquetteProposee(plan, p.budget, x.marchand);
          const autres = etiquettesDuPlan(plan).filter((e) => e.id !== proposee?.id);
          return (
            <li key={x.id} className="budget-paiement">
              <div className="budget-paiement-tete">
                <span className="budget-paiement-nom">{x.marchand ?? "Paiement"}</span>
                <span className="budget-montant">{etranger ? `${formaterMontant(x.montant, false)} ${x.devise}` : formaterMontant(x.montant)}</span>
              </div>
              <span className="discret">
                {quand(x.jour)} · {x.carte}
              </span>
              {etranger && (
                <label className="budget-francs">
                  <span className="discret">Débité en francs</span>
                  <input className="budget-champ" inputMode="decimal" placeholder="0.00" value={francs[x.id] ?? ""} onChange={(e) => setFrancs({ ...francs, [x.id]: e.target.value })} />
                </label>
              )}
              <div className="puces budget-defile" role="group" aria-label={`Classer ${x.marchand ?? "ce paiement"}`}>
                {proposee && (
                  <button type="button" className="puce proposee" disabled={!pret} onClick={() => void classer(x, proposee.pot, proposee)}>
                    {proposee.nom}
                  </button>
                )}
                {autres.map((e) => (
                  <button type="button" key={e.id} className="puce" disabled={!pret} onClick={() => void classer(x, e.pot, e)}>
                    {e.nom}
                  </button>
                ))}
                {POTS_DE_CARTE.map((pot) => (
                  <button type="button" key={pot} className={`puce${connue === pot ? " active" : ""}`} disabled={!pret} onClick={() => void classer(x, pot)}>
                    {nomDuPot(plan, pot)}
                  </button>
                ))}
                {!etranger && (
                  <button type="button" className="puce" onClick={() => void horsBudget(x)}>
                    Hors budget
                  </button>
                )}
                <button type="button" className="puce nouvelle" disabled={!pret} onClick={() => setNouvelle(x)}>
                  + Catégorie
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="discret">Une catégorie à toi (« Essence », « Resto ») range le paiement dans son pot avec son nom. Pour qu'une carte se range seule, règle-la dans Paiements Apple Pay.</p>
      <FeuilleEtiquette
        plan={plan}
        ouverture={nouvelle ? { nouvelle: true, pot: ((c) => (c && c !== "aucun" ? c : "perso"))(choixDeCarte(plan, nouvelle.carte)) } : null}
        fermer={() => setNouvelle(null)}
        enregistrer={(nouveau) => depot.enregistrerBudget(nouveau)}
        creee={(e) => nouvelle && void classer(nouvelle, e.pot, e)}
      />
    </section>
  );
}

/** L'invitation, tant que cet iPhone n'envoie pas ses paiements. */
export function InvitationApplePay(props: { ouvrir: () => void }) {
  const [cachee, setCachee] = useState(() => !!lienEnregistre() || lireTexte(CLES.applePayVu) === "1");
  if (cachee) return null;
  return (
    <section className="carte budget-invitation">
      <p>Les paiements Apple Pay de vos cartes peuvent arriver seuls dans le budget, sans ticket ni saisie.</p>
      <div className="budget-actions">
        <button type="button" className="bouton-principal" onClick={props.ouvrir}>
          Mettre en route
        </button>
        <button
          type="button"
          className="bouton-secondaire"
          onClick={() => {
            // Sans stockage, rien à garder : elle reviendra.
            ecrireTexte(CLES.applePayVu, "1");
            setCachee(true);
          }}
        >
          Plus tard
        </button>
      </div>
    </section>
  );
}

/** Avec l'IA de Raccourcis (iOS 26) : la phrase copiée crée le raccourci et son déclencheur. */
const ETAPES = [
  "Dans Raccourcis, crée un nouveau raccourci et colle la demande copiée dans « Décrire un raccourci ».",
  "Vérifie le résultat : un bloc « Lorsque n'importe quelle carte est présentée », puis « Obtenir le contenu de » avec ton adresse. Touche › au bout de l'adresse : Méthode POST, Corps JSON, champs carte, montant, marchand.",
  "Touche › après « est présentée » et choisis de l'exécuter sans demander. Au premier paiement de chaque carte, Kora demande une fois son pot ; ensuite tout se range seul.",
];

/** Sans l'IA : le même raccourci, fait à la main. */
const A_LA_MAIN = [
  "Nouveau raccourci, action « Obtenir le contenu de l'URL », colle l'adresse (bouton Copier l'adresse).",
  "Dans les options : Méthode POST, Corps de la requête JSON.",
  "Trois champs Texte : montant, marchand, carte, avec les variables Montant, Commerçant et Carte de l'entrée du raccourci.",
  "Ajoute le déclencheur « Lorsque n'importe quelle carte est présentée » (Transaction), exécuté sans demander.",
];

/** La mise en route sur cet iPhone, et les cartes que Kora connaît. */
export function FeuilleApplePay(p: PropsPage & { plan: PlanBudget; ouverte: boolean; fermer: () => void }) {
  const { plan, depot } = p;
  const [adresse, setAdresse] = useState<string | null>(lienEnregistre);
  const [etat, setEtat] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const cartes = cartesDuFoyer(plan, p.budget);

  async function copier(texte: string, quoi = "Adresse copiée.") {
    try {
      await navigator.clipboard.writeText(texte);
      setEtat(quoi);
    } catch {
      setEtat("Copie impossible : touche longuement l'adresse pour la copier.");
    }
  }

  async function creer() {
    if (!p.jarvis) return;
    if (!p.membreId) {
      setEtat("Choisis d'abord à qui est cet iPhone (Réglages).");
      return;
    }
    setOccupe(true);
    setEtat(null);
    try {
      const nouvelle = await p.jarvis.serveur.lienPaiements({ foyerId: p.jarvis.foyerId, membreId: p.membreId! });
      garderLien(nouvelle);
      setAdresse(nouvelle);
      await copier(demandeRaccourci(nouvelle), "Demande copiée : colle-la dans Raccourcis.");
    } catch (e) {
      setEtat(e instanceof Error ? e.message : "Le lien n'a pas pu être créé.");
    } finally {
      setOccupe(false);
    }
  }

  async function retirer() {
    if (!p.jarvis || !p.membreId) return;
    setOccupe(true);
    try {
      await p.jarvis.serveur.retirerLienPaiements({ foyerId: p.jarvis.foyerId, membreId: p.membreId! });
      garderLien(null);
      setAdresse(null);
      setEtat("Lien retiré : cet iPhone n'envoie plus ses paiements. Supprime aussi l'automatisation dans Raccourcis.");
    } catch (e) {
      setEtat(e instanceof Error ? e.message : "Le lien n'a pas pu être retiré.");
    } finally {
      setOccupe(false);
    }
  }

  const changerCarte = (carte: string, choix: ChoixCarte | null) => void depot.enregistrerBudget(retenirCarte(plan, carte, choix, contexteReel));

  return (
    <Feuille ouverte={p.ouverte} onFermer={p.fermer} titre="Paiements Apple Pay">
      <div className="formulaire">
        <p className="discret">
          À chaque paiement avec une carte de Wallet, l'iPhone envoie à Kora le montant, le commerçant et le nom de la carte. Rien d'autre : ni numéro, ni solde, ni accès à la banque.
        </p>
        {!p.jarvis ? (
          <p className="discret">Il faut d'abord partager le foyer (Réglages) : les paiements passent par son serveur.</p>
        ) : adresse ? (
          <>
            <p className="surtitre">Cet iPhone est relié</p>
            <p className="budget-adresse">{adresse}</p>
            <div className="budget-actions">
              <button type="button" className="bouton-principal" onClick={() => void copier(demandeRaccourci(adresse), "Demande copiée : colle-la dans Raccourcis.")}>
                Copier la demande
              </button>
              <button type="button" className="bouton-secondaire" onClick={() => void copier(adresse)}>
                Copier l'adresse
              </button>
              <button type="button" className="bouton-secondaire" disabled={occupe} onClick={() => void retirer()}>
                Retirer le lien
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="bouton-principal" disabled={occupe} onClick={() => void creer()}>
            {occupe ? "Création…" : "Créer le lien de cet iPhone"}
          </button>
        )}
        {etat && <p className="discret">{etat}</p>}

        {p.jarvis && (
          <>
            <p className="surtitre">Dans Raccourcis, une seule fois</p>
            <ol className="budget-etapes">
              {ETAPES.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ol>
            <details className="budget-a-la-main">
              <summary>Sans l'IA de Raccourcis</summary>
              <ol className="budget-etapes">
                {A_LA_MAIN.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ol>
            </details>
            <p className="discret">À faire sur chaque iPhone qui paie avec les cartes du foyer, chacun avec son propre lien. Les paiements par numéro de carte (en ligne) n'y passent pas : dis-les à ta fée.</p>
          </>
        )}

        {cartes.length > 0 && (
          <>
            <p className="surtitre">Les cartes</p>
            {cartes.map((c) => (
              <div key={c.carte} className="budget-choix">
                <span className="discret">
                  {c.carte}
                  {c.dernier ? ` · dernier paiement le ${quand(c.dernier)}` : ""}
                </span>
                <div className="puces" role="group" aria-label={`Pot de la carte ${c.carte}`}>
                  {POTS_DE_CARTE.map((pot) => (
                    <button type="button" key={pot} className={`puce${c.choix === pot ? " active" : ""}`} aria-pressed={c.choix === pot} onClick={() => changerCarte(c.carte, pot)}>
                      {nomDuPot(plan, pot)}
                    </button>
                  ))}
                  <button type="button" className={`puce${c.choix === "aucun" ? " active" : ""}`} aria-pressed={c.choix === "aucun"} onClick={() => changerCarte(c.carte, "aucun")}>
                    Hors budget
                  </button>
                  <button type="button" className="puce" onClick={() => changerCarte(c.carte, null)}>
                    Oublier
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Feuille>
  );
}
