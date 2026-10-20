// Le savoir de cuisine du Chef (depuis Kora 0.0.67) : une petite partie choisie à la main du
// référentiel culinaire de Sanji (brevet fédéral de chef de cuisine, validé par Melo le
// 2026-10-04, dans l'Atelier : Projets-code/sanji/savoir/). On n'en garde que ce qui sert à la
// maison pour deux : la saison des légumes en Suisse, les bases et leurs portions, les cuissons
// sûres et la garde des restes. Ce qui ne sert qu'en cuisine pro (brigade, buffets, fonds en
// 10 litres, hygiène des locaux, découpes, coût matière) reste dans Sanji.
//
// Chaque chiffre vient d'une entrée du référentiel ; son identifiant est noté à côté (`source`).

import { NOMS_MOIS } from "./texte";

/** Un mois de 1 (janvier) à 12. */
export type Mois = number;

export interface LegumeDeSaison {
  nom: string;
  /** Les mois où il est de saison en Suisse (frais ou du stockage suisse). */
  mois: readonly Mois[];
  source: string;
}

const DE = (debut: Mois, fin: Mois): Mois[] => {
  const mois: Mois[] = [];
  for (let m = debut; ; m = (m % 12) + 1) {
    mois.push(m);
    if (m === fin) return mois;
  }
};
const TOUTE_L_ANNEE = DE(1, 12);

/** Le calendrier des légumes suisses (Schweizer Gemüse), repris du référentiel. */
export const LEGUMES_DE_SAISON: readonly LegumeDeSaison[] = [
  ...["carotte", "céleri-rave", "chou blanc", "chou rouge", "oignon", "pomme de terre"].map((nom) => ({ nom, mois: TOUTE_L_ANNEE, source: "legumes.saison.stockage-toute-annee" })),
  { nom: "asperge", mois: DE(4, 6), source: "legumes.saison.printemps" },
  { nom: "petits pois", mois: DE(5, 7), source: "legumes.saison.printemps" },
  { nom: "fève", mois: DE(5, 7), source: "legumes.saison.printemps" },
  { nom: "radis", mois: DE(4, 10), source: "legumes.saison.printemps" },
  { nom: "roquette", mois: DE(4, 10), source: "legumes.saison.printemps" },
  { nom: "épinard", mois: [...DE(3, 5), ...DE(9, 11)], source: "legumes.saison.printemps" },
  { nom: "courgette", mois: DE(6, 9), source: "legumes.saison.ete" },
  { nom: "concombre", mois: DE(6, 9), source: "legumes.saison.ete" },
  { nom: "haricot vert", mois: DE(6, 9), source: "legumes.saison.ete" },
  { nom: "tomate", mois: DE(7, 9), source: "legumes.saison.ete" },
  { nom: "aubergine", mois: DE(7, 9), source: "legumes.saison.ete" },
  { nom: "poivron", mois: DE(7, 10), source: "legumes.saison.ete" },
  { nom: "maïs", mois: DE(8, 9), source: "legumes.saison.ete" },
  { nom: "chou frisé", mois: DE(9, 3), source: "legumes.saison.automne-hiver" },
  { nom: "chou-fleur", mois: DE(9, 3), source: "legumes.saison.automne-hiver" },
  { nom: "poireau", mois: DE(9, 4), source: "legumes.saison.automne-hiver" },
  { nom: "panais", mois: DE(10, 3), source: "legumes.saison.automne-hiver" },
  { nom: "chou de Bruxelles", mois: DE(10, 2), source: "legumes.saison.automne-hiver" },
  { nom: "mâche", mois: DE(9, 4), source: "legumes.saison.automne-hiver" },
  { nom: "courge", mois: DE(9, 12), source: "legumes.saison.automne-hiver" },
  { nom: "champignons", mois: DE(6, 11), source: "legumes.saison.champignons-sauvages" },
];

export const legumesDuMois = (mois: Mois): string[] => LEGUMES_DE_SAISON.filter((l) => l.mois.includes(mois)).map((l) => l.nom);

/** Les bases d'un repas du soir : le féculent ou la légumineuse qui porte le plat. */
export interface Base {
  id: string;
  nom: string;
  /** La quantité pour deux, crue ou sèche. */
  pourDeux: string;
  /** Le geste qui la réussit en 45 minutes au plus. */
  repere: string;
  /** Les mots qui la reconnaissent dans un menu passé (sans accents, en minuscules). */
  mots: readonly string[];
  source: string;
}

export const BASES: readonly Base[] = [
  { id: "pates", nom: "pâtes", pourDeux: "160 à 200 g secs", repere: "1 L d'eau pour 100 g, 10 g de sel par litre, saler quand l'eau bout ; fraîches 2 à 3 min", mots: ["pates", "spaghetti", "penne", "tagliatelle", "linguine", "fusilli", "lasagne", "ravioli", "tortellini", "macaroni"], source: "reperes-portion ; feculents.pates.eau.volume" },
  { id: "riz", nom: "riz", pourDeux: "100 à 140 g secs", repere: "pilaf : suer l'oignon, 1,4 L de fond par kg de riz, cuisson à absorption", mots: ["riz", "pilaf", "basmati", "riz cantonais"], source: "reperes-portion ; sauces-cuissons.pates.pilaf-fond" },
  { id: "risotto", nom: "risotto", pourDeux: "150 à 160 g de riz rond", repere: "nacrer, déglacer, bouillon chaud louche après louche, 16 à 18 min, finir fromage et beurre", mots: ["risotto"], source: "feculents.risotto.portion ; feculents.risotto.duree" },
  { id: "pommes-de-terre", nom: "pommes de terre", pourDeux: "400 à 500 g", repere: "fermes pour salade, rösti et sautées ; farineuses pour purée et gratin ; purée au presse-purée, jamais au mixeur", mots: ["pomme de terre", "pommes de terre", "patate", "puree", "rosti", "gratin dauphinois", "pommes sautees", "raclette", "gschwellti"], source: "feculents.pdt.famille-ferme.usage ; feculents.pdt.puree.technique" },
  { id: "gnocchi", nom: "gnocchi", pourDeux: "400 à 500 g frais", repere: "pocher sous l'ébullition, ils sont cuits quand ils remontent (environ 5 min)", mots: ["gnocchi"], source: "feculents.pdt.gnocchi.cuisson-eau" },
  { id: "polenta", nom: "polenta", pourDeux: "120 à 140 g de semoule", repere: "4 parts de liquide pour 1 ; précuite en quelques minutes ; refroidie, taillée et dorée à la poêle", mots: ["polenta"], source: "feculents.polenta.proportion ; feculents.polenta.cuisson" },
  { id: "couscous", nom: "couscous ou boulgour", pourDeux: "120 à 140 g secs", repere: "couscous : autant d'eau chaude que de semoule, 10 min couvert ; boulgour moyen 1 pour 1,5 à 2", mots: ["couscous", "boulgour", "taboule"], source: "feculents.couscous.proportion ; feculents.boulgour.proportion" },
  { id: "quinoa", nom: "quinoa", pourDeux: "120 à 140 g secs", repere: "1 part pour 2 d'eau, 10 min de mijotage puis 10 min couvert hors du feu", mots: ["quinoa"], source: "feculents.quinoa.cuisson" },
  { id: "lentilles", nom: "lentilles", pourDeux: "120 à 140 g sèches", repere: "sans trempage ; corail 5 à 15 min, vertes ou Beluga 20 à 30 min ; elles prennent 2 à 3 fois leur poids", mots: ["lentille", "lentilles", "dahl", "dal"], source: "feculents.leg.cuisson.lentilles ; reperes-portion" },
  { id: "pois-chiches", nom: "pois chiches ou haricots", pourDeux: "1 boîte (240 g égouttés) ou 120 g secs trempés la veille", repere: "secs : trempage 8 à 12 h puis 60 à 90 min, donc en boîte un soir de semaine ; haricots jamais crus", mots: ["pois chiche", "pois chiches", "houmous", "falafel", "haricots rouges", "haricots blancs", "chili"], source: "feculents.leg.trempage ; feculents.leg.haricots-rouges.securite" },
  { id: "pain", nom: "pain, tarte ou galette", pourDeux: "1 pâte ou 4 tranches", repere: "tartine, croque, tarte salée ou galette : four chaud, garniture de saison", mots: ["tarte", "quiche", "croque", "tartine", "galette", "pizza", "wrap", "burger", "sandwich"], source: "Kora (repas du soir simples)" },
];

/** Ce qui donne les protéines au plat. */
export interface Proteine {
  id: string;
  nom: string;
  /** Sans viande ni poisson. */
  vegetarien: boolean;
  pourDeux: string;
  repere: string;
  mots: readonly string[];
  source: string;
}

export const PROTEINES: readonly Proteine[] = [
  { id: "volaille", nom: "volaille", vegetarien: false, pourDeux: "200 à 240 g sans os", repere: "cuite à cœur, 72 °C au moins", mots: ["poulet", "volaille", "dinde", "canard", "cuisse"], source: "reperes-portion ; sauces-cuissons.securite.volaille-porc" },
  { id: "boeuf", nom: "bœuf ou veau", vegetarien: false, pourDeux: "200 à 240 g sans os", repere: "émincé saisi à feu vif ; entrecôte de 2 à 3 cm, 3 à 4 min par face pour saignant ; haché bien cuit", mots: ["boeuf", "veau", "steak", "entrecote", "hache", "bolognaise", "emince", "boulettes"], source: "reperes-portion ; sauces-cuissons.cuisson.griller" },
  { id: "porc", nom: "porc", vegetarien: false, pourDeux: "200 à 240 g sans os", repere: "62 à 65 °C à cœur pour un filet ; saucisse bien cuite", mots: ["porc", "saucisse", "jambon", "lard", "lardons", "chorizo", "cervelas", "pancetta"], source: "reperes-portion ; sauces-cuissons.securite.volaille-porc" },
  { id: "poisson", nom: "poisson", vegetarien: false, pourDeux: "2 filets d'environ 150 g", repere: "poché sans ébullition (70 à 80 °C) ou à la poêle ; 55 à 60 °C à cœur", mots: ["poisson", "saumon", "cabillaud", "truite", "perche", "thon", "colin", "crevette", "moules", "lieu"], source: "sauces-cuissons.cuisson.pocher ; sauces-cuissons.securite.poisson" },
  { id: "oeufs", nom: "œufs", vegetarien: true, pourDeux: "4 à 6 œufs", repere: "coque 3 min, mollet 6 min, dur 9 min, poché 3 à 4 min dans une eau frémissante", mots: ["oeuf", "oeufs", "omelette", "frittata", "shakshuka", "quiche"], source: "reperes-portion ; legumes.oeuf.mollet" },
  { id: "fromage", nom: "fromage", vegetarien: true, pourDeux: "120 à 160 g", repere: "gruyère, raclette, chèvre ou feta : gratiné, fondu ou en finition", mots: ["fromage", "gruyere", "raclette", "fondue", "chevre", "feta", "mozzarella", "halloumi", "parmesan", "ricotta"], source: "Kora (repas du soir simples)" },
  { id: "legumineuses", nom: "légumineuses ou tofu", vegetarien: true, pourDeux: "120 à 140 g secs, 1 boîte ou 200 g de tofu", repere: "lentilles, pois chiches ou tofu doré : le plat sans viande de la semaine", mots: ["lentille", "pois chiche", "haricot", "tofu", "dahl", "falafel"], source: "reperes-portion" },
];

/** Combien de jours un reste se garde au frigo, en retenant la valeur prudente. */
export const RESTES: readonly { quoi: string; jours: number; source: string }[] = [
  { quoi: "riz cuit", jours: 1, source: "feculents.riz.conservation.cuit" },
  { quoi: "pâtes cuites, légumes cuits, sauces cuites", jours: 2, source: "legumes.avance.legumes-cuits-gvg" },
  { quoi: "gratin de légumes, pommes de terre cuites", jours: 3, source: "legumes.avance.gratin-legumes" },
  { quoi: "légumineuses cuites", jours: 3, source: "feculents.leg.conservation.cuites" },
];

/** Les gestes sûrs que le Chef glisse dans les étapes. */
export const GESTES: readonly string[] = [
  "Réchauffer un reste à cœur, 70 °C au moins ; le riz cuit se refroidit vite et se mange le lendemain au plus tard.",
  "Herbes fragiles (basilic, coriandre, ciboulette, menthe) hors du feu ; thym, romarin et laurier dès le début, une branche suffit.",
  "Légumes rôtis vers 200 °C : courgette 15 à 22 min, poivron 20 à 25, carotte en rondelles 20 à 30.",
  "Légumes verts blanchis 30 s à 3 min à grande eau salée (haricots verts 4 à 5 min, chou-fleur 5 à 6), puis eau glacée pour garder la couleur.",
  "Étuver courgettes et poireaux à couvert, peu de liquide, 8 à 15 min ; glacer carottes et navets au beurre et au sucre.",
  "Des morceaux de même taille cuisent ensemble ; une viande rôtie repose 10 à 15 min avant d'être tranchée.",
  "Assaisonner une sauce en dernier, quand elle a sa consistance ; finir au citron après avoir lié.",
  "Tomates, pommes de terre, oignons et ail ne vont pas au frigo ; champignons dans un sac en papier, essuyés, jamais trempés.",
];

/** Le savoir qui accompagne les consignes du Chef, avec la saison du mois. */
export function savoirPourLeChef(mois: Mois): string {
  return [
    `Savoir de cuisine (référentiel du brevet de chef de cuisine, choisi pour la maison) :`,
    `- Légumes suisses de saison en ${NOMS_MOIS[mois - 1]} : ${legumesDuMois(mois).join(", ")}.`,
    `- Quantités pour deux (crues ou sèches) : ${BASES.filter((b) => b.id !== "pain").map((b) => `${b.nom} ${b.pourDeux}`).join(" ; ")} ; viande sans os 200 à 240 g ; poisson 2 filets d'environ 150 g ; œufs 4 à 6.`,
    `- Les bases : ${BASES.map((b) => `${b.nom} (${b.repere})`).join(" ; ")}.`,
    `- Cuissons sûres : ${PROTEINES.filter((p) => !p.vegetarien).map((p) => `${p.nom} ${p.repere}`).join(" ; ")} ; œufs : ${PROTEINES.find((p) => p.id === "oeufs")!.repere}.`,
    `- Restes au frigo, au plus : ${RESTES.map((r) => `${r.quoi} ${r.jours} jour${r.jours > 1 ? "s" : ""}`).join(" ; ")}.`,
    ...GESTES.map((g) => `- ${g}`),
  ].join("\n");
}
