import { describe, expect, it } from "vitest";
import { preparerEvenement } from "./agenda";
import { contexteTest } from "./contexteTest";
import { creerFoyer } from "./foyer";
import { ajouterPlante, nouvellePlante, nouvelleZone } from "./jardin";
import { ajouterSoin, nouvelAnimal, nouveauSoin } from "./mitsu";
import {
  basculerJour,
  decalerHeure,
  decrireJours,
  formaterHeure,
  heureValide,
  jourDeLaSemaine,
  jourEtHeure,
  minuteValide,
  lireHeure,
  nettoyerJours,
  PREFERENCES_DE_DEPART,
  rappelDu,
  rappelDuMatin,
  tachesDuMatin,
} from "./rappels";
import { nouveauProduit } from "./stock";
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

  it("dit ce qui arrive à sa date au frigo, sauf si on ne le veut pas", () => {
    const yaourts = nouveauProduit({ texte: "Yaourts", lieu: "frigo", peremption: "2026-10-13" }, null, ctx);
    const riz = nouveauProduit({ texte: "Riz", lieu: "placard", peremption: "2027-06-01" }, null, ctx);
    const faites = taches.map((t) => marquerFaite(t, melo.id, AUJOURDHUI, ctx));
    const entree = { foyer, membreId: melo.id, taches: faites, animaux: [], produits: [yaourts, riz], aujourdhui: AUJOURDHUI };
    expect(rappelDuMatin({ ...entree, preferences: PREFERENCES_DE_DEPART })).toEqual({ titre: "Bonjour Melo", corps: "À consommer : Yaourts", nombre: 1 });
    expect(rappelDuMatin({ ...entree, preferences: { ...PREFERENCES_DE_DEPART, stock: false } })).toBeNull();
  });

  it("commence par l'agenda du jour : le commun et le sien, sauf si on ne le veut pas", () => {
    const c = contexteTest();
    const evenements = [
      preparerEvenement({ titre: "Dentiste", jour: AUJOURDHUI, heure: "14:30", pour: melo.id }, null, c),
      preparerEvenement({ titre: "Gynéco", jour: AUJOURDHUI, heure: "09:00", pour: sarah.id }, null, c),
      preparerEvenement({ titre: "Vacances", jour: "2026-10-10", fin: "2026-10-14" }, null, c),
    ];
    const entree = { foyer, membreId: melo.id, taches: [], animaux: [], evenements, aujourdhui: AUJOURDHUI };
    expect(rappelDuMatin({ ...entree, preferences: PREFERENCES_DE_DEPART })).toEqual({ titre: "Bonjour Melo", corps: "Agenda : Vacances (jusqu'au 14 oct.), Dentiste à 14:30", nombre: 2 });
    expect(rappelDuMatin({ ...entree, preferences: { ...PREFERENCES_DE_DEPART, agenda: false } })).toBeNull();
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

describe("le jardin dans le rappel du matin", () => {
  const balcon = ajouterPlante(
    { ...nouvelleZone({ nom: "Pots du balcon", type: "pot", exposition: "soleil", abri: "dehors" }, ctx), arroseeLe: AUJOURDHUI },
    nouvellePlante("basilic", AUJOURDHUI, null, ctx),
  );
  const gel = { lieu: "Renens", jours: [{ jour: "2026-10-13", min: -1, max: 9, pluie: 0, code: 0 }], lue: "2026-10-12T05:00:00.000Z" };
  const entree = { foyer, membreId: melo.id, taches: [], animaux: [], zones: [balcon], meteo: gel, aujourdhui: AUJOURDHUI };

  it("prévient du gel annoncé", () => {
    const r = rappelDuMatin({ ...entree, maintenant: "2026-10-12T06:00:00.000Z", preferences: PREFERENCES_DE_DEPART });
    expect(r?.corps).toBe("Jardin : Gel cette nuit (-1°) : rentre ou couvre basilic");
    expect(r?.nombre).toBe(1);
  });

  it("ignore une météo trop ancienne et respecte le choix de chacun", () => {
    expect(rappelDuMatin({ ...entree, maintenant: "2026-10-13T06:00:00.000Z", preferences: PREFERENCES_DE_DEPART })).toBeNull();
    expect(rappelDuMatin({ ...entree, preferences: { ...PREFERENCES_DE_DEPART, jardin: false } })).toBeNull();
  });
});

describe("l'heure du rappel", () => {
  it("suit l'heure de Zurich, été comme hiver", () => {
    expect(jourEtHeure(new Date("2026-10-12T06:00:00Z"))).toEqual({ jour: "2026-10-12", heure: 8, minute: 0 });
    expect(jourEtHeure(new Date("2026-12-12T07:00:00Z"))).toEqual({ jour: "2026-12-12", heure: 8, minute: 0 });
    expect(jourEtHeure(new Date("2026-12-11T23:30:00Z"))).toEqual({ jour: "2026-12-12", heure: 0, minute: 30 });
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

  it("se règle à la minute près, le serveur passant chaque minute", () => {
    // 7:45 à Zurich (5:45 UTC en octobre) : pas avant, oui à 7:45, rattrapé dans l'heure.
    expect(rappelDu(new Date("2026-10-12T05:44:00Z"), 7, null, undefined, undefined, 45)).toBeNull();
    expect(rappelDu(new Date("2026-10-12T05:45:00Z"), 7, null, undefined, undefined, 45)).toBe("2026-10-12");
    expect(rappelDu(new Date("2026-10-12T06:30:00Z"), 7, null, undefined, undefined, 45)).toBe("2026-10-12");
    expect(rappelDu(new Date("2026-10-12T17:20:00Z"), 18, null, undefined, undefined, 15)).toBeNull();
    expect(formaterHeure(7, 5)).toBe("7:05");
    expect(formaterHeure(8, 30)).toBe("8:30");
    expect(minuteValide(45)).toBe(true);
    expect(minuteValide(60)).toBe(false);
    expect(lireHeure("07:45")).toEqual({ heure: 7, minute: 45 });
    expect(lireHeure("03:10")).toEqual({ heure: 5, minute: 0 });
    expect(lireHeure("23:30")).toEqual({ heure: 22, minute: 59 });
    expect(lireHeure("")).toBeNull();
  });
});

describe("les jours du rappel", () => {
  it("arrive tous les jours au départ", () => {
    expect(PREFERENCES_DE_DEPART.jours).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(decrireJours(PREFERENCES_DE_DEPART.jours)).toBe("Tous les jours");
  });

  it("se décrit comme dans l'app Horloge", () => {
    expect(decrireJours([1, 2, 3, 4, 5])).toBe("En semaine");
    expect(decrireJours([0, 6])).toBe("Le week-end");
    expect(decrireJours([5, 1, 3])).toBe("lun, mer, ven");
  });

  it("ajoute et retire un jour, mais jamais le dernier", () => {
    expect(basculerJour([1, 2], 0)).toEqual([1, 2, 0]);
    expect(basculerJour([1, 2], 1)).toEqual([2]);
    expect(basculerJour([3], 3)).toEqual([3]);
  });

  it("relit des jours enregistrés, ou tous les jours à défaut", () => {
    expect(nettoyerJours([0, 3, 3, 9])).toEqual([3, 0]);
    expect(nettoyerJours(undefined)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(nettoyerJours([])).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("ne part que les jours choisis", () => {
    // Le 12 octobre 2026 est un lundi, le 17 un samedi ; 8 h à Zurich = 6 h UTC en été.
    expect(jourDeLaSemaine("2026-10-12")).toBe(1);
    const lundi = new Date("2026-10-12T06:10:00Z");
    const samedi = new Date("2026-10-17T06:10:00Z");
    expect(rappelDu(lundi, 8, null, "Europe/Zurich", [1, 2, 3, 4, 5])).toBe("2026-10-12");
    expect(rappelDu(samedi, 8, null, "Europe/Zurich", [1, 2, 3, 4, 5])).toBeNull();
    expect(rappelDu(samedi, 8, null, "Europe/Zurich", [6, 0])).toBe("2026-10-17");
    expect(rappelDu(samedi, 8, null)).toBe("2026-10-17");
  });
});

describe("le rappel du matin et les factures", () => {
  it("annonce les factures à payer, sauf si on n'en veut pas", () => {
    const factures = [{ libelle: "Électricité (60 CHF)", echeance: "2026-10-20" }];
    const entree = { foyer: null, membreId: null, taches: [], animaux: [], factures, aujourdhui: "2026-10-19", preferences: PREFERENCES_DE_DEPART };
    expect(rappelDuMatin(entree)?.corps).toBe("Factures : Électricité (60 CHF) demain");
    expect(rappelDuMatin({ ...entree, preferences: { ...PREFERENCES_DE_DEPART, budget: false } })).toBeNull();
  });
});

describe("l'heure des tâches, envoyée par le serveur", () => {
  it("rappelle à la minute près les tâches du jour et en retard, à moi ou libres", async () => {
    const { tachesALHeure, notificationHeure } = await import("./rappels");
    const { nouvelleTache, changerHeure } = await import("./taches");
    const { contexteTest } = await import("./contexteTest");
    const ctx = contexteTest("2026-10-19T08:00:00.000Z");
    const litiere = { ...changerHeure(nouvelleTache("Litière de Mitsu", null, "2026-10-19", ctx), "19:00"), responsable: "moi" };
    const retard = changerHeure(nouvelleTache("Recyclage", null, "2026-10-17", ctx), "19:00");
    const autre = { ...changerHeure(nouvelleTache("Arroser", null, "2026-10-19", ctx), "19:00"), responsable: "elle" };
    const demain = changerHeure(nouvelleTache("Lessive", null, "2026-10-20", ctx), "19:00");
    const t = tachesALHeure([litiere, retard, autre, demain], "moi", "2026-10-19", "19:00");
    expect(t.map((x) => x.titre)).toEqual(["Recyclage", "Litière de Mitsu"]);
    expect(tachesALHeure([litiere], "moi", "2026-10-19", "19:01")).toEqual([]);
    expect(notificationHeure(t)).toEqual({ titre: "C'est l'heure", corps: "Recyclage, Litière de Mitsu.", nombre: 2 });
    expect(notificationHeure([])).toBeNull();
  });

  it("l'heure proposée par Kora se lit dans le fuseau du foyer, pas celui du serveur", async () => {
    const { heureProposee } = await import("./taches");
    const { nouvelleTache } = await import("./taches");
    const { contexteTest } = await import("./contexteTest");
    const t = nouvelleTache("Litière", null, "2026-10-19", contexteTest("2026-10-19T08:00:00.000Z"));
    const coches = ["2026-10-14T17:00:00.000Z", "2026-10-15T17:00:00.000Z", "2026-10-16T17:00:00.000Z"].map((a, i) => ({ le: `2026-10-1${4 + i}`, par: null, retard: 0, a }));
    expect(heureProposee({ ...t, historique: coches }, "Europe/Zurich")).toBe("19:00");
  });
});
