import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { creerFoyer, listesInitiales } from "../domaine/foyer";
import { basculerCoche, nouvelElement } from "../domaine/listes";
import type { Contexte } from "../domaine/types";
import { creerDepotLocal } from "./depotLocal";
import { serveurFactice } from "./serveurFactice";
import { creerSynchro } from "./synchro";

/** Une horloge commune que le test avance à la main, pour décider qui a modifié en dernier. */
function horlogeCommune() {
  let t = Date.parse("2026-10-09T08:00:00.000Z");
  return { lire: () => new Date(t).toISOString(), avancer: (minutes = 1) => void (t += minutes * 60000) };
}

function telephone(nom: string, serveur: ReturnType<typeof serveurFactice>, heure: ReturnType<typeof horlogeCommune>) {
  let n = 0;
  const ctx: Contexte = { maintenant: heure.lire, nouvelId: () => `${nom}-${++n}` };
  const depot = creerDepotLocal(nom, new IDBFactory(), heure.lire);
  return { ctx, depot, synchro: creerSynchro(depot, serveur.distant, heure.lire) };
}

async function foyerPartage() {
  const serveur = serveurFactice();
  const heure = horlogeCommune();
  const melo = telephone("melo", serveur, heure);
  const sarah = telephone("sarah", serveur, heure);
  const foyer = creerFoyer("Chez nous", ["Melo", "Sarah"], melo.ctx);
  const [courses] = listesInitiales(melo.ctx);
  await melo.depot.enregistrerFoyer(foyer);
  await melo.depot.enregistrerListe(courses);
  await melo.synchro.partager(foyer.id);
  await sarah.synchro.rejoindre(foyer.id);
  return { serveur, heure, melo, sarah, foyer, courses };
}

const textes = async (depot: { lireElements: () => Promise<{ texte: string }[]> }) =>
  (await depot.lireElements()).map((e) => e.texte).sort();

describe("partage entre deux téléphones", () => {
  it("Sarah rejoint le foyer de Melo et retrouve ses listes", async () => {
    const { melo, sarah, foyer } = await foyerPartage();
    expect(await sarah.depot.lireFoyer()).toEqual(foyer);
    expect(await sarah.depot.lireListes()).toEqual(await melo.depot.lireListes());
    expect(sarah.synchro.statut().etat).toBe("ok");
  });

  it("rejoindre remplace ce que l'autre téléphone contenait", async () => {
    const serveur = serveurFactice();
    const heure = horlogeCommune();
    const melo = telephone("melo", serveur, heure);
    const sarah = telephone("sarah", serveur, heure);
    const foyer = creerFoyer("Chez nous", ["Melo", "Sarah"], melo.ctx);
    await melo.depot.enregistrerFoyer(foyer);
    await melo.synchro.partager(foyer.id);
    await sarah.depot.enregistrerFoyer(creerFoyer("Essai", ["Sarah"], sarah.ctx));
    await sarah.synchro.rejoindre(foyer.id);
    expect((await sarah.depot.lireFoyer())?.nom).toBe("Chez nous");
    expect(await sarah.depot.lireEnAttente()).toEqual([]);
  });

  it("ce que chacun ajoute de son côté se retrouve sur les deux téléphones", async () => {
    const { heure, melo, sarah, courses } = await foyerPartage();
    heure.avancer();
    await melo.depot.enregistrerElement(nouvelElement(courses, "lait", null, melo.ctx));
    await sarah.depot.enregistrerElement(nouvelElement(courses, "pain", null, sarah.ctx));
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();
    await melo.synchro.synchroniser();
    expect(await textes(melo.depot)).toEqual(["Lait", "Pain"]);
    expect(await textes(sarah.depot)).toEqual(["Lait", "Pain"]);
    expect(await melo.depot.lireEnAttente()).toEqual([]);
    expect(await sarah.depot.lireEnAttente()).toEqual([]);
  });

  it("quand les deux modifient la même chose, la modification la plus récente gagne partout", async () => {
    const { heure, melo, sarah, courses } = await foyerPartage();
    const lait = nouvelElement(courses, "lait", null, melo.ctx);
    await melo.depot.enregistrerElement(lait);
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();

    heure.avancer();
    await melo.depot.enregistrerElement({ ...lait, quantite: "2 l" });
    heure.avancer();
    await sarah.depot.enregistrerElement(basculerCoche(lait, sarah.ctx));
    // Sarah envoie la première, Melo ensuite avec une modification plus ancienne.
    await sarah.synchro.synchroniser();
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();

    for (const tel of [melo, sarah]) {
      const [element] = await tel.depot.lireElements();
      expect(element.coche).toBe(true);
      expect(element.quantite).toBeNull();
    }
  });

  it("une suppression se propage", async () => {
    const { heure, melo, sarah, courses } = await foyerPartage();
    const lait = nouvelElement(courses, "lait", null, melo.ctx);
    await melo.depot.enregistrerElement(lait);
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();
    heure.avancer();
    await sarah.depot.supprimerElements([lait.id]);
    await sarah.synchro.synchroniser();
    await melo.synchro.synchroniser();
    expect(await melo.depot.lireElements()).toEqual([]);
  });

  it("hors connexion, les modifications attendent et partent au retour du réseau", async () => {
    const { serveur, heure, melo, sarah, courses } = await foyerPartage();
    serveur.tomberEnPanne(true);
    heure.avancer();
    await melo.depot.enregistrerElement(nouvelElement(courses, "œufs", null, melo.ctx));
    await melo.synchro.synchroniser();
    expect(melo.synchro.statut()).toMatchObject({ etat: "erreur", message: "Serveur injoignable" });
    expect(await melo.depot.lireEnAttente()).toHaveLength(1);

    serveur.tomberEnPanne(false);
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();
    expect(await textes(sarah.depot)).toEqual(["Œufs"]);
    expect(melo.synchro.statut().etat).toBe("ok");
  });

  it("deux demandes simultanées ne font qu'un passage", async () => {
    const { melo } = await foyerPartage();
    const a = melo.synchro.synchroniser();
    const b = melo.synchro.synchroniser();
    expect(a).toBe(b);
    await a;
  });

  it("après déconnexion, plus rien ne part et les données restent", async () => {
    const { serveur, heure, melo, courses } = await foyerPartage();
    await melo.synchro.arreter();
    const avant = serveur.lignes.size;
    heure.avancer();
    await melo.depot.enregistrerElement(nouvelElement(courses, "riz", null, melo.ctx));
    await melo.synchro.synchroniser();
    expect(serveur.lignes.size).toBe(avant);
    expect(melo.synchro.statut().etat).toBe("inactif");
    expect(await textes(melo.depot)).toEqual(["Riz"]);
  });

  it("à la reconnexion, les modifications faites entre-temps partent sans écraser celles de l'autre", async () => {
    const { heure, melo, sarah, courses, foyer } = await foyerPartage();
    await melo.synchro.arreter();
    heure.avancer();
    await melo.depot.enregistrerElement(nouvelElement(courses, "riz", null, melo.ctx));
    await sarah.depot.enregistrerElement(nouvelElement(courses, "thé", null, sarah.ctx));
    await sarah.synchro.synchroniser();
    await melo.synchro.reprendre(foyer.id);
    await sarah.synchro.synchroniser();
    expect(await textes(melo.depot)).toEqual(["Riz", "Thé"]);
    expect(await textes(sarah.depot)).toEqual(["Riz", "Thé"]);
  });
});
