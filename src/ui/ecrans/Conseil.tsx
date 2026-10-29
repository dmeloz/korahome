import { useState } from "react";
import {
  appliquerActions,
  decrireAction,
  decrireFoyer,
  formaterChf,
  lireActions,
  type ActionJarvis,
  type Modification,
} from "../../domaine/jarvis";
import type { Depot } from "../../donnees/depot";
import type { ServeurJarvis } from "../../donnees/distant";
import { contexteReel } from "../contexte";
import { annulerModifications, enregistrerModifications } from "../jarvis";
import type { DonneesModule } from "../modules";
import { vibrer } from "../haptique";
import { nomFee } from "../fee";
import { Page } from "../pieces";

interface Proposition {
  resume: string;
  actions: ActionJarvis[];
  retenues: boolean[];
}

// La proposition reste le temps que l'app est ouverte : on peut aller voir le frigo et revenir.
let derniere: Proposition | null = null;
/** La proposition reste en mémoire d'une ouverture de la page à l'autre. */
function retenir(p: Proposition | null) {
  derniere = p;
}

/** Le conseil du dimanche : Jarvis prépare la semaine, le foyer coche ce qu'il garde et valide ensemble. */
export function Conseil(props: { donnees: DonneesModule; depot: Depot; serveur: ServeurJarvis; foyerPartage: string }) {
  const { donnees, depot, serveur, foyerPartage } = props;
  const [proposition, setProposition] = useState<Proposition | null>(derniere);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [alerte, setAlerte] = useState<string | null>(null);
  const [validee, setValidee] = useState<{ modifications: Modification[]; echecs: string[]; annulee: boolean } | null>(null);

  const garder = (p: Proposition | null) => {
    retenir(p);
    setProposition(p);
  };

  async function preparer() {
    setEnCours(true);
    setErreur(null);
    setValidee(null);
    try {
      const reponse = await serveur.demanderJarvis({
        foyerId: foyerPartage,
        mode: "conseil",
        demande: "Prépare notre semaine.",
        etat: decrireFoyer(donnees, donnees.membreId, donnees.aujourdhui),
        historique: [],
      });
      const actions = lireActions(reponse.appels);
      garder({ resume: reponse.texte, actions, retenues: actions.map(() => true) });
      setAlerte(reponse.budget.alerte ? `${nomFee()} a utilisé ${formaterChf(reponse.budget.depenseChf)} sur ${formaterChf(reponse.budget.plafondChf)} ce mois-ci.` : null);
    } catch (e) {
      setErreur(e instanceof Error && e.message ? e.message : `${nomFee()} n'a pas pu préparer la semaine, réessaie.`);
    } finally {
      setEnCours(false);
    }
  }

  function basculer(i: number) {
    if (!proposition) return;
    vibrer();
    garder({ ...proposition, retenues: proposition.retenues.map((r, j) => (j === i ? !r : r)) });
  }

  async function valider() {
    if (!proposition) return;
    const choisies = proposition.actions.filter((_, i) => proposition.retenues[i]);
    const resultat = appliquerActions(choisies, donnees, donnees.membreId, donnees.aujourdhui, contexteReel);
    await enregistrerModifications(depot, resultat.modifications);
    vibrer();
    setValidee({ modifications: resultat.modifications, echecs: resultat.echecs, annulee: false });
    garder(null);
  }

  async function annuler() {
    if (!validee || validee.annulee) return;
    await annulerModifications(depot, validee.modifications);
    setValidee({ ...validee, annulee: true });
  }

  const nombre = proposition?.retenues.filter(Boolean).length ?? 0;

  return (
    <Page titre="Conseil de la semaine" className="conseil avec-cadre">

      {validee && (
        <div className="carte conseil-valide" role="status">
          <p>{validee.annulee
              ? "La semaine est revenue comme avant."
              : validee.modifications.length
                ? "C'est validé, la semaine est prête."
                : "Rien n'a pu être appliqué."}</p>
          {validee.echecs.map((e) => <p key={e} className="discret">{e}</p>)}
          {!validee.annulee && validee.modifications.length > 0 && (
            <button className="lien" onClick={() => void annuler()}>Annuler</button>
          )}
        </div>
      )}

      {!proposition && !enCours && (
        <div className="carte conseil-depart">
          <p>Asseyez-vous ensemble : {nomFee()} propose qui fait quoi cette semaine, cinq repas qui finissent d'abord ce qui arrive à sa date, et les courses qui vont avec.</p>
          <p className="discret">Vous cochez ce que vous gardez, puis vous validez. Quelques centimes du budget de {nomFee()}.</p>
          <button className="bouton-principal" onClick={() => void preparer()}>Préparer la semaine</button>
        </div>
      )}

      {enCours && (
        <div className="carte conseil-depart" aria-live="polite">
          <p>{nomFee()} prépare votre semaine…</p>
          <div className="bulle jarvis attente" aria-hidden><span /><span /><span /></div>
        </div>
      )}
      {erreur && <p className="erreur" role="status">{erreur}</p>}

      {proposition && (
        <>
          {proposition.resume && (
            <div className="carte conseil-resume">
              <p>{proposition.resume}</p>
            </div>
          )}
          {proposition.actions.length > 0 ? (
            <section>
              <h2 className="rayon">À valider ensemble</h2>
              <ul className="carte groupe">
                {proposition.actions.map((a, i) => (
                  <li key={i}>
                    <button className={`ligne proposee${proposition.retenues[i] ? " retenue" : ""}`} onClick={() => basculer(i)} aria-pressed={proposition.retenues[i]}>
                      <span className="case" aria-hidden>{proposition.retenues[i] ? "✓" : ""}</span>
                      <span className="ligne-texte">{decrireAction(a)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="discret">{nomFee()} ne propose rien à changer cette semaine.</p>
          )}
          <div className="conseil-boutons">
            {proposition.actions.length > 0 && (
              <button className="bouton-principal" disabled={nombre === 0} onClick={() => void valider()}>
                Valider ensemble ({nombre})
              </button>
            )}
            <button className="lien" onClick={() => void preparer()}>Demander une autre proposition</button>
          </div>
        </>
      )}
      {alerte && <p className="discret jarvis-alerte">{alerte}</p>}
    </Page>
  );
}
