import { describe, expect, it } from "vitest";
import { nouveauPlan, nouvelleDepense } from "./budget";
import { contexteTest } from "./contexteTest";
import { aCocher, importerReleve, lireReleve, preparerReleve } from "./releve";

const ANGLAIS = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-10-03 18:02:11,2026-10-04 09:12:40,MIGROS M RENENS,-84.30,0.00,CHF,COMPLETED,915.70
CARD_PAYMENT,Current,2026-10-05 12:00:00,2026-10-05 12:00:05,"Coop Pronto, Lausanne",-12.50,0.00,CHF,COMPLETED,903.20
TOPUP,Current,2026-10-01 08:00:00,2026-10-01 08:00:01,Top-Up by *1234,400.00,0.00,CHF,COMPLETED,1000.00
TRANSFER,Current,2026-10-06 10:00:00,2026-10-06 10:00:01,To CHF Plaisir,-50.00,0.00,CHF,COMPLETED,853.20
CARD_PAYMENT,Current,2026-10-07 20:00:00,,Netflix,-15.90,0.00,CHF,PENDING,837.30
CARD_PAYMENT,Current,2026-10-08 14:00:00,2026-10-09 08:00:00,AMAZON EU,-30.00,0.50,EUR,COMPLETED,10.00`;

const FRANCAIS = `Type;Produit;Date de début;Date de fin;Description;Montant;Frais;Devise;État;Solde
Paiement par carte;Actuel;04.10.2026 18:02;04.10.2026 18:03;Denner;-23,40;0,00;CHF;TERMINÉ;100,00`;

describe("le relevé Revolut", () => {
  it("lit les sorties terminées d'un export en anglais", () => {
    const lignes = lireReleve(ANGLAIS)!;
    expect(lignes.map((l) => [l.jour, l.montant, l.libelle])).toEqual([
      ["2026-10-04", 84.3, "Migros M Renens"],
      ["2026-10-05", 12.5, "Coop Pronto, Lausanne"],
      ["2026-10-06", 50, "To CHF Plaisir"],
      ["2026-10-09", 30.5, "Amazon Eu"],
    ]);
    expect(lignes.filter(aCocher).map((l) => l.libelle)).toEqual(["Migros M Renens", "Coop Pronto, Lausanne"]);
  });

  it("lit aussi un export en français, au point-virgule", () => {
    expect(lireReleve(FRANCAIS)).toEqual([{ jour: "2026-10-04", montant: 23.4, libelle: "Denner", devise: "CHF", type: "Paiement par carte", mouvement: false }]);
  });

  it("refuse un fichier qui n'est pas un relevé", () => {
    expect(lireReleve("nom,prix\nlait,1.80")).toBeNull();
    expect(lireReleve("")).toBeNull();
  });

  it("ne reprend pas ce qui est déjà noté, à un jour près, une fois par dépense", () => {
    const ctx = contexteTest();
    const plan = nouveauPlan(["melo"], "2026-10-01", ctx);
    const parApplePay = nouvelleDepense({ montant: 84.3, pot: "courses", libelle: "Migros", jour: "2026-10-03", source: "applepay" }, "melo", ctx);
    const lignes = lireReleve(ANGLAIS)!;
    const { nouvelles, deja } = preparerReleve([...lignes, { ...lignes[0] }], [plan, parApplePay]);
    expect(deja.map((l) => l.libelle)).toEqual(["Migros M Renens"]);
    expect(nouvelles.map((l) => l.libelle)).toContain("Migros M Renens");
    expect(nouvelles).toHaveLength(4);
  });

  it("fait des dépenses du pot choisi, marquées « relevé »", () => {
    const [ligne] = lireReleve(FRANCAIS)!;
    expect(importerReleve([ligne], "courses", "melo", contexteTest())[0]).toMatchObject({ jour: "2026-10-04", montant: 23.4, pot: "courses", magasin: "Denner", source: "releve", par: "melo" });
  });
});
