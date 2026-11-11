import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { creerFoyer, listesInitiales } from "../domaine/foyer";
import { nouveauPlan, type PlanBudget } from "../domaine/budget";
import { basculerCoche, nouvelElement } from "../domaine/listes";
import { nouvelAnimal } from "../domaine/mitsu";
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

  it("chacun retouche la même ligne de son côté : les deux retouches restent, partout", async () => {
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
      expect(element.quantite).toBe("2 l");
      expect(await tel.depot.lireEnAttente()).toEqual([]);
    }
  });

  it("quand les deux changent le même champ, la modification la plus récente gagne partout", async () => {
    const { heure, melo, sarah, courses } = await foyerPartage();
    const lait = nouvelElement(courses, "lait", null, melo.ctx);
    await melo.depot.enregistrerElement(lait);
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();

    heure.avancer();
    await melo.depot.enregistrerElement({ ...lait, quantite: "2 l" });
    heure.avancer();
    await sarah.depot.enregistrerElement({ ...lait, quantite: "1 l" });
    await sarah.synchro.synchroniser();
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();

    for (const tel of [melo, sarah]) expect((await tel.depot.lireElements())[0].quantite).toBe("1 l");
  });

  it("la fiche de Mitsu retouchée sur les deux téléphones garde la pesée de l'un et le soin de l'autre", async () => {
    const { heure, melo, sarah } = await foyerPartage();
    const mitsu = nouvelAnimal("Mitsu", "2023-04-01", null, melo.ctx);
    await melo.depot.enregistrerAnimal(mitsu);
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();

    heure.avancer();
    await sarah.depot.enregistrerAnimal({ ...mitsu, pesees: [{ id: "p1", jour: "2026-11-11", grammes: 4200, par: null }] });
    heure.avancer();
    await melo.depot.enregistrerAnimal({ ...mitsu, sterilise: true });
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();
    await melo.synchro.synchroniser();

    for (const tel of [melo, sarah]) {
      const [fiche] = await tel.depot.lireAnimaux();
      expect(fiche.sterilise).toBe(true);
      expect(fiche.pesees.map((p) => p.grammes)).toEqual([4200]);
    }
  });

  it("le plan du Budget garde la charge ajoutée par l'un et le salaire changé par l'autre", async () => {
    const { heure, melo, sarah, foyer } = await foyerPartage();
    const plan = nouveauPlan(foyer.membres.map((m) => m.id), "2026-11-11", melo.ctx);
    await melo.depot.enregistrerBudget(plan);
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();

    heure.avancer();
    const [moi, elle] = plan.personnes;
    await melo.depot.enregistrerBudget({ ...plan, personnes: [{ ...moi, revenu: 5000 }, elle] });
    heure.avancer();
    await sarah.depot.enregistrerBudget({ ...plan, personnes: [moi, { ...elle, revenu: 4800 }], partPlaisir: 0.2 });
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();
    await melo.synchro.synchroniser();

    for (const tel of [melo, sarah]) {
      const [doc] = (await tel.depot.lireBudget()) as PlanBudget[];
      expect(doc.personnes.map((p) => p.revenu)).toEqual([5000, 4800]);
      expect(doc.partPlaisir).toBe(0.2);
    }
  });

  it("un téléphone dont l'horloge retarde ne perd plus ce qu'il modifie", async () => {
    const { serveur, heure, melo, courses } = await foyerPartage();
    const lait = nouvelElement(courses, "lait", null, melo.ctx);
    await melo.depot.enregistrerElement(lait);
    await melo.synchro.synchroniser();
    heure.avancer(30);
    await melo.depot.enregistrerElement({ ...lait, quantite: "2 l" });
    await melo.synchro.synchroniser();
    // D'autres écritures passent ensuite : le lait n'est plus dans ce que le prochain passage relit.
    for (const texte of ["pain", "riz", "thé", "sel", "miel", "noix"]) await melo.depot.enregistrerElement(nouvelElement(courses, texte, null, melo.ctx));
    await melo.synchro.synchroniser();

    // L'iPad a dix minutes de retard : avant la 0.1.12, le serveur refusait sa coche sans rien dire.
    const enRetard = { lire: () => new Date(Date.parse(heure.lire()) - 10 * 60000).toISOString(), avancer: heure.avancer };
    const ipad = telephone("ipad", serveur, enRetard);
    await ipad.synchro.rejoindre((await melo.depot.lireFoyer())!.id);
    const vu = (await ipad.depot.lireElements()).find((e) => e.id === lait.id)!;
    await ipad.depot.enregistrerElement(basculerCoche(vu, ipad.ctx));
    await ipad.synchro.synchroniser();
    expect(await ipad.depot.lireEnAttente()).toEqual([]);
    await melo.synchro.synchroniser();

    const leLait = async (tel: typeof melo) => (await tel.depot.lireElements()).find((e) => e.id === lait.id);
    for (const tel of [melo, ipad]) expect(await leLait(tel)).toMatchObject({ coche: true, quantite: "2 l" });

    // Et ce qu'il efface reste effacé.
    for (const texte of ["café", "lard", "orge", "figues", "kiwis", "noisettes"]) await melo.depot.enregistrerElement(nouvelElement(courses, texte, null, melo.ctx));
    await melo.synchro.synchroniser();
    await ipad.synchro.synchroniser();
    await ipad.depot.supprimerElements([lait.id]);
    await ipad.synchro.synchroniser();
    await melo.synchro.synchroniser();
    for (const tel of [melo, ipad]) expect(await leLait(tel)).toBeUndefined();
  });

  it("l'autre écrit entre la lecture et l'envoi : la modification refusée se joint à la sienne au lieu de se perdre", async () => {
    const { serveur, heure, melo, sarah, courses } = await foyerPartage();
    const lait = nouvelElement(courses, "lait", null, melo.ctx);
    await melo.depot.enregistrerElement(lait);
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();

    heure.avancer();
    await melo.depot.enregistrerElement({ ...lait, quantite: "2 l" });
    heure.avancer();
    await sarah.depot.enregistrerElement(basculerCoche(lait, sarah.ctx));
    // Sarah passe juste après la lecture de Melo, avant son envoi.
    const lire = serveur.distant.lire;
    serveur.distant.lire = async (foyerId, depuis) => {
      const lu = await lire(foyerId, depuis);
      serveur.distant.lire = lire;
      await sarah.synchro.synchroniser();
      return lu;
    };
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();

    for (const tel of [melo, sarah]) {
      const [element] = await tel.depot.lireElements();
      expect(element).toMatchObject({ coche: true, quantite: "2 l" });
      expect(await tel.depot.lireEnAttente()).toEqual([]);
    }
  });

  it("une modification écrite pendant l'envoi garde sa base et repart au passage suivant", async () => {
    const { serveur, heure, melo, sarah, courses } = await foyerPartage();
    const lait = nouvelElement(courses, "lait", null, melo.ctx);
    await melo.depot.enregistrerElement(lait);
    const envoyer = serveur.distant.envoyer;
    serveur.distant.envoyer = async (foyerId, changements) => {
      serveur.distant.envoyer = envoyer;
      const refuses = await envoyer(foyerId, changements);
      heure.avancer();
      await melo.depot.enregistrerElement({ ...lait, quantite: "2 l" });
      return refuses;
    };
    await melo.synchro.synchroniser();
    expect(await melo.depot.lireEnAttente()).toHaveLength(1);
    await melo.synchro.synchroniser();
    await sarah.synchro.synchroniser();
    expect((await sarah.depot.lireElements())[0].quantite).toBe("2 l");
    expect(await melo.depot.lireEnAttente()).toEqual([]);
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
