import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { ErreurValidation } from "./foyer";
import {
  aAjouterALaCommande,
  ageEnMois,
  consommationApprise,
  paquetFini,
  formaterQuantite,
  prochaineOccurrence,
  conseilCommande,
  definirCommande,
  passerCommande,
  videsAvantLivraison,
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
    expect(rationDuJour(a, "2026-10-09")).toEqual({ grammes: 70, kcal: 278, source: "estimee", friandisesMax: 8 });
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
    expect(rationDuJour(a, "2026-10-09")).toEqual({ grammes: 55, kcal: 220, source: "paquet", friandisesMax: 6 });
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

  it("prévoit la suivante environ 6 mois plus tard, ou au rythme choisi", () => {
    const ctx = contexteTest();
    expect(prochainePesee(mitsu(ctx), "2026-10-09")).toBe("2026-10-09");
    const a = ajouterPesee(mitsu(ctx), 2500, "2026-10-09", null, ctx);
    expect(prochainePesee(a, "2026-10-09")).toBe("2027-04-07");
    const b = { ...a, reglages: { ...a.reglages, peseeTousLes: 30 } };
    expect(prochainePesee(b, "2026-10-09")).toBe("2026-11-08");
  });
});

describe("provisions", () => {
  const ctx = contexteTest();
  const base = ajouterPesee(mitsu(ctx), 2500, "2026-10-01", null, ctx); // ≈ 70 g par jour
  const sac = nouvelleProvision({ type: "croquettes", nom: "Kitten", quantite: 2000, achete: "2026-10-01", parJour: null }, ctx);
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
    const litiere = nouvelleProvision({ type: "litiere", nom: "", quantite: 10000, achete: "2026-10-01", parJour: 200 }, ctx);
    expect(prevoir(litiere, avecSac, "2026-10-09")!.joursRestants).toBe(42);
    const patee = nouvelleProvision({ type: "patee", nom: "", quantite: 1000, achete: "2026-10-01", parJour: null }, ctx);
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
    a = ajouterProvision(a, nouvelleProvision({ type: "croquettes", nom: "Kitten", quantite: 1000, achete: "2026-10-01", parJour: null }, ctx));
    a = ajouterSoin(a, nouveauSoin("vaccin", "2026-10-20", "Rappel vaccin", ctx));
    a = ajouterSoin(a, nouveauSoin("visite", "2026-12-01", "", ctx));
    expect(choseAFaire(a, "2026-10-15")).toEqual([
      { texte: "Commander Kitten : 4 j de stock", urgent: true },
      { texte: "Rappel vaccin dans 5 jours", urgent: true, soinId: a.soins.find((x) => x.libelle === "Rappel vaccin")!.id },
    ]);
    expect(choseAFaire(a, "2027-04-01")).toContainEqual({ texte: "La peser", urgent: false });
  });

  it("n'a rien à signaler quand tout est en ordre", () => {
    const ctx = contexteTest();
    const a = ajouterPesee(mitsu(ctx), 2500, "2026-10-09", null, ctx);
    expect(choseAFaire(a, "2026-10-09").filter((c) => c.urgent)).toEqual([]);
  });

  it("rappelle le passage aux croquettes adulte le mois d'avant", () => {
    const ctx = contexteTest();
    const a = ajouterPesee(mitsu(ctx), 3800, "2027-03-20", null, ctx);
    expect(choseAFaire(a, "2027-03-20")).toEqual([{ texte: "Passer aux croquettes adulte dans 25 jours", urgent: false }]);
  });
});

describe("commande régulière", () => {
  const ARTICLES = [
    { type: "croquettes" as const, nom: "Pro Plan Kitten", quantite: 6000 },
    { type: "litiere" as const, nom: "Tigerino Crystals", quantite: 15000 },
  ];

  function avecCommande(ctx = contexteTest()) {
    let a = definirCommande(mitsu(ctx), { fournisseur: "zooplus", tousLesMois: 3, prochaine: "2026-10-27", articles: ARTICLES });
    for (const art of ARTICLES) {
      a = ajouterProvision(a, nouvelleProvision({ ...art, achete: "2026-08-02", parJour: null }, ctx));
    }
    return a;
  }

  it("déduit la consommation de la commande quand on ne connaît pas son poids", () => {
    const a = avecCommande();
    // 6 kg tous les 3 mois (92 jours) ≈ 65 g par jour : 68 jours écoulés le 9 octobre.
    expect(prevoir(a.provisions[0], a, "2026-10-09")).toMatchObject({ restant: 1580, fin: "2026-11-02" });
  });

  it("rappelle la commande 3 jours avant, et pas avant", () => {
    const a = avecCommande();
    expect(choseAFaire(a, "2026-10-09").filter((c) => c.urgent)).toEqual([]);
    expect(choseAFaire(a, "2026-10-24")).toContainEqual({ texte: "Commande zooplus dans 3 jours", urgent: true });
  });

  it("prévient quand un produit sera vide avant l'arrivée de la commande", () => {
    const ctx = contexteTest();
    const a = ajouterPesee(avecCommande(ctx), 3500, "2026-10-09", null, ctx);
    // Avec son poids, la ration (≈ 70 g) passe devant l'estimation de la commande.
    expect(videsAvantLivraison(a, "2026-10-09").map((v) => v.provision.nom)).toEqual(["Pro Plan Kitten"]);
    expect(choseAFaire(a, "2026-10-09")[0].texte).toMatch(/^Pro Plan Kitten : vide vers le/);
  });

  it("remplit le stock et prévoit la commande suivante quand elle est passée", () => {
    const ctx = contexteTest();
    const a = passerCommande(avecCommande(ctx), "2026-10-24", ctx);
    expect(a.commande!.prochaine).toBe("2027-01-27");
    expect(a.provisions).toHaveLength(2);
    expect(a.provisions[0]).toMatchObject({ achete: "2026-10-24", quantite: 6000 + 605 });
  });

  it("conseille la transition vers les croquettes adulte pour la commande qui couvre ses 1 an", () => {
    const a = avecCommande();
    expect(conseilCommande(a)).toBeNull();
    const janvier = { ...a, commande: { ...a.commande!, prochaine: "2027-01-27" } };
    expect(conseilCommande(janvier)).toMatch(/couvre ses 1 an \(14\/04\)/);
  });
});

describe("filtres de la fontaine", () => {
  function avecFiltres(ctx = contexteTest()) {
    let a = definirCommande(mitsu(ctx), {
      fournisseur: "zooplus",
      tousLesMois: 3,
      prochaine: "2026-10-27",
      articles: [{ type: "croquettes", nom: "Pro Plan Kitten", quantite: 6000 }],
    });
    a = ajouterProvision(a, nouvelleProvision({ type: "filtres", nom: "Filtres PIXI", quantite: 6, achete: "2026-08-02", parJour: null }, ctx));
    return a;
  }

  it("compte un filtre par mois", () => {
    const a = avecFiltres();
    // 68 jours : 3 filtres mis (2 août, 2 septembre, 2 octobre), il en reste 3 dans le placard.
    expect(prevoir(a.provisions[0], a, "2026-10-09")).toMatchObject({ restant: 3, fin: "2027-01-29" });
    expect(formaterQuantite("filtres", 1)).toBe("1 filtre");
  });

  it("demande de les ajouter à la commande qui précède leur fin", () => {
    const a = avecFiltres();
    // Vides le 29 janvier, la commande de janvier arrive le 30 : il faut les prendre en octobre.
    expect(aAjouterALaCommande(a, "2026-10-09").map((x) => x.provision.nom)).toEqual(["Filtres PIXI"]);
    expect(choseAFaire(a, "2026-10-09").filter((c) => c.urgent)).toEqual([]);
    expect(choseAFaire(a, "2026-10-25")).toContainEqual({ texte: "Ajouter Filtres PIXI à la commande", urgent: true });
  });

  it("remet un lot de filtres quand ils sont pris avec la commande", () => {
    const ctx = contexteTest();
    const a = avecFiltres(ctx);
    const apres = passerCommande(a, "2026-10-24", ctx, [a.provisions[0].id]);
    expect(apres.provisions[0]).toMatchObject({ achete: "2026-10-24", quantite: 3 + 6 });
    expect(aAjouterALaCommande(apres, "2026-10-24")).toEqual([]);
  });

  it("rappelle de changer le filtre chaque mois", () => {
    const ctx = contexteTest();
    expect(prochaineOccurrence("2026-08-02", 1, "2026-10-09")).toBe("2026-11-02");
    let a = ajouterSoin(mitsu(ctx), nouveauSoin("filtre", "2026-11-02", "", ctx));
    a = marquerSoinFait(a, a.soins[0].id, "2026-11-02", ctx);
    expect(soinsAVenir(a)).toMatchObject([{ libelle: "Changer le filtre de la fontaine", date: "2026-12-02" }]);
  });
});

describe("ce que Mitsu mange vraiment", () => {
  it("apprend de chaque paquet fini et s'en sert pour prévoir", () => {
    const ctx = contexteTest();
    const p = nouvelleProvision({ type: "croquettes", nom: "Pro Plan", quantite: 1500, achete: "2026-09-01", parJour: null }, ctx);
    const mitsu = ajouterProvision(nouvelAnimal("Mitsu", "2026-03-01", null, ctx), p);
    const { animal, observee } = paquetFini(mitsu, p.id, "2026-09-26");
    expect(observee).toMatchObject({ parJour: 60, jour: "2026-09-26" });
    expect(animal.provisions).toEqual([]);
    expect(consommationApprise(animal, { type: "croquettes", nom: "Autre marque" })).toBe(60);
    // Un paquet fini en deux jours ne dit rien.
    expect(paquetFini(mitsu, p.id, "2026-09-03").observee).toBeNull();
  });
});

describe("le poids estimé et la ration réglée à la main", () => {
  it("le poids estimé sert à la ration sans devenir une pesée, jusqu'à la pesée suivante", async () => {
    const { nouvelAnimal, ajouterPesee, reglerPoidsEtRation, rationDuJour, poidsDeReference } = await import("./mitsu");
    const { contexteTest } = await import("./contexteTest");
    const ctx = contexteTest("2026-10-21T08:00:00.000Z");
    const base = ajouterPesee(nouvelAnimal("Mitsu", "2026-04-14", null, ctx), 1000, "2026-09-01", null, ctx);
    const avant = rationDuJour(base, "2026-10-21")!.grammes;
    const estime = reglerPoidsEtRation(base, { poidsEstime: 1600 }, "2026-10-21");
    expect(estime.pesees).toHaveLength(1);
    expect(poidsDeReference(estime)).toEqual({ grammes: 1600, jour: "2026-10-21", estime: true });
    expect(rationDuJour(estime, "2026-10-21")!.grammes).toBeGreaterThan(avant);
    // Une vraie pesée plus tard reprend la main.
    const pesee = ajouterPesee(estime, 1700, "2026-10-25", null, ctx);
    expect(poidsDeReference(pesee)?.estime).toBe(false);
    // Une ration donnée l'emporte sur le calcul.
    expect(rationDuJour(reglerPoidsEtRation(estime, { ration: 45 }, "2026-10-21"), "2026-10-21")?.source).toBe("paquet");
    expect(() => reglerPoidsEtRation(base, { poidsEstime: 20 }, "2026-10-21")).toThrow();
  });
});
