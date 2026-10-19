import { describe, expect, it } from "vitest";
import type { Usage } from "./apprentissage";
import type { CarteDuJour, ChoseDuJour } from "./aujourdhui";
import { nouveauCompte } from "./bandeau";
import { contexteTest } from "./contexteTest";
import { nouvelleTache } from "./taches";
import {
  alerteAFaire,
  allureMeteo,
  decrireMinute,
  eclatDuFoyer,
  estCaressee,
  estLaNuit,
  estSecouee,
  heuresDiscretes,
  jourAMontrerLaNuit,
  jourJ,
  nettoyerRenvois,
  nouveautesDeLAutre,
  NUIT_DE_DEPART,
  nuitApprise,
  resumeDuMatin,
  tacheDeLHeure,
} from "./vieFee";

const AUJ = "2026-10-19";
const ctx = contexteTest("2026-10-19T08:00:00.000Z");

const chose = (c: Partial<ChoseDuJour> & { cle: string }): ChoseDuJour => ({ texte: c.cle, quand: "aujourd'hui", etat: "jour", destination: "taches", ...c });
const carte = (choses: ChoseDuJour[], faites = 0, autres = 0): CarteDuJour => ({ jour: AUJ, choses, autres, faites });

function usages(jours: number, soir: number, matin: number): Usage[] {
  const u: Usage[] = [];
  for (let i = 1; i <= jours; i++) {
    const jour = `2026-10-${String(19 - i).padStart(2, "0")}`;
    u.push({ jour, heure: matin, type: "widget", cle: "taches" }, { jour, heure: 13, type: "widget", cle: "courses" }, { jour, heure: soir, type: "widget", cle: "agenda" });
  }
  return u;
}

describe("la nuit apprise", () => {
  it("de 23 h à 7 h tant qu'il n'y a pas sept jours d'usage", () => {
    expect(nuitApprise(usages(4, 22, 7), AUJ)).toEqual(NUIT_DE_DEPART);
  });

  it("de la fin de la dernière heure du soir au début de la première du matin, avec un quart d'heure de marge", () => {
    const nuit = nuitApprise(usages(10, 22, 6), AUJ);
    expect(nuit).toEqual({ debut: 23 * 60 + 15, fin: 5 * 60 + 45, apprise: true });
    expect(decrireMinute(nuit.debut)).toBe("23 h 15");
  });

  it("un couche-tard après minuit reste après minuit", () => {
    const nuit = nuitApprise(usages(10, 1, 8), AUJ);
    expect(nuit.debut).toBe(2 * 60 + 15);
    expect(estLaNuit(3 * 60, nuit)).toBe(true);
    expect(estLaNuit(23 * 60, nuit)).toBe(false);
  });

  it("le soir, l'accueil montre demain ; après minuit, aujourd'hui", () => {
    expect(estLaNuit(23 * 60 + 30, NUIT_DE_DEPART)).toBe(true);
    expect(estLaNuit(12 * 60, NUIT_DE_DEPART)).toBe(false);
    expect(jourAMontrerLaNuit(23 * 60 + 30, NUIT_DE_DEPART)).toBe("demain");
    expect(jourAMontrerLaNuit(2 * 60, NUIT_DE_DEPART)).toBe("aujourdhui");
  });
});

describe("l'éclat de la fée", () => {
  it("pâle quand une chose urgente attend depuis plus de deux heures", () => {
    expect(eclatDuFoyer(carte([chose({ cle: "a", etat: "urgent", heure: "15:00" })]), "17:30")).toBe("pale");
    expect(eclatDuFoyer(carte([chose({ cle: "a", etat: "urgent", heure: "15:00" })]), "16:00")).toBe("normal");
    expect(eclatDuFoyer(carte([chose({ cle: "a", etat: "urgent", quand: "en retard" })]), "09:00")).toBe("pale");
  });

  it("vive quand tout ce qui était prévu est fait", () => {
    expect(eclatDuFoyer(carte([], 3), "18:00")).toBe("vive");
    expect(eclatDuFoyer(carte([], 0), "18:00")).toBe("normal");
    expect(eclatDuFoyer(carte([chose({ cle: "t", tacheId: "t" })], 2), "18:00")).toBe("normal");
  });
});

describe("les alertes et l'heure des tâches", () => {
  it("une chose urgente une seule fois, trois par jour au plus", () => {
    const c = carte([chose({ cle: "a", etat: "urgent" }), chose({ cle: "b", etat: "urgent" }), chose({ cle: "c" })]);
    expect(alerteAFaire(c, new Set())?.cle).toBe("a");
    expect(alerteAFaire(c, new Set(["a"]))?.cle).toBe("b");
    expect(alerteAFaire(c, new Set(["a", "b"]))).toBeNull();
    expect(alerteAFaire(c, new Set(["x", "y", "z"]))).toBeNull();
  });

  it("rappelle une tâche à son heure, à moi ou libre, une fois", () => {
    const t = { ...nouvelleTache("Litière", null, AUJ, ctx), responsable: "moi" };
    const autre = { ...nouvelleTache("Arroser", null, AUJ, ctx), responsable: "elle" };
    const c = carte([chose({ cle: "l", tacheId: t.id, heure: "19:00" }), chose({ cle: "a", tacheId: autre.id, heure: "19:00" })]);
    expect(tacheDeLHeure(c, [t, autre], "moi", "18:59", new Set())).toBeNull();
    expect(tacheDeLHeure(c, [t, autre], "moi", "19:05", new Set())?.cle).toBe("l");
    expect(tacheDeLHeure(c, [t, autre], "moi", "19:05", new Set(["l"]))).toBeNull();
    expect(tacheDeLHeure(c, [t, autre], "moi", "19:20", new Set())).toBeNull();
  });
});

describe("les rituels", () => {
  it("fête le jour J d'un compte à rebours", () => {
    const c = nouveauCompte("Lisbonne", AUJ, null, AUJ, ctx);
    expect(jourJ([c], AUJ)).toBe("C'est aujourd'hui : lisbonne !");
    expect(jourJ([c], "2026-10-18")).toBeNull();
  });

  it("résume le matin en une phrase", () => {
    const c = carte([chose({ cle: "a", texte: "Litière de Mitsu" }), chose({ cle: "b" })]);
    expect(resumeDuMatin(c, { rdv: "Jeudi 14:30, dentiste.", meteo: "12°, soleil." })).toBe("Bonjour. 2 choses aujourd'hui, d'abord litière de Mitsu. Jeudi 14:30, dentiste. 12°, soleil.");
    expect(resumeDuMatin(carte([]), {})).toBe("Bonjour. Rien ne presse aujourd'hui.");
  });
});

describe("la météo sur ses ailes", () => {
  const meteo = (min: number, pluie: number) => ({ lieu: "Renens", lue: "", jours: [{ jour: AUJ, min, max: 10, pluie, code: 0 }] });
  it("givre sous zéro, gouttes quand il pleut", () => {
    expect(allureMeteo(meteo(-2, 5), AUJ)).toBe("givre");
    expect(allureMeteo(meteo(4, 3), AUJ)).toBe("pluie");
    expect(allureMeteo(meteo(4, 0), AUJ)).toBeNull();
    expect(allureMeteo(null, AUJ)).toBeNull();
  });
});

describe("la discrétion apprise", () => {
  it("se tait à une heure après trois renvois en deux semaines", () => {
    const r = nettoyerRenvois([{ jour: AUJ, heure: 19 }, { jour: "2026-10-18", heure: 19 }, { jour: "2026-10-17", heure: 19 }, { jour: AUJ, heure: 8 }, { jour: "2026-09-01", heure: 8 }, "n'importe quoi"], AUJ);
    expect(r).toHaveLength(4);
    expect([...heuresDiscretes(r)]).toEqual([19]);
  });
});

describe("les gestes sur elle", () => {
  it("secouée vite : colère ; caressée lentement : ronron", () => {
    expect(estSecouee([1000, 1300, 1600, 1900], 2000)).toBe(true);
    expect(estSecouee([100, 1300, 1600, 1900], 2000)).toBe(false);
    expect(estCaressee([500, 1100, 1700], 0, 1800)).toBe(true);
    expect(estCaressee([500, 1100], 0, 1800)).toBe(false);
    expect(estCaressee([1000, 1300, 1600, 1900], 0, 2000)).toBe(false);
  });
});

describe("les nouveautés de l'autre", () => {
  it("les articles ajoutés par l'autre, pas encore vus", () => {
    const e = (id: string, ajoutePar: string | null, coche = false) => ({ id, listeId: "courses", ajoutePar, coche });
    const elements = [e("1", "elle"), e("2", "moi"), e("3", "elle", true), e("4", "elle"), e("5", null)];
    expect(nouveautesDeLAutre(elements, "courses", "moi", new Set(["4"])).map((x) => x.id)).toEqual(["1"]);
    expect(nouveautesDeLAutre(elements, null, "moi", new Set())).toEqual([]);
  });
});
