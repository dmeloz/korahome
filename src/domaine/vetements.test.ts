import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { aTrierDe, compterVetements, enviesDe, lireEnvie, nouveauTri, nouvelleEnvie, poserTaille, resumeVetements, tailleDe, totalEnvies, type DocVetement } from "./vetements";

const MAINTENANT = "2026-10-26T10:00:00.000Z";

describe("les tailles", () => {
  it("une seule par pièce et par personne, retrouvée", () => {
    const ctx = contexteTest();
    const t = poserTaille("sarah", "chaussures", " 39 ", ctx)!;
    expect(t.id).toBe("taille-sarah-chaussures");
    expect(t.valeur).toBe("39");
    expect(poserTaille("sarah", "chaussures", "40", ctx)!.id).toBe(t.id);
    expect(tailleDe([t], "sarah", "chaussures")?.valeur).toBe("39");
    expect(tailleDe([t], "melo", "chaussures")).toBeNull();
  });

  it("une valeur vide veut dire la retirer", () => {
    expect(poserTaille("sarah", "haut", "  ", contexteTest())).toBeNull();
  });
});

describe("les envies", () => {
  it("lit le prix au bout du texte, sous plusieurs formes", () => {
    expect(lireEnvie("Veste en laine 120")).toEqual({ titre: "Veste en laine", prix: 120 });
    expect(lireEnvie("baskets blanches 89.90 CHF")).toEqual({ titre: "baskets blanches", prix: 89.9 });
    expect(lireEnvie("jean droit 79.-")).toEqual({ titre: "jean droit", prix: 79 });
    expect(lireEnvie("pull CHF 45,50")).toEqual({ titre: "pull", prix: 45.5 });
    expect(lireEnvie("écharpe")).toEqual({ titre: "écharpe", prix: null });
    // Un nombre seul n'est pas un prix sans titre.
    expect(lireEnvie("501")).toEqual({ titre: "501", prix: null });
  });

  it("les envies à acheter d'abord, puis achetées ces trente jours", () => {
    const ctx = contexteTest("2026-10-20T08:00:00.000Z");
    const a = nouvelleEnvie("Robe 60", "sarah", "sarah", ctx)!;
    const b = nouvelleEnvie("Bottes", "sarah", "melo", ctx)!;
    const achetee = { ...nouvelleEnvie("Gants 20", "sarah", "sarah", ctx)!, acheteLe: "2026-10-25" };
    const vieille = { ...nouvelleEnvie("Bonnet", "sarah", "sarah", ctx)!, acheteLe: "2026-08-01" };
    const autre = nouvelleEnvie("Ceinture", "melo", "melo", ctx)!;
    const docs: DocVetement[] = [a, achetee, b, vieille, autre];
    expect(enviesDe(docs, "sarah", MAINTENANT).map((e) => e.titre)).toEqual(["Bottes", "Robe", "Gants"]);
    expect(totalEnvies(enviesDe(docs, "sarah", MAINTENANT))).toBe(60);
    expect(b.ajoutePar).toBe("melo");
  });

  it("rien sans titre", () => {
    expect(nouvelleEnvie("   ", "sarah", null, contexteTest())).toBeNull();
  });
});

describe("le tri", () => {
  it("à faire dans l'ordre d'arrivée, fait ensuite", () => {
    const ctx = contexteTest("2026-10-20T08:00:00.000Z");
    const a = nouveauTri("Jean troué", "melo", "reparer", ctx)!;
    const b = { ...nouveauTri("Pull trop petit", "melo", "donner", ctx)!, faitLe: "2026-10-24" };
    const c = nouveauTri("Veste", "melo", "vendre", ctx)!;
    expect(aTrierDe([b, c, a], "melo", MAINTENANT).map((t) => t.titre)).toEqual(["Jean troué", "Veste", "Pull trop petit"]);
  });
});

describe("le résumé", () => {
  it("compte ce qui attend, et invite quand rien n'est noté", () => {
    const ctx = contexteTest("2026-10-20T08:00:00.000Z");
    const docs: DocVetement[] = [
      poserTaille("sarah", "haut", "M", ctx)!,
      poserTaille("sarah", "chaussures", "39", ctx)!,
      nouvelleEnvie("Robe", "sarah", "sarah", ctx)!,
      nouveauTri("Pull", "sarah", "donner", ctx)!,
    ];
    expect(resumeVetements(docs, "sarah", MAINTENANT)).toBe("2 tailles · 1 envie · 1 à trier");
    expect(compterVetements(docs, "sarah", MAINTENANT)).toBe(2);
    expect(compterVetements(docs, null, MAINTENANT)).toBe(0);
    expect(resumeVetements(docs, "melo", MAINTENANT)).toBe("Rien de noté pour l'instant");
  });
});
