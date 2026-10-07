import type { Rayon } from "./types";

// Mots-clés par rayon, en minuscules et sans accents. L'ordre compte :
// le premier rayon qui reconnaît un mot l'emporte.
const MOTS_CLES: [Rayon, string[]][] = [
  ["Bébé", ["couche", "lingette", "biberon", "petit pot", "lait infantile"]],
  ["Animaux", ["croquette", "litiere", "patee"]],
  ["Surgelés", ["surgele", "glace", "frites surgelees"]],
  ["Hygiène", ["dentifrice", "shampo", "savon", "gel douche", "deodorant", "papier toilette", "coton", "rasoir", "brosse a dent", "mouchoir"]],
  ["Entretien", ["lessive", "liquide vaisselle", "eponge", "javel", "sac poubelle", "sacs poubelle", "essuie-tout", "adoucissant", "nettoyant", "pastille lave"]],
  ["Boissons", ["eau", "jus", "soda", "coca", "biere", "vin", "sirop", "the", "cafe", "tisane", "limonade"]],
  ["Boulangerie", ["pain", "baguette", "croissant", "brioche", "viennoiserie", "pain de mie"]],
  ["Crèmerie", ["lait", "beurre", "yaourt", "yogourt", "fromage", "creme", "oeuf", "emmental", "mozzarella", "comte", "skyr"]],
  ["Boucherie et poisson", ["poulet", "boeuf", "steak", "jambon", "porc", "viande", "saucisse", "dinde", "poisson", "saumon", "thon frais", "crevette", "lardon", "veau", "agneau", "cabillaud"]],
  ["Fruits et légumes", ["pomme", "poire", "banane", "orange", "citron", "fraise", "raisin", "kiwi", "tomate", "salade", "laitue", "carotte", "oignon", "ail", "courgette", "aubergine", "poivron", "concombre", "avocat", "champignon", "brocoli", "epinard", "poireau", "patate", "pomme de terre", "fruit", "legume", "herbes", "persil", "basilic", "mangue", "ananas", "melon", "peche"]],
  ["Épicerie sucrée", ["sucre", "chocolat", "biscuit", "gateau", "confiture", "miel", "cereale", "nutella", "compote", "bonbon", "farine", "levure"]],
  ["Épicerie salée", ["pates", "riz", "huile", "vinaigre", "sel", "poivre", "conserve", "thon", "sauce", "moutarde", "ketchup", "mayonnaise", "lentille", "pois chiche", "semoule", "quinoa", "bouillon", "epice", "chips", "olive", "soupe"]],
];

export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .trim();
}

function contientMot(texte: string, motCle: string): boolean {
  // Le mot-clé doit commencer un mot ; le pluriel et les suffixes courts passent.
  const echappe = motCle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${echappe}`).test(texte);
}

/** Devine le rayon d'un article à partir de son nom. */
export function detecterRayon(texte: string): Rayon {
  const t = normaliser(texte);
  // Les expressions de plusieurs mots passent d'abord (« pomme de terre » avant « pomme »).
  let meilleur: { rayon: Rayon; longueur: number } | null = null;
  for (const [rayon, mots] of MOTS_CLES) {
    for (const mot of mots) {
      if (contientMot(t, mot) && (!meilleur || mot.length > meilleur.longueur)) {
        meilleur = { rayon, longueur: mot.length };
      }
    }
  }
  return meilleur?.rayon ?? "Autre";
}
