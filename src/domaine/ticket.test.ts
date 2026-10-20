import { describe, expect, it } from "vitest";
import { nouveauPlan, nouvelleDepense } from "./budget";
import { contexteTest } from "./contexteTest";
import { lireActions } from "./jarvis";
import { actionsDuTicket, jourDuTicket, lireTicket, paiementDuTicket } from "./ticket";

const AUJOURDHUI = "2026-10-20";

const lu = () =>
  lireActions([
    { nom: "ajouter_au_stock", entree: { produits: [{ nom: "1 l lait", lieu: "frigo", peremption: null }, { nom: "Épinards surgelés", lieu: "congelateur", peremption: "2027-03-01" }, { nom: "Savon", lieu: "placard", peremption: null }] } },
    { nom: "cocher_courses", entree: { articles: ["lait", "lait", "pain"] } },
    { nom: "noter_depense", entree: { montant: 47.851, libelle: "Coop", magasin: "Coop Renens", pot: "courses", jour: "2026-10-19", charge: null, articles: [{ nom: "Lait entier 1 l", prix: 1.85 }] } },
  ]);

describe("le ticket de caisse", () => {
  it("prépare la feuille de vérification : produits, courses sans doublon, total", () => {
    const t = lireTicket(lu(), [], AUJOURDHUI)!;
    expect(t.produits.map((p) => [p.nom, p.lieu, p.garder])).toEqual([["1 l lait", "frigo", true], ["Épinards surgelés", "congelateur", true], ["Savon", "placard", true]]);
    expect(t.courses).toEqual([{ texte: "lait", garder: true }, { texte: "pain", garder: true }]);
    expect(t.total).toEqual({ montant: 47.85, magasin: "Coop Renens", jour: "2026-10-19", articles: [{ nom: "Lait entier 1 l", prix: 1.85 }] });
  });

  it("montre la date devinée dès la vérification, et garde celle du ticket", () => {
    const t = lireTicket(lu(), [], AUJOURDHUI)!;
    expect(t.produits[0].peremption).not.toBeNull();
    expect(t.produits[1].peremption).toBe("2027-03-01");
  });

  it("ne garde pas une date de ticket impossible", () => {
    expect(jourDuTicket("2026-10-19", AUJOURDHUI)).toBe("2026-10-19");
    expect(jourDuTicket(null, AUJOURDHUI)).toBe(AUJOURDHUI);
    expect(jourDuTicket("2026-11-02", AUJOURDHUI)).toBe(AUJOURDHUI);
    expect(jourDuTicket("2024-10-19", AUJOURDHUI)).toBe(AUJOURDHUI);
    expect(jourDuTicket("19.10.26", AUJOURDHUI)).toBe(AUJOURDHUI);
  });

  it("ne propose rien quand la fée n'a rien trouvé", () => {
    expect(lireTicket([], [], AUJOURDHUI)).toBeNull();
    expect(lireTicket(lireActions([{ nom: "cocher_courses", entree: { articles: ["lait"] } }]), [], AUJOURDHUI)).toBeNull();
  });

  it("n'enregistre que ce qui reste coché, et le total s'il compte", () => {
    const t = lireTicket(lu(), [], AUJOURDHUI)!;
    t.produits[2].garder = false;
    t.courses[1].garder = false;
    const actions = actionsDuTicket(t, true);
    expect(actions).toHaveLength(3);
    expect(actions[0]).toMatchObject({ outil: "ajouter_au_stock", produits: [{ nom: "1 l lait" }, { nom: "Épinards surgelés" }] });
    expect(actions[1]).toEqual({ outil: "cocher_courses", articles: ["lait"] });
    expect(actions[2]).toMatchObject({ outil: "noter_depense", montant: 47.85, pot: "courses", magasin: "Coop Renens", jour: "2026-10-19", charge: null });
    expect(actionsDuTicket(t, false).map((a) => a.outil)).toEqual(["ajouter_au_stock", "cocher_courses"]);
  });

  it("repère le paiement Apple Pay du même jour et du même montant", () => {
    const ctx = contexteTest();
    const plan = nouveauPlan(["melo", "sarah"], "2026-10-01", ctx);
    const paye = nouvelleDepense({ montant: 47.85, pot: "courses", libelle: "Coop", magasin: "Coop", jour: "2026-10-19", source: "applepay" }, "melo", ctx);
    const t = lireTicket(lu(), [], AUJOURDHUI)!;
    expect(paiementDuTicket(t, [plan, paye])?.id).toBe(paye.id);
    expect(paiementDuTicket({ ...t, total: { ...t.total!, montant: 12 } }, [plan, paye])).toBeNull();
    expect(paiementDuTicket(t, [plan, { ...paye, articles: [{ nom: "Pain", prix: 3 }] }])).toBeNull();
  });
});
