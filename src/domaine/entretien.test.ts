import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { derniereFois, entretiensAProposer, ENTRETIENS_PROPOSES, nouvelEntretien, organiserEntretien } from "./entretien";
import { marquerFaite, nouvelleTache, organiserTaches } from "./taches";

const AUJOURDHUI = "2026-10-12";

describe("l'entretien de la maison", () => {
  it("crée un geste qui revient, à faire dans une semaine", () => {
    const t = nouvelEntretien(ENTRETIENS_PROPOSES[3], AUJOURDHUI, contexteTest());
    expect(t).toMatchObject({ titre: "Nettoyer le frigo", recurrence: { unite: "mois", tous: 3 }, echeance: "2026-10-19", categorie: "entretien" });
  });

  it("ne propose plus ce qui est déjà suivi", () => {
    const t = nouvelEntretien(ENTRETIENS_PROPOSES[0], AUJOURDHUI, contexteTest());
    expect(entretiensAProposer([t])).toHaveLength(ENTRETIENS_PROPOSES.length - 1);
  });

  it("range le plus pressé d'abord, et repart après avoir été fait", () => {
    const ctx = contexteTest();
    const frigo = nouvelEntretien(ENTRETIENS_PROPOSES[3], AUJOURDHUI, ctx);
    const radiateurs = { ...nouvelEntretien(ENTRETIENS_PROPOSES[9], AUJOURDHUI, ctx), echeance: "2026-10-01" };
    const ordinaire = nouvelleTache("Courses", null, AUJOURDHUI, ctx);
    const lignes = organiserEntretien([frigo, radiateurs, ordinaire], AUJOURDHUI);
    expect(lignes.map((l) => [l.tache.titre, l.quand, l.du])).toEqual([
      ["Purger les radiateurs", "en retard de 11 jours", true],
      ["Nettoyer le frigo", "dans 7 jours", true],
    ]);
    const fait = marquerFaite(frigo, null, AUJOURDHUI, ctx);
    expect(fait.echeance).toBe("2027-01-19");
    expect(organiserEntretien([fait], AUJOURDHUI)[0].du).toBe(false);
  });

  it("n'encombre la liste des tâches que la semaine où il est dû", () => {
    const ctx = contexteTest();
    const bientot = nouvelEntretien(ENTRETIENS_PROPOSES[3], AUJOURDHUI, ctx);
    const loin = { ...nouvelEntretien(ENTRETIENS_PROPOSES[4], AUJOURDHUI, ctx), echeance: "2027-03-01" };
    const titres = organiserTaches([bientot, loin], AUJOURDHUI).groupes.flatMap((g) => g.taches.map((t) => t.titre));
    expect(titres).toEqual(["Nettoyer le frigo"]);
  });
});

describe("depuis combien de temps", () => {
  it("dit la dernière fois, discrètement, ou rien", () => {
    const ctx = contexteTest();
    const t = nouvelEntretien(ENTRETIENS_PROPOSES[0], "2026-10-26", ctx);
    expect(derniereFois(t, "2026-10-26")).toBeNull();
    const fait = { ...t, historique: [{ le: "2026-07-01", par: null, retard: 0 }, { le: "2026-10-13", par: null, retard: 2 }] };
    expect(derniereFois(fait, "2026-10-26")).toBe("fait il y a 13 jours");
    expect(derniereFois(fait, "2026-10-14")).toBe("fait hier");
    expect(derniereFois(fait, "2027-01-20")).toBe("fait il y a 3 mois");
    expect(organiserEntretien([fait], "2026-10-26")[0].depuis).toBe("fait il y a 13 jours");
  });
});
