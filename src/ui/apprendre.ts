import { ajusterRythme, apprentissages, souvenirAppris, type Apprentissage } from "../domaine/apprentissage";
import { recalerCommande } from "../domaine/mitsu";
import { basculerRetiree, carteDeLEspace, CARTES } from "../domaine/ecranAccueil";
import type { WidgetId } from "../domaine/tableauDeBord";
import type { Depot } from "../donnees/depot";
import { enregistrerRetirees, lireRetirees } from "./accueilLocal";
import { contexteReel } from "./contexte";
import type { DonneesModule } from "./modules";
import { lirePreferences } from "./rappels";
import { deciderPerso, lireDecisionsPerso, lireUsages, oublierDecisionPerso, signalerChangement } from "./usage";

// Le lien entre ce que Kora a appris (règles dans src/domaine/apprentissage.ts) et ce téléphone :
// ce qu'il lit pour apprendre, et ce qu'il change quand on garde un apprentissage.

/** Les rappels ne comptent que s'ils sont en place sur ce téléphone. */
function heureRappel(): number | null {
  const permis = typeof Notification !== "undefined" && Notification.permission === "granted";
  return permis ? lirePreferences().heure : null;
}

/** Les espaces dont la carte est encore dans les piles de l'accueil de ce téléphone. */
function cartesSurLAccueil(): WidgetId[] {
  const retirees = lireRetirees();
  return CARTES.map((c) => c.id).filter((id): id is WidgetId & typeof id => carteDeLEspace(id) === id && !retirees.includes(id));
}

export function calculerApprentissages(d: DonneesModule): Apprentissage[] {
  const decisions = Object.fromEntries(Object.entries(lireDecisionsPerso()).map(([cle, v]) => [cle, v.decision]));
  return apprentissages({
    listes: d.listes,
    elements: d.elements,
    taches: d.taches,
    catalogue: d.catalogue,
    animaux: d.animaux,
    souvenirs: d.souvenirs,
    usages: lireUsages(),
    // Depuis 0.0.72, l'accueil montre des piles : un espace délaissé est une carte qu'on peut retirer.
    disposition: cartesSurLAccueil(),
    heureRappel: heureRappel(),
    decisionsPerso: decisions,
    aujourdhui: d.aujourdhui,
  });
}

export interface ServicesApprentissage {
  depot: Depot;
  donnees: DonneesModule;
  /** Change l'heure du rappel de ce téléphone (et la dit au serveur des rappels). */
  changerHeureRappel: (heure: number) => Promise<void>;
}

/**
 * Garde ou refuse un apprentissage. Ce qui vient du foyer entre dans la mémoire partagée (un
 * refus aussi, pour ne plus être reproposé, sans que Jarvis le relise) ; ce qui est personnel
 * reste sur ce téléphone. Rend de quoi tout remettre comme avant.
 */
export async function deciderApprentissage(a: Apprentissage, garde: boolean, s: ServicesApprentissage): Promise<() => Promise<void>> {
  const { depot, donnees } = s;
  const defaire: (() => Promise<void>)[] = [];

  if (a.portee === "foyer") {
    const souvenir = souvenirAppris(a, garde, donnees.membreId, contexteReel);
    await depot.enregistrerSouvenir(souvenir);
    defaire.push(() => depot.supprimerSouvenir(souvenir.id));
  } else {
    deciderPerso(a.cle, garde ? "garde" : "refuse", a.fait);
    defaire.push(async () => oublierDecisionPerso(a.cle));
  }

  if (garde) {
    const action = a.action;
    if (action.type === "heureRappel") {
      const avant = lirePreferences().heure;
      await s.changerHeureRappel(action.heure);
      defaire.push(() => s.changerHeureRappel(avant));
    } else if (action.type === "retirerWidget") {
      const avant = lireRetirees();
      const carte = carteDeLEspace(action.widget);
      if (carte && !avant.includes(carte)) enregistrerRetirees(basculerRetiree(avant, carte));
      signalerChangement();
      defaire.push(async () => {
        enregistrerRetirees(avant);
        signalerChangement();
      });
    } else if (action.type === "recalerCommande") {
      const animal = donnees.animaux.find((x) => x.id === action.animalId);
      if (animal) {
        await depot.enregistrerAnimal(recalerCommande(animal, action.jour));
        defaire.push(() => depot.enregistrerAnimal(animal));
      }
    } else if (action.type === "rythmeTache") {
      const tache = donnees.taches.find((t) => t.id === action.tacheId);
      if (tache) {
        await depot.enregistrerTache(ajusterRythme(tache, action.recurrence));
        defaire.push(() => depot.enregistrerTache(tache));
      }
    }
  }

  return async () => {
    for (const f of defaire.reverse()) await f();
  };
}
