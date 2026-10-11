// Les courses qui se devinent : chaque article coché sur la liste de courses laisse la date
// de l'achat. Quand un article revient régulièrement (le lait chaque semaine, la lessive
// chaque mois) et que son moment approche, Kora le propose d'un toucher.

import { normaliser } from "./rayons";
import { ecartJours } from "./taches";
import type { Achat, Element, Jour, Liste } from "./types";

/** Les dates gardées par article : assez pour un rythme, sans alourdir la liste. */
const DATES_GARDEES = 8;
/** Au-delà, les articles achetés il y a le plus longtemps sont oubliés. */
const ARTICLES_GARDES = 200;
/** Un article est proposé quand 80 % de son intervalle habituel est passé. */
const SEUIL = 0.8;

const cle = (texte: string) => normaliser(texte);

/** Note l'achat d'un article, une fois par jour au plus. */
export function noterAchat(liste: Liste, element: Element, jour: Jour): Liste {
  const achats = [...(liste.achats ?? [])];
  const i = achats.findIndex((a) => cle(a.texte) === cle(element.texte));
  const avant = i >= 0 ? achats[i] : { texte: element.texte, rayon: element.rayon, jours: [] };
  if (avant.jours.includes(jour)) return liste;
  const apres: Achat = { texte: element.texte, rayon: element.rayon, jours: [...avant.jours, jour].sort().slice(-DATES_GARDEES) };
  if (i >= 0) achats.splice(i, 1);
  achats.push(apres);
  const garde = achats.sort((a, b) => (a.jours.at(-1) ?? "").localeCompare(b.jours.at(-1) ?? "")).slice(-ARTICLES_GARDES);
  return { ...liste, achats: garde };
}

/** Un article décoché le jour même n'a finalement pas été acheté. */
export function oublierAchat(liste: Liste, element: Element, jour: Jour): Liste {
  if (!liste.achats?.some((a) => cle(a.texte) === cle(element.texte) && a.jours.includes(jour))) return liste;
  const achats = liste.achats
    .map((a) => (cle(a.texte) === cle(element.texte) ? { ...a, jours: a.jours.filter((j) => j !== jour) } : a))
    .filter((a) => a.jours.length > 0);
  return { ...liste, achats };
}

export interface Suggestion {
  texte: string;
  /** « tous les 7 jours environ » */
  rythme: string;
}

/**
 * Ce qu'il faudra bientôt racheter : les articles achetés au moins trois fois, dont le
 * moment habituel approche, et qui ne sont pas déjà sur la liste. Le plus en retard d'abord.
 */
export function suggestions(liste: Liste, elements: readonly Element[], aujourdhui: Jour, max = 6): Suggestion[] {
  const surLaListe = new Set(elements.filter((e) => e.listeId === liste.id && !e.coche).map((e) => cle(e.texte)));
  const candidats: { texte: string; avance: number; intervalle: number }[] = [];
  for (const a of liste.achats ?? []) {
    if (a.jours.length < 3 || surLaListe.has(cle(a.texte))) continue;
    const ecarts = a.jours.slice(1).map((j, i) => ecartJours(a.jours[i], j));
    const intervalle = ecarts.reduce((s, e) => s + e, 0) / ecarts.length;
    if (intervalle < 1) continue;
    const depuis = ecartJours(a.jours[a.jours.length - 1], aujourdhui);
    const avance = depuis / intervalle;
    if (avance >= SEUIL) candidats.push({ texte: a.texte, avance, intervalle });
  }
  return candidats
    .sort((x, y) => y.avance - x.avance)
    .slice(0, max)
    .map((c) => ({ texte: c.texte, rythme: `tous les ${Math.round(c.intervalle)} jours environ` }));
}
