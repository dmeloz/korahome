import { describe, expect, it } from "vitest";
import type { DocBudget, PlanBudget } from "./budget";
import { bilanAMontrer, bilanDe, phrasePot, texteBilan } from "./bilanMois";
import type { Tache } from "./types";

// Un plan réduit à ce que le bilan lit : la paie le 25, 900 de courses et 300 de plaisir par mois.
const plan = {
  genre: "plan", jourDePaie: 25, postes: [], depart: { mois: "2026-09", soldes: {} },
  personnes: [{ id: "melo", revenu: 6000, versement: 2400 }],
  repartition: { courses: 900, plaisir: 300, epargne: 500 },
} as unknown as PlanBudget;

const depense = (jour: string, montant: number, pot: string, magasin: string | null = null, posteId: string | null = null) =>
  ({ id: `${jour}-${montant}`, genre: "depense", jour, montant, pot, libelle: "Essai", magasin, posteId, echeance: null, source: "main", par: "melo", creeLe: `${jour}T10:00:00.000Z`, modifieLe: `${jour}T10:00:00.000Z` }) as unknown as DocBudget;
const repas = (jour: string, titre: string) => ({ id: `repas-${jour}`, type: "repas", jour, titre, recetteId: null, par: null, modifieLe: `${jour}T20:00:00.000Z` });
const tache = (jours: string[]) => ({ id: "t", titre: "Poubelles", historique: jours.map((le) => ({ le, par: "melo", retard: 0 })) }) as unknown as Tache;

describe("le bilan du mois", () => {
  const docs = [
    depense("2026-09-26", 84.3, "courses", "Migros"),
    depense("2026-10-03", 120, "courses", "Migros"),
    depense("2026-10-03", 45, "plaisir"),
    depense("2026-10-10", 900, "courses", null, "loyer"),
    depense("2026-10-12", 30, "perso"),
    depense("2026-10-26", 60, "courses", "Coop"),
  ];
  const menus = [repas("2026-10-01", "Raclette"), repas("2026-10-08", "raclette"), repas("2026-10-09", "Risotto"), repas("2026-10-30", "Soupe")];

  it("compte le mois d'une paie à l'autre, sans les factures ni ce qui est à soi", () => {
    const b = bilanDe(plan, docs, menus, [tache(["2026-09-30", "2026-10-20", "2026-10-28"])], "2026-10", "2026-11-20");
    expect(b).toMatchObject({ debut: "2026-09-25", fin: "2026-10-24", enCours: false, quotidien: 249.3, nombreDepenses: 3, tachesFaites: 2 });
    expect(b.jourLePlusCher).toEqual({ jour: "2026-10-03", total: 165 });
    expect(b.magasin).toEqual({ nom: "Migros", total: 204.3, fois: 2 });
    expect(b.repas).toEqual({ notes: 3, lePlusMange: { titre: "Raclette", fois: 2 } });
  });

  it("montre le dernier mois fini, sinon le mois en cours jusqu'ici, sinon rien", () => {
    expect(bilanAMontrer(plan, docs, menus, [], "2026-11-20")?.mois).toBe("2026-10");
    const enCours = bilanAMontrer(plan, [depense("2026-10-26", 60, "courses")], [], [], "2026-11-20");
    expect(enCours).toMatchObject({ mois: "2026-11", enCours: true, fin: "2026-11-20" });
    expect(bilanAMontrer(plan, [], [], [], "2026-11-20")).toBeNull();
  });

  it("dit l'écart de chaque pot à son budget", () => {
    expect(phrasePot({ nom: "Courses", depense: 812, budget: 900 })).toBe("Courses : 812 CHF sur 900 CHF, 88 CHF de moins que prévu.");
    expect(phrasePot({ nom: "Plaisir", depense: 340, budget: 300 })).toBe("Plaisir : 340 CHF sur 300 CHF, 40 CHF de plus que prévu.");
    expect(phrasePot({ nom: "Plaisir", depense: 12, budget: 0 })).toBe("Plaisir : 12 CHF.");
  });

  it("s'écrit en texte pour l'autre", () => {
    const b = bilanDe(plan, docs, menus, [tache(["2026-10-20"])], "2026-10", "2026-11-20");
    const texte = texteBilan(b, (j) => j);
    expect(texte.split("\n")[0]).toBe("Notre mois d'octobre");
    expect(texte).toContain("À table : 3 soirs notés, Raclette 2 fois.");
    expect(texte).toContain("À deux : 1 tâche faite.");
  });
});
