import { useEffect, useRef, useState, type FormEvent } from "react";
import { appliquerActions, decrireFoyer, formaterChf, lireActions, TOURS_RETENUS, type Modification, type TourJarvis } from "../../domaine/jarvis";
import type { Depot } from "../../donnees/depot";
import type { DemandeJarvis, ServeurJarvis } from "../../donnees/distant";
import { contexteReel } from "../contexte";
import { Icone } from "../Icone";
import { annulerModifications, direAVoixHaute, ecouter, enregistrerModifications, photoPourJarvis, voixDisponible } from "../jarvis";
import type { DonneesModule } from "../modules";
import { vibrer } from "../haptique";

interface Echange extends TourJarvis {
  n: number;
  /** Ce que Jarvis a changé : « Annuler » le défait. */
  modifications?: Modification[];
  annule?: boolean;
  erreur?: boolean;
  /** La photo envoyée, en aperçu. */
  photo?: string;
}

// La conversation reste le temps que l'app est ouverte, même en passant d'une page à l'autre.
let conversation: Echange[] = [];
let compteur = 0;

const EXEMPLES = ["Ajoute du lait et des œufs", "La litière est faite", "Sarah sort les poubelles samedi", "Qu'est-ce qui périme bientôt ?"];

export function Jarvis(props: {
  donnees: DonneesModule;
  depot: Depot;
  serveur: ServeurJarvis | null;
  /** Le foyer, s'il est partagé : Jarvis passe par son serveur. */
  foyerPartage: string | null;
  ouvrirPartage: () => void;
  ouvrirConseil: () => void;
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

  useEffect(() => {
    conversation = echanges;
    bas.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [echanges]);
  useEffect(() => () => ecoute?.(), [ecoute]);

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
      const resultat = appliquerActions(lireActions(reponse.appels), donnees, donnees.membreId, donnees.aujourdhui, contexteReel);
      await enregistrerModifications(depot, resultat.modifications);
      if (resultat.modifications.length) vibrer();
      const dit = [reponse.texte, ...resultat.faits, ...resultat.echecs].filter(Boolean).join(" ") || "C'est fait.";
      ajouter({ role: "jarvis", texte: dit, modifications: resultat.modifications.length ? resultat.modifications : undefined });
      setAlerte(
        reponse.budget.alerte
          ? `Jarvis a utilisé ${formaterChf(reponse.budget.depenseChf)} sur ${formaterChf(reponse.budget.plafondChf)} ce mois-ci.`
          : null,
      );
      if (parVoix) direAVoixHaute(dit);
    } catch (e) {
      ajouter({ role: "jarvis", texte: e instanceof Error && e.message ? e.message : "Je n'ai pas pu répondre, réessaie.", erreur: true });
    } finally {
      setEnCours(false);
    }
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
    const arreter = ecouter(setSaisie, (texte, erreur) => {
      setEcoute(null);
      if (erreur) setAlerte(erreur);
      if (texte) void demander(texte, true);
    });
    setEcoute(() => arreter);
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
    void demander(saisie, false);
  };

  if (!serveur || !foyerPartage) {
    return (
      <main>
        <h1>Jarvis</h1>
        <div className="carte bientot">
          <p>Jarvis passe par le serveur du foyer, qui garde sa clé à l'abri.</p>
          {serveur && <button className="bouton-principal" onClick={props.ouvrirPartage}>Activer le partage</button>}
        </div>
      </main>
    );
  }

  return (
    <main className="jarvis">
      <h1>Jarvis</h1>
      {echanges.length === 0 ? (
        <div className="jarvis-accueil">
          <p className="discret">Écris ou parle : Jarvis ajoute aux courses, crée ou coche les tâches, range le frigo, note les pesées et répond sur la maison. Photographie une lettre, un rendez-vous ou un ticket de caisse, colle le lien d'une recette : il s'en occupe. Tout se défait avec Annuler.</p>
          <button className="carte jarvis-conseil" onClick={props.ouvrirConseil}>
            <Icone nom="calendrier" taille={24} />
            <span className="ligne-texte">
              <strong>Conseil de la semaine</strong>
              <span className="discret">Préparer la semaine ensemble</span>
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
              {e.photo && <img className="jarvis-photo" src={e.photo} alt="Photo envoyée à Jarvis" />}
              <p>{e.texte}</p>
              {e.modifications && (
                e.annule ? (
                  <span className="bulle-note">Annulé</span>
                ) : (
                  <button className="lien" onClick={() => void annuler(e)}>Annuler</button>
                )
              )}
            </div>
          ))}
          {enCours && <div className="bulle jarvis attente" aria-label="Jarvis réfléchit"><span /><span /><span /></div>}
        </div>
      )}
      {alerte && <p className="discret jarvis-alerte">{alerte}</p>}
      <div ref={bas} />
      <form className="ajout jarvis-saisie" onSubmit={envoyer}>
        <button type="button" className="secondaire" disabled={enCours} onClick={() => choixPhoto.current?.click()} aria-label="Envoyer une photo à Jarvis">
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
          placeholder={ecoute ? "Je t'écoute…" : "Demande à Jarvis"}
          enterKeyHint="send"
          aria-label="Demande à Jarvis"
        />
        {voix && !saisie.trim() ? (
          <button type="button" className={ecoute ? "ecoute" : undefined} onClick={parler} aria-label={ecoute ? "Arrêter d'écouter" : "Parler à Jarvis"}>
            <Icone nom="micro" taille={22} />
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
