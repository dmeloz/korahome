// Un code-barres scanné : la fiche publique d'Open Food Facts donne le nom du produit,
// sa contenance et sa photo. Ce module lit la réponse ; l'appel réseau est fait par l'interface.

import { lireQuantite, type Lieu, type Unite } from "./stock";

export interface FicheProduit {
  code: string;
  nom: string;
  nombre: number | null;
  unite: Unite | null;
  /** Le lieu que suggèrent ses catégories (surgelé, frais) ; null quand elles ne disent rien. */
  lieu: Lieu | null;
  image: string | null;
}

/** L'adresse de la fiche, limitée aux champs utiles. */
export function adresseFiche(code: string): string {
  const champs = "product_name_fr,product_name,generic_name_fr,brands,quantity,image_front_small_url,image_small_url,categories_tags";
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${champs}`;
}

/** Un code-barres alimentaire : 8, 12, 13 ou 14 chiffres. */
export function estCodeBarres(code: string): boolean {
  return /^(?:\d{8}|\d{12,14})$/.test(code);
}

interface ReponseOff {
  status?: number;
  product?: {
    product_name_fr?: string;
    product_name?: string;
    generic_name_fr?: string;
    brands?: string;
    quantity?: string;
    image_front_small_url?: string;
    image_small_url?: string;
    categories_tags?: string[];
  };
}

function lieuDesCategories(tags: readonly string[]): Lieu | null {
  const a = (mot: string) => tags.some((t) => t.includes(mot));
  if (a("frozen") || a("surgel") || a("ice-cream")) return "congelateur";
  if (a("dairies") || a("yogurt") || a("cheese") || a("meats") || a("fresh") || a("refrigerated") || a("hams")) return "frigo";
  if (a("pastas") || a("cereals") || a("canned") || a("snacks") || a("beverages") || a("coffees") || a("teas") || a("rices") || a("flours")) return "placard";
  return null;
}

/** null quand le produit n'est pas dans la base ou n'a pas de nom. */
export function lireFiche(code: string, reponse: unknown): FicheProduit | null {
  const r = reponse as ReponseOff | null;
  const p = r?.product;
  if (!p || r?.status === 0) return null;
  const nom = (p.product_name_fr || p.product_name || p.generic_name_fr || "").trim();
  if (!nom) return null;
  const marque = p.brands?.split(",")[0]?.trim();
  const avecMarque = marque && !nom.toLowerCase().includes(marque.toLowerCase()) ? `${nom} ${marque}` : nom;
  const contenance = (p.quantity ?? "").replace(/\s+/g, " ").trim().match(/^(\d+(?:[.,]\d+)?\s*(?:kg|g|cl|ml|l))\b/i);
  const { nombre, unite } = lireQuantite(contenance ? contenance[1] : null);
  return {
    code,
    nom: avecMarque,
    nombre,
    unite,
    lieu: lieuDesCategories(p.categories_tags ?? []),
    image: p.image_front_small_url || p.image_small_url || null,
  };
}
