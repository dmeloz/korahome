import { describe, expect, it } from "vitest";
import { LARGEUR_ACTION, borner, directionGeste, finFait, finLigne, finRetour } from "./gestes";

describe("direction d'un geste", () => {
  it("attend que le doigt ait assez bougé", () => {
    expect(directionGeste(3, 4)).toBeNull();
  });

  it("distingue un glissement de côté d'un défilement", () => {
    expect(directionGeste(20, 5)).toBe("horizontale");
    expect(directionGeste(-20, 5)).toBe("horizontale");
    expect(directionGeste(6, 30)).toBe("verticale");
  });
});

describe("glisser depuis le bord pour revenir", () => {
  const largeur = 390;

  it("revient au-delà d'un tiers de l'écran, même lentement", () => {
    expect(finRetour(150, 1500, largeur)).toBe(true);
    expect(finRetour(120, 1500, largeur)).toBe(false);
  });

  it("revient sur un geste vif, même court", () => {
    expect(finRetour(80, 100, largeur)).toBe(true);
    expect(finRetour(30, 20, largeur)).toBe(false);
  });
});

describe("glisser une ligne pour la supprimer", () => {
  const largeur = 360;

  it("supprime quand la ligne est tirée au-delà de la moitié", () => {
    expect(finLigne(-220, -220, 600, largeur)).toBe("supprimer");
  });

  it("reste ouverte sur « Supprimer » à partir de la moitié du bouton", () => {
    expect(finLigne(-LARGEUR_ACTION / 2 - 1, -45, 600, largeur)).toBe("ouvrir");
    expect(finLigne(-30, -30, 600, largeur)).toBe("fermer");
  });

  it("suit l'élan du doigt", () => {
    expect(finLigne(-30, -30, 40, largeur)).toBe("ouvrir");
    expect(finLigne(-70, 18, 20, largeur)).toBe("fermer");
  });

  it("ne part jamais vers la droite ni au-delà de la ligne", () => {
    expect(borner(25, largeur)).toBe(0);
    expect(borner(-500, largeur)).toBe(-largeur);
    expect(borner(-40, largeur)).toBe(-40);
  });
});

describe("glisser une ligne vers la droite", () => {
  it("ne va vers la droite que si la ligne sait être faite, jusqu'à mi-largeur", () => {
    expect(borner(80, 400)).toBe(0);
    expect(borner(80, 400, true)).toBe(80);
    expect(borner(300, 400, true)).toBe(200);
  });

  it("est faite au-delà d'un quart, ou d'un geste vif", () => {
    expect(finFait(110, 600, 400)).toBe(true);
    expect(finFait(60, 600, 400)).toBe(false);
    expect(finFait(60, 80, 400)).toBe(true);
  });
});
