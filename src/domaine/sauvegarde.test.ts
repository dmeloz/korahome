import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { ErreurValidation } from "./foyer";
import { nouvelElement, nouvelleListe } from "./listes";
import { creerSauvegarde, decrireDerniere, lireSauvegarde, nomFichier, resumeSauvegarde, sauvegardeDue, type ContenuFoyer } from "./sauvegarde";
import { nouvelleTache } from "./taches";

const ctx = contexteTest();
const foyer = { id: "f", nom: "Cassa", membres: [{ id: "melo", prenom: "Melo", couleur: "#d3a14a" }], creeLe: "" };

function contenu(): ContenuFoyer {
  const courses = nouvelleListe("Courses", "🛒", "courses", ctx);
  return {
    foyer,
    listes: [courses],
    elements: [nouvelElement(courses, "Lait", "melo", ctx), nouvelElement(courses, "Pain", "melo", ctx)],
    taches: [nouvelleTache("Linge", null, "2026-10-19", ctx)],
    animaux: [], produits: [], catalogue: [], zones: [], souvenirs: [], couple: [], menus: [], agenda: [], retours: [],
  };
}

describe("la sauvegarde de la semaine", () => {
  it("s'écrit et se relit à l'identique", () => {
    const s = creerSauvegarde(contenu(), "0.0.23", "2026-10-19T18:00:00.000Z");
    const relue = lireSauvegarde(JSON.stringify(s));
    expect(relue).toEqual(s);
    expect(resumeSauvegarde(relue)).toBe("1 liste, 2 articles, 1 tâche, 0 rendez-vous, 0 produit");
  });

  it("porte le nom du foyer et du jour", () => {
    expect(nomFichier(foyer, "2026-10-19T18:00:00.000Z")).toBe("KoraHome Cassa 2026-10-19.json");
  });

  it("refuse un fichier qui n'est pas une sauvegarde", () => {
    expect(() => lireSauvegarde("bonjour")).toThrow(ErreurValidation);
    expect(() => lireSauvegarde(JSON.stringify({ format: "autre" }))).toThrow("n'est pas une sauvegarde");
    expect(() => lireSauvegarde(JSON.stringify({ format: "korahome-sauvegarde", versionFormat: 99, foyer }))).toThrow("plus récente");
  });

  it("complète une sauvegarde ancienne et écarte les documents sans identifiant", () => {
    const relue = lireSauvegarde(JSON.stringify({ format: "korahome-sauvegarde", versionFormat: 1, versionKora: "0.0.23", creeLe: "", foyer, listes: [{ id: "a" }, { nom: "sans id" }] }));
    expect(relue.listes).toEqual([{ id: "a" }]);
    expect(relue.agenda).toEqual([]);
  });

  it("devient due après une semaine, et se décrit simplement", () => {
    expect(sauvegardeDue(null, "2026-10-19")).toBe(true);
    expect(sauvegardeDue("2026-10-13T20:00:00.000Z", "2026-10-19")).toBe(false);
    expect(sauvegardeDue("2026-10-12T20:00:00.000Z", "2026-10-19")).toBe(true);
    expect(decrireDerniere(null, "2026-10-19")).toBe("jamais");
    expect(decrireDerniere("2026-10-19T08:00:00.000Z", "2026-10-19")).toBe("aujourd'hui");
    expect(decrireDerniere("2026-10-18T08:00:00.000Z", "2026-10-19")).toBe("hier");
    expect(decrireDerniere("2026-10-15T08:00:00.000Z", "2026-10-19")).toBe("jeudi");
    expect(decrireDerniere("2026-10-02T08:00:00.000Z", "2026-10-19")).toBe("le 02.10");
  });
});
