import { createContext, useContext, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { preparerEvenement } from "../../domaine/agenda";
import { basculerCoeur, nouveauCoeur, nouveauMot } from "../../domaine/bandeau";
import { comprendrePhrase, decrireIntention, invitation, type Intention, type LieuBarre, type OuOuvrir } from "../../domaine/barre";
import { arriveesDuCouple, attentesDuCouple, autreMembre, feeDeLAutre, phraseAttente, vuesAGarder, type Attente } from "../../domaine/fee";
import { ErreurValidation } from "../../domaine/foyer";
import { nouvelleTache, decrireEcheance, decrireRecurrence } from "../../domaine/taches";
import type { Liste } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import type { ServeurJarvis } from "../../donnees/distant";
import { ajouterArticles } from "../ajouts";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { vibrer } from "../haptique";
import { direFee, enregistrerVues, lireVues, nomFee, parleAuMicro } from "../fee";
import { Icone } from "../Icone";
import { ecouter, voixDisponible } from "../jarvis";
import type { DonneesModule } from "../modules";
import { TicketDeCaisse } from "../TicketDeCaisse";
import { Fee } from "./Fee";
import { sauver } from "../sauver";

// La fée et sa saisie : en bas de chaque page, la seule façon d'ajouter quoi que ce soit.
// On touche la fée et on parle, ou on garde le doigt et on écrit ; Kora range seule la
// phrase quand c'est simple, sinon la confie à l'assistant. Une page peut prendre la main sur
// la phrase (Frigo et placards complète la quantité, le lieu et la date pendant qu'on écrit)
// et lire ce qui est tapé (Courses propose les articles déjà achetés).
// Équivalent natif : un safeAreaInset du bas qui apparaît sur demande.

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
  const actif = gestionnaire !== null;
  useEffect(() => {
    if (!actif) return;
    const appel: Gestionnaire = (t) => (ref.current ? ref.current(t) : Promise.resolve(false));
    gestionnaires.set(cle, appel);
    return () => {
      if (gestionnaires.get(cle) === appel) gestionnaires.delete(cle);
    };
  }, [cle, actif]);
}

// Une page peut changer ce que la barre propose d'écrire (le Conseiller du Budget : une question).
let invitationDePage: string | null = null;
const abonnesInvitation = new Set<() => void>();
const prevenirInvitation = () => abonnesInvitation.forEach((f) => f());

export function useInvitationBarre(texte: string | null): void {
  useEffect(() => {
    if (!texte) return;
    invitationDePage = texte;
    prevenirInvitation();
    return () => {
      if (invitationDePage === texte) invitationDePage = null;
      prevenirInvitation();
    };
  }, [texte]);
}

function useInvitationDePage(): string | null {
  return useSyncExternalStore(
    (f) => {
      abonnesInvitation.add(f);
      return () => abonnesInvitation.delete(f);
    },
    () => invitationDePage,
  );
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
  /** « Ouvre le budget » : la page, sans passer par l'assistant. */
  ouvrirPage: (ou: OuOuvrir) => void;
}) {
  const { texte, changer } = useSaisieBarre();
  const invitationPage = useInvitationDePage();
  const [ecoute, setEcoute] = useState<(() => void) | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState(false);
  /** On répond à un mot de l'autre : la phrase part en mot, pas en courses. */
  const [reponse, setReponse] = useState<string | null>(null);
  const [ancre, setAncre] = useState<number | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  const rang = useRef<HTMLDivElement>(null);
  const annoncer = useAnnoncer();
  const voix = voixDisponible();
  const { donnees, depot } = props;
  const clavier = useClavier();
  const etat = useRef({ texte, ecoute: false });
  etat.current = { texte, ecoute: !!ecoute };

  // Les messages (Annuler, nouvelle version) se placent au-dessus du bas de l'écran.
  useEffect(() => {
    document.documentElement.classList.add("avec-barre");
    return () => document.documentElement.classList.remove("avec-barre");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("saisie-ouverte", ouverte);
    return () => document.documentElement.classList.remove("saisie-ouverte");
  }, [ouverte]);

  // Une autre page : la phrase en cours s'efface, le message aussi, et la saisie se referme.
  const toutEffacer = useEffectEvent(() => {
    changer("");
    setMessage(null);
    setOuverte(false);
    setReponse(null);
  });
  useEffect(() => toutEffacer(), [props.cle]);

  // La fée se pose juste au-dessus de la saisie ouverte, clavier ou non ; elle se remesure quand
  // le clavier, le message ou le vide du champ font bouger la saisie.
  const vide = texte === "";
  useLayoutEffect(() => {
    if (!ouverte) {
      setAncre(null);
      return;
    }
    const mesurer = () => setAncre(rang.current ? rang.current.getBoundingClientRect().top : null);
    mesurer();
    const id = setTimeout(mesurer, 320);
    return () => clearTimeout(id);
  }, [ouverte, clavier, message, vide]);

  const fermer = () => {
    setOuverte(false);
    setReponse(null);
    champ.current?.blur();
  };
  /** Ouvre la saisie et le clavier : à appeler dans le geste, sinon l'iPhone garde le clavier fermé. */
  const ecrire = () => {
    setOuverte(true);
    champ.current?.focus();
  };

  // ----- Ce que l'autre a envoyé : une icône attend au-dessus de la fée -----
  const moi = donnees.membreId;
  const maintenant = new Date().toISOString();
  const [vues, setVues] = useState(lireVues);
  // La toute première fois, ce qui est déjà là compte comme vu : pas d'avalanche à la mise à jour.
  const toutMarquerVu = useEffectEvent(() => {
    const toutes = arriveesDuCouple(donnees.couple, moi, new Date().toISOString()).map((a) => a.cle);
    enregistrerVues(toutes);
    setVues(new Set(toutes));
  });
  useEffect(() => {
    if (vues === null) toutMarquerVu();
  }, [vues]);
  const attentes = vues ? attentesDuCouple(donnees.couple, moi, maintenant, vues) : [];
  const prenomMoi = donnees.foyer.membres.find((m) => m.id === moi)?.prenom ?? null;
  const autre = autreMembre(donnees.foyer, moi);
  const prenomAutre = autre?.prenom ?? "L'autre";
  const teinteAutre = feeDeLAutre(prenomMoi, autre?.prenom).teinte;

  function ouvrirAttente(a: Attente) {
    const suivantes = new Set(vuesAGarder(vues ?? new Set(), donnees.couple, moi, maintenant));
    suivantes.add(a.cle);
    enregistrerVues(suivantes);
    setVues(suivantes);
    if (a.sorte === "message") {
      const aime = !!moi && a.mot.coeurs.includes(moi);
      direFee({
        cle: a.cle,
        de: { prenom: prenomAutre, teinte: teinteAutre },
        texte: phraseAttente(a, prenomAutre),
        actions: [
          {
            texte: "Répondre",
            faire: () => {
              setReponse(prenomAutre);
              ecrire();
            },
          },
          ...(moi && !aime ? [{ texte: "♥", faire: () => sauver(depot.enregistrerCouple(basculerCoeur(a.mot, moi)).then(vibrer)) }] : []),
          { texte: "Vu" },
        ],
      });
      return;
    }
    direFee({
      cle: a.cle,
      texte: phraseAttente(a, prenomAutre),
      actions: [
        {
          texte: "Renvoyer un cœur",
          faire: () => {
            vibrer();
            sauver(depot.enregistrerCouple(nouveauCoeur(moi, contexteReel)));
          },
        },
        { texte: "Plus tard" },
      ],
    });
  }
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
      const base = nouvelleTache(intention.titre, intention.recurrence, intention.echeance, contexteReel);
      // Une heure dite (« à 20h ») : un rappel à cette heure-là, comme dans l'app Rappels.
      const tache = { ...(intention.heure ? { ...base, heure: intention.heure } : base), creePar: donnees.membreId };
      const avecCategorie = props.lieu === "entretien" || props.lieu === "administratif" ? { ...tache, categorie: props.lieu } : tache;
      await depot.enregistrerTache(avecCategorie);
      vibrer();
      const quand = intention.recurrence ? `${decrireRecurrence(intention.recurrence).toLowerCase()}, la première ${decrireEcheance(intention.echeance, donnees.aujourdhui)}` : decrireEcheance(intention.echeance, donnees.aujourdhui);
      annoncer(`« ${tache.titre} » ajoutée, ${quand}${intention.heure ? `, rappel à ${intention.heure}` : ""}.`, () => depot.supprimerTache(tache.id));
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
      // Sans la page du frigo pour la compléter, la phrase part chez l'assistant.
      return props.demanderAJarvis(intention.texte);
    }
    if (intention.type === "ouvrir") {
      vibrer();
      props.ouvrirPage(intention.ou);
      return;
    }
    if (!props.jarvis) {
      setMessage(`${nomFee()} répond quand le partage est activé. Les courses, tâches et rendez-vous s'ajoutent sans elle.`);
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
      if (reponse) {
        const mot = nouveauMot(phrase, moi, contexteReel);
        await depot.enregistrerCouple(mot);
        vibrer();
        annoncer(`Mot envoyé à ${reponse}.`, () => depot.supprimerCouple(mot.id));
        changer("");
        fermer();
        return;
      }
      const page = gestionnaires.get(props.cle);
      if (page && (await page(phrase))) {
        changer("");
        return;
      }
      await executer(comprendrePhrase(phrase, props.lieu, donnees.aujourdhui, donnees.foyer.membres));
      changer("");
      fermer();
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
      else if (!erreur && !etat.current.texte.trim()) setOuverte(false);
    });
    if (!fini) setEcoute(() => arreter);
  }

  /** Toucher la fée : elle écoute (ou, sans micro, on lui écrit). Pendant l'écoute : elle s'arrête. */
  const toucherFee = () => {
    if (ecoute) {
      ecoute();
      return;
    }
    vibrer();
    setMessage(null);
    if (voix && parleAuMicro()) {
      setOuverte(true);
      parler();
    } else ecrire();
  };

  const lu = invitationPage ?? invitation(props.lieu);
  const proposition = ecoute ? `${nomFee()} t'écoute…` : reponse ? `Répondre à ${reponse}…` : lu.replace(/Jarvis/g, nomFee());

  return (
    <>
    <Fee
      ancre={ancre}
      ecoute={!!ecoute}
      toucher={toucherFee}
      appuiLong={() => {
        setMessage(null);
        setOuverte(true);
      }}
      lacherApresAppui={() => champ.current?.focus()}
      attentes={ouverte ? [] : attentes}
      ouvrirAttente={ouvrirAttente}
      teinteAutre={teinteAutre}
      cacher={() => {
        if (ecoute) ecoute();
        fermer();
      }}
    />
    <div className={`barre-zone${ouverte ? " ouverte" : ""}`} style={clavier ? { bottom: clavier } : undefined} aria-hidden={!ouverte}>
      <div ref={(el) => void (el && el.firstChild !== emplacement() && el.appendChild(emplacement()))} />
      {message && <p className="barre-message" role="status">{message}</p>}
      <div className="barre-rang" ref={rang}>
        <form className="barre-jarvis" onSubmit={(e) => void envoyer(e)} role="search">
          <input
            ref={champ}
            value={texte}
            onChange={(e) => changer(e.target.value)}
            onFocus={() => setOuverte(true)}
            onBlur={() =>
              // Un toucher sur Envoyer ou le micro arrive juste après : on attend un instant.
              setTimeout(() => {
                if (!etat.current.texte.trim() && !etat.current.ecoute && document.activeElement !== champ.current) {
                  setOuverte(false);
                  setReponse(null);
                }
              }, 250)
            }
            onKeyDown={(e) => e.key === "Escape" && fermer()}
            placeholder={proposition}
            enterKeyHint="send"
            autoComplete="off"
            tabIndex={ouverte ? undefined : -1}
            aria-label={proposition}
          />
          {(props.lieu === "accueil" || props.lieu === "stock" || props.lieu === "budget") && !texte && !reponse && !ecoute && (
            <TicketDeCaisse jarvis={props.jarvis} donnees={donnees} depot={depot} catalogue={donnees.catalogue} classe="barre-bouton" tabIndex={ouverte ? undefined : -1} />
          )}
          {texte.trim() && !ecoute ? (
            <button type="submit" className="barre-action" aria-label="Envoyer" tabIndex={ouverte ? undefined : -1}>
              <Icone nom="envoyer" taille={20} />
            </button>
          ) : voix ? (
            <button type="button" className={`barre-action${ecoute ? " ecoute" : ""}`} onClick={parler} aria-label={ecoute ? "Arrêter d'écouter" : "Dicter"} tabIndex={ouverte ? undefined : -1}>
              <Icone nom={ecoute ? "arreter" : "micro"} taille={20} />
            </button>
          ) : null}
        </form>
      </div>
    </div>
    </>
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
