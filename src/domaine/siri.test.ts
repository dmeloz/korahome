import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { creerFoyer } from "./foyer";
import { nouvelElement, nouvelleListe } from "./listes";
import {
  confirmer,
  demandeRaccourciSiri,
  donneesDepuisDocuments,
  lignesAEcrire,
  lignesAnnulation,
  nomAssistant,
  nomPropose,
  OUI_OU_NON,
  pourLaVoix,
  reponseCourte,
  suiteRecente,
  tourSiri,
} from "./siri";
import { nouvelleTache } from "./taches";

const AUJOURDHUI = "2026-10-19";
const ctx = () => contexteTest("2026-10-19T20:00:00.000Z");

function documents() {
  const c = contexteTest();
  const foyer = creerFoyer("Cassa", ["D.", "S."], c);
  const courses = nouvelleListe("Courses", "panier", "courses", c);
  const lait = nouvelElement(courses, "lait", null, c);
  const poubelles = nouvelleTache("Poubelles", null, AUJOURDHUI, c);
  const lignes = [
    { collection: "foyer", donnees: foyer },
    { collection: "listes", donnees: courses },
    { collection: "elements", donnees: lait },
    { collection: "elements", donnees: null },
    { collection: "taches", donnees: poubelles },
  ];
  return { lignes, foyer, moi: foyer.membres[0].id };
}

describe("Jarvis dans Siri", () => {
  it("relit le foyer depuis les documents du serveur, sans les supprimés", () => {
    const { lignes } = documents();
    const d = donneesDepuisDocuments(lignes)!;
    expect(d.foyer.nom).toBe("Cassa");
    expect(d.elements).toHaveLength(1);
    expect(d.taches[0].titre).toBe("Poubelles");
    expect(donneesDepuisDocuments([])).toBeNull();
  });

  it("propose le nom de la fée du téléphone, et nettoie celui qu'on choisit", () => {
    expect(nomPropose("D.")).toBe("Tael");
    expect(nomPropose("Sarah")).toBe("Navi");
    expect(nomPropose(null)).toBe("Jarvis");
    expect(nomAssistant("  Tael<script> ")).toBe("Taelscript");
    expect(nomAssistant(42)).toBe("Jarvis");
  });

  it("reconnaît oui, non et annule dits seuls", () => {
    expect(reponseCourte("Oui.")).toBe("oui");
    expect(reponseCourte("vas-y")).toBe("oui");
    expect(reponseCourte("Non merci")).toBe("non");
    expect(reponseCourte("Annule ça")).toBe("annule");
    expect(reponseCourte("oui ajoute du beurre")).toBeNull();
  });

  it("agit tout de suite, mais demande avant de supprimer", () => {
    const { lignes, moi } = documents();
    const d = donneesDepuisDocuments(lignes)!;
    const tour = tourSiri(
      "",
      [
        { nom: "ajouter_courses", entree: { articles: ["beurre"] } },
        { nom: "supprimer_tache", entree: { titre: "poubelles" } },
      ],
      d,
      moi,
      AUJOURDHUI,
      ctx(),
    );
    expect(tour.dit).toContain("beurre");
    expect(tour.dit).toContain("Supprimer la tâche « poubelles » ?");
    expect(tour.dit.endsWith(OUI_OU_NON)).toBe(true);
    expect(tour.attente).toMatchObject({ outil: "supprimer_tache" });
    expect(lignesAEcrire(tour.modifications)).toEqual([expect.objectContaining({ collection: "elements", donnees: expect.objectContaining({ texte: expect.stringMatching(/beurre/i) }) })]);

    const oui = confirmer(tour.attente!, d, moi, AUJOURDHUI, ctx());
    expect(oui.attente).toBeNull();
    expect(lignesAEcrire(oui.modifications)).toEqual([{ collection: "taches", id: d.taches[0].id, donnees: null }]);
    // « Annule » remet la tâche telle qu'elle était.
    expect(lignesAnnulation(oui.modifications)).toEqual([{ collection: "taches", id: d.taches[0].id, donnees: d.taches[0] }]);
  });

  it("annuler un ajout retire ce qui a été créé", () => {
    const { lignes, moi } = documents();
    const d = donneesDepuisDocuments(lignes)!;
    const tour = tourSiri("", [{ nom: "ajouter_courses", entree: { articles: ["œufs"] } }], d, moi, AUJOURDHUI, ctx());
    expect(lignesAnnulation(tour.modifications)).toEqual([{ collection: "elements", id: tour.modifications[0].apres.id, donnees: null }]);
  });

  it("garde la suite dix minutes", () => {
    const suite = { attente: null, modifications: [], tours: [], le: "2026-10-19T20:00:00.000Z" };
    expect(suiteRecente(suite, "2026-10-19T20:09:00.000Z")).not.toBeNull();
    expect(suiteRecente(suite, "2026-10-19T20:11:00.000Z")).toBeNull();
    expect(suiteRecente(null, "2026-10-19T20:00:00.000Z")).toBeNull();
  });

  it("parle sans mise en forme", () => {
    expect(pourLaVoix("**Ajouté** 🎉\n- lait")).toBe("Ajouté - lait");
  });

  it("donne au raccourci son nom, l'adresse et la question de confirmation", () => {
    const demande = demandeRaccourciSiri("https://x.supabase.co/functions/v1/siri?j=abc", "Tael");
    expect(demande).toContain("« Dis Siri, Tael »");
    expect(demande).toContain("https://x.supabase.co/functions/v1/siri?j=abc");
    expect(demande).toContain(OUI_OU_NON);
  });
});
