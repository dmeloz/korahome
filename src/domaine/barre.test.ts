import { describe, expect, it } from "vitest";
import { analyserTache, comprendrePhrase, decouperArticles, decrireIntention, invitation, lirePesee } from "./barre";

const auj = "2026-10-19"; // un lundi
const membres = [{ id: "melo", prenom: "Melo", couleur: "#d3a14a" }, { id: "sarah", prenom: "Sarah", couleur: "#8fc1bd" }];

describe("la barre Jarvis", () => {
  it("découpe une phrase de courses en articles", () => {
    expect(decouperArticles("du lait, des œufs et 2 kg de pommes")).toEqual(["Lait", "Œufs", "2 kg de pommes"]);
    expect(decouperArticles("pain + beurre aux courses")).toEqual(["Pain", "Beurre"]);
  });

  it("sur la page des courses, tout va aux courses", () => {
    expect(comprendrePhrase("ajoute du lait et du pain", "courses", auj)).toEqual({ type: "courses", articles: ["Lait", "Pain"] });
    expect(comprendrePhrase("Bananes", "courses", auj)).toEqual({ type: "courses", articles: ["Bananes"] });
  });

  it("une question part toujours chez Jarvis, même depuis une page", () => {
    expect(comprendrePhrase("Qu'est-ce qui périme bientôt", "courses", auj).type).toBe("jarvis");
    expect(comprendrePhrase("on fait quoi ce soir ?", "accueil", auj).type).toBe("jarvis");
    expect(comprendrePhrase("Retiens que Sarah n'aime pas la coriandre", "accueil", auj).type).toBe("jarvis");
  });

  it("depuis l'accueil, devine les courses", () => {
    expect(comprendrePhrase("Il faut du papier toilette", "accueil", auj)).toEqual({ type: "courses", articles: ["Papier toilette"] });
    expect(comprendrePhrase("lait", "accueil", auj)).toEqual({ type: "courses", articles: ["Lait"] });
    expect(comprendrePhrase("pâtes, riz et tomates", "accueil", auj)).toEqual({ type: "courses", articles: ["Pâtes", "Riz", "Tomates"] });
  });

  it("depuis l'accueil, devine un rendez-vous", () => {
    const i = comprendrePhrase("Dentiste jeudi 14h30", "accueil", auj, membres);
    expect(i.type).toBe("agenda");
    if (i.type === "agenda") expect(i.brouillon).toMatchObject({ titre: "Dentiste", jour: "2026-10-22", heure: "14:30" });
  });

  it("depuis l'accueil, devine une tâche", () => {
    expect(comprendrePhrase("Sortir les poubelles chaque mardi", "accueil", auj)).toEqual({
      type: "tache",
      titre: "Sortir les poubelles",
      recurrence: { unite: "semaine", tous: 1 },
      echeance: "2026-10-20",
    });
    expect(comprendrePhrase("Appeler le garage demain", "accueil", auj)).toMatchObject({ type: "tache", titre: "Appeler le garage", echeance: "2026-10-20", recurrence: null });
  });

  it("laisse à Jarvis ce qui se dit avec un verbe", () => {
    expect(comprendrePhrase("La litière est faite", "accueil", auj).type).toBe("jarvis");
    expect(comprendrePhrase("Mitsu a mangé moins ce matin", "mitsu", auj).type).toBe("jarvis");
  });

  it("lit les rythmes des tâches", () => {
    expect(analyserTache("Linge chaque mercredi", auj)).toEqual({ titre: "Linge", recurrence: { unite: "semaine", tous: 1 }, echeance: "2026-10-21" });
    expect(analyserTache("Détartrer la bouilloire tous les 3 mois", auj)).toEqual({ titre: "Détartrer la bouilloire", recurrence: { unite: "mois", tous: 3 }, echeance: auj });
    expect(analyserTache("Ménage toutes les 2 semaines à partir de samedi", auj)).toEqual({ titre: "Ménage", recurrence: { unite: "semaine", tous: 2 }, echeance: "2026-10-24" });
    expect(analyserTache("tâche : arroser chaque jour", auj)).toEqual({ titre: "Arroser", recurrence: { unite: "jour", tous: 1 }, echeance: auj });
  });

  it("sur la page Tâches, une phrase devient une tâche", () => {
    expect(comprendrePhrase("Ranger la cave samedi", "taches", auj)).toMatchObject({ type: "tache", titre: "Ranger la cave", echeance: "2026-10-24" });
  });

  it("invite et confirme avec les mots de la page", () => {
    expect(invitation("courses")).toBe("Ajouter aux courses…");
    expect(invitation("mitsu")).toBe("Demander à Jarvis…");
    expect(decrireIntention({ type: "courses", articles: ["Lait"] })).toBe("Lait ajouté aux courses.");
    expect(decrireIntention({ type: "courses", articles: ["Lait", "Pain"] })).toBe("2 articles ajoutés aux courses.");
  });
});

describe("une pesée dans la barre de Mitsu", () => {
  it("lit les kilos, les grammes et la phrase entière", () => {
    expect(lirePesee("2,45 kg")).toBe(2450);
    expect(lirePesee("2.5")).toBe(2500);
    expect(lirePesee("2450 g")).toBe(2450);
    expect(lirePesee("Elle pèse 3,1 kg")).toBe(3100);
    expect(lirePesee("pesée 2,8")).toBe(2800);
  });
  it("laisse le reste à Jarvis", () => {
    expect(lirePesee("litière faite")).toBeNull();
    expect(lirePesee("40 kg")).toBeNull();
    expect(lirePesee("vaccin jeudi")).toBeNull();
  });
});
