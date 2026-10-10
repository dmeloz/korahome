import { describe, expect, it } from "vitest";
import { cleEnOctets, diagnostiquer } from "./rappels";

const base = { pushPossible: true, iPhone: true, ecranAccueil: true, permission: "default" as NotificationPermission, inscrit: false };

describe("l'état des rappels sur ce téléphone", () => {
  it("demande d'ouvrir l'app depuis l'écran d'accueil quand Safari ne peut pas", () => {
    expect(diagnostiquer({ ...base, pushPossible: false, ecranAccueil: false, permission: null })).toBe("ecran-accueil");
    expect(diagnostiquer({ ...base, pushPossible: false, iPhone: false, permission: null })).toBe("impossible");
  });

  it("distingue refusés, pas encore activés et activés", () => {
    expect(diagnostiquer({ ...base, permission: "denied" })).toBe("refuses");
    expect(diagnostiquer(base)).toBe("inactifs");
    expect(diagnostiquer({ ...base, permission: "granted" })).toBe("inactifs");
    expect(diagnostiquer({ ...base, permission: "granted", inscrit: true })).toBe("actifs");
  });
});

describe("la clé publique du serveur", () => {
  it("se décode depuis le base64 des URL", () => {
    expect([...cleEnOctets("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});
