import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { construireDomaine } from "../scripts/domaine-fonction.mjs";

describe("la fonction serveur des rappels", () => {
  it("embarque les règles à jour (sinon : npm run fonction, puis redéployer)", async () => {
    const embarque = readFileSync(new URL("../supabase/functions/rappels/domaine.js", import.meta.url), "utf8");
    expect(embarque).toBe(await construireDomaine());
  });
});
