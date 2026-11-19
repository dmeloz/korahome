// La lecture au doigt des graphiques (Kora 0.1.21, axe « graphiques qu'on touche ») : le doigt
// glisse le long d'une courbe ou de barres, Kora dit la valeur du point le plus proche.
// Règles pures ; le geste lui-même est dans ui/pieces/Lecture.tsx.

/** L'index du point dont l'abscisse est la plus proche de `x` ; -1 s'il n'y a aucun point. */
export function plusProche(abscisses: readonly number[], x: number): number {
  let meilleur = -1;
  for (let i = 0; i < abscisses.length; i++) {
    if (meilleur < 0 || Math.abs(abscisses[i] - x) < Math.abs(abscisses[meilleur] - x)) meilleur = i;
  }
  return meilleur;
}

/** La barre sous le doigt : `part` va de 0 (bord gauche) à 1 (bord droit), `n` barres de même largeur. */
export function barreSous(part: number, n: number): number {
  if (n <= 0) return -1;
  return Math.max(0, Math.min(n - 1, Math.floor(part * n)));
}

/** Le pas d'une flèche du clavier (VoiceOver, clavier de l'iPad) : on reste dans les points. */
export function pasSuivant(index: number, n: number, sens: 1 | -1): number {
  if (n <= 0) return -1;
  if (index < 0) return sens > 0 ? 0 : n - 1;
  return Math.max(0, Math.min(n - 1, index + sens));
}

/** Ce que le budget dit d'un mois de courses : « 110 de plus que le budget », « 90 sous le budget ». */
export function ecartAuBudget(total: number, budget: number): "au-dessus" | "dessous" | "pile" | null {
  if (budget <= 0) return null;
  const ecart = Math.round(total - budget);
  return ecart > 0 ? "au-dessus" : ecart < 0 ? "dessous" : "pile";
}
