import { describe, expect, it } from "vitest";
import {
  analyserPhrase,
  decrireAgenda,
  decrireHoraire,
  decrireJour,
  dispositionDuJour,
  duJour,
  evenementsDuMatin,
  filtrer,
  grilleDuMois,
  ligneWidget,
  occurrences,
  preparerEvenement,
  resumeAgenda,
  titreDe,
  type EntreeEvenement,
  type Evenement,
} from "./agenda";
import { contexteTest } from "./contexteTest";
import { ErreurValidation } from "./foyer";
import { nouvelAnimal } from "./mitsu";
import type { Foyer } from "./types";

const AUJOURDHUI = "2026-10-18"; // un dimanche
const foyer: Foyer = {
  id: "f",
  nom: "Cassa",
  creeLe: "2026-10-01T08:00:00.000Z",
  membres: [
    { id: "melo", prenom: "Melo", couleur: "#d3a14a" },
    { id: "sarah", prenom: "Sarah", couleur: "#7fa38a" },
  ],
};

const ev = (e: EntreeEvenement, ctx = contexteTest()) => preparerEvenement(e, "melo", ctx);

describe("créer un événement", () => {
  it("range ce qui a été saisi", () => {
    const e = ev({ titre: " dentiste ", jour: "2026-10-22", heure: "14:30", heureFin: "15:15", pour: "sarah", categorie: "rdv", lieu: " Renens " });
    expect(e).toMatchObject({ titre: "Dentiste", jour: "2026-10-22", heure: "14:30", heureFin: "15:15", pour: "sarah", categorie: "rdv", lieu: "Renens", fin: null, repetition: "aucune", creePar: "melo" });
  });

  it("refuse un titre vide, une date ou une heure fausse, une fin avant le début", () => {
    expect(() => ev({ titre: " ", jour: "2026-10-22" })).toThrow(ErreurValidation);
    expect(() => ev({ titre: "A", jour: "22.10.2026" })).toThrow(ErreurValidation);
    expect(() => ev({ titre: "A", jour: "2026-10-22", heure: "25:00" })).toThrow(ErreurValidation);
    expect(() => ev({ titre: "A", jour: "2026-10-22", fin: "2026-10-20" })).toThrow(ErreurValidation);
  });

  it("oublie une heure de fin avant l'heure de début, et l'heure de fin sans heure", () => {
    expect(ev({ titre: "A", jour: "2026-10-22", heure: "14:00", heureFin: "13:00" }).heureFin).toBeNull();
    expect(ev({ titre: "A", jour: "2026-10-22", heureFin: "13:00" }).heureFin).toBeNull();
  });

  it("garde l'identifiant, l'auteur et la date de création quand on le modifie", () => {
    const avant = ev({ titre: "A", jour: "2026-10-22" });
    const apres = preparerEvenement({ titre: "B", jour: "2026-10-23" }, "sarah", contexteTest(), avant);
    expect(apres).toMatchObject({ id: avant.id, creePar: "melo", creeLe: avant.creeLe, titre: "B" });
  });
});

describe("les jours où un événement a lieu", () => {
  it("une fois", () => {
    const e = ev({ titre: "Dentiste", jour: "2026-10-22", heure: "14:30" });
    expect(occurrences([e], "2026-10-18", "2026-10-31").map((o) => o.debut)).toEqual(["2026-10-22"]);
    expect(occurrences([e], "2026-10-23", "2026-10-31")).toEqual([]);
  });

  it("des vacances qui ont commencé avant la période", () => {
    const e = ev({ titre: "Vacances", jour: "2026-10-10", fin: "2026-10-20", categorie: "vacances" });
    const occ = occurrences([e], "2026-10-18", "2026-10-25");
    expect(occ).toHaveLength(1);
    expect(duJour(occ, "2026-10-19")).toHaveLength(1);
    expect(duJour(occ, "2026-10-21")).toHaveLength(0);
    expect(decrireHoraire(occ[0])).toBe("Du 10 au 20 oct.");
  });

  it("chaque semaine, et certains jours de la semaine tous les quinze jours", () => {
    const e = ev({ titre: "Yoga", jour: "2026-09-01", heure: "19:00", repetition: "semaine" }); // un mardi
    expect(occurrences([e], "2026-10-18", "2026-11-01").map((o) => o.debut)).toEqual(["2026-10-20", "2026-10-27"]);
    const travail: Evenement = { ...ev({ titre: "Travail", jour: "2026-10-05", heure: "08:00", repetition: "semaine" }), joursSemaine: [1, 3], intervalle: 2 };
    expect(occurrences([travail], "2026-10-05", "2026-10-25").map((o) => o.debut)).toEqual(["2026-10-05", "2026-10-07", "2026-10-19", "2026-10-21"]);
  });

  it("chaque mois, chaque jour, avec une fin et des fois retirées", () => {
    const loyer = ev({ titre: "Loyer", jour: "2026-01-31", repetition: "mois" });
    expect(occurrences([loyer], "2026-02-01", "2026-04-30").map((o) => o.debut)).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
    const cure: Evenement = { ...ev({ titre: "Gouttes", jour: "2026-10-15", repetition: "jour" }), jusquau: "2026-10-20", sauf: ["2026-10-19"] };
    expect(occurrences([cure], "2026-10-18", "2026-10-31").map((o) => o.debut)).toEqual(["2026-10-18", "2026-10-20"]);
  });

  it("un anniversaire chaque année, avec l'âge quand l'année de naissance est connue", () => {
    const e = ev({ titre: "Anniversaire de maman", jour: "1962-03-12", categorie: "anniversaire", repetition: "annee" });
    const [o] = occurrences([e], "2027-01-01", "2027-12-31");
    expect(o.debut).toBe("2027-03-12");
    expect(titreDe(o)).toBe("Anniversaire de maman · 65 ans");
    const sansAge = ev({ titre: "Anniversaire de Léa", jour: "2026-11-02", categorie: "anniversaire", repetition: "annee" });
    expect(titreDe(occurrences([sansAge], "2027-01-01", "2027-12-31")[0])).toBe("Anniversaire de Léa");
  });

  it("le 29 février les autres années", () => {
    const e = ev({ titre: "Anniv", jour: "2024-02-29", repetition: "annee" });
    expect(occurrences([e], "2026-01-01", "2026-12-31")[0].debut).toBe("2026-02-28");
  });

  it("met la journée entière d'abord, puis par heure", () => {
    const ctx = contexteTest();
    const a = ev({ titre: "Coiffeur", jour: "2026-10-22", heure: "17:00" }, ctx);
    const b = ev({ titre: "Dentiste", jour: "2026-10-22", heure: "09:00" }, ctx);
    const c = ev({ titre: "Anniversaire", jour: "2026-10-22" }, ctx);
    expect(duJour(occurrences([a, b, c], "2026-10-22", "2026-10-22"), "2026-10-22").map((o) => o.evenement.titre)).toEqual(["Anniversaire", "Dentiste", "Coiffeur"]);
  });

  it("montre les rappels du carnet de Mitsu, en lecture seule", () => {
    const ctx = contexteTest();
    const mitsu = { ...nouvelAnimal("Mitsu", "2026-04-14", null, ctx), soins: [{ id: "s1", type: "vaccin" as const, libelle: "Rappel du vaccin", date: "2026-10-25", fait: false }] };
    const [o] = occurrences([], "2026-10-18", "2026-10-31", [mitsu]);
    expect(o).toMatchObject({ debut: "2026-10-25", lectureSeule: true });
    expect(o.evenement.titre).toBe("Mitsu · Rappel du vaccin");
  });
});

describe("qui voit quoi", () => {
  const ctx = contexteTest();
  const commun = ev({ titre: "Apéro", jour: "2026-10-20" }, ctx);
  const sarah = ev({ titre: "Gynéco", jour: "2026-10-20", pour: "sarah" }, ctx);
  const melo = ev({ titre: "Garage", jour: "2026-10-20", pour: "melo" }, ctx);
  const occ = occurrences([commun, sarah, melo], "2026-10-20", "2026-10-20");

  it("tout, nous deux, ou une personne avec le commun", () => {
    expect(filtrer(occ, "tout")).toHaveLength(3);
    expect(filtrer(occ, "nous").map((o) => o.evenement.titre)).toEqual(["Apéro"]);
    expect(filtrer(occ, "sarah").map((o) => o.evenement.titre).sort()).toEqual(["Apéro", "Gynéco"]);
  });

  it("le rappel du matin de chacun", () => {
    expect(evenementsDuMatin([commun, sarah, melo], "melo", "2026-10-20").map((o) => o.evenement.titre).sort()).toEqual(["Apéro", "Garage"]);
  });
});

describe("les mots des dates", () => {
  it("aujourd'hui, demain, ou le jour et la date", () => {
    expect(decrireJour("2026-10-18", AUJOURDHUI)).toBe("Aujourd'hui");
    expect(decrireJour("2026-10-19", AUJOURDHUI)).toBe("Demain");
    expect(decrireJour("2026-10-22", AUJOURDHUI)).toBe("Jeudi 22 oct.");
    expect(decrireJour("2027-01-04", AUJOURDHUI)).toBe("Lundi 4 janv. 2027");
  });

  it("une ligne de widget", () => {
    const e = ev({ titre: "Dentiste", jour: "2026-10-22", heure: "14:30" });
    expect(ligneWidget(occurrences([e], AUJOURDHUI, "2026-10-31")[0], AUJOURDHUI)).toBe("Jeu. 14:30 · Dentiste");
  });

  it("une grille de mois en semaines entières, du lundi au dimanche", () => {
    const g = grilleDuMois("2026-10");
    expect(g[0]).toBe("2026-09-28");
    expect(g[g.length - 1]).toBe("2026-11-01");
    expect(g.length % 7).toBe(0);
  });
});

describe("le résumé du widget", () => {
  it("aujourd'hui et la semaine qui vient", () => {
    const ctx = contexteTest();
    const r = resumeAgenda([ev({ titre: "Ciné", jour: AUJOURDHUI, heure: "20:00" }, ctx), ev({ titre: "Dentiste", jour: "2026-10-22" }, ctx), ev({ titre: "Plus tard", jour: "2026-11-30" }, ctx)], [], AUJOURDHUI);
    expect(r.aujourdhui.map((o) => o.evenement.titre)).toEqual(["Ciné"]);
    expect(r.semaine.map((o) => o.evenement.titre)).toEqual(["Dentiste"]);
  });
});

describe("écrire comme on parle", () => {
  const lire = (t: string) => analyserPhrase(t, AUJOURDHUI, foyer.membres);

  it("un rendez-vous un jour de la semaine, à une heure", () => {
    expect(lire("Dentiste jeudi 14h30")).toMatchObject({ titre: "Dentiste", jour: "2026-10-22", heure: "14:30", categorie: "rdv" });
    expect(lire("Véto Mitsu demain à 9h")).toMatchObject({ titre: "Véto Mitsu", jour: "2026-10-19", heure: "09:00", categorie: "rdv" });
  });

  it("dimanche dit un dimanche, c'est le suivant", () => {
    expect(lire("Brunch dimanche").jour).toBe("2026-10-25");
  });

  it("un anniversaire avec l'année de naissance revient chaque année", () => {
    expect(lire("Anniversaire de maman le 12 mars 1962")).toMatchObject({ titre: "Anniversaire de maman", jour: "1962-03-12", repetition: "annee", categorie: "anniversaire" });
  });

  it("une date sans année déjà passée cette année : l'an prochain", () => {
    expect(lire("Fondue le 3 février").jour).toBe("2027-02-03");
    expect(lire("Fondue le 3.2").jour).toBe("2027-02-03");
  });

  it("des vacances du … au …", () => {
    expect(lire("Vacances au Portugal du 20 au 27 décembre")).toMatchObject({ titre: "Vacances au Portugal", jour: "2026-12-20", fin: "2026-12-27", categorie: "vacances" });
    expect(lire("Ski du 30 déc. au 3 janvier")).toMatchObject({ jour: "2026-12-30", fin: "2027-01-03" });
  });

  it("des horaires de travail chaque semaine, pour une personne", () => {
    expect(lire("Travail tous les lundis de 8h à 17h pour Sarah")).toMatchObject({ titre: "Travail", jour: "2026-10-19", heure: "08:00", heureFin: "17:00", repetition: "semaine", pour: "sarah", categorie: "travail" });
  });

  it("ce week-end", () => {
    expect(lire("Balade ce week-end")).toMatchObject({ titre: "Balade", jour: "2026-10-24", fin: "2026-10-25", categorie: "sortie" });
  });

  it("sans date, la date reste à choisir", () => {
    expect(lire("Cinéma avec les copains")).toMatchObject({ titre: "Cinéma avec les copains", jour: null, categorie: "sortie" });
  });
});

describe("ce que Jarvis sait de l'agenda", () => {
  it("les deux semaines qui viennent, avec qui", () => {
    const lignes = decrireAgenda([ev({ titre: "Dentiste", jour: "2026-10-22", heure: "14:30", pour: "sarah" })], foyer, AUJOURDHUI);
    expect(lignes).toEqual(["Agenda des deux semaines :", "- Dentiste : 2026-10-22 à 14:30, Sarah"]);
  });
});

describe("la vue Jour", () => {
  const J = "2026-10-22";
  const disposer = (...e: Evenement[]) => dispositionDuJour(occurrences(e, J, J), J);

  it("met en haut ce qui dure toute la journée ou a commencé avant", () => {
    const vacances = ev({ titre: "Vacances", jour: "2026-10-20", fin: "2026-10-24", categorie: "vacances" });
    const anniv = ev({ titre: "Anniversaire", jour: J });
    const parti = ev({ titre: "Voyage", jour: "2026-10-21", fin: J, heure: "18:00" });
    const d = disposer(vacances, anniv, parti);
    expect(d.journee.map((o) => o.evenement.titre).sort()).toEqual(["Anniversaire", "Vacances", "Voyage"]);
    expect(d.places).toEqual([]);
  });

  it("place chaque rendez-vous à son heure, une heure par défaut", () => {
    const d = disposer(ev({ titre: "Dentiste", jour: J, heure: "14:30", heureFin: "15:15" }), ev({ titre: "Appel", jour: J, heure: "09:00" }));
    expect(d.places.map((p) => [p.occurrence.evenement.titre, p.debut, p.fin, p.colonne, p.colonnes])).toEqual([
      ["Appel", 540, 600, 0, 1],
      ["Dentiste", 870, 915, 0, 1],
    ]);
  });

  it("un départ sur plusieurs jours va jusqu'à minuit, un rendez-vous très court reste lisible", () => {
    const d = disposer(ev({ titre: "Train de nuit", jour: J, fin: "2026-10-23", heure: "22:00" }), ev({ titre: "Pilule", jour: J, heure: "08:00", heureFin: "08:05" }));
    expect(d.places.map((p) => [p.debut, p.fin])).toEqual([[480, 500], [1320, 1440]]);
  });

  it("partage la largeur entre ceux qui se chevauchent, et seulement eux", () => {
    const d = disposer(
      ev({ titre: "A", jour: J, heure: "09:00", heureFin: "11:00" }),
      ev({ titre: "B", jour: J, heure: "09:30", heureFin: "10:00" }),
      ev({ titre: "C", jour: J, heure: "10:00", heureFin: "10:30" }),
      ev({ titre: "D", jour: J, heure: "14:00" }),
    );
    expect(d.places.map((p) => [p.occurrence.evenement.titre, p.colonne, p.colonnes])).toEqual([
      ["A", 0, 2],
      ["B", 1, 2],
      ["C", 1, 2],
      ["D", 0, 1],
    ]);
  });
});
