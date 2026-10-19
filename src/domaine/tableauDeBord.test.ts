import { describe, expect, it } from "vitest";
import {
  CATALOGUE,
  destinationBulle,
  ESPACES,
  modulesDeLEspace,
  DISPOSITION_DE_DEPART,
  ajouterWidget,
  deplacerWidget,
  nettoyerDisposition,
  ordreAffichage,
  retirerWidget,
  widgetsAAjouter,
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

  it("monte et descend un widget, sans sortir du tableau", () => {
    expect(deplacerWidget(["taches", "courses", "listes"], "listes", -1)).toEqual(["taches", "listes", "courses"]);
    expect(deplacerWidget(["taches", "courses"], "taches", 1)).toEqual(["courses", "taches"]);
    expect(deplacerWidget(["taches", "courses"], "taches", -1)).toEqual(["taches", "courses"]);
  });

  it("sépare ce qu'on peut ajouter de ce qui arrive bientôt", () => {
    const { prets, bientot } = widgetsAAjouter(["taches"]);
    expect(prets.map((w) => w.id)).toEqual(["courses", "listes", "agenda", "mitsu", "stock", "entretien", "jardin", "chef", "budget"]);
    expect(bientot.map((w) => w.id)).toEqual(["infos"]);
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

describe("les bulles des espaces", () => {
  it("range chaque module dans un seul espace", () => {
    const ranges = ESPACES.flatMap((e) => e.widgets);
    expect(new Set(ranges).size).toBe(ranges.length);
    expect([...ranges].sort()).toEqual(CATALOGUE.map((w) => w.id).sort());
  });

  it("ouvre la page de l'espace, ou directement le module quand il est seul", () => {
    expect(destinationBulle("menage")).toEqual({ type: "espace", id: "menage" });
    expect(modulesDeLEspace("cuisine")).toEqual(["chef", "stock"]);
    // Les infos de la maison ne sont pas encore prêtes : le Budget est seul dans son espace.
    expect(destinationBulle("budget")).toEqual({ type: "module", id: "budget" });
    expect(destinationBulle("agenda")).toEqual({ type: "module", id: "agenda" });
  });
});
