import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { ErreurValidation } from "./foyer";
import {
  ajouterPesee,
  ajouterSoin,
  alertePoids,
  alertesJournal,
  choseAFaire,
  derniereLitiere,
  ecarterProposition,
  ficheDeGarde,
  marquerSoinFait,
  modifierInfos,
  noterEvenement,
  noterSoin,
  nouvelAnimal,
  nouveauSoin,
  poidsRepere,
  propositionsCarnet,
  rationDuJour,
  reprendreProposition,
  resumeVeto,
  type Animal,
} from "./mitsu";

const NAISSANCE = "2026-04-14";
const AUJOURDHUI = "2026-10-12";

function mitsu(ctx = contexteTest()): Animal {
  return nouvelAnimal("Mitsu", NAISSANCE, "2026-06-21", ctx);
}

describe("friandises", () => {
  it("les limite à 10 % de ce qu'elle mange et les retire des croquettes", () => {
    const ctx = contexteTest();
    const a = ajouterPesee(mitsu(ctx), 2500, "2026-10-09", null, ctx);
    const sans = rationDuJour(a, "2026-10-09")!;
    expect(sans.friandisesMax).toBe(8);
    const avec = rationDuJour({ ...a, reglages: { ...a.reglages, friandisesParJour: 6 } }, "2026-10-09")!;
    // 6 g × 3,5 kcal = 21 kcal de moins, soit environ 5 g de croquettes.
    expect(avec.grammes).toBe(sans.grammes - 5);
    expect(avec.kcal).toBe(sans.kcal);
  });

  it("retire aussi les friandises de la ration du paquet", () => {
    const a = mitsu();
    const r = rationDuJour({ ...a, reglages: { ...a.reglages, rationDuPaquet: 60, friandisesParJour: 4 } }, AUJOURDHUI)!;
    expect(r.grammes).toBe(57);
  });
});

describe("courbe de poids", () => {
  it("donne un repère qui grandit avec l'âge, plus lourd pour un mâle", () => {
    const six = poidsRepere(NAISSANCE, "2026-10-14");
    expect(six.median).toBeGreaterThan(2500);
    expect(six.median).toBeLessThan(3000);
    expect(six.min).toBeLessThan(six.median);
    expect(poidsRepere(NAISSANCE, "2028-01-01").median).toBe(3700);
    expect(poidsRepere(NAISSANCE, "2028-01-01", "male").median).toBe(4440);
  });

  it("alerte quand un chaton perd du poids", () => {
    const ctx = contexteTest();
    let a = ajouterPesee(mitsu(ctx), 2700, "2026-09-01", null, ctx);
    a = ajouterPesee(a, 2600, "2026-10-10", null, ctx);
    expect(alertePoids(a)).toEqual({ texte: "Mitsu a perdu 100 g depuis le 01/09 : à signaler au vétérinaire", urgent: true });
    expect(choseAFaire(a, AUJOURDHUI).some((c) => c.texte.startsWith("Mitsu a perdu") && c.urgent)).toBe(true);
  });

  it("signale sans urgence un poids loin du repère", () => {
    const ctx = contexteTest();
    expect(alertePoids(ajouterPesee(mitsu(ctx), 1500, "2026-10-10", null, ctx))?.urgent).toBe(false);
    expect(alertePoids(ajouterPesee(mitsu(ctx), 2800, "2026-10-10", null, ctx))).toBeNull();
  });
});

describe("carnet prérempli", () => {
  it("propose le calendrier d'un chaton", () => {
    const cles = propositionsCarnet(mitsu(), AUJOURDHUI).map((p) => p.cle);
    expect(cles).toEqual(["vaccin-8s", "vaccin-12s", "vaccin-16s", "vaccin-rappel", "vermifuge", "antiparasitaire", "sterilisation"]);
    const p = propositionsCarnet(mitsu(), AUJOURDHUI);
    expect(p[0].date).toBe("2026-06-09");
    expect(p[3].date).toBe("2027-08-04");
  });

  it("ne repropose pas ce qui est déjà dans le carnet, à trois semaines près, ni ce qui est écarté", () => {
    const ctx = contexteTest();
    let a = ajouterSoin(mitsu(ctx), { ...nouveauSoin("vaccin", "2026-07-15", "Vaccin", ctx), fait: true });
    a = ecarterProposition(a, "antiparasitaire");
    const cles = propositionsCarnet(a, AUJOURDHUI).map((p) => p.cle);
    expect(cles).not.toContain("vaccin-12s");
    expect(cles).not.toContain("antiparasitaire");
    expect(cles).toContain("vaccin-8s");
  });

  it("note une proposition passée comme faite à sa date, ou la prévoit au plus tôt aujourd'hui", () => {
    const ctx = contexteTest();
    const [premiere] = propositionsCarnet(mitsu(ctx), AUJOURDHUI);
    const fait = reprendreProposition(mitsu(ctx), premiere, true, AUJOURDHUI, ctx);
    expect(fait.soins[0]).toMatchObject({ date: "2026-06-09", fait: true });
    const prevu = reprendreProposition(mitsu(ctx), premiere, false, AUJOURDHUI, ctx);
    expect(prevu.soins[0]).toMatchObject({ date: AUJOURDHUI, fait: false });
  });

  it("prévoit le vermifuge suivant quand il est coché", () => {
    const ctx = contexteTest();
    const p = propositionsCarnet(mitsu(ctx), AUJOURDHUI).find((x) => x.cle === "vermifuge")!;
    const a = reprendreProposition(mitsu(ctx), p, true, AUJOURDHUI, ctx);
    // À 5 mois, chaque mois.
    expect(a.soins.map((s) => [s.date, s.fait])).toEqual([[AUJOURDHUI, true], ["2026-11-12", false]]);
  });

  it("en parler au vétérinaire ne la déclare pas stérilisée", () => {
    const ctx = contexteTest();
    const p = propositionsCarnet(mitsu(ctx), AUJOURDHUI).find((x) => x.cle === "sterilisation")!;
    let a = reprendreProposition(mitsu(ctx), p, false, AUJOURDHUI, ctx);
    a = marquerSoinFait(a, a.soins[0].id, AUJOURDHUI, ctx);
    expect(a.sterilise).toBe(false);
    expect(a.soins.filter((s) => !s.fait)).toHaveLength(0);
  });

  it("note un soin relu sur le carnet une seule fois", () => {
    const ctx = contexteTest();
    const champs = { type: "vaccin" as const, libelle: "Rappel", date: "2026-07-15", fait: true };
    const a = noterSoin(mitsu(ctx), champs, ctx);
    expect(noterSoin(a, champs, ctx)).toBe(a);
    expect(noterSoin(a, { type: "sterilisation", libelle: "", date: AUJOURDHUI, fait: true }, ctx).sterilise).toBe(true);
  });
});

describe("journal du quotidien", () => {
  it("note un événement et retrouve la dernière litière", () => {
    const ctx = contexteTest();
    let a = noterEvenement(mitsu(ctx), "litiere", "2026-10-01", "", "melo", ctx);
    a = noterEvenement(a, "litiere", "2026-10-10", "", "sarah", ctx);
    expect(derniereLitiere(a)).toMatchObject({ jour: "2026-10-10", par: "sarah" });
  });

  it("demande un mot pour « autre »", () => {
    expect(() => noterEvenement(mitsu(), "autre", AUJOURDHUI, " ", null, contexteTest())).toThrow(ErreurValidation);
  });

  it("alerte quand un souci revient", () => {
    const ctx = contexteTest();
    let a = noterEvenement(mitsu(ctx), "vomi", "2026-10-06", "", null, ctx);
    a = noterEvenement(a, "vomi", "2026-10-09", "", null, ctx);
    expect(alertesJournal(a, AUJOURDHUI)).toEqual([]);
    a = noterEvenement(a, "vomi", "2026-10-12", "", null, ctx);
    expect(alertesJournal(a, AUJOURDHUI)).toEqual(["A vomi 3 fois en 7 jours : appeler le vétérinaire"]);
    // Une semaine plus tard, la première est oubliée.
    expect(alertesJournal(a, "2026-10-14")).toEqual([]);
  });

  it("s'inquiète vite quand elle ne mange pas deux jours", () => {
    const ctx = contexteTest();
    let a = noterEvenement(mitsu(ctx), "pas_mange", "2026-10-11", "", null, ctx);
    a = noterEvenement(a, "pas_mange", "2026-10-12", "", null, ctx);
    const aFaire = choseAFaire(a, AUJOURDHUI);
    expect(aFaire[0]).toEqual({ texte: "Mitsu n'a pas mangé 2 jours : appeler le vétérinaire", urgent: true });
  });
});

describe("fiches à partager", () => {
  it("résume pour le vétérinaire les soucis depuis la dernière visite", () => {
    const ctx = contexteTest();
    let a = ajouterPesee(mitsu(ctx), 2600, "2026-10-01", null, ctx);
    a = ajouterSoin(a, { ...nouveauSoin("visite", "2026-09-01", "Contrôle", ctx), fait: true });
    a = noterEvenement(a, "vomi", "2026-08-20", "", null, ctx);
    a = noterEvenement(a, "vomi", "2026-10-05", "après les friandises", null, ctx);
    a = modifierInfos(a, { puce: "756 0981 2345 678", veterinaire: " " });
    const resume = resumeVeto(a, AUJOURDHUI);
    expect(resume).toContain("Mitsu, femelle, née le 14.04.2026 (5 mois)");
    expect(resume).toContain("Puce : 756 0981 2345 678.");
    expect(resume).toContain("2,6 kg le 01.10.2026");
    expect(resume).toContain("Depuis le 01.09.2026 : a vomi le 05.10.2026 (après les friandises).");
    expect(resume).not.toContain("20.08.2026");
    expect(a.infos).toEqual({ puce: "756 0981 2345 678" });
  });

  it("prépare la fiche de garde avec la ration et le vétérinaire", () => {
    const ctx = contexteTest();
    let a = ajouterPesee(mitsu(ctx), 2600, "2026-10-01", null, ctx);
    a = modifierInfos(a, { veterinaire: "Clinique du Léman", telephoneVeto: "021 000 00 00", consignes: "Elle se cache sous le lit." });
    const fiche = ficheDeGarde(a, AUJOURDHUI);
    expect(fiche).toMatch(/Repas : \d+ g de croquettes par jour/);
    expect(fiche).toContain("Vétérinaire : Clinique du Léman, 021 000 00 00.");
    expect(fiche).toContain("À savoir : Elle se cache sous le lit.");
  });
});
