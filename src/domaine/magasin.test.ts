import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { nouvelElement, nouvelleListe, organiserListe } from "./listes";
import { noterParcours, ordreDesRayons } from "./magasin";
import { RAYONS, type Element, type Liste } from "./types";

const ctx = contexteTest();

/** Coche les articles dans l'ordre, une minute d'écart, et apprend le parcours. */
function passage(liste: Liste, textes: string[], debut: string): Liste {
  const elements: Element[] = textes.map((t) => nouvelElement(liste, t, null, ctx));
  let l = liste;
  elements.forEach((e, i) => {
    const le = new Date(Date.parse(debut) + i * 60_000).toISOString();
    const coche = { ...e, coche: true, cocheLe: le };
    l = noterParcours(l, coche, elements.slice(0, i).map((x, j) => ({ ...x, coche: true, cocheLe: new Date(Date.parse(debut) + j * 60_000).toISOString() })), le);
  });
  return l;
}

describe("le mode magasin", () => {
  const courses = nouvelleListe("Courses", "panier", "courses", ctx);

  it("garde l'ordre habituel tant qu'il n'y a eu qu'un passage", () => {
    const l = passage(courses, ["Lessive", "Pain", "Lait"], "2026-10-20T09:00:00.000Z");
    expect(l.parcours?.passages).toBe(1);
    expect(ordreDesRayons(l)).toEqual(RAYONS);
  });

  it("range la liste dans l'ordre des coches après deux passages, Autre au bout", () => {
    let l = passage(courses, ["Lessive", "Pain", "Lait"], "2026-10-20T09:00:00.000Z");
    l = passage(l, ["Éponge", "Baguette", "Yaourt"], "2026-10-27T09:00:00.000Z");
    expect(l.parcours).toEqual({ rangs: { Entretien: 0, Boulangerie: 1, Crèmerie: 2 }, passages: 2 });
    expect(ordreDesRayons(l).slice(0, 3)).toEqual(["Entretien", "Boulangerie", "Crèmerie"]);
    expect(ordreDesRayons(l).at(-1)).toBe("Autre");
    const lait = nouvelElement(l, "Lait", null, ctx);
    const savon = nouvelElement(l, "Lessive", null, ctx);
    expect(organiserListe(l, [lait, savon]).aPrendre.map((g) => g.rayon)).toEqual(["Entretien", "Crèmerie"]);
  });

  it("un rayon revisité dans le même passage ne bouge pas", () => {
    const l = passage(courses, ["Pain", "Lait", "Baguette"], "2026-10-20T09:00:00.000Z");
    expect(l.parcours?.rangs).toEqual({ Boulangerie: 0, Crèmerie: 1 });
  });

  it("une liste simple n'apprend rien", () => {
    const simple = nouvelleListe("Cadeaux", "cadeau", "simple", ctx);
    const e = { ...nouvelElement(simple, "Livre", null, ctx), coche: true, cocheLe: "2026-10-20T09:00:00.000Z" };
    expect(noterParcours(simple, e, [], "2026-10-20T09:00:00.000Z")).toBe(simple);
  });
});
