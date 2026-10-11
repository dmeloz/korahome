import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { noterAchat, oublierAchat, suggestions } from "./habitudes";
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
