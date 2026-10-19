import { decaler, ecartJours } from "./taches";
import type { Contexte, Id, Jour } from "./types";

// Le budget du foyer, repris de l'Excel de Melo et Sarah : deux salaires, chacun ses
// charges et sa part versée au compte commun ; le commun paie le loyer, les courses
// (une carte dédiée) et met de côté pour les factures ; ce qui reste se partage entre
// le plaisir (30 %) et l'épargne (70 %). Kora fait les calculs, tient le solde de chaque
// pot d'un mois à l'autre (ce qui reste est reporté), rappelle les factures et compte
// les tickets de caisse. Aucun identifiant bancaire : un compte n'est qu'un nom.

/** Les pots du compte commun. « commun » : payé directement par le compte commun (le loyer). */
export type Pot = "commun" | "courses" | "factures" | "plaisir" | "epargne";

export const POTS: Record<Pot, { nom: string; description: string }> = {
  commun: { nom: "Compte commun", description: "Ce qui part directement du compte commun, comme le loyer." },
  courses: { nom: "Courses", description: "La carte des courses : le budget du mois y est versé, ce qui reste est reporté." },
  factures: { nom: "Factures", description: "Mis de côté chaque mois pour les factures, y compris les grosses factures de l'année." },
  plaisir: { nom: "Plaisir", description: "La part du reste du mois pour se faire plaisir." },
  epargne: { nom: "Épargne", description: "La réserve, et le projet pour lequel on économise." },
};

/** Les pots dont Kora tient le solde, dans l'ordre de la page. */
export const POTS_SUIVIS: readonly Pot[] = ["courses", "plaisir", "factures", "epargne"];

export type Frequence = "mois" | "an";

export type CategoriePoste = "logement" | "energie" | "abonnement" | "assurance" | "sante" | "vehicule" | "courses" | "animal" | "impots" | "loisirs" | "autre";

export const CATEGORIES_POSTE: Record<CategoriePoste, string> = {
  logement: "Logement",
  energie: "Énergie",
  abonnement: "Abonnement",
  assurance: "Assurance",
  sante: "Santé",
  vehicule: "Véhicule",
  courses: "Courses",
  animal: "Mitsu",
  impots: "Impôts",
  loisirs: "Loisirs",
  autre: "Autre",
};

/** Une charge : personnelle (qui) ou commune (qui null, payée par un pot). */
export interface Poste {
  id: Id;
  libelle: string;
  /** En francs, par mois ou par an selon la fréquence. */
  montant: number;
  frequence: Frequence;
  /** La personne qui la paie de son salaire ; null : le compte commun. */
  qui: Id | null;
  /** Pour une charge commune : le pot qui la paie. */
  pot: Pot | null;
  categorie: CategoriePoste;
  /** Le jour du mois où elle tombe (1 à 31) ; null si on ne le sait pas. */
  jour: number | null;
  /** Pour une charge de l'année : le mois où elle tombe (1 à 12) ; null si on ne le sait pas. */
  mois: number | null;
  /** Prélevée seule chaque mois (ordre permanent, LSV) : Kora la retire du pot sans qu'on la coche. */
  prelevement: boolean;
}

export interface Personne {
  membreId: Id;
  /** Le salaire du mois. */
  revenu: number;
  /** Ce qu'elle verse chaque mois au compte commun. */
  versement: number;
}

export interface ProjetEpargne {
  nom: string;
  objectif: number;
  /** La date visée ; null si on n'en a pas. */
  date: Jour | null;
}

/** Le plan du foyer : un seul document, que les deux téléphones partagent. */
export interface PlanBudget {
  id: "plan";
  genre: "plan";
  personnes: Personne[];
  postes: Poste[];
  /** La part du reste qui va au plaisir (0,3) ; le reste va à l'épargne. */
  partPlaisir: number;
  /** Le jour de paie, qui ouvre le mois ; null tant que personne ne l'a donné. */
  jourDePaie: number | null;
  /** Le nom du compte ou de la carte de chaque pot (« Carte courses »). Jamais de numéro ni d'identifiant. */
  comptes: Partial<Record<Pot, string>>;
  /** Le pot que paie chaque carte de Wallet (« aucun » : hors du budget), retenu au premier paiement Apple Pay. Le nom seul, sans chiffres. */
  cartes?: Record<string, Pot | "aucun">;
  /** Les soldes au début du mois où Kora commence à compter. */
  depart: { mois: string; soldes: Partial<Record<Pot, number>> };
  projet: ProjetEpargne | null;
  majLe: string;
}

/** Les versements d'un mois dans chaque pot, confirmés une fois faits. */
export interface MoisBudget {
  id: string;
  genre: "mois";
  /** « AAAA-MM ». */
  mois: string;
  versements: Partial<Record<Pot, number>>;
  confirmeLe: string;
  par: Id | null;
}

/** Une dépense : un ticket de caisse, une sortie, une facture payée. */
export interface Depense {
  id: Id;
  genre: "depense";
  jour: Jour;
  montant: number;
  pot: Pot;
  libelle: string;
  magasin: string | null;
  /** La charge que cette dépense paie, et l'échéance réglée. */
  posteId: Id | null;
  echeance: Jour | null;
  source: "main" | "ticket" | "jarvis" | "applepay" | "releve";
  /** La carte de Wallet qui a payé (son nom seul, sans chiffres), pour un paiement Apple Pay. */
  carte?: string;
  /** Les lignes d'un ticket de caisse, avec leur prix : Kora y voit les prix qui montent. */
  articles?: ArticleTicket[];
  par: Id | null;
  creeLe: string;
}

export interface ArticleTicket {
  nom: string;
  /** Le prix payé pour la ligne, en francs. */
  prix: number;
}

/** Un paiement Apple Pay qui attend son pot : carte encore inconnue, ou autre monnaie (voir paiements.ts). */
export interface PaiementAClasser {
  id: Id;
  genre: "paiement";
  jour: Jour;
  montant: number;
  /** « CHF », « EUR »… : le montant payé, dans cette monnaie. */
  devise: string;
  marchand: string | null;
  carte: string;
  par: Id | null;
  creeLe: string;
}

export type DocBudget = PlanBudget | MoisBudget | Depense | PaiementAClasser;

// ----- Les montants -----

/** Arrondi au centime. */
export const auCentime = (n: number) => Math.round(n * 100) / 100;

/** « 84.30 CHF », « 2’000 CHF », « −12.50 CHF » : comme sur un relevé suisse. */
export function formaterMontant(n: number, avecDevise = true): string {
  const c = Math.round(Math.abs(n) * 100);
  const entier = Math.floor(c / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  const centimes = c % 100;
  const texte = `${n < 0 && c > 0 ? "−" : ""}${entier}${centimes ? `.${String(centimes).padStart(2, "0")}` : ""}`;
  return avecDevise ? `${texte} CHF` : texte;
}

/** « 84.30 », « 84,3 », « 1'185 », « 2 000.- » → le nombre ; null si illisible. */
export function lireMontant(texte: string): number | null {
  const propre = texte.trim().replace(/\.-$/, "").replace(/[’' ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return null;
  return Number(propre);
}

// ----- Le plan -----

/** Ce qu'une charge coûte par mois : une charge de l'année est lissée sur douze mois. */
export const parMois = (p: Poste) => (p.frequence === "an" ? p.montant / 12 : p.montant);

export function planDe(docs: readonly DocBudget[]): PlanBudget | null {
  return (docs.find((d) => d.genre === "plan") as PlanBudget | undefined) ?? null;
}

export function moisDe(jour: Jour): string {
  return jour.slice(0, 7);
}

export function nouveauPlan(membres: readonly Id[], aujourdhui: Jour, ctx: Contexte): PlanBudget {
  return {
    id: "plan",
    genre: "plan",
    personnes: membres.map((membreId) => ({ membreId, revenu: 0, versement: 0 })),
    postes: [],
    partPlaisir: 0.3,
    jourDePaie: null,
    comptes: {},
    depart: { mois: moisDe(aujourdhui), soldes: {} },
    projet: null,
    majLe: ctx.maintenant(),
  };
}

export function nouveauPoste(champs: Partial<Omit<Poste, "id">> & { libelle: string; montant: number }, ctx: Contexte): Poste {
  const qui = champs.qui ?? null;
  return {
    id: ctx.nouvelId(),
    libelle: champs.libelle.trim(),
    montant: auCentime(champs.montant),
    frequence: champs.frequence ?? "mois",
    qui,
    pot: qui ? null : (champs.pot ?? "commun"),
    categorie: champs.categorie ?? devinerCategorie(champs.libelle),
    jour: champs.jour ?? null,
    mois: champs.mois ?? null,
    prelevement: champs.prelevement ?? false,
  };
}

const MOTS_CATEGORIES: [RegExp, CategoriePoste][] = [
  [/loyer|charges? (?:de l'|d')?appartement|hypoth/, "logement"],
  [/[eé]lectricit|romande energie|gaz|chauffage/, "energie"],
  [/netflix|spotify|disney|sunrise|swisscom|salt|internet|t[eé]l[eé]phone|abonnement|nespresso|serafe/, "abonnement"],
  [/maladie|visana|swica|css|helsana|assura\b|sant[eé]|m[eé]decin|dentiste/, "sante"],
  [/voiture|moto|essence|leasing|v[eé]hicule|parking|service|garage|vignette/, "vehicule"],
  [/assurance|rc |m[eé]nage/, "assurance"],
  [/courses|migros|coop|lidl|denner|aldi/, "courses"],
  [/chat|mitsu|zooplus|v[eé]to/, "animal"],
  [/imp[oô]t|taxe/, "impots"],
  [/sortie|restaurant|cin[eé]ma|vacances|cigarette/, "loisirs"],
];

export function devinerCategorie(libelle: string): CategoriePoste {
  const t = libelle.toLowerCase();
  // Une assurance de véhicule reste un véhicule ; une assurance maladie reste la santé.
  for (const [re, c] of MOTS_CATEGORIES) if (re.test(t)) return c;
  return "autre";
}

export function modifierPlan(plan: PlanBudget, changement: Partial<Omit<PlanBudget, "id" | "genre" | "majLe">>, ctx: Contexte): PlanBudget {
  return { ...plan, ...changement, majLe: ctx.maintenant() };
}

export function enregistrerPoste(plan: PlanBudget, poste: Poste, ctx: Contexte): PlanBudget {
  const propre: Poste = { ...poste, montant: auCentime(Math.max(0, poste.montant)), pot: poste.qui ? null : (poste.pot ?? "commun") };
  const existe = plan.postes.some((p) => p.id === poste.id);
  return modifierPlan(plan, { postes: existe ? plan.postes.map((p) => (p.id === poste.id ? propre : p)) : [...plan.postes, propre] }, ctx);
}

export function retirerPoste(plan: PlanBudget, id: Id, ctx: Contexte): PlanBudget {
  return modifierPlan(plan, { postes: plan.postes.filter((p) => p.id !== id) }, ctx);
}

// ----- Le mois, calculé -----

export interface BilanPersonne {
  membreId: Id;
  revenu: number;
  charges: number;
  versement: number;
  /** Ce qui reste du salaire, une fois les charges et le versement faits. */
  reste: number;
  /** Ce que serait le versement au prorata des salaires. */
  auProrata: number;
}

export interface BilanMois {
  personnes: BilanPersonne[];
  /** Ce qui entre sur le compte commun. */
  entreeCommun: number;
  chargesCommunes: number;
  /** Ce qui reste au commun une fois tout payé et mis de côté. */
  resteCommun: number;
  /** Ce que chaque pot reçoit chaque mois. */
  versements: Record<Pot, number>;
  /** Le total des charges de l'année, lissé : ce qu'on met de côté pour elles chaque mois. */
  provisionAnnuelle: number;
}

/** Tout ce que l'Excel calculait : restes, reste du commun, 30/70, pot factures. */
export function bilanDuMois(plan: PlanBudget): BilanMois {
  const communes = plan.postes.filter((p) => p.qui === null);
  const somme = (postes: readonly Poste[]) => postes.reduce((t, p) => t + parMois(p), 0);
  const entreeCommun = plan.personnes.reduce((t, p) => t + p.versement, 0);
  const chargesCommunes = somme(communes);
  const totalRevenus = plan.personnes.reduce((t, p) => t + p.revenu, 0);
  const resteCommun = entreeCommun - chargesCommunes;
  const libre = Math.max(0, resteCommun);
  const part = Math.min(1, Math.max(0, plan.partPlaisir));
  const duPot = (pot: Pot) => auCentime(somme(communes.filter((p) => p.pot === pot)));
  return {
    personnes: plan.personnes.map((p) => {
      const charges = somme(plan.postes.filter((x) => x.qui === p.membreId));
      return {
        membreId: p.membreId,
        revenu: p.revenu,
        charges: auCentime(charges),
        versement: p.versement,
        reste: auCentime(p.revenu - charges - p.versement),
        auProrata: totalRevenus > 0 ? auCentime((entreeCommun * p.revenu) / totalRevenus) : 0,
      };
    }),
    entreeCommun: auCentime(entreeCommun),
    chargesCommunes: auCentime(chargesCommunes),
    resteCommun: auCentime(resteCommun),
    versements: {
      commun: duPot("commun"),
      courses: duPot("courses"),
      factures: duPot("factures"),
      plaisir: auCentime(libre * part),
      epargne: auCentime(libre * (1 - part)),
    },
    provisionAnnuelle: auCentime(communes.filter((p) => p.frequence === "an").reduce((t, p) => t + p.montant / 12, 0)),
  };
}

// ----- Les mois versés et les soldes -----

export const moisDocs = (docs: readonly DocBudget[]) => docs.filter((d): d is MoisBudget => d.genre === "mois").sort((a, b) => a.mois.localeCompare(b.mois));
export const depenses = (docs: readonly DocBudget[]) => docs.filter((d): d is Depense => d.genre === "depense").sort((a, b) => b.jour.localeCompare(a.jour) || b.creeLe.localeCompare(a.creeLe));

/** Le premier jour de paie du mois (le dernier jour du mois si la paie tombe un 31 en février). */
function jourDuMois(mois: string, jour: number): Jour {
  const [a, m] = mois.split("-").map(Number);
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${mois}-${String(Math.min(Math.max(1, jour), dernier)).padStart(2, "0")}`;
}

const moisSuivant = (mois: string) => decaler(`${mois}-01`, { unite: "mois", tous: 1 }).slice(0, 7);

/** Le mois à confirmer : celui en cours, une fois le jour de paie passé, s'il n'est pas encore versé. */
export function moisAConfirmer(plan: PlanBudget, docs: readonly DocBudget[], aujourdhui: Jour): string | null {
  const mois = moisDe(aujourdhui);
  if (mois < plan.depart.mois) return null;
  if (moisDocs(docs).some((m) => m.mois === mois)) return null;
  if (plan.jourDePaie && aujourdhui < jourDuMois(mois, plan.jourDePaie)) return null;
  return mois;
}

export function confirmerMois(mois: string, versements: Partial<Record<Pot, number>>, par: Id | null, ctx: Contexte): MoisBudget {
  const propres: Partial<Record<Pot, number>> = {};
  for (const pot of POTS_SUIVIS) propres[pot] = auCentime(Math.max(0, versements[pot] ?? 0));
  return { id: `mois-${mois}`, genre: "mois", mois, versements: propres, confirmeLe: ctx.maintenant(), par };
}

/** Les prélèvements automatiques déjà passés depuis le départ : ils sortent seuls du pot. */
export function prelevementsPasses(plan: PlanBudget, aujourdhui: Jour): { poste: Poste; jour: Jour }[] {
  const resultat: { poste: Poste; jour: Jour }[] = [];
  const auto = plan.postes.filter((p) => p.qui === null && p.prelevement && p.frequence === "mois" && p.pot && p.pot !== "commun");
  for (let mois = plan.depart.mois; mois <= moisDe(aujourdhui); mois = moisSuivant(mois)) {
    for (const poste of auto) {
      const jour = jourDuMois(mois, poste.jour ?? 1);
      if (jour <= aujourdhui) resultat.push({ poste, jour });
    }
  }
  return resultat;
}

export interface EtatPot {
  pot: Pot;
  solde: number;
  /** Versé dans le pot ce mois-ci (ou prévu, si le mois n'est pas encore confirmé). */
  budgetDuMois: number;
  /** Sorti du pot ce mois-ci. */
  depenseDuMois: number;
}

/** Le solde de chaque pot : le départ, plus les mois versés, moins les dépenses et les prélèvements. */
export function etatDesPots(plan: PlanBudget, docs: readonly DocBudget[], aujourdhui: Jour): Record<Pot, EtatPot> {
  const debut = `${plan.depart.mois}-01`;
  const mois = moisDe(aujourdhui);
  const bilan = bilanDuMois(plan);
  const verses = moisDocs(docs).filter((m) => m.mois >= plan.depart.mois && m.mois <= mois);
  const sorties = depenses(docs).filter((d) => d.jour >= debut && d.jour <= aujourdhui);
  const auto = prelevementsPasses(plan, aujourdhui);
  const ceMois = verses.find((m) => m.mois === mois);
  const etat = {} as Record<Pot, EtatPot>;
  for (const pot of Object.keys(POTS) as Pot[]) {
    const entre = verses.reduce((t, m) => t + (m.versements[pot] ?? 0), 0);
    const sorti = sorties.filter((d) => d.pot === pot).reduce((t, d) => t + d.montant, 0) + auto.filter((a) => a.poste.pot === pot).reduce((t, a) => t + a.poste.montant, 0);
    const sortiCeMois =
      sorties.filter((d) => d.pot === pot && moisDe(d.jour) === mois).reduce((t, d) => t + d.montant, 0) +
      auto.filter((a) => a.poste.pot === pot && moisDe(a.jour) === mois).reduce((t, a) => t + a.poste.montant, 0);
    etat[pot] = {
      pot,
      solde: auCentime((plan.depart.soldes[pot] ?? 0) + entre - sorti),
      budgetDuMois: auCentime(ceMois ? (ceMois.versements[pot] ?? 0) : bilan.versements[pot]),
      depenseDuMois: auCentime(sortiCeMois),
    };
  }
  return etat;
}

/** Ce qui a vraiment été mis à l'épargne, mois par mois, face à ce qui était prévu. */
export function historiqueEpargne(plan: PlanBudget, docs: readonly DocBudget[]): { mois: string; verse: number; prevu: number }[] {
  const prevu = bilanDuMois(plan).versements.epargne;
  return moisDocs(docs).map((m) => ({ mois: m.mois, verse: m.versements.epargne ?? 0, prevu }));
}

// ----- Les factures -----

export interface Facture {
  poste: Poste;
  echeance: Jour;
  montant: number;
  payee: boolean;
  /** Payée seule (prélèvement) : rien à faire. */
  automatique: boolean;
}

/** Les échéances d'une charge commune entre deux jours (compris). */
function echeancesDe(poste: Poste, de: Jour, a: Jour): Jour[] {
  const jours: Jour[] = [];
  if (poste.frequence === "an") {
    if (!poste.mois) return jours;
    for (let annee = Number(de.slice(0, 4)); annee <= Number(a.slice(0, 4)); annee++) {
      const j = jourDuMois(`${annee}-${String(poste.mois).padStart(2, "0")}`, poste.jour ?? 1);
      if (j >= de && j <= a) jours.push(j);
    }
    return jours;
  }
  if (!poste.jour) return jours;
  for (let mois = moisDe(de); mois <= moisDe(a); mois = moisSuivant(mois)) {
    const j = jourDuMois(mois, poste.jour);
    if (j >= de && j <= a) jours.push(j);
  }
  return jours;
}

/** Une dépense règle une échéance quand elle la nomme, ou qu'elle paie la même charge dans le même mois (le même mois de l'année pour une charge annuelle, à un mois près). */
function regle(d: Depense, poste: Poste, echeance: Jour): boolean {
  if (d.posteId !== poste.id) return false;
  if (d.echeance) return d.echeance === echeance;
  const ecart = ecartJours(echeance, d.jour);
  return poste.frequence === "an" ? ecart >= -45 && ecart <= 45 : moisDe(d.jour) === moisDe(echeance);
}

/** Les factures communes dont on connaît la date, des 30 derniers jours aux `jours` prochains. */
export function factures(plan: PlanBudget, docs: readonly DocBudget[], aujourdhui: Jour, jours = 60): Facture[] {
  const de = decaler(aujourdhui, { unite: "jour", tous: -30 });
  const a = decaler(aujourdhui, { unite: "jour", tous: jours });
  const toutes = depenses(docs);
  const resultat: Facture[] = [];
  for (const poste of plan.postes.filter((p) => p.qui === null && p.pot !== "courses")) {
    for (const echeance of echeancesDe(poste, de, a)) {
      const automatique = poste.prelevement && poste.frequence === "mois";
      const payee = automatique ? echeance <= aujourdhui : toutes.some((d) => regle(d, poste, echeance));
      if (echeance < plan.depart.mois && !payee) continue;
      resultat.push({ poste, echeance, montant: poste.montant, payee, automatique });
    }
  }
  return resultat.sort((x, y) => x.echeance.localeCompare(y.echeance) || x.poste.libelle.localeCompare(y.poste.libelle, "fr"));
}

/** Ce qui reste à payer à la main : en retard d'abord, puis dans l'ordre. */
export function facturesAPayer(plan: PlanBudget, docs: readonly DocBudget[], aujourdhui: Jour, jours = 60): Facture[] {
  return factures(plan, docs, aujourdhui, jours).filter((f) => !f.payee && !f.automatique);
}

/** Les factures du jour pour la carte « Aujourd'hui » et le rappel du matin. */
export function facturesDuJour(docs: readonly DocBudget[], aujourdhui: Jour, jours = 3): { id: Id; libelle: string; echeance: Jour }[] {
  const plan = planDe(docs);
  if (!plan) return [];
  return facturesAPayer(plan, docs, aujourdhui, jours).map((f) => ({ id: `${f.poste.id}-${f.echeance}`, libelle: `${f.poste.libelle} (${formaterMontant(f.montant)})`, echeance: f.echeance }));
}

/** Les charges de l'année sans mois connu : Kora ne peut pas encore les rappeler. */
export const sansDate = (plan: PlanBudget) => plan.postes.filter((p) => p.qui === null && p.frequence === "an" && !p.mois);

// ----- Les dépenses -----

export function nouvelleDepense(
  champs: {
    montant: number;
    pot: Pot;
    libelle: string;
    jour: Jour;
    magasin?: string | null;
    posteId?: Id | null;
    echeance?: Jour | null;
    source?: Depense["source"];
    articles?: readonly ArticleTicket[];
  },
  par: Id | null,
  ctx: Contexte,
): Depense {
  return {
    id: ctx.nouvelId(),
    genre: "depense",
    jour: champs.jour,
    montant: auCentime(champs.montant),
    pot: champs.pot,
    libelle: champs.libelle.trim() || POTS[champs.pot].nom,
    magasin: champs.magasin?.trim() || null,
    posteId: champs.posteId ?? null,
    echeance: champs.echeance ?? null,
    source: champs.source ?? "main",
    ...(champs.articles?.length ? { articles: champs.articles.filter((a) => a.nom.trim() && a.prix > 0).map((a) => ({ nom: a.nom.trim(), prix: auCentime(a.prix) })) } : {}),
    par,
    creeLe: ctx.maintenant(),
  };
}

/** Payer une facture : une dépense du pot de la charge, liée à son échéance. */
export function payerFacture(f: Facture, jour: Jour, par: Id | null, ctx: Contexte, source: Depense["source"] = "main"): Depense {
  return nouvelleDepense({ montant: f.montant, pot: f.poste.pot ?? "factures", libelle: f.poste.libelle, jour, posteId: f.poste.id, echeance: f.echeance, source }, par, ctx);
}

const MAGASINS = ["Migros", "Coop", "Lidl", "Denner", "Aldi", "Manor", "Volg", "Spar", "Aligro", "Prodega"];
const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface SaisieDepense {
  montant: number;
  pot: Pot;
  libelle: string;
  magasin: string | null;
  /** La charge nommée dans la phrase (« Sunrise 145 ») : la dépense la paie. */
  posteId: Id | null;
}

/**
 * Une dépense écrite dans la barre du Budget : « Migros 84.30 », « 32 cinéma plaisir »,
 * « Sunrise 145 », « 200 épargne ». null quand la phrase n'a pas de montant.
 */
export function lireDepense(texte: string, plan: PlanBudget | null): SaisieDepense | null {
  const m = /(?:^|\s)(\d[\d’' ]*(?:[.,]\d{1,2})?)(?:\.-)?\s*(?:chf|fr\.?|francs?)?(?=\s|$)/i.exec(` ${texte.trim()} `);
  if (!m) return null;
  const montant = lireMontant(m[1]);
  if (montant === null || montant <= 0) return null;
  let reste = ` ${texte} `.replace(m[0], " ").replace(/\b(?:chf|fr\.?|francs?)\b/gi, " ");
  const cle = sansAccents(reste);
  let pot: Pot | null = null;
  const retirerMot = (re: RegExp) => (reste = reste.replace(re, " "));
  if (/\b(plaisir|sortie|resto|restaurant|cinema)\b/.test(cle)) pot = "plaisir";
  if (/\bepargne\b|\breserve\b/.test(cle)) pot = "epargne";
  if (/\bcourses\b/.test(cle)) pot = "courses";
  if (/\bfactures?\b/.test(cle)) pot = "factures";
  retirerMot(/\b(?:sur |dans |pour |au |à |a |en |le |la |les )?(?:pot |compte |carte )?(?:plaisir|[ée]pargne|r[ée]serve|courses|factures?)\b/gi);
  retirerMot(/^\s*(?:j'ai |on a )?(?:pay[ée]e?s?|d[ée]pens[ée]|achet[ée])\s+/i);
  const magasin = MAGASINS.find((x) => new RegExp(`\\b${sansAccents(x)}\\b`).test(cle)) ?? null;
  const libelle = reste.replace(/\s+/g, " ").replace(/^(?:de |du |chez |à |a )/i, "").trim();
  const poste = plan && libelle ? plan.postes.find((p) => p.qui === null && sansAccents(p.libelle).includes(sansAccents(libelle.split(" ")[0]))) : undefined;
  if (poste && !pot) pot = poste.pot === "commun" || !poste.pot ? "factures" : poste.pot;
  if (!pot) pot = magasin ? "courses" : "plaisir";
  const nom = libelle ? libelle.charAt(0).toUpperCase() + libelle.slice(1) : magasin ?? POTS[pot].nom;
  return { montant, pot, libelle: poste?.libelle ?? nom, magasin, posteId: poste?.id ?? null };
}

// ----- Le projet d'épargne -----

export interface AvanceeProjet {
  projet: ProjetEpargne;
  epargne: number;
  /** De 0 à 1. */
  part: number;
  manque: number;
  /** Ce qu'il faut mettre de côté chaque mois pour arriver à la date ; null sans date. */
  parMoisPourLaDate: number | null;
  /** Au rythme prévu, le mois où l'objectif sera atteint ; null si rien n'est mis de côté. */
  atteintVers: string | null;
}

export function avanceeProjet(plan: PlanBudget, docs: readonly DocBudget[], aujourdhui: Jour): AvanceeProjet | null {
  const projet = plan.projet;
  if (!projet || projet.objectif <= 0) return null;
  const epargne = Math.max(0, etatDesPots(plan, docs, aujourdhui).epargne.solde);
  const manque = auCentime(Math.max(0, projet.objectif - epargne));
  const rythme = bilanDuMois(plan).versements.epargne;
  let parMoisPourLaDate: number | null = null;
  if (projet.date) {
    const moisRestants = Math.max(1, (Number(projet.date.slice(0, 4)) - Number(aujourdhui.slice(0, 4))) * 12 + Number(projet.date.slice(5, 7)) - Number(aujourdhui.slice(5, 7)));
    parMoisPourLaDate = auCentime(manque / moisRestants);
  }
  let atteintVers: string | null = manque === 0 ? moisDe(aujourdhui) : null;
  if (manque > 0 && rythme > 0) {
    let mois = moisDe(aujourdhui);
    for (let i = 0; i < Math.ceil(manque / rythme); i++) mois = moisSuivant(mois);
    atteintVers = mois;
  }
  return { projet, epargne, part: Math.min(1, epargne / projet.objectif), manque, parMoisPourLaDate, atteintVers };
}

// ----- Les visuels -----

export interface PartDuCommun {
  pot: Pot;
  montant: number;
  /** De 0 à 1, sur tout ce que le commun répartit dans le mois. */
  part: number;
  postes: Poste[];
}

/** Où part chaque mois l'argent du compte commun, pot par pot : l'anneau du mois. */
export function repartitionDuCommun(plan: PlanBudget): PartDuCommun[] {
  const { versements } = bilanDuMois(plan);
  const ordre: Pot[] = ["commun", "courses", "factures", "plaisir", "epargne"];
  const total = ordre.reduce((t, pot) => t + versements[pot], 0);
  return ordre
    .filter((pot) => versements[pot] > 0)
    .map((pot) => ({
      pot,
      montant: versements[pot],
      part: total > 0 ? versements[pot] / total : 0,
      postes: plan.postes.filter((x) => x.qui === null && x.pot === pot).sort((a, b) => parMois(b) - parMois(a)),
    }));
}

export interface RythmeCourses {
  depense: number;
  budget: number;
  /** Ce qu'on aurait dépensé à ce jour en suivant le budget au même pas tout le mois. */
  attendu: number;
  /** Au rythme du mois, la dépense à la fin du mois ; null les quatre premiers jours (trop tôt pour le dire). */
  projection: number | null;
  /** Le jour du mois, sur le nombre de jours du mois : de 0 à 1. */
  avanceeDuMois: number;
}

/** Le rythme de la carte courses : où on en est, et où on finira le mois à ce pas. */
export function rythmeCourses(plan: PlanBudget, docs: readonly DocBudget[], aujourdhui: Jour): RythmeCourses | null {
  const { budgetDuMois: budget, depenseDuMois: depense } = etatDesPots(plan, docs, aujourdhui).courses;
  if (budget <= 0) return null;
  const jour = Number(aujourdhui.slice(8, 10));
  const jours = Number(jourDuMois(moisDe(aujourdhui), 31).slice(8, 10));
  return {
    depense,
    budget,
    attendu: auCentime((budget * jour) / jours),
    projection: jour >= 5 ? auCentime((depense / jour) * jours) : null,
    avanceeDuMois: jour / jours,
  };
}

export interface MoisDeFactures {
  mois: string;
  /** Ce qui sortira du pot factures ce mois-là (pour le mois en cours : ce qui n'est pas encore payé). */
  sorties: number;
  /** Les factures de l'année qui tombent ce mois-là. */
  annuelles: { libelle: string; montant: number }[];
  /** Le solde du pot à la fin du mois, si tout se passe comme prévu. */
  solde: number;
}

/**
 * Les douze mois qui viennent pour le pot factures : chaque mois reçoit son versement,
 * paie les factures du mois et celles de l'année qui tombent ce mois-là. Montre les mois
 * lourds, et le mois où le pot manquerait s'il en manque un.
 */
export function previsionFactures(plan: PlanBudget, docs: readonly DocBudget[], aujourdhui: Jour, combien = 12): MoisDeFactures[] {
  const postes = plan.postes.filter((p) => p.qui === null && p.pot === "factures");
  const versement = bilanDuMois(plan).versements.factures;
  const toutes = depenses(docs);
  const auto = prelevementsPasses(plan, aujourdhui);
  const ceMois = moisDe(aujourdhui);
  const dejaPaye = (poste: Poste) =>
    auto.some((a) => a.poste.id === poste.id && moisDe(a.jour) === ceMois) ||
    toutes.some((d) => regle(d, poste, poste.frequence === "an" ? jourDuMois(ceMois, poste.jour ?? 1) : `${ceMois}-01`) && (poste.frequence === "an" || moisDe(d.jour) === ceMois));
  let solde = etatDesPots(plan, docs, aujourdhui).factures.solde;
  const resultat: MoisDeFactures[] = [];
  let mois = ceMois;
  for (let i = 0; i < combien; i++, mois = moisSuivant(mois)) {
    const numero = Number(mois.slice(5, 7));
    const duMois = postes.filter((p) => p.frequence === "mois" || p.mois === numero);
    const aPayer = i === 0 ? duMois.filter((p) => !dejaPaye(p)) : duMois;
    const sorties = auCentime(aPayer.reduce((t, p) => t + p.montant, 0));
    const verse = i === 0 && moisDocs(docs).some((m) => m.mois === ceMois) ? 0 : mois >= plan.depart.mois ? versement : 0;
    solde = auCentime(solde + verse - sorties);
    resultat.push({
      mois,
      sorties,
      annuelles: aPayer.filter((p) => p.frequence === "an").map((p) => ({ libelle: p.libelle, montant: p.montant })),
      solde,
    });
  }
  return resultat;
}

export interface PointEpargne {
  mois: string;
  solde: number;
  /** Un mois à venir, au rythme prévu. */
  prevu: boolean;
}

/**
 * La courbe de l'épargne : le solde à la fin de chaque mois versé depuis le départ, puis,
 * au rythme prévu, les mois à venir jusqu'à l'objectif du projet (au plus deux ans), ou
 * six mois sans projet.
 */
export function courbeEpargne(plan: PlanBudget, docs: readonly DocBudget[], aujourdhui: Jour): PointEpargne[] {
  const ceMois = moisDe(aujourdhui);
  const verses = moisDocs(docs).filter((m) => m.mois >= plan.depart.mois && m.mois <= ceMois);
  const sorties = depenses(docs).filter((d) => d.pot === "epargne" && d.jour >= `${plan.depart.mois}-01`);
  const points: PointEpargne[] = [];
  let solde = plan.depart.soldes.epargne ?? 0;
  for (let mois = plan.depart.mois; mois <= ceMois; mois = moisSuivant(mois)) {
    solde += verses.find((m) => m.mois === mois)?.versements.epargne ?? 0;
    solde -= sorties.filter((d) => moisDe(d.jour) === mois).reduce((t, d) => t + d.montant, 0);
    points.push({ mois, solde: auCentime(solde), prevu: false });
  }
  const rythme = bilanDuMois(plan).versements.epargne;
  const objectif = plan.projet?.objectif ?? 0;
  if (rythme > 0) {
    const limite = objectif > solde ? 24 : 6;
    let mois = ceMois;
    for (let i = 0; i < limite && !(objectif > 0 && solde >= objectif && i >= 3); i++) {
      mois = moisSuivant(mois);
      solde += rythme;
      points.push({ mois, solde: auCentime(solde), prevu: true });
    }
  }
  return points;
}

const depensesCourses = (docs: readonly DocBudget[]) => depenses(docs).filter((d) => d.pot === "courses");

/** Ce que la carte courses a payé chaque mois, sur les `combien` derniers mois (le mois en cours compris). */
export function coursesParMois(docs: readonly DocBudget[], aujourdhui: Jour, combien = 6): { mois: string; total: number }[] {
  const liste = depensesCourses(docs);
  let mois = moisDe(aujourdhui);
  const resultat: { mois: string; total: number }[] = [];
  for (let i = 0; i < combien; i++) {
    const m = mois;
    resultat.unshift({ mois: m, total: auCentime(liste.filter((d) => moisDe(d.jour) === m).reduce((t, d) => t + d.montant, 0)) });
    mois = decaler(`${mois}-01`, { unite: "mois", tous: -1 }).slice(0, 7);
  }
  return resultat;
}

/** Les courses des `combien` derniers mois, magasin par magasin, du plus gros au plus petit. */
export function coursesParMagasin(docs: readonly DocBudget[], aujourdhui: Jour, combien = 6): { magasin: string; total: number; part: number }[] {
  const depuis = decaler(`${moisDe(aujourdhui)}-01`, { unite: "mois", tous: -(combien - 1) });
  const totaux = new Map<string, number>();
  for (const d of depensesCourses(docs)) {
    if (d.jour < depuis || d.jour > aujourdhui) continue;
    const magasin = d.magasin ?? "Autres";
    totaux.set(magasin, (totaux.get(magasin) ?? 0) + d.montant);
  }
  const total = [...totaux.values()].reduce((t, x) => t + x, 0);
  return [...totaux.entries()]
    .map(([magasin, t]) => ({ magasin, total: auCentime(t), part: total > 0 ? t / total : 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Les abonnements à l'année, du plus cher au moins cher. `qui` : seulement ceux de ces personnes (et le commun). */
export function abonnementsALAnnee(plan: PlanBudget, qui?: readonly (Id | null)[]): { poste: Poste; parAn: number }[] {
  return plan.postes
    .filter((p) => p.categorie === "abonnement" && (!qui || qui.includes(p.qui)))
    .map((poste) => ({ poste, parAn: auCentime(parMois(poste) * 12) }))
    .sort((a, b) => b.parAn - a.parAn);
}

const nomDeProduit = (nom: string) => sansAccents(nom).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export interface PrixQuiMonte {
  nom: string;
  magasin: string | null;
  avant: { jour: Jour; prix: number };
  maintenant: { jour: Jour; prix: number };
  /** La hausse, de 0 à 1 (0,08 : 8 %). */
  hausse: number;
}

/**
 * Les produits habituels dont le prix a monté : la même ligne de ticket (même nom, même
 * magasin), au moins un mois d'écart sur les six derniers mois, au moins 5 % de plus.
 */
export function prixQuiMontent(docs: readonly DocBudget[], aujourdhui: Jour): PrixQuiMonte[] {
  const depuis = decaler(aujourdhui, { unite: "mois", tous: -6 });
  const releves = new Map<string, { nom: string; magasin: string | null; jour: Jour; prix: number }[]>();
  for (const d of depenses(docs)) {
    if (d.jour < depuis || d.jour > aujourdhui) continue;
    for (const a of d.articles ?? []) {
      const cle = `${nomDeProduit(a.nom)}|${d.magasin ? sansAccents(d.magasin) : ""}`;
      releves.set(cle, [...(releves.get(cle) ?? []), { nom: a.nom, magasin: d.magasin, jour: d.jour, prix: a.prix }]);
    }
  }
  const resultat: PrixQuiMonte[] = [];
  for (const liste of releves.values()) {
    const tries = [...liste].sort((a, b) => a.jour.localeCompare(b.jour));
    const premier = tries[0];
    const dernier = tries[tries.length - 1];
    if (ecartJours(premier.jour, dernier.jour) < 28 || premier.prix <= 0) continue;
    const hausse = (dernier.prix - premier.prix) / premier.prix;
    if (hausse < 0.05) continue;
    resultat.push({ nom: dernier.nom, magasin: dernier.magasin, avant: { jour: premier.jour, prix: premier.prix }, maintenant: { jour: dernier.jour, prix: dernier.prix }, hausse });
  }
  return resultat.sort((a, b) => b.hausse - a.hausse);
}

/**
 * Le mot de Jarvis sur le mois écoulé, les sept premiers jours du mois suivant : il compare
 * les courses au mois d'avant et l'épargne à ce qui était prévu. Sans rien de parlant, il se tait.
 */
export function motDuMois(plan: PlanBudget, docs: readonly DocBudget[], aujourdhui: Jour): string | null {
  if (Number(aujourdhui.slice(8, 10)) > 7) return null;
  const mois = decaler(`${moisDe(aujourdhui)}-01`, { unite: "mois", tous: -1 }).slice(0, 7);
  if (mois < plan.depart.mois) return null;
  const precedent = decaler(`${mois}-01`, { unite: "mois", tous: -1 }).slice(0, 7);
  const parMoisCourses = coursesParMois(docs, `${mois}-28`, 2);
  const [avant, celui] = [parMoisCourses.find((m) => m.mois === precedent)?.total ?? 0, parMoisCourses.find((m) => m.mois === mois)?.total ?? 0];
  const phrases: string[] = [];
  const nom = nommerMois(mois);
  if (avant > 0 && celui > 0) {
    const ecart = (celui - avant) / avant;
    if (ecart <= -0.05) phrases.push(`${Math.round(-ecart * 100)} % de moins en courses qu'en ${nommerMois(precedent)}, bravo.`);
    else if (ecart >= 0.1) phrases.push(`${Math.round(ecart * 100)} % de plus en courses qu'en ${nommerMois(precedent)}.`);
    else phrases.push(`Les courses de ${nom} sont proches de celles de ${nommerMois(precedent)}.`);
  }
  const verse = moisDocs(docs).find((m) => m.mois === mois)?.versements.epargne;
  const prevu = bilanDuMois(plan).versements.epargne;
  if (verse !== undefined && prevu > 0) {
    if (verse >= prevu) phrases.push(`L'épargne prévue est mise de côté (${formaterMontant(verse)}).`);
    else phrases.push(`${formaterMontant(prevu - verse)} de moins que prévu à l'épargne.`);
  }
  return phrases.length ? phrases.join(" ") : null;
}

const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « octobre », « mars 2027 » (l'année quand ce n'est pas l'année en cours). */
export function nommerMois(mois: string, aujourdhui?: Jour): string {
  const nom = NOMS_MOIS[Number(mois.slice(5, 7)) - 1] ?? mois;
  return aujourdhui && mois.slice(0, 4) !== aujourdhui.slice(0, 4) ? `${nom} ${mois.slice(0, 4)}` : nom;
}

export const nomDuMois = (numero: number) => NOMS_MOIS[numero - 1] ?? "";

/** « le 15 mars », « aujourd'hui », « demain », « en retard (le 3 octobre) ». */
export function decrireEcheanceFacture(echeance: Jour, aujourdhui: Jour): string {
  const ecart = ecartJours(aujourdhui, echeance);
  const date = `le ${Number(echeance.slice(8, 10))} ${NOMS_MOIS[Number(echeance.slice(5, 7)) - 1]}`;
  if (ecart < 0) return `en retard (${date})`;
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return "demain";
  return date;
}

// ----- Ce que Jarvis et l'accueil en disent -----

/** Le budget en quelques lignes, dans l'état du foyer envoyé à Jarvis. */
export function decrireBudget(docs: readonly DocBudget[], prenoms: (id: Id) => string, aujourdhui: Jour): string[] {
  const plan = planDe(docs);
  if (!plan) return [];
  const pots = etatDesPots(plan, docs, aujourdhui);
  const bilan = bilanDuMois(plan);
  const lignes = [
    `Budget (CHF) : carte courses ${formaterMontant(pots.courses.solde, false)} restants (${formaterMontant(pots.courses.depenseDuMois, false)} dépensés ce mois sur ${formaterMontant(pots.courses.budgetDuMois, false)}), plaisir ${formaterMontant(pots.plaisir.solde, false)}, pot factures ${formaterMontant(pots.factures.solde, false)}, épargne ${formaterMontant(pots.epargne.solde, false)}.`,
    `Compte commun : ${formaterMontant(bilan.entreeCommun, false)} versés par mois, ${formaterMontant(bilan.chargesCommunes, false)} de charges, reste ${formaterMontant(bilan.resteCommun, false)} (${Math.round(plan.partPlaisir * 100)} % plaisir, le reste épargne).`,
  ];
  const aPayer = facturesAPayer(plan, docs, aujourdhui, 45);
  if (aPayer.length) lignes.push(`Factures à payer : ${aPayer.map((f) => `${f.poste.libelle} ${formaterMontant(f.montant, false)} ${decrireEcheanceFacture(f.echeance, aujourdhui)}`).join(", ")}.`);
  const charges = plan.postes.map((p) => `${p.libelle} ${formaterMontant(p.montant, false)}/${p.frequence}${p.qui ? ` (${prenoms(p.qui)})` : ""}`);
  if (charges.length) lignes.push(`Charges : ${charges.join(", ")}.`);
  const projet = avanceeProjet(plan, docs, aujourdhui);
  if (projet) lignes.push(`Projet d'épargne « ${projet.projet.nom} » : ${formaterMontant(projet.epargne, false)} sur ${formaterMontant(projet.projet.objectif, false)}.`);
  return lignes;
}
