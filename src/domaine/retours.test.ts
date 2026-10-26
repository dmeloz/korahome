import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { creerFoyer } from "./foyer";
import {
  JOURNAL_MAX,
  ajouterEvenement,
  basculerRegle,
  evenementsAvant,
  grouperParEcran,
  heureCourte,
  nettoyerDetail,
  nomFichierRapport,
  nouveauRetour,
  rapportVersion,
  type EvenementJournal,
  estPartie,
  etatRetour,
} from "./retours";

const evt = (h: string, type: EvenementJournal["type"], detail: string, ecran = "Accueil"): EvenementJournal => ({
  h,
  type,
  detail,
  ecran,
  version: "0.0.2",
});

describe("notes de test", () => {
  it("retient l'écran, la version, l'auteur et l'heure", () => {
    const ctx = contexteTest();
    const r = nouveauRetour({ texte: "  Le bouton est trop petit ", genre: "gene", ecran: "Tâches", version: "0.0.2", auteur: "m1" }, ctx);
    expect(r).toMatchObject({ texte: "Le bouton est trop petit", genre: "gene", ecran: "Tâches", version: "0.0.2", auteur: "m1", regleLe: null });
    expect(r.creeLe).toBe("2026-10-07T08:00:01.000Z");
  });

  it("refuse une note vide", () => {
    expect(() => nouveauRetour({ texte: "   ", genre: "bug", ecran: "Accueil", version: "0.0.2", auteur: null }, contexteTest())).toThrow();
  });

  it("se marque réglée puis se rouvre", () => {
    const ctx = contexteTest();
    const r = nouveauRetour({ texte: "x", genre: "bug", ecran: "Accueil", version: "0.0.2", auteur: null }, ctx);
    const reglee = basculerRegle(r, ctx);
    expect(reglee.regleLe).not.toBeNull();
    expect(basculerRegle(reglee, ctx).regleLe).toBeNull();
  });

  it("se range par écran, dans l'ordre d'arrivée", () => {
    const ctx = contexteTest();
    const n = (texte: string, ecran: string) => nouveauRetour({ texte, genre: "idee", ecran, version: "0.0.2", auteur: null }, ctx);
    const a = n("a", "Tâches");
    const b = n("b", "Accueil");
    const c = n("c", "Tâches");
    expect(grouperParEcran([c, b, a]).map((g) => [g.ecran, g.retours.map((r) => r.texte)])).toEqual([
      ["Tâches", ["a", "c"]],
      ["Accueil", ["b"]],
    ]);
  });
});

describe("journal discret", () => {
  it("garde une ligne propre et bornée", () => {
    expect(nettoyerDetail("  Ajouter\n  une   tâche ")).toBe("Ajouter une tâche");
    expect(nettoyerDetail("x".repeat(300))).toHaveLength(160);
  });

  it("ne garde que les 400 derniers événements", () => {
    let journal: EvenementJournal[] = [];
    for (let i = 0; i < JOURNAL_MAX + 10; i++) {
      journal = ajouterEvenement(journal, evt(new Date(Date.UTC(2026, 9, 8, 0, 0, i)).toISOString(), "geste", `n${i}`));
    }
    expect(journal).toHaveLength(JOURNAL_MAX);
    expect(journal[0].detail).toBe("n10");
  });

  it("oublie ce qui a plus de 14 jours", () => {
    const vieux = evt("2026-09-01T10:00:00.000Z", "geste", "vieux");
    const journal = ajouterEvenement([vieux], evt("2026-10-08T10:00:00.000Z", "geste", "neuf"));
    expect(journal.map((e) => e.detail)).toEqual(["neuf"]);
  });

  it("retrouve les gestes juste avant une note", () => {
    const journal = [
      evt("2026-10-08T10:00:00.000Z", "ecran", "Tâches"),
      evt("2026-10-08T10:00:05.000Z", "geste", "Ajouter"),
      evt("2026-10-08T10:00:06.000Z", "note", "Bug"),
      evt("2026-10-08T10:01:00.000Z", "geste", "après"),
    ];
    expect(evenementsAvant(journal, "2026-10-08T10:00:07.000Z").map((e) => e.detail)).toEqual(["Tâches", "Ajouter"]);
  });
});

describe("rapport de version", () => {
  const ctx = contexteTest("2026-10-08T10:00:00.000Z");
  const foyer = creerFoyer("Maison", ["Melo", "Sarah"], ctx);
  const [melo] = foyer.membres;
  const journal = [
    evt("2026-10-08T10:00:00.000Z", "lancement", "Kora 0.0.2"),
    evt("2026-10-08T10:00:02.000Z", "ecran", "Tâches", "Tâches"),
    evt("2026-10-08T10:00:03.000Z", "geste", "Faite", "Tâches"),
    evt("2026-10-08T10:00:04.000Z", "erreur", "TypeError: x is undefined", "Tâches"),
  ];
  const bug = nouveauRetour({ texte: "La tâche ne se coche pas", genre: "bug", ecran: "Tâches", version: "0.0.2", auteur: melo.id }, ctx);
  const ancienne = basculerRegle(
    nouveauRetour({ texte: "Trop de vide en haut", genre: "gene", ecran: "Accueil", version: "0.0.1", auteur: melo.id }, ctx),
    ctx,
  );
  const texte = rapportVersion({
    version: "0.0.2",
    maintenant: "2026-10-08T10:05:00.000Z",
    retours: [bug, ancienne],
    journal,
    membres: foyer.membres,
    environnement: { installee: true, appareil: "iPhone" },
  });

  it("annonce la version et les compteurs", () => {
    expect(texte).toContain("# Rapport Kora 0.0.2");
    expect(texte).toContain("Notes ouvertes : 1 · réglées : 1");
    expect(texte).toContain("dont 1 erreur");
    expect(texte).toContain("app installée");
  });

  it("range les notes ouvertes par écran avec leur auteur et ce qui les a précédées", () => {
    expect(texte).toContain("### Tâches");
    expect(texte).toContain("**Bug** ·");
    expect(texte).toContain("· Melo");
    expect(texte).toContain("La tâche ne se coche pas");
    expect(texte).toContain("Juste avant :");
    expect(texte).toContain("touche · Faite (Tâches)");
  });

  it("liste à part les notes réglées et reprend le journal", () => {
    expect(texte).toContain("## Réglées\n- Gêne · Accueil · Trop de vide en haut");
    expect(texte).toContain("ERREUR · TypeError: x is undefined");
    expect(texte).toContain("## Journal (4 derniers événements)");
  });

  it("dit quand il n'y a rien", () => {
    const vide = rapportVersion({
      version: "0.0.2",
      maintenant: "2026-10-08T10:05:00.000Z",
      retours: [],
      journal: [],
      membres: [],
      environnement: { installee: false, appareil: "iPhone" },
    });
    expect(vide).toContain("Aucune note ouverte.");
    expect(vide).toContain("Journal vide.");
  });
});

describe("nom du fichier", () => {
  it("porte la version, le jour et l'heure", () => {
    const quand = "2026-10-08T14:03:00.000Z";
    const [jour, heure] = heureCourte(quand).split(" ");
    const [jj, mm] = jour.split(".");
    expect(nomFichierRapport("0.0.2", quand)).toBe(`kora-0.0.2-2026-${mm}-${jj}-${heure.replace(":", "")}.md`);
  });

  it("ne laisse passer aucun caractère douteux", () => {
    expect(nomFichierRapport("../0.0.2", "2026-10-08T14:03:00.000Z")).toMatch(/^kora-\.\.0\.0\.2-/);
  });
});

describe("état des notes, comme dans Sanji", () => {
  const ctx = contexteTest();
  const note = nouveauRetour({ texte: "Bouton trop petit", genre: "gene", ecran: "Courses", version: "0.0.7", auteur: null }, ctx);

  it("une note est nouvelle tant que Claude ne l'a pas lue, reçue quand il l'a marquée, réglée ensuite", () => {
    expect(etatRetour(note)).toBe("nouvelle");
    expect(estPartie(note, new Set([note.id]), true)).toBe(false);
    expect(estPartie(note, new Set(), false)).toBe(false);
    expect(estPartie(note, new Set(), true)).toBe(true);
    expect(etatRetour({ ...note, recuLe: "2026-10-26T06:00:00.000Z" })).toBe("transmise");
    expect(etatRetour(basculerRegle({ ...note, recuLe: "2026-10-26T06:00:00.000Z" }, ctx))).toBe("reglee");
  });

  it("garde avec la note les gestes qui l'ont précédée", () => {
    const journal = [
      { h: "2000-01-01T10:00:00.000Z", type: "ecran" as const, detail: "Courses", ecran: "Courses", version: "0.0.7" },
      { h: "2000-01-01T10:00:01.000Z", type: "geste" as const, detail: "Ajouter", ecran: "Courses", version: "0.0.7" },
    ];
    const avecContexte = nouveauRetour({ texte: "Lent", genre: "gene", ecran: "Courses", version: "0.0.7", auteur: null }, ctx, journal);
    expect(avecContexte.avant?.map((e) => e.detail)).toEqual(["Courses", "Ajouter"]);
  });
});
