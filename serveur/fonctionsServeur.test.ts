import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { construireDomaine, FONCTIONS } from "../scripts/domaine-fonction.mjs";

describe("les fonctions serveur", () => {
  for (const nom of FONCTIONS) {
    it(`« ${nom} » embarque les règles à jour (sinon : npm run fonction, puis redéployer)`, async () => {
      const embarque = readFileSync(new URL(`../supabase/functions/${nom}/domaine.js`, import.meta.url), "utf8");
      expect(embarque).toBe(await construireDomaine(nom));
    });
  }
});
