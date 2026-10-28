import { describe, expect, it } from "vitest";
import { contexteTest } from "./contexteTest";
import { nouvelleListe } from "./listes";
import { ARTICLES_RESERVE, coursesPourLaReserve, etatReserve, grouperReserve, marquerReserve, resumeReserve, sansLaReserve } from "./reserve";
import { nouveauProduit, type Produit } from "./stock";
import { messageChef } from "./chef";
import { ENTRETIENS_PROPOSES } from "./entretien";

const ctx = contexteTest();
const AUJOURDHUI = "2026-10-28";
const produit = (texte: string, peremption: string | null = null, lieu: "frigo" | "placard" = "placard"): Produit => nouveauProduit({ texte, lieu, peremption }, "m1", ctx);

describe("la réserve de secours", () => {
  it("reconnaît un article au début d'un mot du nom, jamais au milieu", () => {
    const docs = [produit("6 bouteilles d'eau"), produit("Gâteau au chocolat"), produit("1 kg de riz basmati"), produit("Huile d'olive"), produit("Gruyère")];
    const etat = etatReserve(docs, AUJOURDHUI);
    const par = (id: string) => etat.articles.find((a) => a.article.id === id)!;
    expect(par("eau").produits.map((p) => p.nom)).toEqual(["Eau"]);
    expect(par("chocolat").produits.map((p) => p.nom)).toEqual(["Gâteau au chocolat"]);
    expect(par("riz-pates").manque).toBe(false);
    expect(par("huile").manque).toBe(false);
    expect(par("fromage").manque).toBe(false);
    expect(par("lampe").manque).toBe(true);
    expect(etat.presents).toBe(5);
    expect(etat.manquants.length).toBe(ARTICLES_RESERVE.length - 5);
    expect(resumeReserve(etat)).toBe(`5 sur ${ARTICLES_RESERVE.length} à la maison · ${ARTICLES_RESERVE.length - 5} manquent`);
  });

  it("dit ce qui est à faire tourner, et « tout y est »", () => {
    const tout = ARTICLES_RESERVE.map((a) => produit(a.mots[0]));
    const etat = etatReserve(tout, AUJOURDHUI);
    expect(etat.manquants).toEqual([]);
    expect(resumeReserve(etat)).toBe("Tout y est");
    const avecDate = [...tout, produit("Lait UHT", "2026-10-29", "frigo")];
    const e2 = etatReserve(avecDate, AUJOURDHUI);
    expect(e2.aTourner.map((a) => a.article.id)).toEqual(["lait"]);
    expect(resumeReserve(e2)).toBe("Tout y est · 1 à faire tourner");
  });

  it("range les articles en trois groupes, dans l'ordre", () => {
    const groupes = grouperReserve(etatReserve([], AUJOURDHUI));
    expect(groupes.map((g) => g.titre)).toEqual(["À boire", "À manger", "Pour tenir"]);
    expect(groupes.reduce((n, g) => n + g.articles.length, 0)).toBe(ARTICLES_RESERVE.length);
  });

  it("envoie le manquant aux courses, marqué « réserve », sans doubler la liste", () => {
    const liste = nouvelleListe("Courses", "", "courses", ctx);
    const etat = etatReserve([produit("Riz")], AUJOURDHUI);
    const deja = { id: "e1", listeId: liste.id, texte: "Eau gazeuse", quantite: null, rayon: "Boissons" as never, coche: false, ajoutePar: null, creeLe: "", cocheLe: null };
    const elements = coursesPourLaReserve(etat, liste, [deja], "m1", ctx);
    expect(elements.every((e) => e.source === "reserve" && e.listeId === liste.id && e.ajoutePar === "m1")).toBe(true);
    expect(elements.map((e) => e.texte)).not.toContain("Eau en bouteille");
    expect(elements.some((e) => e.texte.startsWith("Huile"))).toBe(true);
    expect(elements.length).toBe(ARTICLES_RESERVE.length - 2);
  });

  it("le Chef ne voit pas la réserve", () => {
    const riz = marquerReserve(produit("Riz"), true);
    const pates = produit("Pâtes");
    expect(sansLaReserve([riz, pates])).toEqual([pates]);
    const message = messageChef({ produits: [riz, pates], enCourses: [], aujourdhui: AUJOURDHUI });
    expect(message).toContain("- Pâtes");
    expect(message).not.toContain("- Riz");
    expect(message).toContain("La réserve de secours du foyer n'est pas listée : n'y puise pas.");
  });

  it("se vérifie une fois par saison depuis l'entretien", () => {
    expect(ENTRETIENS_PROPOSES.find((e) => e.titre === "Vérifier la réserve de secours")?.recurrence).toEqual({ unite: "mois", tous: 3 });
  });
});
