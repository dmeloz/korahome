import type { Contexte, Foyer, Liste, Membre } from "./types";

export const COULEURS_MEMBRES = ["#E07A5F", "#3D85C6", "#81B29A", "#F2CC8F", "#9B72CF"];

export class ErreurValidation extends Error {}

/** Crée un foyer à partir de son nom et des prénoms de ses membres. */
export function creerFoyer(nom: string, prenoms: string[], ctx: Contexte): Foyer {
  const nomPropre = nom.trim();
  const prenomsPropres = prenoms.map((p) => p.trim()).filter((p) => p.length > 0);
  if (nomPropre.length === 0) throw new ErreurValidation("Le foyer doit avoir un nom.");
  if (prenomsPropres.length === 0) throw new ErreurValidation("Ajoute au moins un membre.");
  const doublon = prenomsPropres.find(
    (p, i) => prenomsPropres.findIndex((q) => q.toLowerCase() === p.toLowerCase()) !== i,
  );
  if (doublon) throw new ErreurValidation(`« ${doublon} » est présent deux fois.`);

  const membres: Membre[] = prenomsPropres.map((prenom, i) => ({
    id: ctx.nouvelId(),
    prenom,
    couleur: COULEURS_MEMBRES[i % COULEURS_MEMBRES.length],
  }));
  return { id: ctx.nouvelId(), nom: nomPropre, membres, creeLe: ctx.maintenant() };
}

/** Listes créées avec un nouveau foyer. */
export function listesInitiales(ctx: Contexte): Liste[] {
  return [
    { id: ctx.nouvelId(), nom: "Courses", icone: "🛒", type: "courses", creeLe: ctx.maintenant() },
    { id: ctx.nouvelId(), nom: "Maison", icone: "🔧", type: "simple", creeLe: ctx.maintenant() },
  ];
}
