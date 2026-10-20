import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { comparerVersions, creerFoyer, decrireAppareils, ErreurValidation, listesInitiales, noterAppareil } from "./foyer";

describe("creerFoyer", () => {
  it("crée un foyer avec ses membres, couleurs distinctes", () => {
    const f = creerFoyer("  Chez nous ", ["Melo", " Sara "], contexteTest());
    expect(f.nom).toBe("Chez nous");
    expect(f.membres.map((m) => m.prenom)).toEqual(["Melo", "Sara"]);
    expect(f.membres[0].couleur).not.toBe(f.membres[1].couleur);
  });

  it("ignore les prénoms vides", () => {
    const f = creerFoyer("Maison", ["Melo", "  "], contexteTest());
    expect(f.membres).toHaveLength(1);
  });

  it("refuse un nom vide, aucun membre ou un doublon", () => {
    expect(() => creerFoyer(" ", ["Melo"], contexteTest())).toThrow(ErreurValidation);
    expect(() => creerFoyer("Maison", [""], contexteTest())).toThrow(ErreurValidation);
    expect(() => creerFoyer("Maison", ["Melo", "melo"], contexteTest())).toThrow(/deux fois/);
  });
});

describe("listesInitiales", () => {
  it("commence par une liste de courses", () => {
    const [courses] = listesInitiales(contexteTest());
    expect(courses.type).toBe("courses");
    expect(courses.nom).toBe("Courses");
  });
});

describe("les téléphones du foyer", () => {
  const ctx = contexteTest();
  const foyer = creerFoyer("Maison", ["Melo", "Sarah"], ctx);
  const [melo, sarah] = foyer.membres;

  it("note la version une fois par jour, et pas plus", () => {
    const note = noterAppareil(foyer, melo.id, "0.0.65", "2026-10-20T10:00:00.000Z");
    expect(note?.membres[0].appareil).toEqual({ version: "0.0.65", vuLe: "2026-10-20T10:00:00.000Z" });
    expect(noterAppareil(note!, melo.id, "0.0.65", "2026-10-20T18:00:00.000Z")).toBeNull();
    expect(noterAppareil(note!, melo.id, "0.0.65", "2026-10-21T08:00:00.000Z")).not.toBeNull();
    expect(noterAppareil(note!, melo.id, "0.0.66", "2026-10-20T18:00:00.000Z")).not.toBeNull();
    expect(noterAppareil(foyer, null, "0.0.65", "2026-10-20T10:00:00.000Z")).toBeNull();
  });

  it("dit qui est en retard", () => {
    const avec = { ...foyer, membres: [{ ...melo, appareil: { version: "0.0.65", vuLe: "2026-10-20T10:00:00.000Z" } }, { ...sarah, appareil: { version: "0.0.9", vuLe: "2026-10-17T10:00:00.000Z" } }] };
    const [m, s] = decrireAppareils(avec, "0.0.65", "2026-10-20T18:00:00.000Z");
    expect(m).toMatchObject({ version: "Kora 0.0.65", detail: "ouverte aujourd'hui", enRetard: false });
    expect(s).toMatchObject({ version: "Kora 0.0.9", detail: "ouverte il y a 3 jours · une mise à jour l'attend", enRetard: true });
    expect(decrireAppareils(foyer, "0.0.65", "2026-10-20T18:00:00.000Z")[1].version).toBe("Jamais ouverte");
    expect(comparerVersions("0.0.9", "0.0.64")).toBeLessThan(0);
    expect(comparerVersions("0.1.0", "0.0.64")).toBeGreaterThan(0);
  });
});
