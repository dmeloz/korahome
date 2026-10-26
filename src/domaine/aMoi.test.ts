import { describe, expect, it } from "vitest";
import { apercuAutre, budgetVisible, depensesParJour, etatAMoi } from "./aMoi";
import { enregistrerPoste, lireDepense, nouveauPlan, nouveauPoste, nouvelleDepense, type DocBudget, type PlanBudget, type Pot } from "./budget";
import { contexteTest } from "./contexteTest";
import type { Jour } from "./types";

// Des montants inventés. Paie le 25 : le 6 novembre est le jour 13 de « novembre » (31 jours).
const A = "membre-a";
const B = "membre-b";
const ctx = contexteTest();

function plan(): PlanBudget {
  let p = nouveauPlan([A, B], "2026-09-01", ctx);
  p = { ...p, jourDePaie: 25, personnes: [{ membreId: A, revenu: 5000, versement: 2500 }, { membreId: B, revenu: 4000, versement: 2000 }] };
  p = enregistrerPoste(p, nouveauPoste({ libelle: "Assurance maladie", montant: 400, qui: A }, ctx), ctx);
  p = enregistrerPoste(p, nouveauPoste({ libelle: "Voiture", montant: 1200, frequence: "an", qui: A }, ctx), ctx);
  return p;
}

const dep = (jour: Jour, montant: number, pot: Pot = "perso", par = A) => nouvelleDepense({ montant, pot, libelle: "x", jour }, par, ctx);

describe("À toi ce mois", () => {
  it("part du salaire, moins la part au commun et les charges", () => {
    const e = etatAMoi(plan(), [plan()], A, "2026-11-06")!;
    expect(e.prevu).toBe(2000);
    expect(e.mois).toBe("2026-11");
    expect([e.jour, e.jours, e.joursRestants]).toEqual([13, 31, 19]);
  });

  it("sans dépense à soi, ne prétend pas savoir ce qui reste", () => {
    const p = plan();
    const e = etatAMoi(p, [p, dep("2026-11-01", 50, "courses")], A, "2026-11-06")!;
    expect(e.suivi).toBe(false);
    expect(e.reste).toBe(2000);
    expect(e.phrase).toMatch(/ne voit pas encore/);
  });

  it("une vieille dépense ne suffit pas : l'anneau montre ce qui était prévu", () => {
    const p = plan();
    const e = etatAMoi(p, [p, dep("2026-10-10", 30)], A, "2026-11-06")!;
    expect(e.suivi).toBe(false);
    expect(e.phrase).toMatch(/depuis le 10 octobre/);
  });

  it("suit les dépenses à soi depuis la paie, et seulement les siennes", () => {
    const p = plan();
    const docs: DocBudget[] = [p, dep("2026-10-24", 999), dep("2026-10-26", 100), dep("2026-11-05", 160), dep("2026-11-05", 77, "perso", B), dep("2026-11-04", 40, "plaisir")];
    const e = etatAMoi(p, docs, A, "2026-11-06")!;
    expect(e.suivi).toBe(true);
    expect(e.depense).toBe(260);
    expect(e.reste).toBe(1740);
    expect(e.parJour).toBe(91.58);
    expect(e.partReste).toBeCloseTo(0.87);
    expect(e.partTemps).toBeCloseTo(12 / 31);
  });

  it("dit le rythme après quelques jours", () => {
    const p = plan();
    // 1040 en 13 jours : 80 par jour, 2480 sur le mois, il manquerait 480.
    const vite = etatAMoi(p, [p, dep("2026-11-05", 1040)], A, "2026-11-06")!;
    expect(vite.restePrevuALaFin).toBe(-480);
    expect(vite.phrase).toMatch(/il manquerait environ 480 CHF le 24 novembre/);
    const calme = etatAMoi(p, [p, dep("2026-11-05", 260)], A, "2026-11-06")!;
    expect(calme.phrase).toMatch(/Au bon rythme/);
    expect(etatAMoi(p, [p, dep("2026-10-26", 100)], A, "2026-10-27")!.restePrevuALaFin).toBeNull();
  });

  it("prévient quand plus rien n'est noté depuis une semaine", () => {
    const p = plan();
    const e = etatAMoi(p, [p, dep("2026-10-28", 100)], A, "2026-11-06")!;
    expect(e.suivi).toBe(true);
    expect(e.phrase).toMatch(/depuis 9 jours/);
  });

  it("compare au mois d'avant, au même jour", () => {
    const p = plan();
    const docs = [p, dep("2026-09-27", 100), dep("2026-10-20", 500), dep("2026-10-26", 180)];
    expect(etatAMoi(p, docs, A, "2026-10-28")!.ecartMoisPrecedent).toBe(80);
  });

  it("rien sans salaire donné", () => {
    const p = { ...plan(), personnes: [{ membreId: A, revenu: 0, versement: 0 }] };
    expect(etatAMoi(p, [p], A, "2026-11-06")).toBeNull();
    expect(etatAMoi(plan(), [plan()], "inconnu", "2026-11-06")).toBeNull();
  });
});

describe("ce que chacun voit", () => {
  it("cache les dépenses à soi de l'autre", () => {
    const p = plan();
    const docs: DocBudget[] = [p, dep("2026-11-01", 10), dep("2026-11-01", 20, "perso", B), dep("2026-11-01", 30, "courses", B)];
    expect(budgetVisible(docs, A).map((d) => ("montant" in d ? d.montant : 0))).toEqual([0, 10, 30]);
  });

  it("de l'autre : sa part et ses dépenses pour le commun, pas son salaire", () => {
    const p = plan();
    const docs: DocBudget[] = [p, dep("2026-11-01", 20, "perso", B), dep("2026-11-02", 30, "courses", B), dep("2026-10-01", 99, "courses", B)];
    expect(apercuAutre(p, docs, B, "2026-11-06")).toEqual({ membreId: B, versement: 2000, depensesCommunes: 30, nombre: 1 });
  });

  it("les dépenses de chaque jour", () => {
    const p = plan();
    const jours = depensesParJour([p, dep("2026-11-06", 12), dep("2026-11-06", 8, "courses"), dep("2026-11-04", 5)], A, "2026-11-06", 3);
    expect(jours).toEqual([
      { jour: "2026-11-04", total: 5, nombre: 1 },
      { jour: "2026-11-05", total: 0, nombre: 0 },
      { jour: "2026-11-06", total: 20, nombre: 2 },
    ]);
  });

  it("« pour moi » dans la phrase : une dépense à soi", () => {
    expect(lireDepense("12 café pour moi", plan())).toMatchObject({ montant: 12, pot: "perso", libelle: "Café" });
    expect(lireDepense("à moi 30 cinéma", plan())).toMatchObject({ pot: "perso", libelle: "Cinéma" });
  });
});
