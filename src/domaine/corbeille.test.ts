import { describe, expect, it } from "vitest";
import { aPurger, decrireEffacement, espaceDe, joursRestants, meriteLaCorbeille, mettreALaCorbeille, titreDe, trierCorbeille } from "./corbeille";
import type { Element, Liste, Tache } from "./types";

const T0 = "2026-10-20T10:00:00.000Z";
const foyer = { membres: [{ id: "m1", prenom: "Melo", couleur: "#000" }, { id: "m2", prenom: "Sarah", couleur: "#fff" }] };
const tache: Tache = { id: "t1", titre: "Sortir les poubelles", recurrence: null, echeance: "2026-10-21", responsable: null, faiteLe: null, faitePar: null, creeLe: "2026-10-01T08:00:00.000Z" };

describe("la corbeille", () => {
  it("garde le document, qui l'a effacé et quand", () => {
    const e = mettreALaCorbeille("taches", tache, { maintenant: T0, par: "m2" });
    expect(e).toMatchObject({ id: "taches/t1", collection: "taches", docId: "t1", donnees: tache, effaceLe: T0, effacePar: "m2" });
    expect(e.elements).toBeUndefined();
  });

  it("emporte les articles d'une liste avec elle", () => {
    const liste: Liste = { id: "l1", nom: "Bricolage", icone: "outil", type: "simple", creeLe: "2026-09-01T00:00:00.000Z" };
    const articles: Element[] = [{ id: "e1", listeId: "l1", texte: "Vis", quantite: null, rayon: "Autre", coche: false, ajoutePar: null, creeLe: "2026-09-01T00:00:00.000Z", cocheLe: null }];
    const e = mettreALaCorbeille("listes", liste, { maintenant: T0, par: null }, articles);
    expect(e.elements).toHaveLength(1);
    expect(titreDe(e)).toBe("Liste « Bricolage » (1 article)");
  });

  it("laisse passer un ajout annulé dans la minute", () => {
    expect(meriteLaCorbeille("taches", { ...tache, creeLe: "2026-10-20T09:59:30.000Z" }, T0)).toBe(false);
    expect(meriteLaCorbeille("taches", tache, T0)).toBe(true);
  });

  it("ne prend ni humeur, ni réglage, ni compte iCloud, ni mois du budget", () => {
    expect(meriteLaCorbeille("couple", { id: "h", type: "humeur" }, T0)).toBe(false);
    expect(meriteLaCorbeille("couple", { id: "m", type: "mot", texte: "Je t'aime" }, T0)).toBe(true);
    expect(meriteLaCorbeille("menus", { id: "reglage", type: "reglage" }, T0)).toBe(false);
    expect(meriteLaCorbeille("menus", { id: "r", type: "recette", titre: "Risotto" }, T0)).toBe(true);
    expect(meriteLaCorbeille("agenda", { id: "c", membre: "m1" }, T0)).toBe(false);
    expect(meriteLaCorbeille("agenda", { id: "e", titre: "Dentiste" }, T0)).toBe(true);
    expect(meriteLaCorbeille("budget", { id: "mois", genre: "mois" }, T0)).toBe(false);
    expect(meriteLaCorbeille("budget", { id: "d", genre: "depense", libelle: "Migros", montant: 42.5 }, T0)).toBe(true);
    expect(meriteLaCorbeille("stock", null, T0)).toBe(false);
  });

  it("purge après trente jours, et trie la plus récente en premier", () => {
    const vieille = mettreALaCorbeille("taches", { ...tache, id: "v" }, { maintenant: "2026-09-19T10:00:00.000Z", par: null });
    const limite = mettreALaCorbeille("taches", { ...tache, id: "l" }, { maintenant: "2026-09-20T10:00:00.000Z", par: null });
    const recente = mettreALaCorbeille("taches", { ...tache, id: "r" }, { maintenant: "2026-10-19T10:00:00.000Z", par: null });
    expect(aPurger([vieille, limite, recente], T0).map((e) => e.docId)).toEqual(["v", "l"]);
    expect(trierCorbeille([vieille, limite, recente], T0).map((e) => e.docId)).toEqual(["r"]);
    expect(joursRestants(recente, T0)).toBe(29);
    expect(joursRestants(vieille, T0)).toBe(0);
  });

  it("dit d'où vient chaque document et comment il s'appelait", () => {
    expect(espaceDe("listes", { type: "courses" })).toBe("Courses");
    expect(espaceDe("taches", { categorie: "entretien" })).toBe("Entretien");
    expect(espaceDe("menus", { type: "recette" })).toBe("Nos recettes");
    const depense = mettreALaCorbeille("budget", { id: "d", genre: "depense", libelle: "Migros", montant: 42.5 } as { id: string }, { maintenant: T0, par: "m1" });
    expect(titreDe(depense)).toBe("Migros · 42.50 CHF");
    expect(titreDe(mettreALaCorbeille("couple", { id: "c", type: "compte", titre: "Vacances" } as { id: string }, { maintenant: T0, par: null }))).toBe("Compte à rebours « Vacances »");
    const ligne = { id: "k", type: "carnet", titre: "Concierge", valeur: "M. Rossi", creeLe: "2026-10-01T00:00:00.000Z" };
    expect(meriteLaCorbeille("maison", ligne, T0)).toBe(true);
    expect(titreDe(mettreALaCorbeille("maison", ligne, { maintenant: T0, par: null }))).toBe("Carnet : Concierge");
    expect(titreDe(mettreALaCorbeille("memoire", { id: "s", texte: "Le code du garage est 1234" } as { id: string }, { maintenant: T0, par: null }))).toBe("Le code du garage est 1234");
  });

  it("dit qui a effacé, et quand", () => {
    const e = mettreALaCorbeille("taches", tache, { maintenant: "2026-10-20T08:00:00.000Z", par: "m2" });
    expect(decrireEffacement(e, foyer, T0)).toBe("Effacé par Sarah il y a 2 h");
    expect(decrireEffacement({ ...e, effacePar: null }, foyer, T0)).toBe("Effacé il y a 2 h");
  });
});
