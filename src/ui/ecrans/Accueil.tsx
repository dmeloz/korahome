import { BandeauCouple } from "../BandeauCouple";
import type { Depot } from "../../donnees/depot";
import type { ServeurJarvis } from "../../donnees/distant";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import { bilanAOuvrir, bilanDeLaSemaine, ordreVivant, remarqueDuJour } from "../../domaine/apprentissage";
import { carteDuJour, titreMoment, type ChoseDuJour } from "../../domaine/aujourdhui";
import { facturesDuJour } from "../../domaine/budget";
import { evenementsDe } from "../../domaine/agenda";
import type { EtatPartage } from "../../domaine/etatPartage";
import type { OuRecherche } from "../../domaine/recherche";
import { repartitionDue } from "../../domaine/repartition";
import { decrireDerniere, sauvegardeDue } from "../../domaine/sauvegarde";
import { decrireEcheance, marquerFaite } from "../../domaine/taches";
import { signesDuJour, type Signe, type ValeurSigne } from "../../domaine/signes";
import type { Tache } from "../../domaine/types";
import {
  ajouterWidget,
  basculerTaille,
  definition,
  deplacerVers,
  nettoyerDisposition,
  nettoyerTailles,
  ordreAffichage,
  poserWidget,
  retirerWidget,
  tailleDe,
  type Disposition,
  type Tailles,
  type WidgetId,
} from "../../domaine/tableauDeBord";
import { useAnnoncer } from "../annulation";
import { contexteReel, enregistrerDisposition, enregistrerTailles, lireDisposition, lireTailles } from "../contexte";
import { Icone } from "../Icone";
import { MODULES, PICTOS, type ApercuWidget, type DonneesModule } from "../modules";
import { vibrer } from "../haptique";
import { calculerApprentissages } from "../apprendre";
import { CarteAujourdhui, Visite } from "../pieces";
import { FeuilleHeure } from "../pieces/FeuilleHeure";
import { BulleSigne, DateRepliee, GrandeDate, Signes } from "../pieces/HautAccueil";
import { lireSignes } from "../accueilLocal";
import { abonnerVisite, finirVisite, visiteEnAttente } from "../visite";
import { TousLesEspaces } from "../TousLesEspaces";
import { lireDerniereSauvegarde } from "../sauvegarde";
import { fermerRemarque, lireAdaptations, lireDernierBilan, lireUsages, noterUsage, remarqueAMontrer, useApprentissageLocal } from "../usage";
import { lireDerniereRepartition } from "./Taches";

/** Combien de choses du jour la carte garde ; trois se voient, les autres se font défiler. */
const CHOSES_CARTE = 12;

function salutation(heure: number): string {
  if (heure < 5) return "Bonne nuit";
  if (heure < 18) return "Bonjour";
  return "Bonsoir";
}

/** Durée d'appui pour passer en mode modification, comme sur l'écran d'accueil de l'iPhone. */
const APPUI_LONG_MS = 450;
/** Au-delà de ce déplacement, le doigt fait défiler la page : pas d'appui long. */
const TOLERANCE_PX = 10;
/** Tirée vers le bas d'autant, depuis le haut, la page ouvre « Tous les espaces ». */
const TIRER_POUR_CHERCHER = 72;

export function Accueil(props: {
  donnees: DonneesModule;
  ouvrirModule: (id: WidgetId) => void;
  ouvrirReglages: () => void;
  ouvrirMots: () => void;
  ouvrirJarvis: () => void;
  ouvrirBilan: () => void;
  ouvrirRappels: () => void;
  ouvrirSauvegarde: () => void;
  ouvrirPartage: () => void;
  /** Envoie et reçoit les changements tout de suite ; absent sans partage. */
  synchroniser?: () => Promise<void>;
  ouvrirRepartition: () => void;
  aller: (ou: OuRecherche) => void;
  depot: Depot;
  jarvis: { serveur: ServeurJarvis; foyerId: string } | null;
  /** Une nouvelle version attend : pastille rouge sur les Réglages. */
  nouvelleVersion: boolean;
  partage: EtatPartage;
  rappelsNonLus: number;
  /** Aucune page n'est ouverte par-dessus : les gestes de l'accueil sont à lui. */
  auDessus: boolean;
}) {
  const [disposition, setDisposition] = useState<Disposition>(() => nettoyerDisposition(lireDisposition()));
  // Un widget retiré depuis le bilan : l'accueil, resté ouvert dessous, relit sa disposition.
  const versionLocale = useApprentissageLocal();
  useEffect(() => {
    if (versionLocale) setDisposition(nettoyerDisposition(lireDisposition()));
  }, [versionLocale]);
  const [tailles, setTailles] = useState<Tailles>(() => nettoyerTailles(lireTailles()));
  const [edition, setEdition] = useState(false);
  const [glisse, setGlisse] = useState<WidgetId | null>(null);
  const [espaces, setEspaces] = useState(false);
  // Une tuile de « Tous les espaces » glissée vers l'accueil, sous le doigt.
  const [ajout, setAjout] = useState<WidgetId | null>(null);
  const fantome = useRef<HTMLDivElement>(null);
  const [signes, setSignes] = useState<Signe[]>(lireSignes);
  const [signeOuvert, setSigneOuvert] = useState<ValeurSigne | null>(null);
  const [heureDe, setHeureDe] = useState<Tache | null>(null);
  const haut = useRef<HTMLElement>(null);
  const appui = useRef<{ minuterie: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const ignorerClic = useRef(false);
  const { foyer, membreId, aujourdhui } = props.donnees;
  const moi = foyer.membres.find((m) => m.id === membreId);
  const annoncer = useAnnoncer();
  const maintenant = new Date();
  const heureTexte = `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`;
  // La visite guidée attend que l'accueil soit posé, tout en haut.
  const visiteDemandee = useSyncExternalStore(abonnerVisite, visiteEnAttente);
  const [visite, setVisite] = useState(false);
  useEffect(() => {
    if (!visiteDemandee || !props.auDessus || edition || espaces) return;
    const id = setTimeout(() => {
      window.scrollTo(0, 0);
      setVisite(true);
    }, 700);
    return () => clearTimeout(id);
  }, [visiteDemandee, props.auDessus, edition, espaces]);
  const autre = foyer.membres.find((m) => m.id !== membreId)?.prenom ?? null;
  usePourChercher(props.auDessus && !espaces && !visite && !ajout, () => setEspaces(true));

  const changer = (d: Disposition) => {
    setDisposition(d);
    enregistrerDisposition(d);
  };
  const changerTaille = (id: WidgetId) => {
    const suivantes = basculerTaille(tailles, id);
    setTailles(suivantes);
    enregistrerTailles(suivantes);
  };

  // Appui long sur un widget : on passe en mode modification, sans ouvrir la page.
  const lacher = () => {
    if (appui.current) clearTimeout(appui.current.minuterie);
    appui.current = null;
  };
  const appuyer = (e: PointerEvent) => {
    lacher();
    appui.current = {
      x: e.clientX,
      y: e.clientY,
      minuterie: setTimeout(() => {
        appui.current = null;
        ignorerClic.current = true;
        vibrer();
        setEdition(true);
      }, APPUI_LONG_MS),
    };
  };
  const bouger = (e: PointerEvent) => {
    const a = appui.current;
    if (a && Math.hypot(e.clientX - a.x, e.clientY - a.y) > TOLERANCE_PX) lacher();
  };

  // En mode modification, un widget se glisse à la place d'un autre.
  const commencerGlisse = (e: PointerEvent<HTMLDivElement>, id: WidgetId) => {
    if ((e.target as Element).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setGlisse(id);
  };
  const suivreGlisse = (e: PointerEvent) => {
    if (!glisse) return;
    const cible = widgetSous(e.clientX, e.clientY);
    if (cible && cible !== glisse) changer(deplacerVers(disposition, glisse, cible));
  };

  // Une tuile de « Tous les espaces » glissée sur l'accueil : la feuille se replie, le widget
  // apparaît tout de suite et prend la place sous le doigt ; on lâche, il reste là.
  const dispositionCourante = useRef(disposition);
  dispositionCourante.current = disposition;
  const commencerAjout = (id: WidgetId, x: number, y: number) => {
    setEdition(true);
    changer(ajouterWidget(dispositionCourante.current, id));
    setAjout(id);
    placerFantome(x, y);
  };
  const placerFantome = (x: number, y: number) => {
    const f = fantome.current;
    if (f) f.style.transform = `translate(${x - 44}px, ${y - 44}px)`;
  };
  useEffect(() => {
    if (!ajout) return;
    let fin = false;
    const suivre = (x: number, y: number) => {
      placerFantome(x, y);
      // Près des bords, la page défile pour atteindre les widgets du bas ou du haut.
      if (y > window.innerHeight - 70) window.scrollBy(0, 10);
      else if (y < 70) window.scrollBy(0, -10);
      const cible = widgetSous(x, y);
      if (cible && cible !== ajout) changer(poserWidget(dispositionCourante.current, ajout, cible));
    };
    const pointeur = (e: globalThis.PointerEvent) => suivre(e.clientX, e.clientY);
    const toucher = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      const t = e.touches[0];
      if (t) suivre(t.clientX, t.clientY);
    };
    const lacherAjout = () => {
      if (fin) return;
      fin = true;
      vibrer();
      setAjout(null);
      setEspaces(false);
    };
    window.addEventListener("pointermove", pointeur);
    window.addEventListener("touchmove", toucher, { passive: false });
    window.addEventListener("pointerup", lacherAjout);
    window.addEventListener("touchend", lacherAjout);
    window.addEventListener("touchcancel", lacherAjout);
    return () => {
      window.removeEventListener("pointermove", pointeur);
      window.removeEventListener("touchmove", toucher);
      window.removeEventListener("pointerup", lacherAjout);
      window.removeEventListener("touchend", lacherAjout);
      window.removeEventListener("touchcancel", lacherAjout);
    };
  }, [ajout]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ce que montre chaque widget, calculé par son module.
  const apercus = new Map<WidgetId, ApercuWidget>();
  for (const id of disposition) {
    const module = MODULES[id];
    if (module) apercus.set(id, module.widget(props.donnees));
  }

  const urgents = new Set(disposition.filter((id) => apercus.get(id)?.urgent));
  const adaptations = lireAdaptations();
  const heure = maintenant.getHours();
  const ordonnes = edition
    ? disposition
    : adaptations.accueilVivant
      ? ordreVivant(ordreAffichage(disposition, urgents), urgents, lireUsages(), heure, aujourdhui)
      : ordreAffichage(disposition, urgents);

  // Le bilan du dimanche attend qu'on le regarde ; le mot du jour de Jarvis, une fois par jour au plus.
  const aApprendre = bilanDeLaSemaine(calculerApprentissages(props.donnees)).length;
  const bilanPret = bilanAOuvrir(aujourdhui, lireDernierBilan(), aApprendre);
  const remarque = adaptations.remarques ? remarqueDuJour({ ...props.donnees, membreId }) : null;
  const montrerRemarque = remarqueAMontrer(remarque?.cle ?? null, aujourdhui);

  const evenements = evenementsDe(props.donnees.agenda);
  const valeursSignes = signesDuJour(signes, { ...props.donnees, evenements, heure: heureTexte });
  const derniereSauvegarde = lireDerniereSauvegarde();
  const carte = carteDuJour({
    ...props.donnees,
    evenements,
    factures: facturesDuJour(props.donnees.budget, aujourdhui, 1),
    sauvegardeDue: sauvegardeDue(derniereSauvegarde, aujourdhui) && maintenant.getDay() === 0,
    repartitionDue: repartitionDue(foyer, props.donnees.taches, aujourdhui, lireDerniereRepartition()),
  }, CHOSES_CARTE);
  const cocherChose = async (c: ChoseDuJour) => {
    const avant = props.donnees.taches.find((t) => t.id === c.tacheId);
    if (!avant) return;
    vibrer();
    const apres = marquerFaite(avant, membreId, aujourdhui, contexteReel);
    await props.depot.enregistrerTache(apres);
    noterUsage("tache", avant.id);
    const suite = apres.recurrence ? ` Prochaine fois ${decrireEcheance(apres.echeance, aujourdhui)}.` : "";
    annoncer(`« ${avant.titre} » faite.${suite}`, () => props.depot.enregistrerTache(avant));
  };
  const toucherChose = (c: ChoseDuJour) => {
    if (c.destination === "sauvegarde") props.ouvrirSauvegarde();
    else if (c.destination === "repartition") props.ouvrirRepartition();
    else {
      noterUsage("widget", c.destination);
      props.ouvrirModule(c.destination);
    }
  };
  const quiFait = (c: ChoseDuJour) => {
    const t = props.donnees.taches.find((x) => x.id === c.tacheId);
    if (!t) return null;
    if (t.responsable === null) return "Libre";
    return foyer.membres.find((m) => m.id === t.responsable)?.prenom ?? null;
  };
  const ouvrirSigne = (v: ValeurSigne) => {
    setSigneOuvert(null);
    if (v.destination === "mots") props.ouvrirMots();
    else props.ouvrirModule(v.destination);
  };

  const terminer = () => {
    setEdition(false);
    setGlisse(null);
  };

  function widget(id: WidgetId, i: number): ReactNode {
    const c = apercus.get(id);
    if (!c) return null;
    const def = definition(id);
    const taille = tailleDe(tailles, id);
    const classes = `widget ${taille}${c.urgent && !edition ? " urgent" : ""}`;
    const corps: ReactNode = (
      <>
        <span className="widget-haut">
          <span className="widget-picto"><Icone nom={PICTOS[id]} taille={16} /></span>
          <span className="widget-titre">{def.titre}</span>
          {!edition && c.urgent && <span className="point-etat urgent" aria-label="À faire" />}
        </span>
        <span className="widget-bas">
          <span className="widget-valeur">{c.chiffre > 0 ? `${c.chiffre} ${c.legende}` : c.legende}</span>
          {c.jauge !== undefined && (
            <span className="widget-jauge" aria-hidden><span style={{ width: `${Math.round(Math.min(1, c.jauge) * 100)}%` }} /></span>
          )}
          {c.lignes.length > 0 && (
            <span className="widget-apercu">
              {(taille === "grand" ? c.lignes : c.lignes.slice(0, 1)).map((ligne) => <span key={ligne}>{ligne}</span>)}
            </span>
          )}
        </span>
      </>
    );
    if (edition) {
      return (
        <div
          key={id}
          data-widget={id}
          className={`${classes} en-edition${glisse === id || ajout === id ? " glisse" : ""}`}
          style={{ animationDelay: `${(i % 3) * -0.09}s` }}
          onPointerDown={(e) => commencerGlisse(e, id)}
          onPointerMove={suivreGlisse}
          onPointerUp={() => setGlisse(null)}
          onPointerCancel={() => setGlisse(null)}
        >
          {corps}
          <button className="badge-widget retirer" onClick={() => changer(retirerWidget(disposition, id))} aria-label={`Retirer ${def.titre}`}>
            <Icone nom="moins" taille={14} />
          </button>
          <button className="badge-widget taille" onClick={() => changerTaille(id)} aria-label={taille === "grand" ? `Réduire ${def.titre}` : `Agrandir ${def.titre}`}>
            <Icone nom={taille === "grand" ? "reduire" : "agrandir"} taille={14} />
          </button>
        </div>
      );
    }
    return (
      <button
        key={id}
        data-widget={id}
        className={classes}
        onPointerDown={appuyer}
        onPointerMove={bouger}
        onPointerUp={lacher}
        onPointerCancel={lacher}
        onPointerLeave={lacher}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (ignorerClic.current) {
            ignorerClic.current = false;
            return;
          }
          noterUsage("widget", id);
          props.ouvrirModule(id);
        }}
      >
        {corps}
      </button>
    );
  }

  return (
    <main className="tableau accueil">
      <header className="haut-accueil" ref={haut}>
        <GrandeDate date={maintenant} />
        {!edition && <Signes valeurs={valeursSignes} choisis={signes} changer={setSignes} toucher={setSigneOuvert} />}
        {/* La date tient lieu de salutation ; le titre reste pour VoiceOver. */}
        <h1 className="cache-visuel">
          {salutation(heure)}
          {moi ? `, ${moi.prenom}` : ""}
        </h1>
      </header>
      <BulleSigne valeur={signeOuvert} fermer={() => setSigneOuvert(null)} ouvrir={ouvrirSigne} />
      <DateRepliee date={maintenant} cible={haut} />

      {edition && (
        <button className="bouton-termine" onClick={terminer}>OK</button>
      )}

      {!edition && <BandeauCouple donnees={props.donnees} depot={props.depot} jarvis={props.jarvis} ouvrir={props.ouvrirMots} />}

      {!edition && bilanPret && (
        <button className="carte proposition bilan-annonce" onClick={props.ouvrirBilan}>
          <span className="pictogramme"><Icone nom="appris" taille={20} /></span>
          <span className="proposition-texte">
            <strong>Le bilan de la semaine</strong>
            <span className="discret">{aApprendre === 1 ? "Une chose apprise" : `${aApprendre} choses apprises`}, à garder ou non.</span>
          </span>
          <Icone nom="suivant" taille={18} />
        </button>
      )}

      {!edition && remarque && montrerRemarque && (
        <div className="carte remarque-jarvis" role="status">
          <button className="remarque-texte" onClick={() => remarque.module && props.ouvrirModule(remarque.module)}>
            <span className="remarque-etoile" aria-hidden><Icone nom="jarvis" taille={16} /></span>
            <span>{remarque.texte}</span>
          </button>
          <button className="bouton-icone remarque-fermer" aria-label="Fermer le mot de Jarvis" onClick={() => fermerRemarque(remarque.cle, aujourdhui)}>
            <Icone nom="fermer" taille={16} />
          </button>
        </div>
      )}

      {!edition && (
        <CarteAujourdhui
          carte={carte}
          titre={titreMoment(heure)}
          maintenant={heureTexte}
          toucher={toucherChose}
          cocher={(c) => void cocherChose(c)}
          changerHeure={(c) => setHeureDe(props.donnees.taches.find((t) => t.id === c.tacheId) ?? null)}
          qui={quiFait}
          voirTout={() => props.ouvrirModule("taches")}
        />
      )}

      <section className="widgets-accueil" aria-label="Tableau de bord">
        <div className={`widgets${edition ? " en-edition" : ""}`}>{ordonnes.map((id, i) => widget(id, i))}</div>
        {ordonnes.length === 0 && (
          <div className="carte vide-tableau">
            <p>Le tableau de bord est vide. Tire l'accueil vers le bas et glisse un espace ici.</p>
            {!edition && <button className="bouton-principal" onClick={() => setEdition(true)}>Ajouter des widgets</button>}
          </div>
        )}
      </section>

      {edition && (
        <section className="ajout-widgets">
          <p className="discret aide-edition">Glisse un widget pour le déplacer, la croix le retire de l'accueil (il reste dans « Tous les espaces »).</p>
          <button className="bouton-principal" onClick={() => setEspaces(true)}>Ajouter un widget</button>
        </section>
      )}

      {!edition && (
        <footer className="pied-accueil">
          <button className={`etat-pied ${props.partage.ton}`} onClick={props.ouvrirPartage}>
            <span className={`point-etat ${props.partage.ton}`} aria-hidden />
            {props.partage.texte}
          </button>
          {props.synchroniser && <BoutonSynchro synchroniser={props.synchroniser} />}
          <button className="etat-pied" onClick={props.ouvrirSauvegarde}>
            <Icone nom="sauvegarde" taille={15} />
            Sauvegarde : {decrireDerniere(derniereSauvegarde, aujourdhui)}
          </button>
          <button className="lien modifier" onClick={() => setEdition(true)}>Modifier l'accueil</button>
        </footer>
      )}

      {visite && (
        <Visite
          autre={membreId ? autre : null}
          fermer={() => {
            setVisite(false);
            finirVisite();
          }}
        />
      )}

      <FeuilleHeure
        tache={heureDe}
        fermer={() => setHeureDe(null)}
        enregistrer={(t) => {
          setHeureDe(t);
          void props.depot.enregistrerTache(t);
        }}
      />

      <TousLesEspaces
        ouverte={espaces}
        repliee={ajout !== null}
        fermer={() => setEspaces(false)}
        donnees={props.donnees}
        aller={props.aller}
        ouvrirModule={(id) => {
          noterUsage("widget", id);
          props.ouvrirModule(id);
        }}
        ajouter={
          edition
            ? (id) => {
                changer(ajouterWidget(disposition, id));
                setEspaces(false);
              }
            : undefined
        }
        glisser={commencerAjout}
        liens={{
          ouvrirReglages: props.ouvrirReglages,
          ouvrirRappels: props.ouvrirRappels,
          ouvrirMots: props.ouvrirMots,
          ouvrirJarvis: props.ouvrirJarvis,
          rappelsNonLus: props.rappelsNonLus,
          nouvelleVersion: props.nouvelleVersion,
          moi: moi ? { prenom: moi.prenom, couleur: moi.couleur } : null,
        }}
      />

      {ajout && (
        <div className="fantome-widget" ref={fantome} aria-hidden>
          <span className="tuile-picto"><Icone nom={PICTOS[ajout]} taille={22} /></span>
          <span className="tuile-nom">{definition(ajout).titre}</span>
        </div>
      )}
    </main>
  );
}

/** Le widget sous le doigt, s'il y en a un. */
function widgetSous(x: number, y: number): WidgetId | undefined {
  return document.elementFromPoint(x, y)?.closest<HTMLElement>(".page-dessus [data-widget]")?.dataset.widget as WidgetId | undefined;
}

/** « Synchroniser » : la synchro passe déjà seule, mais on peut la demander d'un toucher. */
function BoutonSynchro({ synchroniser }: { synchroniser: () => Promise<void> }) {
  const [enCours, setEnCours] = useState(false);
  const lancer = async () => {
    if (enCours) return;
    vibrer();
    setEnCours(true);
    try {
      // Assez long pour voir que ça tourne, même quand tout est déjà à jour.
      await Promise.all([synchroniser().catch(() => {}), new Promise((r) => setTimeout(r, 600))]);
    } finally {
      setEnCours(false);
    }
  };
  return (
    <button className={`etat-pied bouton-synchro${enCours ? " en-cours" : ""}`} onClick={() => void lancer()} disabled={enCours}>
      <Icone nom="actualiser" taille={15} />
      {enCours ? "Synchronisation…" : "Synchroniser"}
    </button>
  );
}

/**
 * Comme sur l'accueil de l'iPhone : tirer la page vers le bas depuis le haut ouvre « Tous les
 * espaces ». Seulement quand la page est déjà tout en haut. Pendant le geste, une petite
 * étiquette descend avec le doigt. Sur un ordinateur, la molette vers le haut fait pareil.
 */
function usePourChercher(actif: boolean, ouvrir: () => void) {
  const rappel = useRef(ouvrir);
  rappel.current = ouvrir;
  useEffect(() => {
    if (!actif) return;
    let depart: { x: number; y: number } | null = null;
    const etiquette = document.createElement("div");
    etiquette.className = "tirer-espaces";
    etiquette.setAttribute("aria-hidden", "true");
    etiquette.textContent = "Tous les espaces";
    document.body.appendChild(etiquette);
    const montrer = (dy: number) => {
      const p = Math.min(1, dy / TIRER_POUR_CHERCHER);
      etiquette.style.opacity = String(p);
      etiquette.style.transform = `translate(-50%, ${Math.min(dy, TIRER_POUR_CHERCHER) * 0.6}px)`;
    };
    const debut = (e: TouchEvent) => {
      const cible = e.target instanceof Element ? e.target : null;
      depart = window.scrollY <= 0 && e.touches.length === 1 && !cible?.closest(".feuille, .tous-espaces, .barre-zone, input, textarea") ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    };
    const mouvement = (e: TouchEvent) => {
      if (!depart) return;
      const dy = e.touches[0].clientY - depart.y;
      const dx = Math.abs(e.touches[0].clientX - depart.x);
      if (dx > dy) {
        depart = null;
        montrer(0);
      } else if (dy > TIRER_POUR_CHERCHER && window.scrollY <= 0) {
        depart = null;
        montrer(0);
        vibrer();
        rappel.current();
      } else montrer(Math.max(0, dy));
    };
    const fin = () => {
      depart = null;
      montrer(0);
    };
    let molette = 0;
    const tourner = (e: WheelEvent) => {
      if (window.scrollY > 0 || e.deltaY >= 0) {
        molette = 0;
        return;
      }
      molette -= e.deltaY;
      if (molette > 120) {
        molette = 0;
        rappel.current();
      }
    };
    montrer(0);
    window.addEventListener("touchstart", debut, { passive: true });
    window.addEventListener("touchmove", mouvement, { passive: true });
    window.addEventListener("touchend", fin);
    window.addEventListener("touchcancel", fin);
    window.addEventListener("wheel", tourner, { passive: true });
    return () => {
      etiquette.remove();
      window.removeEventListener("touchstart", debut);
      window.removeEventListener("touchmove", mouvement);
      window.removeEventListener("touchend", fin);
      window.removeEventListener("touchcancel", fin);
      window.removeEventListener("wheel", tourner);
    };
  }, [actif]);
}
