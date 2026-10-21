import { describe, expect, it } from "vitest";
import {
  alertesMitsu,
  avisDuPlat,
  avisSurPlat,
  ceQuEfface,
  articlesARemplacer,
  AJOUTS_MAX,
  estLHeureDuChef,
  etatDesAjouts,
  lireProposition,
  menuDeLaSemaine,
  messageChef,
  notificationChef,
  nouveauMenu,
  preparerAjouts,
  prochainPassage,
  produitsAFinir,
  reglageChef,
  reglerChef,
  retirerAjout,
  SCHEMA_CHEF,
  devaliderSoir,
  validerMenu,
  validerSoir,
  validerToutLeMenu,
  type DocChef,
  type MenuSemaine,
} from "./chef";
import { contexteTest } from "./contexteTest";
import { nouvelElement } from "./listes";
import { nouvelleRecette } from "./recettes";
import { ajouterProvision, nouvelAnimal, nouvelleProvision } from "./mitsu";
import type { Produit } from "./stock";
import type { Liste } from "./types";

const AUJOURDHUI = "2026-10-18"; // un dimanche

function produit(nom: string, peremption: string | null, lieu: Produit["lieu"] = "frigo"): Produit {
  return { id: `p-${nom}`, nom, quantite: null, lieu, peremption, ajoutePar: null, creeLe: "2026-10-10T08:00:00.000Z" };
}

const courses: Liste = { id: "courses", nom: "Courses", icone: "🛒", type: "courses", creeLe: "2026-10-01T08:00:00.000Z" };

describe("le réglage du passage", () => {
  it("part désactivé, le dimanche à 17 h", () => {
    expect(reglageChef([])).toMatchObject({ actif: false, jour: 0, heure: 17 });
  });

  it("garde le jour et l'heure choisis, et revient au défaut s'ils sont invalides", () => {
    const ctx = contexteTest();
    const docs: DocChef[] = [reglerChef({ actif: true, jour: 6, heure: 10 }, [], ctx)];
    expect(reglageChef(docs)).toMatchObject({ actif: true, jour: 6, heure: 10 });
    expect(reglageChef([{ ...docs[0], jour: 9, heure: 3 } as DocChef])).toMatchObject({ jour: 0, heure: 17 });
    // Changer l'heure garde le jour déjà choisi.
    expect(reglerChef({ heure: 18 }, docs, ctx)).toMatchObject({ actif: true, jour: 6, heure: 18 });
  });

  it("passe à l'heure choisie, à Zurich, et seulement s'il est activé", () => {
    const reglage = { actif: true, jour: 0, heure: 17 };
    // 15 h UTC le 18 octobre 2026 = 17 h à Zurich (heure d'été).
    expect(estLHeureDuChef(new Date("2026-10-18T15:00:00Z"), reglage)).toBe(true);
    expect(estLHeureDuChef(new Date("2026-10-18T16:00:00Z"), reglage)).toBe(false);
    // En hiver, 17 h à Zurich = 16 h UTC.
    expect(estLHeureDuChef(new Date("2026-11-08T16:00:00Z"), reglage)).toBe(true);
    expect(estLHeureDuChef(new Date("2026-10-18T15:00:00Z"), { ...reglage, actif: false })).toBe(false);
    expect(estLHeureDuChef(new Date("2026-10-17T15:00:00Z"), reglage)).toBe(false);
  });

  it("annonce le prochain passage", () => {
    const reglage = { actif: true, jour: 0, heure: 17 };
    expect(prochainPassage(reglage, new Date("2026-10-18T10:00:00Z"))).toBe("aujourd'hui à 17 h");
    expect(prochainPassage(reglage, new Date("2026-10-18T18:00:00Z"))).toBe("dimanche à 17 h");
    expect(prochainPassage({ ...reglage, jour: 3, heure: 9 }, new Date("2026-10-18T10:00:00Z"))).toBe("mercredi à 9 h");
    expect(prochainPassage({ ...reglage, actif: false }, new Date())).toBeNull();
  });
});

describe("ce qu'il faut finir", () => {
  it("prend ce qui arrive à sa date dans les 5 jours, sans les produits déjà périmés", () => {
    const produits = [produit("Crème", "2026-10-23"), produit("Yaourts", "2026-10-19"), produit("Lait", "2026-10-17"), produit("Pâtes", "2027-03-01", "placard"), produit("Sel", null, "placard")];
    expect(produitsAFinir(produits, AUJOURDHUI).map((p) => p.nom)).toEqual(["Yaourts", "Crème"]);
  });

  it("met les produits pressés en tête du message, puis le stock par lieu et la liste actuelle", () => {
    const ctx = contexteTest();
    const message = messageChef({
      produits: [produit("Yaourts", "2026-10-19"), produit("Riz", null, "placard")],
      enCourses: [nouvelElement(courses, "2 l de lait", null, ctx)],
      aujourdhui: AUJOURDHUI,
    });
    expect(message).toContain("18 octobre 2026");
    expect(message).toMatch(/À finir vite :\n- Yaourts · demain/);
    expect(message).toMatch(/Placard :\n- Riz/);
    expect(message).toContain("- Lait · 2 l");
  });
});

describe("Mitsu", () => {
  it("prévient quand les croquettes s'épuisent dans les 10 jours, sans rien ajouter aux courses", () => {
    const ctx = contexteTest();
    let mitsu = nouvelAnimal("Mitsu", "2026-04-14", "2026-06-21", ctx);
    mitsu = ajouterProvision(mitsu, nouvelleProvision({ type: "croquettes", nom: "Kitten", quantite: 400, achete: AUJOURDHUI, parJour: 50 }, ctx));
    mitsu = ajouterProvision(mitsu, nouvelleProvision({ type: "litiere", nom: "Tigerino", quantite: 15000, achete: AUJOURDHUI, parJour: 100 }, ctx));
    expect(alertesMitsu([mitsu], AUJOURDHUI)).toEqual(["Mitsu n'a plus que 8 jours de croquettes : pense à commander sur zooplus."]);
  });
});

describe("la réponse du modèle", () => {
  it("décrit une réponse stricte", () => {
    expect(SCHEMA_CHEF.required).toEqual(["mot", "repas", "aAcheter"]);
    expect(SCHEMA_CHEF.properties.repas.items.required).toEqual(["titre", "description", "avecLeStock", "portions", "ingredients", "etapes"]);
    expect(SCHEMA_CHEF.properties.aAcheter.items.properties.rayon.enum).toContain("Fruits et légumes");
  });

  it("garde 5 repas au plus et écarte les champs vides ou les rayons inconnus", () => {
    const repas = Array.from({ length: 7 }, (_, i) => ({ titre: `Plat ${i}`, description: "Simple.", avecLeStock: ["Crème"] }));
    const p = lireProposition({
      mot: "  Une semaine pour finir la crème.  ",
      repas: [...repas, { titre: "", description: "" }],
      aAcheter: [{ texte: "Poireaux", quantite: "", rayon: "Fruits et légumes" }, { texte: "Gruyère", quantite: "200 g", rayon: "Fromagerie" }, { texte: " ", quantite: "", rayon: "Autre" }],
    })!;
    expect(p.mot).toBe("Une semaine pour finir la crème.");
    expect(p.repas).toHaveLength(5);
    expect(p.aAcheter).toEqual([
      { texte: "Poireaux", quantite: null, rayon: "Fruits et légumes" },
      { texte: "Gruyère", quantite: "200 g", rayon: null },
    ]);
  });

  it("refuse une réponse sans repas", () => {
    expect(lireProposition({ mot: "", repas: [], aAcheter: [] })).toBeNull();
    expect(lireProposition("texte")).toBeNull();
  });
});

describe("les ajouts aux courses", () => {
  it("ajoute au bon format, marqué du Chef, sans doublon ni rien pour le chat", () => {
    const ctx = contexteTest();
    const lait = nouvelElement(courses, "Lait", null, ctx);
    const ajouts = preparerAjouts(
      [
        { texte: "lait", quantite: "1 l", rayon: "Crèmerie" },
        { texte: "Poireaux", quantite: "2", rayon: "Fruits et légumes" },
        { texte: "poireaux", quantite: null, rayon: null },
        { texte: "Croquettes kitten", quantite: null, rayon: "Animaux" },
        { texte: "Litière", quantite: null, rayon: "Hygiène" },
        { texte: "Gruyère", quantite: "200 g", rayon: null },
      ],
      courses,
      [lait],
      ctx,
    );
    expect(ajouts.map((e) => [e.texte, e.quantite, e.rayon])).toEqual([
      ["Poireaux", "2", "Fruits et légumes"],
      ["Gruyère", "200 g", "Crèmerie"],
    ]);
    expect(ajouts.every((e) => e.source === "chef" && e.listeId === "courses" && !e.coche && e.ajoutePar === null)).toBe(true);
  });

  it("rajoute un article déjà acheté (coché) et s'arrête à 30", () => {
    const ctx = contexteTest();
    const lait = { ...nouvelElement(courses, "Lait", null, ctx), coche: true };
    expect(preparerAjouts([{ texte: "Lait", quantite: null, rayon: null }], courses, [lait], ctx)).toHaveLength(1);
    const beaucoup = Array.from({ length: 40 }, (_, i) => ({ texte: `Article ${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`, quantite: null, rayon: null }));
    expect(preparerAjouts(beaucoup, courses, [], ctx)).toHaveLength(AJOUTS_MAX);
  });
});

describe("les menus de la semaine", () => {
  function menu(ctx = contexteTest()) {
    const ajouts = preparerAjouts([{ texte: "Poireaux", quantite: "2", rayon: null }, { texte: "Crème", quantite: null, rayon: null }], courses, [], ctx);
    const m = nouveauMenu(
      {
        proposition: { mot: "Bonne semaine.", repas: [{ titre: "Gratin de poireaux", description: "Au four.", avecLeStock: [] }], recettes: [null], aAcheter: [] },
        ajouts,
        produits: [produit("Yaourts", "2026-10-19")],
        animaux: [],
        aujourdhui: AUJOURDHUI,
        lance: "auto",
      },
      ctx,
    );
    return { m, ajouts };
  }

  it("garde ce qui a été ajouté, les produits à finir et le jour", () => {
    const { m } = menu();
    expect(m).toMatchObject({ id: "menu-2026-10-18", semaine: AUJOURDHUI, lance: "auto", aFinir: ["Yaourts · demain"] });
    expect(m.ajouts.map((a) => a.texte)).toEqual(["Poireaux", "Crème"]);
    expect(notificationChef(m)).toEqual({ titre: "Les menus de la semaine sont prêts", corps: "Gratin de poireaux · Valide les soirs qui te vont : 2 articles à acheter." });
  });

  it("n'envoie rien aux courses avant qu'on valide un soir ou le menu", () => {
    const ctx = contexteTest();
    const recette = nouvelleRecette({ titre: "Gratin de poireaux", portions: 2, ingredients: [{ nom: "Poireaux", quantite: "2" }, { nom: "Crème", quantite: "2 dl" }, { nom: "Sel", quantite: null }], etapes: [], source: "chef" }, ctx);
    const m = nouveauMenu(
      {
        proposition: {
          mot: "",
          repas: [{ titre: "Gratin de poireaux", description: "", avecLeStock: [] }, { titre: "Soupe", description: "", avecLeStock: [] }],
          recettes: [null, null],
          aAcheter: [{ texte: "Poireaux", quantite: "2", rayon: null }, { texte: "Croquettes", quantite: null, rayon: null }, { texte: "Carottes", quantite: null, rayon: null }],
        },
        repas: [{ titre: "Gratin de poireaux", description: "", avecLeStock: [], recetteId: recette.id }, { titre: "Soupe", description: "", avecLeStock: [] }],
        produits: [produit("Crème", "2026-10-25")],
        animaux: [],
        aujourdhui: AUJOURDHUI,
        lance: "maintenant",
      },
      ctx,
    );
    expect(m.ajouts).toEqual([]);
    expect(m.aAcheter?.map((a) => a.texte)).toEqual(["Poireaux", "Carottes"]);

    // Un soir : seulement ce qui manque pour sa recette (la crème est au frigo, le sel ne compte pas).
    const soir = validerSoir({ menu: m, rang: 0, recette, produits: [produit("Crème", "2026-10-25")], liste: courses, elements: [], membreId: null }, ctx);
    expect(soir.ajouts.map((e) => [e.texte, e.source])).toEqual([["Poireaux", "chef"]]);
    expect(soir.menu.repas[0].valideLe).toBeTruthy();
    expect(soir.menu.valideLe).toBeUndefined();

    // Revenir dessus retire ses articles pas encore achetés.
    const retour = devaliderSoir(soir.menu, 0, soir.ajouts);
    expect(retour.aRetirer).toEqual([soir.ajouts[0].id]);
    expect(retour.menu.repas[0].valideLe).toBeUndefined();

    // Tout le menu : la liste du Chef, sans doublon avec ce qui est déjà parti.
    const tout = validerToutLeMenu(soir.menu, courses, soir.ajouts, ctx);
    expect(tout.ajouts.map((e) => e.texte)).toEqual(["Carottes"]);
    expect(tout.menu.valideLe).toBeTruthy();
    expect(tout.menu.repas.every((r) => r.valideLe)).toBe(true);
  });

  it("reste le menu en cours pendant 7 jours", () => {
    const { m } = menu();
    const docs: DocChef[] = [m, { ...m, id: "menu-2026-10-11", semaine: "2026-10-11" } as MenuSemaine];
    expect(menuDeLaSemaine(docs, "2026-10-24")?.id).toBe("menu-2026-10-18");
    expect(menuDeLaSemaine(docs, "2026-10-25")).toBeNull();
    expect(menuDeLaSemaine(docs, "2026-10-17")?.id).toBe("menu-2026-10-11");
  });

  it("relancé, ne remplace que ses propres articles pas encore cochés", () => {
    const { m, ajouts } = menu();
    const [poireaux, creme] = ajouts;
    const autre = nouvelElement(courses, "Pain", null, contexteTest());
    const elements = [poireaux, { ...creme, coche: true }, autre];
    expect(articlesARemplacer(m, elements)).toEqual([poireaux.id]);
    expect(articlesARemplacer(null, elements)).toEqual([]);
  });

  it("retire un article et sait lesquels sont encore sur la liste", () => {
    const { m, ajouts } = menu();
    expect(retirerAjout(m, ajouts[0].id).ajouts.map((a) => a.texte)).toEqual(["Crème"]);
    expect(etatDesAjouts(m, [ajouts[1]]).map((x) => x.element?.texte ?? null)).toEqual([null, "Crème"]);
  });
});

describe("les goûts du foyer", () => {
  it("retient l'avis sur un plat et le relit dans le message du dimanche", () => {
    const ctx = contexteTest();
    const aime = avisSurPlat("Gratin de courge", "aime", "melo", ctx);
    const non = avisSurPlat("Curry de lentilles", "non", "sarah", ctx);
    expect(aime).toMatchObject({ source: "bilan", cle: "chef:aime:gratin de courge", texte: "Plat apprécié, à refaire de temps en temps : Gratin de courge" });
    expect(avisDuPlat([aime, non], "Curry de lentilles")?.avis).toBe("non");
    expect(avisDuPlat([{ ...aime, refuse: true }], "Gratin de courge")).toBeNull();
    const message = messageChef({ produits: [], enCourses: [], aujourdhui: "2026-10-18", souvenirs: [aime, non, { ...aime, id: "x", texte: "Refusé", refuse: true }] });
    expect(message).toContain("Ce que le foyer aime, n'aime pas ou a l'habitude de faire :\n- Plat apprécié, à refaire de temps en temps : Gratin de courge\n- Plat à ne plus proposer : Curry de lentilles");
    expect(message).not.toContain("Refusé");
  });
});

describe("effacer ou valider le menu", () => {
  const menu: MenuSemaine = {
    id: "m1",
    type: "menu",
    semaine: AUJOURDHUI,
    mot: "",
    repas: [
      { titre: "Gratin", description: "", avecLeStock: [], recetteId: "r-gratin" },
      { titre: "Soupe", description: "", avecLeStock: [], recetteId: "r-soupe" },
      { titre: "Tarte", description: "", avecLeStock: [], recetteId: "r-tarte" },
    ],
    ajouts: [
      { elementId: "e1", texte: "Lait" },
      { elementId: "e2", texte: "Œufs" },
      { elementId: "e3", texte: "Pain" },
    ] as MenuSemaine["ajouts"],
    aFinir: [],
    alertesMitsu: [],
    lance: "maintenant",
    creeLe: "2026-10-18T08:00:00.000Z",
  };
  const recettes = [
    { id: "r-gratin", source: "chef", fois: 0, vue: 1 },
    { id: "r-soupe", source: "chef", fois: 2, vue: 3 },
    { id: "r-tarte", source: "photo", fois: 0, vue: 1 },
    { id: "r-autre", source: "chef", fois: 0, vue: 1 },
  ];
  const ctx = contexteTest();
  const el = (id: string, coche: boolean) => ({ ...nouvelElement(courses, id, null, ctx), id, coche });
  const elements = [el("e1", false), el("e2", true)];

  it("retire les articles pas cochés et les recettes jamais faites venues de ce menu", () => {
    expect(ceQuEfface(menu, recettes, elements)).toEqual({ recettes: ["r-gratin"], elements: ["e1"] });
  });

  it("un menu validé garde ses recettes", () => {
    const valide = validerMenu(menu, ctx);
    expect(valide.valideLe).toBeTruthy();
    expect(ceQuEfface(valide, recettes, elements)).toEqual({ recettes: [], elements: ["e1"] });
  });
});
