import { describe, expect, it } from "vitest";
import { CATALOGUE } from "../domaine/tableauDeBord";
import { MODULES } from "./modules";

describe("modules branchés sur le tableau de bord", () => {
  it("chaque widget disponible a son module, et seulement eux", () => {
    const disponibles = CATALOGUE.filter((w) => w.disponible).map((w) => w.id).sort();
    expect(Object.keys(MODULES).sort()).toEqual(disponibles);
  });

  it("chaque module porte l'identifiant sous lequel il est rangé", () => {
    for (const [cle, module] of Object.entries(MODULES)) expect(module?.id).toBe(cle);
  });
});
