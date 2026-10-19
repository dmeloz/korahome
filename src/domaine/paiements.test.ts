import { describe, expect, it } from "vitest";
import { nouveauPlan, nouvelleDepense, type DocBudget, type PlanBudget } from "./budget";
import { contexteTest } from "./contexteTest";
import { cartesDuFoyer, choixDeCarte, classerPaiement, completerPaiement, demandeRaccourci, lireMontantPaye, nomDeCarte, nomDeCommercant, paiementsAClasser, recevoirPaiement, retenirCarte } from "./paiements";

const JOUR = "2026-10-19";

function foyer(): { plan: PlanBudget; ctx: ReturnType<typeof contexteTest> } {
  const ctx = contexteTest();
  return { plan: nouveauPlan(["melo", "sarah"], "2026-10-01", ctx), ctx };
}

describe("les paiements Apple Pay", () => {
  it("lit les montants tels que Wallet les donne", () => {
    expect(lireMontantPaye("CHF 12.50")).toEqual({ montant: 12.5, devise: "CHF" });
    expect(lireMontantPaye("12,50 CHF")).toEqual({ montant: 12.5, devise: "CHF" });
    expect(lireMontantPaye("CHF 1’234.05")).toEqual({ montant: 1234.05, devise: "CHF" });
    expect(lireMontantPaye("1,234.50")).toEqual({ montant: 1234.5, devise: "CHF" });
    expect(lireMontantPaye("€8.90")).toEqual({ montant: 8.9, devise: "EUR" });
    expect(lireMontantPaye("Fr. 7.-")).toEqual({ montant: 7, devise: "CHF" });
    expect(lireMontantPaye(23.4)).toEqual({ montant: 23.4, devise: "CHF" });
    expect(lireMontantPaye("gratuit")).toBeNull();
    expect(lireMontantPaye(-4)).toBeNull();
  });

  it("garde le nom de la carte sans ses chiffres, et un commerçant lisible", () => {
    expect(nomDeCarte("Revolut •••• 1234")).toBe("Revolut");
    expect(nomDeCarte("Carte courses 5521")).toBe("Carte courses");
    expect(nomDeCarte(undefined)).toBe("Carte");
    expect(nomDeCommercant("MIGROS M RENENS")).toBe("Migros M Renens");
    expect(nomDeCommercant("Coop Pronto")).toBe("Coop Pronto");
    expect(nomDeCommercant("  ")).toBeNull();
  });

  it("met d'abord une carte inconnue à classer, puis la retient", () => {
    const { plan, ctx } = foyer();
    const premier = recevoirPaiement({ montant: "CHF 84.30", marchand: "MIGROS", carte: "Courses •••• 1111" }, [plan], "melo", JOUR, ctx);
    expect(premier.genre).toBe("paiement");
    if (premier.genre !== "paiement") return;
    expect(premier.doc.carte).toBe("Courses");

    const classe = classerPaiement(premier.doc, "courses", premier.doc.montant, ctx);
    expect(classe).toMatchObject({ id: premier.doc.id, pot: "courses", magasin: "Migros", source: "applepay", montant: 84.3 });
    const retenu = retenirCarte(plan, premier.doc.carte, "courses", ctx);
    expect(choixDeCarte(retenu, "courses")).toBe("courses");

    const suivant = recevoirPaiement({ montant: "CHF 12.00", marchand: "COOP", carte: "Courses •••• 1111" }, [retenu, classe], "melo", JOUR, ctx);
    expect(suivant.genre).toBe("depense");
    if (suivant.genre === "depense") expect(suivant.doc).toMatchObject({ pot: "courses", montant: 12, magasin: "Coop", carte: "Courses", par: "melo" });
  });

  it("laisse de côté une carte hors du budget, et ne note pas deux fois le même paiement", () => {
    const { plan, ctx } = foyer();
    const avecCartes = retenirCarte(retenirCarte(plan, "Perso", "aucun", ctx), "Plaisir", "plaisir", ctx);
    expect(recevoirPaiement({ montant: "CHF 9", carte: "Perso" }, [avecCartes], "melo", JOUR, ctx).genre).toBe("ignore");

    const recu = recevoirPaiement({ montant: "CHF 32", marchand: "PATHE", carte: "Plaisir" }, [avecCartes], "melo", JOUR, ctx);
    if (recu.genre !== "depense") throw new Error("attendu : une dépense");
    expect(recevoirPaiement({ montant: "CHF 32", marchand: "PATHE", carte: "Plaisir" }, [avecCartes, recu.doc], "melo", JOUR, ctx).genre).toBe("doublon");

    const aLaMain = nouvelleDepense({ montant: 18, pot: "plaisir", libelle: "Glaces", jour: JOUR }, "sarah", ctx);
    expect(recevoirPaiement({ montant: "CHF 18.00", marchand: "GELATERIA", carte: "Plaisir" }, [avecCartes, aLaMain], "melo", JOUR, ctx).genre).toBe("doublon");
  });

  it("garde à classer un paiement dans une autre monnaie, même d'une carte connue", () => {
    const { plan, ctx } = foyer();
    const avecCarte = retenirCarte(plan, "Plaisir", "plaisir", ctx);
    const recu = recevoirPaiement({ montant: "€20.00", marchand: "Café", carte: "Plaisir" }, [avecCarte], "melo", JOUR, ctx);
    expect(recu.genre).toBe("paiement");
    if (recu.genre === "paiement") {
      expect(recu.doc.devise).toBe("EUR");
      expect(classerPaiement(recu.doc, "plaisir", 19.2, ctx).montant).toBe(19.2);
    }
  });

  it("refuse tant que le budget n'est pas en place", () => {
    expect(recevoirPaiement({ montant: "CHF 5", carte: "X" }, [], null, JOUR, contexteTest()).genre).toBe("refuse");
  });

  it("complète le paiement par le ticket de caisse au lieu de compter deux fois", () => {
    const { plan, ctx } = foyer();
    const avecCarte = retenirCarte(plan, "Courses", "courses", ctx);
    const recu = recevoirPaiement({ montant: "CHF 47.85", marchand: "COOP", carte: "Courses" }, [avecCarte], "melo", JOUR, ctx);
    if (recu.genre !== "depense") throw new Error("attendu : une dépense");
    const docs: DocBudget[] = [avecCarte, recu.doc];
    const ticket = nouvelleDepense({ montant: 47.85, pot: "courses", libelle: "Coop Renens", magasin: "Coop Renens", jour: JOUR, source: "ticket", articles: [{ nom: "Lait", prix: 1.85 }] }, "sarah", ctx);
    const complete = completerPaiement(ticket, docs);
    expect(complete).toMatchObject({ id: recu.doc.id, magasin: "Coop Renens", articles: [{ nom: "Lait", prix: 1.85 }], source: "applepay" });
    expect(completerPaiement({ ...ticket, montant: 12 }, docs)).toBeNull();
  });

  it("liste les cartes avec leur dernier paiement", () => {
    const { plan, ctx } = foyer();
    const avecCarte = retenirCarte(plan, "Courses", "courses", ctx);
    const recu = recevoirPaiement({ montant: "CHF 10", carte: "Courses 1111" }, [avecCarte], "melo", JOUR, ctx);
    if (recu.genre !== "depense") throw new Error("attendu : une dépense");
    expect(cartesDuFoyer(avecCarte, [avecCarte, recu.doc])).toEqual([{ carte: "Courses", choix: "courses", dernier: JOUR }]);
    expect(paiementsAClasser([avecCarte, recu.doc])).toEqual([]);
  });

  it("prépare la demande pour l'IA de Raccourcis avec l'adresse de cet iPhone", () => {
    const demande = demandeRaccourci("https://exemple.supabase.co/functions/v1/paiements?j=abc");
    expect(demande).toContain("URL : https://exemple.supabase.co/functions/v1/paiements?j=abc");
    expect(demande).toContain("POST");
    expect(demande).toMatch(/montant[\s\S]*marchand[\s\S]*carte/);
  });
});
