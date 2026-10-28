import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { aResilierBientot, contratsDe, contratVide, dateLimite, estContrat, finEnCours, phraseResiliation, poserContrat, quandResilier, resumeContrats, totalParMois } from "./abonnements";
import { nouveauPoste, type Poste } from "./budget";

const ctx = contexteTest();
const AUJOURDHUI = "2026-10-28";

const poste = (champs: Partial<Poste> & { libelle: string; montant: number }): Poste => nouveauPoste({ categorie: "abonnement", pot: "factures", ...champs }, ctx);

describe("les contrats du foyer", () => {
  it("un abonnement ou une assurance est un contrat, pas le loyer", () => {
    expect(estContrat(poste({ libelle: "Sunrise", montant: 59 }))).toBe(true);
    expect(estContrat(poste({ libelle: "Assurance ménage", montant: 300, frequence: "an", categorie: "assurance" }))).toBe(true);
    expect(estContrat(poste({ libelle: "Loyer", montant: 1800, categorie: "logement" }))).toBe(false);
  });

  it("une fin tacite passée avance d'un an jusqu'à aujourd'hui", () => {
    const c = { ...contratVide(), fin: "2025-12-31" };
    expect(finEnCours(c, AUJOURDHUI)).toBe("2026-12-31");
    expect(finEnCours({ ...c, fin: "2024-03-15" }, AUJOURDHUI)).toBe("2027-03-15");
    expect(finEnCours({ ...c, tacite: false }, AUJOURDHUI)).toBe("2025-12-31");
    expect(finEnCours(contratVide(), AUJOURDHUI)).toBeNull();
  });

  it("la date limite retire le préavis à la fin", () => {
    expect(dateLimite({ ...contratVide(), fin: "2026-12-31", preavisMois: 1 }, AUJOURDHUI)).toBe("2026-11-30");
    expect(dateLimite({ ...contratVide(), fin: "2026-12-31", preavisMois: 3 }, AUJOURDHUI)).toBe("2026-09-30");
    expect(dateLimite({ ...contratVide(), fin: "2026-12-31", preavisMois: 0 }, AUJOURDHUI)).toBe("2026-12-31");
    expect(dateLimite(contratVide(), AUJOURDHUI)).toBeNull();
  });

  it("les lignes se rangent du plus pressé au sans date", () => {
    const postes = [
      poste({ libelle: "Netflix", montant: 18 }),
      poste({ libelle: "Sunrise", montant: 59, contrat: { ...contratVide(), fin: "2026-12-31", preavisMois: 1 } }),
      poste({ libelle: "Salle de sport", montant: 600, frequence: "an", contrat: { ...contratVide(), fin: "2027-06-30", preavisMois: 2 } }),
      poste({ libelle: "Loyer", montant: 1800, categorie: "logement" }),
    ];
    const lignes = contratsDe(postes, AUJOURDHUI);
    expect(lignes.map((l) => l.poste.libelle)).toEqual(["Sunrise", "Salle de sport", "Netflix"]);
    expect(lignes[0].limite).toBe("2026-11-30");
    expect(lignes[0].dansJours).toBe(33);
    expect(lignes[0].etat).toBe("Résilier avant le 30.11.2026 · 33 jours");
    expect(lignes[0].presse).toBe(false);
    expect(lignes[1].parMois).toBe(50);
    expect(lignes[2].etat).toBe("Pas de date : se renouvelle sans prévenir");
    expect(totalParMois(lignes)).toBe(127);
    expect(resumeContrats(lignes)).toBe("3 contrats · 127 CHF par mois");
    expect(resumeContrats([])).toBe("Aucun contrat noté");
  });

  it("ne garde que les personnes demandées et le commun", () => {
    const postes = [poste({ libelle: "Netflix", montant: 18 }), poste({ libelle: "Spotify", montant: 13, qui: "sarah", pot: null }), poste({ libelle: "Salle", montant: 50, qui: "dany", pot: null })];
    expect(contratsDe(postes, AUJOURDHUI, [null, "dany"]).map((l) => l.poste.libelle)).toEqual(["Netflix", "Salle"]);
  });

  it("prévient dans les 45 jours, dit « dernier jour », puis « renouvelé »", () => {
    const sunrise = poste({ libelle: "Sunrise", montant: 59, contrat: { ...contratVide(), fin: "2026-12-31", preavisMois: 1 } });
    expect(aResilierBientot([sunrise], AUJOURDHUI).map((l) => l.poste.libelle)).toEqual(["Sunrise"]);
    expect(aResilierBientot([sunrise], "2026-10-01")).toEqual([]);
    expect(contratsDe([sunrise], "2026-11-30")[0].etat).toBe("Résilier avant le 30.11.2026 · dernier jour");
    expect(contratsDe([sunrise], "2026-11-30")[0].presse).toBe(true);
    expect(contratsDe([sunrise], "2026-12-01")[0].etat).toBe("Renouvelé jusqu'au 31.12.2027");
    expect(aResilierBientot([sunrise], "2026-12-01")).toEqual([]);
    // Sans préavis, rien à prévoir : on résilie quand on veut.
    const libre = poste({ libelle: "Netflix", montant: 18, contrat: { ...contratVide(), fin: "2026-11-15", preavisMois: 0 } });
    expect(aResilierBientot([libre], AUJOURDHUI)).toEqual([]);
    expect(contratsDe([libre], AUJOURDHUI)[0].etat).toBe("Résiliable à tout moment, se renouvelle le 15.11.2026");
  });

  it("une phrase pour l'accueil et le rappel du matin", () => {
    const sunrise = poste({ libelle: "Sunrise", montant: 59, contrat: { ...contratVide(), fin: "2026-12-31", preavisMois: 1 } });
    const ligne = contratsDe([sunrise], AUJOURDHUI)[0];
    expect(phraseResiliation(ligne)).toBe("Résilier Sunrise avant le 30 novembre");
    expect(quandResilier(ligne, AUJOURDHUI)).toBe("dans 33 jours");
    const premier = contratsDe([poste({ libelle: "Salle", montant: 50, contrat: { ...contratVide(), fin: "2027-02-01", preavisMois: 1 } })], AUJOURDHUI)[0];
    expect(phraseResiliation(premier)).toBe("Résilier Salle avant le 1er janvier");
    expect(phraseResiliation(contratsDe([poste({ libelle: "Netflix", montant: 18 })], AUJOURDHUI)[0])).toBe("Décider pour Netflix");
  });

  it("poser un contrat borne le préavis et la note", () => {
    const p = poserContrat(poste({ libelle: "Sunrise", montant: 59 }), { fin: "2026-12-31", preavisMois: 40, note: `  ${"x".repeat(250)}  ` }, ctx);
    expect(p.contrat).toEqual({ fin: "2026-12-31", preavisMois: 24, tacite: true, note: "x".repeat(200) });
    expect(poserContrat(p, { note: "   " }, ctx).contrat?.note).toBeNull();
    expect(poserContrat(p, { tacite: false }, ctx).contrat).toMatchObject({ fin: "2026-12-31", preavisMois: 24, tacite: false });
  });
});
