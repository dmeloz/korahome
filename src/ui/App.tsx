import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { meteoFraiche } from "../domaine/meteo";
import { rappelDuMatin } from "../domaine/rappels";
import type { WidgetId } from "../domaine/tableauDeBord";
import type { Foyer } from "../domaine/types";
import type { DepotLocal } from "../donnees/depotLocal";
import { FournisseurAnnulation } from "./annulation";
import { CoinDev } from "./CoinDev";
import { aujourdhuiLocal, choisirMembreCourant, lireMembreCourant } from "./contexte";
import { Accueil } from "./ecrans/Accueil";
import { Bienvenue } from "./ecrans/Bienvenue";
import { Conseil } from "./ecrans/Conseil";
import { MemoireJarvis } from "./ecrans/MemoireJarvis";
import { NosMots } from "./ecrans/NosMots";
import { Jarvis } from "./ecrans/Jarvis";
import { DetailListe } from "./ecrans/DetailListe";
import { Notifications } from "./ecrans/Notifications";
import { Partage, type ServicesPartage } from "./ecrans/Partage";
import { Reglages, Telephone } from "./ecrans/Reglages";
import { RetoursTest } from "./ecrans/RetoursTest";
import { Icone } from "./Icone";
import type { MiseAJour } from "./miseAJour";
import { BORD_RETOUR, directionGeste, finRetour } from "./gestes";
import { noter } from "./journal";
import { useMeteo } from "./meteo";
import { MODULES, type DonneesModule } from "./modules";
import { enregistrerPastilleVisible, lirePastilleVisible } from "./rapport";
import { afficherPastilleIcone, lirePreferences, mettreAJourRappels } from "./rappels";
import { planifierSynchro, synchroEnDirect } from "./synchroAuto";
import { avecTransition } from "./transitions";
import { useDonnees } from "./useDonnees";

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
  | { nom: "mots" };

/** Une page de la pile, avec l'endroit où elle était défilée quand on en est parti. */
type Entree = Page & { defilement?: number };

// L'écran affiché, lu par le journal des retours de test à chaque geste.
let ecranCourant = "Accueil";
export const ecranAffiche = () => ecranCourant;

export function App({ depot, miseAJour, partage }: { depot: DepotLocal; miseAJour: MiseAJour; partage: ServicesPartage | null }) {
  const { pret, foyer, listes, elements, taches, retours, animaux, produits, catalogue, zones, souvenirs, couple } = useDonnees(depot);
  // La météo sert au jardin et au bandeau de l'accueil. Trop ancienne (téléphone resté
  // hors ligne), elle ne déclenche plus d'alerte.
  const meteoLue = useMeteo(true);
  const meteo = meteoFraiche(meteoLue, new Date().toISOString()) ? meteoLue : null;
  const [pile, setPile] = useState<Entree[]>([{ nom: "accueil" }]);
  const [membreId, setMembreId] = useState<string | null>(lireMembreCourant);
  const nouvelleVersion = useSyncExternalStore(miseAJour.abonner, miseAJour.prete);
  const [pastille, setPastille] = useState(lirePastilleVisible);

  const synchro = partage?.synchro;
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
    const rappel = rappelDuMatin({ foyer, membreId: membreRappels, taches, animaux, produits, zones, meteo, aujourdhui, preferences: lirePreferences() });
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
  const donnees: DonneesModule = { foyer, membreId: membre, listes, elements, taches, animaux, produits, catalogue, zones, meteo, aujourdhui: aujourdhuiLocal(), souvenirs, retours, couple };

  const ouvrir = (p: Page) =>
    avecTransition("avant", () => {
      const defilement = window.scrollY;
      setPile((avant) => [...avant.slice(0, -1), { ...avant[avant.length - 1], defilement }, p]);
    });
  const ouvrirListe = (id: string) => ouvrir({ nom: "liste", id });
  const ouvertes = retours.filter((r) => !r.regleLe).length;

  const leFoyer: Foyer = foyer;
  const jarvisPartage = partage && foyerPartage ? { serveur: partage.jarvis, foyerId: foyerPartage } : null;
  function ecranDe(page: Page) {
  let ecran;
  if (page.nom === "accueil") {
    ecran = (
      <Accueil
        donnees={donnees}
        ouvrirModule={(id) => ouvrir({ nom: "module", id })}
        ouvrirReglages={() => ouvrir({ nom: "reglages" })}
        ouvrirJarvis={() => ouvrir({ nom: "jarvis" })}
        ouvrirMots={() => ouvrir({ nom: "mots" })}
        depot={depot}
        jarvis={jarvisPartage}
        nouvelleVersion={nouvelleVersion}
      />
    );
  } else if (page.nom === "module") {
    ecran = MODULES[page.id]?.page({ ...donnees, depot, ouvrirListe, jarvis: jarvisPartage });
  } else if (page.nom === "liste") {
    const liste = listes.find((l) => l.id === page.id);
    ecran = liste ? (
      <DetailListe depot={depot} foyer={leFoyer} membreId={membre} liste={liste} elements={elements} />
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
  } else if (page.nom === "mots") {
    const notifier =
      partage && foyerPartage ? (m: { id: string; de: string | null; texte: string }) => partage.rappels.notifierMot({ foyerId: foyerPartage, id: m.id, de: m.de, texte: m.texte }) : null;
    ecran = <NosMots donnees={donnees} depot={depot} notifier={notifier} />;
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

  // Toutes les pages de la pile restent montées, comme sur l'iPhone : celle d'en dessous
  // garde son état et apparaît sous le doigt quand on glisse pour revenir.
  const progression = glissement.decalage / Math.max(window.innerWidth, 1);
  return (
    <FournisseurAnnulation>
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
        const visible = i === pile.length - 2 && (glissement.decalage > 0 || glissement.anime);
        return (
          <div
            key={`${i}-${p.nom}`}
            className={`contenu page-dessous${visible ? " visible" : ""}${glissement.anime ? " retour-anime" : ""}`}
            style={{
              top: -(p.defilement ?? 0),
              ...(visible ? { transform: `translateX(${(progression - 1) * 28}%)`, filter: `brightness(${0.7 + 0.3 * progression})` } : {}),
            }}
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
      className={`contenu page-dessus${glissement.decalage ? " retour-glisse" : ""}${glissement.anime ? " retour-anime" : ""}`}
      style={glissement.decalage ? { transform: `translateX(${glissement.decalage}px)` } : undefined}
    >
      {retour}
      {ecranDe(p)}
      {pastille && !nouvelleVersion && page.nom !== "retours" && (
        <CoinDev
          depot={depot}
          ecran={nomEcran}
          membreId={membre}
          ouvertes={ouvertes}
          voirRetours={() => ouvrir({ nom: "retours" })}
        />
      )}
      {bandeauVersion}
    </div>
      );
    })}
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
  const [decalage, setDecalage] = useState(0);
  const [anime, setAnime] = useState(false);
  const rappel = useRef(revenir);
  rappel.current = revenir;

  useEffect(() => {
    if (!actif) return;
    let geste: { x: number; y: number; t: number; horizontal: boolean } | null = null;
    const largeur = () => window.innerWidth;
    const debut = (e: PointerEvent) => {
      const cible = e.target instanceof Element ? e.target : null;
      const libre = e.clientX <= BORD_RETOUR || !cible?.closest(ZONES_A_GESTE);
      geste = libre && e.isPrimary && !document.documentElement.classList.contains("feuille-ouverte")
        ? { x: e.clientX, y: e.clientY, t: e.timeStamp, horizontal: false }
        : null;
    };
    const mouvement = (e: PointerEvent) => {
      if (!geste) return;
      const dx = e.clientX - geste.x;
      if (!geste.horizontal) {
        const direction = directionGeste(dx, e.clientY - geste.y);
        if (direction === "verticale" || (direction === "horizontale" && dx < 0)) geste = null;
        if (direction !== "horizontale" || !geste) return;
        geste.horizontal = true;
      }
      setAnime(false);
      setDecalage(Math.max(0, dx));
    };
    const fin = (e: PointerEvent) => {
      const g = geste;
      geste = null;
      if (!g?.horizontal) return;
      setAnime(true);
      if (e.type === "pointerup" && finRetour(e.clientX - g.x, e.timeStamp - g.t, largeur())) {
        setDecalage(largeur());
        setTimeout(() => {
          rappel.current();
          setAnime(false);
          setDecalage(0);
          noter("geste", "Glisser pour revenir", ecranCourant);
        }, 220);
      } else {
        setDecalage(0);
      }
    };
    window.addEventListener("pointerdown", debut);
    window.addEventListener("pointermove", mouvement);
    window.addEventListener("pointerup", fin);
    window.addEventListener("pointercancel", fin);
    return () => {
      window.removeEventListener("pointerdown", debut);
      window.removeEventListener("pointermove", mouvement);
      window.removeEventListener("pointerup", fin);
      window.removeEventListener("pointercancel", fin);
    };
  }, [actif]);

  return { decalage, anime };
}

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
