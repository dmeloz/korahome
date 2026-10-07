import { useState } from "react";
import type { Depot } from "../donnees/depot";
import { lireMembreCourant } from "./contexte";
import { Accueil } from "./ecrans/Accueil";
import { Bienvenue } from "./ecrans/Bienvenue";
import { Bientot } from "./ecrans/Bientot";
import { DetailListe } from "./ecrans/DetailListe";
import { Listes } from "./ecrans/Listes";
import { Plus } from "./ecrans/Plus";
import { Taches } from "./ecrans/Taches";
import { Icone, type NomIcone } from "./Icone";
import { useDonnees } from "./useDonnees";

type Onglet = "accueil" | "listes" | "taches" | "agenda" | "plus";

const ONGLETS: { id: Onglet; libelle: string; icone: NomIcone }[] = [
  { id: "accueil", libelle: "Accueil", icone: "maison" },
  { id: "listes", libelle: "Listes", icone: "liste" },
  { id: "taches", libelle: "Tâches", icone: "coche" },
  { id: "agenda", libelle: "Agenda", icone: "calendrier" },
  { id: "plus", libelle: "Plus", icone: "plus" },
];

export function App({ depot }: { depot: Depot }) {
  const { pret, foyer, listes, elements, taches } = useDonnees(depot);
  const [onglet, setOnglet] = useState<Onglet>("accueil");
  const [listeOuverte, setListeOuverte] = useState<string | null>(null);
  const [membreId, setMembreId] = useState<string | null>(lireMembreCourant);

  if (!pret) return null;
  if (!foyer) return <Bienvenue depot={depot} onCree={setMembreId} />;

  const membre = foyer.membres.some((m) => m.id === membreId) ? membreId : null;
  const ouvrirListe = (id: string) => {
    setOnglet("listes");
    setListeOuverte(id);
  };
  const liste = listes.find((l) => l.id === listeOuverte);

  let ecran;
  switch (onglet) {
    case "accueil":
      ecran = (
        <Accueil
          foyer={foyer}
          membreId={membre}
          listes={listes}
          elements={elements}
          taches={taches}
          ouvrirListe={ouvrirListe}
          ouvrirTaches={() => setOnglet("taches")}
        />
      );
      break;
    case "listes":
      ecran = liste ? (
        <DetailListe
          depot={depot}
          foyer={foyer}
          membreId={membre}
          liste={liste}
          elements={elements}
          retour={() => setListeOuverte(null)}
        />
      ) : (
        <Listes depot={depot} listes={listes} elements={elements} ouvrirListe={ouvrirListe} />
      );
      break;
    case "taches":
      ecran = <Taches depot={depot} foyer={foyer} membreId={membre} taches={taches} />;
      break;
    case "agenda":
      ecran = <Bientot titre="Agenda" icone="🗓️" texte="Vos rendez-vous, anniversaires et échéances, au même endroit." />;
      break;
    case "plus":
      ecran = <Plus foyer={foyer} membreId={membre} changerMembre={setMembreId} />;
      break;
  }

  return (
    <>
      <div className="contenu">{ecran}</div>
      <nav className="onglets" aria-label="Navigation principale">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            className={o.id === onglet ? "actif" : ""}
            aria-current={o.id === onglet ? "page" : undefined}
            onClick={() => {
              setOnglet(o.id);
              setListeOuverte(null);
            }}
          >
            <Icone nom={o.icone} />
            {o.libelle}
          </button>
        ))}
      </nav>
    </>
  );
}
