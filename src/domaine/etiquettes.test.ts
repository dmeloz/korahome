import { describe, expect, it } from "vitest";
import { lireDepense, nouveauPlan, nouvelleDepense, type DocBudget } from "./budget";
import { contexteTest } from "./contexteTest";
import { ajouterEtiquette, etiquetteProposee, etiquettesDuPlan, modifierEtiquette, supprimerEtiquette, usageDesEtiquettes } from "./etiquettes";
import { classerPaiement, recevoirPaiement } from "./paiements";

const ctx = contexteTest();
const plan0 = nouveauPlan(["melo", "sarah"], "2026-10-01", ctx);

describe("les catégories du foyer", () => {
  it("se créent dans un pot, avec un nom propre et unique", () => {
    const { plan, etiquette } = ajouterEtiquette(plan0, "  essence ", "perso", ctx);
    expect(etiquette).toMatchObject({ nom: "Essence", pot: "perso" });
    expect(plan.etiquettes).toHaveLength(1);
    expect(() => ajouterEtiquette(plan, "ESSENCE", "plaisir", ctx)).toThrow(/existe déjà/);
    expect(() => ajouterEtiquette(plan, "", "plaisir", ctx)).toThrow(/un nom/);
    expect(() => ajouterEtiquette(plan, "Courses", "plaisir", ctx)).toThrow(/déjà un pot/);
    expect(() => ajouterEtiquette(plan, "x".repeat(25), "plaisir", ctx)).toThrow(/24 caractères/);
  });

  it("se renomment, changent de pot, se retirent, et se lisent dans l'ordre", () => {
    let plan = ajouterEtiquette(plan0, "Resto", "plaisir", ctx).plan;
    const r = ajouterEtiquette(plan, "Essence", "perso", ctx);
    plan = r.plan;
    expect(etiquettesDuPlan(plan).map((e) => e.nom)).toEqual(["Essence", "Resto"]);
    plan = modifierEtiquette(plan, r.etiquette.id, { nom: "Carburant", pot: "commun" }, ctx);
    expect(etiquettesDuPlan(plan)[0]).toMatchObject({ nom: "Carburant", pot: "commun" });
    expect(() => modifierEtiquette(plan, r.etiquette.id, { nom: "resto" }, ctx)).toThrow(/existe déjà/);
    plan = supprimerEtiquette(plan, r.etiquette.id, ctx);
    expect(etiquettesDuPlan(plan).map((e) => e.nom)).toEqual(["Resto"]);
    expect(supprimerEtiquette(plan, "inconnue", ctx)).toBe(plan);
  });

  it("classe un paiement Apple Pay : le pot et le nom de la catégorie, le commerçant en magasin", () => {
    const { plan, etiquette } = ajouterEtiquette(plan0, "Essence", "perso", ctx);
    const recu = recevoirPaiement({ carte: "UBS Visa Debit 1234", montant: "CHF 62.40", marchand: "SOCAR RENENS" }, [plan], "melo", "2026-11-03", ctx);
    if (recu.genre !== "paiement") throw new Error(recu.genre);
    const paiement = recu.doc;
    const d = classerPaiement(paiement, "plaisir", 62.4, ctx, etiquette);
    expect(d).toMatchObject({ pot: "perso", libelle: "Essence", magasin: "Socar Renens", etiquette: etiquette.id, source: "applepay" });
    // La fois d'après, Kora propose la même catégorie pour ce commerçant.
    expect(etiquetteProposee(plan, [plan, d], "Socar Renens")).toEqual(etiquette);
    expect(etiquetteProposee(plan, [plan, d], "Migros")).toBeNull();
    expect(etiquetteProposee(supprimerEtiquette(plan, etiquette.id, ctx), [plan, d], "Socar Renens")).toBeNull();
    expect(usageDesEtiquettes(plan, [plan, d])).toEqual({ [etiquette.id]: 1 });
  });

  it("se reconnaît dans une phrase à la fée : « 45 essence » va dans son pot", () => {
    const { plan, etiquette } = ajouterEtiquette(plan0, "Essence", "perso", ctx);
    expect(lireDepense("45 essence", plan)).toMatchObject({ montant: 45, pot: "perso", libelle: "Essence", etiquette: etiquette.id });
    expect(lireDepense("socar 45 essence", plan)).toMatchObject({ pot: "perso", libelle: "Socar", etiquette: etiquette.id });
    expect(lireDepense("45 essentiel", plan)).not.toHaveProperty("etiquette");
    const docs: DocBudget[] = [plan, nouvelleDepense({ ...lireDepense("45 essence", plan)!, jour: "2026-11-03" }, "melo", ctx)];
    expect(usageDesEtiquettes(plan, docs)).toEqual({ [etiquette.id]: 1 });
  });
});
