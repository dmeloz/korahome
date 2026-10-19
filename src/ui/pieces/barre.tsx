import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { preparerEvenement } from "../../domaine/agenda";
import { comprendrePhrase, decrireIntention, invitation, type Intention, type LieuBarre } from "../../domaine/barre";
import { ErreurValidation } from "../../domaine/foyer";
import { nouvelleTache, decrireEcheance, decrireRecurrence } from "../../domaine/taches";
import type { Liste } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import type { ServeurJarvis } from "../../donnees/distant";
import { ajouterArticles } from "../ajouts";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { ecouter, voixDisponible } from "../jarvis";
import type { DonneesModule } from "../modules";
import { TicketDeCaisse } from "../TicketDeCaisse";

// La barre Jarvis : en bas de chaque page, la seule façon d'ajouter quoi que ce soit.
// On écrit (ou on dit) une phrase ; Kora la range seule quand c'est simple, sinon la
// confie à Jarvis. Une page peut prendre la main sur la phrase (Frigo et placards
// complète la quantité, le lieu et la date pendant qu'on écrit) et lire ce qui est tapé
// (Courses propose les articles déjà achetés). Équivalent natif : un safeAreaInset du bas.

interface Saisie {
  texte: string;
  changer: (texte: string) => void;
}

const ContexteSaisie = createContext<Saisie>({ texte: "", changer: () => {} });

/** Ce qui est tapé dans la barre, pour la page du dessus. */
export const useSaisieBarre = () => useContext(ContexteSaisie);

type Gestionnaire = (texte: string) => Promise<boolean>;
const gestionnaires = new Map<string, Gestionnaire>();

/**
 * Une page prend la phrase de la barre quand elle est au-dessus. Le gestionnaire renvoie
 * vrai quand il a tout fait ; faux, la barre fait comme d'habitude.
 */
export function useGestionnaireBarre(cle: string, gestionnaire: Gestionnaire | null): void {
  const ref = useRef(gestionnaire);
  ref.current = gestionnaire;
  useEffect(() => {
    if (!ref.current) return;
    const appel: Gestionnaire = (t) => (ref.current ? ref.current(t) : Promise.resolve(false));
    gestionnaires.set(cle, appel);
    return () => {
      if (gestionnaires.get(cle) === appel) gestionnaires.delete(cle);
    };
  }, [cle, gestionnaire === null]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Un seul emplacement, créé une fois : la barre l'accroche au-dessus de son champ, et il
// reste le même quand la barre disparaît puis revient.
let complement: HTMLDivElement | null = null;
function emplacement(): HTMLDivElement {
  if (!complement) {
    complement = document.createElement("div");
    complement.className = "barre-complement";
  }
  return complement;
}

/**
 * Ce qu'une page montre juste au-dessus de la barre pendant qu'on écrit (ce que Kora a
 * compris, les articles déjà achetés) : visible même clavier ouvert.
 */
export function AuDessusDeLaBarre({ children }: { children: ReactNode }) {
  return typeof document === "undefined" ? null : createPortal(children, emplacement());
}

export function FournisseurSaisie({ children }: { children: ReactNode }) {
  const [texte, setTexte] = useState("");
  return <ContexteSaisie.Provider value={{ texte, changer: setTexte }}>{children}</ContexteSaisie.Provider>;
}

export function BarreJarvis(props: {
  /** La page du dessus : « module:stock », « liste:… », « accueil ». */
  cle: string;
  lieu: LieuBarre;
  /** La liste ouverte, quand on écrit dans une liste. */
  liste: Liste | null;
  donnees: DonneesModule;
  depot: Depot;
  jarvis: { serveur: ServeurJarvis; foyerId: string } | null;
  /** Ouvre Jarvis avec la demande ; sans demande, ouvre sa conversation. */
  demanderAJarvis: (demande: string) => void;
  ouvrirJarvis: () => void;
  /** Le coin « Dev », à gauche de la barre, quand il est affiché. */
  avant?: ReactNode;
}) {
  const { texte, changer } = useSaisieBarre();
  const [ecoute, setEcoute] = useState<(() => void) | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  const annoncer = useAnnoncer();
  const voix = voixDisponible();
  const { donnees, depot } = props;
  const clavier = useClavier();

  // Les messages (Annuler, nouvelle version) se placent au-dessus de la barre.
  useEffect(() => {
    document.documentElement.classList.add("avec-barre");
    return () => document.documentElement.classList.remove("avec-barre");
  }, []);

  // Une autre page : la phrase en cours s'efface, le message aussi.
  useEffect(() => {
    changer("");
    setMessage(null);
  }, [props.cle]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(id);
  }, [message]);

  async function executer(intention: Intention): Promise<void> {
    const courses = donnees.listes.find((l) => l.type === "courses") ?? null;
    if (intention.type === "courses" || intention.type === "liste") {
      const liste = intention.type === "liste" ? props.liste : courses;
      if (!liste) return props.demanderAJarvis(texte);
      const r = await ajouterArticles(depot, liste, donnees.elements, intention.articles, donnees.membreId, donnees.catalogue);
      if (r.ajoutes.length === 0) {
        setMessage(r.doublons.length ? `« ${r.doublons[0]} » est déjà sur la liste.` : "Rien à ajouter.");
        return;
      }
      vibrer();
      const suite = r.doublons.length ? ` ${r.doublons.join(", ")} y étai${r.doublons.length > 1 ? "ent" : "t"} déjà.` : "";
      annoncer(decrireIntention({ ...intention, articles: r.ajoutes.map((e) => e.texte) }) + suite, () => depot.supprimerElements(r.ajoutes.map((e) => e.id)));
      if (r.conseil) setMessage(r.conseil);
      return;
    }
    if (intention.type === "tache") {
      const tache = nouvelleTache(intention.titre, intention.recurrence, intention.echeance, contexteReel);
      const avecCategorie = props.lieu === "entretien" ? { ...tache, categorie: "entretien" as const } : tache;
      await depot.enregistrerTache(avecCategorie);
      vibrer();
      const quand = intention.recurrence ? `${decrireRecurrence(intention.recurrence).toLowerCase()}, la première ${decrireEcheance(intention.echeance, donnees.aujourdhui)}` : decrireEcheance(intention.echeance, donnees.aujourdhui);
      annoncer(`« ${tache.titre} » ajoutée, ${quand}.`, () => depot.supprimerTache(tache.id));
      return;
    }
    if (intention.type === "agenda") {
      const b = intention.brouillon;
      const ev = preparerEvenement(
        { titre: b.titre, jour: b.jour ?? donnees.aujourdhui, fin: b.fin, heure: b.heure, heureFin: b.heureFin, categorie: b.categorie, repetition: b.repetition, pour: b.pour },
        donnees.membreId,
        contexteReel,
      );
      await depot.enregistrerAgenda(ev);
      vibrer();
      annoncer(decrireIntention(intention), () => depot.supprimerAgenda(ev.id));
      return;
    }
    if (intention.type === "stock") {
      // Sans la page du frigo pour la compléter, la phrase part chez Jarvis.
      return props.demanderAJarvis(intention.texte);
    }
    if (!props.jarvis) {
      setMessage("Jarvis répond quand le partage est activé. Les courses, tâches et rendez-vous s'ajoutent sans lui.");
      return;
    }
    props.demanderAJarvis(intention.demande);
  }

  async function envoyer(e?: FormEvent, dite?: string) {
    e?.preventDefault();
    const phrase = (dite ?? texte).trim();
    if (!phrase) return;
    setMessage(null);
    try {
      const page = gestionnaires.get(props.cle);
      if (page && (await page(phrase))) {
        changer("");
        return;
      }
      await executer(comprendrePhrase(phrase, props.lieu, donnees.aujourdhui, donnees.foyer.membres));
      changer("");
      champ.current?.blur();
    } catch (err) {
      if (err instanceof ErreurValidation) setMessage(err.message);
      else throw err;
    }
  }

  function parler() {
    if (ecoute) {
      ecoute();
      return;
    }
    let fini = false;
    const arreter = ecouter(changer, (dit, erreur) => {
      fini = true;
      setEcoute(null);
      if (erreur) setMessage(erreur);
      if (dit) void envoyer(undefined, dit);
    });
    if (!fini) setEcoute(() => arreter);
  }

  return (
    <div className="barre-zone" style={clavier ? { bottom: clavier } : undefined}>
      <div ref={(el) => void (el && el.firstChild !== emplacement() && el.appendChild(emplacement()))} />
      {message && <p className="barre-message" role="status">{message}</p>}
      <div className="barre-rang">
        {props.avant}
        <form className="barre-jarvis" onSubmit={(e) => void envoyer(e)} role="search">
          <button type="button" className="barre-etoile" onClick={props.ouvrirJarvis} aria-label="Ouvrir Jarvis">
            <Icone nom="jarvis" taille={20} />
          </button>
          <input
            ref={champ}
            value={texte}
            onChange={(e) => changer(e.target.value)}
            placeholder={ecoute ? "Je t'écoute…" : invitation(props.lieu)}
            enterKeyHint="send"
            autoComplete="off"
            aria-label={invitation(props.lieu)}
          />
          {(props.lieu === "accueil" || props.lieu === "stock") && !texte && (
            <TicketDeCaisse jarvis={props.jarvis} donnees={donnees} depot={depot} catalogue={donnees.catalogue} classe="barre-bouton" />
          )}
          {texte.trim() && !ecoute ? (
            <button type="submit" className="barre-action" aria-label="Envoyer">
              <Icone nom="envoyer" taille={20} />
            </button>
          ) : voix ? (
            <button type="button" className={`barre-action${ecoute ? " ecoute" : ""}`} onClick={parler} aria-label={ecoute ? "Arrêter d'écouter" : "Dicter"}>
              <Icone nom={ecoute ? "arreter" : "micro"} taille={20} />
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}

/**
 * La hauteur du clavier de l'iPhone, pour que la barre reste juste au-dessus
 * (Safari laisse les éléments fixes sous le clavier). 0 quand il est fermé.
 */
function useClavier(): number {
  const [hauteur, setHauteur] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const suivre = () => {
      const h = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setHauteur(h > 80 ? h : 0);
    };
    vv.addEventListener("resize", suivre);
    vv.addEventListener("scroll", suivre);
    return () => {
      vv.removeEventListener("resize", suivre);
      vv.removeEventListener("scroll", suivre);
    };
  }, []);
  return hauteur;
}
