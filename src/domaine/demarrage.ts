import type { Foyer, Id, Tache } from "./types";

// L'arrivée sur un nouveau téléphone, guidée de bout en bout : la visite explique l'accueil,
// mais pas les réglages qui font marcher Kora. Une carte « Prête en 5 étapes » se coche seule
// à mesure (installer, choisir sa personne, partager, notifications, sa fée dans Siri) ; la
// sixième, une première tâche à soi, montre que c'est parti. Elle disparaît quand tout est
// fait, ou quand on la range.

export type EtapeDemarrageId = "installer" | "personne" | "partage" | "notifications" | "siri" | "tache";

export interface EtapeDemarrage {
  id: EtapeDemarrageId;
  titre: string;
  detail: string;
  faite: boolean;
  /** Où le toucher mène ; null quand il n'y a rien à ouvrir (l'installation se fait dans Safari). */
  ou: "telephone" | "partage" | "notifications" | "siri" | "taches" | null;
}

export interface EtatDemarrage {
  /** L'app est sur l'écran d'accueil de l'iPhone (pas dans Safari). */
  installee: boolean;
  membreId: Id | null;
  partageActif: boolean;
  /** Les rappels sont inscrits sur ce téléphone. */
  notifications: boolean;
  siriRelie: boolean;
  foyer: Pick<Foyer, "membres">;
  taches: readonly Tache[];
  fee: string;
}

export function etapesDemarrage(etat: EtatDemarrage): EtapeDemarrage[] {
  const moi = etat.foyer.membres.find((m) => m.id === etat.membreId) ?? null;
  const aUneTache = !!moi && etat.taches.some((t) => t.responsable === moi.id || t.faitePar === moi.id);
  return [
    { id: "installer", titre: "Kora sur l'écran d'accueil", detail: "Dans Safari : Partager, puis « Sur l'écran d'accueil ». Sans ça, pas de notifications.", faite: etat.installee, ou: null },
    { id: "personne", titre: "Dire qui utilise ce téléphone", detail: moi ? `C'est ${moi.prenom}.` : "Pour que les tâches, les mots et les rappels soient les tiens.", faite: !!moi, ou: "telephone" },
    { id: "partage", titre: "Relier les deux iPhone", detail: "Avec le code du foyer : ce que l'un change arrive chez l'autre.", faite: etat.partageActif, ou: "partage" },
    { id: "notifications", titre: "Allumer les rappels", detail: "Le matin, et à l'heure des tâches.", faite: etat.notifications, ou: "notifications" },
    { id: "siri", titre: `${etat.fee} dans Siri`, detail: `« Dis Siri, ${etat.fee} » pour ajouter aux courses sans ouvrir l'app.`, faite: etat.siriRelie, ou: "siri" },
    { id: "tache", titre: "Prendre une première tâche", detail: "Choisis-en une dans Tâches : c'est parti.", faite: aUneTache, ou: "taches" },
  ];
}

export const nombreFaites = (etapes: readonly EtapeDemarrage[]) => etapes.filter((e) => e.faite).length;

/** La carte se montre tant qu'il reste une étape, et qu'on ne l'a pas rangée. */
export function carteDemarrageVisible(etapes: readonly EtapeDemarrage[], rangee: boolean): boolean {
  return !rangee && nombreFaites(etapes) < etapes.length;
}

/** « Prête en 2 étapes » … « Kora est prête ». */
export function titreDemarrage(etapes: readonly EtapeDemarrage[]): string {
  const restantes = etapes.length - nombreFaites(etapes);
  if (restantes === 0) return "Kora est prête";
  return restantes === 1 ? "Prête dans une étape" : `Prête en ${restantes} étapes`;
}
