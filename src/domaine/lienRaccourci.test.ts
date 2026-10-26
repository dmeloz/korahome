import { describe, expect, it } from "vitest";
import { champJeton, separerLien } from "./lienRaccourci";

describe("le lien d'un raccourci", () => {
  it("sépare l'adresse de la clé", () => {
    expect(separerLien("https://x.supabase.co/functions/v1/siri?j=abc123")).toEqual({ adresse: "https://x.supabase.co/functions/v1/siri", jeton: "abc123" });
    expect(separerLien("https://x.supabase.co/functions/v1/siri")).toEqual({ adresse: "https://x.supabase.co/functions/v1/siri", jeton: null });
  });

  it("met la clé dans le corps JSON", () => {
    expect(champJeton("abc")).toEqual(["- Dans le corps JSON, un champ de type Texte : jeton = abc"]);
    expect(champJeton(null)).toEqual([]);
  });
});
