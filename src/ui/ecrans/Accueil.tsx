import { BandeauCouple } from "../BandeauCouple";
import type { Depot } from "../../donnees/depot";
import type { ServeurJarvis } from "../../donnees/distant";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import { bilanAOuvrir, bilanDeLaSemaine, ordreVivant, remarqueDuJour } from "../../domaine/apprentissage";
import { carteDuJour, type ChoseDuJour } from "../../domaine/aujourdhui";
import { facturesDuJour } from "../../domaine/budget";
import { evenementsDe } from "../../domaine/agenda";
import type { EtatPartage } from "../../domaine/etatPartage";
import { decrireTemps, meteoDu } from "../../domaine/meteo";
import type { OuRecherche } from "../../domaine/recherche";
import { repartitionDue } from "../../domaine/repartition";
import { decrireDerniere, sauvegardeDue } from "../../domaine/sauvegarde";
import { decrireEcheance, marquerFaite } from "../../domaine/taches";
import {
  ajouterWidget,
  basculerTaille,
  definition,
  deplacerVers,
  nettoyerDisposition,
  nettoyerPages,
  nettoyerTailles,
  ordreAffichage,
  pageDe,
  pageSuivante,
  PAGE_PRINCIPALE,
  PAGES_ACCUEIL,
  pagesVisibles,
  retirerWidget,
  tailleDe,
  widgetsAAjouter,
  widgetsDeLaPage,
  type Disposition,
  type PageAccueil,
  type PagesWidgets,
  type Tailles,
  type WidgetId,
} from "../../domaine/tableauDeBord";
import { useAnnoncer } from "../annulation";
import { contexteReel, enregistrerDisposition, enregistrerPages, enregistrerTailles, lireDisposition, lirePages, lireTailles } from "../contexte";
import { Icone } from "../Icone";
import { MODULES, PICTOS, type ApercuWidget, type DonneesModule } from "../modules";
import { vibrer } from "../haptique";
import { calculerApprentissages } from "../apprendre";
import { CarteAujourdhui, Visite } from "../pieces";
import { abonnerVisite, finirVisite, visiteEnAttente } from "../visite";
import { Recherche } from "../Recherche";
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
/** Tirée vers le bas d'autant, depuis le haut, la page ouvre la recherche. */
const TIRER_POUR_CHERCHER = 72;

export function Accueil(props: {
  donnees: DonneesModule;
  ouvrirModule: (id: WidgetId) => void;
  ouvrirReglages: () => void;
  ouvrirMots: () => void;
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
  const [pages, setPages] = useState<PagesWidgets>(() => nettoyerPages(lirePages()));
  const [edition, setEdition] = useState(false);
  const [glisse, setGlisse] = useState<WidgetId | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [pageActive, setPageActive] = useState<PageAccueil>(PAGE_PRINCIPALE);
  const defilant = useRef<HTMLDivElement>(null);
  const appui = useRef<{ minuterie: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const ignorerClic = useRef(false);
  const { foyer, membreId, aujourdhui } = props.donnees;
  const moi = foyer.membres.find((m) => m.id === membreId);
  const annoncer = useAnnoncer();
  const date = new Date().toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" });
  const jourMeteo = meteoDu(props.donnees.meteo, aujourdhui);
  const temps = jourMeteo ? `${Math.round(jourMeteo.max)}°, ${decrireTemps(jourMeteo.code).toLowerCase()}` : null;
  // La visite guidée attend que l'accueil soit posé, tout en haut et sur sa première page.
  const visiteDemandee = useSyncExternalStore(abonnerVisite, visiteEnAttente);
  const [visite, setVisite] = useState(false);
  useEffect(() => {
    if (!visiteDemandee || !props.auDessus || edition || recherche) return;
    const id = setTimeout(() => {
      window.scrollTo(0, 0);
      defilant.current?.scrollTo({ left: 0 });
      setVisite(true);
    }, 700);
    return () => clearTimeout(id);
  }, [visiteDemandee, props.auDessus, edition, recherche]);
  const autre = foyer.membres.find((m) => m.id !== membreId)?.prenom ?? null;
  usePourChercher(props.auDessus && !edition && !recherche && !visite, () => setRecherche(true));

  const changer = (d: Disposition) => {
    setDisposition(d);
    enregistrerDisposition(d);
  };
  const changerTaille = (id: WidgetId) => {
    const suivantes = basculerTaille(tailles, id);
    setTailles(suivantes);
    enregistrerTailles(suivantes);
  };
  const changerPage = (id: WidgetId) => {
    const suivantes = pageSuivante(pages, id);
    setPages(suivantes);
    enregistrerPages(suivantes);
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
    const cible = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-widget]")?.dataset.widget as
      | WidgetId
      | undefined;
    if (cible && cible !== glisse) changer(deplacerVers(disposition, glisse, cible));
  };

  // Ce que montre chaque widget, calculé par son module.
  const apercus = new Map<WidgetId, ApercuWidget>();
  for (const id of disposition) {
    const module = MODULES[id];
    if (module) apercus.set(id, module.widget(props.donnees));
  }

  const urgents = new Set(disposition.filter((id) => apercus.get(id)?.urgent));
  const adaptations = lireAdaptations();
  const heure = new Date().getHours();
  const ordonnes = edition
    ? disposition
    : adaptations.accueilVivant
      ? ordreVivant(ordreAffichage(disposition, urgents), urgents, lireUsages(), heure, aujourdhui)
      : ordreAffichage(disposition, urgents);
  const visibles = pagesVisibles(disposition, pages);
  // En modification, toutes les pages restent là pour y ranger un widget.
  const lesPages = edition ? PAGES_ACCUEIL.map((p) => p.id) : visibles;

  // Le bilan du dimanche attend qu'on le regarde ; le mot du jour de Jarvis, une fois par jour au plus.
  const aApprendre = bilanDeLaSemaine(calculerApprentissages(props.donnees)).length;
  const bilanPret = bilanAOuvrir(aujourdhui, lireDernierBilan(), aApprendre);
  const remarque = adaptations.remarques ? remarqueDuJour({ ...props.donnees, membreId }) : null;
  const montrerRemarque = remarqueAMontrer(remarque?.cle ?? null, aujourdhui);
  const { prets, bientot } = widgetsAAjouter(disposition);

  const derniereSauvegarde = lireDerniereSauvegarde();
  const carte = carteDuJour({
    ...props.donnees,
    evenements: evenementsDe(props.donnees.agenda),
    factures: facturesDuJour(props.donnees.budget, aujourdhui, 1),
    sauvegardeDue: sauvegardeDue(derniereSauvegarde, aujourdhui) && new Date().getDay() === 0,
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

  const terminer = () => {
    setEdition(false);
    setGlisse(null);
  };

  // Les pages se feuillettent au doigt ; les onglets suivent, et y mènent d'un toucher.
  const suivrePage = () => {
    const zone = defilant.current;
    if (!zone) return;
    const i = Math.round(zone.scrollLeft / Math.max(zone.clientWidth, 1));
    const p = lesPages[Math.min(i, lesPages.length - 1)];
    if (p && p !== pageActive) setPageActive(p);
  };
  const allerPage = (p: PageAccueil) => {
    const zone = defilant.current;
    const i = lesPages.indexOf(p);
    if (!zone || i < 0) return;
    zone.scrollTo({ left: i * zone.clientWidth, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setPageActive(p);
  };
  useEffect(() => {
    if (!lesPages.includes(pageActive)) allerPage(PAGE_PRINCIPALE);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function widget(id: WidgetId, i: number): ReactNode {
    const c = apercus.get(id);
    if (!c) return null;
    const def = definition(id);
    const taille = tailleDe(tailles, id);
    const classes = `widget ${taille}${c.urgent && !edition ? " urgent" : ""}`;
    const corps: ReactNode = (
      <>
        <span className="widget-haut">
          <Icone nom={PICTOS[id]} taille={18} />
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
      const page = PAGES_ACCUEIL.find((p) => p.id === pageDe(pages, id))!;
      const suivante = PAGES_ACCUEIL[(PAGES_ACCUEIL.indexOf(page) + 1) % PAGES_ACCUEIL.length];
      return (
        <div
          key={id}
          data-widget={id}
          className={`${classes} en-edition${glisse === id ? " glisse" : ""}`}
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
          <button className="badge-widget page-widget" onClick={() => changerPage(id)} aria-label={`Envoyer ${def.titre} sur la page ${suivante.titre}`}>
            <Icone nom="deplacer" taille={14} />
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
      <header className="entete-accueil">
        <div className="entete-titres">
          <p className="entete-date">
            {date}
            {temps ? ` · ${temps}` : ""}
          </p>
          {/* Le bandeau du couple tient lieu de salutation ; le titre reste pour VoiceOver. */}
          <h1 className="cache-visuel">
            {salutation(heure)}
            {moi ? `, ${moi.prenom}` : ""}
          </h1>
        </div>
        {edition ? (
          <button className="bouton-termine" onClick={terminer}>Terminé</button>
        ) : (
          <div className="entete-boutons">
            <button className="bouton-icone" onClick={() => setRecherche(true)} aria-label="Chercher">
              <Icone nom="loupe" taille={21} />
            </button>
            <button className="bouton-icone avec-alerte" onClick={props.ouvrirRappels} aria-label={props.rappelsNonLus ? `Rappels, ${props.rappelsNonLus} nouveaux` : "Rappels"}>
              <Icone nom="cloche" taille={21} />
              {props.rappelsNonLus > 0 && <span className="alerte compte" aria-hidden>{props.rappelsNonLus}</span>}
            </button>
            <button
              className="avatar-reglages avec-alerte"
              style={moi ? { background: `color-mix(in srgb, ${moi.couleur} 26%, var(--surface))` } : undefined}
              onClick={props.ouvrirReglages}
              aria-label={props.nouvelleVersion ? "Réglages, nouvelle version disponible" : "Réglages"}
            >
              {moi ? moi.prenom.charAt(0) : <Icone nom="reglages" taille={20} />}
              {props.nouvelleVersion && <span className="alerte" aria-hidden />}
            </button>
          </div>
        )}
      </header>

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

      {!edition && <CarteAujourdhui carte={carte} toucher={toucherChose} cocher={(c) => void cocherChose(c)} voirTout={() => props.ouvrirModule("taches")} />}

      {lesPages.length > 1 && (
        <nav className="onglets-accueil" aria-label="Pages de l'accueil">
          {lesPages.map((p) => (
            <button key={p} className={p === pageActive ? "actif" : ""} aria-current={p === pageActive ? "page" : undefined} onClick={() => allerPage(p)}>
              {PAGES_ACCUEIL.find((x) => x.id === p)!.titre}
            </button>
          ))}
        </nav>
      )}

      <div className="pages-accueil" ref={defilant} onScroll={suivrePage} data-geste-propre>
        {lesPages.map((p) => {
          const ids = widgetsDeLaPage(ordonnes, pages, p);
          return (
            <section key={p} className="page-accueil" aria-label={PAGES_ACCUEIL.find((x) => x.id === p)!.titre}>
              <div className={`widgets${edition ? " en-edition" : ""}`}>{ids.map((id, i) => widget(id, i))}</div>
              {ids.length === 0 && (
                <div className="carte vide-tableau">
                  <p>{edition ? "Envoie un widget ici avec sa flèche." : "Cette page est vide."}</p>
                  {!edition && <button className="bouton-principal" onClick={() => setEdition(true)}>Ajouter des widgets</button>}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {edition && (
        <section className="ajout-widgets">
          <p className="discret aide-edition">Glisse un widget pour le déplacer. Les flèches changent sa taille ; l'autre flèche l'envoie sur la page suivante.</p>
          {prets.length > 0 && <h2 className="rayon">Ajouter</h2>}
          {prets.map((w) => (
            <button key={w.id} className="carte proposition" onClick={() => changer(ajouterWidget(disposition, w.id))}>
              <span className="pictogramme"><Icone nom={PICTOS[w.id]} taille={20} /></span>
              <span className="proposition-texte">
                <strong>{w.titre}</strong>
                <span className="discret">{w.description}</span>
              </span>
              <Icone nom="ajouter" taille={20} />
            </button>
          ))}
          {bientot.length > 0 && <h2 className="rayon">Bientôt</h2>}
          {bientot.map((w) => (
            <div key={w.id} className="carte proposition inactive">
              <span className="pictogramme"><Icone nom={PICTOS[w.id]} taille={20} /></span>
              <span className="proposition-texte">
                <strong>{w.titre}</strong>
                <span className="discret">{w.description}</span>
              </span>
            </div>
          ))}
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

      <Recherche ouverte={recherche} fermer={() => setRecherche(false)} donnees={props.donnees} aller={props.aller} />
    </main>
  );
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
 * Comme sur l'accueil de l'iPhone : tirer la page vers le bas depuis le haut ouvre la
 * recherche. Seulement quand la page est déjà tout en haut.
 */
function usePourChercher(actif: boolean, ouvrir: () => void) {
  const rappel = useRef(ouvrir);
  rappel.current = ouvrir;
  useEffect(() => {
    if (!actif) return;
    let depart: { x: number; y: number } | null = null;
    const debut = (e: TouchEvent) => {
      const cible = e.target instanceof Element ? e.target : null;
      depart = window.scrollY <= 0 && e.touches.length === 1 && !cible?.closest(".feuille, .barre-zone, input, textarea") ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    };
    const mouvement = (e: TouchEvent) => {
      if (!depart) return;
      const dy = e.touches[0].clientY - depart.y;
      const dx = Math.abs(e.touches[0].clientX - depart.x);
      if (dx > dy) depart = null;
      else if (dy > TIRER_POUR_CHERCHER && window.scrollY <= 0) {
        depart = null;
        vibrer();
        rappel.current();
      }
    };
    window.addEventListener("touchstart", debut, { passive: true });
    window.addEventListener("touchmove", mouvement, { passive: true });
    return () => {
      window.removeEventListener("touchstart", debut);
      window.removeEventListener("touchmove", mouvement);
    };
  }, [actif]);
}
