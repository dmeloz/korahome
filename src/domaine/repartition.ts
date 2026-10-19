import { decaler, ecartJours, estTerminee } from "./taches";
import type { Foyer, Id, Jour, Tache } from "./types";

// Les tâches de la semaine, posées sur des jours différents plutôt que toutes le même
// jour (six tâches dues lundi, c'est une alarme pour rien). Et le dimanche, on se
// répartit la semaine à deux : Kora propose, chacun change ce qu'il veut.

const plusJours = (jour: Jour, n: number) => decaler(jour, { unite: "jour", tous: n });
const hebdomadaire = (t: Tache) => !estTerminee(t) && t.categorie !== "entretien" && t.recurrence?.unite === "semaine" && t.recurrence.tous === 1;

/**
 * Les nouvelles dates proposées quand plusieurs tâches de la semaine tombent le même jour.
 * Chaque tâche garde son jour s'il est libre ; sinon elle va au jour le moins chargé des
 * sept qui viennent. Rien n'est proposé quand la semaine est déjà étalée.
 */
export function etalementPropose(taches: readonly Tache[], aujourdhui: Jour): { tache: Tache; echeance: Jour }[] {
  const fin = plusJours(aujourdhui, 6);
  const aEtaler = taches
    .filter((t) => hebdomadaire(t) && t.echeance <= fin)
    .sort((a, b) => a.echeance.localeCompare(b.echeance) || a.titre.localeCompare(b.titre, "fr"));
  const parJour = new Map<Jour, number>();
  for (const t of aEtaler) {
    const j = t.echeance < aujourdhui ? aujourdhui : t.echeance;
    parJour.set(j, (parJour.get(j) ?? 0) + 1);
  }
  if (![...parJour.values()].some((n) => n > 1)) return [];

  const jours = Array.from({ length: 7 }, (_, i) => plusJours(aujourdhui, i));
  const charge = new Map(jours.map((j) => [j, 0]));
  // Les autres tâches de la semaine pèsent aussi sur leur jour.
  for (const t of taches) {
    if (!estTerminee(t) && !aEtaler.includes(t) && charge.has(t.echeance)) charge.set(t.echeance, charge.get(t.echeance)! + 1);
  }
  const changements: { tache: Tache; echeance: Jour }[] = [];
  for (const t of aEtaler) {
    const sien = t.echeance < aujourdhui ? aujourdhui : t.echeance;
    let choisi = sien;
    if (charge.get(sien)! > 0) {
      choisi = jours.reduce((meilleur, j) => (charge.get(j)! < charge.get(meilleur)! ? j : meilleur), jours[0]);
    }
    charge.set(choisi, charge.get(choisi)! + 1);
    if (choisi !== t.echeance) changements.push({ tache: t, echeance: choisi });
  }
  return changements;
}

export function appliquerEtalement(changements: readonly { tache: Tache; echeance: Jour }[]): Tache[] {
  return changements.map(({ tache, echeance }) => ({ ...tache, echeance }));
}

/** Le dimanche, une fois, quand le foyer est à deux et que la semaine a des tâches. */
export function repartitionDue(foyer: Foyer, taches: readonly Tache[], aujourdhui: Jour, derniere: Jour | null): boolean {
  if (foyer.membres.length < 2 || derniere === aujourdhui) return false;
  const [a, m, j] = aujourdhui.split("-").map(Number);
  if (new Date(Date.UTC(a, m - 1, j)).getUTCDay() !== 0) return false;
  return tachesDeLaSemaine(taches, aujourdhui).length > 0;
}

/** Ce qui est à faire de demain à dimanche prochain (et ce qui traîne). */
export function tachesDeLaSemaine(taches: readonly Tache[], aujourdhui: Jour): Tache[] {
  const fin = plusJours(aujourdhui, 7);
  return taches
    .filter((t) => !estTerminee(t) && t.echeance <= fin && (t.categorie !== "entretien" || ecartJours(aujourdhui, t.echeance) <= 7))
    .sort((a, b) => a.echeance.localeCompare(b.echeance) || a.titre.localeCompare(b.titre, "fr"));
}

/**
 * Une proposition équilibrée : chacun le même nombre de tâches, en tenant compte de qui
 * l'a faite la dernière fois (on alterne), sans toucher à ce que quelqu'un a déjà pris.
 */
export function proposerRepartition(taches: readonly Tache[], foyer: Foyer, aujourdhui: Jour): Map<Id, Id> {
  const membres = foyer.membres.map((m) => m.id);
  const compte = new Map(membres.map((id) => [id, 0]));
  const semaine = tachesDeLaSemaine(taches, aujourdhui);
  for (const t of semaine) if (t.responsable && compte.has(t.responsable)) compte.set(t.responsable, compte.get(t.responsable)! + 1);
  const choix = new Map<Id, Id>();
  for (const t of semaine) {
    if (t.responsable && compte.has(t.responsable)) {
      choix.set(t.id, t.responsable);
      continue;
    }
    const min = Math.min(...compte.values());
    const libres = membres.filter((id) => compte.get(id) === min);
    // À égalité, celui qui ne l'a pas faite la dernière fois.
    const dernier = t.historique?.[t.historique.length - 1]?.par ?? t.faitePar;
    const pour = libres.find((id) => id !== dernier) ?? libres[0];
    choix.set(t.id, pour);
    compte.set(pour, compte.get(pour)! + 1);
  }
  return choix;
}

/** Les tâches dont la personne change, prêtes à enregistrer. */
export function appliquerRepartition(taches: readonly Tache[], choix: ReadonlyMap<Id, Id | null>): Tache[] {
  return taches.filter((t) => choix.has(t.id) && choix.get(t.id) !== t.responsable).map((t) => ({ ...t, responsable: choix.get(t.id) ?? null }));
}

/** « Melo 3 · Sarah 3 » : le compte de la proposition. */
export function compteRepartition(choix: ReadonlyMap<Id, Id | null>, foyer: Foyer): string {
  return foyer.membres.map((m) => `${m.prenom} ${[...choix.values()].filter((v) => v === m.id).length}`).join(" · ");
}
