import { detecterRayon } from "./rayons";
import { RAYONS, type Contexte, type Element, type Id, type Liste, type Rayon } from "./types";
import { ErreurValidation } from "./foyer";

const UNITES = "(?:kg|g|l|cl|ml|x|paquets?|boites?|boîtes?|bouteilles?|pots?|sachets?|tranches?)";
const QUANTITE_DEBUT = new RegExp(`^(\\d+(?:[.,]\\d+)?\\s*${UNITES}?)\\s+(?:de\\s+|d')?(.+)$`, "i");
const QUANTITE_FIN = new RegExp(`^(.+?)\\s+(?:x\\s*)?(\\d+(?:[.,]\\d+)?\\s*${UNITES}?)$`, "i");

/** Sépare la quantité du nom : « 2 kg de pommes » → { quantite: "2 kg", texte: "pommes" }. */
export function analyserSaisie(saisie: string): { texte: string; quantite: string | null } {
  const s = saisie.trim().replace(/\s+/g, " ");
  const debut = s.match(QUANTITE_DEBUT);
  if (debut) return { quantite: debut[1].replace(/\s+/g, " "), texte: majuscule(debut[2]) };
  const fin = s.match(QUANTITE_FIN);
  if (fin) return { quantite: fin[2].replace(/\s+/g, " "), texte: majuscule(fin[1]) };
  return { quantite: null, texte: majuscule(s) };
}

function majuscule(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function nouvelElement(
  liste: Liste,
  saisie: string,
  ajoutePar: Id | null,
  ctx: Contexte,
): Element {
  const { texte, quantite } = analyserSaisie(saisie);
  if (texte.length === 0) throw new ErreurValidation("L'élément est vide.");
  return {
    id: ctx.nouvelId(),
    listeId: liste.id,
    texte,
    quantite,
    rayon: liste.type === "courses" ? detecterRayon(texte) : "Autre",
    coche: false,
    ajoutePar,
    creeLe: ctx.maintenant(),
    cocheLe: null,
  };
}

export function basculerCoche(element: Element, ctx: Contexte): Element {
  return element.coche
    ? { ...element, coche: false, cocheLe: null }
    : { ...element, coche: true, cocheLe: ctx.maintenant() };
}

/** Un élément déjà présent et non coché, au même nom, est un doublon. */
export function trouverDoublon(elements: Element[], saisie: string): Element | undefined {
  const { texte } = analyserSaisie(saisie);
  const cle = texte.toLowerCase();
  return elements.find((e) => !e.coche && e.texte.toLowerCase() === cle);
}

export interface GroupeRayon {
  rayon: Rayon;
  elements: Element[];
}

/**
 * Prépare l'affichage d'une liste : les éléments à prendre, groupés par rayon
 * dans l'ordre du magasin (liste de courses) ou par ordre d'ajout, puis les cochés.
 */
export function organiserListe(
  liste: Liste,
  elements: Element[],
): { aPrendre: GroupeRayon[]; coches: Element[] } {
  const siens = elements.filter((e) => e.listeId === liste.id);
  const aPrendre = siens
    .filter((e) => !e.coche)
    .sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  const coches = siens
    .filter((e) => e.coche)
    .sort((a, b) => (b.cocheLe ?? "").localeCompare(a.cocheLe ?? ""));

  if (liste.type !== "courses") {
    return { aPrendre: aPrendre.length ? [{ rayon: "Autre", elements: aPrendre }] : [], coches };
  }
  const groupes = RAYONS.map((rayon) => ({
    rayon,
    elements: aPrendre.filter((e) => e.rayon === rayon),
  })).filter((g) => g.elements.length > 0);
  return { aPrendre: groupes, coches };
}

export function compterAPrendre(liste: Liste, elements: Element[]): number {
  return elements.filter((e) => e.listeId === liste.id && !e.coche).length;
}

export function nouvelleListe(nom: string, icone: string, type: Liste["type"], ctx: Contexte): Liste {
  const n = nom.trim();
  if (n.length === 0) throw new ErreurValidation("La liste doit avoir un nom.");
  return { id: ctx.nouvelId(), nom: n, icone: icone || "📝", type, creeLe: ctx.maintenant() };
}
