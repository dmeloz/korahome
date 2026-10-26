import { describe, expect, it } from "vitest";
import { nouveauteADire, NOUVEAUTES } from "./nouveautes";

describe("la nouveauté annoncée par la fée", () => {
  it("se dit une fois, sur un foyer qui vit déjà", () => {
    expect(nouveauteADire("0.0.78", null, true)?.ou).toEqual({ id: "maison", onglet: "vetements" });
    expect(nouveauteADire("0.0.78", "0.0.78", true)).toBeNull();
    expect(nouveauteADire("0.0.78", "0.0.76", true)).not.toBeNull();
  });

  it("se tait sur un foyer neuf, et pour une version sans nouveauté", () => {
    expect(nouveauteADire("0.0.78", null, false)).toBeNull();
    expect(nouveauteADire("0.0.99", null, true)).toBeNull();
  });

  it("chaque nouveauté tient en une bulle", () => {
    for (const n of NOUVEAUTES) expect(n.texte.length).toBeLessThanOrEqual(140);
  });
});
