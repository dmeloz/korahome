import { describe, expect, it } from "vitest";
import { cartesTouchees, DUREES } from "./langage";

describe("le langage des gestes", () => {
  it("fait respirer la carte de ce que Tael a touché, une fois chacune", () => {
    expect(cartesTouchees(["elements", "taches", "elements"])).toEqual(["courses", "listes", "taches", "entretien"]);
    expect(cartesTouchees(["menus", "budget"])).toEqual(["chef", "budget"]);
  });

  it("ne cherche aucune carte pour ce qui n'en a pas", () => {
    expect(cartesTouchees(["memoire", "retours"])).toEqual([]);
  });

  it("garde chaque geste sous la demi-seconde", () => {
    for (const duree of Object.values(DUREES)) expect(duree).toBeLessThan(500);
  });
});
