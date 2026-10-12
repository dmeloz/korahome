import { describe, expect, it } from "vitest";
import {
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
    expect(prets.map((w) => w.id)).toEqual(["courses", "listes", "mitsu", "stock", "entretien"]);
    expect(bientot.map((w) => w.id)).toEqual(["agenda", "jardin"]);
  });

  it("fait remonter l'urgent en gardant l'ordre choisi pour le reste", () => {
    const d = ["courses", "listes", "taches"] as const;
    expect(ordreAffichage([...d], new Set(["taches"]))).toEqual(["taches", "courses", "listes"]);
    expect(ordreAffichage([...d], new Set())).toEqual(["courses", "listes", "taches"]);
  });
});

describe("taille et glisser des widgets", () => {
  it("un widget est grand tant qu'on ne l'a pas réduit", () => {
    expect(tailleDe({}, "taches")).toBe("grand");
    const petit = basculerTaille({}, "taches");
    expect(tailleDe(petit, "taches")).toBe("petit");
    expect(tailleDe(basculerTaille(petit, "taches"), "taches")).toBe("grand");
  });

  it("relit les tailles en ignorant le reste", () => {
    expect(nettoyerTailles({ taches: "petit", courses: "grand", inconnu: "petit" })).toEqual({ taches: "petit" });
    expect(nettoyerTailles("n'importe quoi")).toEqual({});
  });

  it("glisse un widget à la place d'un autre, vers le haut comme vers le bas", () => {
    const d: Disposition = ["taches", "courses", "listes", "mitsu"];
    expect(deplacerVers(d, "mitsu", "courses")).toEqual(["taches", "mitsu", "courses", "listes"]);
    expect(deplacerVers(d, "taches", "listes")).toEqual(["courses", "listes", "taches", "mitsu"]);
    expect(deplacerVers(d, "taches", "taches")).toBe(d);
  });
});
