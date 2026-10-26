import { debutMoisBudget, depenses, finMoisBudget, formaterMontant, moisBudget, POTS, type DocBudget, type Etiquette, type PlanBudget, type Pot } from "./budget";
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

/** Renommer une catégorie, changer son pot ou son plafond du mois (null : sans plafond). */
export function modifierEtiquette(plan: PlanBudget, id: Id, champs: { nom?: string; pot?: Pot; plafond?: number | null }, ctx: Contexte): PlanBudget {
  const actuelle = etiquetteDe(plan, id);
  if (!actuelle) return plan;
  const nom = champs.nom === undefined ? actuelle.nom : nomPropre(plan, champs.nom, id);
  if (champs.plafond != null && (!Number.isFinite(champs.plafond) || champs.plafond < 0)) throw new ErreurValidation("Le plafond est un montant en francs.");
  const plafond = champs.plafond === undefined ? actuelle.plafond : champs.plafond ? Math.round(champs.plafond) : null;
  return {
    ...plan,
    etiquettes: (plan.etiquettes ?? []).map((e) => (e.id === id ? { ...e, nom, pot: champs.pot ?? e.pot, ...(plafond ? { plafond } : { plafond: null }) } : e)),
    majLe: ctx.maintenant(),
  };
}

// ----- Plafond par catégorie (Kora 0.0.85) -----
// « Resto : 80 francs par mois. » Kora compte ce que la catégorie a dépensé depuis la paie et le dit
// doucement à 80 %, sans rouge ni blocage : c'est un repère que le foyer s'est donné.

/** À partir de cette part du plafond, Kora le dit. */
export const SEUIL_PLAFOND = 0.8;

export interface EtatPlafond {
  etiquette: Etiquette;
  depense: number;
  plafond: number;
  /** La part du plafond déjà dépensée (1 = tout). */
  part: number;
}

/** Les catégories qui ont un plafond, avec ce qu'elles ont dépensé ce mois de budget ; la plus avancée d'abord. */
export function etatDesPlafonds(plan: PlanBudget, docs: readonly DocBudget[], jour: string): EtatPlafond[] {
  const avec = (plan.etiquettes ?? []).filter((e) => (e.plafond ?? 0) > 0);
  if (!avec.length) return [];
  const mois = moisBudget(plan, jour);
  const debut = debutMoisBudget(plan, mois);
  const fin = finMoisBudget(plan, mois);
  const du = depenses(docs).filter((d) => d.etiquette && d.jour >= debut && d.jour <= fin);
  return avec
    .map((e) => {
      const depense = Math.round(du.filter((d) => d.etiquette === e.id).reduce((t, d) => t + d.montant, 0) * 100) / 100;
      return { etiquette: e, depense, plafond: e.plafond!, part: depense / e.plafond! };
    })
    .sort((a, b) => b.part - a.part);
}

/** Les plafonds à dire : 80 % et plus. */
export const plafondsAAlerter = (etats: readonly EtatPlafond[]) => etats.filter((e) => e.part >= SEUIL_PLAFOND);

/** « Resto : 85 % du mois, 68 sur 80 CHF » ou « Resto : plafond dépassé, 92 sur 80 CHF ». */
export function phrasePlafond(e: EtatPlafond): string {
  const chiffres = `${formaterMontant(e.depense, false)} sur ${formaterMontant(e.plafond)}`;
  return e.part >= 1 ? `${e.etiquette.nom} : plafond dépassé, ${chiffres}` : `${e.etiquette.nom} : ${Math.floor(e.part * 100)} % du mois, ${chiffres}`;
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
