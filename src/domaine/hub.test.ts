import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { preparerEvenement } from "./agenda";
import { nouveauCoeur, nouveauMot } from "./bandeau";
import { composerHub, compterCeSoir, COURSES_SUR_LE_HUB, type EntreeHub } from "./hub";
import { nouvelElement, nouvelleListe } from "./listes";
import type { Foyer } from "./types";

const ctx = contexteTest("2026-10-26T17:00:00.000Z");
const AUJOURDHUI = "2026-10-26";
const MAINTENANT = "2026-10-26T18:42:00.000Z";
const foyer: Foyer = { id: "f", nom: "Cassa", membres: [{ id: "melo", prenom: "Melo", couleur: "#000" }, { id: "sarah", prenom: "Sarah", couleur: "#111" }] } as unknown as Foyer;
const courses = nouvelleListe("Courses", "", "courses", ctx);

function entree(partiel: Partial<EntreeHub> = {}): EntreeHub {
  return {
    foyer,
    membreId: "melo",
    aujourdhui: AUJOURDHUI,
    maintenant: MAINTENANT,
    choses: [{ cle: "t1", texte: "Sortir le papier", quand: "ce soir", etat: "jour", destination: "taches" }],
    menus: [],
    listes: [courses],
    elements: [],
    evenements: [],
    animaux: [],
    dechets: null,
    couple: [],
    zones: [],
    meteo: null,
    ...partiel,
  };
}

describe("le hub sur iPad", () => {
  it("montre six courses à prendre au plus, et compte le reste", () => {
    const elements = Array.from({ length: 9 }, (_, i) => nouvelElement(courses, `Article ${i}`, "melo", ctx));
    const coche = { ...elements[0], coche: true };
    const hub = composerHub(entree({ elements: [coche, ...elements.slice(1)] }));
    expect(hub.courses.elements.length).toBe(COURSES_SUR_LE_HUB);
    expect(hub.courses.reste).toBe(8 - COURSES_SUR_LE_HUB);
    expect(hub.courses.liste?.id).toBe(courses.id);
    expect(hub.courses.elements.map((e) => e.texte)).not.toContain("Article 0");
  });

  it("demain : l'agenda à l'heure, puis les déchets à la porte", () => {
    const veto = preparerEvenement({ titre: "Vétérinaire", jour: "2026-10-27", heure: "08:30", lieu: null }, "melo", ctx);
    const dej = preparerEvenement({ titre: "Déjeuner", jour: "2026-10-27", heure: "12:15", lieu: null }, "sarah", ctx);
    const apres = preparerEvenement({ titre: "Plus tard", jour: "2026-10-29", heure: null, lieu: null }, "melo", ctx);
    const hub = composerHub(entree({ evenements: [dej, veto, apres], dechets: { id: "dechets", type: "dechets", collectes: [{ type: "papier", jour: 2, rythme: "semaine" }], modifieLe: "" } }));
    expect(hub.demain.map((l) => [l.quand, l.texte])).toEqual([
      ["08:30", "Vétérinaire"],
      ["12:15", "Déjeuner"],
      ["matin", "Papier et carton à la porte"],
    ]);
  });

  it("le dernier mot de l'autre, jamais le sien ni un cœur seul", () => {
    const mien = nouveauMot("À ce soir", "melo", ctx);
    const sien = { ...nouveauMot("Je rentre vers 19 h, garde-moi du risotto.", "sarah", ctx), visibleDes: "2026-10-26T17:05:00.000Z" };
    const coeur = nouveauCoeur("sarah", ctx);
    const hub = composerHub(entree({ couple: [mien, sien, coeur] }));
    expect(hub.mot?.mot.id).toBe(sien.id);
    expect(hub.mot?.titre).toBe("De Sarah, à 17:05");
    expect(hub.mot?.coeurDonne).toBe(false);
    expect(composerHub(entree({ couple: [mien] })).mot).toBeNull();
    expect(composerHub(entree({ couple: [{ ...sien, coeurs: ["melo"] }] })).mot?.coeurDonne).toBe(true);
  });

  it("le balcon : la nuit, demain, et le geste ; rien sans jardin ni météo", () => {
    expect(composerHub(entree()).balcon).toBeNull();
    const meteo = { lieu: "Renens", lue: MAINTENANT, jours: [{ jour: AUJOURDHUI, min: 6, max: 14, pluie: 0, code: 1 }, { jour: "2026-10-27", min: 4.4, max: 11, pluie: 3.2, code: 61 }] };
    const hub = composerHub(entree({ meteo }));
    expect(hub.balcon).toMatchObject({ nuit: "4°", urgent: false });
    expect(hub.balcon?.demain).toContain("demain, 3 mm");
    expect(hub.balcon?.geste).toBe("Pas de zone au jardin pour l'instant.");
    // Une météo de plus de 12 h ne dit plus la température.
    expect(composerHub(entree({ meteo: { ...meteo, lue: "2026-10-25T01:00:00.000Z" } })).balcon?.nuit).toBeNull();
  });

  it("compte ce soir", () => {
    expect(compterCeSoir([])).toBe("Tout est fait");
    expect(compterCeSoir(entree().choses)).toBe("1 à faire");
  });
});
