import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import paquet from "../package.json" with { type: "json" };

// Les règles du dépôt lui-même, vérifiées comme le reste.
describe("le dépôt", () => {
  it("a une ligne dans le journal des versions pour la version de package.json", () => {
    const journal = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
    expect(journal).toContain(`| ${paquet.version} |`);
  });
});
