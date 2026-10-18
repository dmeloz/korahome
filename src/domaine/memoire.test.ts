import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { corrigerSouvenir, decrireMemoire, nouveauSouvenir, SOUVENIRS_ENVOYES, souvenirSemblable, trouverSouvenir } from "./memoire";

const ctx = () => contexteTest("2026-10-15T09:00:00.000Z");

describe("la mémoire de Jarvis", () => {
  it("retient une phrase propre, avec sa majuscule", () => {
    const s = nouveauSouvenir("  sarah n'aime   pas la coriandre ", "demande", "melo", ctx());
    expect(s).toMatchObject({ texte: "Sarah n'aime pas la coriandre", source: "demande", auteur: "melo" });
    expect(() => nouveauSouvenir("   ", "demande", null, ctx())).toThrow();
    expect(corrigerSouvenir(s, "Sarah adore le basilic").texte).toBe("Sarah adore le basilic");
  });

  it("reconnaît un fait déjà retenu, sans tenir compte des accents ni de la ponctuation", () => {
    const s = nouveauSouvenir("Les courses se font le samedi", "demande", null, ctx());
    expect(souvenirSemblable([s], "les courses se font le Samedi.")).toBe(s);
    expect(souvenirSemblable([s], "Les courses se font le dimanche")).toBeUndefined();
    expect(trouverSouvenir([s], "courses se font le samedi")).toBe(s);
    expect(trouverSouvenir([s], "")).toBeUndefined();
  });

  it("se décrit pour Jarvis, en gardant les plus récents", () => {
    expect(decrireMemoire([])).toEqual(["Ce que tu sais du foyer : rien encore."]);
    const c = ctx();
    const beaucoup = Array.from({ length: SOUVENIRS_ENVOYES + 5 }, (_, i) => nouveauSouvenir(`fait ${i}`, "demande", null, c));
    const lignes = decrireMemoire(beaucoup);
    expect(lignes).toHaveLength(SOUVENIRS_ENVOYES + 1);
    expect(lignes[1]).toBe("- Fait 5");
  });
});
