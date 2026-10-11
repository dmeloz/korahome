import { describe, expect, it } from "vitest";
import type { Modification } from "../domaine/jarvis";
import { annulerModifications, enregistrerModifications } from "./jarvis";

function depotEspion() {
  const appels: string[] = [];
  const noter = (nom: string) => async (x: unknown) => {
    appels.push(`${nom} ${Array.isArray(x) ? x.join(",") : typeof x === "string" ? x : (x as { id: string }).id}`);
  };
  return {
    appels,
    depot: {
      enregistrerElement: noter("element"),
      supprimerElements: noter("supprimer-elements"),
      enregistrerTache: noter("tache"),
      supprimerTache: noter("supprimer-tache"),
      enregistrerProduit: noter("produit"),
      supprimerProduit: noter("supprimer-produit"),
      enregistrerAnimal: noter("animal"),
    },
  };
}

const doc = (id: string) => ({ id }) as never;

describe("Jarvis et le Dépôt", () => {
  const modifications: Modification[] = [
    { collection: "elements", avant: null, apres: doc("e1") },
    { collection: "taches", avant: doc("t1"), apres: doc("t1") },
    { collection: "stock", avant: null, apres: doc("p1") },
    { collection: "animaux", avant: doc("a1"), apres: doc("a1") },
  ];

  it("enregistre chaque document modifié", async () => {
    const { depot, appels } = depotEspion();
    await enregistrerModifications(depot, modifications);
    expect(appels).toEqual(["element e1", "tache t1", "produit p1", "animal a1"]);
  });

  it("annule à l'envers : ce qui a été créé disparaît, le reste revient", async () => {
    const { depot, appels } = depotEspion();
    await annulerModifications(depot, modifications);
    expect(appels).toEqual(["animal a1", "supprimer-produit p1", "tache t1", "supprimer-elements e1"]);
  });
});
