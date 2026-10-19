import { describe, expect, it } from "vitest";
import { basculerCoeur, nouveauCoeur, nouveauMot, type DocCouple } from "./bandeau";
import { contexteTest } from "./contexteTest";
import { arriveesDuCouple, attentesDuCouple, autreMembre, feeDe, feeDeLAutre, phraseAttente, vuesAGarder } from "./fee";
import { creerFoyer } from "./foyer";

const MAINTENANT = "2026-10-19T18:00:00.000Z";

function foyer() {
  const ctx = contexteTest("2026-10-19T17:00:00.000Z");
  const f = creerFoyer("Cassa", ["Melo", "Sarah"], ctx);
  return { ctx, f, melo: f.membres[0].id, sarah: f.membres[1].id };
}

describe("la fée de chacun", () => {
  it("Tael pour Dany, Navi pour Sarah", () => {
    expect(feeDe("D.")).toEqual({ nom: "Tael", teinte: "violette", ailes: "pointues" });
    expect(feeDe("Melo").nom).toBe("Tael");
    expect(feeDe("Sarah")).toEqual({ nom: "Navi", teinte: "bleue", ailes: "rondes" });
  });

  it("sans prénom connu, c'est Tael", () => {
    expect(feeDe(null).nom).toBe("Tael");
    expect(feeDe("Alex").nom).toBe("Tael");
  });

  it("la fée de l'autre n'est jamais la mienne", () => {
    expect(feeDeLAutre("Sarah", "Melo").nom).toBe("Tael");
    expect(feeDeLAutre("Alex", "Melo").nom).toBe("Navi");
    expect(feeDeLAutre("Sarah", "Sacha").nom).toBe("Tael");
  });

  it("trouve l'autre membre du foyer", () => {
    const { f, melo, sarah } = foyer();
    expect(autreMembre(f, melo)?.id).toBe(sarah);
    expect(autreMembre({ membres: [f.membres[0]] }, melo)).toBeNull();
  });
});

describe("ce qui attend au-dessus de la fée", () => {
  it("un mot de l'autre attend en message, un cœur seul en cœur", () => {
    const { ctx, melo, sarah } = foyer();
    const docs: DocCouple[] = [nouveauMot("J'ai pris le pain", sarah, ctx), nouveauCoeur(sarah, ctx)];
    const a = attentesDuCouple(docs, melo, MAINTENANT, new Set());
    expect(a.map((x) => x.sorte)).toEqual(["message", "coeur"]);
    expect(phraseAttente(a[0], "Sarah")).toBe("J'ai pris le pain");
    expect(phraseAttente(a[1], "Sarah")).toBe("Sarah t'envoie un cœur.");
  });

  it("mes propres mots n'attendent pas, sauf le cœur que l'autre y a mis", () => {
    const { ctx, melo, sarah } = foyer();
    const mien = nouveauMot("Bonne journée", melo, ctx);
    expect(attentesDuCouple([mien], melo, MAINTENANT, new Set())).toEqual([]);
    const aime = basculerCoeur(mien, sarah);
    const [a] = attentesDuCouple([aime], melo, MAINTENANT, new Set());
    expect(a.sorte).toBe("coeur");
    expect(a.de).toBe(sarah);
    expect(phraseAttente(a, "Sarah")).toBe("Sarah aime ton mot : « Bonne journée »");
  });

  it("une icône par sorte, la plus ancienne d'abord ; vue, la suivante prend sa place", () => {
    const { ctx, melo, sarah } = foyer();
    const un = { ...nouveauMot("Un", sarah, ctx), visibleDes: "2026-10-19T08:00:00.000Z" };
    const deux = { ...nouveauMot("Deux", sarah, ctx), visibleDes: "2026-10-19T09:00:00.000Z" };
    const [premiere] = attentesDuCouple([deux, un], melo, MAINTENANT, new Set());
    expect(premiere.mot.texte).toBe("Un");
    const [suivante] = attentesDuCouple([deux, un], melo, MAINTENANT, new Set([premiere.cle]));
    expect(suivante.mot.texte).toBe("Deux");
  });

  it("un mot programmé n'attend qu'à son heure, et un vieux mot ne revient plus", () => {
    const { ctx, melo, sarah } = foyer();
    const plusTard = nouveauMot("Ce soir", sarah, ctx, "2026-10-19T20:00:00.000Z");
    const vieux = { ...nouveauMot("Lundi", sarah, ctx), visibleDes: "2026-10-15T08:00:00.000Z" };
    expect(attentesDuCouple([plusTard, vieux], melo, MAINTENANT, new Set())).toEqual([]);
    expect(attentesDuCouple([plusTard], melo, "2026-10-19T20:00:00.000Z", new Set())).toHaveLength(1);
  });

  it("sans personne sur ce téléphone, rien n'attend", () => {
    const { ctx, sarah } = foyer();
    expect(arriveesDuCouple([nouveauMot("Coucou", sarah, ctx)], null, MAINTENANT)).toEqual([]);
  });

  it("ne garde que les clés vues encore utiles", () => {
    const { ctx, melo, sarah } = foyer();
    const m = nouveauMot("Coucou", sarah, ctx);
    expect(vuesAGarder(new Set([`mot:${m.id}`, "mot:ancien"]), [m], melo, MAINTENANT)).toEqual([`mot:${m.id}`]);
  });
});
