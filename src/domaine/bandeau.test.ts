import { describe, expect, it } from "vitest";
import {
  fenetreMotsProgrammes,
  basculerCoeur,
  decrireCompte,
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

describe("fenetreMotsProgrammes", () => {
  it("couvre l'heure écoulée jusqu'à l'heure pleine, même si le passage est en retard", () => {
    expect(fenetreMotsProgrammes(new Date("2026-10-15T18:00:07Z"))).toEqual({ apres: "2026-10-15T17:00:00.000Z", jusqua: "2026-10-15T18:00:00.000Z" });
    expect(fenetreMotsProgrammes(new Date("2026-10-15T18:59:59Z")).jusqua).toBe("2026-10-15T18:00:00.000Z");
  });
});

describe("l'humeur et le clin d'œil du jour", () => {
  it("garde une seule humeur par personne et par jour", () => {
    const { melo } = foyer();
    const docs: DocCouple[] = [noterHumeur(melo, AUJOURDHUI, "😊"), noterHumeur(melo, AUJOURDHUI, "😌")];
    expect(docs[0].id).toBe(docs[1].id);
  });

  it("nettoie le clin d'œil et refuse une phrase vide", () => {
    expect(nouveauClin(AUJOURDHUI, " « Bonne  soirée à vous deux » ")?.texte).toBe("Bonne soirée à vous deux");
    expect(nouveauClin(AUJOURDHUI, " \" \" ")).toBeNull();
  });
});
