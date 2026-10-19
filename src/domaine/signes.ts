import { decrireJour, jourSemaine, NOMS_JOURS, resumeAgenda, titreDe, type Evenement } from "./agenda";
import { comptesAVenir, humeurDu, nomHumeur, type DocCouple } from "./bandeau";
import { gestesDuJardin, type Zone } from "./jardin";
import { decrireTemps, meteoDu, type Meteo } from "./meteo";
import { choseAFaire, type Animal } from "./mitsu";
import { ecartJours } from "./taches";
import type { Foyer, Id, Jour } from "./types";

// Les petits signes au bout de la ligne de la date, sur l'accueil. Chacun choisit les siens
// (trois au plus) par un appui long ; le choix reste sur le téléphone. Un signe sans rien à
// dire ne s'affiche pas. Le toucher fait parler la fée, ou ouvre la page qui va avec.

export type Signe = "humeurs" | "compte" | "rdv" | "meteo" | "mitsu";

export const SIGNES: readonly { id: Signe; nom: string; detail: string }[] = [
  { id: "humeurs", nom: "Nos humeurs", detail: "Ton humeur du jour et celle de l'autre" },
  { id: "compte", nom: "Compte à rebours", detail: "Le plus proche, en J−N" },
  { id: "rdv", nom: "Prochain rendez-vous", detail: "Dans les sept jours" },
  { id: "meteo", nom: "Météo", detail: "La température du jour à Renens" },
  { id: "mitsu", nom: "Mitsu", detail: "Seulement quand il y a quelque chose à faire" },
];

export const SIGNES_MAX = 3;
export const SIGNES_DE_DEPART: readonly Signe[] = ["humeurs", "compte"];

/** Relit le choix enregistré : seulement des signes connus, sans doublon, trois au plus. */
export function nettoyerSignes(brut: unknown): Signe[] {
  if (!Array.isArray(brut)) return [...SIGNES_DE_DEPART];
  const connus = new Set(SIGNES.map((s) => s.id));
  return [...new Set(brut.filter((x): x is Signe => connus.has(x as Signe)))].slice(0, SIGNES_MAX);
}

/** Coche ou décoche un signe ; au-delà de trois, rien ne change. */
export function basculerSigne(choisis: readonly Signe[], id: Signe): Signe[] {
  if (choisis.includes(id)) return choisis.filter((s) => s !== id);
  if (choisis.length >= SIGNES_MAX) return [...choisis];
  // Toujours dans l'ordre de la liste, pour que la ligne ne saute pas.
  return SIGNES.map((s) => s.id).filter((s) => s === id || choisis.includes(s));
}

export interface ValeurSigne {
  id: Signe;
  /** Ce qui s'affiche en petit : « J−12 », « 14:30 », « 11° ». Vide pour un signe en image seule. */
  court: string;
  /** Ce que la fée dit au toucher. */
  phrase: string;
  /** La page qui va avec. */
  destination: "mots" | "agenda" | "jardin" | "mitsu";
  /** Pour les humeurs : la mienne puis celle de l'autre (null : pas encore donnée). */
  humeurs?: (string | null)[];
  /** Pour la météo : le code du temps, qui choisit le petit dessin. */
  code?: number;
  /** Quelque chose presse (Mitsu, gel) : le signe passe à la couleur de l'urgent. */
  urgent?: boolean;
}

export interface DonneesSignes {
  foyer: Foyer;
  membreId: Id | null;
  aujourdhui: Jour;
  couple: readonly DocCouple[];
  evenements: readonly Evenement[];
  animaux: readonly Animal[];
  zones: readonly Zone[];
  meteo: Meteo | null;
  /** L'heure du téléphone, « HH:MM » : un rendez-vous passé aujourd'hui n'est plus le prochain. */
  heure?: string;
}

const minuscule = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** Ce que montre et dit un signe aujourd'hui ; null s'il n'a rien à dire. */
export function valeurSigne(id: Signe, d: DonneesSignes): ValeurSigne | null {
  if (id === "humeurs") {
    const moi = d.foyer.membres.find((m) => m.id === d.membreId) ?? null;
    const autre = d.foyer.membres.find((m) => m.id !== d.membreId) ?? null;
    const mienne = moi ? (humeurDu(d.couple, moi.id, d.aujourdhui)?.emoji ?? null) : null;
    const sienne = autre ? (humeurDu(d.couple, autre.id, d.aujourdhui)?.emoji ?? null) : null;
    const sa = autre && sienne ? `${autre.prenom} : ${minuscule(nomHumeur(sienne))}.` : null;
    const phrase = mienne
      ? [sa, `Toi : ${minuscule(nomHumeur(mienne))}.`].filter(Boolean).join(" ")
      : `${sa ? `${sa} Et toi, comment` : "Comment"} tu te sens aujourd'hui ?`;
    return { id, court: "", phrase, destination: "mots", humeurs: [mienne, autre ? sienne : null] };
  }

  if (id === "compte") {
    const c = comptesAVenir(d.couple, d.aujourdhui)[0];
    if (!c) return null;
    const n = ecartJours(d.aujourdhui, c.jour);
    const quand = n === 0 ? "c'est aujourd'hui" : n === 1 ? "c'est demain" : `dans ${n} jours, ${minuscule(decrireJour(c.jour, d.aujourdhui))}`;
    return { id, court: n === 0 ? "Jour J" : `J−${n}`, phrase: `${c.titre} : ${quand}${quand.endsWith(".") ? "" : "."}`, destination: "mots" };
  }

  if (id === "rdv") {
    const { aujourdhui, semaine } = resumeAgenda(d.evenements, d.animaux, d.aujourdhui);
    const aVenir = aujourdhui.filter((o) => !o.evenement.heure || !d.heure || o.evenement.heure >= d.heure);
    // Le prochain du foyer, qu'il soit pour moi, pour l'autre ou pour nous deux.
    const prochain = [...aVenir, ...semaine][0];
    if (!prochain) return null;
    const ecart = ecartJours(d.aujourdhui, prochain.debut);
    const heure = prochain.evenement.heure;
    const court = ecart <= 0 ? (heure ?? "Auj.") : ecart === 1 ? "Demain" : `${NOMS_JOURS[jourSemaine(prochain.debut)].slice(0, 3)}.`;
    const pour = d.foyer.membres.find((m) => m.id === prochain.evenement.pour)?.prenom;
    const quand = `${ecart <= 0 ? "Aujourd'hui" : decrireJour(prochain.debut, d.aujourdhui)}${heure ? ` à ${heure}` : ""}`;
    return { id, court, phrase: `${quand} : ${minuscule(titreDe(prochain))}${pour ? ` (${pour})` : ""}.`, destination: "agenda" };
  }

  if (id === "meteo") {
    const jour = meteoDu(d.meteo, d.aujourdhui);
    if (!jour) return null;
    const gel = gestesDuJardin(d.zones, d.meteo, d.aujourdhui).find((g) => g.urgent && g.texte.startsWith("Gel"));
    const phrase = `${decrireTemps(jour.code)}, ${Math.round(jour.min)}° à ${Math.round(jour.max)}°.${gel ? ` ${gel.texte}.` : ""}`;
    return { id, court: `${Math.round(jour.max)}°`, phrase, destination: "jardin", code: jour.code, urgent: !!gel };
  }

  // Mitsu : seulement quand il y a un geste à faire.
  for (const a of d.animaux) {
    const aFaire = choseAFaire(a, d.aujourdhui)[0];
    if (aFaire) return { id, court: "", phrase: `${a.nom} : ${minuscule(aFaire.texte)}.`, destination: "mitsu", urgent: aFaire.urgent };
  }
  return null;
}

/** Les signes choisis qui ont quelque chose à montrer, dans l'ordre. */
export function signesDuJour(choisis: readonly Signe[], d: DonneesSignes): ValeurSigne[] {
  return choisis.map((id) => valeurSigne(id, d)).filter((v): v is ValeurSigne => v !== null);
}
