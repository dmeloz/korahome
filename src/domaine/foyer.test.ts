import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { creerFoyer, ErreurValidation, listesInitiales } from "./foyer";

describe("creerFoyer", () => {
  it("crée un foyer avec ses membres, couleurs distinctes", () => {
    const f = creerFoyer("  Chez nous ", ["Melo", " Sara "], contexteTest());
    expect(f.nom).toBe("Chez nous");
    expect(f.membres.map((m) => m.prenom)).toEqual(["Melo", "Sara"]);
    expect(f.membres[0].couleur).not.toBe(f.membres[1].couleur);
  });

  it("ignore les prénoms vides", () => {
    const f = creerFoyer("Maison", ["Melo", "  "], contexteTest());
    expect(f.membres).toHaveLength(1);
  });

  it("refuse un nom vide, aucun membre ou un doublon", () => {
    expect(() => creerFoyer(" ", ["Melo"], contexteTest())).toThrow(ErreurValidation);
    expect(() => creerFoyer("Maison", [""], contexteTest())).toThrow(ErreurValidation);
    expect(() => creerFoyer("Maison", ["Melo", "melo"], contexteTest())).toThrow(/deux fois/);
  });
});

describe("listesInitiales", () => {
  it("commence par une liste de courses", () => {
    const [courses] = listesInitiales(contexteTest());
    expect(courses.type).toBe("courses");
    expect(courses.nom).toBe("Courses");
  });
});
