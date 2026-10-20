import { describe, expect, it } from "vitest";
import { filDuFoyer, grouperParJour, quiDe, resumeDuJour } from "./fil";
import type { Element, Tache } from "./types";

const foyer = { membres: [{ id: "melo", prenom: "Melo", couleur: "#000" }, { id: "sarah", prenom: "Sarah", couleur: "#fff" }] };
const MAINTENANT = "2026-10-20T18:00:00.000Z";
const jourLocal = (iso: string) => iso.slice(0, 10);

const tache: Tache = {
  id: "t1", titre: "Litière", recurrence: { unite: "jour", tous: 2 }, echeance: "2026-10-22", responsable: null, faiteLe: "2026-10-20T17:00:00.000Z", faitePar: "sarah", creeLe: "2026-10-01T00:00:00.000Z",
  historique: [
    { le: "2026-10-18", par: "melo", retard: 0, a: "2026-10-18T19:00:00.000Z" },
    { le: "2026-10-20", par: "sarah", retard: 0, a: "2026-10-20T17:00:00.000Z" },
    { le: "2026-10-01", par: "melo", retard: 0, a: "2026-10-01T19:00:00.000Z" },
  ],
};
const lait: Element = { id: "e1", listeId: "l", texte: "Lait", quantite: null, rayon: "Crèmerie", coche: false, ajoutePar: "melo", creeLe: "2026-10-20T08:00:00.000Z", cocheLe: null };

describe("le fil du foyer", () => {
  it("rassemble les gestes des sept derniers jours, le plus récent en premier", () => {
    const fil = filDuFoyer({ taches: [tache], elements: [lait], budget: [{ id: "d", genre: "depense", jour: "2026-10-19", montant: 42.5, pot: "courses", libelle: "Migros", magasin: null, posteId: null, echeance: null, source: "main", par: "sarah", creeLe: "2026-10-19T12:00:00.000Z" }], zones: [], couple: [] }, MAINTENANT);
    expect(fil.map((e) => [e.quand.slice(0, 13), e.par, e.texte])).toEqual([
      ["2026-10-20T17", "sarah", "a fait « Litière »"],
      ["2026-10-20T08", "melo", "a ajouté « Lait »"],
      ["2026-10-19T12", "sarah", "a noté Migros · 42.50 CHF"],
      ["2026-10-18T19", "melo", "a fait « Litière »"],
    ]);
  });

  it("laisse de côté les paiements arrivés seuls et les cœurs", () => {
    const fil = filDuFoyer({
      taches: [], elements: [], zones: [],
      budget: [{ id: "a", genre: "depense", jour: "2026-10-20", montant: 10, pot: "plaisir", libelle: "Café", magasin: null, posteId: null, echeance: null, source: "applepay", par: "melo", creeLe: "2026-10-20T10:00:00.000Z" }],
      couple: [{ type: "mot", id: "c", de: "sarah", texte: "♥", creeLe: "2026-10-20T10:00:00.000Z", visibleDes: "2026-10-20T10:00:00.000Z", programme: false, coeurs: [], coeur: true }],
    }, MAINTENANT);
    expect(fil).toEqual([]);
  });

  it("groupe par jour, en disant Aujourd'hui et Hier", () => {
    const fil = filDuFoyer({ taches: [tache], elements: [], budget: [], zones: [], couple: [] }, MAINTENANT);
    const jours = grouperParJour(fil, "2026-10-20", jourLocal);
    expect(jours.map((j) => j.titre)).toEqual(["Aujourd'hui", "Dimanche 18 octobre"]);
    expect(grouperParJour(fil, "2026-10-21", jourLocal)[0].titre).toBe("Hier");
  });

  it("résume le jour pour l'accueil, en disant « toi »", () => {
    const fil = filDuFoyer({ taches: [tache], elements: [lait], budget: [], zones: [], couple: [] }, MAINTENANT);
    expect(resumeDuJour(fil, "2026-10-20", jourLocal, foyer, "melo")).toBe("toi 1 · Sarah 1");
    expect(resumeDuJour(fil, "2026-10-21", jourLocal, foyer, "melo")).toBe("");
    expect(quiDe(fil[0], foyer, "melo")).toBe("Sarah");
    expect(quiDe(fil[1], foyer, "melo")).toBe("Toi");
  });
});
