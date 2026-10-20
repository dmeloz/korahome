import { describe, expect, it } from "vitest";
import { preparerEvenement } from "./agenda";
import { contexteTest } from "./contexteTest";
import { nouvelElement, nouvelleListe } from "./listes";
import { nouvelAnimal } from "./mitsu";
import { correspond, grouperTrouvailles, rechercher, type DonneesRecherche } from "./recherche";
import { nouveauProduit } from "./stock";
import { nouvelleTache } from "./taches";
import { nouvelleRecette } from "./recettes";
import type { Depense } from "./budget";

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
    recettes: [nouvelleRecette({ titre: "Risotto aux champignons", portions: 2, ingredients: [{ nom: "Riz", quantite: "200 g" }, { nom: "Lait", quantite: "1 dl" }], etapes: [], source: "main", lien: null }, ctx)],
    depenses: [{ id: "d1", genre: "depense", jour: "2026-10-17", montant: 84.3, pot: "courses", libelle: "Migros", magasin: "Migros Renens", posteId: null, echeance: null, source: "main", par: "melo", creeLe: "" } as Depense],
    mots: [{ type: "mot", id: "m1", de: "sarah", texte: "Bonne journée mon amour", creeLe: "2026-10-18T07:00:00.000Z", visibleDes: "2026-10-18T07:00:00.000Z", programme: false, coeurs: [] }],
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
      ["Nos recettes", "Risotto aux champignons"],
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
    expect(groupes.map((g) => g.section)).toEqual(["Listes", "Frigo et placards", "Nos recettes"]);
  });

  it("trouve aussi une recette par un ingrédient, une dépense par son magasin, un mot", () => {
    expect(rechercher(donnees(), "lait").map((x) => x.section)).toEqual(["Listes", "Frigo et placards", "Nos recettes"]);
    const migros = rechercher(donnees(), "renens");
    expect(migros.map((x) => [x.section, x.titre])).toEqual([["Agenda", "Dentiste"], ["Budget", "Migros · 84.30 CHF"]]);
    expect(migros[1].detail).toBe("17.10.26, courses · Migros Renens");
    expect(migros[1].ou).toEqual({ type: "module", id: "budget", onglet: "depenses" });
    const mots = rechercher(donnees(), "amour");
    expect(mots).toHaveLength(1);
    expect(mots[0].ou).toEqual({ type: "mots" });
  });
});
