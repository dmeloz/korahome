import { describe, expect, it } from "vitest";
import { ajouterRappel, grouperParJour, nettoyerJournal, nonLus, toutLu } from "./centreRappels";
import { decrireEtatPartage, ilYA } from "./etatPartage";

const auj = "2026-10-19";

describe("le centre des rappels", () => {
  it("garde le plus récent d'abord, et un seul rappel du matin par jour", () => {
    let j = ajouterRappel([], { le: "2026-10-19T06:00:00.000Z", titre: "Bonjour Melo", corps: "Linge", genre: "rappel-du-matin" }, auj);
    j = ajouterRappel(j, { le: "2026-10-19T09:00:00.000Z", titre: "Sarah", corps: "Je t'aime", genre: "mot" }, auj);
    j = ajouterRappel(j, { le: "2026-10-19T06:05:00.000Z", titre: "Bonjour Melo", corps: "Linge, ménage", genre: "rappel-du-matin" }, auj);
    expect(j.map((r) => r.corps)).toEqual(["Je t'aime", "Linge, ménage"]);
    expect(nonLus(j)).toBe(2);
    expect(nonLus(toutLu(j))).toBe(0);
  });

  it("oublie ce qui a plus d'un mois et ce qui est abîmé", () => {
    const j = nettoyerJournal([{ le: "2026-09-01T06:00:00.000Z", titre: "Vieux", corps: "" }, { titre: "sans date" }, null, { le: "2026-10-18T06:00:00.000Z", titre: "Hier" }], auj);
    expect(j).toEqual([{ le: "2026-10-18T06:00:00.000Z", titre: "Hier", corps: "", genre: "rappel" }]);
    expect(nettoyerJournal("rien", auj)).toEqual([]);
  });

  it("range par jour avec des titres simples", () => {
    const j = nettoyerJournal(
      [
        { le: "2026-10-19T06:00:00.000Z", titre: "a", corps: "", genre: "x" },
        { le: "2026-10-18T06:00:00.000Z", titre: "b", corps: "", genre: "x" },
        { le: "2026-10-12T06:00:00.000Z", titre: "c", corps: "", genre: "x" },
      ],
      auj,
    );
    expect(grouperParJour(j, auj).map((g) => g.titre)).toEqual(["Aujourd'hui", "Hier", "Lundi 12 octobre"]);
  });
});

describe("l'état du partage", () => {
  const base = { disponible: true, etat: "ok" as const, enAttente: 0, derniere: "2026-10-19T17:55:00.000Z", enLigne: true, maintenant: "2026-10-19T18:00:00.000Z" };

  it("dit « À jour » quand tout est parti", () => {
    expect(decrireEtatPartage(base)).toEqual({ ton: "calme", texte: "À jour", detail: "Partagé avec l'autre iPhone il y a 5 min.", horsLigne: false });
  });

  it("compte ce qui attend, hors ligne ou en route", () => {
    expect(decrireEtatPartage({ ...base, enLigne: false, enAttente: 2 })).toMatchObject({ ton: "jour", texte: "2 changements en attente du réseau", horsLigne: true });
    expect(decrireEtatPartage({ ...base, enAttente: 1 })).toMatchObject({ ton: "jour", texte: "1 changement en route" });
    expect(decrireEtatPartage({ ...base, etat: "erreur", enAttente: 3 })).toMatchObject({ ton: "urgent", texte: "Partage en panne" });
  });

  it("reste calme quand le partage n'est pas activé", () => {
    expect(decrireEtatPartage({ ...base, disponible: false }).texte).toBe("Sur ce téléphone");
  });

  it("dit le temps passé en mots", () => {
    expect(ilYA("2026-10-19T18:00:00.000Z", "2026-10-19T18:00:20.000Z")).toBe("à l'instant");
    expect(ilYA("2026-10-19T15:00:00.000Z", "2026-10-19T18:00:00.000Z")).toBe("il y a 3 h");
    expect(ilYA("2026-10-18T15:00:00.000Z", "2026-10-19T18:00:00.000Z")).toBe("hier");
  });
});
