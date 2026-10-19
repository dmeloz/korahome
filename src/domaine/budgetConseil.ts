import {
  abonnementsALAnnee,
  auCentime,
  avanceeProjet,
  bilanDuMois,
  coursesParMagasin,
  decrireBudget,
  depenses,
  etatDesPots,
  formaterMontant,
  jourDuMois,
  moisAConfirmer,
  moisDe,
  moisDocs,
  previsionFactures,
  prixQuiMontent,
  POTS,
  POTS_SUIVIS,
  type DocBudget,
  type PlanBudget,
  type Pot,
} from "./budget";
import { OUTIL_BUDGET } from "./jarvisModele";
import { decaler } from "./taches";
import type { Id, Jour } from "./types";

// Le Budget qui conseille (Kora 0.0.37) : la clôture du mois, les tableaux des mois passés, la fin
// du mois à ce rythme, et ce que le conseiller (Jarvis, mode « budget ») reçoit et renvoie.

const moisPrecedent = (mois: string) => decaler(`${mois}-01`, { unite: "mois", tous: -1 }).slice(0, 7);

// ----- La clôture du mois -----

export interface PotDuMois {
  /** Versé dans le pot ce mois-là (0 si le mois n'a pas été confirmé). */
  verse: number;
  depense: number;
  /** Le solde à la fin du mois : ce qui passe au mois suivant. */
  solde: number;
}

export interface BilanDeMois {
  mois: string;
  pots: Record<Pot, PotDuMois>;
  /** Tout ce qui est sorti des pots ce mois-là. */
  depense: number;
  /** Les versements du mois ont été notés. */
  confirme: boolean;
}

/** Un mois tel qu'il s'est passé : pot par pot, versé, dépensé et reporté. */
export function bilanDeMois(plan: PlanBudget, docs: readonly DocBudget[], mois: string): BilanDeMois {
  const etat = etatDesPots(plan, docs, jourDuMois(mois, 31));
  const doc = moisDocs(docs).find((m) => m.mois === mois);
  const pots = {} as Record<Pot, PotDuMois>;
  for (const pot of Object.keys(POTS) as Pot[]) {
    pots[pot] = { verse: auCentime(doc?.versements[pot] ?? 0), depense: etat[pot].depenseDuMois, solde: etat[pot].solde };
  }
  return { mois, pots, depense: auCentime(POTS_SUIVIS.reduce((t, pot) => t + pots[pot].depense, 0)), confirme: !!doc };
}

/**
 * La clôture : quand le nouveau mois attend ses versements, le mois qui vient de finir se résume
 * (pot par pot) et un seul geste ouvre le suivant. Null quand il n'y a rien à confirmer.
 */
export function moisACloturer(plan: PlanBudget, docs: readonly DocBudget[], aujourdhui: Jour): { nouveau: string; precedent: BilanDeMois | null } | null {
  const nouveau = moisAConfirmer(plan, docs, aujourdhui);
  if (!nouveau) return null;
  const precedent = moisPrecedent(nouveau);
  return { nouveau, precedent: precedent >= plan.depart.mois ? bilanDeMois(plan, docs, precedent) : null };
}

/** Les `combien` derniers mois depuis le départ du budget (le mois en cours compris), du plus ancien au plus récent. */
export function tableauDesMois(plan: PlanBudget, docs: readonly DocBudget[], aujourdhui: Jour, combien = 6): BilanDeMois[] {
  const resultat: BilanDeMois[] = [];
  for (let mois = moisDe(aujourdhui), i = 0; i < combien && mois >= plan.depart.mois; i++, mois = moisPrecedent(mois)) {
    resultat.unshift(bilanDeMois(plan, docs, mois));
  }
  return resultat;
}

// ----- La fin du mois -----

export interface FinDeMoisPot {
  pot: Pot;
  solde: number;
  budget: number;
  depense: number;
  /** La dépense à la fin du mois à ce rythme ; null les quatre premiers jours (trop tôt pour le dire). */
  projection: number | null;
  /** Le solde à la fin du mois si tout se passe comme prévu. */
  soldeFin: number;
}

/**
 * Où chaque pot finira le mois : les courses et le plaisir au rythme des dépenses du mois,
 * les factures avec celles qui restent à payer, l'épargne avec son versement s'il n'est pas noté.
 */
export function finDuMois(plan: PlanBudget, docs: readonly DocBudget[], aujourdhui: Jour): FinDeMoisPot[] {
  const pots = etatDesPots(plan, docs, aujourdhui);
  const jour = Number(aujourdhui.slice(8, 10));
  const jours = Number(jourDuMois(moisDe(aujourdhui), 31).slice(8, 10));
  const confirme = moisDocs(docs).some((m) => m.mois === moisDe(aujourdhui));
  const versementAVenir = (pot: Pot) => (confirme ? 0 : bilanDuMois(plan).versements[pot]);
  return POTS_SUIVIS.map((pot) => {
    const e = pots[pot];
    if (pot === "courses" || pot === "plaisir") {
      const projection = jour >= 5 ? auCentime((e.depenseDuMois / jour) * jours) : null;
      const encore = projection === null ? Math.max(0, e.budgetDuMois - e.depenseDuMois) : projection - e.depenseDuMois;
      return { pot, solde: e.solde, budget: e.budgetDuMois, depense: e.depenseDuMois, projection, soldeFin: auCentime(e.solde + versementAVenir(pot) - encore) };
    }
    if (pot === "factures") {
      const soldeFin = previsionFactures(plan, docs, aujourdhui, 1)[0]?.solde ?? e.solde;
      return { pot, solde: e.solde, budget: e.budgetDuMois, depense: e.depenseDuMois, projection: null, soldeFin };
    }
    return { pot, solde: e.solde, budget: e.budgetDuMois, depense: e.depenseDuMois, projection: null, soldeFin: auCentime(e.solde + versementAVenir(pot)) };
  });
}

/** Le détail à côté du solde de fin de mois : « À ce rythme, 491 CHF dépensés sur 400 CHF ». */
export function phraseFinDuMois(f: FinDeMoisPot): string {
  if (f.pot === "factures") return "Après les factures du mois";
  if (f.pot === "epargne") return f.soldeFin > f.solde ? `Avec le versement de ${formaterMontant(f.soldeFin - f.solde)}` : "Versement du mois noté";
  if (f.projection === null) return `${formaterMontant(f.depense)} dépensés sur ${formaterMontant(f.budget)}, trop tôt pour projeter`;
  return `À ce rythme, ${formaterMontant(f.projection)} dépensés sur ${formaterMontant(f.budget)}`;
}

// ----- Le conseiller -----

/** Ce que le conseiller reçoit : le budget résumé, les projections, les mois passés et les dépenses détaillées. */
export function decrireBudgetConseiller(docs: readonly DocBudget[], prenoms: (id: Id) => string, aujourdhui: Jour, max = 36000): string {
  const plan = docs.find((d) => d.genre === "plan") as PlanBudget | undefined;
  if (!plan) return "Le budget n'est pas encore en place.";
  const chf = (n: number) => formaterMontant(n, false);
  const nom = (pot: Pot) => plan.comptes[pot] || POTS[pot].nom;
  const lignes = [`Aujourd'hui : ${aujourdhui}. Budget suivi depuis ${plan.depart.mois}.`, ...decrireBudget(docs, prenoms, aujourdhui)];
  const bilan = bilanDuMois(plan);
  lignes.push(
    `Salaires : ${bilan.personnes.map((b) => `${prenoms(b.membreId)} ${chf(b.revenu)} (charges perso ${chf(b.charges)}, verse ${chf(b.versement)} au commun, reste ${chf(b.reste)})`).join(" ; ")}.`,
    `Versements prévus chaque mois : ${POTS_SUIVIS.map((pot) => `${nom(pot)} ${chf(bilan.versements[pot])}`).join(", ")}.`,
  );
  lignes.push(
    "Fin du mois prévue (calcul de l'app) :",
    ...finDuMois(plan, docs, aujourdhui).map((f) => `- ${nom(f.pot)} : solde ${chf(f.solde)}, dépensé ce mois ${chf(f.depense)} sur ${chf(f.budget)}${f.projection !== null ? `, dépense prévue à ce rythme ${chf(f.projection)}` : ""}, solde à la fin du mois ${chf(f.soldeFin)}.`),
  );
  const annee = previsionFactures(plan, docs, aujourdhui);
  lignes.push(
    "Pot factures, douze mois à venir (sorties, factures de l'année, solde à la fin du mois) :",
    ...annee.map((m) => `- ${m.mois} : ${chf(m.sorties)}${m.annuelles.length ? ` dont ${m.annuelles.map((a) => `${a.libelle} ${chf(a.montant)}`).join(", ")}` : ""} ; solde ${chf(m.solde)}`),
  );
  const mois = tableauDesMois(plan, docs, aujourdhui, 12);
  if (mois.length) {
    lignes.push(
      "Mois passés (dépensé par pot ; versé ; solde de fin) :",
      ...mois.map((m) => `- ${m.mois}${m.mois === moisDe(aujourdhui) ? " (en cours)" : ""} : ${POTS_SUIVIS.map((pot) => `${nom(pot)} ${chf(m.pots[pot].depense)} (versé ${chf(m.pots[pot].verse)}, fin ${chf(m.pots[pot].solde)})`).join(", ")}`),
    );
  }
  const magasins = coursesParMagasin(docs, aujourdhui);
  if (magasins.length) lignes.push(`Courses par magasin, six derniers mois : ${magasins.map((m) => `${m.magasin} ${chf(m.total)}`).join(", ")}.`);
  const abonnements = abonnementsALAnnee(plan);
  if (abonnements.length) lignes.push(`Abonnements à l'année : ${abonnements.map((a) => `${a.poste.libelle} ${chf(a.parAn)}`).join(", ")}.`);
  const hausses = prixQuiMontent(docs, aujourdhui).slice(0, 10);
  if (hausses.length) lignes.push(`Prix qui montent : ${hausses.map((h) => `${h.nom} ${chf(h.avant.prix)} → ${chf(h.maintenant.prix)}`).join(", ")}.`);
  const projet = avanceeProjet(plan, docs, aujourdhui);
  if (projet) lignes.push(`Projet : ${projet.projet.nom}, ${chf(projet.epargne)} sur ${chf(projet.projet.objectif)}${projet.projet.date ? `, pour ${projet.projet.date} (${chf(projet.parMoisPourLaDate ?? 0)} par mois)` : ""}${projet.atteintVers ? `, atteint vers ${projet.atteintVers} au rythme prévu` : ""}.`);

  // Les dépenses détaillées des trois derniers mois, tant qu'il reste de la place.
  const depuis = `${moisPrecedent(moisPrecedent(moisDe(aujourdhui)))}-01`;
  const detail = depenses(docs).filter((d) => d.jour >= depuis && d.jour <= aujourdhui);
  let texte = lignes.join("\n");
  if (detail.length) {
    texte += "\nDépenses détaillées, des plus récentes aux plus anciennes (jour ; montant ; pot ; libellé ; magasin ; source) :";
    for (const d of detail) {
      const ligne = `\n${d.jour} ; ${chf(d.montant)} ; ${nom(d.pot)} ; ${d.libelle}${d.magasin && d.magasin !== d.libelle ? ` ; ${d.magasin}` : ""} ; ${d.source}${d.articles?.length ? ` ; ${d.articles.length} articles` : ""}`;
      if (texte.length + ligne.length > max) {
        texte += "\n(dépenses plus anciennes non incluses)";
        break;
      }
      texte += ligne;
    }
  }
  return texte;
}

export interface ConseilBudget {
  titre: string;
  detail: string;
  gainParMois: number | null;
}

export interface TableauBudget {
  titre: string;
  colonnes: string[];
  lignes: string[][];
}

export interface ReponseConseiller {
  texte: string;
  tableau: TableauBudget | null;
  conseils: ConseilBudget[];
}

const chaine = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Relit la réponse du conseiller (l'outil repondre_budget) ; ce qui est mal formé est laissé de côté. */
export function lireConseiller(appels: readonly { nom: string; entree: unknown }[], texteLibre = ""): ReponseConseiller {
  const entree = (appels.find((a) => a.nom === OUTIL_BUDGET.name)?.entree ?? {}) as Record<string, unknown>;
  const texte = chaine(entree.texte, 1200) || chaine(texteLibre, 1200);
  let tableau: TableauBudget | null = null;
  const t = entree.tableau as Record<string, unknown> | undefined;
  if (t && Array.isArray(t.colonnes) && Array.isArray(t.lignes)) {
    const colonnes = t.colonnes.slice(0, 6).map((c) => chaine(c, 40));
    const lignes = t.lignes
      .filter((l): l is unknown[] => Array.isArray(l))
      .slice(0, 20)
      .map((l) => colonnes.map((_, i) => chaine(l[i] === undefined ? "" : String(l[i]), 60)));
    if (colonnes.length >= 2 && lignes.length) tableau = { titre: chaine(t.titre, 80), colonnes, lignes };
  }
  const conseils = (Array.isArray(entree.conseils) ? entree.conseils : [])
    .map((c) => c as Record<string, unknown>)
    .map((c) => ({ titre: chaine(c.titre, 80), detail: chaine(c.detail, 400), gainParMois: typeof c.gain_par_mois === "number" && c.gain_par_mois > 0 ? auCentime(c.gain_par_mois) : null }))
    .filter((c) => c.titre && c.detail)
    .slice(0, 4);
  return { texte: texte || "Je n'ai pas su répondre, reformule ta question.", tableau, conseils };
}

/** Les questions proposées sous le conseiller. */
export const QUESTIONS_CONSEILLER = ["Fais le point sur notre budget", "Où peut-on économiser ?", "Nos courses par magasin", "Quels mois seront serrés ?"] as const;
