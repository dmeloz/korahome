import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { contexteTest } from "../domaine/contexteTest";
import { creerFoyer, listesInitiales } from "../domaine/foyer";
import { basculerCoche, nouvelElement } from "../domaine/listes";
import { ajouterPesee, nouvelAnimal } from "../domaine/mitsu";
import { basculerRegle, nouveauRetour } from "../domaine/retours";
import { marquerFaite, tachesDeDepart } from "../domaine/taches";
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

  it("conserve et supprime les tâches", async () => {
    const ctx = contexteTest();
    const depot = depotNeuf();
    const [menage, linge] = tachesDeDepart("2026-10-07", ctx);
    await depot.enregistrerTaches([menage, linge]);
    await depot.enregistrerTache(marquerFaite(linge, null, "2026-10-07", ctx));
    await depot.supprimerTache(menage.id);
    const taches = await depot.lireTaches();
    expect(taches.map((t) => [t.titre, t.echeance])).toEqual([["Linge", "2026-10-14"]]);
  });

  it("ajoute les tâches à une base créée avant leur arrivée", async () => {
    const fabrique = new IDBFactory();
    const ancienne = fabrique.open("ancienne", 1);
    await new Promise<void>((ok) => {
      ancienne.onupgradeneeded = () => {
        for (const m of ["foyer", "listes", "elements"]) ancienne.result.createObjectStore(m, { keyPath: "id" });
      };
      ancienne.onsuccess = () => {
        ancienne.result.close();
        ok();
      };
    });
    const depot = creerDepotLocal("ancienne", fabrique);
    expect(await depot.lireTaches()).toEqual([]);
    expect(await depot.lireRetours()).toEqual([]);
    expect(await depot.lireAnimaux()).toEqual([]);
  });

  it("conserve, met à jour et supprime les notes de test", async () => {
    const ctx = contexteTest();
    const depot = depotNeuf();
    const note = nouveauRetour({ texte: "Trop lent", genre: "gene", ecran: "Tâches", version: "0.0.2", auteur: null }, ctx);
    const autre = nouveauRetour({ texte: "Un thème clair", genre: "idee", ecran: "Réglages", version: "0.0.2", auteur: null }, ctx);
    await depot.enregistrerRetour(note);
    await depot.enregistrerRetour(autre);
    await depot.enregistrerRetour(basculerRegle(note, ctx));
    await depot.supprimerRetour(autre.id);
    const retours = await depot.lireRetours();
    expect(retours).toHaveLength(1);
    expect(retours[0].regleLe).not.toBeNull();
  });

  it("conserve le suivi de Mitsu", async () => {
    const ctx = contexteTest();
    const depot = depotNeuf();
    const mitsu = ajouterPesee(nouvelAnimal("Mitsu", "2026-04-14", null, ctx), 2500, "2026-10-09", null, ctx);
    await depot.enregistrerAnimal(mitsu);
    await depot.enregistrerAnimal({ ...mitsu, sterilise: true });
    expect(await depot.lireAnimaux()).toEqual([{ ...mitsu, sterilise: true }]);
  });
});

describe("dépôt local : modifications en attente de partage", () => {
  const ch = (id: string, maj: string, donnees: unknown) => ({ collection: "elements" as const, id, donnees, maj });

  it("note chaque modification d'une donnée partagée, une seule fois par document", async () => {
    const ctx = contexteTest();
    const depot = creerDepotLocal("attente", new IDBFactory(), ctx.maintenant);
    const [courses] = listesInitiales(ctx);
    const lait = nouvelElement(courses, "lait", null, ctx);
    await depot.enregistrerListe(courses);
    await depot.enregistrerElement(lait);
    await depot.enregistrerElement(basculerCoche(lait, ctx));
    await depot.enregistrerRetour(nouveauRetour({ texte: "Note", genre: "idee", ecran: "Accueil", version: "0.0.4", auteur: null }, ctx));
    const attente = await depot.lireEnAttente();
    expect(attente.map((c) => c.collection).sort()).toEqual(["elements", "listes", "retours"]);
    expect((attente.find((c) => c.id === lait.id)?.donnees as { coche: boolean }).coche).toBe(true);
  });

  it("note une suppression de liste avec ses éléments", async () => {
    const ctx = contexteTest();
    const depot = creerDepotLocal("suppression", new IDBFactory(), ctx.maintenant);
    const [courses] = listesInitiales(ctx);
    const lait = nouvelElement(courses, "lait", null, ctx);
    await depot.enregistrerListe(courses);
    await depot.enregistrerElement(lait);
    await depot.supprimerListe(courses.id);
    expect((await depot.lireEnAttente()).map((c) => [c.id, c.donnees])).toEqual(
      expect.arrayContaining([[courses.id, null], [lait.id, null]]),
    );
  });

  it("garde une modification refaite pendant l'envoi", async () => {
    const ctx = contexteTest();
    const depot = creerDepotLocal("envoi", new IDBFactory(), ctx.maintenant);
    const [courses] = listesInitiales(ctx);
    const lait = nouvelElement(courses, "lait", null, ctx);
    await depot.enregistrerElement(lait);
    const envoyes = await depot.lireEnAttente();
    await depot.enregistrerElement(basculerCoche(lait, ctx));
    await depot.retirerEnAttente(envoyes);
    expect(await depot.lireEnAttente()).toHaveLength(1);
    await depot.retirerEnAttente(await depot.lireEnAttente());
    expect(await depot.lireEnAttente()).toEqual([]);
  });

  it("n'écrase pas une modification locale plus récente que celle qui arrive", async () => {
    const depot = creerDepotLocal("appliquer", new IDBFactory(), () => "2026-10-09T10:05:00.000Z");
    await depot.enregistrerAnimal({ id: "mitsu", nom: "ici" } as never);
    await depot.appliquer([
      { collection: "animaux", id: "mitsu", donnees: { id: "mitsu", nom: "là-bas" }, maj: "2026-10-09T10:00:00.000Z" },
      ch("pain", "2026-10-09T10:00:00.000Z", { id: "pain", texte: "Pain" }),
    ]);
    expect((await depot.lireAnimaux())[0].nom).toBe("ici");
    expect((await depot.lireElements()).map((e) => e.texte)).toEqual(["Pain"]);
    await depot.appliquer([ch("pain", "2026-10-09T11:00:00.000Z", null)]);
    expect(await depot.lireElements()).toEqual([]);
  });

  it("prévient les écrans quand des modifications arrivent", async () => {
    const depot = depotNeuf();
    const rappel = vi.fn();
    depot.abonner(rappel);
    await depot.appliquer([ch("pain", "2026-10-09T10:00:00.000Z", { id: "pain" })]);
    expect(rappel).toHaveBeenCalledTimes(1);
  });

  it("met tout en attente au moment de partager, notes de test comprises", async () => {
    const ctx = contexteTest();
    const depot = creerDepotLocal("partager", new IDBFactory(), ctx.maintenant);
    await depot.enregistrerFoyer(creerFoyer("Maison", ["Melo"], ctx));
    await depot.enregistrerRetour(nouveauRetour({ texte: "Note", genre: "idee", ecran: "Accueil", version: "0.0.4", auteur: null }, ctx));
    await depot.retirerEnAttente(await depot.lireEnAttente());
    await depot.toutMettreEnAttente();
    expect((await depot.lireEnAttente()).map((c) => c.collection).sort()).toEqual(["foyer", "retours"]);
  });

  it("garde les notes de test du téléphone quand il rejoint un foyer", async () => {
    const ctx = contexteTest();
    const depot = creerDepotLocal("rejoindre", new IDBFactory(), ctx.maintenant);
    const mienne = nouveauRetour({ texte: "Ma note", genre: "bug", ecran: "Accueil", version: "0.0.7", auteur: null }, ctx);
    const transmise = nouveauRetour({ texte: "Déjà partie", genre: "idee", ecran: "Accueil", version: "0.0.7", auteur: null }, ctx);
    await depot.enregistrerRetour(transmise);
    await depot.retirerEnAttente(await depot.lireEnAttente());
    await depot.enregistrerRetour(mienne);
    const foyer = creerFoyer("Cassa", ["Sarah"], ctx);
    const deSarah = nouveauRetour({ texte: "Note de Sarah", genre: "gene", ecran: "Courses", version: "0.0.7", auteur: null }, ctx);
    await depot.remplacerTout([
      { collection: "foyer", id: foyer.id, donnees: foyer, maj: ctx.maintenant() },
      { collection: "retours", id: deSarah.id, donnees: deSarah, maj: ctx.maintenant() },
    ]);
    expect((await depot.lireRetours()).map((r) => r.texte).sort()).toEqual(["Déjà partie", "Ma note", "Note de Sarah"]);
    expect((await depot.lireEnAttente()).map((c) => c.id)).toEqual([mienne.id]);
  });

  it("conserve l'état du partage", async () => {
    const depot = depotNeuf();
    expect(await depot.lireEtat()).toBeNull();
    const etat = { foyerId: "f", curseur: "2026-10-09T10:00:00.000Z", derniere: null };
    await depot.enregistrerEtat(etat);
    expect(await depot.lireEtat()).toEqual(etat);
    await depot.enregistrerEtat(null);
    expect(await depot.lireEtat()).toBeNull();
  });
});

describe("dépôt local : passage à la version 6", () => {
  it("envoie les notes de test déjà écrites au prochain partage", async () => {
    const fabrique = new IDBFactory();
    await new Promise<void>((ok, ko) => {
      const req = fabrique.open("ancienne", 5);
      req.onupgradeneeded = () => {
        for (const m of ["foyer", "listes", "elements", "taches", "retours", "animaux", "synchro"]) req.result.createObjectStore(m, { keyPath: "id" });
        req.result.createObjectStore("attente", { keyPath: "cle" });
        req.transaction!.objectStore("retours").put({ id: "n1", texte: "Ancienne note" });
      };
      req.onsuccess = () => {
        req.result.close();
        ok();
      };
      req.onerror = () => ko(req.error);
    });
    const depot = creerDepotLocal("ancienne", fabrique);
    expect((await depot.lireEnAttente()).map((c) => [c.collection, c.id])).toEqual([["retours", "n1"]]);
  });
});
