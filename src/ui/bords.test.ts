import { describe, expect, it } from "vitest";
import { hauteurClavier } from "./bords";

describe("hauteurClavier", () => {
  it("rend la hauteur du clavier ouvert", () => {
    expect(hauteurClavier(900, { height: 560, offsetTop: 0 })).toBe(340);
  });
  it("rend 0 clavier fermé ou pour un petit écart", () => {
    expect(hauteurClavier(900, { height: 900, offsetTop: 0 })).toBe(0);
    expect(hauteurClavier(900, { height: 850, offsetTop: 0 })).toBe(0);
  });
  it("ignore la hauteur absurde que l'iPhone Duo donne après un pli", () => {
    expect(hauteurClavier(678, { height: -33_554_432, offsetTop: 0 })).toBe(0);
    expect(hauteurClavier(678, { height: 0, offsetTop: 0 })).toBe(0);
    expect(hauteurClavier(678, { height: Number.NaN, offsetTop: 0 })).toBe(0);
    expect(hauteurClavier(678, { height: 2000, offsetTop: 0 })).toBe(0);
  });
});
