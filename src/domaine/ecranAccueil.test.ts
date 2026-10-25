import { describe, expect, it } from "vitest";
import type { Occurrence } from "./agenda";
import {
  basculerRetiree,
  carteDeLEspace,
  composerPiles,
  decouperLigne,
  enDirect,
  momentAccueil,
  montrerIndice,
  nettoyerRetirees,
  noterCocheur,
  suivante,
  tuileAgenda,
  type CarteId,
} from "./ecranAccueil";
import type { Element, Liste, Membre } from "./types";

const vide = new Set<CarteId>();

describe("momentAccueil", () => {
  it("le matin jusqu'à 14 h, puis le soir, et le dimanche toute la journée", () => {
    expect(momentAccueil(7, 2)).toBe("matin");
    expect(momentAccueil(13, 2)).toBe("matin");
    expect(momentAccueil(14, 2)).toBe("soir");
    expect(momentAccueil(23, 5)).toBe("soir");
    expect(momentAccueil(2, 5)).toBe("soir");
    expect(momentAccueil(9, 0)).toBe("dimanche");
  });
});

describe("composerPiles", () => {
  it("suit le moment : le soir la maison et le repas, puis les courses et Chez nous", () => {
    const [haut, bas] = composerPiles("soir", { urgentes: vide, retirees: vide, absentes: new Set(["bilan"]) });
    expect(haut).toEqual(["maison", "chef"]);
    expect(bas).toEqual(["courses", "fil", "agenda", "budget"]);
  });

  it("le matin l'agenda d'abord, le dimanche le bilan et le budget", () => {
    expect(composerPiles("matin", { urgentes: vide, retirees: vide, absentes: vide })[0]).toEqual(["agenda", "maison"]);
    expect(composerPiles("dimanche", { urgentes: vide, retirees: vide, absentes: vide })[0]).toEqual(["bilan", "budget"]);
  });

  it("une carte qui presse monte en tête de la pile du haut", () => {
    const [haut, bas] = composerPiles("soir", { urgentes: new Set(["budget", "chef"]), retirees: vide, absentes: new Set(["bilan"]) });
    expect(haut).toEqual(["chef", "budget", "maison"]);
    expect(bas).not.toContain("budget");
  });

  it("une carte retirée ou sans rien à montrer sort des piles, même urgente", () => {
    const [haut, bas] = composerPiles("dimanche", { urgentes: new Set(["maison"]), retirees: new Set(["maison", "fil"]), absentes: new Set(["bilan"]) });
    expect(haut).toEqual(["budget"]);
    expect(bas).toEqual(["chef", "courses", "agenda"]);
  });

  it("une pile garde quatre cartes au plus", () => {
    const [haut] = composerPiles("soir", { urgentes: new Set(["agenda", "budget", "courses", "fil"]), retirees: vide, absentes: vide });
    expect(haut).toHaveLength(4);
    expect(haut.slice(0, 2)).toEqual(["courses", "fil"]);
  });
});

describe("cartes retirées", () => {
  it("relit sans l'inconnu ni les doublons, et bascule", () => {
    expect(nettoyerRetirees(["maison", "maison", "lune", 3])).toEqual(["maison"]);
    expect(nettoyerRetirees(null)).toEqual([]);
    expect(basculerRetiree(["maison"], "maison")).toEqual([]);
    expect(basculerRetiree([], "fil")).toEqual(["fil"]);
  });

  it("un espace de « Tous les espaces » retrouve sa carte", () => {
    expect(carteDeLEspace("mitsu")).toBe("maison");
    expect(carteDeLEspace("stock")).toBe("chef");
    expect(carteDeLEspace("listes")).toBe("courses");
    expect(carteDeLEspace("budget")).toBe("budget");
    expect(carteDeLEspace("taches")).toBeNull();
  });
});

describe("decouperLigne", () => {
  it("met la mesure à droite et garde une phrase entière", () => {
    expect(decouperLigne("Pommes · 2 kg")).toEqual({ texte: "Pommes", fin: "2 kg" });
    expect(decouperLigne("Lait")).toEqual({ texte: "Lait", fin: "" });
    expect(decouperLigne("Sortir le verre · en retard de 2 jours")).toEqual({ texte: "Sortir le verre · en retard de 2 jours", fin: "" });
  });
});

describe("tuileAgenda", () => {
  const occ = (debut: string, titre: string, heure?: string) => ({ cle: debut, debut, fin: debut, annees: null, lectureSeule: false, evenement: { titre, heure } }) as unknown as Occurrence;
  it("le jour en grand, l'heure et le titre dessous", () => {
    expect(tuileAgenda(occ("2026-10-29", "Vétérinaire", "17:30"), "2026-10-27")).toEqual({ valeur: "Jeu.", pied: "17:30 Vétérinaire" });
    expect(tuileAgenda(occ("2026-10-28", "Lisbonne"), "2026-10-27")).toEqual({ valeur: "Dem.", pied: "Lisbonne" });
    expect(tuileAgenda(undefined, "2026-10-27")).toEqual({ valeur: "—", pied: "rien prévu" });
  });
});

describe("enDirect", () => {
  const membres: Membre[] = [
    { id: "melo", prenom: "Melo", couleur: "" },
    { id: "sarah", prenom: "Sarah", couleur: "" },
  ];
  const courses: Liste = { id: "l", nom: "Courses", icone: "", type: "courses", creeLe: "" };
  const el = (id: string, coche: boolean, cocheLe: string | null = null, cochePar?: string | null): Element => ({ id, listeId: "l", texte: id, quantite: null, rayon: "Autre", coche, ajoutePar: null, creeLe: "", cocheLe, cochePar });
  const maintenant = "2026-10-25T18:20:00.000Z";
  const base = { listes: [courses], foyer: { membres }, membreId: "melo" };

  it("l'autre coche les courses en ce moment : son prénom et l'avancée", () => {
    const elements = [el("a", true, "2026-10-25T18:10:00.000Z", "sarah"), el("b", true, "2026-10-25T18:15:00.000Z", "sarah"), el("c", false), el("d", true, "2026-10-20T10:00:00.000Z")];
    expect(enDirect({ ...base, elements }, maintenant)).toEqual({ qui: "Sarah", coches: 3, total: 4 });
  });

  it("rien quand c'est moi, quand c'est trop vieux ou un seul article", () => {
    expect(enDirect({ ...base, elements: [el("a", true, "2026-10-25T18:10:00.000Z", "melo"), el("b", true, "2026-10-25T18:11:00.000Z", "melo")] }, maintenant)).toBeNull();
    expect(enDirect({ ...base, elements: [el("a", true, "2026-10-25T17:10:00.000Z", "sarah"), el("b", true, "2026-10-25T17:11:00.000Z", "sarah")] }, maintenant)).toBeNull();
    expect(enDirect({ ...base, elements: [el("a", true, "2026-10-25T18:10:00.000Z", "sarah")] }, maintenant)).toBeNull();
  });

  it("une ancienne version ne dit pas qui coche : c'est l'autre quand on est deux", () => {
    const elements = [el("a", true, "2026-10-25T18:10:00.000Z"), el("b", true, "2026-10-25T18:12:00.000Z")];
    expect(enDirect({ ...base, elements }, maintenant)?.qui).toBe("Sarah");
  });

  it("noterCocheur garde qui coche et l'oublie au décochage", () => {
    const avant = el("a", false);
    expect(noterCocheur(avant, { ...avant, coche: true }, "melo").cochePar).toBe("melo");
    expect(noterCocheur({ ...avant, coche: true }, avant, "melo").cochePar).toBeNull();
  });
});

describe("gestes et rotation", () => {
  it("l'indice se montre les trois premières fois, jamais après le premier geste", () => {
    expect(montrerIndice(0, false)).toBe(true);
    expect(montrerIndice(3, false)).toBe(false);
    expect(montrerIndice(0, true)).toBe(false);
  });

  it("la rotation revient au début", () => {
    expect(suivante(2, 3)).toBe(0);
    expect(suivante(0, 3)).toBe(1);
    expect(suivante(0, 0)).toBe(0);
  });
});
