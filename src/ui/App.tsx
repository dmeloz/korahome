import { useState } from "react";
import type { Depot } from "../donnees/depot";
import { lireMembreCourant } from "./contexte";
import { Accueil } from "./ecrans/Accueil";
import { Bienvenue } from "./ecrans/Bienvenue";
import { DetailListe } from "./ecrans/DetailListe";
import { Listes } from "./ecrans/Listes";
import { Reglages } from "./ecrans/Reglages";
import { Taches } from "./ecrans/Taches";
import { Icone } from "./Icone";
import { useDonnees } from "./useDonnees";

// Pas de barre d'onglets : tout part du tableau de bord, et chaque page a son retour.
type Page =
  | { nom: "accueil" }
  | { nom: "taches" }
  | { nom: "listes" }
  | { nom: "liste"; id: string }
  | { nom: "reglages" };

const LIBELLES: Record<Page["nom"], string> = {
  accueil: "Accueil",
  taches: "Tâches",
  listes: "Listes",
  liste: "Liste",
  reglages: "Réglages",
};

export function App({ depot }: { depot: Depot }) {
  const { pret, foyer, listes, elements, taches } = useDonnees(depot);
  const [pile, setPile] = useState<Page[]>([{ nom: "accueil" }]);
  const [membreId, setMembreId] = useState<string | null>(lireMembreCourant);

  if (!pret) return null;
  if (!foyer) return <Bienvenue depot={depot} onCree={setMembreId} />;

  const membre = foyer.membres.some((m) => m.id === membreId) ? membreId : null;
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

  let ecran;
  switch (page.nom) {
    case "accueil":
      ecran = (
        <Accueil
          foyer={foyer}
          membreId={membre}
          listes={listes}
          elements={elements}
          taches={taches}
          ouvrirListe={(id) => ouvrir({ nom: "liste", id })}
          ouvrirListes={() => ouvrir({ nom: "listes" })}
          ouvrirTaches={() => ouvrir({ nom: "taches" })}
          ouvrirReglages={() => ouvrir({ nom: "reglages" })}
        />
      );
      break;
    case "taches":
      ecran = <Taches depot={depot} foyer={foyer} membreId={membre} taches={taches} />;
      break;
    case "listes":
      ecran = <Listes depot={depot} listes={listes} elements={elements} ouvrirListe={(id) => ouvrir({ nom: "liste", id })} />;
      break;
    case "liste": {
      const liste = listes.find((l) => l.id === page.id);
      ecran = liste ? (
        <DetailListe depot={depot} foyer={foyer} membreId={membre} liste={liste} elements={elements} />
      ) : (
        <main><p className="vide">Cette liste n'existe plus.</p></main>
      );
      break;
    }
    case "reglages":
      ecran = <Reglages foyer={foyer} membreId={membre} changerMembre={setMembreId} />;
      break;
  }

  return (
    <div className="contenu">
      {precedente && (
        <button className="retour" onClick={revenir}>
          <Icone nom="retour" taille={22} />
          {LIBELLES[precedente.nom]}
        </button>
      )}
      {ecran}
    </div>
  );
}
