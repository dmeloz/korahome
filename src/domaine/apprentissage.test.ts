import { describe, expect, it } from "vitest";
import {
  accepterEquilibre,
  ajusterRythme,
  rythmeProche,
  ajouterUsage,
  apprentissages,
  bilanAOuvrir,
  bilanDeLaSemaine,
  equilibreDesTaches,
  equilibreVisible,
  heureConseillee,
  nettoyerUsages,
  ordreVivant,
  remarqueDuJour,
  semaineDe,
  souvenirAppris,
  widgetsDelaisses,
  type EntreeApprentissage,
  type Usage,
} from "./apprentissage";
import { noterFin, souventJete, type ProduitHabituel } from "./catalogue";
import { contexteTest } from "./contexteTest";
import { creerFoyer } from "./foyer";
import { noterAchat } from "./habitudes";
import { nouvelElement, nouvelleListe } from "./listes";
import { decrireMemoire } from "./memoire";
import { ajouterProvision, definirCommande, nouvelAnimal, nouvelleProvision, paquetFini } from "./mitsu";
import { marquerFaite, nouvelleTache } from "./taches";
import type { Liste } from "./types";

const ctx = contexteTest();
const u = (jour: string, heure: number, type: Usage["type"], cle: string): Usage => ({ jour, heure, type, cle });

function entree(champs: Partial<EntreeApprentissage>): EntreeApprentissage {
  return { listes: [], elements: [], taches: [], catalogue: [], animaux: [], souvenirs: [], usages: [], disposition: [], heureRappel: null, decisionsPerso: {}, aujourdhui: "2026-10-18", ...champs };
}

/** Une liste de courses où le lait, le pain et les œufs sont achetés chaque samedi. */
function coursesDuSamedi(): Liste {
  let liste = nouvelleListe("Courses", "panier", "courses", ctx);
  const articles = ["Lait", "Pain", "Œufs"].map((t) => nouvelElement(liste, t, null, ctx));
  for (const jour of ["2026-09-19", "2026-09-26", "2026-10-03", "2026-10-10", "2026-10-17"]) {
    for (const a of articles) liste = noterAchat(liste, a, jour);
  }
  return liste;
}

describe("l'usage de ce téléphone", () => {
  it("garde deux mois d'usage et ignore ce qui est abîmé", () => {
    const vieux = u("2026-08-01", 9, "widget", "taches");
    expect(ajouterUsage([vieux], u("2026-10-18", 9, "widget", "courses"))).toEqual([u("2026-10-18", 9, "widget", "courses")]);
    expect(nettoyerUsages([vieux, { jour: "hier", heure: 9 }, null])).toEqual([vieux]);
    expect(nettoyerUsages("rien")).toEqual([]);
  });
});

describe("l'accueil vivant", () => {
  const ordre = ["taches", "courses", "chef"] as const;
  it("met en tête, après les urgents, ce qu'on ouvre le plus à ce moment de la journée", () => {
    const soirs = Array.from({ length: 5 }, (_, i) => u(`2026-10-1${i}`, 19, "widget", "chef"));
    expect(ordreVivant([...ordre], new Set(), soirs, 20, "2026-10-18")).toEqual(["chef", "taches", "courses"]);
    expect(ordreVivant([...ordre], new Set(["courses"]), soirs, 20, "2026-10-18")).toEqual(["courses", "chef", "taches"]);
    // Le matin, ces ouvertures du soir ne comptent pas.
    expect(ordreVivant([...ordre], new Set(), soirs, 8, "2026-10-18")).toEqual([...ordre]);
  });

  it("ne bouge rien tant qu'il n'y a pas assez d'ouvertures", () => {
    expect(ordreVivant([...ordre], new Set(), [u("2026-10-17", 19, "widget", "chef")], 20, "2026-10-18")).toEqual([...ordre]);
  });

  it("repère les widgets pas ouverts depuis trois semaines, quand on a ce recul", () => {
    const usages = [u("2026-09-20", 9, "widget", "jardin"), u("2026-10-15", 9, "widget", "taches")];
    expect(widgetsDelaisses(["taches", "jardin"], usages, "2026-10-18")).toEqual(["jardin"]);
    expect(widgetsDelaisses(["taches", "jardin"], usages.slice(1), "2026-10-18")).toEqual([]);
  });
});

describe("les rappels au bon moment", () => {
  const taches = [18, 19, 19, 20, 19].map((h, i) => u(`2026-10-1${i}`, h, "tache", "t"));
  it("propose le rappel une heure avant le moment habituel des tâches", () => {
    expect(heureConseillee(taches, 8, "2026-10-18")).toBe(18);
    expect(heureConseillee(taches, 17, "2026-10-18")).toBeNull();
    expect(heureConseillee(taches.slice(0, 4), 8, "2026-10-18")).toBeNull();
  });
});

describe("ce que Kora apprend", () => {
  it("remarque le jour des courses, ce qui se rachète, et ne repropose pas ce qui est décidé", () => {
    const courses = coursesDuSamedi();
    const appris = apprentissages(entree({ listes: [courses] }));
    expect(appris[0].cle).toBe("panier:6");
    expect(appris[0].fait).toBe("Les courses se font plutôt le samedi, avec presque toujours : lait, pain, œufs.");
    expect(appris.filter((a) => a.cle.startsWith("rachat:")).map((a) => a.fait)).toContain("Le foyer rachète lait tous les 7 jours environ.");

    const refuse = souvenirAppris(appris[0], false, "melo", ctx);
    expect(refuse).toMatchObject({ source: "bilan", cle: "panier:6", refuse: true });
    expect(apprentissages(entree({ listes: [courses], souvenirs: [refuse] })).map((a) => a.cle)).not.toContain("panier:6");
    // Un refus n'entre jamais dans ce que relit Jarvis.
    expect(decrireMemoire([refuse])).toEqual(["Ce que tu sais du foyer : rien encore."]);
  });

  it("propose le vrai rythme d'une tâche qui se fait moins souvent que prévu", () => {
    let t = nouvelleTache("Arroser", { unite: "semaine", tous: 1 }, "2026-09-21", ctx);
    for (const jour of ["2026-09-23", "2026-10-03", "2026-10-13", "2026-10-23"]) t = marquerFaite(t, "melo", jour, ctx);
    const [rythme] = apprentissages(entree({ taches: [t] }));
    expect(rythme).toMatchObject({ portee: "foyer", action: { type: "rythmeTache", tacheId: t.id, recurrence: { unite: "jour", tous: 10 } } });
    expect(rythme.texte).toBe("« Arroser » est prévue chaque semaine, mais se fait plutôt tous les 10 jours. La passer à ce rythme, pour qu'elle ne soit plus toujours en retard ?");
    // À son rythme, rien à dire.
    let juste = nouvelleTache("Litière", { unite: "semaine", tous: 1 }, "2026-09-21", ctx);
    for (const jour of ["2026-09-21", "2026-09-28", "2026-10-06", "2026-10-12"]) juste = marquerFaite(juste, "melo", jour, ctx);
    expect(apprentissages(entree({ taches: [juste] }))).toEqual([]);
  });

  it("repère ce qui finit souvent périmé", () => {
    const yaourts: ProduitHabituel = { id: "h", nom: "Yaourts", cle: "yaourt", lieu: "frigo", nombre: 4, unite: "piece", dureeJours: 14, code: null, image: null, fois: 4, dernierAjout: "2026-10-10" };
    const jete = noterFin(noterFin(noterFin(yaourts, true), true), false);
    expect(souventJete(jete)).toBe(true);
    expect(apprentissages(entree({ catalogue: [jete] }))[0].fait).toBe("Yaourts finit souvent périmé (2 fois sur 3) : en acheter moins à la fois.");
  });

  it("recale la commande de Mitsu sur ce qu'elle mange vraiment", () => {
    let mitsu = nouvelAnimal("Mitsu", "2026-03-01", null, ctx);
    mitsu = definirCommande(mitsu, { fournisseur: "zooplus", tousLesMois: 3, prochaine: "2026-12-20", articles: [{ type: "croquettes", nom: "Pro Plan", quantite: 6000 }] });
    const ancien = nouvelleProvision({ type: "croquettes", nom: "Pro Plan", quantite: 2000, achete: "2026-08-01", parJour: null }, ctx);
    const fini = paquetFini(ajouterProvision(mitsu, ancien), ancien.id, "2026-08-21");
    expect(fini.observee?.parJour).toBe(100);
    mitsu = ajouterProvision(fini.animal, nouvelleProvision({ type: "croquettes", nom: "Pro Plan", quantite: 6000, achete: "2026-10-01", parJour: null }, ctx));
    const [recale] = apprentissages(entree({ animaux: [mitsu], aujourdhui: "2026-10-18" }));
    // 6 kg à 100 g par jour : fini le 30 novembre, à commander dix jours avant.
    expect(recale.action).toEqual({ type: "recalerCommande", animalId: mitsu.id, jour: "2026-11-20" });
  });

  it("garde pour ce téléphone l'heure de rappel et les widgets délaissés", () => {
    const usages = [...[19, 19, 20, 19, 18].map((h, i) => u(`2026-10-1${i}`, h, "tache", "t")), u("2026-09-20", 9, "widget", "taches")];
    const appris = apprentissages(entree({ usages, disposition: ["taches", "jardin"], heureRappel: 8 }));
    expect(appris.map((a) => [a.portee, a.cle])).toEqual([
      ["perso", "heure:18"],
      ["perso", "widget:taches"],
      ["perso", "widget:jardin"],
    ]);
    expect(apprentissages(entree({ usages, disposition: ["jardin"], heureRappel: 8, decisionsPerso: { "heure:18": "refuse" } })).map((a) => a.cle)).toEqual(["widget:jardin"]);
  });
});

describe("le bilan du dimanche", () => {
  it("s'ouvre chaque dimanche et attend toute la semaine", () => {
    expect(semaineDe("2026-10-21")).toBe("2026-10-18");
    expect(semaineDe("2026-10-18")).toBe("2026-10-18");
    expect(bilanAOuvrir("2026-10-18", null, 2)).toBe(true);
    expect(bilanAOuvrir("2026-10-21", "2026-10-18", 2)).toBe(false);
    expect(bilanAOuvrir("2026-10-25", "2026-10-21", 2)).toBe(true);
    expect(bilanAOuvrir("2026-10-25", "2026-10-21", 0)).toBe(false);
  });

  it("propose trois choses au plus, dont deux rachats au plus", () => {
    const appris = apprentissages(entree({ listes: [coursesDuSamedi()] }));
    const bilan = bilanDeLaSemaine(appris);
    expect(bilan).toHaveLength(3);
    expect(bilan.filter((a) => a.cle.startsWith("rachat:"))).toHaveLength(2);
  });
});

describe("la remarque du jour", () => {
  it("prévient quand Mitsu va manquer, avant tout le reste", () => {
    const mitsu = ajouterProvision(nouvelAnimal("Mitsu", "2026-03-01", null, ctx), nouvelleProvision({ type: "croquettes", nom: "Pro Plan", quantite: 500, achete: "2026-10-18", parJour: 100 }, ctx));
    expect(remarqueDuJour({ animaux: [mitsu], produits: [], taches: [], listes: [], elements: [], membreId: null, aujourdhui: "2026-10-18" })).toMatchObject({
      texte: "Il ne reste de la nourriture pour Mitsu que pour 5 jours.",
      module: "mitsu",
    });
  });

  it("rappelle le jour des courses, puis une tâche qui attend, et se tait sinon", () => {
    const courses = coursesDuSamedi();
    const base = { animaux: [], produits: [], taches: [], listes: [courses], elements: [], membreId: "melo", aujourdhui: "2026-10-24" };
    expect(remarqueDuJour(base)?.module).toBe("courses");
    const t = { ...nouvelleTache("Litière", null, "2026-10-20", ctx), responsable: "melo" };
    expect(remarqueDuJour({ ...base, aujourdhui: "2026-10-23", taches: [t] })?.texte).toBe("« Litière » t'attend depuis 3 jours.");
    expect(remarqueDuJour({ ...base, aujourdhui: "2026-10-23" })).toBeNull();
  });
});

describe("l'équilibre des tâches", () => {
  const foyer = creerFoyer("Cassa", ["Melo", "Sarah"], ctx);
  const [melo, sarah] = foyer.membres.map((m) => m.id);

  it("ne se montre qu'une fois que tout le foyer a dit oui", () => {
    const un = accepterEquilibre(foyer, melo, true);
    expect(equilibreVisible(un)).toBe(false);
    expect(equilibreVisible(accepterEquilibre(un, sarah, true))).toBe(true);
    expect(equilibreVisible(accepterEquilibre(accepterEquilibre(un, sarah, true), melo, false))).toBe(false);
  });

  it("compte qui a fait quoi ce mois-ci, avec douceur", () => {
    let t = nouvelleTache("Vaisselle", { unite: "jour", tous: 1 }, "2026-10-01", ctx);
    for (const [jour, par] of [["2026-10-10", melo], ["2026-10-11", melo], ["2026-10-12", melo], ["2026-10-13", sarah]] as const) t = marquerFaite(t, par, jour, ctx);
    const e = equilibreDesTaches([t], foyer, "2026-10-18");
    expect(e.parMembre.map((m) => m.fois)).toEqual([3, 1]);
    expect(e.phrase).toBe("Melo en a fait un peu plus ce mois-ci : Sarah pourrait prendre les prochaines.");
  });
});

describe("le vrai rythme d'une tâche", () => {
  it("repart de la dernière fois où elle a été faite", () => {
    const t = marquerFaite(nouvelleTache("Arroser", { unite: "semaine", tous: 1 }, "2026-10-01", ctx), null, "2026-10-13", ctx);
    expect(ajusterRythme(t, { unite: "jour", tous: 10 })).toMatchObject({ recurrence: { unite: "jour", tous: 10 }, echeance: "2026-10-23" });
    expect(rythmeProche(13.6)).toEqual({ unite: "semaine", tous: 2 });
    expect(rythmeProche(10)).toEqual({ unite: "jour", tous: 10 });
  });
});
