import { describe, expect, it } from "vitest";
import { carteDemarrageVisible, etapesDemarrage, nombreFaites, titreDemarrage } from "./demarrage";

const foyer = { membres: [{ id: "melo", prenom: "Melo", couleur: "#000" }, { id: "sarah", prenom: "Sarah", couleur: "#fff" }] };
const base = { installee: false, membreId: null, partageActif: false, notifications: false, siriRelie: false, foyer, taches: [], fee: "Navi" };

describe("l'arrivée guidée", () => {
  it("compte six étapes, rien de fait sur un téléphone neuf", () => {
    const etapes = etapesDemarrage(base);
    expect(etapes).toHaveLength(6);
    expect(nombreFaites(etapes)).toBe(0);
    expect(titreDemarrage(etapes)).toBe("Prête en 6 étapes");
    expect(etapes[4].titre).toBe("Navi dans Siri");
  });

  it("se coche à mesure, et une tâche prise ou faite compte", () => {
    const etapes = etapesDemarrage({
      ...base,
      installee: true,
      membreId: "sarah",
      partageActif: true,
      notifications: true,
      taches: [{ id: "t", titre: "Litière", recurrence: null, echeance: "2026-10-21", responsable: "sarah", faiteLe: null, faitePar: null, creeLe: "2026-10-20T00:00:00.000Z" }],
    });
    expect(etapes.filter((e) => e.faite).map((e) => e.id)).toEqual(["installer", "personne", "partage", "notifications", "tache"]);
    expect(etapes[1].detail).toBe("C'est Sarah.");
    expect(titreDemarrage(etapes)).toBe("Prête dans une étape");
    expect(carteDemarrageVisible(etapes, false)).toBe(true);
    expect(carteDemarrageVisible(etapes, true)).toBe(false);
  });

  it("disparaît quand tout est fait", () => {
    const etapes = etapesDemarrage({ ...base, installee: true, membreId: "melo", partageActif: true, notifications: true, siriRelie: true, taches: [{ id: "t", titre: "X", recurrence: null, echeance: "2026-10-21", responsable: null, faiteLe: "2026-10-20T10:00:00.000Z", faitePar: "melo", creeLe: "2026-10-20T00:00:00.000Z" }] });
    expect(titreDemarrage(etapes)).toBe("Kora est prête");
    expect(carteDemarrageVisible(etapes, false)).toBe(false);
  });
});
