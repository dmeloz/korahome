import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { creerFoyer } from "./foyer";
import {
  annulation,
  appliquerActions,
  coutMicroChf,
  decrireAction,
  decrireFoyer,
  etatBudget,
  formaterChf,
  lireActions,
  OUTILS_JARVIS,
  type ActionJarvis,
  type DonneesFoyer,
} from "./jarvis";
import { extraireRecette, lienAutorise, lienDans, lirePage, messageDemande, texteDePage } from "./jarvisModele";
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

  it("devine la date d'un produit de ticket de caisse", () => {
    const { d, melo } = foyerDeTest();
    const r = appliquerActions(
      [{ outil: "ajouter_au_stock", produits: [{ nom: "1 l lait", lieu: "frigo", peremption: null }, { nom: "bidule", lieu: "placard", peremption: null }] }],
      d,
      melo,
      AUJOURDHUI,
      ctx(),
    );
    expect(r.modifications[0]).toMatchObject({ apres: { nom: "Lait", peremption: "2026-10-19" } });
    expect(r.modifications[1]).toMatchObject({ apres: { peremption: null } });
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

describe("le conseil du dimanche", () => {
  it("confie une tâche à quelqu'un ou la rend libre", () => {
    const { d, melo, sarah } = foyerDeTest();
    const r = appliquerActions(
      [
        { outil: "attribuer_tache", titre: "Litière", responsable: "Sarah" },
        { outil: "attribuer_tache", titre: "Litière", responsable: null },
        { outil: "attribuer_tache", titre: "Litière", responsable: "Paul" },
      ],
      d,
      melo,
      AUJOURDHUI,
      ctx(),
    );
    expect(r.modifications[0].apres).toMatchObject({ responsable: sarah });
    expect(r.modifications[1].apres).toMatchObject({ responsable: null });
    expect(r.faits).toEqual(["Litière : pour Sarah.", "Litière : libre."]);
    expect(r.echecs).toEqual(["Je ne connais personne nommé Paul."]);
  });

  it("décrit chaque proposition en une ligne", () => {
    expect(decrireAction({ outil: "attribuer_tache", titre: "Litière", responsable: "Sarah" })).toBe("Litière → Sarah");
    expect(decrireAction({ outil: "ajouter_courses", articles: ["lait", "œufs", "riz"] })).toBe("Courses : lait, œufs et riz");
  });

  it("compte le modèle du conseil à son prix", () => {
    expect(coutMicroChf({ input_tokens: 5000, output_tokens: 1000 }, "claude-sonnet-5-5")).toBe(18000);
  });
});

describe("les recettes derrière un lien", () => {
  const page = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":["Recipe"],"name":"Gratin dauphinois","recipeYield":["4 portions"],
     "recipeIngredient":["1 kg de pommes de terre","5 dl de cr&egrave;me enti&egrave;re","1 gousse d&#39;ail",""]}]}
  </script></head><body><h1>Gratin</h1></body></html>`;

  it("lit les ingrédients des données structurées de la page", () => {
    expect(extraireRecette(page)).toEqual({
      titre: "Gratin dauphinois",
      portions: "4 portions",
      ingredients: ["1 kg de pommes de terre", "5 dl de cr&egrave;me enti&egrave;re", "1 gousse d'ail"],
    });
    expect(extraireRecette("<html><body>Rien</body></html>")).toBeNull();
  });

  it("sinon garde le texte lisible, et trouve le lien dans la demande", () => {
    expect(texteDePage("<style>x{}</style><p>Farine&nbsp;200 g</p><script>1</script>")).toBe("Farine 200 g");
    expect(lienDans("ajoute les ingrédients de https://www.bettybossi.ch/fr/recette/gratin stp")).toBe("https://www.bettybossi.ch/fr/recette/gratin");
    expect(lienDans("ajoute du lait")).toBeNull();
  });

  it("joint la recette à la demande", () => {
    const lu = lirePage(page);
    expect(lu).toContain("Recette « Gratin dauphinois » (4 portions)");
    expect(messageDemande("Stock : vide", "fais ça", [], lu)).toContain("Ce qu'il y a derrière le lien :\nRecette « Gratin");
    expect(lirePage("<p>Rien</p>")).toBe("Rien");
  });

  it("n'ouvre que des adresses publiques en https", () => {
    expect(lienAutorise("https://www.bettybossi.ch/fr/recette/gratin")).toBe(true);
    for (const a of ["http://fooby.ch", "https://localhost/x", "https://127.0.0.1/", "https://[::1]/", "https://intranet/", "https://nas.local/", "https://a.ch:8443/", "pas une adresse"]) {
      expect(lienAutorise(a), a).toBe(false);
    }
  });
});
