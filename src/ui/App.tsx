import { useState } from "react";
import type { WidgetId } from "../domaine/tableauDeBord";
import type { Depot } from "../donnees/depot";
import { aujourdhuiLocal, lireMembreCourant } from "./contexte";
import { Accueil } from "./ecrans/Accueil";
import { Bienvenue } from "./ecrans/Bienvenue";
import { DetailListe } from "./ecrans/DetailListe";
import { Reglages } from "./ecrans/Reglages";
import { Icone } from "./Icone";
import { MODULES, type DonneesModule } from "./modules";
import { useDonnees } from "./useDonnees";

// Pas de barre d'onglets : tout part du tableau de bord, chaque widget ouvre la
// page de son module, et chaque page a son retour vers la précédente.
type Page =
  | { nom: "accueil" }
  | { nom: "module"; id: WidgetId }
  | { nom: "liste"; id: string }
  | { nom: "reglages" };

export function App({ depot }: { depot: Depot }) {
  const { pret, foyer, listes, elements, taches } = useDonnees(depot);
  const [pile, setPile] = useState<Page[]>([{ nom: "accueil" }]);
  const [membreId, setMembreId] = useState<string | null>(lireMembreCourant);

  if (!pret) return null;
  if (!foyer) return <Bienvenue depot={depot} onCree={setMembreId} />;

  const membre = foyer.membres.some((m) => m.id === membreId) ? membreId : null;
  const donnees: DonneesModule = { foyer, membreId: membre, listes, elements, taches, aujourdhui: aujourdhuiLocal() };
  const page = pile[pile.length - 1];
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

  function libelle(p: Page): string {
    if (p.nom === "accueil") return "Accueil";
    if (p.nom === "reglages") return "Réglages";
    if (p.nom === "module") return MODULES[p.id]?.libelle ?? "Retour";
    return listes.find((l) => l.id === p.id)?.nom ?? "Liste";
  }

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
  } else {
    ecran = <Reglages foyer={foyer} membreId={membre} changerMembre={setMembreId} />;
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
    </div>
  );
}
