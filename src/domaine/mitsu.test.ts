import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { ErreurValidation } from "./foyer";
import {
  ageEnMois,
  ajouterPesee,
  ajouterProvision,
  ajouterSoin,
  choseAFaire,
  decrireAge,
  marquerSoinFait,
  nouvelAnimal,
  nouveauSoin,
  nouvelleProvision,
  passageAdulte,
  prevoir,
  prochainePesee,
  rationDuJour,
  soinsAVenir,
  texteCourses,
  type Animal,
} from "./mitsu";

const NAISSANCE = "2026-04-14";

function mitsu(ctx = contexteTest()): Animal {
  return nouvelAnimal("mitsu", NAISSANCE, "2026-07-14", ctx);
}

describe("âge de Mitsu", () => {
  it("compte les mois révolus depuis sa naissance", () => {
    expect(ageEnMois(NAISSANCE, "2026-05-13")).toBe(0);
    expect(ageEnMois(NAISSANCE, "2026-05-14")).toBe(1);
    expect(ageEnMois(NAISSANCE, "2026-10-09")).toBe(5);
    expect(ageEnMois(NAISSANCE, "2027-04-14")).toBe(12);
  });

  it("dit son âge en mots", () => {
    expect(decrireAge(NAISSANCE, "2026-05-05")).toBe("3 semaines");
    expect(decrireAge(NAISSANCE, "2026-10-09")).toBe("5 mois");
    expect(decrireAge(NAISSANCE, "2027-04-20")).toBe("1 an");
    expect(decrireAge(NAISSANCE, "2027-06-20")).toBe("1 an et 2 mois");
  });

  it("annonce le passage aux croquettes adulte à 12 mois", () => {
    expect(passageAdulte(NAISSANCE)).toBe("2027-04-14");
  });

  it("refuse un animal sans nom ou avec une date invalide", () => {
    expect(() => nouvelAnimal("  ", NAISSANCE, null, contexteTest())).toThrow(ErreurValidation);
    expect(() => nouvelAnimal("Mitsu", "14/04/2026", null, contexteTest())).toThrow(ErreurValidation);
  });
});

describe("ration de croquettes", () => {
  it("attend une première pesée pour l'estimer", () => {
    expect(rationDuJour(mitsu(), "2026-10-09")).toBeNull();
  });

  it("l'estime selon son âge et son poids", () => {
    const ctx = contexteTest();
    const a = ajouterPesee(mitsu(ctx), 2500, "2026-10-09", null, ctx);
    // 5 mois, 2,5 kg : 70 × 2,5^0,75 × 2 ≈ 278 kcal, soit ≈ 70 g à 4 kcal/g.
    expect(rationDuJour(a, "2026-10-09")).toEqual({ grammes: 70, kcal: 278, source: "estimee" });
  });

  it("baisse quand elle devient adulte, et encore un peu une fois stérilisée", () => {
    const ctx = contexteTest();
    const a = ajouterPesee(mitsu(ctx), 4000, "2027-05-01", null, ctx);
    const adulte = rationDuJour(a, "2027-05-01")!.grammes;
    const sterilisee = rationDuJour({ ...a, sterilise: true }, "2027-05-01")!.grammes;
    expect(adulte).toBeLessThan(rationDuJour(a, "2026-10-09")!.grammes);
    expect(sterilisee).toBeLessThan(adulte);
  });

  it("suit la ration du paquet quand elle est notée", () => {
    const a = { ...mitsu(), reglages: { ...mitsu().reglages, rationDuPaquet: 55 } };
    expect(rationDuJour(a, "2026-10-09")).toEqual({ grammes: 55, kcal: 220, source: "paquet" });
  });
});

describe("pesées", () => {
  it("garde une seule pesée par jour et refuse un poids impossible", () => {
    const ctx = contexteTest();
    let a = ajouterPesee(mitsu(ctx), 2400, "2026-10-09", null, ctx);
    a = ajouterPesee(a, 2450, "2026-10-09", null, ctx);
    expect(a.pesees.map((p) => p.grammes)).toEqual([2450]);
    expect(() => ajouterPesee(a, 20, "2026-10-10", null, ctx)).toThrow(ErreurValidation);
  });

  it("prévoit la suivante toutes les 2 semaines, puis chaque mois une fois adulte", () => {
    const ctx = contexteTest();
    expect(prochainePesee(mitsu(ctx), "2026-10-09")).toBe("2026-10-09");
    const a = ajouterPesee(mitsu(ctx), 2500, "2026-10-09", null, ctx);
    expect(prochainePesee(a, "2026-10-09")).toBe("2026-10-23");
    const b = ajouterPesee(a, 4000, "2027-05-01", null, ctx);
    expect(prochainePesee(b, "2027-05-01")).toBe("2027-05-31");
  });
});

describe("provisions", () => {
  const ctx = contexteTest();
  const base = ajouterPesee(mitsu(ctx), 2500, "2026-10-01", null, ctx); // ≈ 70 g par jour
  const sac = nouvelleProvision({ type: "croquettes", nom: "Kitten", grammes: 2000, achete: "2026-10-01", parJour: null }, ctx);
  const avecSac = ajouterProvision(base, sac);

  it("prévoit la fin du sac et le jour où commander", () => {
    // 2000 g − 8 jours × 70 g = 1440 g, soit 20 jours.
    expect(prevoir(sac, avecSac, "2026-10-09")).toEqual({
      restant: 1440,
      joursRestants: 20,
      fin: "2026-10-29",
      commanderLe: "2026-10-19",
      etat: "ok",
    });
  });

  it("demande de commander dans les 10 derniers jours, puis signale la fin", () => {
    // À 6 mois la ration baisse (≈ 55 g) : le sac dure un peu plus longtemps.
    expect(prevoir(sac, avecSac, "2026-10-20")!.etat).toBe("ok");
    expect(prevoir(sac, avecSac, "2026-10-28")!.etat).toBe("commander");
    expect(prevoir(sac, avecSac, "2026-11-20")!.etat).toBe("epuise");
  });

  it("utilise la consommation notée pour la litière, et rien sans elle", () => {
    const litiere = nouvelleProvision({ type: "litiere", nom: "", grammes: 10000, achete: "2026-10-01", parJour: 200 }, ctx);
    expect(prevoir(litiere, avecSac, "2026-10-09")!.joursRestants).toBe(42);
    const patee = nouvelleProvision({ type: "patee", nom: "", grammes: 1000, achete: "2026-10-01", parJour: null }, ctx);
    expect(prevoir(patee, avecSac, "2026-10-09")).toBeNull();
    expect(litiere.nom).toBe("Litière");
  });

  it("écrit la ligne de la liste de courses", () => {
    expect(texteCourses(sac, avecSac)).toBe("Croquettes Mitsu (Kitten)");
  });
});

describe("carnet de santé", () => {
  it("prévoit le rappel suivant quand un soin est fait", () => {
    const ctx = contexteTest();
    let a = ajouterSoin(mitsu(ctx), nouveauSoin("vermifuge", "2026-10-09", "", ctx));
    a = marquerSoinFait(a, a.soins[0].id, "2026-10-09", ctx);
    // À 5 mois, vermifuge chaque mois.
    expect(soinsAVenir(a).map((s) => [s.libelle, s.date])).toEqual([["Vermifuge", "2026-11-09"]]);
    let b = ajouterSoin(a, nouveauSoin("vaccin", "2026-10-12", "Rappel typhus-coryza", ctx));
    b = marquerSoinFait(b, b.soins.at(-1)!.id, "2026-10-12", ctx);
    expect(soinsAVenir(b).at(-1)).toMatchObject({ libelle: "Rappel typhus-coryza", date: "2027-10-12" });
  });

  it("note la stérilisation une fois faite", () => {
    const ctx = contexteTest();
    let a = ajouterSoin(mitsu(ctx), nouveauSoin("sterilisation", "2026-11-02", "", ctx));
    a = marquerSoinFait(a, a.soins[0].id, "2026-11-02", ctx);
    expect(a.sterilise).toBe(true);
    expect(soinsAVenir(a)).toEqual([]);
  });
});

describe("ce qui est à faire", () => {
  it("met d'abord la commande et le soin proches, puis la pesée", () => {
    const ctx = contexteTest();
    let a = ajouterPesee(mitsu(ctx), 2500, "2026-10-01", null, ctx);
    a = ajouterProvision(a, nouvelleProvision({ type: "croquettes", nom: "Kitten", grammes: 1000, achete: "2026-10-01", parJour: null }, ctx));
    a = ajouterSoin(a, nouveauSoin("vaccin", "2026-10-20", "Rappel vaccin", ctx));
    a = ajouterSoin(a, nouveauSoin("visite", "2026-12-01", "", ctx));
    expect(choseAFaire(a, "2026-10-15")).toEqual([
      { texte: "Commander Kitten : 4 j de stock", urgent: true },
      { texte: "Rappel vaccin dans 5 jours", urgent: true },
      { texte: "La peser", urgent: false },
    ]);
  });

  it("n'a rien à signaler quand tout est en ordre", () => {
    const ctx = contexteTest();
    const a = ajouterPesee(mitsu(ctx), 2500, "2026-10-09", null, ctx);
    expect(choseAFaire(a, "2026-10-09")).toEqual([]);
  });

  it("rappelle le passage aux croquettes adulte le mois d'avant", () => {
    const ctx = contexteTest();
    const a = ajouterPesee(mitsu(ctx), 3800, "2027-03-20", null, ctx);
    expect(choseAFaire(a, "2027-03-20")).toEqual([{ texte: "Passer aux croquettes adulte dans 25 jours", urgent: false }]);
  });
});
