// La réserve de secours du foyer (Kora 0.0.94, proposition 11 de la nuit du 26 octobre).
// La Confédération (Office fédéral pour l'approvisionnement économique du pays, campagne
// « Un bon plan, des provisions ») recommande à chaque ménage une semaine de provisions : de
// l'eau d'abord, puis des aliments qui se gardent, et de quoi s'éclairer, s'informer et se
// soigner sans électricité. Kora compare cette liste au stock du foyer et dit ce qui manque ;
// le manquant part aux courses marqué « Réserve », et le Chef ne puise pas dedans.

import { normaliser } from "./rayons";
import { estAConsommer, type Produit } from "./stock";
import type { Contexte, Element, Id, Jour, Liste } from "./types";
import { nouvelElement } from "./listes";

export type GroupeReserve = "boire" | "manger" | "maison";
export const GROUPES_RESERVE: Record<GroupeReserve, string> = { boire: "À boire", manger: "À manger", maison: "Pour tenir" };

export interface ArticleReserve {
  id: string;
  nom: string;
  /** La quantité conseillée pour deux personnes et une semaine. */
  pourDeux: string;
  groupe: GroupeReserve;
  /** Les mots qui reconnaissent l'article dans le stock (début de mot, sans accent). */
  mots: readonly string[];
  /** Ce qu'on écrit sur la liste de courses quand il manque. */
  courses: string;
}

/** La liste officielle, ramenée à un foyer de deux personnes pour une semaine. */
export const ARTICLES_RESERVE: readonly ArticleReserve[] = [
  { id: "eau", nom: "Eau en bouteille", pourDeux: "18 litres (9 par personne)", groupe: "boire", mots: ["eau"], courses: "Eau en bouteille 18 l" },
  { id: "boissons", nom: "Jus ou boissons qui se gardent", pourDeux: "2 à 3 litres", groupe: "boire", mots: ["jus", "sirop", "the", "cafe", "cacao"], courses: "Jus de fruits 2 l" },
  { id: "riz-pates", nom: "Riz, pâtes ou semoule", pourDeux: "2 kg", groupe: "manger", mots: ["riz", "pate", "spaghetti", "penne", "semoule", "couscous", "nouille"], courses: "Riz ou pâtes 2 kg" },
  { id: "huile", nom: "Huile", pourDeux: "1 litre", groupe: "manger", mots: ["huile"], courses: "Huile 1 l" },
  { id: "legumineuses", nom: "Légumineuses sèches ou en boîte", pourDeux: "1 kg", groupe: "manger", mots: ["lentille", "pois chiche", "haricot blanc", "haricot rouge", "flageolet"], courses: "Lentilles ou pois chiches 1 kg" },
  { id: "conserves", nom: "Légumes en conserve", pourDeux: "6 boîtes", groupe: "manger", mots: ["conserve", "boite de", "tomate pelee", "mais", "petits pois"], courses: "Légumes en conserve 6 boîtes" },
  { id: "proteines", nom: "Thon, sardines ou viande en boîte", pourDeux: "4 boîtes", groupe: "manger", mots: ["thon", "sardine", "maquereau", "corned", "viande sechee"], courses: "Thon ou sardines 4 boîtes" },
  { id: "fruits-secs", nom: "Fruits secs et noix", pourDeux: "500 g", groupe: "manger", mots: ["noix", "amande", "noisette", "raisin sec", "abricot sec", "fruit sec"], courses: "Fruits secs et noix 500 g" },
  { id: "biscottes", nom: "Biscottes ou crackers", pourDeux: "2 paquets", groupe: "manger", mots: ["biscotte", "cracker", "pain croustillant", "knackebrot"], courses: "Biscottes 2 paquets" },
  { id: "lait", nom: "Lait UHT", pourDeux: "2 litres", groupe: "manger", mots: ["lait uht", "lait longue", "lait entier", "lait demi", "lait drink"], courses: "Lait UHT 2 l" },
  { id: "fromage", nom: "Fromage à pâte dure", pourDeux: "300 g", groupe: "manger", mots: ["gruyere", "emmental", "sbrinz", "parmesan", "fromage"], courses: "Gruyère 300 g" },
  { id: "sucre-miel", nom: "Sucre, miel ou confiture", pourDeux: "500 g", groupe: "manger", mots: ["sucre", "miel", "confiture"], courses: "Miel ou confiture" },
  { id: "chocolat", nom: "Chocolat ou barres", pourDeux: "300 g", groupe: "manger", mots: ["chocolat", "barre de cereale"], courses: "Chocolat 300 g" },
  { id: "mitsu", nom: "Nourriture pour les animaux", pourDeux: "une semaine", groupe: "manger", mots: ["croquette", "pate pour chat", "nourriture chat"], courses: "Croquettes pour une semaine" },
  { id: "lampe", nom: "Lampe de poche et piles", pourDeux: "1 lampe, piles de rechange", groupe: "maison", mots: ["lampe", "pile"], courses: "Piles pour la lampe de poche" },
  { id: "radio", nom: "Radio à piles", pourDeux: "1", groupe: "maison", mots: ["radio"], courses: "Radio à piles" },
  { id: "bougies", nom: "Bougies et allumettes", pourDeux: "quelques-unes", groupe: "maison", mots: ["bougie", "allumette", "briquet"], courses: "Bougies et allumettes" },
  { id: "rechaud", nom: "Réchaud à gaz ou à alcool", pourDeux: "1 avec sa cartouche", groupe: "maison", mots: ["rechaud", "cartouche de gaz"], courses: "Cartouche pour le réchaud" },
  { id: "pharmacie", nom: "Pharmacie et médicaments habituels", pourDeux: "une semaine", groupe: "maison", mots: ["pharmacie", "medicament", "pansement", "paracetamol", "dafalgan"], courses: "Pharmacie : pansements, paracétamol" },
  { id: "hygiene", nom: "Papier toilette et savon", pourDeux: "une semaine", groupe: "maison", mots: ["papier toilette", "papier wc", "savon"], courses: "Papier toilette et savon" },
  { id: "especes", nom: "Un peu d'argent liquide", pourDeux: "quelques billets", groupe: "maison", mots: ["argent liquide", "especes", "billets"], courses: "Retirer un peu d'argent liquide" },
];

export const SOURCE_OFAE = "Office fédéral pour l'approvisionnement économique du pays, « Un bon plan, des provisions »";

export interface EtatArticle {
  article: ArticleReserve;
  /** Les produits du stock qui le couvrent : ceux marqués « réserve », ou dont le nom le dit. */
  produits: Produit[];
  manque: boolean;
  /** Un des produits est à consommer bientôt ou périmé : à faire tourner. */
  aTourner: boolean;
}

export interface EtatReserve {
  articles: EtatArticle[];
  presents: number;
  manquants: EtatArticle[];
  aTourner: EtatArticle[];
}

const cle = (t: string) => ` ${normaliser(t)}`;
/** Le nom du produit contient un des mots de l'article, en début de mot (« eau » trouve « Eau gazeuse », pas « gâteau »). */
const reconnait = (article: ArticleReserve, produit: Produit) => {
  const nom = cle(produit.nom);
  return article.mots.some((m) => nom.includes(` ${m}`));
};

/** L'état de la réserve d'après le stock : ce qui est là, ce qui manque, ce qui tourne. */
export function etatReserve(produits: readonly Produit[], aujourdhui: Jour): EtatReserve {
  const articles = ARTICLES_RESERVE.map((article) => {
    const siens = produits.filter((p) => reconnait(article, p));
    return { article, produits: siens, manque: siens.length === 0, aTourner: siens.some((p) => estAConsommer(p, aujourdhui)) };
  });
  return { articles, presents: articles.filter((a) => !a.manque).length, manquants: articles.filter((a) => a.manque), aTourner: articles.filter((a) => a.aTourner) };
}

/** « 14 sur 21 à la maison · 7 manquent », « Tout y est ». */
export function resumeReserve(etat: EtatReserve): string {
  if (!etat.manquants.length) return etat.aTourner.length ? `Tout y est · ${etat.aTourner.length} à faire tourner` : "Tout y est";
  return `${etat.presents} sur ${etat.articles.length} à la maison · ${etat.manquants.length} manque${etat.manquants.length > 1 ? "nt" : ""}`;
}

/** Les articles par groupe, dans l'ordre de la liste. */
export function grouperReserve(etat: EtatReserve): { groupe: GroupeReserve; titre: string; articles: EtatArticle[] }[] {
  return (Object.keys(GROUPES_RESERVE) as GroupeReserve[]).map((groupe) => ({ groupe, titre: GROUPES_RESERVE[groupe], articles: etat.articles.filter((a) => a.article.groupe === groupe) }));
}

/** Les éléments à ajouter aux courses pour ce qui manque, sans doubler ce qui y est déjà. */
export function coursesPourLaReserve(etat: EtatReserve, liste: Liste, dejaSurLaListe: readonly Element[], membreId: Id | null, ctx: Contexte): Element[] {
  const deja = dejaSurLaListe.filter((e) => e.listeId === liste.id && !e.coche).map((e) => cle(e.texte));
  return etat.manquants
    .filter((a) => !deja.some((t) => a.article.mots.some((m) => t.includes(` ${m}`))))
    .map((a) => ({ ...nouvelElement(liste, a.article.courses, membreId, ctx), source: "reserve" as const }));
}

/** Marque un produit comme faisant partie de la réserve, ou l'en retire. */
export const marquerReserve = (p: Produit, reserve: boolean): Produit => ({ ...p, reserve });

/** Les produits qui ne sont pas de la réserve : ceux que le Chef peut cuisiner. */
export const sansLaReserve = (produits: readonly Produit[]): Produit[] => produits.filter((p) => !p.reserve);
