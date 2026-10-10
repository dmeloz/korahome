import { useEffect, useState, useSyncExternalStore } from "react";
import type { WidgetId } from "../domaine/tableauDeBord";
import type { Foyer } from "../domaine/types";
import type { DepotLocal } from "../donnees/depotLocal";
import { CoinDev } from "./CoinDev";
import { aujourdhuiLocal, choisirMembreCourant, lireMembreCourant } from "./contexte";
import { Accueil } from "./ecrans/Accueil";
import { Bienvenue } from "./ecrans/Bienvenue";
import { DetailListe } from "./ecrans/DetailListe";
import { Notifications } from "./ecrans/Notifications";
import { Partage, type ServicesPartage } from "./ecrans/Partage";
import { Reglages } from "./ecrans/Reglages";
import { RetoursTest } from "./ecrans/RetoursTest";
import { Icone } from "./Icone";
import type { MiseAJour } from "./miseAJour";
import { noter } from "./journal";
import { MODULES, type DonneesModule } from "./modules";
import { enregistrerPastilleVisible, lirePastilleVisible } from "./rapport";
import { lirePreferences, mettreAJourRappels } from "./rappels";
import { planifierSynchro } from "./synchroAuto";
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
  | { nom: "retours" };

// L'écran affiché, lu par le journal des retours de test à chaque geste.
let ecranCourant = "Accueil";
export const ecranAffiche = () => ecranCourant;

export function App({ depot, miseAJour, partage }: { depot: DepotLocal; miseAJour: MiseAJour; partage: ServicesPartage | null }) {
  const { pret, foyer, listes, elements, taches, retours, animaux } = useDonnees(depot);
  const [pile, setPile] = useState<Page[]>([{ nom: "accueil" }]);
  const [membreId, setMembreId] = useState<string | null>(lireMembreCourant);
  const nouvelleVersion = useSyncExternalStore(miseAJour.abonner, miseAJour.prete);
  const [pastille, setPastille] = useState(lirePastilleVisible);

  const synchro = partage?.synchro;
  const partageActif = useSyncExternalStore(synchro?.abonner ?? sansAbonnement, () => (synchro?.statut().etat ?? "inactif") !== "inactif");
  useEffect(() => (synchro ? planifierSynchro(synchro, depot) : undefined), [synchro, depot]);

  // Le serveur des rappels sait qui utilise ce téléphone, même après un changement dans Réglages.
  const foyerPartage = partageActif && foyer ? foyer.id : null;
  const membreRappels = foyer?.membres.some((m) => m.id === membreId) ? membreId : null;
  useEffect(() => {
    if (partage && foyerPartage) mettreAJourRappels(partage.rappels, foyerPartage, membreRappels, lirePreferences()).catch(() => {});
  }, [partage, foyerPartage, membreRappels]);

  const page = pile[pile.length - 1];
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
  const donnees: DonneesModule = { foyer, membreId: membre, listes, elements, taches, animaux, aujourdhui: aujourdhuiLocal() };
  const precedente = pile.length > 1 ? pile[pile.length - 2] : null;

  const ouvrir = (p: Page) => {
    setPile((avant) => [...avant, p]);
    window.scrollTo(0, 0);
  };
  const revenir = () => {
    setPile((avant) => (avant.length > 1 ? avant.slice(0, -1) : avant));
    window.scrollTo(0, 0);
  };
  const ouvrirListe = (id: string) => ouvrir({ nom: "liste", id });
  const ouvertes = retours.filter((r) => !r.regleLe).length;

  let ecran;
  if (page.nom === "accueil") {
    ecran = (
      <Accueil
        donnees={donnees}
        ouvrirModule={(id) => ouvrir({ nom: "module", id })}
        ouvrirReglages={() => ouvrir({ nom: "reglages" })}
        nouvelleVersion={nouvelleVersion}
      />
    );
  } else if (page.nom === "module") {
    ecran = MODULES[page.id]?.page({ ...donnees, depot, ouvrirListe });
  } else if (page.nom === "liste") {
    const liste = listes.find((l) => l.id === page.id);
    ecran = liste ? (
      <DetailListe depot={depot} foyer={foyer} membreId={membre} liste={liste} elements={elements} />
    ) : (
      <main><p className="vide">Cette liste n'existe plus.</p></main>
    );
  } else if (page.nom === "partage") {
    ecran = <Partage services={partage} foyer={foyer} />;
  } else if (page.nom === "notifications") {
    ecran = (
      <Notifications
        serveur={partage?.rappels ?? null}
        foyerId={foyerPartage}
        membreId={membre}
        ouvrirPartage={() => ouvrir({ nom: "partage" })}
      />
    );
  } else if (page.nom === "retours") {
    ecran = <RetoursTest depot={depot} foyer={foyer} retours={retours} partageActif={partageActif} />;
  } else {
    ecran = (
      <Reglages
        foyer={foyer}
        membreId={membre}
        changerMembre={setMembreId}
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

  return (
    <div className="contenu">
      {precedente && (
        <button className="retour" onClick={revenir}>
          <Icone nom="retour" taille={22} />
          {libelle(precedente)}
        </button>
      )}
      {ecran}
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
      <p className="discret">Qui utilise ce téléphone ?</p>
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
