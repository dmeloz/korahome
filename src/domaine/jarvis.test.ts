import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { creerFoyer } from "./foyer";
import {
  annulation,
  appliquerActions,
  coutMicroChf,
  decrireFoyer,
  etatBudget,
  formaterChf,
  lireActions,
  OUTILS_JARVIS,
  type ActionJarvis,
  type DonneesFoyer,
} from "./jarvis";
import { nouvelElement, nouvelleListe } from "./listes";
import { nouvelAnimal } from "./mitsu";
import { nouvelleTache } from "./taches";

const AUJOURDHUI = "2026-10-12";

function foyerDeTest(): { d: DonneesFoyer; melo: string; sarah: string } {
  const ctx = contexteTest();
  const foyer = creerFoyer("Cassa", ["Melo", "Sarah"], ctx);
  const courses = nouvelleListe("Courses", "panier", "courses", ctx);
  const lait = nouvelElement(courses, "lait", null, ctx);
  const litiere = nouvelleTache("Litière", { unite: "semaine", tous: 1 }, AUJOURDHUI, ctx);
  const mitsu = nouvelAnimal("Mitsu", "2026-03-01", null, ctx);
  return {
    d: { foyer, listes: [courses], elements: [lait], taches: [litiere], animaux: [mitsu], produits: [] },
    melo: foyer.membres[0].id,
    sarah: foyer.membres[1].id,
  };
}

const ctx = () => contexteTest("2026-10-12T09:00:00.000Z");

describe("le coût de Jarvis", () => {
  it("compte une demande ordinaire en fractions de centime", () => {
    // 3000 jetons lus, 150 écrits : 0,00045 $ → environ 0,0004 CHF.
    const cout = coutMicroChf({ input_tokens: 3000, output_tokens: 150 });
    expect(cout).toBe(338);
    expect(cout / 1e6).toBeLessThan(0.001);
  });

  it("prévient à 80 % et s'arrête au plafond de 5 CHF", () => {
    expect(etatBudget(1_000_000)).toMatchObject({ alerte: false, atteint: false });
    expect(etatBudget(4_000_000)).toMatchObject({ alerte: true, atteint: false });
    expect(etatBudget(5_000_000)).toMatchObject({ alerte: true, atteint: true });
    expect(formaterChf(0.4)).toBe("0,40 CHF");
  });
});

describe("ce que Jarvis sait du foyer", () => {
  it("résume la liste, les tâches, le stock et l'animal", () => {
    const { d, melo } = foyerDeTest();
    const texte = decrireFoyer(d, melo, AUJOURDHUI);
    expect(texte).toContain("lundi 2026-10-12");
    expect(texte).toContain("La personne qui parle : Melo.");
    expect(texte).toContain("Liste de courses : Lait.");
    expect(texte).toContain("- Litière : aujourd'hui, libre");
    expect(texte).toContain("Stock : rien de noté.");
    expect(texte).toContain("Animal Mitsu");
  });
});

describe("les demandes d'outils", () => {
  it("garde ce qui est valide et ignore le reste", () => {
    const actions = lireActions([
      { nom: "ajouter_courses", entree: { articles: ["beurre", "", 3] } },
      { nom: "ajouter_tache", entree: { titre: "Poubelles", echeance: "demain", responsable: null, frequence: null } },
      { nom: "ajouter_tache", entree: { titre: "Poubelles", echeance: "2026-10-13", responsable: "Sarah", frequence: { unite: "semaine", tous: 1 } } },
      { nom: "ajouter_au_stock", entree: { produits: [{ nom: "Poulet", lieu: "cave", peremption: null }, { nom: "Yaourts", lieu: "frigo", peremption: "2026-10-15" }] } },
      { nom: "supprimer_tout", entree: {} },
    ]);
    expect(actions).toEqual([
      { outil: "ajouter_courses", articles: ["beurre"] },
      { outil: "ajouter_tache", titre: "Poubelles", echeance: "2026-10-13", responsable: "Sarah", frequence: { unite: "semaine", tous: 1 } },
      { outil: "ajouter_au_stock", produits: [{ nom: "Yaourts", lieu: "frigo", peremption: "2026-10-15" }] },
    ]);
  });

  it("chaque outil a un schéma strict", () => {
    for (const outil of OUTILS_JARVIS) {
      expect(outil.strict).toBe(true);
      expect(outil.input_schema.additionalProperties).toBe(false);
      expect([...outil.input_schema.required].sort()).toEqual(Object.keys(outil.input_schema.properties).sort());
    }
  });
});

describe("les actions de Jarvis", () => {
  it("ajoute aux courses sans doublon, puis coche", () => {
    const { d, melo } = foyerDeTest();
    const actions: ActionJarvis[] = [
      { outil: "ajouter_courses", articles: ["Lait", "2 kg de pommes"] },
      { outil: "cocher_courses", articles: ["pommes"] },
    ];
    const r = appliquerActions(actions, d, melo, AUJOURDHUI, ctx());
    expect(r.faits).toEqual(["Ajouté aux courses : pommes (2 kg).", "Déjà sur la liste : lait.", "Coché : pommes."]);
    expect(r.echecs).toEqual([]);
    expect(r.modifications).toHaveLength(2);
    expect(r.modifications[1]).toMatchObject({ collection: "elements", apres: { texte: "Pommes", coche: true, ajoutePar: melo } });
  });

  it("crée une tâche pour la bonne personne et en marque une faite", () => {
    const { d, melo, sarah } = foyerDeTest();
    const r = appliquerActions(
      [
        { outil: "ajouter_tache", titre: "sortir les poubelles", echeance: "2026-10-13", responsable: "sarah", frequence: null },
        { outil: "tache_faite", titre: "la litiere" },
      ],
      d,
      melo,
      AUJOURDHUI,
      ctx(),
    );
    expect(r.echecs).toEqual([]);
    expect(r.modifications[0]).toMatchObject({ collection: "taches", avant: null, apres: { titre: "Sortir les poubelles", responsable: sarah } });
    expect(r.modifications[1]).toMatchObject({ collection: "taches", apres: { faitePar: melo, echeance: "2026-10-19" } });
    expect(r.faits[1]).toBe("C'est noté : litière est faite, prochaine fois dans 7 jours.");
  });

  it("range au stock et note une pesée", () => {
    const { d, melo } = foyerDeTest();
    const r = appliquerActions(
      [
        { outil: "ajouter_au_stock", produits: [{ nom: "poulet", lieu: "congelateur", peremption: null }] },
        { outil: "noter_pesee", animal: "mitsu", grammes: 3200 },
      ],
      d,
      melo,
      AUJOURDHUI,
      ctx(),
    );
    expect(r.echecs).toEqual([]);
    expect(r.modifications.map((m) => m.collection)).toEqual(["stock", "animaux"]);
    expect(r.faits[1]).toBe("Pesée notée : Mitsu, 3,2 kg.");
  });

  it("explique ce qu'il ne trouve pas, sans s'arrêter", () => {
    const { d, melo } = foyerDeTest();
    const r = appliquerActions(
      [
        { outil: "tache_faite", titre: "Repassage" },
        { outil: "cocher_courses", articles: ["caviar"] },
        { outil: "ajouter_courses", articles: ["beurre"] },
      ],
      d,
      melo,
      AUJOURDHUI,
      ctx(),
    );
    expect(r.echecs).toEqual(["Je ne trouve pas la tâche « Repassage ».", "« caviar » n'est pas sur la liste."]);
    expect(r.faits).toEqual(["Ajouté aux courses : beurre."]);
  });

  it("annule dans l'ordre inverse, en remettant la toute première version", () => {
    const { d, melo } = foyerDeTest();
    const r = appliquerActions(
      [
        { outil: "ajouter_courses", articles: ["beurre"] },
        { outil: "cocher_courses", articles: ["beurre", "lait"] },
      ],
      d,
      melo,
      AUJOURDHUI,
      ctx(),
    );
    const retour = annulation(r.modifications);
    expect(retour).toEqual([
      { collection: "elements", id: d.elements[0].id, remettre: d.elements[0] },
      { collection: "elements", id: r.modifications[0].apres.id, remettre: null },
    ]);
  });
});
