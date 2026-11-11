import { describe, expect, it } from "vitest";
import { DUREES, estTouchee, toucheDe } from "./langage";

describe("le langage des gestes", () => {
  it("sait ce que montre une carte : ce qu'elle dit, sinon ce que montre son widget", () => {
    expect(toucheDe(undefined, "courses")).toBe("elements");
    expect(toucheDe("taches", "fil")).toBe("taches");
    expect(toucheDe(undefined, "fil")).toBeUndefined();
    expect(toucheDe()).toBeUndefined();
  });

  it("fait respirer la carte de ce que Tael a touché, pas les autres", () => {
    const touchees = new Set(["elements", "maison"]);
    expect(estTouchee("elements", touchees)).toBe(true);
    expect(estTouchee("taches maison", touchees)).toBe(true);
    expect(estTouchee("budget", touchees)).toBe(false);
    expect(estTouchee(undefined, touchees)).toBe(false);
  });

  it("garde chaque geste sous la demi-seconde", () => {
    for (const duree of Object.values(DUREES)) expect(duree).toBeLessThan(500);
  });
});
