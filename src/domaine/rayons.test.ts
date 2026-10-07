import { describe, expect, it } from "vitest";
import { detecterRayon } from "./rayons";

describe("detecterRayon", () => {
  it.each([
    ["Lait", "Crèmerie"],
    ["Œufs", "Crèmerie"],
    ["Pommes de terre", "Fruits et légumes"],
    ["Pommes", "Fruits et légumes"],
    ["Laitue", "Fruits et légumes"],
    ["Baguette", "Boulangerie"],
    ["Pâtes", "Épicerie salée"],
    ["Thon en boîte", "Épicerie salée"],
    ["Pavé de saumon", "Boucherie et poisson"],
    ["Liquide vaisselle", "Entretien"],
    ["Dentifrice", "Hygiène"],
    ["Café", "Boissons"],
    ["Gâteau au chocolat", "Épicerie sucrée"],
    ["Ampoule", "Autre"],
  ])("%s → %s", (texte, rayon) => {
    expect(detecterRayon(texte)).toBe(rayon);
  });

  it("ne confond pas un mot-clé au milieu d'un mot", () => {
    expect(detecterRayon("Gâteau")).toBe("Épicerie sucrée");
  });
});
