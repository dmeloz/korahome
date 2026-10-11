import { describe, expect, it } from "vitest";
import { estCodeBarres, lireFiche } from "./openFoodFacts";

describe("fiche Open Food Facts", () => {
  it("lit le nom, la marque, la contenance, le lieu et la photo", () => {
    const reponse = {
      status: 1,
      product: {
        product_name_fr: "Yogourt nature",
        brands: "Emmi, Migros",
        quantity: "180 g",
        image_front_small_url: "https://images.openfoodfacts.org/a.jpg",
        categories_tags: ["en:dairies", "en:yogurts"],
      },
    };
    expect(lireFiche("7610000000000", reponse)).toEqual({
      code: "7610000000000",
      nom: "Yogourt nature Emmi",
      nombre: 180,
      unite: "g",
      lieu: "frigo",
      image: "https://images.openfoodfacts.org/a.jpg",
    });
  });

  it("convertit les centilitres et reconnaît le surgelé", () => {
    expect(lireFiche("1", { product: { product_name: "Eau", quantity: "50 cl" } })).toMatchObject({ nombre: 500, unite: "ml", lieu: null });
    expect(lireFiche("1", { product: { product_name: "Épinards", categories_tags: ["en:frozen-foods"] } })).toMatchObject({ lieu: "congelateur" });
  });

  it("rien quand le produit est inconnu", () => {
    expect(lireFiche("1", { status: 0 })).toBeNull();
    expect(lireFiche("1", { status: 1, product: { product_name: "" } })).toBeNull();
  });

  it("reconnaît un code-barres", () => {
    expect(estCodeBarres("7610000000000")).toBe(true);
    expect(estCodeBarres("12345678")).toBe(true);
    expect(estCodeBarres("abc")).toBe(false);
  });
});
