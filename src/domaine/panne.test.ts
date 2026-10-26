import { describe, expect, it } from "vitest";
import { noteServeur, panneASignaler, phrasePanne } from "./panne";

const ctx = { maintenant: () => "2026-10-27T01:00:00.000Z" };
const erreurApi = (status: number, message: string) => Object.assign(new Error(message), { status });

describe("panne de l'assistant", () => {
  it("signale un refus de l'API, pas l'affluence ni la limite du compte", () => {
    expect(panneASignaler(erreurApi(400, "compiled grammar is too large"))).toBe(true);
    expect(panneASignaler(erreurApi(401, "invalid x-api-key"))).toBe(true);
    expect(panneASignaler(new Error("Cannot read properties of undefined"))).toBe(true);
    expect(panneASignaler(erreurApi(429, "rate limited"))).toBe(false);
    expect(panneASignaler(erreurApi(529, "overloaded"))).toBe(false);
    expect(panneASignaler(erreurApi(400, "You have reached your specified API usage limits."))).toBe(false);
  });

  it("écrit une seule note par fonction et par jour, avec le statut et le début du message", () => {
    const note = noteServeur("Le Chef", erreurApi(400, "compiled   grammar\nis too large"), "2026-10-27", ctx);
    expect(note).toMatchObject({
      id: "serveur-le-chef-2026-10-27",
      genre: "bug",
      ecran: "Serveur · Le Chef",
      version: "serveur",
      auteur: null,
      regleLe: null,
      creeLe: "2026-10-27T01:00:00.000Z",
    });
    expect(note?.texte).toContain("statut 400 : compiled grammar is too large");
    expect(noteServeur("Jarvis", erreurApi(500, "x".repeat(900)), "2026-10-27", ctx)!.texte.length).toBeLessThan(420);
  });

  it("n'écrit rien pour ce qui n'est pas une panne", () => {
    expect(noteServeur("Jarvis", erreurApi(429, "rate limited"), "2026-10-27", ctx)).toBeNull();
  });

  it("dit à la personne que Claude est prévenu", () => {
    expect(phrasePanne("Jarvis")).toBe("Jarvis a un souci de son côté. Claude est prévenu ; réessaie un peu plus tard.");
  });
});
