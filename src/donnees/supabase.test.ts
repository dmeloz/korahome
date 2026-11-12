import { describe, expect, it } from "vitest";
import { traduireErreur } from "./supabase";

describe("les erreurs du serveur, dites à la personne", () => {
  it("dit de rejoindre avec le code quand le serveur est réservé à son foyer (0.1.15)", () => {
    expect(traduireErreur("Serveur réservé à son foyer")).toMatch(/tape son code/);
  });

  it("garde les messages qu'elle ne connaît pas", () => {
    expect(traduireErreur("Autre chose")).toBe("Autre chose");
  });
});
