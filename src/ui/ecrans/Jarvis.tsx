import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  aConfirmer,
  appliquerActions,
  decrireFoyer,
  formaterChf,
  lireActions,
  questionPour,
  TOURS_RETENUS,
  type ActionJarvis,
  type Modification,
  type TourJarvis,
} from "../../domaine/jarvis";
import type { Depot } from "../../donnees/depot";
import type { DemandeJarvis, ServeurJarvis } from "../../donnees/distant";
import { contexteReel } from "../contexte";
import { Icone } from "../Icone";
import { annulerModifications, direAVoixHaute, ecouter, enregistrerModifications, photoPourJarvis, voixDisponible } from "../jarvis";
import type { DonneesModule } from "../modules";
import { vibrer } from "../haptique";
import { nomFee } from "../fee";

interface Echange extends TourJarvis {
  n: number;
  /** Ce que Jarvis a changé : « Annuler » le défait. */
  modifications?: Modification[];
  annule?: boolean;
  erreur?: boolean;
  /** La photo envoyée, en aperçu. */
  photo?: string;
  /** Une action qui attend le oui de la personne : supprimer, ou retenir ce que Jarvis a remarqué. */
  confirmation?: { action: ActionJarvis; oui: string; reponse?: "oui" | "non" };
}

// La conversation reste le temps que l'app est ouverte, même en passant d'une page à l'autre.
let conversation: Echange[] = [];
let compteur = 0;

// Une phrase écrite dans la barre Jarvis d'une autre page : elle part dès l'ouverture.
let demandeEnAttente: string | null = null;
export const preparerDemande = (demande: string) => {
  demandeEnAttente = demande;
};

const EXEMPLES = ["Ajoute du lait et des œufs", "La litière est faite", "Retiens que Sarah n'aime pas la coriandre", "Qu'est-ce qui périme bientôt ?"];

export function Jarvis(props: {
  donnees: DonneesModule;
  depot: Depot;
  serveur: ServeurJarvis | null;
  /** Le foyer, s'il est partagé : Jarvis passe par son serveur. */
  foyerPartage: string | null;
  ouvrirPartage: () => void;
  ouvrirConseil: () => void;
  ouvrirMemoire: () => void;
}) {
  const { donnees, depot, serveur, foyerPartage } = props;
  const [echanges, setEchanges] = useState<Echange[]>(conversation);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [ecoute, setEcoute] = useState<(() => void) | null>(null);
  const [alerte, setAlerte] = useState<string | null>(null);
  const bas = useRef<HTMLDivElement>(null);
  const choixPhoto = useRef<HTMLInputElement>(null);
  const voix = voixDisponible();
  const avecVersion = { ...donnees, version: __VERSION__ };

  useEffect(() => {
    conversation = echanges;
    bas.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [echanges]);
  // En quittant la page, le micro se coupe.
  const arretEcoute = useRef<(() => void) | null>(null);
  arretEcoute.current = ecoute;
  useEffect(() => () => arretEcoute.current?.(), []);
  // La demande venue de la barre Jarvis : envoyée une fois, à l'arrivée sur la page.
  useEffect(() => {
    const demande = demandeEnAttente;
    demandeEnAttente = null;
    if (demande) void demander(demande, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ajouter = (e: Omit<Echange, "n">) => setEchanges((avant) => [...avant, { ...e, n: ++compteur }]);

  async function demander(demande: string, parVoix: boolean, image?: DemandeJarvis["image"]) {
    const texte = demande.trim() || (image ? "Regarde cette photo et note ce qu'il faut." : "");
    if (!texte || enCours || !serveur || !foyerPartage) return;
    const historique = conversation.slice(-TOURS_RETENUS).map(({ role, texte }) => ({ role, texte }));
    ajouter({ role: "personne", texte: demande.trim() || "Photo", photo: image ? `data:${image.type};base64,${image.donnees}` : undefined });
    setSaisie("");
    setEnCours(true);
    try {
      const reponse = await serveur.demanderJarvis({
        foyerId: foyerPartage,
        demande: texte,
        etat: decrireFoyer(donnees, donnees.membreId, donnees.aujourdhui),
        historique,
        image,
      });
      const actions = lireActions(reponse.appels);
      // Supprimer, ou retenir ce qu'il a remarqué seul : chaque fois, une question avant d'agir.
      const enAttente = actions.filter((a) => aConfirmer(a, texte));
      const resultat = appliquerActions(actions.filter((a) => !aConfirmer(a, texte)), avecVersion, donnees.membreId, donnees.aujourdhui, contexteReel);
      await enregistrerModifications(depot, resultat.modifications);
      if (resultat.modifications.length) vibrer();
      const dit = [reponse.texte, ...resultat.faits, ...resultat.echecs].filter(Boolean).join(" ") || (enAttente.length ? "" : "C'est fait.");
      if (dit) ajouter({ role: "jarvis", texte: dit, modifications: resultat.modifications.length ? resultat.modifications : undefined });
      for (const action of enAttente) {
        const { question, oui } = questionPour(action);
        ajouter({ role: "jarvis", texte: question, confirmation: { action, oui } });
      }
      setAlerte(
        reponse.budget.alerte
          ? `${nomFee()} a utilisé ${formaterChf(reponse.budget.depenseChf)} sur ${formaterChf(reponse.budget.plafondChf)} ce mois-ci.`
          : null,
      );
      if (parVoix) direAVoixHaute([dit, ...enAttente.map((a) => questionPour(a).question)].filter(Boolean).join(" "));
    } catch (e) {
      ajouter({ role: "jarvis", texte: e instanceof Error && e.message ? e.message : "Je n'ai pas pu répondre, réessaie.", erreur: true });
    } finally {
      setEnCours(false);
    }
  }

  async function repondre(echange: Echange, oui: boolean) {
    if (!echange.confirmation || echange.confirmation.reponse) return;
    const marquer = (e: Partial<Echange>) =>
      setEchanges((avant) => avant.map((x) => (x.n === echange.n ? { ...x, ...e, confirmation: { ...echange.confirmation!, reponse: oui ? "oui" : "non" } } : x)));
    if (!oui) {
      marquer({});
      return;
    }
    const resultat = appliquerActions([echange.confirmation.action], avecVersion, donnees.membreId, donnees.aujourdhui, contexteReel);
    await enregistrerModifications(depot, resultat.modifications);
    if (resultat.modifications.length) vibrer();
    marquer({
      texte: [...resultat.faits, ...resultat.echecs].join(" ") || echange.texte,
      modifications: resultat.modifications.length ? resultat.modifications : undefined,
    });
  }

  async function annuler(echange: Echange) {
    if (!echange.modifications || echange.annule) return;
    await annulerModifications(depot, echange.modifications);
    setEchanges((avant) => avant.map((e) => (e.n === echange.n ? { ...e, annule: true } : e)));
  }

  function parler() {
    if (ecoute) {
      ecoute();
      return;
    }
    setAlerte(null);
    let fini = false;
    const arreter = ecouter(setSaisie, (texte, erreur) => {
      fini = true;
      setEcoute(null);
      if (erreur) setAlerte(erreur);
      if (texte) void demander(texte, true);
    });
    if (!fini) setEcoute(() => arreter);
  }

  async function joindrePhoto(fichier: File | undefined) {
    if (!fichier) return;
    try {
      void demander(saisie, false, await photoPourJarvis(fichier));
    } catch {
      setAlerte("Cette photo ne s'ouvre pas, essaie avec une autre.");
    }
  }

  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    if (!ecoute) void demander(saisie, false);
  };

  if (!serveur || !foyerPartage) {
    return (
      <main>
        <h1>{nomFee()}</h1>
        <div className="carte bientot">
          <p>{nomFee()} passe par le serveur du foyer, qui garde sa clé à l'abri.</p>
          {serveur && <button className="bouton-principal" onClick={props.ouvrirPartage}>Activer le partage</button>}
        </div>
      </main>
    );
  }

  return (
    <main className="jarvis">
      <header className="entete-coches">
        <h1>{nomFee()}</h1>
        <button className="lien" onClick={props.ouvrirMemoire}>Sa mémoire</button>
      </header>
      {echanges.length === 0 ? (
        <div className="jarvis-accueil">
          <p className="discret">Écris ou parle : {nomFee()} ajoute aux courses, crée, décale ou coche les tâches, range ou retire du stock, note les pesées et répond sur la maison. Photographie une lettre, un rendez-vous ou un ticket de caisse, colle le lien d'une recette : elle s'en occupe. Elle retient ce que tu lui confies, et note pour Claude ce qu'elle ne sait pas encore faire. Elle demande avant de supprimer, et tout se défait avec Annuler.</p>
          <button className="carte jarvis-conseil" onClick={props.ouvrirConseil}>
            <Icone nom="calendrier" taille={24} />
            <span className="ligne-texte">
              <strong>Conseil de la semaine</strong>
              <span className="discret">Préparer la semaine ensemble</span>
            </span>
            <Icone nom="suivant" taille={18} />
          </button>
          <button className="carte jarvis-conseil" onClick={props.ouvrirMemoire}>
            <Icone nom="jarvis" taille={24} />
            <span className="ligne-texte">
              <strong>Ce que {nomFee()} sait</strong>
              <span className="discret">
                {donnees.souvenirs.length === 0
                  ? "Rien encore : dis-lui « retiens que… »"
                  : `${donnees.souvenirs.length} ${donnees.souvenirs.length > 1 ? "choses retenues" : "chose retenue"} sur le foyer`}
              </span>
            </span>
            <Icone nom="suivant" taille={18} />
          </button>
          <div className="puces">
            {EXEMPLES.map((x) => (
              <button key={x} className="puce" onClick={() => void demander(x, false)}>{x}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="jarvis-fil" aria-live="polite">
          {echanges.map((e) => (
            <div key={e.n} className={`bulle ${e.role}${e.erreur ? " en-erreur" : ""}${e.annule ? " annulee" : ""}`}>
              {e.photo && <img className="jarvis-photo" src={e.photo} alt={`Photo envoyée à ${nomFee()}`} />}
              <p>{e.texte}</p>
              {e.confirmation && !e.confirmation.reponse && (
                <div className="bulle-choix">
                  <button className="bouton-principal" onClick={() => void repondre(e, true)}>{e.confirmation.oui}</button>
                  <button className="secondaire" onClick={() => void repondre(e, false)}>Non</button>
                </div>
              )}
              {e.confirmation?.reponse === "non" && <span className="bulle-note">Laissé tel quel</span>}
              {e.modifications && (
                e.annule ? (
                  <span className="bulle-note">Annulé</span>
                ) : (
                  <button className="lien" onClick={() => void annuler(e)}>Annuler</button>
                )
              )}
            </div>
          ))}
          {enCours && <div className="bulle jarvis attente" aria-label={`${nomFee()} réfléchit`}><span /><span /><span /></div>}
        </div>
      )}
      {alerte && <p className="discret jarvis-alerte">{alerte}</p>}
      <div ref={bas} />
      <form className="ajout jarvis-saisie" onSubmit={envoyer}>
        <button type="button" className="secondaire" disabled={enCours} onClick={() => choixPhoto.current?.click()} aria-label={`Envoyer une photo à ${nomFee()}`}>
          <Icone nom="photo" taille={22} />
        </button>
        <input
          ref={choixPhoto}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void joindrePhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder={ecoute ? `${nomFee()} t'écoute…` : `Demande à ${nomFee()}`}
          enterKeyHint="send"
          aria-label={`Demande à ${nomFee()}`}
        />
        {voix && (ecoute || !saisie.trim()) ? (
          <button type="button" className={ecoute ? "ecoute" : undefined} onClick={parler} aria-label={ecoute ? "Arrêter d'écouter" : `Parler à ${nomFee()}`}>
            <Icone nom={ecoute ? "arreter" : "micro"} taille={22} />
          </button>
        ) : (
          <button type="submit" disabled={!saisie.trim() || enCours} aria-label="Envoyer">
            <Icone nom="envoyer" taille={22} />
          </button>
        )}
      </form>
    </main>
  );
}
