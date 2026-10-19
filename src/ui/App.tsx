import { comptesIcloudDe, evenementsDe } from "../domaine/agenda";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { meteoFraiche } from "../domaine/meteo";
import { rappelDuMatin } from "../domaine/rappels";
import { facturesDuJour } from "../domaine/budget";
import type { WidgetId } from "../domaine/tableauDeBord";
import type { Foyer } from "../domaine/types";
import type { DepotLocal } from "../donnees/depotLocal";
import { FournisseurAnnulation } from "./annulation";
import { CoinDev } from "./CoinDev";
import { aujourdhuiLocal, choisirMembreCourant, lireMembreCourant } from "./contexte";
import { Accueil } from "./ecrans/Accueil";
import { Bienvenue } from "./ecrans/Bienvenue";
import { Conseil } from "./ecrans/Conseil";
import { Bilan } from "./ecrans/Bilan";
import { CeQueKoraSait } from "./ecrans/CeQueKoraSait";
import { CalendrierIphone, icloudEnErreur } from "./ecrans/CalendrierIphone";
import { MemoireJarvis } from "./ecrans/MemoireJarvis";
import { NosMots } from "./ecrans/NosMots";
import { Jarvis } from "./ecrans/Jarvis";
import { DetailListe } from "./ecrans/DetailListe";
import { Notifications } from "./ecrans/Notifications";
import { Partage, type ServicesPartage } from "./ecrans/Partage";
import { Reglages, Telephone } from "./ecrans/Reglages";
import { RetoursTest } from "./ecrans/RetoursTest";
import { CentreRappels } from "./ecrans/CentreRappels";
import { Sauvegarde } from "./ecrans/Sauvegarde";
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
import { MODULES, type DonneesModule } from "./modules";
import { enregistrerPastilleVisible, lirePastilleVisible } from "./rapport";
import { afficherPastilleIcone, enregistrerPreferences, lirePreferences, mettreAJourRappels } from "./rappels";
import { planifierSynchro, synchroEnDirect } from "./synchroAuto";
import { avecTransition } from "./transitions";
import { useDonnees } from "./useDonnees";
import { demanderVisite } from "./visite";

// Pas de barre d'onglets : tout part du tableau de bord, chaque widget ouvre la
// page de son module, et chaque page a son retour vers la précédente.
type Page =
  | { nom: "accueil" }
  | { nom: "module"; id: WidgetId }
  | { nom: "liste"; id: string }
  | { nom: "reglages" }
  | { nom: "partage" }
  | { nom: "notifications" }
  | { nom: "telephone" }
  | { nom: "retours" }
  | { nom: "jarvis" }
  | { nom: "conseil" }
  | { nom: "memoire" }
  | { nom: "mots" }
  | { nom: "bilan" }
  | { nom: "appris" }
  | { nom: "rappels" }
  | { nom: "sauvegarde" }
  | { nom: "calendrier" };

/** Une page de la pile, avec l'endroit où elle était défilée quand on en est parti. */
type Entree = Page & { defilement?: number };

// L'écran affiché, lu par le journal des retours de test à chaque geste.
let ecranCourant = "Accueil";
export const ecranAffiche = () => ecranCourant;

export function App({ depot, miseAJour, partage }: { depot: DepotLocal; miseAJour: MiseAJour; partage: ServicesPartage | null }) {
  const { pret, foyer, listes, elements, taches, retours, animaux, produits, catalogue, zones, souvenirs, couple, menus, agenda, budget } = useDonnees(depot);
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
    if (partage && foyerPartage) mettreAJourRappels(partage.rappels, foyerPartage, membreRappels, lirePreferences()).catch(() => {});
  }, [partage, foyerPartage, membreRappels]);

  // La pastille de l'icône suit ce qui presse pour la personne de ce téléphone, mis à jour à chaque changement.
  const aujourdhui = aujourdhuiLocal();
  useEffect(() => {
    if (!pret) return;
    const rappel = rappelDuMatin({ foyer, membreId: membreRappels, factures: facturesDuJour(budget, aujourdhui), taches, animaux, produits, zones, meteo, aujourdhui, preferences: lirePreferences() });
    afficherPastilleIcone(rappel?.nombre ?? 0);
  }, [pret, foyer, membreRappels, taches, animaux, produits, zones, meteo, aujourdhui]);

  const page = pile[pile.length - 1];
  // Le glissement du doigt anime déjà la page : sans transition dans ce cas-là.
  const revenir = () => setPile((avant) => (avant.length > 1 ? avant.slice(0, -1) : avant));
  // Comme sur l'iPhone, une page retrouvée est défilée là où on l'avait laissée ; une nouvelle page part du haut.
  useLayoutEffect(() => {
    window.scrollTo(0, page.defilement ?? 0);
  }, [pile.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const revenirAnime = () => avecTransition("arriere", revenir);
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
    if (p.nom === "jarvis") return "Jarvis";
    if (p.nom === "conseil") return "Conseil";
    if (p.nom === "memoire") return "Mémoire de Jarvis";
    if (p.nom === "mots") return "Nos mots";
    if (p.nom === "bilan") return "Bilan";
    if (p.nom === "appris") return "Ce que Kora sait";
    if (p.nom === "rappels") return "Rappels";
    if (p.nom === "sauvegarde") return "Sauvegarde";
    if (p.nom === "calendrier") return "Calendrier de l'iPhone";
    if (p.nom === "module") return MODULES[p.id]?.libelle ?? "Retour";
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
  const donnees: DonneesModule = { foyer, membreId: membre, listes, elements, taches, animaux, produits, catalogue, zones, meteo, aujourdhui: aujourdhuiLocal(), souvenirs, retours, couple, menus, agenda, budget };

  const ouvrir = (p: Page) =>
    avecTransition("avant", () => {
      const defilement = window.scrollY;
      setPile((avant) => [...avant.slice(0, -1), { ...avant[avant.length - 1], defilement }, p]);
    });
  const ouvrirListe = (id: string) => ouvrir({ nom: "liste", id });
  const ouvertes = retours.filter((r) => !r.regleLe).length;

  const leFoyer: Foyer = foyer;
  /** L'heure du rappel de ce téléphone, apprise au bilan : retenue ici et dite au serveur des rappels. */
  const changerHeureRappel = async (heure: number) => {
    const preferences = { ...lirePreferences(), heure };
    enregistrerPreferences(preferences);
    if (partage && foyerPartage) await mettreAJourRappels(partage.rappels, foyerPartage, membre, preferences).catch(() => {});
  };
  const jarvisPartage = partage && foyerPartage ? { serveur: partage.jarvis, foyerId: foyerPartage } : null;
  const agendaPartage = partage && foyerPartage ? { serveur: partage.agenda, foyerId: foyerPartage } : null;
  function ecranDe(page: Page) {
  let ecran;
  if (page.nom === "accueil") {
    ecran = (
      <Accueil
        donnees={donnees}
        ouvrirModule={(id) => ouvrir({ nom: "module", id })}
        ouvrirReglages={() => ouvrir({ nom: "reglages" })}
        ouvrirMots={() => ouvrir({ nom: "mots" })}
        ouvrirBilan={() => ouvrir({ nom: "bilan" })}
        ouvrirRappels={() => ouvrir({ nom: "rappels" })}
        ouvrirSauvegarde={() => ouvrir({ nom: "sauvegarde" })}
        ouvrirPartage={() => ouvrir({ nom: "partage" })}
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
    );
  } else if (page.nom === "module") {
    ecran = MODULES[page.id]?.page({ ...donnees, depot, ouvrirListe, jarvis: jarvisPartage, agendaDistant: agendaPartage });
  } else if (page.nom === "liste") {
    const liste = listes.find((l) => l.id === page.id);
    ecran = liste ? (
      <DetailListe depot={depot} foyer={leFoyer} membreId={membre} liste={liste} elements={elements} catalogue={catalogue} />
    ) : (
      <main><p className="vide">Cette liste n'existe plus.</p></main>
    );
  } else if (page.nom === "partage") {
    ecran = <Partage services={partage} foyer={leFoyer} />;
  } else if (page.nom === "notifications") {
    ecran = (
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
    );
  } else if (page.nom === "telephone") {
    ecran = (
      <Telephone
        foyer={leFoyer}
        membreId={membre}
        choisir={(id) => {
          choisirMembreCourant(id);
          setMembreId(id);
        }}
      />
    );
  } else if (page.nom === "conseil" && partage && foyerPartage) {
    ecran = <Conseil donnees={donnees} depot={depot} serveur={partage.jarvis} foyerPartage={foyerPartage} />;
  } else if (page.nom === "jarvis" || page.nom === "conseil") {
    ecran = (
      <Jarvis
        donnees={donnees}
        depot={depot}
        serveur={partage?.jarvis ?? null}
        foyerPartage={foyerPartage}
        ouvrirPartage={() => ouvrir({ nom: "partage" })}
        ouvrirConseil={() => ouvrir({ nom: "conseil" })}
        ouvrirMemoire={() => ouvrir({ nom: "memoire" })}
      />
    );
  } else if (page.nom === "memoire") {
    ecran = <MemoireJarvis depot={depot} foyer={leFoyer} membreId={membre} souvenirs={souvenirs} retours={retours} />;
  } else if (page.nom === "bilan") {
    ecran = <Bilan depot={depot} donnees={donnees} changerHeureRappel={changerHeureRappel} ouvrirAppris={() => ouvrir({ nom: "appris" })} />;
  } else if (page.nom === "appris") {
    ecran = <CeQueKoraSait donnees={donnees} depot={depot} ouvrirBilan={() => ouvrir({ nom: "bilan" })} ouvrirMemoire={() => ouvrir({ nom: "memoire" })} />;
  } else if (page.nom === "mots") {
    const notifier =
      partage && foyerPartage ? (m: { id: string; de: string | null; texte: string }) => partage.rappels.notifierMot({ foyerId: foyerPartage, id: m.id, de: m.de, texte: m.texte }) : null;
    ecran = <NosMots donnees={donnees} depot={depot} notifier={notifier} />;
  } else if (page.nom === "rappels") {
    ecran = <CentreRappels ouvrirNotifications={() => ouvrir({ nom: "notifications" })} />;
  } else if (page.nom === "sauvegarde") {
    ecran = <Sauvegarde depot={depot} aujourdhui={donnees.aujourdhui} contenu={{ foyer: leFoyer, listes, elements, taches, animaux, produits, catalogue, zones, souvenirs, couple, menus, agenda, budget, retours }} />;
  } else if (page.nom === "calendrier") {
    ecran = <CalendrierIphone foyer={leFoyer} membreId={membre} comptes={comptesIcloudDe(agenda)} distant={agendaPartage} />;
  } else if (page.nom === "retours") {
    ecran = <RetoursTest depot={depot} foyer={leFoyer} retours={retours} partageActif={partageActif} />;
  } else {
    ecran = (
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
        ouvrirAppris={() => ouvrir({ nom: "appris" })}
        ouvrirSauvegarde={() => ouvrir({ nom: "sauvegarde" })}
        ouvrirCalendrier={() => ouvrir({ nom: "calendrier" })}
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
    );
  }

  return ecran;
  }

  // La barre Jarvis, en bas de l'accueil et de chaque module : là où l'on ajoute quelque chose.
  // Les autres pages (Réglages, Nos mots, Jarvis lui-même) ont leurs propres champs.
  const lieuBarre: LieuBarre | null = page.nom === "accueil" ? "accueil" : page.nom === "module" ? page.id : page.nom === "liste" ? "liste" : null;
  const cleBarre = page.nom === "module" ? `module:${page.id}` : page.nom === "liste" ? `liste:${page.id}` : page.nom;
  const coinDev = pastille && !nouvelleVersion && page.nom !== "retours" && (
    <CoinDev depot={depot} ecran={nomEcran} membreId={membre} ouvertes={ouvertes} voirRetours={() => ouvrir({ nom: "retours" })} dansLaBarre={lieuBarre !== null} />
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
            {ecranDe(p)}
          </div>
        );
      }
      return (
    <div
      key={`${i}-${p.nom}`}
      className={`contenu page-dessus${glissement ? " retour-glisse" : ""}`}
    >
      {retour}
      {ecranDe(p)}
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
        ouvrirJarvis={() => ouvrir({ nom: "jarvis" })}
        avant={coinDev}
      />
    ) : (
      coinDev
    )}
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
const ZONES_A_GESTE = ".glissable.ouverte, .defilant, .bandeau-couple, input, textarea, select, [data-geste-propre]";

function useGlissementRetour(actif: boolean, revenir: () => void) {
  // Pendant le geste, la page suit le doigt sans repasser par React : seules l'entrée et la
  // sortie du geste changent l'état, le reste s'écrit directement sur les deux pages, une
  // fois par image. Sinon chaque mouvement redessinait toute la pile et la page saccadait.
  const [glisse, setGlisse] = useState(false);
  const rappel = useRef(revenir);
  rappel.current = revenir;

  useEffect(() => {
    if (!actif) return;
    let geste: { x: number; y: number; t: number; horizontal: boolean; dx: number } | null = null;
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
        ? { x: e.clientX, y: e.clientY, t: e.timeStamp, horizontal: false, dx: 0 }
        : null;
    };
    const mouvement = (e: PointerEvent) => {
      if (!geste) return;
      const dx = e.clientX - geste.x;
      if (!geste.horizontal) {
        const sens = gesteRetour(dx, e.clientY - geste.y);
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
      const part = finRetour(dx, e.timeStamp - g.t, largeur());
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

/** La durée de la fin du geste, accordée à `.retour-anime` dans styles.css. */
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
