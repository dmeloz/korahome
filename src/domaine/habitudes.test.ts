import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { devinerArticles, noterAchat, oublierAchat, panierHabituel, quantiteHabituelle, suggestions } from "./habitudes";
import { nouvelElement, nouvelleListe } from "./listes";

function preparer() {
  const ctx = contexteTest();
  const liste = nouvelleListe("Courses", "panier", "courses", ctx);
  const lait = nouvelElement(liste, "Lait", null, ctx);
  const lessive = nouvelElement(liste, "Lessive", null, ctx);
  return { ctx, liste, lait, lessive };
}

describe("les courses qui se devinent", () => {
  it("note un achat une fois par jour, et l'oublie si on décoche", () => {
    const { liste, lait } = preparer();
    const une = noterAchat(noterAchat(liste, lait, "2026-10-01"), lait, "2026-10-01");
    expect(une.achats).toEqual([{ texte: "Lait", rayon: "Crèmerie", jours: ["2026-10-01"] }]);
    expect(oublierAchat(une, lait, "2026-10-01").achats).toEqual([]);
  });

  it("propose ce qui revient régulièrement quand son moment approche", () => {
    const { liste, lait, lessive } = preparer();
    let l = liste;
    for (const j of ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]) l = noterAchat(l, lait, j);
    for (const j of ["2026-08-01", "2026-09-01", "2026-10-01"]) l = noterAchat(l, lessive, j);
    expect(suggestions(l, [], "2026-10-08")).toEqual([]);
    expect(suggestions(l, [], "2026-10-11")).toEqual([{ texte: "Lait", rythme: "tous les 7 jours environ" }]);
    expect(suggestions(l, [], "2026-10-30").map((s) => s.texte)).toEqual(["Lait", "Lessive"]);
  });

  it("ne propose pas ce qui est déjà sur la liste ni ce qui a été acheté moins de trois fois", () => {
    const { liste, lait, lessive } = preparer();
    let l = liste;
    for (const j of ["2026-09-21", "2026-09-28", "2026-10-05"]) l = noterAchat(l, lait, j);
    for (const j of ["2026-09-01", "2026-10-01"]) l = noterAchat(l, lessive, j);
    expect(suggestions(l, [lait], "2026-10-20")).toEqual([]);
  });

  it("garde les huit derniers achats de chaque article", () => {
    const { liste, lait } = preparer();
    let l = liste;
    for (let d = 1; d <= 12; d++) l = noterAchat(l, lait, `2026-09-${String(d).padStart(2, "0")}`);
    expect(l.achats![0].jours).toHaveLength(8);
    expect(l.achats![0].jours[0]).toBe("2026-09-05");
  });
});

describe("la saisie qui devine et les courses comme d'habitude", () => {
  it("retient la quantité habituelle et devine les articles déjà achetés", () => {
    const { ctx, liste, lait, lessive } = preparer();
    const deuxLitres = { ...lait, quantite: "2 l" };
    let l = noterAchat(liste, deuxLitres, "2026-10-01");
    l = noterAchat(l, lait, "2026-10-08");
    expect(quantiteHabituelle(l, "lait")).toBe("2 l");
    l = noterAchat(l, lessive, "2026-10-08");
    expect(devinerArticles(l, [], "la").map((a) => a.texte)).toEqual(["Lait"]);
    expect(devinerArticles(l, [nouvelElement(l, "Lait", null, ctx)], "la")).toEqual([]);
    expect(devinerArticles(l, [], "l")).toEqual([]);
  });

  it("trouve le jour des courses et ce qui y est pris presque à chaque fois", () => {
    const { ctx, liste, lait, lessive } = preparer();
    const pain = nouvelElement(liste, "Pain", null, ctx);
    let l = liste;
    for (const j of ["2026-09-26", "2026-10-03", "2026-10-10"]) l = noterAchat(noterAchat(l, lait, j), pain, j);
    l = noterAchat(l, lessive, "2026-10-03");
    const p = panierHabituel(l, [pain]);
    expect(p).toMatchObject({ jour: 6, nomDuJour: "samedi" });
    expect(p?.habituels.map((a) => a.texte)).toEqual(["Lait", "Pain"]);
    expect(p?.articles.map((a) => a.texte)).toEqual(["Lait"]);
    expect(panierHabituel(liste, [])).toBeNull();
  });
});
