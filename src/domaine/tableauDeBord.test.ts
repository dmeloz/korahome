import { describe, expect, it } from "vitest";
import {
  DISPOSITION_DE_DEPART,
  ajouterWidget,
  deplacerWidget,
  nettoyerDisposition,
  ordreAffichage,
  retirerWidget,
  widgetsAAjouter,
} from "./tableauDeBord";

describe("tableau de bord", () => {
  it("commence avec les tâches, les courses et les autres listes", () => {
    expect(DISPOSITION_DE_DEPART).toEqual(["taches", "courses", "listes"]);
  });

  it("relit une disposition enregistrée sans garder l'inconnu, les doublons ni ce qui n'est pas prêt", () => {
    expect(nettoyerDisposition(["courses", "meteo", "courses", "agenda", "taches"])).toEqual(["courses", "taches"]);
    expect(nettoyerDisposition("n'importe quoi")).toEqual(DISPOSITION_DE_DEPART);
    expect(nettoyerDisposition([])).toEqual([]);
  });

  it("ajoute et retire un widget", () => {
    const sansCourses = retirerWidget(DISPOSITION_DE_DEPART, "courses");
    expect(sansCourses).toEqual(["taches", "listes"]);
    expect(ajouterWidget(sansCourses, "courses")).toEqual(["taches", "listes", "courses"]);
    expect(ajouterWidget(sansCourses, "taches")).toBe(sansCourses);
  });

  it("refuse une section qui n'existe pas encore", () => {
    expect(ajouterWidget(["taches"], "agenda")).toEqual(["taches"]);
  });

  it("monte et descend un widget, sans sortir du tableau", () => {
    expect(deplacerWidget(["taches", "courses", "listes"], "listes", -1)).toEqual(["taches", "listes", "courses"]);
    expect(deplacerWidget(["taches", "courses"], "taches", 1)).toEqual(["courses", "taches"]);
    expect(deplacerWidget(["taches", "courses"], "taches", -1)).toEqual(["taches", "courses"]);
  });

  it("sépare ce qu'on peut ajouter de ce qui arrive bientôt", () => {
    const { prets, bientot } = widgetsAAjouter(["taches"]);
    expect(prets.map((w) => w.id)).toEqual(["courses", "listes"]);
    expect(bientot.map((w) => w.id)).toEqual(["agenda", "mitsu", "stock", "jardin"]);
  });

  it("fait remonter l'urgent en gardant l'ordre choisi pour le reste", () => {
    const d = ["courses", "listes", "taches"] as const;
    expect(ordreAffichage([...d], new Set(["taches"]))).toEqual(["taches", "courses", "listes"]);
    expect(ordreAffichage([...d], new Set())).toEqual(["courses", "listes", "taches"]);
  });
});
