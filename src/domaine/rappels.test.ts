import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { creerFoyer } from "./foyer";
import { ajouterSoin, nouvelAnimal, nouveauSoin } from "./mitsu";
import { decalerHeure, formaterHeure, heureValide, jourEtHeure, PREFERENCES_DE_DEPART, rappelDu, rappelDuMatin, tachesDuMatin } from "./rappels";
import { marquerFaite, nouvelleTache } from "./taches";

const AUJOURDHUI = "2026-10-12";
const ctx = contexteTest();
const foyer = creerFoyer("Cassa", ["Melo", "Sarah"], ctx);
const [melo, sarah] = foyer.membres;
const semaine = { unite: "semaine", tous: 1 } as const;

const litiere = nouvelleTache("Litière de Mitsu", semaine, AUJOURDHUI, ctx, melo.id);
const arrosage = nouvelleTache("Arrosage", semaine, AUJOURDHUI, ctx);
const linge = nouvelleTache("Linge", semaine, "2026-10-10", ctx);
const menage = nouvelleTache("Ménage", semaine, AUJOURDHUI, ctx, sarah.id);
const courses = nouvelleTache("Courses", semaine, "2026-10-15", ctx);
const taches = [litiere, arrosage, linge, menage, courses];

describe("le rappel du matin", () => {
  it("donne à chacun ses tâches et les tâches libres, pas celles de l'autre", () => {
    const t = tachesDuMatin(taches, melo.id, AUJOURDHUI);
    expect(t.aujourdhui.map((x) => x.titre)).toEqual(["Arrosage", "Litière de Mitsu"]);
    expect(t.enRetard.map((x) => x.titre)).toEqual(["Linge"]);
  });

  it("salue la personne et résume sa journée", () => {
    const r = rappelDuMatin({ foyer, membreId: sarah.id, taches, animaux: [], aujourdhui: AUJOURDHUI, preferences: PREFERENCES_DE_DEPART });
    expect(r).toEqual({ titre: "Bonjour Sarah", corps: "Aujourd'hui : Arrosage, Ménage\nEn retard : Linge", nombre: 3 });
  });

  it("n'envoie rien quand il n'y a rien à faire", () => {
    const faites = taches.map((t) => marquerFaite(t, melo.id, AUJOURDHUI, ctx));
    expect(rappelDuMatin({ foyer, membreId: melo.id, taches: faites, animaux: [], aujourdhui: AUJOURDHUI, preferences: PREFERENCES_DE_DEPART })).toBeNull();
  });

  it("limite chaque ligne à trois noms", () => {
    const beaucoup = ["Un", "Deux", "Trois", "Quatre", "Cinq"].map((n) => nouvelleTache(n, null, AUJOURDHUI, ctx));
    const r = rappelDuMatin({ foyer, membreId: melo.id, taches: beaucoup, animaux: [], aujourdhui: AUJOURDHUI, preferences: PREFERENCES_DE_DEPART });
    expect(r?.corps).toBe("Aujourd'hui : Cinq, Deux, Quatre et 2 autres");
  });

  it("ajoute ce qui presse pour Mitsu, et respecte les choix de chacun", () => {
    const mitsu = ajouterSoin(nouvelAnimal("Mitsu", "2026-04-14", null, ctx), nouveauSoin("vermifuge", "2026-10-13", "", ctx));
    const entree = { foyer, membreId: melo.id, taches: [], animaux: [mitsu], aujourdhui: AUJOURDHUI };
    const r = rappelDuMatin({ ...entree, preferences: PREFERENCES_DE_DEPART });
    expect(r?.corps).toBe("Mitsu : Vermifuge demain");
    expect(rappelDuMatin({ ...entree, preferences: { ...PREFERENCES_DE_DEPART, mitsu: false } })).toBeNull();
  });
});

describe("l'heure du rappel", () => {
  it("suit l'heure de Zurich, été comme hiver", () => {
    expect(jourEtHeure(new Date("2026-10-12T06:00:00Z"))).toEqual({ jour: "2026-10-12", heure: 8 });
    expect(jourEtHeure(new Date("2026-12-12T07:00:00Z"))).toEqual({ jour: "2026-12-12", heure: 8 });
    expect(jourEtHeure(new Date("2026-12-11T23:30:00Z"))).toEqual({ jour: "2026-12-12", heure: 0 });
  });

  it("part une fois par jour, au premier passage à partir de 8 h", () => {
    expect(rappelDu(new Date("2026-10-12T05:00:00Z"), 8, null)).toBeNull();
    expect(rappelDu(new Date("2026-10-12T06:00:00Z"), 8, "2026-10-11")).toBe("2026-10-12");
    expect(rappelDu(new Date("2026-10-12T07:00:00Z"), 8, "2026-10-12")).toBeNull();
    // Un passage manqué est rattrapé le matin, pas l'après-midi.
    expect(rappelDu(new Date("2026-10-12T08:00:00Z"), 8, null)).toBe("2026-10-12");
    expect(rappelDu(new Date("2026-10-12T12:00:00Z"), 8, null)).toBeNull();
  });

  it("suit l'heure choisie par chacun, de 5 h à 22 h", () => {
    expect(rappelDu(new Date("2026-10-12T04:00:00Z"), 6, null)).toBe("2026-10-12");
    expect(rappelDu(new Date("2026-10-12T16:00:00Z"), 18, null)).toBe("2026-10-12");
    expect(rappelDu(new Date("2026-10-12T17:00:00Z"), 18, null)).toBeNull();
    expect(decalerHeure(8, -1)).toBe(7);
    expect(decalerHeure(5, -1)).toBe(5);
    expect(decalerHeure(22, 1)).toBe(22);
    expect(heureValide(7)).toBe(true);
    expect(heureValide(23)).toBe(false);
    expect(heureValide("8")).toBe(false);
    expect(formaterHeure(7)).toBe("7:00");
  });
});
