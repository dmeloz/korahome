import { describe, expect, it } from "vitest";
import {
  abreger,
  fenetreMotsProgrammes,
  basculerCoeur,
  decrireCompte,
  elementsBandeau,
  infosUtiles,
  nosMots,
  notificationMot,
  nouveauClin,
  nouveauCompte,
  nouveauMot,
  noterHumeur,
  type DocCouple,
} from "./bandeau";
import { contexteTest } from "./contexteTest";
import { creerFoyer } from "./foyer";
import { nouveauProduit } from "./stock";
import { nouvelleTache } from "./taches";

const AUJOURDHUI = "2026-10-16";
const MAINTENANT = "2026-10-16T09:00:00.000Z";

function foyer() {
  const ctx = contexteTest("2026-10-16T08:00:00.000Z");
  const f = creerFoyer("Cassa", ["Melo", "Sarah"], ctx);
  return { ctx, f, melo: f.membres[0].id, sarah: f.membres[1].id };
}

describe("les mots du couple", () => {
  it("écrit un mot court, tout de suite ou pour plus tard", () => {
    const { ctx, melo } = foyer();
    const m = nouveauMot("  Bonne journée  mon cœur ", melo, ctx);
    expect(m).toMatchObject({ texte: "Bonne journée mon cœur", programme: false, coeurs: [] });
    expect(m.visibleDes).toBe(m.creeLe);
    const plusTard = nouveauMot("Surprise ce soir", melo, ctx, "2026-10-17T05:00:00.000Z");
    expect(plusTard).toMatchObject({ programme: true, visibleDes: "2026-10-17T05:00:00.000Z" });
    expect(() => nouveauMot("   ", melo, ctx)).toThrow();
    expect(() => nouveauMot("x".repeat(141), melo, ctx)).toThrow();
  });

  it("garde le mot programmé caché à l'autre jusqu'à son heure", () => {
    const { ctx, melo, sarah } = foyer();
    const m = nouveauMot("Je t'aime", melo, ctx, "2026-10-17T05:00:00.000Z");
    expect(nosMots([m], sarah, MAINTENANT)).toEqual([]);
    expect(nosMots([m], melo, MAINTENANT)).toEqual([m]);
    expect(nosMots([m], sarah, "2026-10-17T05:00:00.000Z")).toEqual([m]);
  });

  it("envoie un cœur et le reprend", () => {
    const { ctx, melo, sarah } = foyer();
    const m = nouveauMot("Coucou", melo, ctx);
    expect(basculerCoeur(m, sarah).coeurs).toEqual([sarah]);
    expect(basculerCoeur(basculerCoeur(m, sarah), sarah).coeurs).toEqual([]);
  });

  it("annonce le mot par son auteur", () => {
    const { ctx, f, melo } = foyer();
    expect(notificationMot(f, nouveauMot("Coucou", melo, ctx))).toEqual({ titre: "Un mot de Melo", corps: "Coucou" });
  });
});

describe("les comptes à rebours", () => {
  it("compte les jours, puis disparaît une fois passé", () => {
    const { ctx, melo } = foyer();
    const c = nouveauCompte("Vacances", "2026-10-28", melo, AUJOURDHUI, ctx);
    expect(decrireCompte(c, AUJOURDHUI)).toBe("Vacances dans 12 jours");
    expect(decrireCompte(c, "2026-10-27")).toBe("Vacances demain");
    expect(decrireCompte(c, "2026-10-28")).toBe("C'est aujourd'hui : vacances");
    expect(decrireCompte(c, "2026-10-29")).toBeNull();
    expect(() => nouveauCompte("Hier", "2026-10-15", melo, AUJOURDHUI, ctx)).toThrow();
  });
});

describe("le bandeau", () => {
  it("fait défiler les mots reçus, les humeurs, les comptes, le clin d'œil et les infos", () => {
    const { ctx, f, melo, sarah } = foyer();
    const docs: DocCouple[] = [
      nouveauMot("Pense au pain", sarah, ctx),
      nouveauMot("Mon propre mot", melo, ctx),
      noterHumeur(melo, AUJOURDHUI, "😊"),
      noterHumeur(sarah, AUJOURDHUI, "😴"),
      noterHumeur(sarah, "2026-10-15", "🤒"),
      nouveauCompte("Anniversaire de Sarah", "2026-10-21", melo, AUJOURDHUI, ctx),
      nouveauClin(AUJOURDHUI, "« Un vendredi parfait pour une raclette. »")!,
    ];
    const textes = elementsBandeau({ docs, foyer: f, moi: melo, maintenant: MAINTENANT, aujourdhui: AUJOURDHUI, infos: [{ cle: "x", genre: "info", texte: "Info" }] }).map((e) => e.texte);
    expect(textes).toEqual([
      "Pense au pain",
      "Toi 😊 · Sarah 😴",
      "Anniversaire de Sarah dans 5 jours",
      "Un vendredi parfait pour une raclette.",
      "Info",
    ]);
  });

  it("oublie les mots de plus de trois jours", () => {
    const { f, melo, sarah } = foyer();
    const vieux = nouveauMot("Ancien", sarah, contexteTest("2026-10-12T08:00:00.000Z"));
    expect(elementsBandeau({ docs: [vieux], foyer: f, moi: melo, maintenant: MAINTENANT, aujourdhui: AUJOURDHUI })).toEqual([]);
  });

  it("donne la météo, le prochain rendez-vous et ce qui périme", () => {
    const { ctx, melo } = foyer();
    const rdv = nouvelleTache("Véto 14 h", null, "2026-10-18", ctx);
    const yaourt = nouveauProduit({ texte: "yaourts", lieu: "frigo", peremption: "2026-10-17" }, melo, ctx);
    const infos = infosUtiles({
      meteo: { lieu: "Renens", lue: MAINTENANT, jours: [{ jour: AUJOURDHUI, min: 6.4, max: 14.6, pluie: 0, code: 0 }] },
      taches: [rdv],
      produits: [yaourt],
      animaux: [],
      aujourdhui: AUJOURDHUI,
    }).map((i) => i.texte);
    expect(infos[0]).toMatch(/^Renens : .+, 6° à 15°$/);
    expect(infos[1]).toMatch(/^Véto 14 h, /);
    expect(infos[2]).toBe("À finir : yaourts");
  });
});

describe("abreger", () => {
  it("laisse un texte court tel quel", () => {
    expect(abreger("Pense au pain")).toBe("Pense au pain");
  });

  it("coupe un texte long au dernier mot entier", () => {
    const long = "Ce soir on se fait une raclette chez nous, j'achète le fromage en rentrant du travail";
    const court = abreger(long);
    expect(court.length).toBeLessThanOrEqual(60);
    expect(court).toBe("Ce soir on se fait une raclette chez nous, j'achète le…");
  });

  it("met l'auteur d'un mot à part", () => {
    const { f, melo, sarah, ctx } = foyer();
    const [el] = elementsBandeau({ docs: [nouveauMot("Pense au pain", sarah, ctx)], foyer: f, moi: melo, maintenant: MAINTENANT, aujourdhui: AUJOURDHUI });
    expect(el).toMatchObject({ genre: "mot", auteur: "Sarah", texte: "Pense au pain" });
  });
});

describe("fenetreMotsProgrammes", () => {
  it("couvre l'heure écoulée jusqu'à l'heure pleine, même si le passage est en retard", () => {
    expect(fenetreMotsProgrammes(new Date("2026-10-15T18:00:07Z"))).toEqual({ apres: "2026-10-15T17:00:00.000Z", jusqua: "2026-10-15T18:00:00.000Z" });
    expect(fenetreMotsProgrammes(new Date("2026-10-15T18:59:59Z")).jusqua).toBe("2026-10-15T18:00:00.000Z");
  });
});
