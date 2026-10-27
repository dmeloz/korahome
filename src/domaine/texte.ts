// Les petits outils de texte et de calendrier, partagés par toutes les règles : retirer les
// accents pour comparer, les noms des mois et des jours, les nombres sur deux chiffres.

/** « Pâtes fraîches » → « Pates fraiches » : la casse est gardée, seuls les accents partent. */
export const sansAccents = (t: string): string => t.normalize("NFD").replace(/\p{M}/gu, "");

export const NOMS_MOIS: readonly string[] = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Dans l'ordre de `Date.getDay()` : le dimanche d'abord. */
export const NOMS_JOURS: readonly string[] = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** 7 → « 07 ». */
export const deuxChiffres = (n: number): string => String(n).padStart(2, "0");

/** L'heure d'une date, « 08:05 ». */
export const heureMinute = (d: Date): string => `${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`;

/**
 * La ligne d'une aide repliée (0.0.84) : sa première idée, coupée avant le premier deux-points,
 * la première parenthèse ou la fin de la première phrase, pour ne jamais s'arrêter au milieu d'un
 * exemple. Le texte entier si rien ne le coupe.
 */
export function resumeAide(texte: string): string {
  const coupes = [texte.indexOf(" : "), texte.indexOf(" ("), texte.indexOf(". ")].filter((i) => i > 0);
  if (coupes.length === 0) return texte;
  return texte.slice(0, Math.min(...coupes)).replace(/[,;]$/, "");
}
