import { describe, expect, it } from "vitest";
import { avisSurPlat, lireProposition, nouveauMenu, recettesDuChef, messageChef } from "./chef";
import { contexteTest } from "./contexteTest";
import { appliquerActions, decrireFoyer, lireActions, OUTILS_JARVIS, type DonneesFoyer } from "./jarvis";
import { extraireRecette } from "./jarvisModele";
import { creerFoyer } from "./foyer";
import { nouvelElement, nouvelleListe } from "./listes";
import {
  ajusterQuantite,
  apprendreRecette,
  decrireDisponibilite,
  disponibilite,
  ecrireIngredient,
  estDeBase,
  ingredientsPour,
  lireBrouillon,
  lireLigneIngredient,
  marquerCuisinee,
  modifierRecette,
  nouvelleRecette,
  ordonnerRecettes,
  preparerCourses,
  prevoirRecette,
  produitPour,
  recetteDuSoir,
  recettesDe,
  septProchainsJours,
  soirsPrevus,
  type BrouillonRecette,
} from "./recettes";
import { creerProduit, type Lieu } from "./stock";

const AUJOURDHUI = "2026-10-19";
const produit = (nom: string, lieu: Lieu = "frigo") => creerProduit({ nom, nombre: null, unite: null, lieu, peremption: null }, null, contexteTest());

const gratin: BrouillonRecette = {
  titre: "Gratin dauphinois",
  portions: 4,
  ingredients: [
    { nom: "Pommes de terre", quantite: "1 kg" },
    { nom: "Crème entière", quantite: "5 dl" },
    { nom: "Ail", quantite: "1 gousse" },
    { nom: "Gruyère", quantite: "100 g" },
    { nom: "Sel", quantite: null },
    { nom: "Noix de muscade", quantite: null },
  ],
  etapes: ["Éplucher et trancher les pommes de terre.", "Cuire 1 h à 180 °C."],
  source: "lien",
  lien: "https://www.bettybossi.ch/fr/recette/gratin",
};

describe("une recette se lit sans faire confiance", () => {
  it("garde le titre, les ingrédients, les étapes et le lien https", () => {
    const b = lireBrouillon({ titre: "  gratin  ", portions: 4, ingredients: [{ nom: "crème", quantite: "" }, { nom: " ", quantite: "2" }], etapes: ["Cuire.", ""], lien: "http://x.ch" }, "jarvis")!;
    expect(b).toEqual({ titre: "Gratin", portions: 4, ingredients: [{ nom: "Crème", quantite: null }], etapes: ["Cuire."], source: "jarvis", lien: null });
    expect(lireBrouillon({ titre: "Vide", ingredients: [] }, "chef")).toBeNull();
    expect(lireBrouillon({ titre: "X", portions: 99, ingredients: ["2 oeufs"], etapes: [] }, "main")!.portions).toBeNull();
  });

  it("lit une ligne écrite à la main", () => {
    expect(lireLigneIngredient("200 g de lardons fumés")).toEqual({ nom: "Lardons fumés", quantite: "200 g" });
    expect(lireLigneIngredient("- 1/2 citron")).toEqual({ nom: "Citron", quantite: "1/2" });
    expect(lireLigneIngredient("2 c. à soupe d'huile d'olive")).toEqual({ nom: "Huile d'olive", quantite: "2 c. à soupe" });
    expect(lireLigneIngredient("3 oeufs")).toEqual({ nom: "Oeufs", quantite: "3" });
    expect(lireLigneIngredient("sel")).toEqual({ nom: "Sel", quantite: null });
    expect(lireLigneIngredient("  ")).toBeNull();
    expect(ecrireIngredient({ nom: "Lardons", quantite: "200 g" })).toBe("200 g lardons");
  });
});

describe("les portions", () => {
  it("recalcule les quantités pour un autre nombre de personnes", () => {
    expect(ajusterQuantite("200 g", 2, 6)).toBe("600 g");
    expect(ajusterQuantite("1 kg", 4, 2)).toBe("½ kg");
    expect(ajusterQuantite("3", 4, 2)).toBe("1½");
    expect(ajusterQuantite("1/2", 2, 4)).toBe("1");
    expect(ajusterQuantite("1,5 dl", 2, 4)).toBe("3 dl");
    expect(ajusterQuantite("125 g", 2, 3)).toBe("190 g");
    expect(ajusterQuantite("une pincée", 2, 6)).toBe("une pincée");
    expect(ajusterQuantite("800 g", 2, 4)).toBe("1,6 kg");
    expect(ajusterQuantite("1 gousse", 2, 4)).toBe("2 gousses");
    expect(ajusterQuantite("1 c. à soupe", 2, 4)).toBe("2 c. à soupe");
    expect(ajusterQuantite(null, 2, 6)).toBeNull();
    expect(ingredientsPour(nouvelleRecette(gratin, contexteTest()), 2)[0]).toEqual({ nom: "Pommes de terre", quantite: "½ kg" });
  });
});

describe("la base se remplit toute seule", () => {
  it("crée la recette avec sa source et deux personnes par défaut", () => {
    const r = nouvelleRecette({ ...gratin, portions: null }, contexteTest());
    expect(r).toMatchObject({ type: "recette", titre: "Gratin dauphinois", cle: "gratin dauphinois", portions: 2, source: "lien", vue: 1, fois: 0, prevuLe: null });
    expect(r.id).toMatch(/^recette-/);
  });

  it("ne copie pas une recette qui revient : elle monte, et ce qu'on a écrit reste", () => {
    const ctx = contexteTest();
    const a = nouvelleRecette({ ...gratin, etapes: [], source: "main", lien: null }, ctx);
    const { recette, avant } = apprendreRecette([a], { ...gratin, titre: "gratin Dauphinois!", ingredients: [{ nom: "Autre", quantite: null }], source: "chef" }, ctx);
    expect(avant).toBe(a);
    expect(recette).toMatchObject({ id: a.id, vue: 2, source: "main", ingredients: a.ingredients, etapes: gratin.etapes, lien: gratin.lien });
    expect(apprendreRecette([a], { ...gratin, titre: "Risotto" }, ctx).avant).toBeNull();
  });

  it("se modifie, se pose sur un soir et compte les fois où on l'a faite", () => {
    const ctx = contexteTest();
    const r = nouvelleRecette(gratin, ctx);
    expect(modifierRecette(r, { titre: "Gratin de maman", portions: 6, ingredients: r.ingredients, etapes: [] }, ctx)).toMatchObject({ titre: "Gratin de maman", cle: "gratin de maman", portions: 6, lien: gratin.lien });
    const prevue = prevoirRecette(r, AUJOURDHUI, ctx);
    expect(recetteDuSoir([prevue], AUJOURDHUI)).toBe(prevue);
    const faite = marquerCuisinee(prevue, AUJOURDHUI, ctx);
    expect(faite).toMatchObject({ fois: 1, derniereFois: AUJOURDHUI, prevuLe: null });
    const plusTard = prevoirRecette(r, "2026-10-22", ctx);
    expect(marquerCuisinee(plusTard, AUJOURDHUI, ctx).prevuLe).toBe("2026-10-22");
  });

  it("vit dans la collection des menus, à côté des menus du Chef", () => {
    const r = nouvelleRecette(gratin, contexteTest());
    expect(recettesDe([{ id: "reglage", type: "reglage" }, r])).toEqual([r]);
  });
});

describe("ce qu'on a à la maison", () => {
  const stock = [produit("Crème"), produit("Pommes de terre", "placard"), produit("Pâtes", "placard")];

  it("trouve le produit du stock qui correspond, sans compter le sel ni les épices", () => {
    expect(produitPour("Crème entière", stock)?.nom).toBe("Crème");
    expect(produitPour("Pomme de terre", stock)?.nom).toBe("Pommes de terre");
    expect(produitPour("Gruyère", stock)).toBeNull();
    expect(estDeBase("Sel")).toBe(true);
    expect(estDeBase("Huile d'olive")).toBe(true);
    expect(estDeBase("Noix de muscade")).toBe(true);
    expect(estDeBase("Crème")).toBe(false);
    const d = disponibilite(nouvelleRecette(gratin, contexteTest()), stock);
    expect(d).toMatchObject({ total: 4, aLaMaison: 2 });
    expect(d.manquants.map((i) => i.nom)).toEqual(["Ail", "Gruyère"]);
    expect(decrireDisponibilite(d)).toBe("2 sur 4 à la maison");
    expect(decrireDisponibilite({ total: 2, aLaMaison: 2, manquants: [] })).toBe("Tout est à la maison");
  });

  it("met aux courses seulement ce qui manque, pour le bon nombre de personnes", () => {
    const ctx = contexteTest();
    const courses = nouvelleListe("Courses", "panier", "courses", ctx);
    const ail = nouvelElement(courses, "ail", null, ctx);
    const ajouts = preparerCourses(nouvelleRecette(gratin, ctx), 8, stock, courses, [ail], "m1", ctx);
    expect(ajouts.map((e) => [e.texte, e.quantite])).toEqual([["Gruyère", "200 g"]]);
    expect(ajouts[0]).toMatchObject({ listeId: courses.id, coche: false, ajoutePar: "m1", rayon: "Crèmerie" });
  });
});

describe("ranger et choisir", () => {
  const ctx = contexteTest();
  const g = nouvelleRecette(gratin, ctx);
  const pates = { ...nouvelleRecette({ titre: "Pâtes à la crème", ingredients: [{ nom: "Pâtes", quantite: "200 g" }, { nom: "Crème", quantite: "2 dl" }], etapes: [], source: "chef" }, ctx), vue: 3 };
  const curry = { ...nouvelleRecette({ titre: "Curry", ingredients: [{ nom: "Poulet", quantite: null }, { nom: "Lait de coco", quantite: null }, { nom: "Riz", quantite: null }], etapes: [], source: "chef" }, ctx), fois: 2 };
  const stock = [produit("Crème"), produit("Pâtes", "placard")];

  it("met devant celles qu'on aime et qu'on fait souvent", () => {
    const aime = (r: { titre: string }) => r.titre === "Gratin dauphinois";
    expect(ordonnerRecettes([pates, curry, g], stock, "toutes", aime).map((r) => r.titre)).toEqual(["Gratin dauphinois", "Curry", "Pâtes à la crème"]);
    expect(ordonnerRecettes([pates, curry, g], stock, "aimees", aime).map((r) => r.titre)).toEqual(["Gratin dauphinois"]);
  });

  it("« Ce soir avec ce qu'on a » : deux courses au plus, celles sans courses d'abord", () => {
    const ordre = ordonnerRecettes([curry, g, pates], stock, "ce-soir", () => false, (r) => r.titre === "Curry");
    expect(ordre.map((r) => r.titre)).toEqual(["Pâtes à la crème"]);
    const avecAil = [...stock, produit("Pommes de terre"), produit("Ail")];
    expect(ordonnerRecettes([curry, g, pates], avecAil, "ce-soir", () => false).map((r) => r.titre)).toEqual(["Pâtes à la crème", "Gratin dauphinois"]);
  });

  it("montre les soirs prévus de la semaine", () => {
    expect(septProchainsJours(AUJOURDHUI)).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    const prevues = [prevoirRecette(g, "2026-10-22", ctx), prevoirRecette(pates, "2026-10-20", ctx), prevoirRecette(curry, "2026-10-30", ctx)];
    expect(soirsPrevus(prevues, AUJOURDHUI).map((s) => [s.jour, s.recette.titre])).toEqual([["2026-10-20", "Pâtes à la crème"], ["2026-10-22", "Gratin dauphinois"]]);
  });
});

describe("le Chef remplit la base", () => {
  const reponse = {
    mot: "Une semaine douce.",
    repas: [
      { titre: "Gratin dauphinois", description: "Au four.", avecLeStock: ["Crème"], portions: 2, ingredients: [{ nom: "Pommes de terre", quantite: "500 g" }], etapes: ["Trancher.", "Cuire."] },
      { titre: "Soupe", description: "Vite faite.", avecLeStock: [], portions: 2, ingredients: [], etapes: [] },
    ],
    aAcheter: [],
  };

  it("relit la recette de chaque repas, et rien quand ses ingrédients manquent", () => {
    const p = lireProposition(reponse)!;
    expect(p.recettes[0]).toMatchObject({ titre: "Gratin dauphinois", portions: 2, source: "chef", etapes: ["Trancher.", "Cuire."] });
    expect(p.recettes[1]).toBeNull();
  });

  it("range chaque repas dans les recettes, relié à sa fiche, sans copier celle qu'on a déjà", () => {
    const ctx = contexteTest();
    const deja = nouvelleRecette({ ...gratin, source: "main" }, ctx);
    const p = lireProposition(reponse)!;
    const { repas, recettes } = recettesDuChef(p, [deja], ctx);
    expect(recettes).toHaveLength(1);
    expect(recettes[0]).toMatchObject({ id: deja.id, vue: 2, ingredients: deja.ingredients });
    expect(repas[0].recetteId).toBe(deja.id);
    expect(repas[1].recetteId).toBeUndefined();
    const menu = nouveauMenu({ proposition: p, repas, ajouts: [], produits: [], animaux: [], aujourdhui: AUJOURDHUI, lance: "maintenant" }, ctx);
    expect(menu.repas[0].recetteId).toBe(deja.id);
  });

  it("propose au Chef les recettes que le foyer aime", () => {
    const ctx = contexteTest();
    const r = nouvelleRecette(gratin, ctx);
    const aime = avisSurPlat("Gratin dauphinois", "aime", null, ctx);
    const message = messageChef({ produits: [], enCourses: [], aujourdhui: AUJOURDHUI, souvenirs: [aime], recettes: [r] });
    expect(message).toContain("Recettes du foyer qu'il aime refaire :\n- Gratin dauphinois");
    expect(messageChef({ produits: [], enCourses: [], aujourdhui: AUJOURDHUI, recettes: [r] })).not.toContain("aime refaire");
  });
});

describe("Jarvis et les recettes", () => {
  function donnees(): DonneesFoyer {
    const ctx = contexteTest();
    return { foyer: creerFoyer("Cassa", ["Melo", "Sarah"], ctx), listes: [], elements: [], taches: [], animaux: [], produits: [produit("Crème")], menus: [] };
  }

  it("sait ranger une recette lue sur un lien, une photo ou dictée", () => {
    expect(OUTILS_JARVIS.map((o) => o.name)).toContain("enregistrer_recette");
    const [action] = lireActions([{ nom: "enregistrer_recette", entree: { titre: "Gratin", portions: 4, ingredients: [{ nom: "Crème", quantite: "2 dl" }], etapes: ["Cuire."], lien: "https://fooby.ch/gratin" } }]);
    expect(action).toEqual({ outil: "enregistrer_recette", recette: { titre: "Gratin", portions: 4, ingredients: [{ nom: "Crème", quantite: "2 dl" }], etapes: ["Cuire."], source: "lien", lien: "https://fooby.ch/gratin" } });
    expect(lireActions([{ nom: "enregistrer_recette", entree: { titre: "Rien", ingredients: [] } }])).toEqual([]);
  });

  it("la range dans la base, une seule fois", () => {
    const d = donnees();
    const action = { outil: "enregistrer_recette" as const, recette: { ...gratin, source: "jarvis" as const } };
    const r1 = appliquerActions([action], d, null, AUJOURDHUI, contexteTest());
    expect(r1.faits).toEqual(["« Gratin dauphinois » rangée dans vos recettes."]);
    expect(r1.modifications[0]).toMatchObject({ collection: "menus", avant: null, apres: { titre: "Gratin dauphinois", type: "recette" } });
    const r2 = appliquerActions([action], { ...d, menus: [r1.modifications[0].apres as never] }, null, AUJOURDHUI, contexteTest());
    expect(r2.faits[0]).toContain("était déjà dans vos recettes");
  });

  it("connaît les recettes du foyer pour « qu'est-ce qu'on mange ce soir »", () => {
    const d = donnees();
    const r = nouvelleRecette(gratin, contexteTest());
    const etat = decrireFoyer({ ...d, menus: [r] }, null, AUJOURDHUI);
    expect(etat).toContain("Recettes du foyer (1)");
    expect(etat).toContain("- Gratin dauphinois : 1 sur 4 à la maison, manque pommes de terre, ail, gruyère");
  });

  it("lit les étapes d'une recette derrière un lien", () => {
    const page = `<script type="application/ld+json">{"@type":"Recipe","name":"Soupe","recipeIngredient":["1 poireau"],
      "recipeInstructions":[{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"Couper le poireau."},{"@type":"HowToStep","text":"Cuire 20 min."}]}]}</script>`;
    expect(extraireRecette(page)).toEqual({ titre: "Soupe", ingredients: ["1 poireau"], portions: null, etapes: ["Couper le poireau.", "Cuire 20 min."] });
  });
});
