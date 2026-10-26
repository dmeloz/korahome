import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLLECTIONS, DONNEES_SAUVEGARDEES, estCollection, NOMS_COLLECTIONS } from "./collections";
import { COLLECTIONS_CORBEILLE } from "./corbeille";

// La liste que le serveur accepte : la dernière contrainte `documents_collection_check` écrite.
function collectionsDuServeur(sql: string): string[] {
  const contraintes = [...sql.matchAll(/documents_collection_check\s+check \(collection in \(([^)]*)\)\)/g)];
  return contraintes.at(-1)![1].split(",").map((c) => c.trim().replace(/'/g, ""));
}

describe("le registre des collections", () => {
  it("donne à chaque collection un nom et un nom de lecture uniques", () => {
    expect(new Set(NOMS_COLLECTIONS).size).toBe(COLLECTIONS.length);
    expect(new Set(COLLECTIONS.map((c) => c.donnees)).size).toBe(COLLECTIONS.length);
  });

  it("est exactement ce que le serveur accepte, dans le schéma complet et dans la dernière migration", () => {
    const schema = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
    expect(collectionsDuServeur(schema).sort()).toEqual([...NOMS_COLLECTIONS].sort());
    const dossier = new URL("../../supabase/migrations/", import.meta.url);
    const migrations = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();
    const sql = migrations.map((f) => readFileSync(new URL(f, dossier), "utf8")).join("\n");
    expect(collectionsDuServeur(sql).sort()).toEqual([...NOMS_COLLECTIONS].sort());
  });

  it("sauvegarde tout sauf le foyer (à part) et la corbeille", () => {
    expect(DONNEES_SAUVEGARDEES).not.toContain("foyer");
    expect(DONNEES_SAUVEGARDEES).not.toContain("corbeille");
    expect(DONNEES_SAUVEGARDEES).toHaveLength(COLLECTIONS.length - 2);
  });

  it("connaît chaque collection qui passe par la corbeille", () => {
    for (const c of COLLECTIONS_CORBEILLE) expect(estCollection(c)).toBe(true);
    expect(estCollection("attente")).toBe(false);
  });
});
