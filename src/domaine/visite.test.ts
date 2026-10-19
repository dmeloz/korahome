import { describe, expect, it } from "vitest";
import { etapesVisibles, parcoursVisite, placementBulle, progression, type CibleVisite } from "./visite";

describe("la visite guidée", () => {
  it("commence par la bienvenue et finit sur les réglages, où elle se relance", () => {
    const etapes = parcoursVisite("Sarah");
    expect(etapes[0].id).toBe("bienvenue");
    expect(etapes.at(-1)?.cible).toBe("reglages");
    expect(etapes.at(-1)?.texte).toContain("se relance");
  });

  it("parle de l'autre par son prénom, ou de « l'autre » sans prénom", () => {
    expect(parcoursVisite("Sarah").find((e) => e.id === "bandeau")?.texte).toContain("écrire à Sarah");
    expect(parcoursVisite(null).find((e) => e.id === "bandeau")?.texte).toContain("écrire à l'autre");
  });

  it("chaque étape a un identifiant unique et un texte court", () => {
    const etapes = parcoursVisite("Sarah");
    expect(new Set(etapes.map((e) => e.id)).size).toBe(etapes.length);
    for (const e of etapes) expect(e.texte.length).toBeLessThanOrEqual(180);
  });

  it("montre les quatre gestes de Kora", () => {
    const gestes = parcoursVisite(null).find((e) => e.id === "gestes")?.gestes ?? [];
    expect(gestes.map((g) => g.picto)).toEqual(["droite", "gauche", "appui", "bord"]);
  });

  it("saute une étape dont la cible n'est pas à l'écran", () => {
    const presentes = new Set<CibleVisite>(["bandeau", "aujourdhui", "barre", "chercher", "reglages"]);
    const ids = etapesVisibles(parcoursVisite(null), presentes).map((e) => e.id);
    expect(ids).not.toContain("pages");
    expect(ids).not.toContain("widget");
    expect(ids).toContain("bienvenue");
    expect(ids).toContain("gestes");
  });

  it("dit où l'on en est", () => {
    expect(progression(0, 9)).toBe("1 sur 9");
    expect(progression(8, 9)).toBe("9 sur 9");
  });

  it("pose la bulle sous une cible du haut, au-dessus d'une cible du bas", () => {
    expect(placementBulle({ haut: 40, bas: 90 }, 800)).toBe("dessous");
    expect(placementBulle({ haut: 720, bas: 780 }, 800)).toBe("dessus");
    expect(placementBulle(null, 800)).toBe("milieu");
  });
});
