import { comptesIcloudDe, evenementsDe } from "../domaine/agenda";
import { lazy, Suspense, type ReactNode, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { meteoFraiche } from "../domaine/meteo";
import { rappelDuMatin } from "../domaine/rappels";
import { facturesDuJour } from "../domaine/budget";
import type { WidgetId } from "../domaine/tableauDeBord";
import type { Foyer } from "../domaine/types";
import type { DepotLocal } from "../donnees/depotLocal";
import { FournisseurAnnulation } from "./annulation";
import { CoinDev } from "./CoinDev";
import { Garde, Squelette } from "./Garde";
import { aPurger, trierCorbeille } from "../domaine/corbeille";
import { ignorer } from "./journal";
import { aujourdhuiLocal, choisirMembreCourant, lireMembreCourant } from "./contexte";
import { Accueil } from "./ecrans/Accueil";
import { Bienvenue } from "./ecrans/Bienvenue";
import { CalendrierIphone, icloudEnErreur } from "./ecrans/CalendrierIphone";
import { Siri, siriRelie } from "./ecrans/Siri";
import { Jarvis } from "./ecrans/Jarvis";
import { DetailListe } from "./ecrans/DetailListe";
import { Apparence, Reglages, Telephone } from "./ecrans/Reglages";
import { CentreRappels } from "./ecrans/CentreRappels";
import { demanderRepartition } from "./ecrans/Taches";
import { preparerDemande } from "./ecrans/Jarvis";
import { BarreJarvis, FournisseurSaisie } from "./pieces";
import { useEtatPartage } from "./etatPartage";
import { lireRappels } from "./centreRappels";
import { nonLus } from "../domaine/centreRappels";
import type { LieuBarre } from "../domaine/barre";
import { Icone } from "./Icone";
import type { MiseAJour } from "./miseAJour";
import { BORD_RETOUR, finRetour, gesteRetour } from "./gestes";
import { noter } from "./journal";
import { useMeteo } from "./meteo";
import { MODULES, prechargerPages, type DonneesModule } from "./modules";
import type { OngletMemoire } from "./ecrans/Memoire";
import type { ServicesPartage } from "./ecrans/Partage";
import { enregistrerPastilleVisible, lirePastilleVisible } from "./rapport";
import { afficherPastilleIcone, enregistrerPreferences, lirePreferences, mettreAJourRappels } from "./rappels";
import { planifierSynchro, synchroEnDirect } from "./synchroAuto";
import { avecTransition } from "./transitions";
import { useDonnees } from "./useDonnees";
import { demanderVisite } from "./visite";
import { definirFee, nomFee } from "./fee";

// Les pages qu'on ouvre rarement se chargent à leur première ouverture.
const PAGES_DIFFEREES = {
  Bilan: () => import("./ecrans/Bilan").then((m) => ({ default: m.Bilan })),
  Conseil: () => import("./ecrans/Conseil").then((m) => ({ default: m.Conseil })),
  LaFee: () => import("./ecrans/LaFee").then((m) => ({ default: m.LaFee })),
  Memoire: () => import("./ecrans/Memoire").then((m) => ({ default: m.Memoire })),
  NosMots: () => import("./ecrans/NosMots").then((m) => ({ default: m.NosMots })),
  Notifications: () => import("./ecrans/Notifications").then((m) => ({ default: m.Notifications })),
  Partage: () => import("./ecrans/Partage").then((m) => ({ default: m.Partage })),
  RetoursTest: () => import("./ecrans/RetoursTest").then((m) => ({ default: m.RetoursTest })),
  Sauvegarde: () => import("./ecrans/Sauvegarde").then((m) => ({ default: m.Sauvegarde })),
  Corbeille: () => import("./ecrans/Corbeille").then((m) => ({ default: m.Corbeille })),
};
const Bilan = lazy(PAGES_DIFFEREES.Bilan);
const Conseil = lazy(PAGES_DIFFEREES.Conseil);
const LaFee = lazy(PAGES_DIFFEREES.LaFee);
const Memoire = lazy(PAGES_DIFFEREES.Memoire);
const NosMots = lazy(PAGES_DIFFEREES.NosMots);
const Notifications = lazy(PAGES_DIFFEREES.Notifications);
const Partage = lazy(PAGES_DIFFEREES.Partage);
const RetoursTest = lazy(PAGES_DIFFEREES.RetoursTest);
const Sauvegarde = lazy(PAGES_DIFFEREES.Sauvegarde);
const Corbeille = lazy(PAGES_DIFFEREES.Corbeille);

// Pas de barre d'onglets : tout part du tableau de bord, chaque widget ouvre la
// page de son module, et chaque page a son retour vers la précédente.
type Page =
  | { nom: "accueil" }
  | { nom: "module"; id: WidgetId; onglet?: string }
  | { nom: "liste"; id: string }
  | { nom: "reglages" }
  | { nom: "partage" }
  | { nom: "notifications" }
  | { nom: "telephone" }
  | { nom: "apparence" }
  | { nom: "retours" }
  | { nom: "jarvis" }
  | { nom: "conseil" }
  | { nom: "memoire"; onglet?: OngletMemoire }
  | { nom: "mots" }
  | { nom: "bilan" }
  | { nom: "rappels" }
  | { nom: "sauvegarde" }
  | { nom: "corbeille" }
  | { nom: "calendrier" }
  | { nom: "siri" }
  | { nom: "fee" };

/** Une page de la pile, avec l'endroit où elle était défilée quand on en est parti. */
type Entree = Page & { defilement?: number };

// L'écran affiché, lu par le journal des retours de test à chaque geste.
let ecranCourant = "Accueil";
export const ecranAffiche = () => ecranCourant;

export function App({ depot, miseAJour, partage }: { depot: DepotLocal; miseAJour: MiseAJour; partage: ServicesPartage | null }) {
  const { pret, foyer, listes, elements, taches, retours, animaux, produits, catalogue, zones, souvenirs, couple, menus, agenda, budget, corbeille } = useDonnees(depot);
  // La météo sert au jardin et au bandeau de l'accueil. Trop ancienne (téléphone resté
  // hors ligne), elle ne déclenche plus d'alerte.
  const meteoLue = useMeteo(true);
  const meteo = meteoFraiche(meteoLue, new Date().toISOString()) ? meteoLue : null;
  const [pile, setPile] = useState<Entree[]>([{ nom: "accueil" }]);
  const [membreId, setMembreId] = useState<string | null>(lireMembreCourant);
  const nouvelleVersion = useSyncExternalStore(miseAJour.abonner, miseAJour.prete);
  const [pastille, setPastille] = useState(lirePastilleVisible);

  const synchro = partage?.synchro;
  const etatPartage = useEtatPartage(depot, synchro ?? null);
  // La cloche : ce que Kora a envoyé et pas encore relu, recompté au retour dans l'app.
  const [rappelsNonLus, setRappelsNonLus] = useState(0);
  useEffect(() => {
    const compter = () => void lireRappels(aujourdhuiLocal()).then((j) => setRappelsNonLus(nonLus(j)));
    compter();
    document.addEventListener("visibilitychange", compter);
    return () => document.removeEventListener("visibilitychange", compter);
  }, [pile.length]);
  const partageActif = useSyncExternalStore(synchro?.abonner ?? sansAbonnement, () => (synchro?.statut().etat ?? "inactif") !== "inactif");
  useEffect(() => (synchro ? planifierSynchro(synchro, depot) : undefined), [synchro, depot]);

  const foyerPartage = partageActif && foyer ? foyer.id : null;
  // Ce que l'autre iPhone change arrive à l'instant.
  useEffect(
    () => (partage && foyerPartage ? synchroEnDirect(partage.synchro, (r) => partage.tempsReel.ecouterFoyer(foyerPartage, r)) : undefined),
    [partage, foyerPartage],
  );

  // Le serveur des rappels sait qui utilise ce téléphone, même après un changement dans Réglages.
  const membreRappels = foyer?.membres.some((m) => m.id === membreId) ? membreId : null;
  useEffect(() => {
    if (partage && foyerPartage) mettreAJourRappels(partage.rappels, foyerPartage, membreRappels, lirePreferences()).catch(ignorer);
  }, [partage, foyerPartage, membreRappels]);

  // La pastille de l'icône suit ce qui presse pour la personne de ce téléphone, mis à jour à chaque changement.
  const aujourdhui = aujourdhuiLocal();
  useEffect(() => {
    if (!pret) return;
    const rappel = rappelDuMatin({ foyer, membreId: membreRappels, factures: facturesDuJour(budget, aujourdhui), taches, animaux, produits, zones, meteo, aujourdhui, preferences: lirePreferences() });
    afficherPastilleIcone(rappel?.nombre ?? 0);
  }, [pret, foyer, membreRappels, budget, taches, animaux, produits, zones, meteo, aujourdhui]);

  // La corbeille se vide seule de ce qui a plus de trente jours, une fois par ouverture.
  const corbeilleLue = useRef(false);
  useEffect(() => {
    if (!pret || corbeilleLue.current) return;
    corbeilleLue.current = true;
    const vieilles = aPurger(corbeille, new Date().toISOString());
    if (vieilles.length) depot.viderCorbeille(vieilles.map((e) => e.id)).catch(ignorer);
  }, [pret, corbeille, depot]);

  // Une fois l'accueil affiché, les autres pages se chargent en silence : la suivante s'ouvre aussitôt.
  useEffect(() => {
    if (!pret) return;
    const precharger = () => {
      prechargerPages();
      for (const charger of Object.values(PAGES_DIFFEREES)) void charger().catch(ignorer);
    };
    const id = setTimeout(precharger, 1500);
    return () => clearTimeout(id);
  }, [pret]);

  const page = pile[pile.length - 1];
  // Le glissement du doigt anime déjà la page : sans transition dans ce cas-là.
  const revenir = () => setPile((avant) => (avant.length > 1 ? avant.slice(0, -1) : avant));
  // Comme sur l'iPhone, une page retrouvée est défilée là où on l'avait laissée ; une nouvelle page part du haut.
  useLayoutEffect(() => {
    window.scrollTo(0, page.defilement ?? 0);
  }, [pile.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // Le widget d'où vient la page du dessus : elle y rentre au retour (transitions.ts).
  const widgetOuvert = useRef<string | null>(null);
  const revenirAnime = () => {
    const widget = pile.length === 2 ? widgetOuvert.current : null;
    widgetOuvert.current = null;
    avecTransition(
      "arriere",
      revenir,
      widget ? { depart: () => document.querySelector(".page-dessus"), arrivee: () => document.querySelector(`.page-dessus [data-widget="${widget}"]`) } : undefined,
    );
  };
  const glissement = useGlissementRetour(pile.length > 1, revenir);
  const nomEcran = !pret ? "Chargement" : !foyer ? "Bienvenue" : nommer(page);
  ecranCourant = nomEcran;
  useEffect(() => {
    if (pret) noter("ecran", nomEcran, nomEcran);
  }, [pret, nomEcran]);

  function libelle(p: Page): string {
    if (p.nom === "accueil") return "Accueil";
    if (p.nom === "reglages") return "Réglages";
    if (p.nom === "retours") return "Retours de test";
    if (p.nom === "partage") return "Partage";
    if (p.nom === "notifications") return "Notifications";
    if (p.nom === "telephone") return "Ce téléphone";
    if (p.nom === "apparence") return "Apparence";
    if (p.nom === "jarvis") return nomFee();
    if (p.nom === "conseil") return "Conseil";
    if (p.nom === "memoire") return `Ce que ${nomFee()} sait`;
    if (p.nom === "mots") return "Nos mots";
    if (p.nom === "bilan") return "Bilan";
    if (p.nom === "rappels") return "Rappels";
    if (p.nom === "sauvegarde") return "Sauvegarde";
    if (p.nom === "corbeille") return "Corbeille";
    if (p.nom === "calendrier") return "Calendrier de l'iPhone";
    if (p.nom === "siri") return "Siri";
    if (p.nom === "fee") return `Réglages de ${nomFee()}`;
    if (p.nom === "module") return p.id === "courses" && p.onglet === "listes" ? "Listes" : (MODULES[p.id]?.libelle ?? "Retour");
    return listes.find((l) => l.id === p.id)?.nom ?? "Liste";
  }
  /** Le nom de l'écran tel qu'il apparaît dans les notes et le journal. */
  function nommer(p: Page): string {
    return p.nom === "liste" ? `Liste ${libelle(p)}` : libelle(p);
  }

  const bandeauVersion = nouvelleVersion && (
    <div className="bandeau-version" role="status">
      <span>Nouvelle version prête.</span>
      <button className="bouton-principal" onClick={() => void miseAJour.appliquer()}>Mettre à jour</button>
    </div>
  );

  if (!pret) return null;
  if (!foyer) {
    // Sur un téléphone pas encore relié aussi, la nouvelle version doit pouvoir s'installer.
    return (
      <>
        <Bienvenue depot={depot} onCree={setMembreId} rejoindre={partage ? (code) => rejoindreAvecCode(partage, code) : null} />
        {bandeauVersion}
      </>
    );
  }

  const membre = foyer.membres.some((m) => m.id === membreId) ? membreId : null;
  // Après avoir rejoint un foyer, ce téléphone ne sait pas encore qui l'utilise.
  if (!membre && foyer.membres.length > 1) {
    return (
      <ChoixMembre
        foyer={foyer}
        choisir={(id) => {
          choisirMembreCourant(id);
          setMembreId(id);
        }}
      />
    );
  }
  // Tael ou Navi : la fée suit la personne de ce téléphone.
  definirFee(foyer.membres.find((m) => m.id === membre)?.prenom);
  const donnees: DonneesModule = { foyer, membreId: membre, listes, elements, taches, animaux, produits, catalogue, zones, meteo, aujourdhui: aujourdhuiLocal(), souvenirs, retours, couple, menus, agenda, budget };

  const ouvrir = (demandee: Page) => {
    // Le widget Listes ouvre l'onglet des listes de Courses, Entretien celui de Tâches.
    const vers = demandee.nom === "module" ? MODULES[demandee.id]?.ouvre : undefined;
    const p: Page = vers ? { nom: "module", id: vers.id, onglet: vers.onglet } : demandee;
    // Depuis l'accueil, le widget touché grandit jusqu'à devenir sa page.
    const widget = pile.length === 1 && demandee.nom === "module" ? demandee.id : null;
    const depuisWidget = widget ? document.querySelector(`.page-dessus [data-widget="${widget}"]`) : null;
    widgetOuvert.current = depuisWidget ? widget : null;
    avecTransition(
      "avant",
      () => {
        const defilement = window.scrollY;
        setPile((avant) => [...avant.slice(0, -1), { ...avant[avant.length - 1], defilement }, p]);
      },
      depuisWidget ? { depart: () => depuisWidget, arrivee: () => document.querySelector(".page-dessus") } : undefined,
    );
  };
  /** Change l'onglet de la page du dessus, gardé dans la pile comme sa position. */
  const changerOnglet = (onglet: string | undefined) =>
    setPile((avant) => {
      const haut = avant[avant.length - 1];
      return haut.nom === "module" ? [...avant.slice(0, -1), { ...haut, onglet }] : avant;
    });
  const ouvrirListe = (id: string) => ouvrir({ nom: "liste", id });
  const ouvertes = retours.filter((r) => !r.regleLe).length;

  const leFoyer: Foyer = foyer;
  /** L'heure du rappel de ce téléphone, apprise au bilan : retenue ici et dite au serveur des rappels. */
  const changerHeureRappel = async (heure: number) => {
    const preferences = { ...lirePreferences(), heure };
    enregistrerPreferences(preferences);
    if (partage && foyerPartage) await mettreAJourRappels(partage.rappels, foyerPartage, membre, preferences).catch(ignorer);
  };
  const jarvisPartage = partage && foyerPartage ? { serveur: partage.jarvis, foyerId: foyerPartage } : null;
  const agendaPartage = partage && foyerPartage ? { serveur: partage.agenda, foyerId: foyerPartage } : null;
  // Chaque page de la pile et son écran ; une page oubliée ici est une erreur de types.
  const ECRANS: { [N in Page["nom"]]: (page: Extract<Page, { nom: N }>) => ReactNode } = {
    accueil: () => (
      <Accueil
        donnees={donnees}
        ouvrirModule={(id) => ouvrir({ nom: "module", id })}
        ouvrirJarvis={() => ouvrir({ nom: "jarvis" })}
        ouvrirReglages={() => ouvrir({ nom: "reglages" })}
        ouvrirMots={() => ouvrir({ nom: "mots" })}
        ouvrirBilan={() => ouvrir({ nom: "bilan" })}
        ouvrirRappels={() => ouvrir({ nom: "rappels" })}
        ouvrirSauvegarde={() => ouvrir({ nom: "sauvegarde" })}
        ouvrirNotifications={() => ouvrir({ nom: "notifications" })}
        ouvrirPartage={() => ouvrir({ nom: "partage" })}
        synchroniser={synchro && partageActif ? () => synchro.synchroniser() : undefined}
        ouvrirRepartition={() => {
          demanderRepartition();
          ouvrir({ nom: "module", id: "taches" });
        }}
        aller={(ou) => ouvrir(ou.type === "module" ? { nom: "module", id: ou.id } : ou.type === "liste" ? { nom: "liste", id: ou.id } : { nom: "memoire" })}
        depot={depot}
        jarvis={jarvisPartage}
        nouvelleVersion={nouvelleVersion}
        partage={etatPartage}
        rappelsNonLus={rappelsNonLus}
        auDessus={pile.length === 1}
      />
    ),
    module: (page) => MODULES[page.id]?.page?.({
      ...donnees,
      depot,
      ouvrirListe,
      jarvis: jarvisPartage,
      agendaDistant: agendaPartage,
      ouvrirPartage: () => ouvrir({ nom: "partage" }),
      ouvrirCalendrier: () => ouvrir({ nom: "calendrier" }),
      onglet: page.onglet,
      changerOnglet,
    }),
    liste: (page) => {
      const liste = listes.find((l) => l.id === page.id);
      return liste ? (
        <DetailListe depot={depot} foyer={leFoyer} membreId={membre} liste={liste} elements={elements} catalogue={catalogue} />
      ) : (
        <main><p className="vide">Cette liste n'existe plus.</p></main>
      );
    },
    reglages: () => (
      <Reglages
        foyer={leFoyer}
        membreId={membre}
        ouvrirTelephone={() => ouvrir({ nom: "telephone" })}
        verifierMiseAJour={miseAJour.verifier}
        nouvelleVersion={nouvelleVersion}
        appliquerMiseAJour={() => void miseAJour.appliquer()}
        notesOuvertes={ouvertes}
        ouvrirRetours={() => ouvrir({ nom: "retours" })}
        ouvrirPartage={() => ouvrir({ nom: "partage" })}
        ouvrirNotifications={() => ouvrir({ nom: "notifications" })}
        ouvrirAppris={() => ouvrir({ nom: "memoire" })}
        ouvrirApparence={() => ouvrir({ nom: "apparence" })}
        ouvrirSauvegarde={() => ouvrir({ nom: "sauvegarde" })}
        ouvrirCorbeille={() => ouvrir({ nom: "corbeille" })}
        corbeille={trierCorbeille(corbeille, donnees.aujourdhui + "T23:59:59.000Z").length}
        ouvrirCalendrier={() => ouvrir({ nom: "calendrier" })}
        ouvrirSiri={() => ouvrir({ nom: "siri" })}
        ouvrirFee={() => ouvrir({ nom: "fee" })}
        siri={siriRelie() ? "Relié" : "Pas relié"}
        revoirVisite={() => {
          demanderVisite();
          avecTransition("arriere", () => setPile((avant) => avant.slice(0, 1)));
        }}
        calendrier={comptesIcloudDe(agenda).some((c) => c.membre === membre) ? "Relié" : "Pas relié"}
        calendrierEnErreur={icloudEnErreur(comptesIcloudDe(agenda), membre)}
        etatPartage={etatPartage}
        partage={!partage ? "indisponible" : partageActif ? "actif" : "inactif"}
        pastilleVisible={pastille}
        changerPastille={(visible) => {
          enregistrerPastilleVisible(visible);
          setPastille(visible);
        }}
      />
    ),
    telephone: () => (
      <Telephone
        foyer={leFoyer}
        membreId={membre}
        choisir={(id) => {
          choisirMembreCourant(id);
          setMembreId(id);
        }}
      />
    ),
    apparence: () => <Apparence />,
    partage: () => <Partage services={partage} foyer={leFoyer} />,
    notifications: () => (
      <Notifications
        serveur={partage?.rappels ?? null}
        foyerId={foyerPartage}
        membreId={membre}
        ouvrirPartage={() => ouvrir({ nom: "partage" })}
        foyer={leFoyer}
        taches={taches}
        evenements={evenementsDe(agenda)}
        factures={facturesDuJour(budget, donnees.aujourdhui)}
        animaux={animaux}
        produits={produits}
        zones={zones}
        meteo={meteo}
        aujourdhui={donnees.aujourdhui}
      />
    ),
    jarvis: () => (
      <Jarvis
        donnees={donnees}
        depot={depot}
        serveur={partage?.jarvis ?? null}
        foyerPartage={foyerPartage}
        ouvrirPartage={() => ouvrir({ nom: "partage" })}
        ouvrirConseil={() => ouvrir({ nom: "conseil" })}
        ouvrirMemoire={() => ouvrir({ nom: "memoire" })}
      />
    ),
    conseil: () => (partage && foyerPartage ? <Conseil donnees={donnees} depot={depot} serveur={partage.jarvis} foyerPartage={foyerPartage} /> : ECRANS.jarvis({ nom: "jarvis" })),
    memoire: (page) => <Memoire donnees={donnees} depot={depot} ouvrirBilan={() => ouvrir({ nom: "bilan" })} onglet={page.onglet} />,
    bilan: () => <Bilan depot={depot} donnees={donnees} changerHeureRappel={changerHeureRappel} ouvrirAppris={() => ouvrir({ nom: "memoire" })} />,
    mots: () => {
      const notifier =
        partage && foyerPartage ? (m: { id: string; de: string | null; texte: string }) => partage.rappels.notifierMot({ foyerId: foyerPartage, id: m.id, de: m.de, texte: m.texte }) : null;
      return <NosMots donnees={donnees} depot={depot} notifier={notifier} />;
    },
    rappels: () => <CentreRappels ouvrirNotifications={() => ouvrir({ nom: "notifications" })} />,
    sauvegarde: () => <Sauvegarde depot={depot} aujourdhui={donnees.aujourdhui} contenu={{ foyer: leFoyer, listes, elements, taches, animaux, produits, catalogue, zones, souvenirs, couple, menus, agenda, budget, retours }} />,
    corbeille: () => <Corbeille depot={depot} foyer={leFoyer} corbeille={corbeille} />,
    calendrier: () => <CalendrierIphone foyer={leFoyer} membreId={membre} comptes={comptesIcloudDe(agenda)} distant={agendaPartage} ouvrirPartage={() => ouvrir({ nom: "partage" })} />,
    fee: () => <LaFee />,
    siri: () => <Siri foyer={leFoyer} membreId={membre} distant={jarvisPartage} ouvrirPartage={() => ouvrir({ nom: "partage" })} />,
    retours: () => <RetoursTest depot={depot} foyer={leFoyer} retours={retours} partageActif={partageActif} />,
  };
  const ecranDe = (page: Page) => (ECRANS[page.nom] as (p: Page) => ReactNode)(page);
  // Chaque page sous son filet : une erreur ou un code qui ne se charge pas ne laisse pas l'écran vide.
  const ecranGarde = (page: Page, i: number) => (
    <Garde key={`${i}-${page.nom}`} revenirALAccueil={i > 0 ? () => avecTransition("arriere", () => setPile((avant) => avant.slice(0, 1))) : null}>
      <Suspense fallback={<Squelette />}>{ecranDe(page)}</Suspense>
    </Garde>
  );

  // La fée, sur l'accueil, chaque module, chaque liste, la mémoire et Nos mots : là où l'on
  // ajoute quelque chose. Les réglages et la conversation ont leurs propres champs.
  // Sur l'onglet Entretien ou Autres listes, la phrase va à cet onglet.
  // Dans Cuisine et Maison, l'onglet Frigo, Mitsu ou Jardin reçoit la phrase comme sa page d'avant.
  const ongletBarre =
    page.nom === "module" && (page.onglet === "entretien" || page.onglet === "administratif" || page.onglet === "listes" || page.onglet === "mitsu" || page.onglet === "jardin")
      ? page.onglet
      : page.nom === "module" && page.onglet === "frigo"
        ? "stock"
        : null;
  const lieuBarre: LieuBarre | null =
    page.nom === "accueil" ? "accueil" : page.nom === "module" ? (ongletBarre ?? page.id) : page.nom === "liste" || page.nom === "memoire" || page.nom === "mots" ? page.nom : null;
  const cleBarre = page.nom === "module" ? `module:${page.id}${ongletBarre ? `:${ongletBarre}` : ""}` : page.nom === "liste" ? `liste:${page.id}` : page.nom;
  const coinDev = pastille && !nouvelleVersion && page.nom !== "retours" && (
    <CoinDev depot={depot} ecran={nomEcran} membreId={membre} ouvertes={ouvertes} voirRetours={() => ouvrir({ nom: "retours" })} />
  );

  // Toutes les pages de la pile restent montées, comme sur l'iPhone : celle d'en dessous
  // garde son état et apparaît sous le doigt quand on glisse pour revenir.
  return (
    <FournisseurAnnulation>
    <FournisseurSaisie>
    {pile.map((p, i) => {
      const dessus = i === pile.length - 1;
      const avant = i > 0 ? pile[i - 1] : null;
      const retour = avant && (
        <button className="retour" onClick={dessus ? revenirAnime : undefined} tabIndex={dessus ? undefined : -1}>
          <Icone nom="retour" taille={22} />
          {libelle(avant)}
        </button>
      );
      if (!dessus) {
        const visible = i === pile.length - 2 && glissement;
        return (
          <div
            key={`${i}-${p.nom}`}
            className={`contenu page-dessous${visible ? " visible" : ""}`}
            style={{ top: -(p.defilement ?? 0) }}
            aria-hidden
            inert
          >
            {retour}
            {ecranGarde(p, i)}
          </div>
        );
      }
      return (
    <div
      key={`${i}-${p.nom}`}
      className={`contenu page-dessus${glissement ? " retour-glisse" : ""}`}
    >
      {retour}
      {ecranGarde(p, i)}
      {bandeauVersion}
    </div>
      );
    })}
    {lieuBarre ? (
      <BarreJarvis
        cle={cleBarre}
        lieu={lieuBarre}
        liste={page.nom === "liste" ? (listes.find((l) => l.id === page.id) ?? null) : null}
        donnees={donnees}
        depot={depot}
        jarvis={jarvisPartage}
        demanderAJarvis={(demande) => {
          preparerDemande(demande);
          ouvrir({ nom: "jarvis" });
        }}
        ouvrirPage={(ou) => ouvrir(ou === "mots" ? { nom: "mots" } : ou === "reglages" ? { nom: "reglages" } : { nom: "module", id: ou })}
      />
    ) : null}
    {coinDev}
    </FournisseurSaisie>
    </FournisseurAnnulation>
  );
}

/**
 * Comme sur l'iPhone (iOS 26) : glisser vers la droite, depuis le bord ou depuis le milieu de
 * la page, ramène à la page précédente. La page suit le doigt et laisse voir celle d'en
 * dessous, puis part vers la droite ou revient en place. Une ligne qu'on glisse, une bande
 * qui défile de côté ou un champ gardent leur geste, sauf depuis le bord.
 */
/** Ce qui a déjà son propre geste de côté. */
const ZONES_A_GESTE = ".glissable.ouverte, .defilant, input, textarea, select, [data-geste-propre]";

function useGlissementRetour(actif: boolean, revenir: () => void) {
  // Pendant le geste, la page suit le doigt sans repasser par React : seules l'entrée et la
  // sortie du geste changent l'état, le reste s'écrit directement sur les deux pages, une
  // fois par image. Sinon chaque mouvement redessinait toute la pile et la page saccadait.
  const [glisse, setGlisse] = useState(false);
  const rappel = useRef(revenir);
  rappel.current = revenir;

  useEffect(() => {
    if (!actif) return;
    let geste: { x: number; y: number; t: number; horizontal: boolean; dx: number; bord: boolean } | null = null;
    let image = 0;
    let fini = false;
    const largeur = () => window.innerWidth;
    const pages = () => ({
      dessus: document.querySelector<HTMLElement>(".contenu.page-dessus"),
      dessous: [...document.querySelectorAll<HTMLElement>(".contenu.page-dessous")].pop() ?? null,
    });
    const placer = (dx: number) => {
      const { dessus, dessous } = pages();
      const progression = Math.min(1, dx / Math.max(largeur(), 1));
      if (dessus) dessus.style.transform = dx ? `translateX(${dx}px)` : "";
      if (dessous) {
        dessous.style.transform = `translateX(${(progression - 1) * 28}%)`;
        dessous.style.filter = `brightness(${0.7 + 0.3 * progression})`;
      }
    };
    const animer = (oui: boolean) => {
      const { dessus, dessous } = pages();
      for (const el of [dessus, dessous]) el?.classList.toggle("retour-anime", oui);
    };
    const effacer = () => {
      const { dessus, dessous } = pages();
      for (const el of [dessus, dessous]) {
        if (!el) continue;
        el.classList.remove("retour-anime");
        el.style.transform = "";
        el.style.filter = "";
      }
    };
    const debut = (e: PointerEvent) => {
      if (fini) return;
      const cible = e.target instanceof Element ? e.target : null;
      const libre = e.clientX <= BORD_RETOUR || !cible?.closest(ZONES_A_GESTE);
      geste = libre && e.isPrimary && !document.documentElement.classList.contains("feuille-ouverte")
        ? { x: e.clientX, y: e.clientY, t: e.timeStamp, horizontal: false, dx: 0, bord: e.clientX <= BORD_RETOUR }
        : null;
    };
    const mouvement = (e: PointerEvent) => {
      if (!geste) return;
      const dx = e.clientX - geste.x;
      if (!geste.horizontal) {
        const sens = gesteRetour(dx, e.clientY - geste.y, geste.bord);
        if (sens === "autre") geste = null;
        if (sens !== "retour" || !geste) return;
        geste.horizontal = true;
        // On repart de la position actuelle du doigt : la page ne saute pas des 8 px du seuil.
        geste.x = e.clientX;
        flushSync(() => setGlisse(true));
        // La page d'en dessous apparaît déjà décalée et assombrie, sans une image à sa place.
        placer(0);
      }
      geste.dx = Math.max(0, e.clientX - geste.x);
      cancelAnimationFrame(image);
      const position = geste.dx;
      image = requestAnimationFrame(() => placer(position));
    };
    // Une fois le geste parti de côté, la page ne défile plus en même temps : sur l'iPhone, ce
    // défilement interrompait le geste et la page revenait d'un coup en place.
    const toucher = (e: TouchEvent) => {
      if (geste?.horizontal && e.cancelable) e.preventDefault();
    };
    const fin = (e: PointerEvent) => {
      const g = geste;
      geste = null;
      if (!g?.horizontal) return;
      cancelAnimationFrame(image);
      const dx = e.type === "pointerup" ? Math.max(0, e.clientX - g.x) : g.dx;
      const part = finRetour(dx, e.timeStamp - g.t, largeur(), g.bord);
      placer(dx);
      // Une image plus tard, pour que l'animation parte bien de la position du doigt.
      requestAnimationFrame(() => {
        animer(true);
        placer(part ? largeur() : 0);
      });
      fini = true;
      setTimeout(() => {
        effacer();
        fini = false;
        if (part) {
          flushSync(() => {
            rappel.current();
            setGlisse(false);
          });
          noter("geste", "Glisser pour revenir", ecranCourant);
        } else {
          setGlisse(false);
        }
      }, DUREE_RETOUR_MS + 20);
    };
    window.addEventListener("pointerdown", debut);
    window.addEventListener("pointermove", mouvement);
    window.addEventListener("pointerup", fin);
    window.addEventListener("pointercancel", fin);
    window.addEventListener("touchmove", toucher, { passive: false });
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener("pointerdown", debut);
      window.removeEventListener("pointermove", mouvement);
      window.removeEventListener("pointerup", fin);
      window.removeEventListener("pointercancel", fin);
      window.removeEventListener("touchmove", toucher);
    };
  }, [actif]);

  return glisse;
}

/** La durée de la fin du geste, accordée à `.retour-anime` dans styles/pieces.css. */
const DUREE_RETOUR_MS = 220;

const sansAbonnement = () => () => {};

/** Le code du foyer suffit : une session sans compte s'ouvre, puis les données du foyer arrivent. */
async function rejoindreAvecCode({ compte, synchro }: ServicesPartage, code: string): Promise<void> {
  if (!(await compte.connecte())) await compte.entrerSansCompte();
  await synchro.rejoindre(await compte.rejoindreFoyer(code));
}

function ChoixMembre({ foyer, choisir }: { foyer: Foyer; choisir: (id: string) => void }) {
  return (
    <main className="bienvenue">
      <div className="monogramme" aria-hidden>KH</div>
      <h1>{foyer.nom}</h1>
      <p className="discret">Qui utilise ce téléphone ? Le choix se verrouille ensuite, et se change dans Réglages.</p>
      <ul className="carte groupe choix-membre">
        {foyer.membres.map((m) => (
          <li key={m.id}>
            <button className="ligne" onClick={() => choisir(m.id)}>
              <span className="initiale" style={{ background: m.couleur }}>{m.prenom.charAt(0)}</span>
              <span className="ligne-texte">{m.prenom}</span>
              <span className="chevron"><Icone nom="suivant" taille={18} /></span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
