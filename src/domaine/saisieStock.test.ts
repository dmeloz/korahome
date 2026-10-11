import { describe, expect, it } from "vitest";
import { comprendreSaisie } from "./saisieStock";

// Le 11 octobre 2026 est un dimanche.
const aujourdhui = "2026-10-11";
const lire = (texte: string) => comprendreSaisie(texte, aujourdhui);

describe("comprendre une phrase de stock", () => {
  it("lit le nom seul", () => {
    expect(lire("lait")).toEqual({ nom: "Lait", nombre: null, unite: null, lieu: null, peremption: null });
  });

  it("lit la quantité, le lieu et le jour", () => {
    expect(lire("2 yaourts au frigo jusqu'à vendredi")).toEqual({
      nom: "Yaourts",
      nombre: 2,
      unite: "piece",
      lieu: "frigo",
      peremption: "2026-10-16",
    });
  });

  it("lit les unités et une durée", () => {
    expect(lire("500 g de beurre congélo 3 mois")).toMatchObject({ nom: "Beurre", nombre: 500, unite: "g", lieu: "congelateur", peremption: "2027-01-11" });
    expect(lire("1,5 l lait")).toMatchObject({ nom: "Lait", nombre: 1.5, unite: "l" });
    expect(lire("33 cl de jus d'orange")).toMatchObject({ nom: "Jus d'orange", nombre: 330, unite: "ml" });
    expect(lire("riz 2 kg placard")).toMatchObject({ nom: "Riz", nombre: 2, unite: "kg", lieu: "placard" });
  });

  it("comprend les nombres dictés", () => {
    expect(lire("deux yaourts demain")).toMatchObject({ nom: "Yaourts", nombre: 2, peremption: "2026-10-12" });
    expect(lire("une douzaine d'oeufs")).toMatchObject({ nom: "Oeufs", nombre: 12 });
  });

  it("comprend les dates écrites", () => {
    expect(lire("jambon 14.10").peremption).toBe("2026-10-14");
    expect(lire("jambon 3/10").peremption).toBe("2027-10-03");
    expect(lire("crème jusqu'au 20 octobre").peremption).toBe("2026-10-20");
    expect(lire("crème le 5").peremption).toBe("2026-11-05");
    expect(lire("pain dans 2 jours").peremption).toBe("2026-10-13");
    expect(lire("glace 1 an congélateur")).toMatchObject({ nom: "Glace", peremption: "2027-10-11", lieu: "congelateur" });
  });

  it("un jour de la semaine est toujours à venir", () => {
    expect(lire("poulet dimanche").peremption).toBe("2026-10-18");
    expect(lire("poulet lundi").peremption).toBe("2026-10-12");
  });

  it("ne prend pas un nom pour une quantité", () => {
    expect(lire("pain de mie")).toMatchObject({ nom: "Pain de mie", nombre: null });
  });
});
