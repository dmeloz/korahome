// Les vêtements du foyer (idée de Sarah, Kora 0.0.79) : pour chacun, ses tailles, ses envies
// à acheter et ce qui attend d'être trié. Tout se partage : l'autre voit les tailles et les
// envies, de quoi trouver un cadeau qui va. Collection partagée `vetements`, un document par
// taille, envie ou pièce à trier.

import type { Contexte, Id } from "./types";

/** Les pièces dont on retient la taille. Le texte de la taille reste libre (« M », « 38 », « W30 L32 »). */
export const PIECES = [
  { id: "haut", nom: "Haut", exemple: "M, 38" },
  { id: "pantalon", nom: "Pantalon", exemple: "38, W30 L32" },
  { id: "robe", nom: "Robe ou costume", exemple: "36, 48" },
  { id: "chaussures", nom: "Chaussures", exemple: "39" },
  { id: "sousVetements", nom: "Sous-vêtements", exemple: "S, 85B" },
  { id: "manteau", nom: "Manteau", exemple: "L" },
] as const;
export type Piece = (typeof PIECES)[number]["id"];

export interface Taille {
  /** « taille-<membre>-<pièce> » : une seule taille par pièce et par personne. */
  id: Id;
  type: "taille";
  membreId: Id;
  piece: Piece;
  valeur: string;
  modifieLe: string;
}

export interface Envie {
  id: Id;
  type: "envie";
  membreId: Id;
  titre: string;
  prix: number | null;
  /** Le magasin ou l'adresse où on l'a vue. */
  ou: string | null;
  creeLe: string;
  ajoutePar: Id | null;
  /** Le jour de l'achat ; une envie achetée reste visible trente jours, rayée. */
  acheteLe: string | null;
}

/** Ce qu'on fait d'une pièce qui ne sert plus. */
export const SORTS = [
  { id: "donner", nom: "Donner" },
  { id: "vendre", nom: "Vendre" },
  { id: "reparer", nom: "Réparer" },
  { id: "jeter", nom: "Jeter" },
] as const;
export type Sort = (typeof SORTS)[number]["id"];

export interface ATrier {
  id: Id;
  type: "tri";
  membreId: Id;
  titre: string;
  sort: Sort;
  creeLe: string;
  /** Le jour où c'est fait (donné, vendu…) ; reste visible trente jours, rayé. */
  faitLe: string | null;
}

export type DocVetement = Taille | Envie | ATrier;

export const JOURS_VISIBLES_APRES = 30;
export const LONGUEUR_TITRE = 80;

export const idTaille = (membreId: Id, piece: Piece): Id => `taille-${membreId}-${piece}`;

/** La taille d'une pièce pour une personne, ou null. */
export function tailleDe(docs: readonly DocVetement[], membreId: Id, piece: Piece): Taille | null {
  return docs.find((d): d is Taille => d.type === "taille" && d.membreId === membreId && d.piece === piece) ?? null;
}

/** Poser ou changer une taille ; une valeur vide la retire (rend null : à supprimer). */
export function poserTaille(membreId: Id, piece: Piece, valeur: string, ctx: Contexte): Taille | null {
  const v = valeur.trim().slice(0, 20);
  if (!v) return null;
  return { id: idTaille(membreId, piece), type: "taille", membreId, piece, valeur: v, modifieLe: ctx.maintenant() };
}

// « Veste en laine 120 », « baskets 89.90 CHF », « jean 79.- » : le prix au bout est repris.
const PRIX_AU_BOUT = /\s+(?:CHF\s*)?(\d{1,5}(?:[.,]\d{1,2})?)(?:\s*(?:CHF|fr\.?|francs?|\.-|-))?\s*$/i;

/** Lit une envie écrite d'une traite : le titre, et le prix s'il est au bout. */
export function lireEnvie(texte: string): { titre: string; prix: number | null } {
  const t = texte.trim().replace(/\s+/g, " ");
  const m = PRIX_AU_BOUT.exec(t);
  if (!m || m.index === 0) return { titre: t.slice(0, LONGUEUR_TITRE), prix: null };
  return { titre: t.slice(0, m.index).trim().slice(0, LONGUEUR_TITRE), prix: Number(m[1].replace(",", ".")) };
}

export function nouvelleEnvie(texte: string, membreId: Id, ajoutePar: Id | null, ctx: Contexte): Envie | null {
  const { titre, prix } = lireEnvie(texte);
  if (!titre) return null;
  return { id: ctx.nouvelId(), type: "envie", membreId, titre, prix, ou: null, creeLe: ctx.maintenant(), ajoutePar, acheteLe: null };
}

export function nouveauTri(texte: string, membreId: Id, sort: Sort, ctx: Contexte): ATrier | null {
  const titre = texte.trim().replace(/\s+/g, " ").slice(0, LONGUEUR_TITRE);
  if (!titre) return null;
  return { id: ctx.nouvelId(), type: "tri", membreId, titre, sort, creeLe: ctx.maintenant(), faitLe: null };
}

const recent = (quand: string | null, maintenant: string) =>
  !quand || Date.parse(maintenant) - Date.parse(quand) < JOURS_VISIBLES_APRES * 86_400_000;

/** Les envies d'une personne : à acheter d'abord (les plus récentes en haut), puis achetées ces trente jours. */
export function enviesDe(docs: readonly DocVetement[], membreId: Id, maintenant: string): Envie[] {
  const envies = docs.filter((d): d is Envie => d.type === "envie" && d.membreId === membreId && recent(d.acheteLe, maintenant));
  return envies.sort((a, b) => Number(!!a.acheteLe) - Number(!!b.acheteLe) || b.creeLe.localeCompare(a.creeLe));
}

/** Ce qui attend d'être trié : à faire d'abord, dans l'ordre d'arrivée, puis fait ces trente jours. */
export function aTrierDe(docs: readonly DocVetement[], membreId: Id, maintenant: string): ATrier[] {
  const tri = docs.filter((d): d is ATrier => d.type === "tri" && d.membreId === membreId && recent(d.faitLe, maintenant));
  return tri.sort((a, b) => Number(!!a.faitLe) - Number(!!b.faitLe) || a.creeLe.localeCompare(b.creeLe));
}

/** Le total des envies pas encore achetées qui ont un prix. */
export const totalEnvies = (envies: readonly Envie[]): number =>
  Math.round(envies.reduce((s, e) => s + (e.acheteLe || e.prix === null ? 0 : e.prix), 0) * 100) / 100;

/** Le chiffre de l'onglet : envies à acheter et pièces à trier, pour cette personne. */
export function compterVetements(docs: readonly DocVetement[], membreId: Id | null, maintenant: string): number {
  if (!membreId) return 0;
  return enviesDe(docs, membreId, maintenant).filter((e) => !e.acheteLe).length + aTrierDe(docs, membreId, maintenant).filter((t) => !t.faitLe).length;
}

/** « 3 tailles · 2 envies · 1 à trier », ou une invitation quand rien n'est noté. */
export function resumeVetements(docs: readonly DocVetement[], membreId: Id, maintenant: string): string {
  const tailles = docs.filter((d) => d.type === "taille" && d.membreId === membreId).length;
  const envies = enviesDe(docs, membreId, maintenant).filter((e) => !e.acheteLe).length;
  const tri = aTrierDe(docs, membreId, maintenant).filter((t) => !t.faitLe).length;
  const parts = [
    tailles && `${tailles} taille${tailles > 1 ? "s" : ""}`,
    envies && `${envies} envie${envies > 1 ? "s" : ""}`,
    tri && `${tri} à trier`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Rien de noté pour l'instant";
}
