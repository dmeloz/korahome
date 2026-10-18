import { describe, expect, it } from "vitest";
import { apprendre, decrireDuree, habituelsARemettre, noterFin, produitDepuisHabituel, proposer, souventJete, suggerer, type ProduitHabituel } from "./catalogue";
import { cleProduit, connaissanceDe } from "./connaissances";
import { contexteTest } from "./contexteTest";
import { creerProduit } from "./stock";

const aujourdhui = "2026-10-11";
const ctx = contexteTest();

describe("ce que Kora sait déjà", () => {
  it("compare les noms sans accent ni pluriel", () => {
    expect(cleProduit("Pâtes fraîches")).toBe("pate fraiche");
    expect(cleProduit("Œufs")).toBe("oeuf");
    expect(cleProduit("Petits pois")).toBe("petit pois");
  });

  it("range et date les produits courants", () => {
    expect(connaissanceDe("Lait entier")).toEqual({ lieu: "frigo", jours: 7, unite: "l" });
    expect(connaissanceDe("Pâtes")).toMatchObject({ lieu: "placard", jours: 365 });
    expect(connaissanceDe("Pâte feuilletée")).toMatchObject({ lieu: "frigo", jours: 10 });
    expect(connaissanceDe("Petits pois")).toMatchObject({ lieu: "congelateur" });
    expect(connaissanceDe("Truc inconnu")).toBeNull();
  });
});

describe("la Base apprend à chaque ajout", () => {
  const lait = creerProduit({ nom: "Lait", nombre: 2, unite: "l", lieu: "frigo", peremption: "2026-10-21" }, "m1", ctx);

  it("crée l'habituel avec la quantité, le lieu et la durée", () => {
    const h = apprendre([], lait, aujourdhui, ctx);
    expect(h).toMatchObject({ nom: "Lait", cle: "lait", lieu: "frigo", nombre: 2, unite: "l", dureeJours: 10, fois: 1, dernierAjout: aujourdhui });
  });

  it("met à jour le même habituel la fois suivante", () => {
    const h = apprendre([], lait, aujourdhui, ctx);
    const encore = creerProduit({ nom: "lait", nombre: null, unite: null, lieu: "frigo", peremption: null }, "m1", ctx);
    const apres = apprendre([h], encore, "2026-10-15", ctx);
    expect(apres).toMatchObject({ id: h.id, nombre: 2, unite: "l", dureeJours: 10, fois: 2, dernierAjout: "2026-10-15" });
  });

  it("propose ses habitudes avant ce que Kora sait", () => {
    const h = { ...apprendre([], lait, aujourdhui, ctx), lieu: "placard" as const };
    expect(proposer([h], "lait")).toMatchObject({ lieu: "placard", source: "habitude", dureeJours: 10 });
    expect(proposer([], "lait")).toMatchObject({ lieu: "frigo", source: "connaissance", dureeJours: 7 });
    expect(proposer([], "xyz")).toBeNull();
  });

  const habituel = (nom: string, fois: number): ProduitHabituel => ({
    id: nom, nom, cle: cleProduit(nom), lieu: "frigo", nombre: null, unite: null, dureeJours: 5, code: null, image: null, fois, dernierAjout: aujourdhui,
  });

  it("suggère pendant la frappe, les plus fréquents d'abord", () => {
    const base = [habituel("Yaourt nature", 2), habituel("Yaourt fraise", 5), habituel("Lait", 9)];
    expect(suggerer(base, "ya").map((h) => h.nom)).toEqual(["Yaourt fraise", "Yaourt nature"]);
    expect(suggerer(base, "fr").map((h) => h.nom)).toEqual(["Yaourt fraise"]);
    expect(suggerer(base, "y")).toEqual([]);
  });

  it("propose de remettre ce qui n'est plus au stock", () => {
    const base = [habituel("Lait", 9), habituel("Beurre", 3)];
    expect(habituelsARemettre(base, [lait]).map((h) => h.nom)).toEqual(["Beurre"]);
  });

  it("remet un habituel avec sa date", () => {
    const p = produitDepuisHabituel({ ...habituel("Beurre", 3), nombre: 250, unite: "g" }, aujourdhui, "m1", ctx);
    expect(p).toMatchObject({ nom: "Beurre", nombre: 250, unite: "g", quantite: "250 g", peremption: "2026-10-16" });
  });

  it("dit les durées en mots", () => {
    expect([decrireDuree(3), decrireDuree(7), decrireDuree(14), decrireDuree(30), decrireDuree(92), decrireDuree(365), decrireDuree(null)]).toEqual([
      "3 jours", "1 semaine", "2 semaines", "1 mois", "3 mois", "1 an", null,
    ]);
  });
});

describe("ce qui finit périmé", () => {
  it("compte les produits finis et jetés, et les garde quand le produit revient", () => {
    const p = creerProduit({ nom: "Crème", nombre: 1, unite: "piece", lieu: "frigo", peremption: "2026-10-20" }, null, ctx);
    const h = noterFin(noterFin(apprendre([], p, "2026-10-10", ctx), true), true);
    expect(souventJete(h)).toBe(true);
    const encore = apprendre([h], p, "2026-10-12", ctx);
    expect(encore).toMatchObject({ jetes: 2, fois: 2 });
    expect(souventJete(noterFin(noterFin(noterFin(encore, false), false), false))).toBe(false);
  });
});
