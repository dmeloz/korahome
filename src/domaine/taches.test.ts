import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { ErreurValidation } from "./foyer";
import type { FoisFaite } from "./types";
import {
  compterDues,
  decaler,
  decrireEcheance,
  decrireRecurrence,
  changerHeure,
  ecartJours,
  enMinutes,
  estTerminee,
  heureApprise,
  heureDe,
  heureProposee,
  liberer,
  marquerFaite,
  nouvelleTache,
  organiserTaches,
  prendre,
  tachesDeDepart,
} from "./taches";

const semaine = { unite: "semaine", tous: 1 } as const;

describe("dates des tâches", () => {
  it("décale de jours, de semaines et de mois", () => {
    expect(decaler("2026-10-07", { unite: "jour", tous: 1 })).toBe("2026-10-08");
    expect(decaler("2026-10-07", semaine)).toBe("2026-10-14");
    expect(decaler("2026-10-07", { unite: "semaine", tous: 2 })).toBe("2026-10-21");
    expect(decaler("2026-12-28", semaine)).toBe("2027-01-04");
  });

  it("reste sur le dernier jour quand le mois suivant est plus court", () => {
    expect(decaler("2027-01-31", { unite: "mois", tous: 1 })).toBe("2027-02-28");
    expect(decaler("2028-01-31", { unite: "mois", tous: 1 })).toBe("2028-02-29");
    expect(decaler("2026-10-15", { unite: "mois", tous: 1 })).toBe("2026-11-15");
  });

  it("ne se trompe pas au changement d'heure d'octobre", () => {
    expect(decaler("2026-10-24", semaine)).toBe("2026-10-31");
    expect(ecartJours("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("décrit l'échéance en mots", () => {
    expect(decrireEcheance("2026-10-04", "2026-10-07")).toBe("en retard de 3 jours");
    expect(decrireEcheance("2026-10-06", "2026-10-07")).toBe("depuis hier");
    expect(decrireEcheance("2026-10-07", "2026-10-07")).toBe("aujourd'hui");
    expect(decrireEcheance("2026-10-08", "2026-10-07")).toBe("demain");
    expect(decrireEcheance("2026-10-12", "2026-10-07")).toBe("dans 5 jours");
  });

  it("décrit la fréquence", () => {
    expect(decrireRecurrence(null)).toBe("Une fois");
    expect(decrireRecurrence(semaine)).toBe("Chaque semaine");
    expect(decrireRecurrence({ unite: "jour", tous: 3 })).toBe("Tous les 3 jours");
  });
});

describe("créer une tâche", () => {
  it("nettoie le titre et la crée libre", () => {
    const t = nouvelleTache("  sortir   les poubelles ", semaine, "2026-10-07", contexteTest());
    expect(t.titre).toBe("Sortir les poubelles");
    expect(t.responsable).toBeNull();
    expect(t.faiteLe).toBeNull();
  });

  it("refuse un titre vide, une date invalide ou une fréquence nulle", () => {
    const ctx = contexteTest();
    expect(() => nouvelleTache("  ", null, "2026-10-07", ctx)).toThrow(ErreurValidation);
    expect(() => nouvelleTache("Linge", null, "7 octobre", ctx)).toThrow(ErreurValidation);
    expect(() => nouvelleTache("Linge", { unite: "jour", tous: 0 }, "2026-10-07", ctx)).toThrow(ErreurValidation);
  });

  it("propose les six tâches de la semaine du foyer", () => {
    const taches = tachesDeDepart("2026-10-07", contexteTest());
    expect(taches.map((t) => t.titre)).toEqual([
      "Ménage",
      "Linge",
      "Poubelles et recyclage",
      "Courses",
      "Litière de Mitsu",
      "Arrosage",
    ]);
    expect(taches.every((t) => t.recurrence?.unite === "semaine" && t.echeance === "2026-10-07")).toBe(true);
  });
});

describe("marquer une tâche faite", () => {
  it("une tâche qui revient repart depuis le jour où elle est faite", () => {
    const ctx = contexteTest();
    const t = nouvelleTache("Linge", semaine, "2026-10-05", ctx);
    const faite = marquerFaite(t, "melo", "2026-10-07", ctx);
    expect(faite.echeance).toBe("2026-10-14");
    expect(faite.faitePar).toBe("melo");
    expect(estTerminee(faite)).toBe(false);
  });

  it("faite en avance, elle garde son rythme", () => {
    const ctx = contexteTest();
    const t = nouvelleTache("Arrosage", semaine, "2026-10-09", ctx);
    expect(marquerFaite(t, null, "2026-10-07", ctx).echeance).toBe("2026-10-16");
  });

  it("une tâche unique est terminée", () => {
    const ctx = contexteTest();
    const t = nouvelleTache("Changer l'ampoule", null, "2026-10-07", ctx);
    const faite = marquerFaite(t, "melo", "2026-10-07", ctx);
    expect(estTerminee(faite)).toBe(true);
    expect(faite.echeance).toBe("2026-10-07");
  });
});

describe("chacun choisit ses tâches", () => {
  it("prendre puis rendre libre", () => {
    const t = nouvelleTache("Ménage", semaine, "2026-10-07", contexteTest());
    expect(prendre(t, "melo").responsable).toBe("melo");
    expect(liberer(prendre(t, "melo")).responsable).toBeNull();
  });
});

describe("organiser l'écran", () => {
  const ctx = contexteTest();
  const aujourdhui = "2026-10-07";
  const retard = prendre(nouvelleTache("Poubelles", semaine, "2026-10-05", ctx), "melo");
  const dujour = nouvelleTache("Linge", semaine, "2026-10-07", ctx);
  const semaineProchaine = nouvelleTache("Arrosage", semaine, "2026-10-12", ctx);
  const loin = nouvelleTache("Vitres", { unite: "mois", tous: 1 }, "2026-11-02", ctx);
  const terminee = marquerFaite(nouvelleTache("Ampoule", null, "2026-10-07", ctx), "melo", aujourdhui, ctx);
  const toutes = [loin, dujour, terminee, semaineProchaine, retard];

  it("groupe par échéance, dans l'ordre", () => {
    const { groupes, terminees } = organiserTaches(toutes, aujourdhui);
    expect(groupes.map((g) => [g.titre, g.taches.map((t) => t.titre)])).toEqual([
      ["En retard", ["Poubelles"]],
      ["Aujourd'hui", ["Linge"]],
      ["Cette semaine", ["Arrosage"]],
      ["Plus tard", ["Vitres"]],
    ]);
    expect(terminees.map((t) => t.titre)).toEqual(["Ampoule"]);
  });

  it("filtre mes tâches et les tâches libres", () => {
    const miennes = organiserTaches(toutes, aujourdhui, "miennes", "melo");
    expect(miennes.groupes.flatMap((g) => g.taches).map((t) => t.titre)).toEqual(["Poubelles"]);
    const libres = organiserTaches(toutes, aujourdhui, "libres");
    expect(libres.groupes.flatMap((g) => g.taches).map((t) => t.titre)).toEqual(["Linge", "Arrosage", "Vitres"]);
  });

  it("compte ce qui est dû pour l'accueil", () => {
    expect(compterDues(toutes, aujourdhui)).toEqual({ aujourdhui: 1, enRetard: 1 });
  });
});

describe("l'heure d'une tâche", () => {
  // Les coches sont des instants ; l'heure retenue est celle du téléphone.
  const a = (h: number, m: number, jour = 7) => new Date(2026, 9, jour, h, m).toISOString();
  const avecCoches = (...instants: string[]) => ({
    ...nouvelleTache("Litière", semaine, "2026-10-07", contexteTest()),
    historique: instants.map((x): FoisFaite => ({ le: "2026-10-07", par: null, retard: 0, a: x })),
  });

  it("note l'instant de chaque coche", () => {
    const ctx = contexteTest();
    const faite = marquerFaite(nouvelleTache("Litière", semaine, "2026-10-07", ctx), "dany", "2026-10-07", ctx);
    expect(faite.historique?.[0].a).toBe(faite.faiteLe);
  });

  it("ne propose rien avant trois coches", () => {
    expect(heureProposee(avecCoches(a(20, 0), a(20, 10)))).toBeNull();
    expect(heureDe(avecCoches(a(20, 0), a(20, 10)))).toBeNull();
  });

  it("propose la médiane des heures de coche, au quart d'heure", () => {
    expect(heureProposee(avecCoches(a(19, 50), a(20, 5), a(21, 40)))).toBe("20:00");
    expect(heureProposee(avecCoches(a(7, 10), a(7, 20), a(8, 0), a(7, 30)))).toBe("07:30");
  });

  it("ignore les coches plus anciennes sans instant", () => {
    const t = avecCoches(a(20, 0), a(20, 0), a(20, 0));
    t.historique = [{ le: "2026-10-01", par: null, retard: 0 }, ...(t.historique ?? [])];
    expect(heureProposee(t)).toBe("20:00");
  });

  it("garde une heure choisie à la main, même quand Kora en apprend une autre", () => {
    const t = changerHeure(avecCoches(a(20, 0), a(20, 0), a(20, 0)), "18:30");
    expect(heureDe(t)).toBe("18:30");
    expect(heureApprise(t)).toBe(false);
  });

  it("« sans heure » retire l'heure, et rendre la main à Kora la repropose", () => {
    const t = avecCoches(a(20, 0), a(20, 0), a(20, 0));
    expect(heureApprise(t)).toBe(true);
    const sans = changerHeure(t, null);
    expect(heureDe(sans)).toBeNull();
    const rendue = changerHeure(sans, undefined);
    expect("heure" in rendue).toBe(false);
    expect(heureDe(rendue)).toBe("20:00");
  });

  it("refuse une heure mal écrite", () => {
    expect(() => changerHeure(avecCoches(), "25:00")).toThrow(ErreurValidation);
    expect(enMinutes("08:05")).toBe(485);
  });
});
