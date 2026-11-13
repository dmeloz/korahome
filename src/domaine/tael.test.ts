import { describe, expect, it } from "vitest";
import { ajouterAuJournal, attendUnOui, elaguerJournal, journalDuJour, marquerAnnulee, nettoyerNiveau, peutAgir, refusDObserver, salutation, titreNiveau, type LigneJournalTael } from "./tael";

const ligne = (id: string, quand: string): LigneJournalTael => ({ id, quand, texte: id });
const jourLocal = (iso: string) => iso.slice(0, 10);

describe("le niveau de Tael", () => {
  it("vaut « elle propose » quand rien n'est réglé ou que la valeur est inconnue", () => {
    expect(nettoyerNiveau(null)).toBe("propose");
    expect(nettoyerNiveau("tout")).toBe("propose");
    expect(nettoyerNiveau("agit")).toBe("agit");
    expect(titreNiveau("observe")).toBe("Elle observe");
  });

  it("fait attendre un oui quand elle propose, laisse passer quand elle agit, sauf ce qui supprime", () => {
    expect(attendUnOui("propose", false)).toBe(true);
    expect(attendUnOui("agit", false)).toBe(false);
    expect(attendUnOui("agit", true)).toBe(true);
    expect(peutAgir("observe")).toBe(false);
    expect(peutAgir("propose")).toBe(true);
  });
});

describe("quand elle observe", () => {
  it("dit ce qu'elle n'a pas fait, et comment la laisser faire", () => {
    const dit = refusDObserver(["Courses : lait et œufs", "Nouvelle tâche : Linge, samedi 14 nov."]);
    expect(dit).toContain("Je n'ai touché à rien");
    expect(dit).toContain("Courses : lait et œufs ; Nouvelle tâche : Linge, samedi 14 nov.");
    expect(dit).toContain("garde le doigt sur mon orbe");
  });

  it("ne dit rien quand on ne lui demandait aucune action", () => {
    expect(refusDObserver([])).toBe("");
  });
});

describe("le journal de Tael", () => {
  it("garde la ligne la plus récente en tête, sans doublon, et montre le jour demandé", () => {
    let journal = ajouterAuJournal([], ligne("a", "2026-11-04T08:00:00.000Z"));
    journal = ajouterAuJournal(journal, ligne("b", "2026-11-04T12:05:00.000Z"));
    journal = ajouterAuJournal(journal, ligne("a", "2026-11-04T18:40:00.000Z"));
    journal = ajouterAuJournal(journal, ligne("c", "2026-11-03T18:40:00.000Z"));
    expect(journal.map((l) => l.id)).toEqual(["c", "a", "b"]);
    expect(journalDuJour(journal, "2026-11-04", jourLocal).map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("marque une ligne annulée et oublie les lignes de plus de sept jours", () => {
    const journal = [ligne("vieille", "2026-10-20T08:00:00.000Z"), ligne("hier", "2026-11-03T08:00:00.000Z")];
    expect(marquerAnnulee(journal, "hier")[1].annulee).toBe(true);
    expect(elaguerJournal(journal, "2026-11-04T09:00:00.000Z").map((l) => l.id)).toEqual(["hier"]);
  });

  it("salue selon l'heure", () => {
    expect(salutation(3)).toBe("Bonne nuit");
    expect(salutation(9)).toBe("Bonjour");
    expect(salutation(19)).toBe("Bonsoir");
  });
});
