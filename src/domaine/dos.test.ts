import { describe, expect, it } from "vitest";
import { dosRecette, LIGNES_DOS } from "./dos";

describe("le dos des cartes", () => {
  const ing = (nom: string, quantite: string | null = null) => ({ nom, quantite });

  it("montre ce qui manque d'abord, puis le reste avec sa quantité", () => {
    const lignes = dosRecette({ ingredients: [ing("Riz arborio", "160 g"), ing("Parmesan", "40 g")] }, []);
    expect(lignes.every((l) => l.manque)).toBe(true);
    expect(lignes[0].fin).toBe("manque");
  });

  it("tient en quatre lignes, la dernière compte le reste", () => {
    const lignes = dosRecette({ ingredients: ["Riz", "Champignons", "Bouillon", "Parmesan", "Échalote", "Vin blanc"].map((n) => ing(n)) }, []);
    expect(lignes.length).toBe(LIGNES_DOS);
    expect(lignes[LIGNES_DOS - 1].texte).toBe("et 3 autres");
  });

  it("n'a rien à montrer pour une recette sans ingrédient", () => {
    expect(dosRecette({ ingredients: [] }, [])).toEqual([]);
  });
});
