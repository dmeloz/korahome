import { describe, expect, it } from "vitest";
import type { MenuSemaine } from "./chef";
import { contexteTest } from "./contexteTest";
import { additionner, coursesDeLaFiche, detailLigne, ficheDeLaSemaine, platsDeLaSemaine, texteFiche } from "./ficheSemaine";
import { nouvelElement, nouvelleListe } from "./listes";
import { nouvelleRecette, prevoirRecette, type BrouillonRecette, type Recette } from "./recettes";
import { creerProduit } from "./stock";

const AUJOURDHUI = "2026-10-19";
const ctx = contexteTest();
const recette = (b: Omit<BrouillonRecette, "source" | "etapes">, soir: string | null = null): Recette => {
  const r = nouvelleRecette({ ...b, etapes: [], source: "main" }, ctx);
  return soir ? prevoirRecette(r, soir, ctx) : r;
};
const produit = (nom: string) => creerProduit({ nom, nombre: null, unite: null, lieu: "frigo", peremption: null }, null, contexteTest());

const gratin = recette(
  { titre: "Gratin de courge", portions: 4, ingredients: [{ nom: "Courge", quantite: "800 g" }, { nom: "Oignons", quantite: "2" }, { nom: "Crème", quantite: "2 dl" }, { nom: "Sel", quantite: null }] },
  "2026-10-21",
);
const soupe = recette(
  { titre: "Soupe à l'oignon", portions: 2, ingredients: [{ nom: "Oignon", quantite: "4" }, { nom: "Gruyère", quantite: "100 g" }, { nom: "Bouillon", quantite: "1 l" }] },
  "2026-10-19",
);
const risotto = recette({ titre: "Risotto", portions: 2, ingredients: [{ nom: "Riz", quantite: "160 g" }, { nom: "Crème", quantite: "50 cl" }, { nom: "Bouillon", quantite: "1 boîte" }] });
const loin = recette({ titre: "Raclette", portions: 2, ingredients: [{ nom: "Fromage à raclette", quantite: "400 g" }] }, "2026-11-10");

const menu = { repas: [{ titre: "Risotto", description: "", avecLeStock: [], recetteId: risotto.id }, { titre: "Soupe à l'oignon", description: "", avecLeStock: [], recetteId: soupe.id }] } as unknown as MenuSemaine;

describe("les repas de la fiche", () => {
  it("prend les soirs prévus dans l'ordre, puis les repas du Chef, sans doublon ni soir lointain", () => {
    const plats = platsDeLaSemaine([gratin, soupe, risotto, loin], menu, AUJOURDHUI);
    expect(plats.map((p) => [p.code, p.recette.titre, p.quand])).toEqual([
      ["P1", "Soupe à l'oignon", "2026-10-19"],
      ["P2", "Gratin de courge", "2026-10-21"],
      ["P3", "Risotto", null],
    ]);
  });

  it("reste vide sans soir prévu ni menu", () => {
    expect(platsDeLaSemaine([risotto, loin], null, AUJOURDHUI)).toEqual([]);
  });
});

describe("les ingrédients croisés", () => {
  const plats = platsDeLaSemaine([gratin, soupe, risotto], menu, AUJOURDHUI);
  const fiche = ficheDeLaSemaine(plats, [produit("Crème entière"), produit("Riz")]);
  const ligne = (nom: string) => fiche.ingredients.find((l) => l.nom === nom)!;

  it("met un ingrédient sur une seule ligne, avec la quantité de chaque repas et le total", () => {
    expect(ligne("Oignon")).toMatchObject({ quantites: ["4", "2", null], total: "6", repas: 2 });
    expect(fiche.ingredients.filter((l) => l.cle === "oignon")).toHaveLength(1);
    expect(ligne("Crème").total).toBe("7 dl");
    expect(detailLigne(fiche, ligne("Crème"))).toBe("P2 2 dl · P3 50 cl");
  });

  it("ne force pas un total qui ne s'additionne pas", () => {
    expect(ligne("Bouillon")).toMatchObject({ total: null, repas: 2 });
  });

  it("range d'abord ce qui sert à plusieurs repas, le sel à la fin", () => {
    expect(fiche.ingredients.slice(0, 3).map((l) => l.repas)).toEqual([2, 2, 2]);
    expect(fiche.ingredients.at(-1)!.nom).toBe("Sel");
    expect(fiche.communs.map((l) => l.nom)).toEqual(["Bouillon", "Crème", "Oignon"]);
  });

  it("sait ce qui est à la maison et ce qu'il faut acheter", () => {
    expect(ligne("Crème").aLaMaison).toBe(true);
    expect(fiche.aAcheter.map((l) => l.nom)).toEqual(["Bouillon", "Oignon", "Courge", "Gruyère"]);
  });

  it("met aux courses le total du manquant, sans ce qui est déjà sur la liste", () => {
    const c = contexteTest();
    const liste = nouvelleListe("Courses", "🛒", "courses", c);
    const deja = nouvelElement(liste, "Gruyère", null, c);
    const ajouts = coursesDeLaFiche(fiche, liste, [deja], null, c);
    expect(ajouts.map((e) => [e.texte, e.quantite])).toEqual([
      ["Bouillon", null],
      ["Oignon", "6"],
      ["Courge", "800 g"],
    ]);
  });

  it("s'écrit en texte pour être partagée", () => {
    const texte = texteFiche(fiche, (j) => j);
    expect(texte).toContain("P1 · 2026-10-19 · Soupe à l'oignon (2 pers.)");
    expect(texte).toContain("P3 · Chef · Risotto (2 pers.)");
    expect(texte).toContain("- Oignon : 6 · à acheter (P1 4 · P2 2)");
  });
});

describe("additionner des quantités", () => {
  it("convertit les poids et les volumes", () => {
    expect(additionner(["200 g", "1 kg"])).toBe("1,2 kg");
    expect(additionner(["2 dl", "50 cl"])).toBe("7 dl");
    expect(additionner(["30 ml", "20 ml"])).toBe("50 ml");
    expect(additionner(["½", "1/2"])).toBe("1");
    expect(additionner(["2 gousses", "1 gousse"])).toBe("3 gousses");
  });

  it("rend une quantité seule telle quelle et refuse ce qui ne s'additionne pas", () => {
    expect(additionner(["1 bocal"])).toBe("1 bocal");
    expect(additionner(["200 g", "1 boîte"])).toBeNull();
    expect(additionner(["200 g", null])).toBeNull();
    expect(additionner([null])).toBeNull();
  });
});
