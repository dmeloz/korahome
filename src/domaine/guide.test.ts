import { describe, expect, it } from "vitest";
import { guideAMontrer, pagesGuide, VERSION_GUIDE } from "./guide";

describe("le guide de première ouverture", () => {
  it("se montre tant que la version en cours n'a pas été vue", () => {
    expect(guideAMontrer(null)).toBe(true);
    expect(guideAMontrer("0.0")).toBe(true);
    expect(guideAMontrer(VERSION_GUIDE)).toBe(false);
  });

  it("nomme la fée du téléphone et finit par l'invitation", () => {
    const pages = pagesGuide("Navi");
    expect(pages.length).toBe(5);
    expect(pages[3].titre).toBe("Dis-le à Navi, une fois");
    expect(pages[3].exemples?.[0].etiquette).toBe("Navi a fait");
    expect(pages[pages.length - 1].dessin).toBe("fin");
    for (const p of pages) expect(p.texte.length).toBeLessThan(170);
  });

  it("dit ce que Kora fait, sans « Bienvenue », avec deux exemples au plus par page", () => {
    const pages = pagesGuide("Tael");
    expect(pages[0].titre).not.toMatch(/bienvenue/i);
    for (const p of pages) {
      expect(p.titre.length).toBeLessThanOrEqual(30);
      expect(p.exemples?.length ?? 0).toBeLessThanOrEqual(2);
    }
  });
});
