import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { nouveauCoeur, nouveauMot } from "./bandeau";
import { composerHub, type EntreeHub } from "./hub";
import { nouvelleZone } from "./jardin";
import type { Foyer } from "./types";

const ctx = contexteTest("2026-10-26T17:00:00.000Z");
const AUJOURDHUI = "2026-10-26";
const MAINTENANT = "2026-10-26T18:42:00.000Z";
const foyer: Foyer = { id: "f", nom: "Cassa", membres: [{ id: "melo", prenom: "Melo", couleur: "#000" }, { id: "sarah", prenom: "Sarah", couleur: "#111" }] } as unknown as Foyer;

const ZONE = nouvelleZone({ nom: "Pots du balcon", type: "pot", exposition: "soleil", abri: "dehors" }, ctx);

function entree(partiel: Partial<EntreeHub> = {}): EntreeHub {
  return { foyer, membreId: "melo", aujourdhui: AUJOURDHUI, maintenant: MAINTENANT, couple: [], zones: [], meteo: null, ...partiel };
}

describe("le mot de l'autre et le jardin sur Aujourd'hui", () => {
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

  it("le jardin : la nuit et le geste ; pas de carte sans zone", () => {
    const meteo = { lieu: "Renens", lue: MAINTENANT, jours: [{ jour: AUJOURDHUI, min: 6, max: 14, pluie: 0, code: 1 }, { jour: "2026-10-27", min: 4.4, max: 11, pluie: 3.2, code: 61 }] };
    expect(composerHub(entree({ meteo })).balcon).toBeNull();
    const zones = [ZONE];
    expect(composerHub(entree({ zones, meteo })).balcon).toMatchObject({ nuit: "4°", urgent: false });
    // Une météo de plus de 12 h ne dit plus la température.
    expect(composerHub(entree({ zones, meteo: { ...meteo, lue: "2026-10-25T01:00:00.000Z" } })).balcon?.nuit).toBeNull();
  });
});
