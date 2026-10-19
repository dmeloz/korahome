import { describe, expect, it } from "vitest";
import { preparerEvenement } from "./agenda";
import { noterHumeur, nouveauCompte } from "./bandeau";
import { contexteTest } from "./contexteTest";
import { basculerSigne, nettoyerSignes, signesDuJour, valeurSigne, type DonneesSignes } from "./signes";

const ctx = contexteTest();
const auj = "2026-10-19";
const foyer = { id: "f", nom: "Cassa", creeLe: "2026-10-01T00:00:00Z", membres: [{ id: "dany", prenom: "Dany", couleur: "#000" }, { id: "sarah", prenom: "Sarah", couleur: "#111" }] };

function donnees(partiel: Partial<DonneesSignes> = {}): DonneesSignes {
  return { foyer, membreId: "dany", aujourdhui: auj, couple: [], evenements: [], animaux: [], zones: [], meteo: null, ...partiel };
}

describe("le choix des signes", () => {
  it("part des humeurs et du compte à rebours", () => {
    expect(nettoyerSignes(undefined)).toEqual(["humeurs", "compte"]);
  });

  it("relit un choix en ignorant l'inconnu et les doublons, trois au plus", () => {
    expect(nettoyerSignes(["meteo", "meteo", "lune", "rdv", "mitsu", "compte"])).toEqual(["meteo", "rdv", "mitsu"]);
  });

  it("coche dans l'ordre de la liste et refuse un quatrième", () => {
    expect(basculerSigne(["meteo"], "humeurs")).toEqual(["humeurs", "meteo"]);
    expect(basculerSigne(["humeurs", "compte", "meteo"], "rdv")).toEqual(["humeurs", "compte", "meteo"]);
    expect(basculerSigne(["humeurs", "compte"], "humeurs")).toEqual(["compte"]);
  });
});

describe("ce que dit chaque signe", () => {
  it("les humeurs : la mienne, puis celle de l'autre, et la question quand je n'ai rien dit", () => {
    const couple = [noterHumeur("sarah", auj, "😴")];
    const v = valeurSigne("humeurs", donnees({ couple }));
    expect(v?.humeurs).toEqual([null, "😴"]);
    expect(v?.phrase).toBe("Sarah : fatigue. Et toi, comment tu te sens aujourd'hui ?");
    const deux = valeurSigne("humeurs", donnees({ couple: [...couple, noterHumeur("dany", auj, "🎉")] }));
    expect(deux?.phrase).toBe("Sarah : fatigue. Toi : en forme.");
  });

  it("le compte à rebours le plus proche, en J−N", () => {
    const couple = [nouveauCompte("Lisbonne", "2026-10-31", "dany", auj, ctx), nouveauCompte("Noël", "2026-12-25", "dany", auj, ctx)];
    const v = valeurSigne("compte", donnees({ couple }));
    expect(v?.court).toBe("J−12");
    expect(v?.phrase).toBe("Lisbonne : dans 12 jours, samedi 31 oct.");
    expect(valeurSigne("compte", donnees())).toBeNull();
  });

  it("le prochain rendez-vous, sans celui d'aujourd'hui déjà passé", () => {
    const matin = preparerEvenement({ titre: "Coiffeur", jour: auj, heure: "09:00" }, "dany", ctx);
    const jeudi = preparerEvenement({ titre: "Dentiste", jour: "2026-10-22", heure: "14:30", pour: "sarah" }, "dany", ctx);
    const v = valeurSigne("rdv", donnees({ evenements: [matin, jeudi], heure: "18:00" }));
    expect(v?.court).toBe("jeu.");
    expect(v?.phrase).toBe("Jeudi 22 oct. à 14:30 : dentiste (Sarah).");
    expect(valeurSigne("rdv", donnees({ evenements: [matin], heure: "08:00" }))?.court).toBe("09:00");
  });

  it("la météo du jour, et rien sans météo", () => {
    const meteo = { lieu: "Renens", lue: "2026-10-19T06:00:00Z", jours: [{ jour: auj, min: 6, max: 11.4, pluie: 2, code: 61 }] };
    expect(valeurSigne("meteo", donnees({ meteo }))?.court).toBe("11°");
    expect(valeurSigne("meteo", donnees())).toBeNull();
  });

  it("n'affiche que les signes qui ont quelque chose à dire", () => {
    expect(signesDuJour(["compte", "humeurs", "mitsu"], donnees()).map((v) => v.id)).toEqual(["humeurs"]);
  });
});
