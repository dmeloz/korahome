import { useState } from "react";
import { decrireEffacement, espaceDe, JOURS_CORBEILLE, joursRestants, titreDe, trierCorbeille, type EntreeCorbeille } from "../../domaine/corbeille";
import type { Foyer, Id } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { ListeVivante, Ligne } from "../moteur/pieces";
import { Page } from "../pieces";

// Réglages › Corbeille : ce que l'un de vous deux a effacé ces trente derniers jours, avec
// qui et quand, et un « Remettre » qui le replace là où il était.

/** « Annuler » après une remise : le document repart à la corbeille par le chemin habituel. */
function effacerDeNouveau(depot: Depot, e: EntreeCorbeille): Promise<void> {
  const id: Id = e.docId;
  switch (e.collection) {
    case "listes":
      return depot.supprimerListe(id);
    case "taches":
      return depot.supprimerTache(id);
    case "stock":
      return depot.supprimerProduit(id);
    case "jardin":
      return depot.supprimerZone(id);
    case "memoire":
      return depot.supprimerSouvenir(id);
    case "couple":
      return depot.supprimerCouple(id);
    case "menus":
      return depot.supprimerMenu(id);
    case "agenda":
      return depot.supprimerAgenda(id);
    case "budget":
      return depot.supprimerBudget(id);
    case "vetements":
      return depot.supprimerVetement(id);
  }
}

export function Corbeille(props: { depot: Depot; foyer: Foyer; corbeille: EntreeCorbeille[] }) {
  const annoncer = useAnnoncer();
  const [maintenant] = useState(() => new Date().toISOString());
  const entrees = trierCorbeille(props.corbeille, maintenant);

  async function remettre(e: EntreeCorbeille) {
    await props.depot.remettre(e);
    vibrer();
    annoncer(`« ${titreDe(e)} » remis dans ${espaceDe(e.collection, e.donnees)}.`, () => effacerDeNouveau(props.depot, e));
  }

  async function vider() {
    const ids = entrees.map((e) => e.id);
    await props.depot.viderCorbeille(ids);
    vibrer();
  }

  return (
    <Page
      titre="Corbeille"
      sousTitre={entrees.length === 0 ? `Ce que vous effacez reste ici ${JOURS_CORBEILLE} jours` : `${entrees.length} effacé${entrees.length > 1 ? "s" : ""} · gardé${entrees.length > 1 ? "s" : ""} ${JOURS_CORBEILLE} jours`}
      actions={entrees.length > 0 ? <button className="lien danger" onClick={() => void vider()}>Vider</button> : undefined}
      aide={{ cle: "corbeille", texte: "Une tâche, une recette ou une dépense effacée par l'un de vous deux attend ici. « Remettre » la replace là où elle était ; après trente jours, elle part pour de bon." }}
    >
      {entrees.length === 0 ? (
        <p className="vide">Rien dans la corbeille.</p>
      ) : (
        <ListeVivante className="carte groupe">
          {entrees.map((e) => (
            <Ligne key={e.id} className="ligne corbeille-ligne">
              <span className="ligne-texte">
                <strong>{titreDe(e)}</strong>
                <span className="discret">
                  {espaceDe(e.collection, e.donnees)} · {decrireEffacement(e, props.foyer, maintenant)} · encore {joursRestants(e, maintenant)} j
                </span>
              </span>
              <button className="bouton-icone" aria-label={`Remettre « ${titreDe(e)} »`} onClick={() => void remettre(e)}>
                <Icone nom="actualiser" taille={18} />
              </button>
            </Ligne>
          ))}
        </ListeVivante>
      )}
    </Page>
  );
}
