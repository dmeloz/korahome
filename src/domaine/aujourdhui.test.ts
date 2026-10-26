import { describe, expect, it } from "vitest";
import { avanceeDuJour, carteDuJour, choseDuMoment, chosesDuJour, repasDuSoir, resteAFaire, titreMoment, type EntreeDuJour } from "./aujourdhui";
import { preparerEvenement } from "./agenda";
import type { MenuSemaine } from "./chef";
import { contexteTest } from "./contexteTest";
import { reglerCollecte } from "./maison";
import { nouveauProduit } from "./stock";
import { changerHeure, marquerFaite, nouvelleTache } from "./taches";

const ctx = contexteTest();
const auj = "2026-10-19";
const semaine = { unite: "semaine", tous: 1 } as const;

function entree(partiel: Partial<EntreeDuJour> = {}): EntreeDuJour {
  return { membreId: "melo", aujourdhui: auj, taches: [], evenements: [], animaux: [], produits: [], zones: [], meteo: null, menus: [], ...partiel };
}

describe("la carte Aujourd'hui", () => {
  it("met le retard en rouge, avant ce qui est simplement du jour", () => {
    const poubelles = nouvelleTache("Poubelles", semaine, "2026-10-17", ctx);
    const linge = nouvelleTache("Linge", semaine, auj, ctx);
    const choses = chosesDuJour(entree({ taches: [linge, poubelles] }));
    expect(choses.map((c) => [c.texte, c.etat, c.quand])).toEqual([
      ["Poubelles", "urgent", "en retard"],
      ["Linge", "jour", "aujourd'hui"],
    ]);
  });

  it("ignore les tâches de l'autre, garde les libres", () => {
    const sienne = { ...nouvelleTache("Ménage", semaine, auj, ctx), responsable: "sarah" };
    const libre = nouvelleTache("Courses", semaine, auj, ctx);
    expect(chosesDuJour(entree({ taches: [sienne, libre] })).map((c) => c.texte)).toEqual(["Courses"]);
  });

  it("montre les rendez-vous du jour avec l'heure, et ceux de demain au calme", () => {
    const veto = preparerEvenement({ titre: "Vétérinaire", jour: "2026-10-20", heure: "09:00" }, "melo", ctx);
    const dentiste = preparerEvenement({ titre: "Dentiste", jour: auj, heure: "14:30" }, "melo", ctx);
    const choses = chosesDuJour(entree({ evenements: [veto, dentiste] }));
    expect(choses.map((c) => [c.texte, c.quand, c.etat])).toEqual([
      ["Dentiste", "14:30", "jour"],
      ["Vétérinaire", "demain 09:00", "calme"],
    ]);
  });

  it("signale ce qui périme aujourd'hui, pas ce qui attend trois jours", () => {
    const yaourt = nouveauProduit({ texte: "yaourts", lieu: "frigo", peremption: auj }, "melo", ctx);
    const jambon = nouveauProduit({ texte: "jambon", lieu: "frigo", peremption: "2026-10-21" }, "melo", ctx);
    const choses = chosesDuJour(entree({ produits: [yaourt, jambon] }));
    expect(choses.map((c) => c.texte)).toEqual(["Yaourts"]);
    expect(choses[0].etat).toBe("urgent");
  });

  it("annonce le repas du soir prévu par le Chef", () => {
    const menu: MenuSemaine = {
      id: "m", type: "menu", semaine: "2026-10-18", mot: "", ajouts: [], aFinir: [], alertesMitsu: [], lance: "auto", creeLe: "",
      repas: [{ titre: "Soupe", description: "", avecLeStock: [] }, { titre: "Poulet au citron", description: "", avecLeStock: [] }],
    } as unknown as MenuSemaine;
    expect(repasDuSoir([menu], auj)).toBe("Poulet au citron");
    expect(repasDuSoir([menu], "2026-10-23")).toBeNull();
  });

  it("ajoute les factures du jour en rouge et celles de demain au calme", () => {
    const choses = chosesDuJour(entree({ factures: [{ id: "a", libelle: "Assurance", echeance: auj }, { id: "b", libelle: "Loyer", echeance: "2026-10-20" }, { id: "c", libelle: "Impôts", echeance: "2026-11-30" }] }));
    expect(choses.map((c) => [c.texte, c.etat])).toEqual([
      ["Assurance", "urgent"],
      ["Loyer", "calme"],
    ]);
  });

  it("donne aux tâches de quoi les cocher sur place, pas aux autres choses", () => {
    const linge = nouvelleTache("Linge", semaine, auj, ctx);
    const choses = chosesDuJour(entree({ taches: [linge], sauvegardeDue: true }));
    expect(choses[0].tacheId).toBe(linge.id);
    expect(choses[1].tacheId).toBeUndefined();
  });

  it("en garde davantage à faire défiler quand on le demande", () => {
    const taches = ["A", "B", "C", "D", "E"].map((t) => nouvelleTache(t, semaine, auj, ctx));
    const carte = carteDuJour(entree({ taches }), 12);
    expect(carte.choses).toHaveLength(5);
    expect(carte.autres).toBe(0);
  });

  it("compte les tâches cochées aujourd'hui pour la jauge et le compte", () => {
    const faite = marquerFaite(nouvelleTache("Litière", semaine, auj, ctx), "melo", auj, ctx);
    const parSarah = marquerFaite(nouvelleTache("Ménage", semaine, auj, ctx), "sarah", auj, ctx);
    const reste = nouvelleTache("Linge", semaine, auj, ctx);
    const carte = carteDuJour(entree({ taches: [faite, parSarah, reste] }));
    expect(carte.faites).toBe(1);
    expect(avanceeDuJour(carte)).toEqual({ faites: 1, total: 2, part: 0.5 });
    expect(resteAFaire(carte)).toBe(1);
  });

  it("garde trois choses et compte les autres", () => {
    const taches = ["A", "B", "C", "D", "E"].map((t) => nouvelleTache(t, semaine, auj, ctx));
    const carte = carteDuJour(entree({ taches, sauvegardeDue: true }));
    expect(carte.choses).toHaveLength(3);
    expect(carte.autres).toBe(3);
  });

  it("propose la sauvegarde et la répartition au calme, en dernier", () => {
    const choses = chosesDuJour(entree({ taches: [nouvelleTache("Linge", semaine, auj, ctx)], sauvegardeDue: true, repartitionDue: true }));
    expect(choses.map((c) => c.destination)).toEqual(["taches", "repartition", "sauvegarde"]);
  });
});

describe("les déchets sur l'accueil", () => {
  it("dit la veille au soir ce qu'il faut sortir", () => {
    // Le 19 octobre 2026 est un lundi : le verre passe le mardi.
    const dechets = reglerCollecte(null, "verre", { jour: 2, rythme: "semaine" }, ctx);
    const choses = chosesDuJour(entree({ dechets }));
    expect(choses).toEqual([{ cle: "dechets", texte: "Sortir le verre", quand: "ce soir", etat: "jour", destination: "maison" }]);
    expect(chosesDuJour(entree({ dechets, aujourdhui: "2026-10-20" }))).toEqual([]);
  });
});

describe("l'heure dans « Ce soir »", () => {
  it("donne l'heure d'une tâche qui en a une, et rien sinon", () => {
    const litiere = changerHeure(nouvelleTache("Litière", semaine, auj, ctx), "19:00");
    const linge = nouvelleTache("Linge", semaine, auj, ctx);
    const choses = chosesDuJour(entree({ taches: [linge, litiere] }));
    expect(choses.map((c) => [c.texte, c.heure])).toEqual([
      ["Litière", "19:00"],
      ["Linge", undefined],
    ]);
  });

  it("garde l'urgent d'abord, puis ce qui a une heure, du plus tôt au plus tard", () => {
    const retard = nouvelleTache("Poubelles", semaine, "2026-10-17", ctx);
    const arroser = changerHeure(nouvelleTache("Arroser", semaine, auj, ctx), "20:00");
    const linge = nouvelleTache("Linge", semaine, auj, ctx);
    const dentiste = preparerEvenement({ titre: "Dentiste", jour: auj, heure: "14:30" }, "melo", ctx);
    const carte = carteDuJour(entree({ taches: [linge, arroser, retard], evenements: [dentiste] }), 12);
    expect(carte.choses.map((c) => c.texte)).toEqual(["Poubelles", "Dentiste", "Arroser", "Linge"]);
    expect(choseDuMoment(carte)?.texte).toBe("Poubelles");
    expect(resteAFaire(carte)).toBe(4);
  });

  it("nomme le moment de la journée", () => {
    expect(titreMoment(8)).toBe("Ce matin");
    expect(titreMoment(14)).toBe("Cet après-midi");
    expect(titreMoment(19)).toBe("Ce soir");
  });
});
