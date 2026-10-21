import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { csvDepenses, texteCarnet, texteRecette } from "./exports";
import { nouvelAnimal } from "./mitsu";
import { nouvelleRecette } from "./recettes";
import type { Depense } from "./budget";

const membres = [{ id: "melo", prenom: "Melo", couleur: "#000" }, { id: "sarah", prenom: "Sarah", couleur: "#fff" }];
const depense = (d: Partial<Depense>): Depense => ({ id: "d", genre: "depense", jour: "2026-10-03", montant: 10, pot: "courses", libelle: "Migros", magasin: null, posteId: null, echeance: null, source: "main", par: "melo", creeLe: "", ...d });

describe("les exports lisibles", () => {
  it("écrit le mois du budget en tableur, point-virgule, guillemets quand il faut, total à la fin", () => {
    const csv = csvDepenses([depense({ jour: "2026-10-05", libelle: 'Resto "Chez Lu"', montant: 84.5, pot: "plaisir", par: "sarah" }), depense({ magasin: "Migros; Renens" })], membres);
    expect(csv.split("\n")).toEqual([
      "Date;Libellé;Magasin;Pot;Montant CHF;Par;Source",
      '2026-10-03;Migros;"Migros; Renens";Courses;10.00;Melo;main',
      '2026-10-05;"Resto ""Chez Lu""";;Plaisir;84.50;Sarah;main',
      "Total;;;;94.50;;",
      "",
    ]);
  });

  it("met une recette en texte, aux portions choisies", () => {
    const r = nouvelleRecette({ titre: "Risotto", portions: 2, ingredients: [{ nom: "Riz", quantite: "200 g" }, { nom: "Sel", quantite: null }], etapes: ["Faire revenir.", "Mouiller."], source: "main", lien: "https://x.ch/r" }, contexteTest());
    expect(texteRecette(r, 4)).toBe(["Risotto", "Pour 4 personnes", "", "Ingrédients", "- 400 g Riz", "- Sel", "", "Préparation", "1. Faire revenir.", "2. Mouiller.", "", "https://x.ch/r"].join("\n"));
  });

  it("écrit le carnet de l'animal pour le vétérinaire", () => {
    const ctx = contexteTest();
    const mitsu = { ...nouvelAnimal("Mitsu", "2026-04-14", "2026-06-01", ctx), sterilise: true, pesees: [{ id: "p", jour: "2026-10-10", grammes: 3250, par: "melo" }], soins: [{ id: "s", type: "vaccin" as const, libelle: "Vaccin typhus", date: "2026-11-02", fait: false }], infos: { puce: "756", veterinaire: "Dr Roux", telephoneVeto: "021 634 00 00" }, journal: [{ id: "j", jour: "2026-10-12", quoi: "vomi" as const, note: "A vomi le matin", par: "sarah", creeLe: "" }] };
    expect(texteCarnet(mitsu, membres)).toBe([
      "Carnet de Mitsu",
      "Née le 14.04.2026, à la maison depuis le 01.06.2026, stérilisée",
      "Puce : 756",
      "Vétérinaire : Dr Roux, 021 634 00 00",
      "",
      "Soins",
      "- 02.11.2026 Vaccin typhus (prévu)",
      "",
      "Poids",
      "- 10.10.2026 3.25 kg",
      "",
      "Journal",
      "- 12.10.2026 A vomi le matin (Sarah)",
    ].join("\n"));
  });
});
