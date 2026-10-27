import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { ErreurValidation } from "./foyer";
import { lireLigneCarnet, numeroDe, aSortirCeSoir, appareilsDe, carnetDe, collecteCeJour, collectesDuJour, decrireAchat, decrireCarnet, entreeCarnet, entreeDuMemeNom, etatGarantie, finDeGarantie, modifierAppareil, nouvelAppareil, PHRASE_SECRET, phraseSortir, prochaineCollecte, prochainesCollectes, reglerCollecte, ressembleASecret, type Collecte, type DocMaison } from "./maison";

// Le 26 octobre 2026 est un lundi.
const LUNDI = "2026-10-26";

describe("les jours des déchets", () => {
  it("chaque semaine : le prochain jour de ce nom, aujourd'hui compris", () => {
    const c: Collecte = { type: "ordures", jour: 1, rythme: "semaine" };
    expect(prochaineCollecte(c, LUNDI)).toBe(LUNDI);
    expect(prochaineCollecte({ ...c, jour: 3 }, LUNDI)).toBe("2026-10-28");
    expect(prochaineCollecte({ ...c, jour: 0 }, LUNDI)).toBe("2026-11-01");
  });

  it("toutes les deux semaines, calé sur une date connue", () => {
    const c: Collecte = { type: "papier", jour: 3, rythme: "quinzaine", reference: "2026-10-14" };
    expect(collecteCeJour(c, "2026-10-28")).toBe(true);
    expect(collecteCeJour(c, "2026-10-21")).toBe(false);
    expect(prochaineCollecte(c, "2026-10-22")).toBe("2026-10-28");
    expect(prochaineCollecte(c, "2026-10-29")).toBe("2026-11-11");
  });

  it("une fois par mois : le deuxième mardi", () => {
    const c: Collecte = { type: "encombrants", jour: 2, rythme: "mois", semaineDuMois: 2 };
    expect(prochaineCollecte(c, LUNDI)).toBe("2026-11-10");
    expect(collecteCeJour(c, "2026-10-13")).toBe(true);
    expect(collecteCeJour(c, "2026-10-06")).toBe(false);
  });

  it("dit ce qu'il faut sortir ce soir, et ce qui passe ce matin", () => {
    const ctx = contexteTest();
    let r = reglerCollecte(null, "ordures", { jour: 2, rythme: "semaine" }, ctx);
    r = reglerCollecte(r, "verre", { jour: 2, rythme: "quinzaine", reference: "2026-10-27" }, ctx);
    r = reglerCollecte(r, "papier", { jour: 1, rythme: "semaine" }, ctx);
    expect(aSortirCeSoir(r, LUNDI)).toEqual(["ordures", "verre"]);
    expect(phraseSortir(aSortirCeSoir(r, LUNDI))).toBe("Sortir : ordures ménagères et verre");
    expect(collectesDuJour(r, LUNDI)).toEqual(["papier"]);
    expect(phraseSortir(["papier"])).toBe("Sortir le papier et le carton");
    expect(prochainesCollectes(r, LUNDI).map((p) => `${p.collecte.type} ${p.quand}`)).toEqual(["papier aujourd'hui", "ordures demain", "verre demain"]);
    expect(prochainesCollectes(reglerCollecte(r, "papier", null, ctx), "2026-10-23").map((p) => p.quand)).toEqual(["mardi 27", "mardi 27"]);
    expect(aSortirCeSoir(null, LUNDI)).toEqual([]);
  });
});

describe("nos appareils", () => {
  it("calcule la garantie depuis l'achat", () => {
    const ctx = contexteTest();
    const a = modifierAppareil(nouvelAppareil("  Lave-linge  Miele ", ctx)!, { acheteLe: "2024-11-10", garantieMois: 24, prix: 1299, magasin: "Fust" }, ctx);
    expect(a.nom).toBe("Lave-linge Miele");
    expect(finDeGarantie(a)).toBe("2026-11-09");
    expect(etatGarantie(a, "2026-10-26")).toMatchObject({ etat: "bientot", texte: "Garantie finit dans 14 jours" });
    expect(etatGarantie(a, "2026-11-10")).toMatchObject({ etat: "finie" });
    expect(etatGarantie(a, "2025-01-01")).toMatchObject({ etat: "en-cours", texte: "Garantie jusqu'au 09.11.2026" });
    expect(etatGarantie(modifierAppareil(a, { garantieMois: null }, ctx), "2026-10-26")).toEqual({ etat: "inconnue" });
    expect(decrireAchat(a)).toBe("Acheté le 10.11.2024 chez Fust · 1299 CHF");
  });

  it("range les appareils par nom, rien sans nom", () => {
    const ctx = contexteTest();
    expect(nouvelAppareil("   ", ctx)).toBeNull();
    const docs = [nouvelAppareil("Frigo", ctx)!, nouvelAppareil("Aspirateur", ctx)!, reglerCollecte(null, "verre", { jour: 1, rythme: "semaine" }, ctx)];
    expect(appareilsDe(docs).map((a) => a.nom)).toEqual(["Aspirateur", "Frigo"]);
  });
});

describe("le carnet de la maison", () => {
  it("note une ligne propre, et la remplace en gardant son identité", () => {
    const ctx = contexteTest();
    const e = entreeCarnet("  Concierge ", " M. Rossi,  079 123 45 67 ", ctx);
    expect(e).toMatchObject({ type: "carnet", titre: "Concierge", valeur: "M. Rossi, 079 123 45 67" });
    const apres = entreeCarnet("Concierge", "Mme Bianchi, 079 000 00 00", ctx, e);
    expect(apres.id).toBe(e.id);
    expect(apres.creeLe).toBe(e.creeLe);
    expect(apres.valeur).toBe("Mme Bianchi, 079 000 00 00");
  });

  it("refuse les mots de passe et les codes, et les lignes vides", () => {
    const ctx = contexteTest();
    expect(() => entreeCarnet("Wifi", "mot de passe : soleil42", ctx)).toThrow(PHRASE_SECRET);
    expect(() => entreeCarnet("Code PIN de la carte", "1234", ctx)).toThrow(ErreurValidation);
    expect(() => entreeCarnet("", "M. Rossi", ctx)).toThrow(ErreurValidation);
    expect(() => entreeCarnet("Concierge", " ", ctx)).toThrow(ErreurValidation);
    expect(ressembleASecret("Vanne d'eau : sous l'évier")).toBe(false);
    expect(ressembleASecret("Gérance : Régie du Lac, 021 555 00 00")).toBe(false);
  });

  it("se range par nom, retrouve une ligne du même nom et se décrit pour la fée", () => {
    const ctx = contexteTest();
    const docs: DocMaison[] = [entreeCarnet("Vanne d'eau", "Sous l'évier de la cuisine", ctx), entreeCarnet("Concierge", "M. Rossi", ctx), nouvelAppareil("Lave-linge", ctx)!];
    expect(carnetDe(docs).map((e) => e.titre)).toEqual(["Concierge", "Vanne d'eau"]);
    expect(entreeDuMemeNom(docs, "le concierge")?.valeur).toBe("M. Rossi");
    expect(entreeDuMemeNom(docs, "gérance")).toBeNull();
    expect(decrireCarnet(docs)).toEqual(["Carnet de la maison :", "- Concierge : M. Rossi", "- Vanne d'eau : Sous l'évier de la cuisine"]);
    expect(decrireCarnet([])).toEqual([]);
  });
});

describe("une ligne du carnet écrite d'un trait", () => {
  it("sépare le nom du reste aux deux-points", () => {
    expect(lireLigneCarnet("Concierge : M. Rossi, 079 123 45 67")).toEqual({ titre: "Concierge", valeur: "M. Rossi, 079 123 45 67" });
    expect(lireLigneCarnet("Gérance")).toEqual({ titre: "Gérance", valeur: "" });
  });

  it("trouve un numéro suisse pour l'appeler", () => {
    expect(numeroDe("M. Rossi, 079 123 45 67")).toBe("+41791234567");
    expect(numeroDe("Régie du Lac +41 21 555 00 00")).toBe("+41215550000");
    expect(numeroDe("0041 21 555 00 00")).toBe("+41215550000");
    expect(numeroDe("Compteur n° 12345678")).toBeNull();
    expect(numeroDe("Sous l'évier")).toBeNull();
  });
});
