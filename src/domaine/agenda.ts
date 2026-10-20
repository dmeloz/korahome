// L'agenda commun : rendez-vous (médecin, véto), anniversaires, vacances, sorties et horaires
// de travail, à deux, au même endroit. Chaque événement est pour le foyer (« nous deux ») ou
// pour une personne. Il peut revenir chaque semaine, chaque mois ou chaque année.
//
// Chacun peut relier son iCloud (icloud.ts) : la fonction serveur supabase/functions/agenda écrit
// l'agenda dans un calendrier « Kora » de l'iPhone et lit les autres calendriers choisis. Les
// rappels prévus au carnet de Mitsu y apparaissent aussi, en lecture seule.
// Ce module reste sans dépendance vers l'interface ou le stockage.

import { ErreurValidation } from "./foyer";
import { TYPES_SOIN, type Animal } from "./mitsu";
import { normaliser } from "./rayons";
import { decaler, ecartJours } from "./taches";
import type { Contexte, Foyer, Id, Jour } from "./types";
import { deuxChiffres, NOMS_JOURS, NOMS_MOIS } from "./texte";

export const CATEGORIES = {
  rdv: "Rendez-vous",
  anniversaire: "Anniversaire",
  vacances: "Vacances",
  sortie: "Sortie",
  travail: "Travail",
  autre: "Autre",
} as const;
export type Categorie = keyof typeof CATEGORIES;

export const REPETITIONS = { aucune: "Une fois", jour: "Chaque jour", semaine: "Chaque semaine", mois: "Chaque mois", annee: "Chaque année" } as const;
export type Repetition = keyof typeof REPETITIONS;

export interface Evenement {
  id: Id;
  titre: string;
  /** Le premier jour. */
  jour: Jour;
  /** Le dernier jour, compris, pour ce qui dure plusieurs jours (vacances) ; null : un seul jour. */
  fin: Jour | null;
  /** « 14:30 » ; null : toute la journée. */
  heure: string | null;
  heureFin: string | null;
  /** La personne concernée ; null : nous deux. */
  pour: Id | null;
  categorie: Categorie;
  repetition: Repetition;
  lieu: string | null;
  note: string | null;
  creePar: Id | null;
  creeLe: string;
  /** Le dernier jour où il revient ; absent : sans fin. */
  jusquau?: Jour | null;
  /** Revient tous les N jours, semaines, mois ou ans (1 si absent). */
  intervalle?: number;
  /** Chaque semaine, ces jours-là (0 dimanche… 6 samedi) ; absent : le jour du début. */
  joursSemaine?: number[];
  /** Les fois retirées d'un événement qui revient. */
  sauf?: Jour[];
  /** Dernière modification (ISO 8601) : départage Kora et l'iPhone. */
  modifieLe?: string;
  /** Son identifiant dans iCloud, quand il a été créé sur l'iPhone. */
  uid?: string;
  /** Vient d'ailleurs (un agenda iCloud, le carnet de Mitsu) : se modifie là-bas, pas dans Kora. */
  source?: string;
  /**
   * Lu dans un calendrier iCloud : où il y est rangé, sa version, et quand Kora l'a lu. Modifié
   * dans Kora après `importeLe`, il y retourne au passage suivant.
   */
  icloud?: { href: string; etag: string | null; importeLe: string };
  /** Retiré dans Kora, en attente d'être effacé de son calendrier iCloud : caché partout. */
  aRetirer?: boolean;
}

/**
 * Le compte iCloud d'une personne, vu par les téléphones : la fonction serveur « agenda » l'écrit
 * (le mot de passe d'app reste sur le serveur, jamais ici). Un document par personne reliée.
 */
export interface CompteIcloud {
  id: string;
  membre: Id;
  /** L'identifiant Apple, à moitié masqué : « d.z…@icloud.com ». */
  appleId: string;
  /** Les agendas trouvés dans iCloud ; ceux qui sont lus apparaissent dans Kora. */
  calendriers: { url: string; nom: string; lu: boolean }[];
  derniereSynchro: string | null;
  /** Le dernier problème rencontré (mot de passe retiré…) ; null : tout va bien. */
  erreur: string | null;
}

export const idCompteIcloud = (membre: Id) => `icloud-compte-${membre}`;

/** Ce que contient la collection partagée « agenda ». */
export type DocAgenda = Evenement | CompteIcloud;

export const estEvenement = (d: DocAgenda): d is Evenement => "titre" in d && "jour" in d && !(d as Evenement).aRetirer;
/** Les événements iCloud retirés dans Kora, que le serveur doit encore effacer d'iCloud. */
export const aRetirerDe = (docs: readonly DocAgenda[]): Evenement[] => docs.filter((d): d is Evenement => "titre" in d && !!(d as Evenement).aRetirer);
export const evenementsDe = (docs: readonly DocAgenda[]): Evenement[] => docs.filter(estEvenement);
export const comptesIcloudDe = (docs: readonly DocAgenda[]): CompteIcloud[] => docs.filter((d): d is CompteIcloud => "appleId" in d);

const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const RE_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface EntreeEvenement {
  titre: string;
  jour: Jour;
  fin?: Jour | null;
  heure?: string | null;
  heureFin?: string | null;
  pour?: Id | null;
  categorie?: Categorie;
  repetition?: Repetition;
  lieu?: string | null;
  note?: string | null;
}

const propre = (t: string | null | undefined) => (t && t.trim() ? t.trim() : null);

/** Vérifie et range ce qui a été saisi ; garde l'identifiant et l'auteur d'un événement modifié. */
export function preparerEvenement(e: EntreeEvenement, membreId: Id | null, ctx: Contexte, avant?: Evenement): Evenement {
  const titre = e.titre.trim();
  if (!titre) throw new ErreurValidation("Donne un nom à l'événement.");
  if (!RE_JOUR.test(e.jour)) throw new ErreurValidation("Choisis une date.");
  const fin = e.fin && e.fin !== e.jour ? e.fin : null;
  if (fin && (!RE_JOUR.test(fin) || fin < e.jour)) throw new ErreurValidation("La fin doit venir après le début.");
  const heure = propre(e.heure);
  if (heure && !RE_HEURE.test(heure)) throw new ErreurValidation("L'heure n'est pas valable.");
  let heureFin = heure ? propre(e.heureFin) : null;
  if (heureFin && !RE_HEURE.test(heureFin)) throw new ErreurValidation("L'heure de fin n'est pas valable.");
  if (heureFin && !fin && heureFin <= heure!) heureFin = null;
  return {
    id: avant?.id ?? ctx.nouvelId(),
    titre: titre.charAt(0).toUpperCase() + titre.slice(1),
    jour: e.jour,
    fin,
    heure,
    heureFin,
    pour: e.pour ?? null,
    categorie: e.categorie ?? "autre",
    repetition: e.repetition ?? "aucune",
    lieu: propre(e.lieu),
    note: propre(e.note),
    creePar: avant ? avant.creePar : membreId,
    creeLe: avant?.creeLe ?? ctx.maintenant(),
    ...(avant?.jusquau ? { jusquau: avant.jusquau } : {}),
    ...(avant?.intervalle && avant.repetition === (e.repetition ?? "aucune") ? { intervalle: avant.intervalle } : {}),
    ...(avant?.joursSemaine && avant.repetition === "semaine" && e.repetition === "semaine" ? { joursSemaine: avant.joursSemaine } : {}),
    ...(avant?.sauf?.length ? { sauf: avant.sauf } : {}),
    ...(avant?.uid ? { uid: avant.uid } : {}),
    ...(avant?.source ? { source: avant.source } : {}),
    ...(avant?.icloud ? { icloud: avant.icloud } : {}),
    modifieLe: ctx.maintenant(),
  };
}

// ----- Les jours où un événement a lieu -----

export interface Occurrence {
  /** Unique pour chaque fois : l'événement et son jour. */
  cle: string;
  evenement: Evenement;
  debut: Jour;
  fin: Jour;
  /** L'âge fêté, pour un anniversaire dont l'année de naissance est connue. */
  annees: number | null;
  /** Vient d'un autre module (le carnet de Mitsu) : se modifie là-bas. */
  lectureSeule: boolean;
}

const annee = (j: Jour) => Number(j.slice(0, 4));

/** La même date une autre année ; le 29 février devient le 28 les années ordinaires. */
function memeDateEn(jour: Jour, an: number): Jour {
  const [, m, d] = jour.split("-").map(Number);
  const dernier = new Date(Date.UTC(an, m, 0)).getUTCDate();
  return `${String(an).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(Math.min(d, dernier)).padStart(2, "0")}`;
}

/** Les débuts de chaque fois que l'événement a lieu et qui touchent la période [du, au]. */
function debutsDans(e: Evenement, du: Jour, au: Jour): Jour[] {
  const duree = e.fin ? ecartJours(e.jour, e.fin) : 0;
  const pas = Math.max(1, Math.floor(e.intervalle ?? 1));
  const limite = e.repetition !== "aucune" && e.jusquau && e.jusquau < au ? e.jusquau : au;
  if (limite < e.jour) return [];
  const sauf = new Set(e.sauf ?? []);
  const touche = (debut: Jour) => debut >= e.jour && debut <= limite && !sauf.has(debut) && decaler(debut, { unite: "jour", tous: duree }) >= du;
  const debuts: Jour[] = [];
  if (e.repetition === "aucune") {
    if (touche(e.jour)) debuts.push(e.jour);
  } else if (e.repetition === "jour") {
    const depuis = Math.max(0, Math.floor((ecartJours(e.jour, du) - duree) / pas));
    for (let k = depuis; ; k++) {
      const d = decaler(e.jour, { unite: "jour", tous: pas * k });
      if (d > limite) break;
      if (touche(d)) debuts.push(d);
    }
  } else if (e.repetition === "semaine") {
    // Semaine par semaine depuis celle du début, chacun des jours choisis.
    const lundi = lundiDe(e.jour);
    const jours = (e.joursSemaine?.length ? e.joursSemaine : [jourSemaine(e.jour)]).map((j) => (j + 6) % 7).sort();
    const depuis = Math.max(0, Math.floor((ecartJours(lundi, du) - duree) / (7 * pas)) - 1);
    for (let k = depuis; ; k++) {
      const semaine = decaler(lundi, { unite: "jour", tous: 7 * pas * k });
      if (semaine > limite) break;
      for (const j of jours) {
        const d = decaler(semaine, { unite: "jour", tous: j });
        if (touche(d)) debuts.push(d);
      }
    }
  } else if (e.repetition === "mois") {
    const mois = (j: Jour) => annee(j) * 12 + Number(j.slice(5, 7));
    const depuis = Math.max(0, Math.floor((mois(du) - mois(e.jour) - 1 - Math.ceil(duree / 28)) / pas));
    for (let k = depuis; ; k++) {
      // Toujours depuis la date d'origine : le 31 reste le 31 quand le mois le permet.
      const d = decaler(e.jour, { unite: "mois", tous: pas * k });
      if (d > limite) break;
      if (touche(d)) debuts.push(d);
    }
  } else {
    for (let an = Math.max(annee(e.jour), annee(du) - 1); an <= annee(limite); an++) {
      if ((an - annee(e.jour)) % pas !== 0) continue;
      const d = memeDateEn(e.jour, an);
      if (touche(d)) debuts.push(d);
    }
  }
  return debuts;
}

/** Les rappels prévus au carnet des animaux (vaccin, vermifuge, visite), comme des rendez-vous. */
export function evenementsDesAnimaux(animaux: readonly Animal[]): Evenement[] {
  return animaux.flatMap((a) =>
    a.soins
      .filter((s) => !s.fait)
      .map((s) => ({
        id: `soin-${a.id}-${s.id}`,
        titre: `${a.nom} · ${s.libelle || TYPES_SOIN[s.type]}`,
        jour: s.date,
        fin: null,
        heure: null,
        heureFin: null,
        pour: null,
        categorie: "rdv" as const,
        repetition: "aucune" as const,
        lieu: null,
        note: "Prévu au carnet de santé.",
        creePar: null,
        creeLe: s.date,
        source: `Carnet de ${a.nom}`,
      })),
  );
}

/**
 * Tout ce qui a lieu entre deux dates (comprises), dans l'ordre : par jour, la journée
 * entière d'abord, puis par heure.
 */
export function occurrences(evenements: readonly Evenement[], du: Jour, au: Jour, animaux: readonly Animal[] = []): Occurrence[] {
  const resultat: Occurrence[] = [];
  for (const e of [...evenements, ...evenementsDesAnimaux(animaux)]) {
    const duree = e.fin ? ecartJours(e.jour, e.fin) : 0;
    for (const debut of debutsDans(e, du, au)) {
      const annees = e.categorie === "anniversaire" && e.repetition === "annee" && annee(e.jour) < annee(e.creeLe) ? annee(debut) - annee(e.jour) : null;
      resultat.push({
        cle: `${e.id}/${debut}`,
        evenement: e,
        debut,
        fin: decaler(debut, { unite: "jour", tous: duree }),
        annees: annees && annees > 0 ? annees : null,
        lectureSeule: !!e.source && !e.icloud,
      });
    }
  }
  return resultat.sort(
    (a, b) =>
      a.debut.localeCompare(b.debut) ||
      (a.evenement.heure ?? "").localeCompare(b.evenement.heure ?? "") ||
      a.evenement.titre.localeCompare(b.evenement.titre, "fr"),
  );
}

/** Ce qui se passe un jour donné, y compris ce qui a commencé avant (des vacances). */
export function duJour(occ: readonly Occurrence[], jour: Jour): Occurrence[] {
  return occ
    .filter((o) => o.debut <= jour && o.fin >= jour)
    .sort((a, b) => {
      const enCours = (o: Occurrence) => (o.evenement.heure && o.debut === jour ? o.evenement.heure : "");
      return enCours(a).localeCompare(enCours(b)) || a.evenement.titre.localeCompare(b.evenement.titre, "fr");
    });
}

/** Ce que voit une personne : « tout », « nous » (le foyer seulement), ou un membre (le sien et le commun). */
export type Filtre = "tout" | "nous" | Id;

export function filtrer(occ: readonly Occurrence[], filtre: Filtre): Occurrence[] {
  if (filtre === "tout") return [...occ];
  if (filtre === "nous") return occ.filter((o) => o.evenement.pour === null);
  return occ.filter((o) => o.evenement.pour === null || o.evenement.pour === filtre);
}

/** Le titre affiché : « Anniversaire de Sarah · 32 ans ». */
export function titreDe(o: Occurrence): string {
  return o.annees ? `${o.evenement.titre} · ${o.annees} ans` : o.evenement.titre;
}

// ----- La vue Jour, heure par heure -----

/** Un événement placé sur la journée : de quelle minute à quelle minute, et dans quelle colonne. */
export interface Place {
  occurrence: Occurrence;
  /** Minutes depuis minuit. */
  debut: number;
  fin: number;
  colonne: number;
  colonnes: number;
}

/** Sans heure de fin, un événement occupe une heure. */
export const DUREE_PAR_DEFAUT = 60;
/** Assez haut pour qu'un titre se lise, même pour un rendez-vous de cinq minutes. */
const DUREE_MINIMALE = 20;

const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/**
 * La journée comme dans Calendrier : en haut ce qui dure toute la journée (ou a commencé avant),
 * puis chaque événement à son heure. Ceux qui se chevauchent se partagent la largeur.
 */
export function dispositionDuJour(occ: readonly Occurrence[], jour: Jour): { journee: Occurrence[]; places: Place[] } {
  const ce = duJour(occ, jour);
  const journee = ce.filter((o) => !o.evenement.heure || o.debut !== jour);
  const places = ce
    .filter((o) => o.evenement.heure && o.debut === jour)
    .map((o) => {
      const debut = minutes(o.evenement.heure!);
      const finPrevue = o.fin !== o.debut ? 24 * 60 : o.evenement.heureFin ? minutes(o.evenement.heureFin) : debut + DUREE_PAR_DEFAUT;
      const fin = Math.min(24 * 60, Math.max(finPrevue, debut + DUREE_MINIMALE));
      return { occurrence: o, debut, fin, colonne: 0, colonnes: 1 };
    })
    .sort((a, b) => a.debut - b.debut || b.fin - a.fin);

  // Les événements qui se touchent forment un groupe ; chacun prend la première colonne libre.
  let groupe: Place[] = [];
  let finGroupe = -1;
  const fermer = () => {
    const n = Math.max(0, ...groupe.map((p) => p.colonne + 1));
    for (const p of groupe) p.colonnes = n;
    groupe = [];
  };
  for (const p of places) {
    if (p.debut >= finGroupe) fermer();
    const prises = new Set(groupe.filter((q) => q.fin > p.debut).map((q) => q.colonne));
    let c = 0;
    while (prises.has(c)) c++;
    p.colonne = c;
    groupe.push(p);
    finGroupe = Math.max(finGroupe, p.fin);
  }
  fermer();
  return { journee, places };
}

// ----- Les mots des dates -----

export { NOMS_MOIS };
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export { NOMS_JOURS };

export const jourSemaine = (j: Jour) => new Date(`${j}T12:00:00Z`).getUTCDay();
const dateCourte = (j: Jour) => `${Number(j.slice(8, 10))} ${MOIS_COURTS[Number(j.slice(5, 7)) - 1]}`;
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** « Aujourd'hui », « Demain », « Jeudi 23 oct. », avec l'année quand ce n'est pas celle-ci. */
export function decrireJour(jour: Jour, aujourdhui: Jour): string {
  const ecart = ecartJours(aujourdhui, jour);
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return "Demain";
  if (ecart === -1) return "Hier";
  const an = annee(jour) !== annee(aujourdhui) ? ` ${annee(jour)}` : "";
  return `${majuscule(NOMS_JOURS[jourSemaine(jour)])} ${dateCourte(jour)}${an}`;
}

/** « 14:30 », « 14:30 – 15:30 », « Toute la journée », « Du 24 au 31 oct. ». */
export function decrireHoraire(o: Occurrence): string {
  const e = o.evenement;
  if (o.fin !== o.debut) {
    const memeMois = o.debut.slice(0, 7) === o.fin.slice(0, 7);
    const debut = memeMois ? String(Number(o.debut.slice(8, 10))) : dateCourte(o.debut);
    return `Du ${debut}${e.heure ? ` (${e.heure})` : ""} au ${dateCourte(o.fin)}${e.heureFin ? ` (${e.heureFin})` : ""}`;
  }
  if (!e.heure) return "Toute la journée";
  return e.heureFin ? `${e.heure} – ${e.heureFin}` : e.heure;
}

/** « Dans 3 jours », « Dans 5 semaines ». */
export function decrireDans(jour: Jour, aujourdhui: Jour): string {
  const n = ecartJours(aujourdhui, jour);
  if (n <= 0) return n === 0 ? "Aujourd'hui" : "Passé";
  if (n === 1) return "Demain";
  if (n < 14) return `Dans ${n} jours`;
  if (n < 61) return `Dans ${Math.round(n / 7)} semaines`;
  return `Dans ${Math.round(n / 30.44)} mois`;
}

/** Le lundi de la semaine d'un jour. */
export function lundiDe(jour: Jour): Jour {
  return decaler(jour, { unite: "jour", tous: -((jourSemaine(jour) + 6) % 7) });
}

/** Les jours affichés pour un mois : des semaines entières, du lundi au dimanche. */
export function grilleDuMois(mois: string): Jour[] {
  const premier = `${mois}-01`;
  const dernier = decaler(decaler(premier, { unite: "mois", tous: 1 }), { unite: "jour", tous: -1 });
  const jours: Jour[] = [];
  for (let j = lundiDe(premier); j <= dernier || jourSemaine(j) !== 1; j = decaler(j, { unite: "jour", tous: 1 })) jours.push(j);
  return jours;
}

export const nomDuMois = (mois: string) => `${majuscule(NOMS_MOIS[Number(mois.slice(5, 7)) - 1])} ${mois.slice(0, 4)}`;

// ----- Le widget -----

export interface ResumeAgenda {
  aujourdhui: Occurrence[];
  /** Les sept jours qui suivent. */
  semaine: Occurrence[];
}

export function resumeAgenda(evenements: readonly Evenement[], animaux: readonly Animal[], aujourdhui: Jour, filtre: Filtre = "tout"): ResumeAgenda {
  const occ = filtrer(occurrences(evenements, aujourdhui, decaler(aujourdhui, { unite: "jour", tous: 7 }), animaux), filtre);
  return { aujourdhui: duJour(occ, aujourdhui), semaine: occ.filter((o) => o.debut > aujourdhui) };
}

/** « Auj. 14:30 · Dentiste », « Jeu. · Anniversaire de maman · 64 ans ». */
export function ligneWidget(o: Occurrence, aujourdhui: Jour): string {
  const ecart = ecartJours(aujourdhui, o.debut);
  const quand = ecart <= 0 ? "Auj." : ecart === 1 ? "Demain" : `${majuscule(NOMS_JOURS[jourSemaine(o.debut)].slice(0, 3))}.`;
  const heure = o.evenement.heure && o.debut >= aujourdhui ? ` ${o.evenement.heure}` : "";
  return `${quand}${heure} · ${titreDe(o)}`;
}

// ----- Écrire comme on parle -----

export interface Brouillon {
  titre: string;
  jour: Jour | null;
  fin: Jour | null;
  heure: string | null;
  heureFin: string | null;
  categorie: Categorie;
  repetition: Repetition;
  /** Le prénom reconnu (« pour Sarah ») ; undefined : rien de dit. */
  pour?: Id | null;
}

const MOTS_CATEGORIES: [Categorie, RegExp][] = [
  ["anniversaire", /\banniv/],
  ["vacances", /\b(vacances?|conges?|week-?end a|voyage|sejour)\b/],
  ["travail", /\b(travail|boulot|bureau|horaire|service|garde|equipe|shift|reunion)\b/],
  ["rdv", /\b(rdv|rendez-?vous|medecin|docteur|dentiste|veto|veterinaire|ophtalmo|gyneco|kine|physio|osteo|pediatre|coiffeur|hopital|controle|vaccin|banque|garage|notaire)\b/],
  ["sortie", /\b(resto|restaurant|cinema|cine|concert|theatre|expo|musee|apero|soiree|diner chez|brunch|fete|match|spectacle|balade|sortie|festival|mariage|bapteme)\b/],
];

/** La catégorie d'après les mots : « dentiste » est un rendez-vous, « apéro » une sortie. */
export function devinerCategorie(texte: string): Categorie {
  const cle = normaliser(texte);
  return MOTS_CATEGORIES.find(([, re]) => re.test(cle))?.[0] ?? "autre";
}

const MOIS_RE = "janv(?:ier|\\.)?|f[ée]vr(?:ier|\\.)?|mars|avr(?:il|\\.)?|mai|juin|juil(?:let|\\.)?|ao[uû]t|sept(?:embre|\\.)?|oct(?:obre|\\.)?|nov(?:embre|\\.)?|d[ée]c(?:embre|\\.)?";
const JOURS_RE = "lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche";

function numeroMois(mot: string): number {
  const n = normaliser(mot).replace(".", "");
  return ["jan", "fev", "mar", "avr", "mai", "juin", "juil", "aou", "sep", "oct", "nov", "dec"].findIndex((p) => n.startsWith(p)) + 1;
}

const RE_DATE_VALIDE = (j: Jour) => {
  const [a, m, d] = j.split("-").map(Number);
  const date = new Date(Date.UTC(a, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/** Une date « 12 mars », « 12.03 », avec ou sans année : sans année, la prochaine fois qu'elle arrive. */
function dateDe(jour: number, mois: number, an: number | null, aujourdhui: Jour): Jour | null {
  if (!mois || jour < 1 || jour > 31) return null;
  let a = an ?? annee(aujourdhui);
  if (a < 100) a += 2000;
  let j = `${a}-${deuxChiffres(mois)}-${deuxChiffres(jour)}`;
  if (!RE_DATE_VALIDE(j)) return null;
  if (an === null && j < aujourdhui) j = `${a + 1}-${deuxChiffres(mois)}-${deuxChiffres(jour)}`;
  return j;
}

/** « le 28 » sans mois : le prochain 28, ce mois-ci s'il n'est pas passé, sinon le mois suivant. */
function prochainQuantieme(jour: number, aujourdhui: Jour, apres: Jour = aujourdhui): Jour | null {
  if (jour < 1 || jour > 31) return null;
  let [a, m] = [annee(apres), Number(apres.slice(5, 7))];
  for (let i = 0; i < 3; i++) {
    const j = `${a}-${deuxChiffres(m)}-${deuxChiffres(jour)}`;
    if (RE_DATE_VALIDE(j) && j >= apres && j >= aujourdhui) return j;
    [a, m] = m === 12 ? [a + 1, 1] : [a, m + 1];
  }
  return null;
}

function heureDe(h: string, m?: string): string | null {
  const hh = Number(h);
  const mm = m ? Number(m) : 0;
  if (hh > 23 || mm > 59) return null;
  return `${deuxChiffres(hh)}:${deuxChiffres(mm)}`;
}

/** Le prochain jour de la semaine nommé, jamais aujourd'hui : « jeudi » dit un jeudi, c'est le suivant. */
function prochain(numero: number, aujourdhui: Jour): Jour {
  const ecart = (numero - jourSemaine(aujourdhui) + 7) % 7 || 7;
  return decaler(aujourdhui, { unite: "jour", tous: ecart });
}

/**
 * Comprend une phrase : « Dentiste jeudi 14h30 », « Anniversaire de maman le 12 mars 1962 »,
 * « Vacances du 20 au 27 décembre », « Travail Sarah tous les lundis de 8h à 17h ».
 * Ce qui reste, une fois la date et l'heure retirées, devient le titre.
 */
export function analyserPhrase(texte: string, aujourdhui: Jour, membres: Foyer["membres"] = []): Brouillon {
  let reste = ` ${texte.trim()} `;
  let jour: Jour | null = null;
  let fin: Jour | null = null;
  let heure: string | null = null;
  let heureFin: string | null = null;
  let repetition: Repetition = "aucune";
  let pour: Id | null | undefined;

  const retirer = (re: RegExp, faire: (m: RegExpMatchArray) => boolean | void) => {
    const m = reste.match(re);
    if (m && faire(m) !== false) reste = reste.replace(m[0], " ");
  };

  // Les intervalles d'abord : « du 20 au 27 décembre », « du 30 déc. au 3 janv. 2027 ».
  retirer(new RegExp(`\\bdu (\\d{1,2})(?:er)?(?: (${MOIS_RE}))? au (\\d{1,2})(?:er)? (${MOIS_RE})(?: (\\d{4}))?`, "i"), (m) => {
    const an = m[5] ? Number(m[5]) : null;
    const moisFin = numeroMois(m[4]);
    const moisDebut = m[2] ? numeroMois(m[2]) : moisFin;
    const f = dateDe(Number(m[3]), moisFin, an, aujourdhui);
    let d = dateDe(Number(m[1]), moisDebut, an ?? (f ? annee(f) : null), aujourdhui);
    if (!f || !d) return false;
    if (d > f) d = `${annee(f) - 1}${d.slice(4)}`;
    [jour, fin] = [d, f];
  });
  // « du 20 au 27 », sans mois : les prochains.
  if (!jour) {
    retirer(/\bdu (\d{1,2})(?:er)? au (\d{1,2})(?:er)?(?=\W)(?! ?[h:])/i, (m) => {
      const d = prochainQuantieme(Number(m[1]), aujourdhui);
      const f = d && prochainQuantieme(Number(m[2]), aujourdhui, d);
      if (!d || !f) return false;
      [jour, fin] = [d, f];
    });
  }
  // « de 8h à 17h », « 14h-15h30 ».
  retirer(/\b(?:de |entre )?(\d{1,2}) ?[h:](\d{2})? ?(?:à|a|-|–|et) ?(\d{1,2}) ?[h:](\d{2})?(?=\W)/i, (m) => {
    const [a, b] = [heureDe(m[1], m[2]), heureDe(m[3], m[4])];
    if (!a || !b) return false;
    [heure, heureFin] = [a, b];
  });
  if (!heure) {
    retirer(/\b(?:à |a |vers )?(\d{1,2}) ?(?:h|:) ?(\d{2})?(?=\W)/i, (m) => {
      const h = heureDe(m[1], m[2]);
      if (!h) return false;
      heure = h;
    });
  }
  if (!heure) retirer(/\b(?:à |a )?midi\b/i, () => void (heure = "12:00"));

  if (!jour) {
    retirer(/\b(?:tous les|chaque) (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?\b/i, (m) => {
      jour = prochain(NOMS_JOURS.indexOf(m[1].toLowerCase()), decaler(aujourdhui, { unite: "jour", tous: -1 }));
      repetition = "semaine";
    });
  }
  if (!jour) {
    retirer(new RegExp(`\\b(?:le |du )?(\\d{1,2})(?:er)? (${MOIS_RE})(?: (\\d{4}))?(?=\\W)`, "i"), (m) => {
      const d = dateDe(Number(m[1]), numeroMois(m[2]), m[3] ? Number(m[3]) : null, aujourdhui);
      if (!d) return false;
      jour = d;
    });
  }
  if (!jour) {
    retirer(/\b(?:le )?(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=\W)/, (m) => {
      const d = dateDe(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null, aujourdhui);
      if (!d) return false;
      jour = d;
    });
  }
  if (!jour) {
    retirer(/\ble (\d{1,2})(?:er)?(?=\W)(?! ?[h:])/i, (m) => {
      const d = prochainQuantieme(Number(m[1]), aujourdhui);
      if (!d) return false;
      jour = d;
    });
  }
  if (!jour) {
    retirer(/\b(?:ce |le )?week-?end( prochain)?\b/i, (m) => {
      const samedi = prochain(6, decaler(aujourdhui, { unite: "jour", tous: jourSemaine(aujourdhui) === 0 ? 0 : -1 }));
      jour = m[1] ? decaler(samedi, { unite: "jour", tous: 7 }) : samedi;
      fin = decaler(jour, { unite: "jour", tous: 1 });
    });
  }
  if (!jour) retirer(/\bapr[eè]s-?demain\b/i, () => void (jour = decaler(aujourdhui, { unite: "jour", tous: 2 })));
  if (!jour) retirer(/\bdemain\b/i, () => void (jour = decaler(aujourdhui, { unite: "jour", tous: 1 })));
  if (!jour) retirer(/\b(?:aujourd'hui|aujourd’hui|ce soir|ce matin|cet apr[eè]m)\b/i, () => void (jour = aujourdhui));
  if (!jour) {
    retirer(new RegExp(`\\b(${JOURS_RE})( prochain)?\\b`, "i"), (m) => {
      jour = prochain(NOMS_JOURS.indexOf(m[1].toLowerCase()), aujourdhui);
    });
  }

  for (const membre of membres) {
    retirer(new RegExp(`\\b(?:pour|avec) ${membre.prenom}\\b`, "i"), () => void (pour = membre.id));
  }
  if (pour === undefined) retirer(/\b(?:pour nous|nous deux|ensemble)\b/i, () => void (pour = null));
  if (repetition === "aucune") {
    retirer(/\b(?:chaque|toutes les) semaines?\b/i, () => void (repetition = "semaine"));
    retirer(/\b(?:chaque|tous les) mois\b/i, () => void (repetition = "mois"));
    retirer(/\b(?:chaque|tous les) ans?\b|\bchaque année\b/i, () => void (repetition = "annee"));
  }

  const categorie = devinerCategorie(texte);
  if (categorie === "anniversaire" && repetition === "aucune") repetition = "annee";

  const titre = reste
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, "")
    .replace(/\s+(le|la|à|a|au|de|du|pour|et|,)$/i, "")
    .replace(/^(le|la|à|a|au)\s+/i, "")
    .trim();
  return { titre: majuscule(titre), jour, fin, heure, heureFin, categorie, repetition, ...(pour !== undefined ? { pour } : {}) };
}

// ----- Pour Jarvis et le rappel du matin -----

/** Ce qui concerne une personne aujourd'hui : le commun et le sien. */
export function evenementsDuMatin(evenements: readonly Evenement[], membreId: Id | null, aujourdhui: Jour): Occurrence[] {
  const occ = duJour(occurrences(evenements, aujourdhui, aujourdhui), aujourdhui);
  return membreId === null ? occ : filtrer(occ, membreId);
}

/** « Dentiste à 14:30 », « Vacances (jusqu'au 27 déc.) ». */
export function decrireCourt(o: Occurrence, jour: Jour): string {
  const e = o.evenement;
  if (o.fin > jour && o.debut < jour) return `${titreDe(o)} (jusqu'au ${dateCourte(o.fin)})`;
  return e.heure && o.debut === jour ? `${titreDe(o)} à ${e.heure}` : titreDe(o);
}

/** L'agenda des deux semaines qui viennent, en quelques lignes, pour Jarvis. */
export function decrireAgenda(evenements: readonly Evenement[], foyer: Foyer, aujourdhui: Jour): string[] {
  const occ = occurrences(evenements, aujourdhui, decaler(aujourdhui, { unite: "jour", tous: 14 }));
  if (occ.length === 0) return ["Agenda des deux semaines : rien de prévu."];
  return [
    "Agenda des deux semaines :",
    ...occ.map((o) => {
      const qui = o.evenement.pour ? (foyer.membres.find((m) => m.id === o.evenement.pour)?.prenom ?? "une personne") : "nous deux";
      return `- ${titreDe(o)} : ${o.debut}${o.fin !== o.debut ? ` au ${o.fin}` : ""}${o.evenement.heure ? ` à ${o.evenement.heure}` : ""}, ${qui}${o.evenement.lieu ? `, ${o.evenement.lieu}` : ""}`;
    }),
  ];
}
