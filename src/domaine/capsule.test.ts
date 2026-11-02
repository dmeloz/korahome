import { describe, expect, it } from "vitest";
import type { ChoseDuJour } from "./aujourdhui";
import { capsuleAujourdhui, capsuleCourses, capsuleNous, extrait, progressionVers, vueVoisine } from "./capsule";

const chose = (texte: string, quand: string, autres: Partial<ChoseDuJour> = {}): ChoseDuJour => ({ cle: texte, texte, quand, etat: "jour", destination: "taches", ...autres });

describe("capsule vivante", () => {
  it("passe d'une vue à l'autre sans faire le tour", () => {
    expect(vueVoisine("aujourdhui", 1)).toBe("courses");
    expect(vueVoisine("courses", 1)).toBe("nous");
    expect(vueVoisine("nous", 1)).toBe("nous");
    expect(vueVoisine("aujourdhui", -1)).toBe("aujourdhui");
    expect(vueVoisine("nous", -1)).toBe("courses");
  });

  it("remplit le fil dans les trois heures avant l'heure", () => {
    expect(progressionVers("15:00", "19:00")).toBe(0);
    expect(progressionVers("17:30", "19:00")).toBe(0.5);
    expect(progressionVers("19:00", "19:00")).toBe(1);
    expect(progressionVers("20:10", "19:00")).toBe(1);
  });

  it("dit la première chose du jour et combien suivent", () => {
    const e = capsuleAujourdhui([chose("Poubelles vertes", "avant 19:00", { heure: "19:00" }), chose("Arroser le basilic", "ce soir")], null, "17:30");
    expect(e).toEqual({ petit: "Avant 19:00 · puis 1 autre", grand: "Poubelles vertes", progression: 0.5, ton: "fee" });
  });

  it("met le fil plein pour ce qui est en retard", () => {
    expect(capsuleAujourdhui([chose("Payer Swisscom", "en retard", { etat: "urgent" })], null, "08:00").progression).toBe(1);
  });

  it("sans rien à faire, dit le menu du soir, sinon le calme", () => {
    expect(capsuleAujourdhui([], "Risotto aux courges", "18:00").grand).toBe("Risotto aux courges");
    expect(capsuleAujourdhui([], null, "18:00")).toEqual({ petit: "Aujourd'hui", grand: "Rien ne presse", progression: 1, ton: "fee" });
  });

  it("compte les courses et prend la couleur de l'autre en direct", () => {
    const liste = [{ coche: true }, { coche: true }, { coche: false }, { coche: false }];
    expect(capsuleCourses(liste, null)).toEqual({ petit: "Courses", grand: "Encore 2 à prendre", progression: 0.5, ton: "fee" });
    expect(capsuleCourses(liste, "Sarah")).toMatchObject({ petit: "Courses · Sarah coche en direct", ton: "autre" });
    expect(capsuleCourses([{ coche: true }], null).grand).toBe("Tout est pris");
    expect(capsuleCourses([], null).grand).toBe("Liste vide");
  });

  it("coupe un mot long à un espace", () => {
    expect(extrait("Bonne journée")).toBe("Bonne journée");
    expect(extrait("Bonne journée, pense au parmesan en rentrant ce soir", 30)).toBe("Bonne journée, pense au…");
  });

  it("montre le mot de l'autre tant qu'on n'y a pas répondu", () => {
    const mot = { texte: "Pense au parmesan" };
    expect(capsuleNous(mot, false, "Sarah")).toEqual({ petit: "Sarah t'a écrit", grand: "« Pense au parmesan »", progression: 1, ton: "autre" });
    expect(capsuleNous(mot, true, "Sarah")).toMatchObject({ petit: "Nous", grand: "Écrire à Sarah", ton: "fee" });
    expect(capsuleNous(null, false, null).grand).toBe("Nos mots");
  });
});
