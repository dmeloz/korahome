import { describe, expect, it } from "vitest";
import { enDirect, noterCocheur } from "./ecranAccueil";
import type { Element, Liste, Membre } from "./types";

describe("enDirect", () => {
  const membres: Membre[] = [
    { id: "melo", prenom: "Melo", couleur: "" },
    { id: "sarah", prenom: "Sarah", couleur: "" },
  ];
  const courses: Liste = { id: "l", nom: "Courses", icone: "", type: "courses", creeLe: "" };
  const el = (id: string, coche: boolean, cocheLe: string | null = null, cochePar?: string | null): Element => ({ id, listeId: "l", texte: id, quantite: null, rayon: "Autre", coche, ajoutePar: null, creeLe: "", cocheLe, cochePar });
  const maintenant = "2026-10-25T18:20:00.000Z";
  const base = { listes: [courses], foyer: { membres }, membreId: "melo" };

  it("l'autre coche les courses en ce moment : son prénom et l'avancée", () => {
    const elements = [el("a", true, "2026-10-25T18:10:00.000Z", "sarah"), el("b", true, "2026-10-25T18:15:00.000Z", "sarah"), el("c", false), el("d", true, "2026-10-20T10:00:00.000Z")];
    expect(enDirect({ ...base, elements }, maintenant)).toEqual({ qui: "Sarah", coches: 3, total: 4 });
  });

  it("rien quand c'est moi, quand c'est trop vieux ou un seul article", () => {
    expect(enDirect({ ...base, elements: [el("a", true, "2026-10-25T18:10:00.000Z", "melo"), el("b", true, "2026-10-25T18:11:00.000Z", "melo")] }, maintenant)).toBeNull();
    expect(enDirect({ ...base, elements: [el("a", true, "2026-10-25T17:10:00.000Z", "sarah"), el("b", true, "2026-10-25T17:11:00.000Z", "sarah")] }, maintenant)).toBeNull();
    expect(enDirect({ ...base, elements: [el("a", true, "2026-10-25T18:10:00.000Z", "sarah")] }, maintenant)).toBeNull();
  });

  it("une ancienne version ne dit pas qui coche : c'est l'autre quand on est deux", () => {
    const elements = [el("a", true, "2026-10-25T18:10:00.000Z"), el("b", true, "2026-10-25T18:12:00.000Z")];
    expect(enDirect({ ...base, elements }, maintenant)?.qui).toBe("Sarah");
  });

  it("noterCocheur garde qui coche et l'oublie au décochage", () => {
    const avant = el("a", false);
    expect(noterCocheur(avant, { ...avant, coche: true }, "melo").cochePar).toBe("melo");
    expect(noterCocheur({ ...avant, coche: true }, avant, "melo").cochePar).toBeNull();
  });
});
