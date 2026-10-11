import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import {
  ajuster,
  avecQuantite,
  calendrierDates,
  creerProduit,
  datesRapides,
  fraicheur,
  quantiteDe,
  decrirePeremption,
  deplacer,
  etatProduit,
  nouveauProduit,
  organiserStock,
  resumeStock,
  type Lieu,
} from "./stock";

const aujourdhui = "2026-10-11";
const ctx = contexteTest();
const produit = (texte: string, lieu: Lieu, peremption: string | null) => nouveauProduit({ texte, lieu, peremption }, "m1", ctx);

describe("ajouter un produit", () => {
  it("sépare la quantité du nom et garde le lieu et la date", () => {
    const p = produit("2 yaourts nature", "frigo", "2026-10-14");
    expect(p).toMatchObject({ nom: "Yaourts nature", quantite: "2", nombre: 2, unite: "piece", lieu: "frigo", peremption: "2026-10-14", ajoutePar: "m1" });
  });

  it("refuse un produit vide", () => {
    expect(() => produit("  ", "placard", null)).toThrow();
  });

  it("propose des dates d'un toucher", () => {
    expect(datesRapides(aujourdhui).map((d) => d.jour)).toEqual(["2026-10-12", "2026-10-14", "2026-10-18", "2026-11-11", "2027-01-11"]);
  });
});

describe("dates", () => {
  it("dit où en est chaque produit", () => {
    expect(etatProduit(produit("a", "frigo", "2026-10-09"), aujourdhui)).toBe("perime");
    expect(etatProduit(produit("a", "frigo", "2026-10-11"), aujourdhui)).toBe("aujourdhui");
    expect(etatProduit(produit("a", "frigo", "2026-10-14"), aujourdhui)).toBe("bientot");
    expect(etatProduit(produit("a", "frigo", "2026-10-15"), aujourdhui)).toBe("ok");
    expect(etatProduit(produit("a", "placard", null), aujourdhui)).toBe("sansDate");
  });

  it("le dit en mots", () => {
    const d = (j: string | null) => decrirePeremption(produit("a", "frigo", j), aujourdhui);
    expect(d("2026-10-08")).toBe("périmé depuis 3 jours");
    expect(d("2026-10-10")).toBe("périmé depuis hier");
    expect(d("2026-10-11")).toBe("à consommer aujourd'hui");
    expect(d("2026-10-12")).toBe("demain");
    expect(d("2026-10-16")).toBe("dans 5 jours");
    expect(d("2026-11-02")).toBe("jusqu'au 02.11");
    expect(d("2027-10-11")).toBe("jusqu'au 11.10.27");
    expect(d(null)).toBeNull();
  });
});

describe("ranger le stock", () => {
  const lait = produit("Lait", "frigo", "2026-10-12");
  const beurre = produit("Beurre", "frigo", "2026-11-20");
  const pates = produit("Pâtes", "placard", null);
  const petitsPois = produit("Petits pois", "congelateur", "2027-03-01");
  const jambon = produit("Jambon", "frigo", "2026-10-10");
  const tout = [beurre, pates, lait, petitsPois, jambon];

  it("met ce qui arrive à sa date en tête, puis chaque lieu", () => {
    expect(organiserStock(tout, aujourdhui).map((g) => [g.titre, g.produits.map((p) => p.nom)])).toEqual([
      ["À consommer", ["Jambon", "Lait"]],
      ["Frigo", ["Beurre"]],
      ["Congélateur", ["Petits pois"]],
      ["Placard", ["Pâtes"]],
    ]);
  });

  it("filtre sur un lieu", () => {
    expect(organiserStock(tout, aujourdhui, "placard").map((g) => g.titre)).toEqual(["Placard"]);
  });

  it("change un produit de lieu", () => {
    expect(deplacer(lait, "congelateur").lieu).toBe("congelateur");
  });

  it("résume pour l'accueil : urgent seulement si c'est pour aujourd'hui ou déjà passé", () => {
    expect(resumeStock(tout, aujourdhui)).toMatchObject({ urgent: true });
    expect(resumeStock(tout, aujourdhui).aConsommer.map((p) => p.nom)).toEqual(["Jambon", "Lait"]);
    expect(resumeStock([lait, beurre], aujourdhui).urgent).toBe(false);
  });
});

describe("quantités", () => {
  it("relit la quantité d'un produit écrit avant les unités", () => {
    const ancien = { ...produit("Beurre", "frigo", null), quantite: "250 g", nombre: undefined, unite: undefined };
    expect(quantiteDe(ancien)).toEqual({ nombre: 250, unite: "g" });
    expect(quantiteDe({ ...ancien, quantite: "33 cl" })).toEqual({ nombre: 330, unite: "ml" });
    expect(avecQuantite(ancien)).toMatchObject({ nombre: 250, unite: "g", quantite: "250 g" });
  });

  it("− et + changent la quantité d'un pas, et zéro veut dire fini", () => {
    const yaourts = creerProduit({ nom: "Yaourts", nombre: 2, unite: "piece", lieu: "frigo", peremption: null }, "m1", ctx);
    expect(ajuster(yaourts, -1)).toMatchObject({ nombre: 1, quantite: "1" });
    expect(ajuster(ajuster(yaourts, -1)!, -1)).toBeNull();
    const beurre = creerProduit({ nom: "Beurre", nombre: 250, unite: "g", lieu: "frigo", peremption: null }, "m1", ctx);
    expect(ajuster(beurre, -1)).toMatchObject({ nombre: 150, quantite: "150 g" });
    expect(ajuster({ ...beurre, nombre: 100 }, -1)).toMatchObject({ nombre: 75 });
    expect(ajuster({ ...beurre, nombre: 75 }, 1)).toMatchObject({ nombre: 100 });
    const lait = creerProduit({ nom: "Lait", nombre: 1.5, unite: "l", lieu: "frigo", peremption: null }, "m1", ctx);
    expect(ajuster(lait, 1)).toMatchObject({ nombre: 2, quantite: "2 l" });
    const sansQuantite = creerProduit({ nom: "Sel", nombre: null, unite: null, lieu: "placard", peremption: null }, "m1", ctx);
    expect(ajuster(sansQuantite, 1)).toMatchObject({ nombre: 2, unite: "piece" });
    expect(ajuster(sansQuantite, -1)).toBeNull();
  });
});

describe("fraîcheur et calendrier", () => {
  it("dit ce qui reste de sa durée de vie", () => {
    const p = { ...produit("Lait", "frigo", "2026-10-17"), creeLe: "2026-10-07T08:00:00.000Z" };
    expect(fraicheur(p, aujourdhui)).toBeCloseTo(0.6);
    expect(fraicheur(p, "2026-10-17")).toBe(0);
    expect(fraicheur(produit("Sel", "placard", null), aujourdhui)).toBeNull();
  });

  it("range les dates jour par jour", () => {
    const tout = [
      produit("Jambon", "frigo", "2026-10-09"),
      produit("Lait", "frigo", "2026-10-12"),
      produit("Crème", "frigo", "2026-10-12"),
      produit("Poulet", "frigo", "2026-10-16"),
      produit("Riz", "placard", "2027-06-01"),
      produit("Sel", "placard", null),
    ];
    expect(calendrierDates(tout, aujourdhui).map((j) => [j.titre, j.produits.map((p) => p.nom), j.urgent])).toEqual([
      ["Date passée", ["Jambon"], true],
      ["Demain", ["Crème", "Lait"], true],
      ["Vendredi 16.10", ["Poulet"], false],
      ["Plus tard", ["Riz"], false],
    ]);
  });
});
