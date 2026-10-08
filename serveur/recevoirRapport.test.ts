import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RapportRefuse, TAILLE_MAX, deposerRapport, origineAcceptee } from "./recevoirRapport";

const dossierNeuf = () => join(mkdtempSync(join(tmpdir(), "kora-")), "retours-de-test");

describe("réception des rapports sur le Mac", () => {
  it("écrit le rapport sous un nom daté et met à jour le dernier rapport", () => {
    const dossier = dossierNeuf();
    const nom = deposerRapport(dossier, "# Rapport Kora 0.0.2\n\nUne note.\n", new Date("2026-10-08T14:03:12.000Z"));
    expect(nom).toBe("kora-0.0.2-2026-10-08T14-03-12.md");
    expect(readdirSync(dossier).sort()).toEqual(["dernier-rapport.md", nom]);
    expect(readFileSync(join(dossier, "dernier-rapport.md"), "utf8")).toContain("Une note.");
  });

  it("refuse ce qui n'est pas un rapport Kora", () => {
    expect(() => deposerRapport(dossierNeuf(), "bonjour")).toThrow(RapportRefuse);
    expect(() => deposerRapport(dossierNeuf(), "# Rapport Kora ../../x")).toThrow(RapportRefuse);
  });

  it("refuse un rapport trop volumineux", () => {
    expect(() => deposerRapport(dossierNeuf(), `# Rapport Kora 0.0.2\n${"x".repeat(TAILLE_MAX)}`)).toThrow(/volumineux/);
  });

  it("n'accepte que l'app servie par ce Mac", () => {
    expect(origineAcceptee(undefined, "mac.local:4443")).toBe(true);
    expect(origineAcceptee("https://mac.local:4443", "mac.local:4443")).toBe(true);
    expect(origineAcceptee("https://ailleurs.example", "mac.local:4443")).toBe(false);
    expect(origineAcceptee("n'importe quoi", "mac.local:4443")).toBe(false);
  });
});
