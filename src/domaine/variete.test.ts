import { describe, expect, it } from "vitest";
import { messageChef, nouveauMenu, type MenuSemaine } from "./chef";
import { contexteTest } from "./contexteTest";
import { BASES, legumesDuMois, PROTEINES, savoirPourLeChef } from "./savoirCuisine";
import { dejaServi, decrireTrame, lireTrame, tirerSemaine, type TrameSoir } from "./variete";

const AUJOURDHUI = "2026-10-18";

/** Un hasard qui se répète toujours de la même façon. */
function hasardFixe(graine: number) {
  let x = graine;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function menu(semaine: string, d: { trame?: TrameSoir[]; titres?: string[] }): MenuSemaine {
  return {
    id: `menu-${semaine}`,
    type: "menu",
    semaine,
    mot: "",
    repas: (d.titres ?? []).map((titre) => ({ titre, description: "", avecLeStock: [] })),
    ajouts: [],
    aFinir: [],
    alertesMitsu: [],
    lance: "maintenant",
    creeLe: `${semaine}T17:00:00Z`,
    ...(d.trame ? { trame: d.trame } : {}),
  };
}

describe("le savoir de cuisine", () => {
  it("donne les légumes de saison du mois, et ceux du stockage suisse toute l'année", () => {
    const octobre = legumesDuMois(10);
    expect(octobre).toEqual(expect.arrayContaining(["poireau", "courge", "panais", "carotte", "pomme de terre"]));
    expect(octobre).not.toContain("asperge");
    expect(legumesDuMois(5)).toContain("asperge");
    expect(legumesDuMois(1)).toContain("chou de Bruxelles");
    expect(legumesDuMois(1)).not.toContain("courge");
  });

  it("reste court : il ne pèse presque rien sur le plafond de Jarvis", () => {
    const texte = savoirPourLeChef(10);
    expect(texte).toContain("Légumes suisses de saison en octobre");
    expect(texte).toContain("riz cuit 1 jour");
    // Environ 4 caractères par jeton : moins de 1 500 jetons.
    expect(texte.length).toBeLessThan(6000);
  });
});

describe("le tirage de la semaine", () => {
  it("donne cinq soirs aux bases toutes différentes, avec deux légumes de saison chacun", () => {
    const trame = tirerSemaine({ menus: [], aujourdhui: AUJOURDHUI, nombre: 5, hasard: hasardFixe(1) });
    expect(trame).toHaveLength(5);
    expect(new Set(trame.map((t) => t.base)).size).toBe(5);
    const saison = legumesDuMois(10);
    for (const t of trame) {
      expect(t.legumes).toHaveLength(2);
      for (const l of t.legumes) expect(saison).toContain(l);
    }
    expect(new Set(trame.flatMap((t) => t.legumes)).size).toBe(10);
  });

  it("garde un soir sans viande ni poisson, et jamais la même protéine deux soirs de suite", () => {
    for (let graine = 1; graine <= 200; graine++) {
      const trame = tirerSemaine({ menus: [], aujourdhui: AUJOURDHUI, nombre: 5, hasard: hasardFixe(graine) });
      expect(trame.some((t) => PROTEINES.find((p) => p.id === t.proteine)!.vegetarien)).toBe(true);
      for (let i = 1; i < trame.length; i++) expect(trame[i].proteine).not.toBe(trame[i - 1].proteine);
      for (const p of PROTEINES) expect(trame.filter((t) => t.proteine === p.id).length).toBeLessThanOrEqual(2);
    }
  });

  it("change d'une semaine à l'autre selon le hasard", () => {
    const tirages = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(tirerSemaine({ menus: [], aujourdhui: AUJOURDHUI, nombre: 5, hasard: hasardFixe(i + 1) }))));
    expect(tirages.size).toBeGreaterThan(15);
  });

  it("fait revenir bien moins souvent ce qu'on a mangé la semaine passée", () => {
    const passee: TrameSoir[] = ["pates", "riz", "pommes-de-terre", "risotto", "polenta"].map((base) => ({ base, proteine: "volaille", legumes: ["poireau", "courge"] }));
    const menus = [menu("2026-10-11", { trame: passee })];
    let reprises = 0;
    let sansMemoire = 0;
    for (let graine = 1; graine <= 300; graine++) {
      const avec = tirerSemaine({ menus, aujourdhui: AUJOURDHUI, nombre: 5, hasard: hasardFixe(graine) });
      const sans = tirerSemaine({ menus: [], aujourdhui: AUJOURDHUI, nombre: 5, hasard: hasardFixe(graine) });
      reprises += avec.filter((t) => t.proteine === "volaille").length;
      sansMemoire += sans.filter((t) => t.proteine === "volaille").length;
    }
    expect(reprises).toBeLessThan(sansMemoire / 3);
  });

  it("reconnaît ce que servaient les menus d'avant le tirage, sur quatre semaines seulement", () => {
    const menus = [
      menu("2026-10-11", { titres: ["Risotto aux poireaux", "Saumon et pommes de terre"] }),
      menu("2026-09-27", { titres: ["Lentilles corail au curry"] }),
      menu("2026-09-01", { titres: ["Gnocchi à la sauge"] }),
      menu(AUJOURDHUI, { titres: ["Polenta"] }),
    ];
    const vu = dejaServi(menus, AUJOURDHUI);
    expect(vu.get("base:risotto")).toBe(1);
    expect(vu.get("base:pommes-de-terre")).toBe(1);
    expect(vu.get("proteine:poisson")).toBe(1);
    expect(vu.get("legume:poireau")).toBe(1);
    expect(vu.get("base:lentilles")).toBe(3);
    expect(vu.has("base:gnocchi")).toBe(false);
    expect(vu.has("base:polenta")).toBe(false);
  });

  it("donne la trame au Chef et la garde dans le menu", () => {
    const ctx = contexteTest();
    const trame: TrameSoir[] = [{ base: "lentilles", proteine: "legumineuses", legumes: ["courge", "poireau"] }];
    const message = messageChef({ produits: [], enCourses: [], aujourdhui: AUJOURDHUI, trame });
    expect(message).toContain("- Soir 1 : lentilles · légumineuses ou tofu · courge, poireau");
    expect(message).toContain("Savoir de cuisine");
    const m = nouveauMenu({ proposition: { mot: "", repas: [{ titre: "Dahl", description: "", avecLeStock: [] }], recettes: [null], aAcheter: [] }, ajouts: [], produits: [], animaux: [], aujourdhui: AUJOURDHUI, lance: "auto", trame }, ctx);
    expect(m.trame).toEqual(trame);
    expect(decrireTrame(trame)).toHaveLength(1);
  });

  it("relit une trame gardée sans lui faire confiance", () => {
    expect(lireTrame("rien")).toBeUndefined();
    expect(lireTrame([{ base: "pates" }, null, { base: "riz", proteine: "oeufs", legumes: ["poireau", 3] }])).toEqual([{ base: "riz", proteine: "oeufs", legumes: ["poireau"] }]);
  });

  it("n'a que des bases et protéines aux identifiants uniques", () => {
    expect(new Set(BASES.map((b) => b.id)).size).toBe(BASES.length);
    expect(new Set(PROTEINES.map((p) => p.id)).size).toBe(PROTEINES.length);
  });
});
