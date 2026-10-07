import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { contexteTest } from "../domaine/contexteTest";
import { creerFoyer, listesInitiales } from "../domaine/foyer";
import { basculerCoche, nouvelElement } from "../domaine/listes";
import { creerDepotLocal } from "./depotLocal";

function depotNeuf() {
  return creerDepotLocal("test", new IDBFactory());
}

describe("dépôt local", () => {
  it("ne contient pas de foyer au premier lancement", async () => {
    expect(await depotNeuf().lireFoyer()).toBeNull();
  });

  it("conserve le foyer, les listes et les éléments", async () => {
    const ctx = contexteTest();
    const depot = depotNeuf();
    const foyer = creerFoyer("Maison", ["Melo"], ctx);
    const [courses] = listesInitiales(ctx);
    const lait = nouvelElement(courses, "lait", foyer.membres[0].id, ctx);
    await depot.enregistrerFoyer(foyer);
    await depot.enregistrerListe(courses);
    await depot.enregistrerElement(lait);
    await depot.enregistrerElement(basculerCoche(lait, ctx));

    expect(await depot.lireFoyer()).toEqual(foyer);
    expect(await depot.lireListes()).toEqual([courses]);
    const elements = await depot.lireElements();
    expect(elements).toHaveLength(1);
    expect(elements[0].coche).toBe(true);
  });

  it("supprime une liste avec ses éléments", async () => {
    const ctx = contexteTest();
    const depot = depotNeuf();
    const [courses, maison] = listesInitiales(ctx);
    await depot.enregistrerListe(courses);
    await depot.enregistrerListe(maison);
    await depot.enregistrerElement(nouvelElement(courses, "lait", null, ctx));
    await depot.enregistrerElement(nouvelElement(maison, "ampoule", null, ctx));
    await depot.supprimerListe(courses.id);
    expect((await depot.lireListes()).map((l) => l.nom)).toEqual(["Maison"]);
    expect((await depot.lireElements()).map((e) => e.texte)).toEqual(["Ampoule"]);
  });

  it("prévient les abonnés à chaque écriture, jusqu'au désabonnement", async () => {
    const ctx = contexteTest();
    const depot = depotNeuf();
    const rappel = vi.fn();
    const desabonner = depot.abonner(rappel);
    const [courses] = listesInitiales(ctx);
    await depot.enregistrerListe(courses);
    expect(rappel).toHaveBeenCalledTimes(1);
    desabonner();
    await depot.supprimerElements([]);
    expect(rappel).toHaveBeenCalledTimes(1);
  });
});
