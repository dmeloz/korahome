import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import {
  ajouterPlante,
  alerteGel,
  arroser,
  calendrierDuMois,
  conseilDeSaison,
  decrireArrosage,
  decrireJardin,
  especesDuJardin,
  etatArrosage,
  gestesDuJardin,
  ideesDuMois,
  intervalleArrosage,
  nouvellePlante,
  nouvelleZone,
  plantesMalPlacees,
  retirerPlante,
  type Zone,
} from "./jardin";
import type { JourMeteo, Meteo } from "./meteo";
import { espece } from "./plantes";

const ctx = () => contexteTest();

function zoneAvec(plantes: string[], champs: Partial<Zone> = {}, jour = "2026-07-10"): Zone {
  const c = ctx();
  let z = nouvelleZone({ nom: "pots du balcon", type: "pot", exposition: "soleil", abri: "dehors" }, c);
  for (const p of plantes) z = ajouterPlante(z, nouvellePlante(p, jour, null, c));
  return { ...z, ...champs };
}

const jour = (j: string, min: number, max: number, pluie = 0): JourMeteo => ({ jour: j, min, max, pluie, code: pluie ? 61 : 0 });
const meteo = (...jours: JourMeteo[]): Meteo => ({ lieu: "Renens", jours, lue: "2026-07-10T06:00:00.000Z" });

describe("zones et plantes", () => {
  it("crée une zone au nom propre", () => {
    const z = nouvelleZone({ nom: "  bac   du fond ", type: "bac", exposition: "mi-ombre", abri: "dehors" }, ctx());
    expect(z.nom).toBe("Bac du fond");
    expect(z.plantes).toEqual([]);
    expect(() => nouvelleZone({ nom: " ", type: "bac", exposition: "soleil", abri: "dehors" }, ctx())).toThrow();
  });

  it("reconnaît l'espèce d'une plante écrite comme on la dit", () => {
    const c = ctx();
    expect(nouvellePlante("2 pieds de tomates cerises", "2026-05-20", null, c).espece).toBe("tomate");
    expect(nouvellePlante("basilic grand vert", "2026-05-20", null, c)).toMatchObject({ nom: "Basilic grand vert", espece: "basilic" });
    expect(nouvellePlante("Côtes de bette", "2026-05-20", null, c).espece).toBe("blette");
    expect(nouvellePlante("bonsaï", "2026-05-20", null, c).espece).toBeNull();
    expect(() => nouvellePlante("  ", "2026-05-20", null, c)).toThrow();
  });

  it("ajoute et retire une plante", () => {
    const z = zoneAvec(["basilic", "persil"]);
    const sans = retirerPlante(z, z.plantes[0].id);
    expect(sans.plantes.map((p) => p.nom)).toEqual(["Persil"]);
  });

  it("signale une plante qui veut plus de soleil que la zone n'en a", () => {
    const z = zoneAvec(["basilic", "menthe"], { exposition: "mi-ombre" });
    expect(plantesMalPlacees(z).map((m) => m.plante.nom)).toEqual(["Basilic"]);
    // La mi-ombre supporte le plein soleil.
    expect(plantesMalPlacees(zoneAvec(["menthe"]))).toEqual([]);
  });
});

describe("arrosage", () => {
  it("suit la plante la plus assoiffée, la saison et le contenant", () => {
    // Basilic tous les 2 jours, thym tous les 7 : la zone suit le basilic.
    expect(intervalleArrosage(zoneAvec(["basilic", "thym"]), "2026-07-10", null)).toBe(2);
    // En bac, la terre garde l'eau plus longtemps.
    expect(intervalleArrosage(zoneAvec(["basilic"], { type: "bac" }), "2026-07-10", null)).toBe(3);
    // En hiver, quatre fois moins souvent.
    expect(intervalleArrosage(zoneAvec(["thym"]), "2026-01-10", null)).toBe(28);
    expect(intervalleArrosage(zoneAvec([]), "2026-07-10", null)).toBeNull();
  });

  it("arrose plus souvent par forte chaleur", () => {
    const chaud = meteo(jour("2026-07-10", 18, 32));
    expect(intervalleArrosage(zoneAvec(["thym"]), "2026-07-10", chaud)).toBe(4);
    // Dedans, la chaleur du dehors ne compte pas.
    expect(intervalleArrosage(zoneAvec(["thym"], { abri: "interieur" }), "2026-07-10", chaud)).toBe(7);
  });

  it("demande d'arroser une zone jamais arrosée, puis après l'intervalle", () => {
    const z = zoneAvec(["basilic"]);
    expect(etatArrosage(z, "2026-07-10", null)?.du).toBe(true);
    const arrose = arroser(z, "2026-07-10", "m1");
    expect(arrose).toMatchObject({ arroseeLe: "2026-07-10", arrosePar: "m1" });
    expect(etatArrosage(arrose, "2026-07-11", null)).toMatchObject({ du: false, prochain: "2026-07-12" });
    expect(etatArrosage(arrose, "2026-07-13", null)?.du).toBe(true);
    expect(decrireArrosage(etatArrosage(arrose, "2026-07-13", null)!, "2026-07-13")).toBe("À arroser, en retard de 1 jour");
    expect(decrireArrosage(etatArrosage(arrose, "2026-07-10", null)!, "2026-07-10")).toBe("Arrosé aujourd'hui · prochain arrosage dans 2 jours");
  });

  it("compte une bonne pluie comme un arrosage, dehors seulement", () => {
    const pluie = meteo(jour("2026-07-09", 14, 22, 8), jour("2026-07-10", 13, 24), jour("2026-07-11", 13, 25));
    const z = arroser(zoneAvec(["basilic"]), "2026-07-07", null);
    const etat = etatArrosage(z, "2026-07-10", pluie)!;
    expect(etat).toMatchObject({ parLaPluie: true, dernier: "2026-07-09", prochain: "2026-07-11", du: false });
    expect(decrireArrosage(etat, "2026-07-10")).toBe("Arrosé par la pluie · prochain arrosage demain");
    // Sous un toit, la pluie ne tombe pas dans le pot.
    expect(etatArrosage({ ...z, abri: "couvert" }, "2026-07-10", pluie)?.du).toBe(true);
    // Une petite averse ne suffit pas.
    const bruine = meteo(jour("2026-07-09", 14, 22, 2));
    expect(etatArrosage(z, "2026-07-10", bruine)?.du).toBe(true);
  });

  it("n'arrose pas quand la pluie arrive", () => {
    const z = arroser(zoneAvec(["basilic"]), "2026-07-07", null);
    const demain = meteo(jour("2026-07-10", 14, 22), jour("2026-07-11", 13, 20, 12));
    const etat = etatArrosage(z, "2026-07-10", demain)!;
    expect(etat.du).toBe(false);
    expect(decrireArrosage(etat, "2026-07-10")).toBe("Pluie prévue demain : pas besoin d'arroser");
  });
});

describe("gel et chaleur", () => {
  const balcon = () => [zoneAvec(["basilic", "thym", "tomates"]), zoneAvec(["basilic"], { abri: "interieur", nom: "Cuisine" })];

  it("prévient du gel pour ce qui est frileux et dehors", () => {
    const froid = meteo(jour("2026-10-12", 6, 14), jour("2026-10-13", 0.4, 11));
    const gel = alerteGel(balcon(), froid, "2026-10-12");
    expect(gel).toEqual({ jour: "2026-10-13", min: 0.4, plantes: ["basilic", "tomates"] });
    expect(gestesDuJardin(balcon(), froid, "2026-10-12")[0]).toEqual({
      texte: "Gel cette nuit (0°) : rentre ou couvre basilic et tomates",
      urgent: true,
    });
  });

  it("protège aussi les vivaces en pot par fort gel", () => {
    const tresFroid = meteo(jour("2026-01-11", -7, -1));
    expect(alerteGel(balcon(), tresFroid, "2026-01-10")?.plantes).toEqual(["basilic", "thym", "tomates"]);
    expect(alerteGel([zoneAvec(["thym"], { type: "bac" })], tresFroid, "2026-01-10")).toBeNull();
  });

  it("prévient aussi pour la nuit d'après, mais pas pour un gel déjà passé ou dans trois jours", () => {
    const apres = gestesDuJardin(balcon(), meteo(jour("2026-10-13", 5, 12), jour("2026-10-14", -1, 8)), "2026-10-12");
    expect(apres[0].texte).toBe("Gel demain dans la nuit (-1°) : rentre ou couvre basilic et tomates");
    // La minimale du jour est tombée ce matin.
    expect(alerteGel(balcon(), meteo(jour("2026-10-12", -1, 14)), "2026-10-12")).toBeNull();
    expect(alerteGel(balcon(), meteo(jour("2026-10-12", 6, 14), jour("2026-10-15", -2, 5)), "2026-10-12")).toBeNull();
    expect(alerteGel(balcon(), null, "2026-10-12")).toBeNull();
  });

  it("rassemble les gestes du jour : gel, arrosages, chaleur", () => {
    const zones = [zoneAvec(["basilic"], { id: "z1", nom: "Pots du balcon", arroseeLe: "2026-07-10" }), zoneAvec(["persil"], { id: "z2", nom: "Jardinière" })];
    const gestes = gestesDuJardin(zones, meteo(jour("2026-07-10", 19, 33)), "2026-07-10");
    expect(gestes).toEqual([
      { texte: "Arroser : jardinière", urgent: true, zoneId: "z2" },
      { texte: "Forte chaleur (33°) : arrose tôt le matin ou le soir", urgent: false },
    ]);
  });
});

describe("calendrier", () => {
  it("dit quoi semer, planter et récolter ce mois-ci", () => {
    const especes = especesDuJardin([zoneAvec(["basilic", "tomate", "basilic thaï"]), zoneAvec(["radis"])]);
    expect(especes.map((x) => x.cle)).toEqual(["basilic", "tomate", "radis"]);
    const mai = calendrierDuMois(especes, 5);
    expect(mai.semerDehors.map((x) => x.nom)).toEqual(["Basilic", "Radis"]);
    expect(mai.planter.map((x) => x.nom)).toEqual(["Basilic", "Tomate"]);
    expect(calendrierDuMois(especes, 8).recolter.map((x) => x.nom)).toEqual(["Basilic", "Tomate", "Radis"]);
  });

  it("propose des idées qui conviennent au soleil des zones", () => {
    const idees = ideesDuMois([zoneAvec(["radis"], { exposition: "mi-ombre" })], 4, 3);
    expect(idees).toHaveLength(3);
    expect(idees.every((x) => x.cle !== "radis" && x.exposition !== "soleil")).toBe(true);
  });

  it("rappelle les Saints de glace et l'hiver", () => {
    expect(conseilDeSaison("2026-05-03")).toMatch(/Saints de glace/);
    expect(conseilDeSaison("2026-05-20")).toBeNull();
    expect(conseilDeSaison("2026-10-12")).toMatch(/gelées/);
  });

  it("connaît chaque espèce par sa clé", () => {
    expect(espece("lavande")?.vivace).toBe(true);
    expect(espece("inconnue")).toBeNull();
  });
});

describe("pour Jarvis", () => {
  it("résume le jardin et ses alertes", () => {
    const zones = [zoneAvec(["basilic"], { nom: "Pots du balcon", arroseeLe: "2026-10-12" })];
    const lignes = decrireJardin(zones, meteo(jour("2026-10-12", 4, 12, 0), jour("2026-10-13", 1, 10)), "2026-10-12");
    expect(lignes[0]).toBe("Jardin :");
    expect(lignes[1]).toMatch(/^- Pots du balcon \(pot, plein soleil, dehors\) : basilic ; arrosé aujourd'hui/);
    expect(lignes).toContain("Météo du jour : 4 à 12 °C, 0 mm de pluie.");
    expect(lignes.at(-1)).toMatch(/^Alerte : Gel cette nuit/);
    expect(decrireJardin([], null, "2026-10-12")).toEqual(["Jardin : aucune zone notée."]);
  });
});
