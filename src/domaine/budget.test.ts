import { describe, expect, it } from "vitest";
import {
  abonnementsALAnnee,
  avanceeProjet,
  courbeEpargne,
  coursesParMagasin,
  coursesParMois,
  motDuMois,
  previsionFactures,
  prixQuiMontent,
  repartitionDuCommun,
  rythmeCourses,
  bilanDuMois,
  confirmerMois,
  decrireBudget,
  devinerCategorie,
  enregistrerPoste,
  etatDesPots,
  factures,
  facturesAPayer,
  facturesDuJour,
  formaterMontant,
  lireDepense,
  lireMontant,
  moisAConfirmer,
  nouveauPlan,
  nouveauPoste,
  nouvelleDepense,
  payerFacture,
  type DocBudget,
  type PlanBudget,
} from "./budget";
import { contexteTest } from "./contexteTest";

// Des montants inventés : la forme est celle de l'Excel du foyer, pas ses chiffres.
const A = "membre-a";
const B = "membre-b";
const AUJOURDHUI = "2026-10-19";

function plan(): PlanBudget {
  const ctx = contexteTest();
  let p = nouveauPlan([A, B], "2026-10-01", ctx);
  p = { ...p, personnes: [{ membreId: A, revenu: 4000, versement: 2000 }, { membreId: B, revenu: 3000, versement: 1500 }] };
  const postes = [
    nouveauPoste({ libelle: "Assurance maladie", montant: 300, qui: A }, ctx),
    nouveauPoste({ libelle: "Essence", montant: 100, qui: B }, ctx),
    nouveauPoste({ libelle: "Loyer", montant: 2000, pot: "commun" }, ctx),
    nouveauPoste({ libelle: "Courses", montant: 400, pot: "courses" }, ctx),
    nouveauPoste({ libelle: "Internet", montant: 100, pot: "factures", jour: 5, prelevement: true }, ctx),
    nouveauPoste({ libelle: "Électricité", montant: 60, pot: "factures", jour: 25 }, ctx),
    nouveauPoste({ libelle: "Assurance voiture", montant: 1200, frequence: "an", pot: "factures", mois: 11, jour: 2 }, ctx),
    nouveauPoste({ libelle: "Taxe véhicule", montant: 240, frequence: "an", pot: "factures" }, ctx),
  ];
  for (const x of postes) p = enregistrerPoste(p, x, ctx);
  return p;
}

describe("les montants", () => {
  it("s'écrivent comme sur un relevé suisse", () => {
    expect(formaterMontant(84.3)).toBe("84.30 CHF");
    expect(formaterMontant(2000)).toBe("2’000 CHF");
    expect(formaterMontant(1234567.5, false)).toBe("1’234’567.50");
    expect(formaterMontant(-12.5)).toBe("−12.50 CHF");
  });
  it("se lisent avec virgule, apostrophe ou .-", () => {
    expect(lireMontant("84,30")).toBe(84.3);
    expect(lireMontant("1'185")).toBe(1185);
    expect(lireMontant("2000.-")).toBe(2000);
    expect(lireMontant("abc")).toBeNull();
  });
});

describe("le bilan du mois, comme dans l'Excel", () => {
  const b = bilanDuMois(plan());
  it("calcule le reste de chacun", () => {
    expect(b.personnes[0]).toMatchObject({ charges: 300, reste: 1700 });
    expect(b.personnes[1]).toMatchObject({ charges: 100, reste: 1400 });
  });
  it("lisse les charges de l'année sur douze mois", () => {
    expect(b.provisionAnnuelle).toBe(120);
    expect(b.chargesCommunes).toBe(2000 + 400 + 100 + 60 + 120);
  });
  it("partage le reste du commun 30 % plaisir, 70 % épargne", () => {
    expect(b.entreeCommun).toBe(3500);
    expect(b.resteCommun).toBe(820);
    expect(b.versements.plaisir).toBe(246);
    expect(b.versements.epargne).toBe(574);
    expect(b.versements.factures).toBe(280);
    expect(b.versements.courses).toBe(400);
  });
  it("propose la part de chacun au prorata des salaires", () => {
    expect(b.personnes[0].auProrata).toBe(2000);
    expect(b.personnes[1].auProrata).toBe(1500);
  });
});

describe("les pots", () => {
  const ctx = contexteTest();
  const p = { ...plan(), depart: { mois: "2026-10", soldes: { factures: 500, courses: 30 } } };

  it("demandent de confirmer le mois une fois la paie passée", () => {
    expect(moisAConfirmer(p, [], AUJOURDHUI)).toBe("2026-10");
    expect(moisAConfirmer({ ...p, jourDePaie: 25 }, [], AUJOURDHUI)).toBeNull();
    const octobre = confirmerMois("2026-10", bilanDuMois(p).versements, A, ctx);
    expect(moisAConfirmer(p, [octobre], AUJOURDHUI)).toBeNull();
  });

  it("reportent ce qui reste et retirent les dépenses et les prélèvements", () => {
    const docs: DocBudget[] = [
      p,
      confirmerMois("2026-10", { ...bilanDuMois(p).versements, epargne: 500 }, A, ctx),
      nouvelleDepense({ montant: 84.3, pot: "courses", libelle: "Migros", jour: "2026-10-12" }, A, ctx),
      nouvelleDepense({ montant: 20, pot: "courses", libelle: "Avant le départ", jour: "2026-09-30" }, A, ctx),
    ];
    const pots = etatDesPots(p, docs, AUJOURDHUI);
    expect(pots.courses.solde).toBe(345.7);
    expect(pots.courses.depenseDuMois).toBe(84.3);
    // Internet prélevé le 5 : il sort seul du pot factures.
    expect(pots.factures.solde).toBe(500 + 280 - 100);
    expect(pots.epargne.solde).toBe(500);
  });
});

describe("les factures", () => {
  const ctx = contexteTest();
  const p = plan();

  it("tombent à leur jour, les prélèvements se paient seuls", () => {
    const f = factures(p, [p], AUJOURDHUI);
    const internet = f.filter((x) => x.poste.libelle === "Internet");
    expect(internet.map((x) => x.echeance)).toEqual(["2026-10-05", "2026-11-05", "2026-12-05"]);
    expect(internet[0].payee).toBe(true);
    expect(facturesAPayer(p, [p], AUJOURDHUI).map((x) => `${x.poste.libelle} ${x.echeance}`)).toEqual([
      "Électricité 2026-10-25",
      "Assurance voiture 2026-11-02",
      "Électricité 2026-11-25",
    ]);
  });

  it("une facture payée sort de la liste et du pot", () => {
    const [elec] = facturesAPayer(p, [p], AUJOURDHUI);
    const payee = payerFacture(elec, AUJOURDHUI, A, ctx);
    expect(payee).toMatchObject({ pot: "factures", montant: 60, echeance: "2026-10-25" });
    expect(facturesAPayer(p, [p, payee], AUJOURDHUI)[0].poste.libelle).toBe("Assurance voiture");
  });

  it("arrivent dans la carte du jour la veille et le jour même", () => {
    expect(facturesDuJour([p], "2026-10-24", 1)).toEqual([{ id: expect.any(String), libelle: "Électricité (60 CHF)", echeance: "2026-10-25" }]);
    expect(facturesDuJour([p], "2026-10-20", 1)).toEqual([]);
  });
});

describe("la barre du Budget", () => {
  const p = plan();
  it("comprend un ticket, une sortie, une facture", () => {
    expect(lireDepense("Migros 84.30", p)).toMatchObject({ montant: 84.3, pot: "courses", magasin: "Migros" });
    expect(lireDepense("32 cinéma", p)).toMatchObject({ montant: 32, pot: "plaisir", libelle: "Cinéma" });
    expect(lireDepense("payé électricité 60", p)).toMatchObject({ pot: "factures", libelle: "Électricité", posteId: expect.any(String) });
    expect(lireDepense("200 épargne", p)).toMatchObject({ montant: 200, pot: "epargne" });
    expect(lireDepense("Coop 1'185.50 courses", p)).toMatchObject({ montant: 1185.5, pot: "courses", magasin: "Coop" });
  });
  it("laisse à Jarvis une phrase sans montant", () => {
    expect(lireDepense("combien il reste ?", p)).toBeNull();
  });
});

describe("le projet d'épargne", () => {
  it("dit où on en est et ce qu'il faut par mois", () => {
    const p = { ...plan(), depart: { mois: "2026-10", soldes: { epargne: 1000 } }, projet: { nom: "Vacances", objectif: 4000, date: "2027-04-01" } };
    const a = avanceeProjet(p, [p], AUJOURDHUI)!;
    expect(a.part).toBe(0.25);
    expect(a.manque).toBe(3000);
    expect(a.parMoisPourLaDate).toBe(500);
    expect(a.atteintVers).toBe("2027-04");
  });
});

describe("Jarvis", () => {
  it("lit le budget dans l'état du foyer", () => {
    const p = plan();
    const lignes = decrireBudget([p], (id) => (id === A ? "Ana" : "Bob"), AUJOURDHUI);
    expect(lignes[0]).toMatch(/^Budget \(CHF\) : carte courses/);
    expect(lignes.join("\n")).toMatch(/Assurance maladie 300\/mois \(Ana\)/);
  });
  it("devine la catégorie d'une charge", () => {
    expect(devinerCategorie("Netflix")).toBe("abonnement");
    expect(devinerCategorie("Assurance maladie Visana")).toBe("sante");
    expect(devinerCategorie("Assurance voiture")).toBe("vehicule");
  });
});

describe("les visuels", () => {
  const ctx = contexteTest();
  const p = plan();

  it("l'anneau répartit l'entrée du commun entre les pots", () => {
    const r = repartitionDuCommun(p);
    expect(r.map((x) => x.pot)).toEqual(["commun", "courses", "factures", "plaisir", "epargne"]);
    expect(r.reduce((t, x) => t + x.part, 0)).toBeCloseTo(1);
    expect(r.find((x) => x.pot === "factures")!.postes.map((x) => x.libelle).slice(-2)).toEqual(["Électricité", "Taxe véhicule"]);
  });

  it("le rythme des courses projette la fin du mois", () => {
    const docs: DocBudget[] = [p, nouvelleDepense({ montant: 200, pot: "courses", libelle: "Migros", jour: "2026-10-10" }, A, ctx)];
    const r = rythmeCourses(p, docs, "2026-10-10")!;
    expect(r.depense).toBe(200);
    expect(r.attendu).toBe(129.03);
    expect(r.projection).toBe(620);
    expect(rythmeCourses(p, docs, "2026-10-03")!.projection).toBeNull();
  });

  it("la prévision du pot factures montre les mois lourds et le mois où il manquerait", () => {
    const depart = { ...p, depart: { mois: "2026-10", soldes: { factures: 100 } } };
    const f = previsionFactures(depart, [depart], AUJOURDHUI, 3);
    // Octobre : Internet est déjà prélevé (le 5) ; il reste l'électricité. Novembre : l'assurance voiture tombe.
    expect(f[0]).toMatchObject({ mois: "2026-10", sorties: 60, solde: 100 - 100 + 280 - 60 });
    expect(f[1]).toMatchObject({ mois: "2026-11", sorties: 1360, annuelles: [{ libelle: "Assurance voiture", montant: 1200 }] });
    expect(f[1].solde).toBeLessThan(0);
  });

  it("la courbe d'épargne suit les mois versés puis le rythme prévu", () => {
    const depart = { ...p, depart: { mois: "2026-09", soldes: { epargne: 1000 } }, projet: { nom: "Vacances", objectif: 2500, date: null } };
    const docs: DocBudget[] = [depart, confirmerMois("2026-09", { epargne: 500 }, A, ctx)];
    const c = courbeEpargne(depart, docs, AUJOURDHUI);
    expect(c.slice(0, 2)).toEqual([
      { mois: "2026-09", solde: 1500, prevu: false },
      { mois: "2026-10", solde: 1500, prevu: false },
    ]);
    expect(c[2]).toEqual({ mois: "2026-11", solde: 2074, prevu: true });
    expect(c.filter((x) => x.prevu).length).toBeGreaterThanOrEqual(3);
  });

  it("les courses se comptent par mois et par magasin", () => {
    const docs: DocBudget[] = [
      nouvelleDepense({ montant: 100, pot: "courses", libelle: "Migros", magasin: "Migros", jour: "2026-09-12" }, A, ctx),
      nouvelleDepense({ montant: 50, pot: "courses", libelle: "Coop", magasin: "Coop", jour: "2026-10-02" }, A, ctx),
      nouvelleDepense({ montant: 30, pot: "plaisir", libelle: "Cinéma", jour: "2026-10-03" }, A, ctx),
    ];
    expect(coursesParMois(docs, AUJOURDHUI, 2)).toEqual([{ mois: "2026-09", total: 100 }, { mois: "2026-10", total: 50 }]);
    expect(coursesParMagasin(docs, AUJOURDHUI).map((x) => x.magasin)).toEqual(["Migros", "Coop"]);
  });

  it("les abonnements se lisent à l'année", () => {
    const q = enregistrerPoste(p, { ...nouveauPoste({ libelle: "Netflix", montant: 20, qui: A }, ctx), id: "netflix" }, ctx);
    expect(abonnementsALAnnee(q).map((x) => `${x.poste.libelle} ${x.parAn}`)).toEqual(["Internet 1200", "Netflix 240"]);
    expect(abonnementsALAnnee(q, [B, null]).map((x) => x.poste.libelle)).toEqual(["Internet"]);
  });

  it("repère un prix qui monte sur les tickets", () => {
    const ticket = (jour: string, prix: number) =>
      nouvelleDepense({ montant: 40, pot: "courses", libelle: "Migros", magasin: "Migros", jour, source: "ticket", articles: [{ nom: "Lait entier 1 l", prix }, { nom: "Pain", prix: 3 }] }, A, ctx);
    const hausses = prixQuiMontent([ticket("2026-07-01", 1.6), ticket("2026-10-01", 1.75)], AUJOURDHUI);
    expect(hausses).toHaveLength(1);
    expect(hausses[0]).toMatchObject({ nom: "Lait entier 1 l", magasin: "Migros", avant: { prix: 1.6 }, maintenant: { prix: 1.75 } });
    expect(hausses[0].hausse).toBeCloseTo(0.094, 2);
  });

  it("Jarvis dit un mot du mois écoulé, la première semaine", () => {
    const depart = { ...p, depart: { mois: "2026-09", soldes: {} } };
    const docs: DocBudget[] = [
      depart,
      nouvelleDepense({ montant: 400, pot: "courses", libelle: "Courses", jour: "2026-09-10" }, A, ctx),
      nouvelleDepense({ montant: 340, pot: "courses", libelle: "Courses", jour: "2026-10-10" }, A, ctx),
      confirmerMois("2026-10", { epargne: 574 }, A, ctx),
    ];
    expect(motDuMois(depart, docs, "2026-11-03")).toBe("15 % de moins en courses qu'en septembre, bravo. L'épargne prévue est mise de côté (574 CHF).");
    expect(motDuMois(depart, docs, "2026-11-12")).toBeNull();
  });
});
