import { readdirSync, readFileSync } from "node:fs";
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

describe("les appels à Claude", () => {
  // Le 27 octobre 2026, le conseiller budget forçait son outil : les modèles 5.5 répondent 400.
  for (const nom of readdirSync(new URL("../supabase/functions/", import.meta.url)).filter((n) => !n.startsWith("_"))) {
    it(`« ${nom} » ne force jamais un outil (tool_choice « tool » ou « any »)`, () => {
      let source = "";
      try {
        source = readFileSync(new URL(`../supabase/functions/${nom}/index.ts`, import.meta.url), "utf8");
      } catch {
        return;
      }
      expect(source).not.toMatch(/tool_choice\s*:\s*\{\s*type\s*:\s*"(tool|any)"/);
    });
  }
});
