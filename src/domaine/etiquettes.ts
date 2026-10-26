import { depenses, POTS, type DocBudget, type Etiquette, type PlanBudget, type Pot } from "./budget";
import { ErreurValidation } from "./foyer";
import { sansAccents } from "./texte";
import type { Contexte, Id } from "./types";

// Les catégories du foyer (Kora 0.0.78) : des noms à soi (« Essence », « Resto », « Vêtements »),
// chacun rangé dans un pot, pour classer un paiement plus finement qu'« À moi » ou « Plaisir ».
// Elles vivent dans le plan du budget, donc partagées ; une dépense classée garde le nom de la
// catégorie en libellé et son pot, et ne perd rien si la catégorie est renommée ou retirée.

/** Un nom de catégorie tient sur une puce. */
export const LONGUEUR_NOM = 24;

const cle = (t: string) => sansAccents(t).toLowerCase().trim();

/** Les catégories du plan, dans l'ordre des noms. */
export const etiquettesDuPlan = (plan: PlanBudget): Etiquette[] => [...(plan.etiquettes ?? [])].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

export const etiquetteDe = (plan: PlanBudget, id: Id | null | undefined): Etiquette | undefined => (id ? plan.etiquettes?.find((e) => e.id === id) : undefined);

function nomPropre(plan: PlanBudget, nom: string, sauf?: Id): string {
  const propre = nom.replace(/\s+/g, " ").trim();
  if (!propre) throw new ErreurValidation("Donne un nom à la catégorie.");
  if (propre.length > LONGUEUR_NOM) throw new ErreurValidation(`Un nom de catégorie tient en ${LONGUEUR_NOM} caractères.`);
  if (Object.values(POTS).some((p) => cle(p.nom) === cle(propre))) throw new ErreurValidation(`« ${propre} » est déjà un pot.`);
  if (plan.etiquettes?.some((e) => e.id !== sauf && cle(e.nom) === cle(propre))) throw new ErreurValidation(`« ${propre} » existe déjà.`);
  return propre.charAt(0).toUpperCase() + propre.slice(1);
}

/** Une nouvelle catégorie dans le plan ; la rend avec le plan. */
export function ajouterEtiquette(plan: PlanBudget, nom: string, pot: Pot, ctx: Contexte): { plan: PlanBudget; etiquette: Etiquette } {
  const etiquette: Etiquette = { id: ctx.nouvelId(), nom: nomPropre(plan, nom), pot };
  return { plan: { ...plan, etiquettes: [...(plan.etiquettes ?? []), etiquette], majLe: ctx.maintenant() }, etiquette };
}

/** Renommer une catégorie ou changer son pot. */
export function modifierEtiquette(plan: PlanBudget, id: Id, champs: { nom?: string; pot?: Pot }, ctx: Contexte): PlanBudget {
  const actuelle = etiquetteDe(plan, id);
  if (!actuelle) return plan;
  const nom = champs.nom === undefined ? actuelle.nom : nomPropre(plan, champs.nom, id);
  return { ...plan, etiquettes: (plan.etiquettes ?? []).map((e) => (e.id === id ? { ...e, nom, pot: champs.pot ?? e.pot } : e)), majLe: ctx.maintenant() };
}

/** Retirer une catégorie : les dépenses déjà classées gardent leur nom et leur pot. */
export function supprimerEtiquette(plan: PlanBudget, id: Id, ctx: Contexte): PlanBudget {
  if (!etiquetteDe(plan, id)) return plan;
  return { ...plan, etiquettes: (plan.etiquettes ?? []).filter((e) => e.id !== id), majLe: ctx.maintenant() };
}

/** Ce qu'on a choisi la dernière fois pour ce commerçant, si la catégorie existe encore. */
export function etiquetteProposee(plan: PlanBudget, docs: readonly DocBudget[], marchand: string | null): Etiquette | null {
  if (!marchand || !plan.etiquettes?.length) return null;
  const nom = cle(marchand);
  const derniere = depenses(docs).find((d) => d.etiquette && d.magasin && cle(d.magasin) === nom);
  return etiquetteDe(plan, derniere?.etiquette) ?? null;
}

/** Combien de dépenses portent chaque catégorie, pour la page des réglages. */
export function usageDesEtiquettes(plan: PlanBudget, docs: readonly DocBudget[]): Record<Id, number> {
  const usage: Record<Id, number> = {};
  for (const e of plan.etiquettes ?? []) usage[e.id] = 0;
  for (const d of depenses(docs)) if (d.etiquette && d.etiquette in usage) usage[d.etiquette]++;
  return usage;
}
