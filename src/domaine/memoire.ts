// La mémoire de Jarvis : ce qu'il sait du foyer d'une fois à l'autre (« Sarah n'aime pas
// la coriandre », « les courses se font le samedi »). On le lui dit, ou il le remarque et
// demande avant de le retenir. Tout se relit, se corrige et s'efface depuis sa page.
// Partagée entre les deux iPhone (collection « memoire »).

import { ErreurValidation } from "./foyer";
import { normaliser } from "./rayons";
import type { Contexte, Id } from "./types";

export interface Souvenir {
  id: Id;
  texte: string;
  /**
   * « demande » : on lui a dit de le retenir ; « remarque » : il l'a remarqué et on a dit oui ;
   * « bilan » : Kora l'a appris de votre usage (bilan du dimanche, avis sur un plat du Chef).
   */
  source: "demande" | "remarque" | "bilan";
  auteur: Id | null;
  creeLe: string;
  /** Ce que Kora a appris, pour ne pas le reproposer : « rachat:lait », « chef:aime:gratin ». */
  cle?: string;
  /** Proposé au bilan et refusé : gardé pour ne plus le proposer, mais jamais relu par Jarvis. */
  refuse?: boolean;
}

/** Ce qui compte vraiment dans la mémoire : tout sauf les apprentissages refusés. */
export function souvenirsRetenus(souvenirs: readonly Souvenir[]): Souvenir[] {
  return souvenirs.filter((s) => !s.refuse);
}

/** Au-delà, les plus anciens ne partent plus avec chaque demande : la mémoire reste légère et bon marché. */
export const SOUVENIRS_ENVOYES = 60;
/** Une phrase, pas un roman. */
export const LONGUEUR_SOUVENIR = 200;

export function nouveauSouvenir(texte: string, source: Souvenir["source"], auteur: Id | null, ctx: Contexte): Souvenir {
  const propre = texte.trim().replace(/\s+/g, " ").slice(0, LONGUEUR_SOUVENIR);
  if (!propre) throw new ErreurValidation("Il n'y a rien à retenir.");
  return { id: ctx.nouvelId(), texte: propre.charAt(0).toUpperCase() + propre.slice(1), source, auteur, creeLe: ctx.maintenant() };
}

export function corrigerSouvenir(souvenir: Souvenir, texte: string): Souvenir {
  const propre = texte.trim().replace(/\s+/g, " ").slice(0, LONGUEUR_SOUVENIR);
  if (!propre) throw new ErreurValidation("Le souvenir est vide.");
  return { ...souvenir, texte: propre };
}

const cle = (t: string) => normaliser(t).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

/** Un souvenir qui dit déjà la même chose (sans tenir compte des majuscules, accents ni ponctuation). */
export function souvenirSemblable(souvenirs: readonly Souvenir[], texte: string): Souvenir | undefined {
  const c = cle(texte);
  return souvenirsRetenus(souvenirs).find((s) => cle(s.texte) === c);
}

/** Le souvenir visé par « oublie que… » : le même texte, sinon celui qui le contient. */
export function trouverSouvenir(souvenirs: readonly Souvenir[], texte: string): Souvenir | undefined {
  const c = cle(texte);
  if (!c) return undefined;
  return souvenirSemblable(souvenirs, texte) ?? souvenirsRetenus(souvenirs).find((s) => cle(s.texte).includes(c) || c.includes(cle(s.texte)));
}

/** Du plus ancien au plus récent : l'ordre dans lequel le foyer les a confiés. */
export function trierSouvenirs(souvenirs: readonly Souvenir[]): Souvenir[] {
  return souvenirsRetenus(souvenirs).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
}

/** Ce que Jarvis relit à chaque demande : les souvenirs les plus récents, un par ligne. */
export function decrireMemoire(souvenirs: readonly Souvenir[]): string[] {
  const retenus = trierSouvenirs(souvenirs).slice(-SOUVENIRS_ENVOYES);
  if (retenus.length === 0) return ["Ce que tu sais du foyer : rien encore."];
  return ["Ce que tu sais du foyer (ta mémoire) :", ...retenus.map((s) => `- ${s.texte}`)];
}
