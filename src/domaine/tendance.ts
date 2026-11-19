// La tendance dans les cartes (Kora 0.1.22, idée validée par Melo le 20 novembre 2026) : une
// petite courbe nue et un mot, pour voir d'un regard si ça monte ou si ça descend.

export type Sens = "hausse" | "baisse" | "stable";

/** Le sens d'une suite de valeurs : on compare la dernière à la première ; sous `seuil` (2 %), c'est stable. */
export function sensDe(points: readonly number[], seuil = 0.02): Sens | null {
  if (points.length < 2) return null;
  const debut = points[0];
  const fin = points[points.length - 1];
  const base = Math.max(Math.abs(debut), Math.abs(fin));
  if (base === 0 || Math.abs(fin - debut) / base < seuil) return "stable";
  return fin > debut ? "hausse" : "baisse";
}

/** Le mot qui va avec la courbe. */
export const motDuSens = (sens: Sens): string => (sens === "hausse" ? "en hausse" : sens === "baisse" ? "en baisse" : "stable");

/** Les `combien` dernières valeurs, pour que la courbe d'une carte reste lisible. */
export const dernieres = (points: readonly number[], combien = 12): number[] => points.slice(-combien);

/** Le tracé d'une courbe nue dans un cadre `largeur` × `hauteur`, calé entre le plus bas et le plus haut. */
export function traceDe(points: readonly number[], largeur: number, hauteur: number, marge = 2): string {
  if (!points.length) return `M0,${hauteur - marge} L${largeur},${hauteur - marge}`;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pas = points.length > 1 ? largeur / (points.length - 1) : largeur;
  const y = (v: number) => (max === min ? hauteur / 2 : hauteur - marge - ((v - min) / (max - min)) * (hauteur - 2 * marge));
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * pas).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
}
