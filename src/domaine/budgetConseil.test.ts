import { describe, expect, it } from "vitest";
import { confirmerMois, enregistrerPoste, factureReglee, nouveauPlan, nouveauPoste, nouvelleDepense, reglerFacture, retirerPoste, type DocBudget, type PlanBudget } from "./budget";
import { bilanDeMois, decrireBudgetConseiller, finDuMois, lireConseiller, moisACloturer, phraseFinDuMois, tableauDesMois } from "./budgetConseil";
import { contexteTest } from "./contexteTest";
import { recevoirPaiement, retenirCarte } from "./paiements";
import { importerReleve } from "./releve";

// Des montants inventés : la forme est celle de l'Excel du foyer, pas ses chiffres.
const A = "membre-a";
const B = "membre-b";

function plan(): PlanBudget {
  const ctx = contexteTest();
  let p = nouveauPlan([A, B], "2026-09-01", ctx);
  p = { ...p, personnes: [{ membreId: A, revenu: 4000, versement: 2000 }, { membreId: B, revenu: 3000, versement: 1500 }] };
  const postes = [
    nouveauPoste({ libelle: "Loyer", montant: 2000, pot: "commun" }, ctx),
    nouveauPoste({ libelle: "Courses", montant: 400, pot: "courses" }, ctx),
    nouveauPoste({ libelle: "Sunrise", montant: 59.9, pot: "factures", jour: 20 }, ctx),
    nouveauPoste({ libelle: "Électricité", montant: 60, pot: "factures", jour: 25 }, ctx),
    nouveauPoste({ libelle: "Assurance voiture", montant: 1200, frequence: "an", pot: "factures", mois: 11, jour: 2 }, ctx),
  ];
  for (const x of postes) p = enregistrerPoste(p, x, ctx);
  return p;
}

describe("la clôture du mois", () => {
  it("résume le mois fini, pot par pot, quand le suivant attend ses versements", () => {
    const ctx = contexteTest();
    const p = plan();
    const sept = confirmerMois("2026-09", { courses: 400, plaisir: 300, factures: 200, epargne: 700 }, A, ctx);
    const docs: DocBudget[] = [p, sept, nouvelleDepense({ montant: 350, pot: "courses", libelle: "Migros", jour: "2026-09-12" }, A, ctx)];
    const cloture = moisACloturer(p, docs, "2026-10-02");
    expect(cloture?.nouveau).toBe("2026-10");
    expect(cloture?.precedent?.mois).toBe("2026-09");
    expect(cloture?.precedent?.pots.courses).toEqual({ verse: 400, depense: 350, solde: 50 });
    // Une fois octobre versé, plus rien à clôturer.
    expect(moisACloturer(p, [...docs, confirmerMois("2026-10", {}, A, ctx)], "2026-10-02")).toBeNull();
    // Le premier mois du budget n'a pas de mois d'avant.
    expect(moisACloturer(p, [p], "2026-09-03")?.precedent).toBeNull();
  });

  it("aligne les mois passés depuis le départ du budget", () => {
    const p = plan();
    const mois = tableauDesMois(p, [p], "2026-10-19", 6);
    expect(mois.map((m) => m.mois)).toEqual(["2026-09", "2026-10"]);
    expect(bilanDeMois(p, [p], "2026-09").confirme).toBe(false);
  });
});

describe("la fin du mois", () => {
  it("projette les courses au rythme du mois", () => {
    const ctx = contexteTest();
    const p = plan();
    const docs: DocBudget[] = [p, confirmerMois("2026-09", { courses: 400 }, A, ctx), nouvelleDepense({ montant: 200, pot: "courses", libelle: "Coop", jour: "2026-09-10" }, A, ctx)];
    const courses = finDuMois(p, docs, "2026-09-10").find((f) => f.pot === "courses")!;
    expect(courses.projection).toBe(600);
    expect(courses.soldeFin).toBe(-200);
    expect(phraseFinDuMois(courses)).toBe("À ce rythme, 600 CHF dépensés sur 400 CHF");
  });
});

describe("les factures cochées seules", () => {
  it("un paiement Apple Pay du pot factures règle la facture du même montant", () => {
    const ctx = contexteTest();
    const p = retenirCarte(plan(), "Factures", "factures", ctx);
    const recu = recevoirPaiement({ montant: "CHF 59.90", marchand: "SUNRISE UPC", carte: "Factures" }, [p], A, "2026-10-18", ctx);
    if (recu.genre !== "depense") throw new Error("attendu : une dépense");
    expect(recu.doc).toMatchObject({ libelle: "Sunrise", echeance: "2026-10-20", pot: "factures" });
    expect(recu.message).toBe("Facture Sunrise payée.");
  });

  it("reconnaît le nom à 10 % près, mais pas un achat de courses du même montant", () => {
    const ctx = contexteTest();
    const p = plan();
    const elec = nouvelleDepense({ montant: 63.5, pot: "plaisir", libelle: "Romande Energie", jour: "2026-10-24" }, A, ctx);
    expect(factureReglee(elec, p, [p])).toBeNull();
    const nommee = nouvelleDepense({ montant: 63.5, pot: "plaisir", libelle: "Électricité octobre", jour: "2026-10-24" }, A, ctx);
    expect(reglerFacture(nommee, p, [p])).toMatchObject({ libelle: "Électricité", pot: "factures", echeance: "2026-10-25" });
    const courses = nouvelleDepense({ montant: 59.9, pot: "courses", libelle: "Migros", jour: "2026-10-18" }, A, ctx);
    expect(factureReglee(courses, p, [p])).toBeNull();
  });

  it("le virement d'un relevé règle la facture, une seule fois", () => {
    const ctx = contexteTest();
    const p = plan();
    const lignes = [
      { jour: "2026-10-19", montant: 59.9, libelle: "To Sunrise", devise: "CHF", type: "TRANSFER", mouvement: true },
      { jour: "2026-10-21", montant: 59.9, libelle: "To Sunrise", devise: "CHF", type: "TRANSFER", mouvement: true },
    ];
    const [premier, second] = importerReleve(lignes, "courses", A, ctx, p, [p]);
    expect(premier).toMatchObject({ posteId: p.postes.find((x) => x.libelle === "Sunrise")!.id, pot: "factures" });
    expect(second.posteId).toBeNull();
  });

  it("une facture retirée du plan n'est plus reconnue", () => {
    const ctx = contexteTest();
    const p = plan();
    const sans = retirerPoste(p, p.postes.find((x) => x.libelle === "Sunrise")!.id, ctx);
    expect(factureReglee({ montant: 59.9, jour: "2026-10-18", libelle: "Sunrise", pot: "factures" }, sans, [sans])).toBeNull();
  });
});

describe("le conseiller", () => {
  it("reçoit le budget, les projections et les dépenses détaillées", () => {
    const ctx = contexteTest();
    const p = plan();
    const docs: DocBudget[] = [p, nouvelleDepense({ montant: 84.3, pot: "courses", libelle: "Migros", jour: "2026-10-12" }, A, ctx)];
    const texte = decrireBudgetConseiller(docs, (id) => (id === A ? "Melo" : "Sarah"), "2026-10-19");
    expect(texte).toContain("Fin du mois prévue");
    expect(texte).toContain("2026-11 :");
    expect(texte).toContain("2026-10-12 ; 84.30 ; Courses ; Migros");
    expect(decrireBudgetConseiller(docs, () => "", "2026-10-19", 900)).toContain("non incluses");
  });

  it("relit sa réponse, tableau et conseils compris", () => {
    const r = lireConseiller([
      {
        nom: "repondre_budget",
        entree: {
          texte: "Le mois va bien.",
          tableau: { titre: "Courses (CHF)", colonnes: ["Magasin", "Total"], lignes: [["Migros", "84.30"], ["Coop"]] },
          conseils: [{ titre: "Moins de Coop", detail: "Migros revient moins cher.", gain_par_mois: 20 }, { titre: "" }],
        },
      },
    ]);
    expect(r.tableau?.lignes).toEqual([["Migros", "84.30"], ["Coop", ""]]);
    expect(r.conseils).toEqual([{ titre: "Moins de Coop", detail: "Migros revient moins cher.", gainParMois: 20 }]);
    expect(lireConseiller([]).texte).toMatch(/reformule/);
  });
});
