import { useEffect, useState, useSyncExternalStore } from "react";
import type { WidgetId } from "../domaine/tableauDeBord";
import type { Depot } from "../donnees/depot";
import { CoinDev } from "./CoinDev";
import { aujourdhuiLocal, lireMembreCourant } from "./contexte";
import { Accueil } from "./ecrans/Accueil";
import { Bienvenue } from "./ecrans/Bienvenue";
import { DetailListe } from "./ecrans/DetailListe";
import { Reglages } from "./ecrans/Reglages";
import { RetoursTest } from "./ecrans/RetoursTest";
import { Icone } from "./Icone";
import type { MiseAJour } from "./miseAJour";
import { noter } from "./journal";
import { MODULES, type DonneesModule } from "./modules";
import { enregistrerPastilleVisible, lirePastilleVisible } from "./rapport";
import { useDonnees } from "./useDonnees";

// Pas de barre d'onglets : tout part du tableau de bord, chaque widget ouvre la
// page de son module, et chaque page a son retour vers la précédente.
type Page =
  | { nom: "accueil" }
  | { nom: "module"; id: WidgetId }
  | { nom: "liste"; id: string }
  | { nom: "reglages" }
  | { nom: "retours" };

// L'écran affiché, lu par le journal des retours de test à chaque geste.
let ecranCourant = "Accueil";
export const ecranAffiche = () => ecranCourant;

export function App({ depot, miseAJour }: { depot: Depot; miseAJour: MiseAJour }) {
  const { pret, foyer, listes, elements, taches, retours, animaux } = useDonnees(depot);
  const [pile, setPile] = useState<Page[]>([{ nom: "accueil" }]);
  const [membreId, setMembreId] = useState<string | null>(lireMembreCourant);
  const nouvelleVersion = useSyncExternalStore(miseAJour.abonner, miseAJour.prete);
  const [pastille, setPastille] = useState(lirePastilleVisible);

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
    if (p.nom === "module") return MODULES[p.id]?.libelle ?? "Retour";
    return listes.find((l) => l.id === p.id)?.nom ?? "Liste";
  }
  /** Le nom de l'écran tel qu'il apparaît dans les notes et le journal. */
  function nommer(p: Page): string {
    return p.nom === "liste" ? `Liste ${libelle(p)}` : libelle(p);
  }

  if (!pret) return null;
  if (!foyer) return <Bienvenue depot={depot} onCree={setMembreId} />;

  const membre = foyer.membres.some((m) => m.id === membreId) ? membreId : null;
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
  } else if (page.nom === "retours") {
    ecran = <RetoursTest depot={depot} foyer={foyer} retours={retours} />;
  } else {
    ecran = (
      <Reglages
        foyer={foyer}
        membreId={membre}
        changerMembre={setMembreId}
        verifierMiseAJour={miseAJour.verifier}
        notesOuvertes={ouvertes}
        ouvrirRetours={() => ouvrir({ nom: "retours" })}
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
      {nouvelleVersion && (
        <div className="bandeau-version" role="status">
          <span>Nouvelle version prête.</span>
          <button className="bouton-principal" onClick={() => void miseAJour.appliquer()}>Mettre à jour</button>
        </div>
      )}
    </div>
  );
}
