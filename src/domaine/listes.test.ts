import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { listesInitiales } from "./foyer";
import {
  analyserSaisie,
  basculerCoche,
  basculerPourMoi,
  listesVisibles,
  compterAPrendre,
  nouvelElement,
  nouvelleListe,
  organiserListe,
  trouverDoublon,
} from "./listes";

describe("analyserSaisie", () => {
  it.each([
    ["lait", null, "Lait"],
    ["2 kg de pommes", "2 kg", "Pommes"],
    ["6 oeufs", "6", "Oeufs"],
    ["1,5 l d'eau", "1,5 l", "Eau"],
    ["yaourts x4", "4", "Yaourts"],
    ["farine 500g", "500g", "Farine"],
    ["  pain   complet ", null, "Pain complet"],
  ])("« %s »", (saisie, quantite, texte) => {
    expect(analyserSaisie(saisie)).toEqual({ quantite, texte });
  });
});

describe("éléments d'une liste", () => {
  const ctx = contexteTest();
  const [courses, maison] = listesInitiales(ctx);

  it("classe un article de courses dans son rayon", () => {
    const e = nouvelElement(courses, "2 baguettes", "m1", ctx);
    expect(e).toMatchObject({ texte: "Baguettes", quantite: "2", rayon: "Boulangerie", coche: false });
  });

  it("ne classe pas par rayon une liste simple", () => {
    expect(nouvelElement(maison, "Pain", null, ctx).rayon).toBe("Autre");
  });

  it("refuse une saisie vide", () => {
    expect(() => nouvelElement(courses, "   ", null, ctx)).toThrow();
  });

  it("coche puis décoche", () => {
    const e = nouvelElement(courses, "lait", null, ctx);
    const coche = basculerCoche(e, ctx);
    expect(coche.coche).toBe(true);
    expect(coche.cocheLe).not.toBeNull();
    expect(basculerCoche(coche, ctx)).toMatchObject({ coche: false, cocheLe: null });
  });

  it("repère un doublon non coché, sans tenir compte de la casse ni de la quantité", () => {
    const e = nouvelElement(courses, "lait", null, ctx);
    expect(trouverDoublon([e], "2 LAIT")).toBe(e);
    expect(trouverDoublon([basculerCoche(e, ctx)], "lait")).toBeUndefined();
  });
});

describe("organiserListe", () => {
  it("groupe par rayon dans l'ordre du magasin et met les cochés à part", () => {
    const ctx = contexteTest();
    const [courses] = listesInitiales(ctx);
    const lessive = nouvelElement(courses, "lessive", null, ctx);
    const pommes = nouvelElement(courses, "pommes", null, ctx);
    const lait = basculerCoche(nouvelElement(courses, "lait", null, ctx), ctx);
    const { aPrendre, coches } = organiserListe(courses, [lessive, pommes, lait]);
    expect(aPrendre.map((g) => g.rayon)).toEqual(["Fruits et légumes", "Entretien"]);
    expect(coches).toEqual([lait]);
    expect(compterAPrendre(courses, [lessive, pommes, lait])).toBe(2);
  });

  it("ignore les éléments d'autres listes", () => {
    const ctx = contexteTest();
    const [courses, maison] = listesInitiales(ctx);
    const e = nouvelElement(maison, "Ampoule", null, ctx);
    expect(organiserListe(courses, [e]).aPrendre).toEqual([]);
  });
});

describe("nouvelleListe", () => {
  it("refuse un nom vide et met une icône par défaut", () => {
    const ctx = contexteTest();
    expect(() => nouvelleListe(" ", "", "simple", ctx)).toThrow();
    expect(nouvelleListe("Cadeaux", "", "simple", ctx).icone).toBe("📝");
  });
});

describe("les listes rien qu'à soi", () => {
  const ctx = contexteTest();
  it("ne se montrent qu'à leur personne, les communes à tout le monde", () => {
    const commune = nouvelleListe("Bricolage", "🔧", "simple", ctx);
    const secrete = basculerPourMoi(nouvelleListe("Cadeau pour Sarah", "🎁", "simple", ctx), "melo");
    expect(secrete.pourMoi).toBe("melo");
    expect(listesVisibles([commune, secrete], "melo").map((l) => l.nom)).toEqual(["Bricolage", "Cadeau pour Sarah"]);
    expect(listesVisibles([commune, secrete], "sarah").map((l) => l.nom)).toEqual(["Bricolage"]);
    expect(listesVisibles([commune, secrete], null).map((l) => l.nom)).toEqual(["Bricolage"]);
    expect(basculerPourMoi(secrete, "melo").pourMoi).toBeNull();
  });
  it("laisse la liste de courses au foyer", () => {
    expect(() => basculerPourMoi(nouvelleListe("Courses", "🛒", "courses", ctx), "melo")).toThrow(/foyer/);
  });
});
