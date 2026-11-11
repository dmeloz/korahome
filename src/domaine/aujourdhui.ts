import { resumeAgenda, titreDe, type Evenement } from "./agenda";
import { menuDeLaSemaine, type DocChef } from "./chef";
import { gestesDuJardin, type Zone } from "./jardin";
import type { Meteo } from "./meteo";
import { choseAFaire, type Animal } from "./mitsu";
import { tachesDuMatin } from "./rappels";
import { etatProduit, resumeStock, type Produit } from "./stock";
import { aSortirCeSoir, phraseSortir, type ReglageDechets } from "./maison";
import { ecartJours, enMinutes, heureDe } from "./taches";
import { JOURS_LIMITE_PRESSEE, type ResiliationDuJour } from "./abonnements";
import type { Id, Jour, Tache } from "./types";

// La carte « Aujourd'hui » : les trois choses qui comptent, dans l'ordre. Une seule
// forme de données, que l'accueil affiche aujourd'hui et que reprendront demain le
// widget de l'iPhone (WidgetKit) et la réponse de Siri (« Qu'est-ce qu'on a aujourd'hui ? »).

/** Les trois états de l'app, et seulement trois. */
export type EtatChose =
  /** En retard, ou à faire avant ce soir : le seul rouge. */
  | "urgent"
  /** Aujourd'hui : le laiton. */
  | "jour"
  /** Tout le reste : rien d'alarmant. */
  | "calme";

/** Où mène le toucher : un module de l'accueil, ou une action de Kora. */
export type DestinationChose = "taches" | "agenda" | "mitsu" | "stock" | "jardin" | "chef" | "budget" | "sauvegarde" | "repartition" | "maison" | "administratif";

export interface ChoseDuJour {
  /** Stable d'un affichage à l'autre (pour React, et pour ne pas répéter un rappel). */
  cle: string;
  texte: string;
  /** « en retard », « avant ce soir », « 14:30 », « demain 9:00 », « ce soir ». */
  quand: string;
  etat: EtatChose;
  destination: DestinationChose;
  /** Pour une tâche : de quoi la cocher sans ouvrir la page. */
  tacheId?: Id;
  /** L'heure, « HH:MM », quand la chose en a une (tâche avec heure, rendez-vous du jour). */
  heure?: string;
}

export interface CarteDuJour {
  jour: Jour;
  choses: ChoseDuJour[];
  /** Ce qui n'a pas trouvé de place dans la carte. */
  autres: number;
  /** Les tâches cochées aujourd'hui (par soi, ou par n'importe qui sans personne choisie), pour la jauge. */
  faites: number;
}

/** Une facture à payer (le module Budget la fournira). */
export interface FactureDuJour {
  id: Id;
  libelle: string;
  echeance: Jour;
}

export interface EntreeDuJour {
  membreId: Id | null;
  aujourdhui: Jour;
  taches: readonly Tache[];
  evenements: readonly Evenement[];
  animaux: readonly Animal[];
  produits: readonly Produit[];
  zones: readonly Zone[];
  meteo: Meteo | null;
  menus: readonly DocChef[];
  /** Les factures du Budget, quand il existera. */
  factures?: readonly FactureDuJour[];
  /** Les contrats à résilier bientôt (resiliationsDuJour) : la limite dans 45 jours, pressée dans 7. */
  resiliations?: readonly ResiliationDuJour[];
  /** La sauvegarde de la semaine est à faire. */
  sauvegardeDue?: boolean;
  /** Dimanche : on se répartit la semaine. */
  repartitionDue?: boolean;
  /** Les jours des déchets réglés par le foyer (Maison › Entretien). */
  dechets?: ReglageDechets | null;
}

const ORDRE: Record<EtatChose, number> = { urgent: 0, jour: 1, calme: 2 };

/** Toutes les choses du jour, de la plus pressée à la plus calme. */
export function chosesDuJour(e: EntreeDuJour): ChoseDuJour[] {
  const choses: ChoseDuJour[] = [];
  const { aujourdhui } = e;

  const t = tachesDuMatin([...e.taches], e.membreId, aujourdhui);
  const avecHeure = (x: Tache) => {
    const h = heureDe(x);
    return h ? { heure: h } : {};
  };
  for (const x of t.enRetard) choses.push({ cle: `tache-${x.id}`, texte: x.titre, quand: "en retard", etat: "urgent", destination: "taches", tacheId: x.id, ...avecHeure(x) });
  for (const x of t.aujourdhui) choses.push({ cle: `tache-${x.id}`, texte: x.titre, quand: "aujourd'hui", etat: "jour", destination: "taches", tacheId: x.id, ...avecHeure(x) });

  for (const f of e.factures ?? []) {
    const ecart = ecartJours(aujourdhui, f.echeance);
    if (ecart > 1) continue;
    choses.push({
      cle: `facture-${f.id}`,
      texte: f.libelle,
      quand: ecart < 0 ? "en retard" : ecart === 0 ? "à payer aujourd'hui" : "à payer demain",
      etat: ecart <= 0 ? "urgent" : "calme",
      destination: "budget",
    });
  }

  // Un contrat qui se renouvelle tout seul : Kora le dit avant la limite, en calme, puis en laiton la dernière semaine.
  for (const r of e.resiliations ?? []) {
    choses.push({
      cle: `resiliation-${r.id}`,
      texte: r.texte,
      quand: r.dansJours === 0 ? "dernier jour" : r.dansJours === 1 ? "jusqu'à demain" : `${r.dansJours} jours`,
      etat: r.dansJours <= JOURS_LIMITE_PRESSEE ? "jour" : "calme",
      destination: "administratif",
    });
  }

  const { aConsommer } = resumeStock(e.produits, aujourdhui);
  for (const p of aConsommer) {
    const etat = etatProduit(p, aujourdhui);
    if (etat === "perime") choses.push({ cle: `stock-${p.id}`, texte: p.nom, quand: "périmé", etat: "urgent", destination: "stock" });
    else if (etat === "aujourdhui") choses.push({ cle: `stock-${p.id}`, texte: p.nom, quand: "à finir aujourd'hui", etat: "urgent", destination: "stock" });
  }

  const agenda = resumeAgenda(e.evenements, e.animaux, aujourdhui);
  const concerne = (ev: Evenement) => e.membreId === null || ev.pour === null || ev.pour === e.membreId;
  for (const o of agenda.aujourdhui.filter((o) => concerne(o.evenement))) {
    const heure = o.evenement.heure && o.debut === aujourdhui ? o.evenement.heure : undefined;
    choses.push({ cle: `agenda-${o.cle}`, texte: titreDe(o), quand: heure ?? "aujourd'hui", etat: "jour", destination: "agenda", ...(heure ? { heure } : {}) });
  }
  const demain = agenda.semaine.filter((o) => ecartJours(aujourdhui, o.debut) === 1 && concerne(o.evenement));
  for (const o of demain) {
    choses.push({ cle: `agenda-${o.cle}`, texte: titreDe(o), quand: o.evenement.heure ? `demain ${o.evenement.heure}` : "demain", etat: "calme", destination: "agenda" });
  }

  for (const animal of e.animaux) {
    choseAFaire(animal, aujourdhui).forEach((c, i) => {
      const enRetard = /en retard|c'est fini/.test(c.texte);
      choses.push({ cle: `mitsu-${animal.id}-${i}`, texte: c.texte, quand: animal.nom, etat: enRetard ? "urgent" : "jour", destination: "mitsu" });
    });
  }

  gestesDuJardin(e.zones, e.meteo, aujourdhui).forEach((g, i) => {
    if (!g.urgent) return;
    const gel = g.texte.startsWith("Gel");
    choses.push({ cle: `jardin-${g.zoneId ?? i}`, texte: g.texte, quand: gel ? "avant ce soir" : "aujourd'hui", etat: gel ? "urgent" : "jour", destination: "jardin" });
  });

  const ceSoir = repasDuSoir(e.menus, aujourdhui);
  if (ceSoir) choses.push({ cle: "chef-ce-soir", texte: ceSoir, quand: "ce soir", etat: "jour", destination: "chef" });

  // Les déchets de demain se sortent la veille au soir.
  const aSortir = aSortirCeSoir(e.dechets ?? null, aujourdhui);
  if (aSortir.length) choses.push({ cle: "dechets", texte: phraseSortir(aSortir), quand: "ce soir", etat: "jour", destination: "maison" });

  if (e.repartitionDue) choses.push({ cle: "repartition", texte: "On se répartit la semaine ?", quand: "dimanche", etat: "calme", destination: "repartition" });
  if (e.sauvegardeDue) choses.push({ cle: "sauvegarde", texte: "Sauvegarde de la semaine", quand: "un toucher", etat: "calme", destination: "sauvegarde" });

  // Le tri est stable : à état égal, ce qui a une heure passe d'abord, de la plus tôt à la plus
  // tard, puis le reste dans l'ordre des sources ci-dessus.
  const minutes = (c: ChoseDuJour) => (c.heure ? (enMinutes(c.heure) ?? Infinity) : Infinity);
  return choses.sort((a, b) => ORDRE[a.etat] - ORDRE[b.etat] || (minutes(a) === minutes(b) ? 0 : minutes(a) < minutes(b) ? -1 : 1));
}

/** Le repas prévu ce soir par le Chef : un repas par soir depuis le jour où il a préparé la semaine. */
export function repasDuSoir(menus: readonly DocChef[], aujourdhui: Jour): string | null {
  const menu = menuDeLaSemaine(menus, aujourdhui);
  if (!menu) return null;
  return menu.repas[ecartJours(menu.semaine, aujourdhui)]?.titre ?? null;
}

/** La carte de l'accueil : au plus trois choses, et combien d'autres attendent. */
export function carteDuJour(e: EntreeDuJour, max = 3): CarteDuJour {
  const toutes = chosesDuJour(e);
  const faites = e.taches.filter((t) => (t.historique ?? []).some((f) => f.le === e.aujourdhui && (e.membreId === null || f.par === e.membreId))).length;
  return { jour: e.aujourdhui, choses: toutes.slice(0, max), autres: Math.max(0, toutes.length - max), faites };
}

/** Où en est la journée : les tâches cochées sur celles du jour (cochées et restantes), de 0 à 1. */
export function avanceeDuJour(carte: CarteDuJour): { faites: number; total: number; part: number } {
  const restantes = carte.choses.filter((c) => c.tacheId).length + carte.autres;
  const total = carte.faites + restantes;
  return { faites: carte.faites, total, part: total ? carte.faites / total : 1 };
}

/** Le titre de « Aujourd'hui » sur l'accueil, selon le moment de la journée. */
export function titreMoment(heure: number): string {
  if (heure < 12) return "Ce matin";
  if (heure < 17) return "Cet après-midi";
  return "Ce soir";
}

/** Combien de choses attendent, en tout : « 3 à faire ». */
export function resteAFaire(carte: CarteDuJour): number {
  return carte.choses.length + carte.autres;
}

// ----- Aujourd'hui sans répétition (Kora 0.1.14, maquette validée par Melo le 11 novembre 2026) -----
// Chaque chose se dit à un seul endroit : ce qui attend aujourd'hui dans la carte du moment,
// demain dans la carte « Demain », la suite de la semaine dans l'Agenda.

/** Combien de lignes suivent la chose mise en grand dans la carte du moment. */
export const ENSUITE_MAX = 3;

export interface Moment {
  /** La chose la plus pressée, mise en grand ; null quand rien n'attend (la carte reste graphite). */
  premiere: ChoseDuJour | null;
  /** Les suivantes, dans l'ordre : à cocher pour une tâche, à ouvrir sinon. */
  ensuite: ChoseDuJour[];
  /** Ce qui ne tient pas dans la carte. */
  autres: number;
  /** Le repas du soir : en grand quand rien n'attend, en ligne sinon. */
  menu: string | null;
  /** Les tâches cochées aujourd'hui. */
  faites: number;
}

/**
 * La carte du moment : ce qui attend aujourd'hui, et seulement cela. Les rendez-vous de demain
 * vont à la carte « Demain », la sauvegarde au pied de l'écran, et les poubelles ne s'y disent
 * que le soir venu, quand il faut les sortir (avant, « Demain » annonce la collecte).
 */
export function momentDuJour(carte: CarteDuJour, soir: boolean): Moment {
  const ici = carte.choses.filter((c) => !(c.cle.startsWith("agenda-") && c.quand.startsWith("demain")) && c.cle !== "sauvegarde" && (soir || c.cle !== "dechets"));
  const repas = ici.find((c) => c.cle === "chef-ce-soir") ?? null;
  const attend = ici.filter((c) => c.etat !== "calme" && c !== repas);
  const calmes = ici.filter((c) => c.etat === "calme");
  const premiere = attend[0] ?? null;
  const suite = premiere ? [...attend.slice(1), ...(repas ? [repas] : []), ...calmes] : calmes;
  return {
    premiere,
    ensuite: suite.slice(0, ENSUITE_MAX),
    autres: carte.autres + Math.max(0, suite.length - ENSUITE_MAX),
    menu: repas?.texte ?? null,
    faites: carte.faites,
  };
}

export interface Demain {
  /** « Vétérinaire de Mitsu, 17:30 ». */
  titre: string;
  /** Le reste de demain en une ligne : « Poubelles : papier et carton. 9° le matin. », ou null. */
  suite: string | null;
}

/**
 * La carte « Demain » : tout ce que demain apporte, une seule fois. Les rendez-vous d'abord,
 * puis la collecte des déchets (sauf le soir, où la carte du moment dit de les sortir), puis le
 * froid du matin. Rien de prévu ni à sortir : pas de carte.
 */
export function demainDuJour(e: { evenements: readonly { titre: string; heure: string | null }[]; dechets: readonly string[]; meteo: { min: number; pluie: number } | null; soir: boolean }): Demain | null {
  const lignes = [...e.evenements]
    .sort((a, b) => (a.heure ?? "99").localeCompare(b.heure ?? "99"))
    .map((o) => `${o.titre}${o.heure ? `, ${o.heure}` : ""}`);
  if (e.dechets.length && !e.soir) {
    const noms = e.dechets.map((n) => n.toLowerCase());
    lignes.push(`Poubelles : ${noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`}`);
  }
  if (!lignes.length) return null;
  const [titre, ...reste] = lignes;
  if (e.meteo) reste.push(`${Math.round(e.meteo.min)}° le matin${e.meteo.pluie >= 1 ? ", pluie" : ""}`);
  return { titre, suite: reste.length ? `${reste.join(". ")}.` : null };
}

/**
 * La remarque du jour de Tael (`remarqueDuJour`) redit-elle ce que la carte du moment montre déjà ?
 * Une tâche en retard qui est sur la carte, ou un produit « à finir aujourd'hui » : elle se tait.
 */
export function dejaSurLaCarte(cleRemarque: string, moment: Moment): boolean {
  const montrees = [moment.premiere, ...moment.ensuite].filter((c) => c !== null);
  if (cleRemarque.startsWith("tache:")) return montrees.some((c) => c.tacheId && cleRemarque.startsWith(`tache:${c.tacheId}:`));
  if (cleRemarque.startsWith("stock:")) return montrees.some((c) => c.cle.startsWith("stock-") && c.quand === "à finir aujourd'hui");
  return false;
}
