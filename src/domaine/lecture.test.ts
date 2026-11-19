import { describe, expect, it } from "vitest";
import { barreSous, ecartAuBudget, pasSuivant, plusProche } from "./lecture";

describe("la lecture au doigt", () => {
  it("prend le point le plus proche du doigt", () => {
    expect(plusProche([0, 10, 20, 30], 14)).toBe(1);
    expect(plusProche([0, 10, 20, 30], 16)).toBe(2);
    expect(plusProche([0, 10, 20, 30], -50)).toBe(0);
    expect(plusProche([0, 10, 20, 30], 99)).toBe(3);
    expect(plusProche([], 5)).toBe(-1);
  });

  it("trouve la barre sous le doigt, sans sortir du graphique", () => {
    expect(barreSous(0, 12)).toBe(0);
    expect(barreSous(0.5, 12)).toBe(6);
    expect(barreSous(1, 12)).toBe(11);
    expect(barreSous(-0.2, 12)).toBe(0);
    expect(barreSous(0.3, 0)).toBe(-1);
  });

  it("avance d'un point aux flèches, en partant du bon bout", () => {
    expect(pasSuivant(-1, 5, 1)).toBe(0);
    expect(pasSuivant(-1, 5, -1)).toBe(4);
    expect(pasSuivant(4, 5, 1)).toBe(4);
    expect(pasSuivant(0, 5, -1)).toBe(0);
    expect(pasSuivant(2, 5, 1)).toBe(3);
  });

  it("compare un mois de courses au budget", () => {
    expect(ecartAuBudget(1010, 900)).toBe("au-dessus");
    expect(ecartAuBudget(610, 900)).toBe("dessous");
    expect(ecartAuBudget(900.3, 900)).toBe("pile");
    expect(ecartAuBudget(500, 0)).toBeNull();
  });
});
