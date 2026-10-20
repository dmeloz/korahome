import { describe, expect, it } from "vitest";
import { deuxChiffres, NOMS_JOURS, NOMS_MOIS, sansAccents } from "./texte";

describe("les outils de texte", () => {
  it("retire les accents sans toucher à la casse", () => {
    expect(sansAccents("Pâtes fraîches, Noël, août")).toBe("Pates fraiches, Noel, aout");
  });
  it("donne les mois et les jours dans l'ordre du calendrier", () => {
    expect(NOMS_MOIS[7]).toBe("août");
    expect(NOMS_JOURS[new Date("2026-10-20T12:00").getDay()]).toBe("mardi");
  });
  it("écrit les nombres sur deux chiffres", () => {
    expect(deuxChiffres(7)).toBe("07");
    expect(deuxChiffres(12)).toBe("12");
  });
});
