import { describe, expect, it } from "vitest";
import {
  afficherCode,
  ALPHABET_CODE,
  curseurAvecMarge,
  decrireDerniereSynchro,
  distantGagne,
  fusionnerDocuments,
  memeContenu,
  normaliserCode,
  rapprocher,
  type Changement,
  type EnAttente,
} from "./synchro";

const ch = (id: string, maj: string, donnees: unknown = { id }, collection: Changement["collection"] = "elements"): Changement => ({
  collection,
  id,
  donnees,
  maj: `2026-10-09T10:${maj}:00.000Z`,
});

describe("synchro : deux versions d'un document se rejoignent", () => {
  const base = { id: "mitsu", nom: "Mitsu", poids: 4.2, soins: [{ id: "vaccin", fait: false }, { id: "vermifuge", fait: false }] };

  it("ce que chacun a touché de son côté est gardé", () => {
    const mien = { ...base, poids: 4.4 };
    const leur = { ...base, nom: "Mitsuko" };
    expect(fusionnerDocuments(base, mien, leur, "leur")).toEqual({ ...base, nom: "Mitsuko", poids: 4.4 });
  });

  it("le même champ touché des deux côtés : le côté préféré gagne, le reste est gardé", () => {
    const mien = { ...base, poids: 4.4, nom: "Mimi" };
    const leur = { ...base, poids: 4.5 };
    expect(fusionnerDocuments(base, mien, leur, "leur")).toEqual({ ...base, poids: 4.5, nom: "Mimi" });
    expect(fusionnerDocuments(base, mien, leur, "mien")).toEqual({ ...base, poids: 4.4, nom: "Mimi" });
  });

  it("dans une liste, chaque élément se rejoint par son identifiant", () => {
    const mien = { ...base, soins: [{ id: "vaccin", fait: true }, { id: "vermifuge", fait: false }, { id: "griffes", fait: false }] };
    const leur = { ...base, soins: [{ id: "vermifuge", fait: true }, { id: "vaccin", fait: false }, { id: "puce", fait: true }] };
    expect(fusionnerDocuments(base, mien, leur, "leur")).toEqual({
      ...base,
      soins: [{ id: "vermifuge", fait: true }, { id: "vaccin", fait: true }, { id: "puce", fait: true }, { id: "griffes", fait: false }],
    });
  });

  it("ce que l'un retire est retiré, sauf si l'autre l'a retouché", () => {
    const sansVaccin = { ...base, soins: [{ id: "vermifuge", fait: false }] };
    expect(fusionnerDocuments(base, sansVaccin, { ...base, poids: 5 }, "leur")).toEqual({ ...sansVaccin, poids: 5 });
    const vaccinFait = { ...base, soins: [{ id: "vaccin", fait: true }, { id: "vermifuge", fait: false }] };
    expect(fusionnerDocuments(base, sansVaccin, { ...vaccinFait, poids: 5 }, "leur")).toEqual({ ...vaccinFait, poids: 5 });
    const { poids: _poids, ...sansPoids } = base;
    expect(fusionnerDocuments(base, sansPoids, { ...base, nom: "Mimi" }, "leur")).toEqual({ ...sansPoids, nom: "Mimi" });
  });

  it("un champ vide compte comme absent, et l'ordre des champs ne compte pas", () => {
    expect(memeContenu({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(memeContenu({ a: 1, b: [1, { c: null }] }, { b: [1, { c: null }], a: 1 })).toBe(true);
    expect(memeContenu({ a: null }, {})).toBe(false);
    expect(memeContenu([1, 2], [2, 1])).toBe(false);
  });

  it("une liste sans identifiants ne se mélange pas : un côté entier est gardé", () => {
    expect(fusionnerDocuments({ t: ["a"] }, { t: ["a", "b"] }, { t: ["a", "c"] }, "mien")).toEqual({ t: ["a", "b"] });
  });
});

describe("synchro : une modification en attente rencontre la version du serveur", () => {
  const lait = { id: "lait", texte: "Lait", coche: false, quantite: null };
  const attente = (maj: string, donnees: unknown, base?: unknown): EnAttente => ({ ...ch("lait", maj, donnees), ...(base === undefined ? {} : { base }) });

  it("à égalité, la version du serveur gagne", () => {
    expect(distantGagne(ch("lait", "05", "ici"), ch("lait", "05", "serveur"))).toBe(true);
    expect(distantGagne(undefined, ch("lait", "05"))).toBe(true);
  });

  it("sans base connue, la plus récente gagne en entier", () => {
    const local = attente("05", { ...lait, coche: true });
    expect(rapprocher(local, ch("lait", "01", { ...lait, quantite: "2 l" }))).toEqual({ donnees: local.donnees, enAttente: local });
    const distant = ch("lait", "07", null);
    expect(rapprocher(local, distant)).toEqual({ donnees: null, enAttente: null });
  });

  it("avec sa base, les deux retouches restent et la réunion repart juste après l'heure du serveur", () => {
    const local = attente("05", { ...lait, coche: true }, lait);
    const distant = ch("lait", "07", { ...lait, quantite: "2 l" });
    const { donnees, enAttente } = rapprocher(local, distant);
    expect(donnees).toEqual({ ...lait, coche: true, quantite: "2 l" });
    expect(enAttente).toEqual({ collection: "elements", id: "lait", donnees, base: distant.donnees, maj: "2026-10-09T10:07:00.001Z" });
  });

  it("le serveur dit déjà la même chose : plus rien à envoyer", () => {
    const local = attente("05", { ...lait, coche: true }, lait);
    expect(rapprocher(local, ch("lait", "03", { ...lait, coche: true }))).toEqual({ donnees: local.donnees, enAttente: null });
  });

  it("une horloge en retard ne fait pas perdre la modification : le serveur n'a pas bougé depuis la base", () => {
    const vu = { ...lait, quantite: "2 l" };
    const local = attente("02", { ...vu, coche: true }, vu);
    const { donnees, enAttente } = rapprocher(local, ch("lait", "07", vu));
    expect(donnees).toEqual({ ...vu, coche: true });
    expect(enAttente?.maj).toBe("2026-10-09T10:07:00.001Z");
  });

  it("une suppression faite en connaissant la version du serveur tient ; sinon la retouche de l'autre la sauve", () => {
    expect(rapprocher(attente("02", null, lait), ch("lait", "07", lait))).toMatchObject({ donnees: null, enAttente: { donnees: null } });
    const retouche = { ...lait, quantite: "2 l" };
    expect(rapprocher(attente("02", null, lait), ch("lait", "07", retouche))).toEqual({ donnees: retouche, enAttente: null });
  });

  it("créé des deux côtés sous le même identifiant : les champs de chacun sont réunis", () => {
    const local = attente("05", { id: "repas-2026-11-11", plat: "Raclette" }, null);
    const { donnees } = rapprocher(local, ch("repas-2026-11-11", "03", { id: "repas-2026-11-11", note: "chez Léa" }));
    expect(donnees).toEqual({ id: "repas-2026-11-11", plat: "Raclette", note: "chez Léa" });
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
