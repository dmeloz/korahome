import { describe, expect, it } from "vitest";
import { preparerEvenement } from "./agenda";
import { contexteTest } from "./contexteTest";
import { nouvelElement, nouvelleListe } from "./listes";
import { nouvelAnimal } from "./mitsu";
import { correspond, grouperTrouvailles, rechercher, type DonneesRecherche } from "./recherche";
import { nouveauProduit } from "./stock";
import { nouvelleTache } from "./taches";

const ctx = contexteTest();
const auj = "2026-10-19";

function donnees(): DonneesRecherche {
  const courses = nouvelleListe("Courses", "🛒", "courses", ctx);
  const cadeaux = nouvelleListe("Cadeaux", "🎁", "simple", ctx);
  const mitsu = { ...nouvelAnimal("Mitsu", "2026-04-14", null, ctx), soins: [{ id: "v1", type: "vaccin" as const, libelle: "Vaccin typhus", date: "2026-06-10", fait: true }] };
  return {
    listes: [courses, cadeaux],
    elements: [nouvelElement(courses, "2 l de lait", "melo", ctx), nouvelElement(cadeaux, "Livre pour Léa", "sarah", ctx)],
    taches: [nouvelleTache("Détartrer la bouilloire", null, "2026-10-25", ctx)],
    evenements: [preparerEvenement({ titre: "Dentiste", jour: "2026-10-22", heure: "14:30", lieu: "Renens" }, "melo", ctx)],
    produits: [nouveauProduit({ texte: "Lait d'avoine", lieu: "placard", peremption: null }, "melo", ctx)],
    animaux: [mitsu],
    zones: [],
    souvenirs: [{ id: "s", texte: "Le numéro du vétérinaire est le 021 634 00 00", source: "demande", auteur: "melo", creeLe: "" }],
    aujourdhui: auj,
  };
}

describe("la recherche partout", () => {
  it("ignore accents et majuscules, et cherche le début des mots", () => {
    expect(correspond("Détartrer la bouilloire", "detar")).toBe(true);
    expect(correspond("Détartrer la bouilloire", "BOUIL")).toBe(true);
    expect(correspond("Détartrer la bouilloire", "artrer")).toBe(false);
    expect(correspond("Livre pour Léa", "lea livre")).toBe(true);
  });

  it("trouve un article dans les listes et un produit du placard", () => {
    const t = rechercher(donnees(), "lait");
    expect(t.map((x) => [x.section, x.titre])).toEqual([
      ["Listes", "Lait · 2 l"],
      ["Frigo et placards", "Lait d'avoine"],
    ]);
    expect(t[0].ou).toEqual({ type: "module", id: "courses" });
  });

  it("ouvre la bonne liste pour un article d'une autre liste", () => {
    const d = donnees();
    const [livre] = rechercher(d, "livre");
    expect(livre.ou).toEqual({ type: "liste", id: d.listes[1].id });
  });

  it("trouve un rendez-vous par son lieu, un vaccin et un numéro retenu", () => {
    expect(rechercher(donnees(), "renens")[0]).toMatchObject({ titre: "Dentiste", detail: "Jeudi 22 oct., 14:30 · Renens" });
    expect(rechercher(donnees(), "vaccin")[0]).toMatchObject({ section: "Mitsu", detail: "Mitsu, fait le 10.06.26" });
    expect(rechercher(donnees(), "veterinaire")[0]).toMatchObject({ section: "Ce que Kora sait", ou: { type: "memoire" } });
  });

  it("attend deux lettres, et range par section", () => {
    expect(rechercher(donnees(), "l")).toEqual([]);
    const groupes = grouperTrouvailles(rechercher(donnees(), "lait"));
    expect(groupes.map((g) => g.section)).toEqual(["Listes", "Frigo et placards"]);
  });
});
