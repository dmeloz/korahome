import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLES, ecrireJson, ecrireTexte, effacer, effacerPrefixe, lireJson, lireTexte } from "./stockageLocal";

// Un faux localStorage sur globalThis (les tests tournent sous Node, sans navigateur).
class FauxStockage {
  donnees = new Map<string, string>();
  get length() {
    return this.donnees.size;
  }
  getItem(cle: string) {
    return this.donnees.get(cle) ?? null;
  }
  setItem(cle: string, valeur: string) {
    this.donnees.set(cle, String(valeur));
  }
  removeItem(cle: string) {
    this.donnees.delete(cle);
  }
  key(i: number) {
    return [...this.donnees.keys()][i] ?? null;
  }
  clear() {
    this.donnees.clear();
  }
}

/** Le stockage en navigation privée ou plein : tout lève. */
const enPanne = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
  removeItem() {
    throw new Error("SecurityError");
  },
};

const g = globalThis as { localStorage?: unknown };

function poser(stockage: unknown) {
  Object.defineProperty(globalThis, "localStorage", { value: stockage, configurable: true, writable: true });
}

let faux: FauxStockage;
beforeEach(() => {
  faux = new FauxStockage();
  poser(faux);
});
afterEach(() => {
  delete g.localStorage;
});

describe("stockageLocal", () => {
  it("lit et écrit du texte", () => {
    expect(lireTexte("k")).toBeNull();
    expect(ecrireTexte("k", "1")).toBe(true);
    expect(lireTexte("k")).toBe("1");
    expect(effacer("k")).toBe(true);
    expect(lireTexte("k")).toBeNull();
  });

  it("lit et écrit du JSON, avec la valeur par défaut si la clé manque ou est illisible", () => {
    expect(lireJson("j", [1])).toEqual([1]);
    expect(ecrireJson("j", { a: 2 })).toBe(true);
    expect(faux.getItem("j")).toBe('{"a":2}');
    expect(lireJson("j", null)).toEqual({ a: 2 });
    faux.setItem("j", "{pas du json");
    expect(lireJson("j", "défaut")).toBe("défaut");
    faux.setItem("j", "");
    expect(lireJson("j", null)).toBeNull();
    // « null » écrit est une valeur, pas une absence.
    faux.setItem("j", "null");
    expect(lireJson("j", [] as unknown)).toBeNull();
  });

  it("efface les clés d'un préfixe, et elles seules", () => {
    // Dans un navigateur, Object.keys(localStorage) rend les clés gardées : on l'imite.
    const stockage: Record<string, string> = { [CLES.prefixeAide + "courses"]: "1", [CLES.prefixeAide + "jardin"]: "1", [CLES.theme]: "clair" };
    Object.defineProperty(stockage, "removeItem", { value: (cle: string) => delete stockage[cle], enumerable: false });
    poser(stockage);
    effacerPrefixe(CLES.prefixeAide);
    expect(Object.keys(stockage)).toEqual([CLES.theme]);
  });

  it("avale les erreurs d'un stockage en panne et rend les replis", () => {
    poser(enPanne);
    expect(lireTexte("k")).toBeNull();
    expect(lireTexte("k", "1")).toBe("1");
    expect(lireTexte("k", false)).toBe(false);
    expect(lireJson("k", { depart: true })).toEqual({ depart: true });
    expect(ecrireTexte("k", "v")).toBe(false);
    expect(ecrireJson("k", [1])).toBe(false);
    expect(effacer("k")).toBe(false);
    expect(() => effacerPrefixe("korahome.")).not.toThrow();
  });

  it("sans localStorage du tout (Node), rien ne lève", () => {
    delete g.localStorage;
    expect(lireTexte("k")).toBeNull();
    expect(lireJson("k", 3)).toBe(3);
    expect(ecrireTexte("k", "v")).toBe(false);
    expect(() => effacerPrefixe("korahome.")).not.toThrow();
  });

  it("ne refuse pas une valeur impossible à écrire en JSON", () => {
    const boucle: Record<string, unknown> = {};
    boucle.moi = boucle;
    expect(ecrireJson("k", boucle)).toBe(false);
  });

  it("garde le texte exact des clés déjà sur les téléphones", () => {
    const toutes = Object.values(CLES);
    expect(new Set(toutes).size).toBe(toutes.length);
    expect(toutes.every((c) => c.startsWith("korahome."))).toBe(true);
    expect(CLES.taillesWidgets).toBe("korahome.taillesWidgets.2");
    expect(CLES.placeFee).toBe("korahome.fee");
    expect(CLES.pastilleDev).toBe("korahome.coinDev");
    expect(CLES.decisionsPerso).toBe("korahome.appris");
  });
});
