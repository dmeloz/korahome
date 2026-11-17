import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import type { DocBudget } from "./budget";
import { nouvelElement, nouvelleListe, basculerCoche } from "./listes";
import { cleActive, cleMenu, comptesDuMenu, pastille, SECTIONS_MENU } from "./menu";
import { marquerFaite, nouvelleTache } from "./taches";

const ctx = contexteTest("2026-11-17T18:00:00.000Z");
const AUJOURDHUI = "2026-11-17";

describe("le menu latéral de l'iPhone", () => {
  it("tient en trois sections, chaque ligne une seule fois", () => {
    expect(SECTIONS_MENU.map((s) => s.titre)).toEqual(["Espaces", "Raccourcis", "Général"]);
    expect(SECTIONS_MENU[0].entrees.map((e) => e.libelle)).toEqual(["Aujourd'hui", "Cuisine", "Maison", "Organisation", "Budget"]);
    const cles = SECTIONS_MENU.flatMap((s) => s.entrees.map(cleMenu));
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("allume la page ouverte, sinon son espace", () => {
    expect(cleActive({ espace: "chef", onglet: "courses" })).toBe("chef:courses");
    expect(cleActive({ espace: "chef", onglet: "frigo" })).toBe("chef");
    expect(cleActive({ espace: "reglages" })).toBe("reglages");
    expect(cleActive(null)).toBeNull();
  });

  it("compte les courses, les tâches qui pressent et les paiements à classer, sans pastille à zéro", () => {
    const courses = nouvelleListe("Courses", "panier", "courses", ctx);
    const lait = nouvelElement(courses, "lait", null, ctx);
    const pain = basculerCoche(nouvelElement(courses, "pain", null, ctx), ctx);
    const retard = nouvelleTache("Arroser", null, "2026-11-15", ctx);
    const jour = nouvelleTache("Lessive", null, AUJOURDHUI, ctx);
    const plusTard = nouvelleTache("Vitres", null, "2026-11-20", ctx);
    const faite = marquerFaite(nouvelleTache("Poubelles", null, AUJOURDHUI, ctx), null, AUJOURDHUI, ctx);
    const paiement = { genre: "paiement", jour: AUJOURDHUI, creeLe: "2026-11-17T08:00:00.000Z" } as unknown as DocBudget;
    const comptes = comptesDuMenu({ listes: [courses], elements: [lait, pain], taches: [retard, jour, plusTard, faite], budget: [paiement], membreId: "melo", aujourdhui: AUJOURDHUI });
    expect(comptes).toEqual({ "chef:courses": 1, "taches:taches": 2, budget: 1 });
    expect(comptesDuMenu({ listes: [], elements: [], taches: [], budget: [], membreId: null, aujourdhui: AUJOURDHUI })).toEqual({});
  });

  it("ne compte pas une liste de courses rien qu'à l'autre", () => {
    const sienne = { ...nouvelleListe("Courses", "panier", "courses", ctx), pourMoi: "sarah" };
    const lait = nouvelElement(sienne, "lait", null, ctx);
    expect(comptesDuMenu({ listes: [sienne], elements: [lait], taches: [], budget: [], membreId: "melo", aujourdhui: AUJOURDHUI })).toEqual({});
  });

  it("une pastille reste courte", () => {
    expect(pastille(7)).toBe("7");
    expect(pastille(120)).toBe("99+");
  });
});
