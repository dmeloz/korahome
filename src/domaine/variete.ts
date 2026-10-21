// Le tirage de la semaine (depuis Kora 0.0.68) : avant d'appeler le Chef, Kora tire elle-même
// au hasard la trame de chaque soir (une base, une protéine, deux légumes de saison), parce
// qu'une IA laissée seule revient vite aux mêmes plats. Le hasard est pondéré : ce qu'on a mangé
// ces quatre dernières semaines a moins de chances de revenir, et rien ne se répète dans la
// semaine (une protéine deux fois au plus, jamais deux soirs de suite). Un soir au moins est sans
// viande ni poisson. Le Chef compose ensuite ses recettes sur cette trame, en gardant d'abord
// ce qui est à finir dans le frigo.
//
// Le hasard arrive de l'appelant (`hasard`, comme Math.random), pour que les tests le fixent.

import type { MenuSemaine } from "./chef";
import { BASES, legumesDuMois, PROTEINES, type Mois } from "./savoirCuisine";
import { normaliser } from "./rayons";
import { ecartJours } from "./taches";
import type { Jour } from "./types";

/** La trame d'un soir, gardée dans le menu pour que les semaines suivantes s'en souviennent. */
export interface TrameSoir {
  base: string;
  proteine: string;
  legumes: string[];
}

/** On se souvient de quatre semaines. */
export const SEMAINES_DE_MEMOIRE = 4;
/** Le poids d'un choix selon l'ancienneté de son dernier passage : la semaine passée, il y a deux, trois, quatre semaines. */
const POIDS_SELON_SEMAINES = [0.1, 0.3, 0.6, 0.85];

export type Hasard = () => number;

/** Ce que les menus passés ont servi : pour chaque base, protéine ou légume, la semaine la plus récente (1 = la semaine passée). */
export function dejaServi(menus: readonly MenuSemaine[], aujourdhui: Jour): Map<string, number> {
  const vu = new Map<string, number>();
  const noter = (cle: string, semaines: number) => {
    if (!vu.has(cle) || vu.get(cle)! > semaines) vu.set(cle, semaines);
  };
  for (const m of menus) {
    const ecart = ecartJours(m.semaine, aujourdhui);
    if (ecart <= 0 || ecart > SEMAINES_DE_MEMOIRE * 7) continue;
    const semaines = Math.min(SEMAINES_DE_MEMOIRE, Math.ceil(ecart / 7));
    const trame = lireTrame(m.trame);
    if (trame) {
      for (const t of trame) {
        noter(`base:${t.base}`, semaines);
        noter(`proteine:${t.proteine}`, semaines);
        for (const l of t.legumes) noter(`legume:${normaliser(l)}`, semaines);
      }
      continue;
    }
    // Un menu d'avant le tirage : on reconnaît ce qu'il servait à ses mots.
    const texte = ` ${normaliser(m.repas.map((r) => [r.titre, r.description, ...r.avecLeStock].join(" ")).join(" "))} `;
    const contient = (mot: string) => new RegExp(`[^a-z]${mot.replace(/[-]/g, "[- ]")}[sx]?[^a-z]`).test(texte);
    for (const b of BASES) if (b.mots.some(contient)) noter(`base:${b.id}`, semaines);
    for (const p of PROTEINES) if (p.mots.some(contient)) noter(`proteine:${p.id}`, semaines);
    for (const l of legumesDuMois(Number(aujourdhui.slice(5, 7)))) if (contient(normaliser(l))) noter(`legume:${normaliser(l)}`, semaines);
  }
  return vu;
}

const poids = (vu: Map<string, number>, cle: string) => {
  const semaines = vu.get(cle);
  return semaines === undefined ? 1 : POIDS_SELON_SEMAINES[semaines - 1] ?? 1;
};

/** Un tirage au sort pondéré ; null quand il ne reste rien à tirer. */
function tirer<T>(choix: readonly T[], poidsDe: (c: T) => number, hasard: Hasard): T | null {
  const poidsListe = choix.map(poidsDe);
  const total = poidsListe.reduce((a, b) => a + b, 0);
  if (!choix.length || total <= 0) return null;
  let r = hasard() * total;
  for (let i = 0; i < choix.length; i++) {
    r -= poidsListe[i];
    if (r < 0) return choix[i];
  }
  return choix[choix.length - 1];
}

/** La trame des soirs de la semaine. */
export function tirerSemaine(d: { menus: readonly MenuSemaine[]; aujourdhui: Jour; nombre: number; hasard: Hasard }): TrameSoir[] {
  const mois: Mois = Number(d.aujourdhui.slice(5, 7));
  const vu = dejaServi(d.menus, d.aujourdhui);
  const legumes = legumesDuMois(mois);
  const bases = new Set<string>();
  const proteines: string[] = [];
  const legumesPris = new Set<string>();
  const vegetarienAuPlusTard = Math.floor(d.hasard() * d.nombre);
  const soirs: TrameSoir[] = [];
  for (let i = 0; i < d.nombre; i++) {
    const base = tirer(BASES.filter((b) => !bases.has(b.id)), (b) => poids(vu, `base:${b.id}`), d.hasard) ?? BASES[i % BASES.length];
    bases.add(base.id);
    const dejaVegetarien = proteines.some((id) => PROTEINES.find((p) => p.id === id)?.vegetarien);
    const candidates = PROTEINES.filter(
      (p) => proteines.filter((id) => id === p.id).length < 2 && proteines[proteines.length - 1] !== p.id && (dejaVegetarien || i < vegetarienAuPlusTard || p.vegetarien),
    );
    const proteine = tirer(candidates, (p) => poids(vu, `proteine:${p.id}`), d.hasard) ?? PROTEINES[i % PROTEINES.length];
    proteines.push(proteine.id);
    const deux: string[] = [];
    for (let n = 0; n < 2; n++) {
      // Quand tous les légumes du mois sont passés dans la semaine, ils peuvent revenir.
      const libres = legumes.filter((l) => !legumesPris.has(l) && !deux.includes(l));
      const l = tirer(libres.length ? libres : legumes.filter((x) => !deux.includes(x)), (x) => poids(vu, `legume:${normaliser(x)}`), d.hasard);
      if (!l) break;
      deux.push(l);
      legumesPris.add(l);
    }
    soirs.push({ base: base.id, proteine: proteine.id, legumes: deux });
  }
  return soirs;
}

/** La trame telle que le Chef la lit : « Soir 1 : pâtes · poisson · poireau, courge ». */
export function decrireTrame(trame: readonly TrameSoir[]): string[] {
  const nomBase = (id: string) => BASES.find((b) => b.id === id)?.nom ?? id;
  const nomProteine = (id: string) => PROTEINES.find((p) => p.id === id)?.nom ?? id;
  return trame.map((t, i) => `- Soir ${i + 1} : ${nomBase(t.base)} · ${nomProteine(t.proteine)} · ${t.legumes.join(", ")}`);
}

/** Relit une trame gardée dans un menu, sans lui faire confiance. */
export function lireTrame(brut: unknown): TrameSoir[] | undefined {
  if (!Array.isArray(brut)) return undefined;
  const trame = brut
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({
      base: typeof t.base === "string" ? t.base : "",
      proteine: typeof t.proteine === "string" ? t.proteine : "",
      legumes: Array.isArray(t.legumes) ? t.legumes.filter((l): l is string => typeof l === "string") : [],
    }))
    .filter((t) => t.base && t.proteine);
  return trame.length ? trame : undefined;
}
