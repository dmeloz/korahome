import { describe, expect, it } from "vitest";
import { expliquerErreur } from "./erreurs";
import { ErreurValidation } from "./foyer";

describe("les erreurs qui disent quoi faire", () => {
  it("garde la phrase d'une règle du métier", () => {
    expect(expliquerErreur(new ErreurValidation("La liste doit avoir un nom."))).toBe("La liste doit avoir un nom.");
  });
  it("reconnaît le réseau, la place, le partage expiré et le plafond", () => {
    expect(expliquerErreur(new TypeError("Failed to fetch"), "Le mot")).toMatch(/^Le mot attend le réseau/);
    expect(expliquerErreur(new Error("x"), "Enregistrer", true)).toMatch(/attend le réseau/);
    expect(expliquerErreur(new DOMException("exceeded", "QuotaExceededError"))).toMatch(/manque de place/);
    expect(expliquerErreur(new Error("Connexion requise"))).toMatch(/Réglages › Partage/);
    expect(expliquerErreur(new Error("Plafond du mois atteint"))).toMatch(/plafond/);
    expect(expliquerErreur(new Error("429 rate limit"))).toMatch(/dans une minute/);
  });
  it("sinon dit ce qu'on faisait, le détail court, et où le noter", () => {
    expect(expliquerErreur(new Error("boum"), "Enregistrer")).toBe("Enregistrer n'a pas marché (boum). Réessaie ; si ça revient, note-le par la pastille Dev pour qu'on le corrige.");
    expect(expliquerErreur(undefined)).toMatch(/^Ça n'a pas marché\. Réessaie/);
  });
});
