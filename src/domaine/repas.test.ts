import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { nouvelleRecette } from "./recettes";
import {
  decrireRepasRecents,
  estRepas,
  idRepas,
  lirePhraseRepas,
  nomDuSoirPasse,
  noterRepas,
  repasDe,
  repasDuJour,
  repasRecents,
  TITRE_REPAS_MAX,
  type RepasMange,
} from "./repas";

const AUJOURDHUI = "2026-11-02"; // un lundi

const repas = (jour: string, titre: string): RepasMange => ({ id: idRepas(jour), type: "repas", jour, titre, recetteId: null, par: null, modifieLe: `${jour}T19:00:00Z` });

describe("noter le soir", () => {
  it("écrit une ligne par soir, nettoyée, avec qui l'a notée", () => {
    const r = noterRepas({ titre: "  pâtes   au pesto. ", jour: AUJOURDHUI, recettes: [], membreId: "melo" }, contexteTest());
    expect(r?.repas).toMatchObject({ id: "repas-2026-11-02", type: "repas", jour: AUJOURDHUI, titre: "Pâtes au pesto", recetteId: null, par: "melo" });
    expect(r?.recette).toBeNull();
  });

  it("refuse un titre vide et coupe un titre trop long", () => {
    expect(noterRepas({ titre: "  ", jour: AUJOURDHUI, recettes: [], membreId: null }, contexteTest())).toBeNull();
    const long = noterRepas({ titre: "a".repeat(200), jour: AUJOURDHUI, recettes: [], membreId: null }, contexteTest());
    expect(long?.repas.titre).toHaveLength(TITRE_REPAS_MAX);
  });

  it("compte une recette du foyer du même nom comme cuisinée, une seule fois par soir", () => {
    const ctx = contexteTest();
    const pesto = nouvelleRecette({ titre: "Pâtes au pesto", ingredients: [], etapes: [], source: "main" }, ctx);
    const r = noterRepas({ titre: "pates au pesto", jour: AUJOURDHUI, recettes: [pesto], membreId: null }, ctx);
    expect(r?.repas.recetteId).toBe(pesto.id);
    expect(r?.repas.titre).toBe("Pâtes au pesto");
    expect(r?.recette).toMatchObject({ id: pesto.id, fois: pesto.fois + 1, derniereFois: AUJOURDHUI });
    // Le même soir noté à nouveau ne compte pas deux fois.
    const encore = noterRepas({ titre: "Pâtes au pesto", jour: AUJOURDHUI, recettes: [r!.recette!], membreId: null }, ctx);
    expect(encore?.recette).toBeNull();
    expect(encore?.repas.recetteId).toBe(pesto.id);
  });

  it("ne prend pas une recette qui ne fait que ressembler", () => {
    const ctx = contexteTest();
    const pesto = nouvelleRecette({ titre: "Pâtes au pesto", ingredients: [], etapes: [], source: "main" }, ctx);
    const r = noterRepas({ titre: "pâtes", jour: AUJOURDHUI, recettes: [pesto], membreId: null }, ctx);
    expect(r?.repas.recetteId).toBeNull();
    expect(r?.recette).toBeNull();
  });
});

describe("lire le journal", () => {
  const docs = [repas("2026-10-30", "Raclette"), { type: "menu" }, repas(AUJOURDHUI, "Soupe"), repas("2026-11-01", "Pizza"), repas("2026-10-20", "Dahl"), repas("2026-10-12", "Fondue")];

  it("ne garde que les soirs, du plus récent au plus ancien", () => {
    expect(estRepas({ type: "recette" })).toBe(false);
    expect(repasDe(docs).map((r) => r.titre)).toEqual(["Soupe", "Pizza", "Raclette", "Dahl", "Fondue"]);
    expect(repasDuJour(docs, AUJOURDHUI)?.titre).toBe("Soupe");
    expect(repasDuJour(docs, "2026-10-31")).toBeNull();
  });

  it("montre les sept soirs d'avant, sans celui du jour", () => {
    expect(repasRecents(docs, AUJOURDHUI).map((r) => r.titre)).toEqual(["Pizza", "Raclette"]);
    expect(repasRecents(docs, AUJOURDHUI, 14).map((r) => r.titre)).toEqual(["Pizza", "Raclette", "Dahl"]);
  });

  it("nomme les soirs passés", () => {
    expect(nomDuSoirPasse("2026-11-01", AUJOURDHUI)).toBe("Hier");
    expect(nomDuSoirPasse("2026-10-30", AUJOURDHUI)).toBe("ven. 30");
  });

  it("dit au Chef ce qu'on a mangé ces deux semaines", () => {
    expect(decrireRepasRecents(docs, AUJOURDHUI)).toBe("Mangé ces derniers soirs (ne pas les reproposer) : pizza (hier), raclette (ven. 30), dahl (mar. 20).");
    expect(decrireRepasRecents([], AUJOURDHUI)).toBeNull();
  });
});

describe("la phrase dite à la fée", () => {
  it.each([
    ["ce soir on a mangé des pâtes au pesto", "pâtes au pesto", AUJOURDHUI],
    ["On a mangé une raclette", "raclette", AUJOURDHUI],
    ["j'ai cuisiné : un risotto aux champignons", "risotto aux champignons", AUJOURDHUI],
    ["mangé du poulet curry", "poulet curry", AUJOURDHUI],
    ["hier soir on a mangé de la soupe", "soupe", "2026-11-01"],
    ["hier, mangé des lentilles", "lentilles", "2026-11-01"],
    ["Hier soir raclette", "raclette", "2026-11-01"],
  ])("« %s »", (phrase, titre, jour) => {
    expect(lirePhraseRepas(phrase, AUJOURDHUI)).toEqual({ titre, jour });
  });

  it("laisse passer ce qui n'est pas un repas", () => {
    expect(lirePhraseRepas("ajoute du lait", AUJOURDHUI)).toBeNull();
    expect(lirePhraseRepas("qu'est-ce qu'on mange ce soir ?", AUJOURDHUI)).toBeNull();
    expect(lirePhraseRepas("on a mangé", AUJOURDHUI)).toBeNull();
  });
});
