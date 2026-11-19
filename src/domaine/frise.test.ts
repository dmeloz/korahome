import { describe, expect, it } from "vitest";
import type { DocBudget } from "./budget";
import { caseSous, friseDesDepenses, niveauDe } from "./frise";

const depense = (jour: string, montant: number, posteId: string | null = null) =>
  ({ id: `${jour}-${montant}`, genre: "depense", jour, montant, pot: "courses", libelle: "Essai", magasin: null, posteId, echeance: null, source: "main", par: null, creeLe: `${jour}T10:00:00.000Z`, modifieLe: `${jour}T10:00:00.000Z` }) as unknown as DocBudget;

describe("la frise des jours", () => {
  it("montre des semaines entières, du lundi au dimanche, jusqu'à celle d'aujourd'hui", () => {
    const frise = friseDesDepenses([], "2026-11-20", 4);
    expect(frise.length).toBe(4);
    expect(frise[0][0].jour).toBe("2026-10-26");
    expect(frise[3][0].jour).toBe("2026-11-16");
    expect(frise[3][4]).toMatchObject({ jour: "2026-11-20", aVenir: false });
    expect(frise[3][5].aVenir).toBe(true);
  });

  it("additionne les dépenses du jour et laisse les factures de côté", () => {
    const frise = friseDesDepenses([depense("2026-11-18", 40), depense("2026-11-18", 12.5), depense("2026-11-18", 900, "loyer")], "2026-11-20", 2);
    const jour = frise[1][2];
    expect(jour).toMatchObject({ jour: "2026-11-18", total: 52.5, nombre: 2 });
    expect(jour.niveau).toBe(4);
  });

  it("range les jours par quarts, pour qu'un gros achat n'écrase pas les autres", () => {
    const tries = [5, 10, 20, 2000];
    expect(niveauDe(0, tries)).toBe(0);
    expect(niveauDe(5, tries)).toBe(1);
    expect(niveauDe(10, tries)).toBe(2);
    expect(niveauDe(20, tries)).toBe(3);
    expect(niveauDe(2000, tries)).toBe(4);
  });

  it("trouve la case sous le doigt sans sortir de la grille", () => {
    expect(caseSous(0, 0, 26)).toEqual({ semaine: 0, jour: 0 });
    expect(caseSous(0.999, 0.999, 26)).toEqual({ semaine: 25, jour: 6 });
    expect(caseSous(1.4, -0.2, 26)).toEqual({ semaine: 25, jour: 0 });
  });
});
