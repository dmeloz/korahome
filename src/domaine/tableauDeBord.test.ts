import { describe, expect, it } from "vitest";
import {
  CATALOGUE,
  ESPACES,
  modulesCherches,
  modulesDeLEspace,
  poserWidget,
  DISPOSITION_DE_DEPART,
  ajouterWidget,
  nettoyerDisposition,
  ordreAffichage,
  retirerWidget,
  basculerTaille,
  deplacerVers,
  nettoyerTailles,
  tailleDe,
  type Disposition,
} from "./tableauDeBord";

describe("tableau de bord", () => {
  it("commence avec les tâches, les courses et les autres listes", () => {
    expect(DISPOSITION_DE_DEPART).toEqual(["taches", "courses", "listes"]);
  });

  it("relit une disposition enregistrée sans garder l'inconnu ni les doublons", () => {
    expect(nettoyerDisposition(["courses", "meteo", "courses", "agenda", "taches"])).toEqual(["courses", "agenda", "taches"]);
    expect(nettoyerDisposition("n'importe quoi")).toEqual(DISPOSITION_DE_DEPART);
    expect(nettoyerDisposition([])).toEqual([]);
  });

  it("ajoute et retire un widget", () => {
    const sansCourses = retirerWidget(DISPOSITION_DE_DEPART, "courses");
    expect(sansCourses).toEqual(["taches", "listes"]);
    expect(ajouterWidget(sansCourses, "courses")).toEqual(["taches", "listes", "courses"]);
    expect(ajouterWidget(sansCourses, "taches")).toBe(sansCourses);
  });

  it("ajoute l'agenda commun, désormais prêt", () => {
    expect(ajouterWidget(["taches"], "agenda")).toEqual(["taches", "agenda"]);
  });

  it("fait remonter l'urgent en gardant l'ordre choisi pour le reste", () => {
    const d = ["courses", "listes", "taches"] as const;
    expect(ordreAffichage([...d], new Set(["taches"]))).toEqual(["taches", "courses", "listes"]);
    expect(ordreAffichage([...d], new Set())).toEqual(["courses", "listes", "taches"]);
  });
});

describe("taille et glisser des widgets", () => {
  it("un widget est grand tant qu'on ne l'a pas réduit", () => {
    expect(tailleDe({}, "taches")).toBe("petit");
    const grand = basculerTaille({}, "taches");
    expect(tailleDe(grand, "taches")).toBe("grand");
    expect(tailleDe(basculerTaille(grand, "taches"), "taches")).toBe("petit");
  });

  it("relit les tailles en ignorant le reste", () => {
    expect(nettoyerTailles({ taches: "petit", courses: "grand", inconnu: "grand" })).toEqual({ courses: "grand" });
    expect(nettoyerTailles("n'importe quoi")).toEqual({});
  });

  it("glisse un widget à la place d'un autre, vers le haut comme vers le bas", () => {
    const d: Disposition = ["taches", "courses", "listes", "mitsu"];
    expect(deplacerVers(d, "mitsu", "courses")).toEqual(["taches", "mitsu", "courses", "listes"]);
    expect(deplacerVers(d, "taches", "listes")).toEqual(["courses", "listes", "taches", "mitsu"]);
    expect(deplacerVers(d, "taches", "taches")).toBe(d);
  });
});

describe("tous les espaces", () => {
  it("range chaque module dans un seul espace", () => {
    const ranges = ESPACES.flatMap((e) => e.widgets);
    expect(new Set(ranges).size).toBe(ranges.length);
    expect([...ranges].sort()).toEqual(CATALOGUE.map((w) => w.id).sort());
  });

  it("ne garde que les modules prêts de chaque espace", () => {
    expect(modulesDeLEspace("cuisine")).toEqual(["chef", "stock"]);
    expect(modulesDeLEspace("budget")).toEqual(["budget"]);
  });

  it("retrouve un module par son nom ou par un mot de tous les jours", () => {
    expect(modulesCherches("chat")).toEqual(["mitsu"]);
    expect(modulesCherches("argent")).toEqual(["budget"]);
    expect(modulesCherches("placard")).toEqual(["stock"]);
    expect(modulesCherches("véto")).toEqual(["mitsu"]);
    expect(modulesCherches("a")).toEqual([]);
  });

  it("pose un widget glissé à la place d'un autre, sans le dédoubler", () => {
    expect(poserWidget(["taches", "courses"], "budget", "courses")).toEqual(["taches", "budget", "courses"]);
    expect(poserWidget(["taches", "courses"], "budget", null)).toEqual(["taches", "courses", "budget"]);
    expect(poserWidget(["taches", "courses", "budget"], "budget", "taches")).toEqual(["budget", "taches", "courses"]);
  });
});
