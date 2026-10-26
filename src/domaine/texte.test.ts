import { describe, expect, it } from "vitest";
import { deuxChiffres, NOMS_JOURS, NOMS_MOIS, resumeAide, sansAccents } from "./texte";

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

describe("la ligne d'une aide repliée", () => {
  it("s'arrête avant l'exemple, la parenthèse ou la deuxième phrase", () => {
    expect(resumeAide("Écris sous la liste, ou dis-le à ta fée : « 2 kg de pommes ». « Choisir » en haut.")).toBe("Écris sous la liste, ou dis-le à ta fée");
    expect(resumeAide("Dis-le à ta fée comme tu le dirais (un appui long sur elle pour l'écrire) : « Dentiste jeudi 14h30 ».")).toBe("Dis-le à ta fée comme tu le dirais");
    expect(resumeAide("Chaque zone a son soleil et ses plantes. Kora te dit quand arroser.")).toBe("Chaque zone a son soleil et ses plantes");
  });

  it("garde une aide courte entière", () => {
    expect(resumeAide("Les tailles de chacun, partagées.")).toBe("Les tailles de chacun, partagées.");
  });
});
