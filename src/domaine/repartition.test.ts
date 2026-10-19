import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { appliquerEtalement, appliquerRepartition, compteRepartition, etalementPropose, proposerRepartition, repartitionDue, tachesDeLaSemaine } from "./repartition";
import { nouvelleTache, tachesDeDepart } from "./taches";

const ctx = contexteTest();
const auj = "2026-10-19";
const semaine = { unite: "semaine", tous: 1 } as const;
const foyer = { id: "f", nom: "Cassa", creeLe: "", membres: [{ id: "melo", prenom: "Melo", couleur: "" }, { id: "sarah", prenom: "Sarah", couleur: "" }] };

describe("étaler les tâches de la semaine", () => {
  it("pose les six tâches de départ sur six jours différents", () => {
    const taches = tachesDeDepart(auj, ctx);
    const etalees = appliquerEtalement(etalementPropose(taches, auj));
    const jours = [...taches.map((t) => etalees.find((e) => e.id === t.id)?.echeance ?? t.echeance)];
    expect(new Set(jours).size).toBe(6);
    expect(jours.every((j) => j >= auj && j <= "2026-10-25")).toBe(true);
  });

  it("ne propose rien quand la semaine est déjà étalée", () => {
    const taches = [nouvelleTache("Linge", semaine, auj, ctx), nouvelleTache("Ménage", semaine, "2026-10-22", ctx)];
    expect(etalementPropose(taches, auj)).toEqual([]);
  });

  it("garde le jour d'une tâche seule, et évite les jours déjà pris par une autre tâche", () => {
    const unique = nouvelleTache("Dentiste à appeler", null, "2026-10-20", ctx);
    const taches = [nouvelleTache("Linge", semaine, auj, ctx), nouvelleTache("Ménage", semaine, auj, ctx), unique];
    const changements = etalementPropose(taches, auj);
    expect(changements.map((c) => [c.tache.titre, c.echeance])).toEqual([["Ménage", "2026-10-21"]]);
  });
});

describe("se répartir la semaine", () => {
  it("se propose le dimanche, une fois, à deux", () => {
    const taches = [nouvelleTache("Linge", semaine, "2026-10-20", ctx)];
    expect(repartitionDue(foyer, taches, "2026-10-25", null)).toBe(true);
    expect(repartitionDue(foyer, taches, "2026-10-25", "2026-10-25")).toBe(false);
    expect(repartitionDue(foyer, taches, auj, null)).toBe(false);
    expect(repartitionDue({ ...foyer, membres: [foyer.membres[0]] }, taches, "2026-10-25", null)).toBe(false);
  });

  it("partage à parts égales, en alternant avec la dernière fois", () => {
    const linge = { ...nouvelleTache("Linge", semaine, "2026-10-20", ctx), faitePar: "melo" };
    const menage = nouvelleTache("Ménage", semaine, "2026-10-21", ctx);
    const prise = { ...nouvelleTache("Courses", semaine, "2026-10-22", ctx), responsable: "melo" };
    const plusTard = nouvelleTache("Vitres", null, "2026-11-20", ctx);
    const taches = [linge, menage, prise, plusTard];
    const choix = proposerRepartition(taches, foyer, auj);
    expect(tachesDeLaSemaine(taches, auj).map((t) => t.titre)).toEqual(["Linge", "Ménage", "Courses"]);
    expect(choix.get(prise.id)).toBe("melo");
    expect(choix.get(linge.id)).toBe("sarah");
    expect(compteRepartition(choix, foyer)).toMatch(/Melo [12] · Sarah [12]/);
    const changees = appliquerRepartition(taches, choix);
    expect(changees.every((t) => t.responsable !== null)).toBe(true);
    expect(changees.find((t) => t.id === prise.id)).toBeUndefined();
  });
});
