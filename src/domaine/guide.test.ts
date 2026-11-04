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
    expect(pages[3].titre).toBe("Navi vient à toi");
    expect(pages[pages.length - 1].dessin).toBe("fin");
    for (const p of pages) expect(p.texte.length).toBeLessThan(170);
  });
});
