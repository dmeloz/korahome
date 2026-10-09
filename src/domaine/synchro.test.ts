import { describe, expect, it } from "vitest";
import {
  afficherCode,
  ALPHABET_CODE,
  compacter,
  curseurAvecMarge,
  decrireDerniereSynchro,
  distantGagne,
  fusionner,
  normaliserCode,
  type Changement,
} from "./synchro";

const ch = (id: string, maj: string, donnees: unknown = { id }, collection: Changement["collection"] = "elements"): Changement => ({
  collection,
  id,
  donnees,
  maj: `2026-10-09T10:${maj}:00.000Z`,
});

describe("synchro : la modification la plus récente gagne", () => {
  it("compacte en gardant la dernière modification de chaque document", () => {
    const resultat = compacter([ch("lait", "00", "v1"), ch("pain", "01"), ch("lait", "05", "v2"), ch("lait", "03", "v3")]);
    expect(resultat).toHaveLength(2);
    expect(resultat.find((c) => c.id === "lait")?.donnees).toBe("v2");
  });

  it("distingue deux documents de même identifiant dans deux collections", () => {
    expect(compacter([ch("a", "00", 1, "listes"), ch("a", "00", 2, "elements")])).toHaveLength(2);
  });

  it("à égalité, le dernier arrivé l'emporte", () => {
    expect(compacter([ch("lait", "00", "v1"), ch("lait", "00", "v2")])[0].donnees).toBe("v2");
  });

  it("applique ce qui vient de l'autre téléphone quand rien n'attend localement", () => {
    const { aAppliquer, enAttente } = fusionner([], [ch("lait", "00")]);
    expect(aAppliquer).toEqual([ch("lait", "00")]);
    expect(enAttente).toEqual([]);
  });

  it("garde la modification locale plus récente et ignore l'ancienne version distante", () => {
    const local = ch("lait", "05", "coché ici");
    const { aAppliquer, enAttente } = fusionner([local], [ch("lait", "01", "décoché là-bas")]);
    expect(aAppliquer).toEqual([]);
    expect(enAttente).toEqual([local]);
  });

  it("abandonne la modification locale battue par une plus récente", () => {
    const distant = ch("lait", "07", "supprimé là-bas");
    const { aAppliquer, enAttente } = fusionner([ch("lait", "05")], [distant]);
    expect(aAppliquer).toEqual([distant]);
    expect(enAttente).toEqual([]);
  });

  it("à égalité, la version du serveur gagne", () => {
    expect(distantGagne(ch("lait", "05", "ici"), ch("lait", "05", "serveur"))).toBe(true);
    expect(distantGagne(undefined, ch("lait", "05"))).toBe(true);
  });

  it("laisse partir les modifications locales sans rapport", () => {
    const { aAppliquer, enAttente } = fusionner([ch("pain", "05")], [ch("lait", "01")]);
    expect(aAppliquer.map((c) => c.id)).toEqual(["lait"]);
    expect(enAttente.map((c) => c.id)).toEqual(["pain"]);
  });

  it("transporte une suppression comme un document vide", () => {
    const { aAppliquer } = fusionner([], [ch("lait", "09", null)]);
    expect(aAppliquer[0].donnees).toBeNull();
  });
});

describe("code d'invitation", () => {
  it("s'affiche en deux groupes de trois", () => {
    expect(afficherCode("K7QM4P")).toBe("K7Q-M4P");
  });

  it("accepte la saisie en minuscules, avec espace ou tiret", () => {
    expect(normaliserCode("k7q-m4p")).toBe("K7QM4P");
    expect(normaliserCode(" k7q m4p ")).toBe("K7QM4P");
  });

  it("refuse ce qui ne peut pas être un code", () => {
    expect(normaliserCode("K7Q")).toBeNull();
    expect(normaliserCode("K7Q-M4PX")).toBeNull();
    expect(normaliserCode("K7Q-M4O")).toBeNull();
  });

  it("n'utilise aucun caractère qu'on confond", () => {
    for (const c of "O0IL1") expect(ALPHABET_CODE).not.toContain(c);
  });
});

describe("curseur de lecture", () => {
  it("relit quelques secondes avant le dernier passage", () => {
    expect(curseurAvecMarge("2026-10-09T10:00:05.000Z")).toBe("2026-10-09T10:00:00.000Z");
  });

  it("lit tout la première fois", () => {
    expect(curseurAvecMarge(null)).toBeNull();
  });
});

describe("dernière synchronisation", () => {
  const maintenant = "2026-10-09T10:00:00.000Z";
  it("se décrit simplement", () => {
    expect(decrireDerniereSynchro(null, maintenant)).toBe("jamais");
    expect(decrireDerniereSynchro("2026-10-09T09:59:40.000Z", maintenant)).toBe("à l'instant");
    expect(decrireDerniereSynchro("2026-10-09T09:55:00.000Z", maintenant)).toBe("il y a 5 min");
    expect(decrireDerniereSynchro("2026-10-09T07:30:00.000Z", maintenant)).toBe("il y a 2 h");
    expect(decrireDerniereSynchro("2026-10-07T07:30:00.000Z", maintenant)).toBe("le 7 octobre");
  });
});
