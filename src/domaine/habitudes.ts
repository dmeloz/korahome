// Les courses qui se devinent : chaque article coché sur la liste de courses laisse la date
// de l'achat. Quand un article revient régulièrement (le lait chaque semaine, la lessive
// chaque mois) et que son moment approche, Kora le propose d'un toucher.

import { normaliser } from "./rayons";
import { ecartJours } from "./taches";
import type { Achat, Element, Jour, Liste } from "./types";
import { NOMS_JOURS } from "./texte";

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
  const quantite = element.quantite ?? avant.quantite;
  if (quantite) apres.quantite = quantite;
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

/** L'achat retenu pour ce nom, s'il y en a un. */
export function achatDe(liste: Liste, texte: string): Achat | undefined {
  const c = cle(texte);
  return c ? liste.achats?.find((a) => cle(a.texte) === c) : undefined;
}

/** La quantité prise d'habitude (« 2 l »), pour remplir une saisie qui n'en donne pas. */
export function quantiteHabituelle(liste: Liste, texte: string): string | null {
  return achatDe(liste, texte)?.quantite ?? null;
}

/** Les articles déjà achetés qui commencent comme ce qui est tapé, les plus fréquents d'abord. */
export function devinerArticles(liste: Liste, elements: readonly Element[], tape: string, max = 4): Achat[] {
  const debut = cle(tape);
  if (debut.length < 2) return [];
  const surLaListe = new Set(elements.filter((e) => e.listeId === liste.id && !e.coche).map((e) => cle(e.texte)));
  return (liste.achats ?? [])
    .filter((a) => {
      const c = cle(a.texte);
      return c !== debut && !surLaListe.has(c) && (c.startsWith(debut) || c.includes(` ${debut}`));
    })
    .sort((a, b) => b.jours.length - a.jours.length || (b.jours.at(-1) ?? "").localeCompare(a.jours.at(-1) ?? ""))
    .slice(0, max);
}


const jourDeSemaine = (jour: Jour) => new Date(`${jour}T12:00:00Z`).getUTCDay();

/** Les courses « comme d'habitude » : le jour où le foyer fait ses courses, et ce qu'il y prend presque à chaque fois. */
export interface Panier {
  /** 0 = dimanche. */
  jour: number;
  nomDuJour: string;
  /** Les articles habituels de ce jour-là, pas encore sur la liste. */
  articles: Achat[];
  /** Tous les articles habituels de ce jour-là, même ceux déjà sur la liste. */
  habituels: Achat[];
}

/** Au moins trois sorties le même jour de la semaine pour parler d'habitude. */
const SORTIES_MIN = 3;
/** Un article fait partie du panier quand il est pris à au moins la moitié de ces sorties. */
const PART_DU_PANIER = 0.5;

/**
 * Le jour des courses du foyer et son panier habituel : le jour de la semaine où il y a eu le
 * plus de sorties (au moins trois), et les articles pris à au moins la moitié d'entre elles.
 */
export function panierHabituel(liste: Liste, elements: readonly Element[]): Panier | null {
  const sorties = new Map<number, Set<Jour>>();
  for (const a of liste.achats ?? []) {
    for (const j of a.jours) {
      const n = jourDeSemaine(j);
      if (!sorties.has(n)) sorties.set(n, new Set());
      sorties.get(n)!.add(j);
    }
  }
  const [jour, dates] = [...sorties.entries()].sort((x, y) => y[1].size - x[1].size || x[0] - y[0])[0] ?? [];
  if (jour === undefined || !dates || dates.size < SORTIES_MIN) return null;
  const habituels = (liste.achats ?? []).filter((a) => a.jours.filter((j) => dates.has(j)).length >= Math.max(2, dates.size * PART_DU_PANIER));
  if (habituels.length < 2) return null;
  const surLaListe = new Set(elements.filter((e) => e.listeId === liste.id && !e.coche).map((e) => cle(e.texte)));
  return {
    jour,
    nomDuJour: NOMS_JOURS[jour],
    articles: habituels.filter((a) => !surLaListe.has(cle(a.texte))),
    habituels,
  };
}
