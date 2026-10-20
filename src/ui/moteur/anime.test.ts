import { describe, expect, it } from "vitest";
import { courbeRessort } from "./anime";

describe("courbeRessort", () => {
  it("donne une courbe CSS qui part de 0, dépasse un peu et finit à 1", () => {
    const { courbe, duree } = courbeRessort("fee");
    const valeurs = courbe.slice(7, -1).split(", ").map(Number);
    expect(courbe.startsWith("linear(")).toBe(true);
    expect(valeurs[0]).toBe(0);
    expect(valeurs[valeurs.length - 1]).toBe(1);
    expect(Math.max(...valeurs)).toBeGreaterThan(1);
    expect(duree).toBeGreaterThan(300);
    expect(duree).toBeLessThan(1500);
  });

  it("rebondit moins pour une ligne que pour la fée", () => {
    const max = (nom: "fee" | "ligne") => Math.max(...courbeRessort(nom).courbe.slice(7, -1).split(", ").map(Number));
    expect(max("ligne")).toBeLessThan(max("fee"));
  });
});
