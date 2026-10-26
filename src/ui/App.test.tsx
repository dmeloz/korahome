// @vitest-environment happy-dom
// L'app entière dans un navigateur simulé (happy-dom), avec le vrai dépôt sur un IndexedDB factice :
// ce que les données du foyer doivent faire apparaître à l'écran, sans passer par un iPhone.
// L'essai sur iPhone simulé (scripts/essai-ecrans.mjs) reste le filet des gestes et des styles.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contexteTest } from "../domaine/contexteTest";
import { creerFoyer, listesInitiales } from "../domaine/foyer";
import { nouvelElement } from "../domaine/listes";
import { nouvelleTache } from "../domaine/taches";
import { creerDepotLocal, type DepotLocal } from "../donnees/depotLocal";
import { App } from "./App";
import { choisirMembreCourant } from "./contexte";
import type { MiseAJour } from "./miseAJour";

const sansMiseAJour: MiseAJour = {
  prete: () => false,
  abonner: () => () => {},
  appliquer: async () => {},
  verifier: async () => ({ etat: "a-jour" }) as never,
};

// Les quatre chiffres de l'accueil, trouvés comme VoiceOver les lit.
const tuile = (nom: string) => screen.getByRole("button", { name: new RegExp(`^${nom} :`) });

let depot: DepotLocal;
beforeEach(() => {
  // Pas de réseau ici : la météo et le reste échouent sans bruit, comme hors ligne.
  vi.stubGlobal("fetch", () => Promise.reject(new TypeError("hors ligne")));
  localStorage.clear();
  depot = creerDepotLocal(`essai-${Math.random()}`, new IDBFactory());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function ouvrir() {
  render(<App depot={depot} miseAJour={sansMiseAJour} partage={null} />);
  // Le dépôt répond de façon asynchrone : on laisse passer les lectures.
  await act(async () => new Promise((fin) => setTimeout(fin, 50)));
}

async function foyerAvecCourses() {
  const ctx = contexteTest();
  const foyer = creerFoyer("Cassa", ["Melo", "Sarah"], ctx);
  await depot.enregistrerFoyer(foyer);
  const listes = listesInitiales(ctx);
  for (const l of listes) await depot.enregistrerListe(l);
  const courses = listes.find((l) => l.type === "courses")!;
  for (const texte of ["Lait", "Pain", "2 kg de pommes"]) await depot.enregistrerElement(nouvelElement(courses, texte, foyer.membres[0].id, ctx));
  choisirMembreCourant(foyer.membres[0].id);
  return { foyer, ctx };
}

describe("l'app entière", () => {
  it("accueille un téléphone neuf avec la création du foyer", async () => {
    await ouvrir();
    expect(screen.getAllByText(/Créer/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^Courses :/ })).toBeNull();
  });

  it("compte sur l'accueil les articles de la liste de courses", async () => {
    await foyerAvecCourses();
    await ouvrir();
    expect(tuile("Courses").getAttribute("aria-label")).toMatch(/^Courses : 3\b/);
  });

  it("ouvre les courses et montre chaque article, rangé par rayon", async () => {
    await foyerAvecCourses();
    await ouvrir();
    await act(async () => {
      fireEvent.click(tuile("Courses"));
      await new Promise((fin) => setTimeout(fin, 50));
    });
    for (const texte of ["Lait", "Pain", "Pommes"]) expect(screen.getAllByText(new RegExp(texte, "i")).length).toBeGreaterThan(0);
  });

  it("montre aussitôt un article ajouté par l'autre téléphone, sans tout relire", async () => {
    const { foyer, ctx } = await foyerAvecCourses();
    await ouvrir();
    const courses = (await depot.lireListes()).find((l) => l.type === "courses")!;
    await act(async () => {
      await depot.appliquer([{ collection: "elements", id: "beurre", donnees: { ...nouvelElement(courses, "Beurre", foyer.membres[1].id, ctx), id: "beurre" }, maj: ctx.maintenant() }]);
      await new Promise((fin) => setTimeout(fin, 50));
    });
    expect(tuile("Courses").getAttribute("aria-label")).toMatch(/^Courses : 4\b/);
  });

  it("dit sur l'accueil les tâches du jour", async () => {
    const { ctx } = await foyerAvecCourses();
    const aujourdhui = new Date().toISOString().slice(0, 10);
    await depot.enregistrerTache(nouvelleTache("Sortir le verre", null, aujourdhui, ctx));
    await ouvrir();
    expect(tuile("Tâches").getAttribute("aria-label")).toMatch(/^Tâches : 1\b/);
  });
});
