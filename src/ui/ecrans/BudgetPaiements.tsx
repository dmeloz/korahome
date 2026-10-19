import { useState } from "react";
import { formaterMontant, lireMontant, nomDuMois, POTS, reglerFacture, type Depense, type PaiementAClasser, type PlanBudget, type Pot } from "../../domaine/budget";
import { cartesDuFoyer, choixDeCarte, classerPaiement, demandeRaccourci, paiementsAClasser, POTS_DE_CARTE, retenirCarte, type ChoixCarte } from "../../domaine/paiements";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { vibrer } from "../haptique";
import type { PropsPage } from "../modules";
import { Feuille } from "../pieces";

// Les paiements Apple Pay dans le budget : ceux qui attendent leur pot, et la mise en route
// du raccourci sur chaque iPhone. Les règles sont dans src/domaine/paiements.ts.

/** L'adresse du raccourci de cet iPhone : elle reste sur ce téléphone, pour la recopier. */
const CLE_LIEN = "korahome.lienPaiements";

function lienEnregistre(): string | null {
  try {
    return localStorage.getItem(CLE_LIEN);
  } catch {
    return null;
  }
}

function garderLien(adresse: string | null) {
  try {
    if (adresse) localStorage.setItem(CLE_LIEN, adresse);
    else localStorage.removeItem(CLE_LIEN);
  } catch {
    // Navigation privée : le lien marche quand même, il faudra seulement le recréer pour le recopier.
  }
}

const nomDuPot = (plan: PlanBudget, pot: Pot) => plan.comptes[pot] || POTS[pot].nom;
const quand = (jour: string) => `${Number(jour.slice(8, 10))} ${nomDuMois(Number(jour.slice(5, 7)))}`;

/** Les paiements à classer : un toucher sur le pot, et Kora retient la carte pour la suite. */
export function PaiementsAClasser(p: PropsPage & { plan: PlanBudget }) {
  const { plan, depot } = p;
  const annoncer = useAnnoncer();
  const [francs, setFrancs] = useState<Record<string, string>>({});
  const liste = paiementsAClasser(p.budget);
  if (!liste.length) return null;

  async function classer(paiement: PaiementAClasser, choix: ChoixCarte) {
    const memeCarte = liste.filter((x) => x.carte === paiement.carte && x.devise === "CHF");
    const autres = paiement.devise === "CHF" ? memeCarte : [paiement];
    const ancienPlan = plan;
    if (paiement.devise === "CHF" || !choixDeCarte(plan, paiement.carte)) await depot.enregistrerBudget(retenirCarte(plan, paiement.carte, choix, contexteReel));
    if (choix === "aucun") {
      for (const x of autres) await depot.supprimerBudget(x.id);
      vibrer();
      annoncer(`Carte ${paiement.carte} : hors du budget.`, async () => {
        await depot.enregistrerBudget(ancienPlan);
        for (const x of autres) await depot.enregistrerBudget(x);
      });
      return;
    }
    const montantChf = paiement.devise === "CHF" ? paiement.montant : lireMontant(francs[paiement.id] ?? "");
    if (montantChf === null) return;
    // Un paiement qui règle une facture attendue la marque payée (Kora 0.0.36).
    const classes: Depense[] = [];
    for (const x of paiement.devise === "CHF" ? autres : [paiement]) {
      classes.push(reglerFacture(classerPaiement(x, choix, x.id === paiement.id ? montantChf : x.montant, contexteReel), plan, [...p.budget, ...classes]));
    }
    for (const d of classes) await depot.enregistrerBudget(d);
    vibrer();
    annoncer(classes.length > 1 ? `${classes.length} paiements dans ${nomDuPot(plan, choix).toLowerCase()}.` : `${formaterMontant(montantChf)} dans ${nomDuPot(plan, choix).toLowerCase()}.`, async () => {
      await depot.enregistrerBudget(ancienPlan);
      for (const x of paiement.devise === "CHF" ? autres : [paiement]) await depot.enregistrerBudget(x);
    });
  }

  return (
    <section className="carte budget-a-classer">
      <p className="surtitre">{liste.length === 1 ? "Un paiement à classer" : `${liste.length} paiements à classer`}</p>
      <ul className="groupe">
        {liste.map((x) => {
          const connue = choixDeCarte(plan, x.carte);
          const etranger = x.devise !== "CHF";
          return (
            <li key={x.id} className="budget-paiement">
              <div className="ligne">
                <span className="ligne-texte">
                  {x.marchand ?? "Paiement"}
                  <span className="tache-details">
                    {" "}
                    · {x.carte} · {quand(x.jour)}
                  </span>
                </span>
                <span className="budget-montant">{etranger ? `${formaterMontant(x.montant, false)} ${x.devise}` : formaterMontant(x.montant)}</span>
              </div>
              {etranger && (
                <label className="budget-francs">
                  <span className="discret">Débité en francs</span>
                  <input className="budget-champ" inputMode="decimal" placeholder="0.00" value={francs[x.id] ?? ""} onChange={(e) => setFrancs({ ...francs, [x.id]: e.target.value })} />
                </label>
              )}
              <div className="puces" role="group" aria-label={`Pot de ${x.marchand ?? "ce paiement"}`}>
                {POTS_DE_CARTE.map((pot) => (
                  <button
                    type="button"
                    key={pot}
                    className={`puce${connue === pot ? " active" : ""}`}
                    disabled={etranger && lireMontant(francs[x.id] ?? "") === null}
                    onClick={() => void classer(x, pot)}
                  >
                    {nomDuPot(plan, pot)}
                  </button>
                ))}
                {!etranger && (
                  <button type="button" className="puce" onClick={() => void classer(x, "aucun")}>
                    Hors budget
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="discret">Kora retient le pot de chaque carte : ses prochains paiements se rangent seuls.</p>
    </section>
  );
}

/** L'invitation, tant que cet iPhone n'envoie pas ses paiements. */
export function InvitationApplePay(props: { ouvrir: () => void }) {
  const [cachee, setCachee] = useState(() => {
    try {
      return !!lienEnregistre() || localStorage.getItem("korahome.applePayVu") === "1";
    } catch {
      return false;
    }
  });
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
            try {
              localStorage.setItem("korahome.applePayVu", "1");
            } catch {
              // Rien à garder : elle reviendra.
            }
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
            <p className="discret">À faire sur chaque iPhone qui paie avec les cartes du foyer, chacun avec son propre lien. Les paiements par numéro de carte (en ligne) n'y passent pas : écris-les dans la barre.</p>
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
