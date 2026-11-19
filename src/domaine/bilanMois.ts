// Le bilan du mois en une page (Kora 0.1.23, idée validée par Melo le 20 novembre 2026) : à
// chaque paie, ce que le foyer a dépensé, mangé et fait à deux pendant le mois de budget qui
// vient de finir, en quelques chiffres et une phrase par chapitre. Sans score : les tâches sont
// comptées pour le foyer, pas par personne. Ce qui est « à moi » (pot perso) n'y est pas.

import { bilanDuMois, debutMoisBudget, depenses, finMoisBudget, formaterMontant, moisBudget, moisDocs, moisPrecedent, nommerMois, type DocBudget, type PlanBudget } from "./budget";
import { repasDe } from "./repas";
import type { Jour, Tache } from "./types";

export interface PotDuBilan {
  nom: string;
  depense: number;
  budget: number;
}

export interface BilanDuMoisFoyer {
  mois: string;
  /** Le nom du mois, « octobre ». */
  nom: string;
  debut: Jour;
  fin: Jour;
  /** Le mois n'est pas fini : le bilan dit « jusqu'ici ». */
  enCours: boolean;
  /** Ce que le foyer a dépensé au quotidien (courses et plaisir), sans les factures. */
  quotidien: number;
  nombreDepenses: number;
  pots: PotDuBilan[];
  /** Ce qui a été mis de côté ce mois ; null quand le mois n'a pas été noté. */
  epargne: number | null;
  jourLePlusCher: { jour: Jour; total: number } | null;
  magasin: { nom: string; total: number; fois: number } | null;
  repas: { notes: number; lePlusMange: { titre: string; fois: number } | null };
  tachesFaites: number;
}

const auCentime = (n: number) => Math.round(n * 100) / 100;

/** Le plus fréquent d'une liste de noms (le premier en cas d'égalité) ; null si aucun ne revient deux fois. */
function lePlusFrequent(noms: readonly string[]): { titre: string; fois: number } | null {
  const compte = new Map<string, { titre: string; fois: number }>();
  for (const n of noms) {
    const cle = n.trim().toLowerCase();
    const c = compte.get(cle) ?? { titre: n.trim(), fois: 0 };
    compte.set(cle, { ...c, fois: c.fois + 1 });
  }
  const premier = [...compte.values()].sort((a, b) => b.fois - a.fois)[0];
  return premier && premier.fois >= 2 ? premier : null;
}

/** Le bilan d'un mois de budget donné. `aujourdhui` borne un mois en cours. */
export function bilanDe(plan: PlanBudget, docs: readonly DocBudget[], menus: readonly unknown[], taches: readonly Tache[], mois: string, aujourdhui: Jour): BilanDuMoisFoyer {
  const debut = debutMoisBudget(plan, mois);
  const finDuMois = finMoisBudget(plan, mois);
  const enCours = finDuMois >= aujourdhui;
  const fin = enCours ? aujourdhui : finDuMois;
  const dedans = (jour: Jour) => jour >= debut && jour <= fin;
  const duMois = depenses(docs).filter((d) => dedans(d.jour) && !d.posteId && (d.pot === "courses" || d.pot === "plaisir"));
  const versements = bilanDuMois(plan).versements;
  const somme = (pot: "courses" | "plaisir") => auCentime(duMois.filter((d) => d.pot === pot).reduce((t, d) => t + d.montant, 0));

  const parJour = new Map<Jour, number>();
  for (const d of duMois) parJour.set(d.jour, (parJour.get(d.jour) ?? 0) + d.montant);
  const cher = [...parJour.entries()].sort((a, b) => b[1] - a[1])[0];

  const parMagasin = new Map<string, { total: number; fois: number }>();
  for (const d of duMois) {
    if (!d.magasin) continue;
    const m = parMagasin.get(d.magasin) ?? { total: 0, fois: 0 };
    parMagasin.set(d.magasin, { total: m.total + d.montant, fois: m.fois + 1 });
  }
  const magasin = [...parMagasin.entries()].sort((a, b) => b[1].total - a[1].total)[0];

  const repas = repasDe(menus).filter((r) => dedans(r.jour)).sort((a, b) => a.jour.localeCompare(b.jour));
  const note = moisDocs(docs).find((m) => m.mois === mois);

  return {
    mois,
    nom: nommerMois(mois, aujourdhui),
    debut,
    fin,
    enCours,
    quotidien: auCentime(duMois.reduce((t, d) => t + d.montant, 0)),
    nombreDepenses: duMois.length,
    pots: [
      { nom: "Courses", depense: somme("courses"), budget: versements.courses ?? 0 },
      { nom: "Plaisir", depense: somme("plaisir"), budget: versements.plaisir ?? 0 },
    ],
    epargne: note ? (note.versements.epargne ?? 0) : null,
    jourLePlusCher: cher ? { jour: cher[0], total: auCentime(cher[1]) } : null,
    magasin: magasin ? { nom: magasin[0], total: auCentime(magasin[1].total), fois: magasin[1].fois } : null,
    repas: { notes: repas.length, lePlusMange: lePlusFrequent(repas.map((r) => r.titre)) },
    tachesFaites: taches.reduce((t, x) => t + (x.historique ?? []).filter((f) => dedans(f.le)).length, 0),
  };
}

/** Le bilan a quelque chose à dire. */
export const bilanParle = (b: BilanDuMoisFoyer): boolean => b.nombreDepenses > 0 || b.repas.notes > 0 || b.tachesFaites > 0;

/**
 * Le bilan à montrer : celui du dernier mois fini s'il a quelque chose à dire, sinon celui du
 * mois en cours « jusqu'ici » ; null quand il n'y a encore rien à raconter.
 */
export function bilanAMontrer(plan: PlanBudget, docs: readonly DocBudget[], menus: readonly unknown[], taches: readonly Tache[], aujourdhui: Jour): BilanDuMoisFoyer | null {
  const ceMois = moisBudget(plan, aujourdhui);
  const fini = bilanDe(plan, docs, menus, taches, moisPrecedent(ceMois), aujourdhui);
  if (bilanParle(fini)) return fini;
  const enCours = bilanDe(plan, docs, menus, taches, ceMois, aujourdhui);
  return bilanParle(enCours) ? enCours : null;
}

/** La phrase d'un pot : « Courses : 812 CHF sur 900, 88 de moins que prévu. » */
export function phrasePot(p: PotDuBilan): string {
  if (p.budget <= 0) return `${p.nom} : ${formaterMontant(p.depense)}.`;
  const ecart = Math.round(p.depense - p.budget);
  const suite = ecart > 0 ? `${formaterMontant(ecart)} de plus que prévu` : ecart < 0 ? `${formaterMontant(-ecart)} de moins que prévu` : "pile le budget";
  return `${p.nom} : ${formaterMontant(p.depense)} sur ${formaterMontant(p.budget)}, ${suite}.`;
}

/** « de novembre », « d'octobre ». */
export const duMois = (nom: string): string => (/^[aeiouyéèhAEIOUYÉÈ]/.test(nom) ? `d'${nom}` : `de ${nom}`);

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Le bilan en texte, pour l'envoyer à l'autre par la feuille de partage. `dire` écrit un jour en clair. */
export function texteBilan(b: BilanDuMoisFoyer, dire: (jour: Jour) => string): string {
  const lignes = [`Notre mois ${duMois(b.nom)}${b.enCours ? ", jusqu'ici" : ""}`, ""];
  if (b.nombreDepenses) {
    lignes.push(`Au quotidien : ${formaterMontant(b.quotidien)} en ${pluriel(b.nombreDepenses, "dépense")}.`);
    for (const p of b.pots) if (p.depense > 0 || p.budget > 0) lignes.push(phrasePot(p));
    if (b.jourLePlusCher) lignes.push(`Le jour le plus cher : ${dire(b.jourLePlusCher.jour)}, ${formaterMontant(b.jourLePlusCher.total)}.`);
    if (b.magasin) lignes.push(`Le magasin du mois : ${b.magasin.nom}, ${pluriel(b.magasin.fois, "passage")}, ${formaterMontant(b.magasin.total)}.`);
  }
  if (b.epargne !== null && b.epargne > 0) lignes.push(`Mis de côté : ${formaterMontant(b.epargne)}.`);
  if (b.repas.notes) lignes.push(`À table : ${pluriel(b.repas.notes, "soir")} noté${b.repas.notes > 1 ? "s" : ""}${b.repas.lePlusMange ? `, ${b.repas.lePlusMange.titre} ${b.repas.lePlusMange.fois} fois` : ""}.`);
  if (b.tachesFaites) lignes.push(`À deux : ${pluriel(b.tachesFaites, "tâche")} faite${b.tachesFaites > 1 ? "s" : ""}.`);
  return lignes.join("\n");
}
