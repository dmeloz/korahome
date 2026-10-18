import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { creerFoyer } from "./foyer";
import {
  annulation,
  aConfirmer,
  appliquerActions,
  coutMicroChf,
  decrireAction,
  decrireFoyer,
  etatBudget,
  formaterChf,
  lireActions,
  OUTILS_JARVIS,
  questionPour,
  type ActionJarvis,
  type DonneesFoyer,
} from "./jarvis";
import { extraireRecette, lienAutorise, lienDans, lirePage, messageDemande, texteDePage } from "./jarvisModele";
import { nouvelElement, nouvelleListe } from "./listes";
import { ajouterPlante, nouvellePlante, nouvelleZone } from "./jardin";
import { nouvelAnimal } from "./mitsu";
import { nouveauSouvenir } from "./memoire";
import { nouveauProduit } from "./stock";
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

  it("tient le journal et le carnet de Mitsu, avec une seule annulation", () => {
    const { d, melo } = foyerDeTest();
    const actions = lireActions([
      { nom: "noter_journal", entree: { animal: "Mitsu", quoi: "vomi", note: "", jour: null } },
      { nom: "noter_journal", entree: { animal: "Mitsu", quoi: "inconnu", note: "", jour: null } },
      { nom: "noter_soin", entree: { animal: "mitsu", type: "vaccin", libelle: "Rappel typhus coryza", date: "2026-07-07", fait: true } },
      { nom: "noter_pesee", entree: { animal: "mitsu", grammes: 1800, jour: "2026-07-07" } },
    ]);
    expect(actions).toHaveLength(3);
    const r = appliquerActions(actions, d, melo, AUJOURDHUI, ctx());
    expect(r.echecs).toEqual([]);
    expect(r.faits).toEqual([
      "Noté pour Mitsu : a vomi.",
      "Carnet de Mitsu : rappel typhus coryza, fait le 2026-07-07.",
      "Pesée notée : Mitsu, 1,8 kg le 2026-07-07.",
    ]);
    expect(r.modifications).toHaveLength(1);
    const apres = r.modifications[0].apres as { journal: unknown[]; soins: unknown[]; pesees: { jour: string }[] };
    expect(apres.journal).toHaveLength(1);
    expect(apres.pesees.map((p) => p.jour)).toContain("2026-07-07");
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

describe("Jarvis au jardin", () => {
  function avecJardin(nombre: 1 | 2) {
    const { d, melo } = foyerDeTest();
    const c = contexteTest();
    const balcon = ajouterPlante(nouvelleZone({ nom: "Pots du balcon", type: "pot", exposition: "soleil", abri: "dehors" }, c), nouvellePlante("thym", AUJOURDHUI, null, c));
    const bac = nouvelleZone({ nom: "Grand bac", type: "bac", exposition: "mi-ombre", abri: "dehors" }, c);
    return { d: { ...d, zones: nombre === 1 ? [balcon] : [balcon, bac] }, melo };
  }

  it("lit les outils du jardin", () => {
    expect(lireActions([{ nom: "ajouter_plante", entree: { plantes: ["basilic", ""], zone: null } }])).toEqual([{ outil: "ajouter_plante", plantes: ["basilic"], zone: null }]);
    expect(lireActions([{ nom: "arrosage_fait", entree: { zone: "Grand bac" } }])).toEqual([{ outil: "arrosage_fait", zone: "Grand bac" }]);
    expect(OUTILS_JARVIS.map((o) => o.name)).toContain("ajouter_plante");
  });

  it("ajoute une plante reconnue dans la seule zone, ou dans celle qu'on nomme", () => {
    const seul = avecJardin(1);
    const r1 = appliquerActions([{ outil: "ajouter_plante", plantes: ["basilic"], zone: null }], seul.d, seul.melo, AUJOURDHUI, ctx());
    expect(r1.faits).toEqual(["Planté dans pots du balcon : basilic."]);
    expect(r1.modifications[0]).toMatchObject({ collection: "jardin", apres: { plantes: [{ nom: "Thym" }, { nom: "Basilic", espece: "basilic" }] } });

    const deux = avecJardin(2);
    expect(appliquerActions([{ outil: "ajouter_plante", plantes: ["menthe"], zone: null }], deux.d, deux.melo, AUJOURDHUI, ctx()).echecs).toEqual(["Dans quelle zone du jardin ?"]);
    const r2 = appliquerActions([{ outil: "ajouter_plante", plantes: ["menthe"], zone: "grand bac" }], deux.d, deux.melo, AUJOURDHUI, ctx());
    expect(r2.faits).toEqual(["Planté dans grand bac : menthe."]);
  });

  it("note l'arrosage de tout ce qui pousse, et se défait", () => {
    const { d, melo } = avecJardin(2);
    const r = appliquerActions([{ outil: "arrosage_fait", zone: null }], d, melo, AUJOURDHUI, ctx());
    // Le grand bac est vide : rien à arroser.
    expect(r.faits).toEqual(["Arrosage noté : pots du balcon."]);
    expect(r.modifications[0]).toMatchObject({ collection: "jardin", apres: { arroseeLe: AUJOURDHUI, arrosePar: melo } });
    expect(annulation(r.modifications)).toEqual([{ collection: "jardin", id: d.zones[0].id, remettre: d.zones[0] }]);
  });

  it("parle du jardin à Jarvis quand il y en a un", () => {
    const { d, melo } = avecJardin(1);
    expect(decrireFoyer(d, melo, AUJOURDHUI)).toContain("- Pots du balcon (pot, plein soleil, dehors) : thym");
    expect(decrireFoyer(foyerDeTest().d, melo, AUJOURDHUI)).not.toContain("Jardin");
  });
});

describe("Jarvis apprend, modifie et note ses souhaits", () => {
  it("lit les nouveaux outils et ignore ce qui est incomplet", () => {
    expect(
      lireActions([
        { nom: "retenir", entree: { fait: " Sarah n'aime pas la coriandre ", propose: false } },
        { nom: "oublier", entree: { fait: "" } },
        { nom: "modifier_tache", entree: { titre: "Litière", nouveau_titre: null, echeance: null } },
        { nom: "modifier_tache", entree: { titre: "Litière", nouveau_titre: null, echeance: "2026-10-15" } },
        { nom: "retirer_du_stock", entree: { produits: ["lait", ""] } },
        { nom: "noter_souhait", entree: { demande: "Combien on a dépensé ce mois ?", manque: "Lire le budget" } },
      ]),
    ).toEqual([
      { outil: "retenir", fait: "Sarah n'aime pas la coriandre", propose: false },
      { outil: "modifier_tache", titre: "Litière", nouveauTitre: null, echeance: "2026-10-15" },
      { outil: "retirer_du_stock", produits: ["lait"] },
      { outil: "noter_souhait", demande: "Combien on a dépensé ce mois ?", manque: "Lire le budget" },
    ]);
    expect(OUTILS_JARVIS.map((o) => o.name)).toEqual(expect.arrayContaining(["retenir", "oublier", "supprimer_tache", "retirer_du_stock", "modifier_tache", "noter_souhait"]));
  });

  it("demande le oui de la personne avant de supprimer ou de retenir ce qu'il a remarqué seul", () => {
    expect(aConfirmer({ outil: "retenir", fait: "x", propose: false })).toBe(false);
    expect(aConfirmer({ outil: "retenir", fait: "On fait les courses le samedi", propose: true })).toBe(true);
    expect(aConfirmer({ outil: "supprimer_tache", titre: "Litière" })).toBe(true);
    expect(aConfirmer({ outil: "retirer_du_stock", produits: ["lait"] })).toBe(true);
    expect(aConfirmer({ outil: "oublier", fait: "x" })).toBe(true);
    expect(aConfirmer({ outil: "ajouter_courses", articles: ["lait"] })).toBe(false);
    expect(questionPour({ outil: "retenir", fait: "On fait les courses le samedi", propose: true })).toEqual({
      question: "J'ai remarqué : « On fait les courses le samedi ». Je le retiens ?",
      oui: "Retenir",
    });
  });

  it("retient un fait une seule fois, l'oublie, et en parle à chaque demande", () => {
    const { d, melo } = foyerDeTest();
    const r = appliquerActions([{ outil: "retenir", fait: "Sarah n'aime pas la coriandre", propose: false }], d, melo, AUJOURDHUI, ctx());
    expect(r.faits).toEqual(["Retenu : sarah n'aime pas la coriandre."]);
    const souvenir = r.modifications[0].apres;
    expect(r.modifications[0]).toMatchObject({ collection: "memoire", avant: null, apres: { source: "demande", auteur: melo } });

    const avecMemoire = { ...d, souvenirs: [souvenir as ReturnType<typeof nouveauSouvenir>] };
    expect(decrireFoyer(avecMemoire, melo, AUJOURDHUI)).toContain("- Sarah n'aime pas la coriandre");
    expect(appliquerActions([{ outil: "retenir", fait: "sarah n’aime pas la coriandre", propose: true }], avecMemoire, melo, AUJOURDHUI, ctx()).modifications).toHaveLength(0);

    const oubli = appliquerActions([{ outil: "oublier", fait: "coriandre" }], avecMemoire, melo, AUJOURDHUI, ctx());
    expect(oubli.modifications).toEqual([{ collection: "memoire", avant: souvenir, apres: souvenir, supprime: true }]);
    // Annuler remet le souvenir oublié.
    expect(annulation(oubli.modifications)).toEqual([{ collection: "memoire", id: souvenir.id, remettre: souvenir }]);
    expect(appliquerActions([{ outil: "oublier", fait: "le chat dort" }], avecMemoire, melo, AUJOURDHUI, ctx()).echecs).toEqual(["Je n'avais pas retenu « le chat dort »."]);
  });

  it("décale, renomme et supprime une tâche", () => {
    const { d, melo } = foyerDeTest();
    const litiere = d.taches[0];
    const m = appliquerActions([{ outil: "modifier_tache", titre: "litière", nouveauTitre: null, echeance: "2026-10-15" }], d, melo, AUJOURDHUI, ctx());
    expect(m.modifications[0]).toMatchObject({ collection: "taches", avant: litiere, apres: { titre: "Litière", echeance: "2026-10-15" } });
    const s = appliquerActions([{ outil: "supprimer_tache", titre: "litière" }], d, melo, AUJOURDHUI, ctx());
    expect(s.faits).toEqual(["Tâche supprimée : litière."]);
    expect(s.modifications).toEqual([{ collection: "taches", avant: litiere, apres: litiere, supprime: true }]);
  });

  it("retire du stock ce qui est fini", () => {
    const { d, melo } = foyerDeTest();
    const lait = nouveauProduit({ texte: "1 l lait", lieu: "frigo", peremption: null }, melo, ctx());
    const r = appliquerActions([{ outil: "retirer_du_stock", produits: ["lait", "beurre"] }], { ...d, produits: [lait] }, melo, AUJOURDHUI, ctx());
    expect(r.modifications).toEqual([{ collection: "stock", avant: lait, apres: lait, supprime: true }]);
    expect(r.echecs).toEqual(["« beurre » n'est pas dans le stock."]);
  });

  it("note un souhait pour Claude dans les retours de test, sans doublon", () => {
    const { d, melo } = foyerDeTest();
    const action: ActionJarvis = { outil: "noter_souhait", demande: "Combien on a dépensé ce mois ?", manque: "Lire le budget" };
    const r = appliquerActions([action], { ...d, version: "0.0.16" }, melo, AUJOURDHUI, ctx());
    expect(r.faits).toEqual(["Souhait noté pour Claude."]);
    const retour = r.modifications[0].apres;
    expect(retour).toMatchObject({
      texte: "Souhait pour Jarvis : Combien on a dépensé ce mois ? (il faudrait : Lire le budget)",
      genre: "idee",
      ecran: "Jarvis",
      version: "0.0.16",
      auteur: melo,
    });
    const encore = appliquerActions([action], { ...d, retours: [retour as never] }, melo, AUJOURDHUI, ctx());
    expect(encore.modifications).toHaveLength(0);
  });

  it("donne à Jarvis les derniers soins faits et les habitudes d'achat", () => {
    const { d, melo } = foyerDeTest();
    const mitsu = { ...d.animaux[0], soins: [{ id: "s1", type: "vaccin" as const, libelle: "Vaccin typhus", date: "2026-09-01", fait: true }] };
    expect(decrireFoyer({ ...d, animaux: [mitsu] }, melo, AUJOURDHUI)).toContain("Carnet de Mitsu, derniers soins faits : Vaccin typhus le 2026-09-01.");
  });
});

describe("Jarvis et l'agenda", () => {
  it("met un rendez-vous dans l'agenda, pour la bonne personne, sans doublon, et en parle ensuite", () => {
    const { d, sarah } = foyerDeTest();
    const actions = lireActions([
      {
        nom: "ajouter_evenement",
        entree: { titre: "Dentiste", jour: "2026-10-15", fin: null, heure: "14:30", heure_fin: "25:00", pour: "sarah", categorie: "rdv", repetition: "aucune", lieu: "Renens" },
      },
      { nom: "ajouter_evenement", entree: { titre: "Sans date", jour: "jeudi" } },
    ]);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ heure: "14:30", heureFin: null });
    const r = appliquerActions(actions, d, null, AUJOURDHUI, ctx());
    expect(r.faits).toEqual(["Dans l'agenda : dentiste, jeudi 15 oct. à 14:30, pour Sarah."]);
    const evenement = r.modifications[0].apres as { pour: string; lieu: string };
    expect(evenement).toMatchObject({ pour: sarah, lieu: "Renens" });

    const avecAgenda = { ...d, agenda: [r.modifications[0].apres as never] };
    expect(appliquerActions(actions, avecAgenda, null, AUJOURDHUI, ctx()).faits[0]).toMatch(/^Déjà dans l'agenda/);
    expect(decrireFoyer(avecAgenda, null, AUJOURDHUI)).toContain("- Dentiste : 2026-10-15 à 14:30, Sarah, Renens");
  });

  it("demande le oui avant de retirer un événement, et ne touche pas à ce qui vient d'iCloud", () => {
    const { d } = foyerDeTest();
    const ajout = appliquerActions(lireActions([{ nom: "ajouter_evenement", entree: { titre: "Ciné", jour: "2026-10-16", categorie: "sortie" } }]), d, null, AUJOURDHUI, ctx());
    const cine = ajout.modifications[0].apres as never as { id: string };
    const icloud = { ...(cine as object), id: "icloud-x", titre: "Réunion", source: "iCloud de Melo" };
    const avecAgenda = { ...d, agenda: [cine as never, icloud as never] };
    const [retirer] = lireActions([{ nom: "supprimer_evenement", entree: { titre: "ciné", jour: null } }]);
    expect(aConfirmer(retirer)).toBe(true);
    expect(questionPour(retirer).question).toBe("Retirer « ciné » de l'agenda ?");
    const r = appliquerActions([retirer], avecAgenda, null, AUJOURDHUI, ctx());
    expect(r.modifications).toEqual([{ collection: "agenda", avant: cine, apres: cine, supprime: true }]);
    const [reunion] = lireActions([{ nom: "supprimer_evenement", entree: { titre: "Réunion", jour: null } }]);
    expect(appliquerActions([reunion], avecAgenda, null, AUJOURDHUI, ctx()).echecs).toEqual(["Je ne trouve pas « Réunion » dans l'agenda."]);
  });
});
