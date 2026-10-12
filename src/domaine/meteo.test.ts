import { describe, expect, it } from "vitest";
import { adresseMeteo, decrireTemps, formaterPluie, formaterTemperatures, lireMeteo, meteoDu, meteoFraiche } from "./meteo";

const reponse = {
  daily: {
    time: ["2026-10-10", "2026-10-11", "2026-10-12"],
    temperature_2m_min: [5.2, 3.1, -0.4],
    temperature_2m_max: [14.8, 12.0, 9.6],
    precipitation_sum: [0, 7.4, null],
    weather_code: [1, 63, 0],
  },
};

describe("météo du jardin", () => {
  it("demande deux jours passés et une semaine, à Renens, à l'heure suisse", () => {
    const adresse = new URL(adresseMeteo());
    expect(adresse.host).toBe("api.open-meteo.com");
    expect(adresse.searchParams.get("latitude")).toBe("46.5354");
    expect(adresse.searchParams.get("past_days")).toBe("2");
    expect(adresse.searchParams.get("timezone")).toBe("Europe/Zurich");
  });

  it("relit la réponse jour par jour", () => {
    const m = lireMeteo(reponse, "2026-10-12T05:00:00.000Z")!;
    expect(m.jours).toHaveLength(3);
    expect(meteoDu(m, "2026-10-11")).toEqual({ jour: "2026-10-11", min: 3.1, max: 12, pluie: 7.4, code: 63 });
    expect(meteoDu(m, "2026-10-12")?.pluie).toBe(0);
    expect(meteoDu(m, "2026-10-20")).toBeNull();
  });

  it("refuse une réponse qui n'a pas la forme attendue", () => {
    expect(lireMeteo(null, "x")).toBeNull();
    expect(lireMeteo({ daily: { time: ["2026-10-10"] } }, "x")).toBeNull();
    expect(lireMeteo({ error: true, reason: "quota" }, "x")).toBeNull();
  });

  it("ne garde une météo que douze heures", () => {
    const m = lireMeteo(reponse, "2026-10-12T05:00:00.000Z");
    expect(meteoFraiche(m, "2026-10-12T16:00:00.000Z")).toBe(true);
    expect(meteoFraiche(m, "2026-10-12T18:00:00.000Z")).toBe(false);
  });

  it("décrit le temps en mots simples", () => {
    expect(decrireTemps(0)).toBe("Grand soleil");
    expect(decrireTemps(63)).toBe("Pluie");
    expect(decrireTemps(95)).toBe("Orage");
    expect(formaterTemperatures({ jour: "x", min: -0.4, max: 9.6, pluie: 0, code: 0 })).toBe("0° / 10°");
    expect(formaterPluie(0.2)).toBeNull();
    expect(formaterPluie(12.4)).toBe("12 mm");
  });
});
