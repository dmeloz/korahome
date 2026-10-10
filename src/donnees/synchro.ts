import { curseurAvecMarge, fusionner } from "../domaine/synchro";
import type { Id } from "../domaine/types";
import type { StockageSynchro } from "./depotLocal";
import type { Distant } from "./distant";

export type StatutSynchro =
  | { etat: "inactif" }
  | { etat: "en_cours"; derniere: string | null }
  | { etat: "ok"; derniere: string | null }
  | { etat: "erreur"; derniere: string | null; message: string };

export interface Synchro {
  statut(): StatutSynchro;
  abonner(rappel: () => void): () => void;
  /** Lit au démarrage l'état enregistré sur ce téléphone. */
  demarrer(): Promise<void>;
  /** Reçoit puis envoie. Un seul passage à la fois ; un appel pendant un passage attend celui-ci. */
  synchroniser(): Promise<void>;
  /** Ce téléphone ouvre le partage : tout ce qu'il contient part sur le serveur. */
  partager(foyerId: Id): Promise<void>;
  /** Ce téléphone rejoint un foyer : ses données sont remplacées par celles du foyer. */
  rejoindre(foyerId: Id): Promise<void>;
  /** Reconnexion à un foyer déjà partagé : les modifications de chacun sont fusionnées. */
  reprendre(foyerId: Id): Promise<void>;
  /** Déconnexion : les données restent sur le téléphone, la synchro s'arrête. */
  arreter(): Promise<void>;
}

/** Message lisible pour l'écran Partage. */
export function expliquerErreur(erreur: unknown): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "Pas de connexion internet.";
  return erreur instanceof Error && erreur.message ? erreur.message : "La synchronisation a échoué.";
}

export function creerSynchro(
  local: StockageSynchro,
  distant: Distant,
  horloge: () => string = () => new Date().toISOString(),
): Synchro {
  let statut: StatutSynchro = { etat: "inactif" };
  let enCours: Promise<void> | null = null;
  const abonnes = new Set<() => void>();
  const changer = (s: StatutSynchro) => {
    statut = s;
    abonnes.forEach((r) => r());
  };
  const derniere = () => (statut.etat === "inactif" ? null : statut.derniere);

  async function passage(): Promise<void> {
    const etat = await local.lireEtat();
    if (!etat) return changer({ etat: "inactif" });
    changer({ etat: "en_cours", derniere: etat.derniere });
    try {
      const lu = await distant.lire(etat.foyerId, curseurAvecMarge(etat.curseur));
      const { aAppliquer } = fusionner(await local.lireEnAttente(), lu.changements);
      await local.appliquer(aAppliquer);
      // Relu après l'application : ce qui a été modifié ici pendant la lecture part aussi.
      const aEnvoyer = await local.lireEnAttente();
      if (aEnvoyer.length > 0) {
        await distant.envoyer(etat.foyerId, aEnvoyer);
        await local.retirerEnAttente(aEnvoyer);
      }
      const fini = { foyerId: etat.foyerId, curseur: lu.curseur ?? etat.curseur, derniere: horloge() };
      await local.enregistrerEtat(fini);
      changer({ etat: "ok", derniere: fini.derniere });
    } catch (erreur) {
      changer({ etat: "erreur", derniere: etat.derniere, message: expliquerErreur(erreur) });
    }
  }

  function synchroniser(): Promise<void> {
    enCours ??= passage().finally(() => {
      enCours = null;
    });
    return enCours;
  }

  /** Attend le passage en cours avant de changer de foyer, pour ne rien mélanger. */
  async function apres(action: () => Promise<void>) {
    await enCours;
    await action();
  }

  return {
    statut: () => statut,
    abonner(rappel) {
      abonnes.add(rappel);
      return () => abonnes.delete(rappel);
    },
    async demarrer() {
      const etat = await local.lireEtat();
      changer(etat ? { etat: "ok", derniere: etat.derniere } : { etat: "inactif" });
    },
    synchroniser,
    partager: (foyerId) =>
      apres(async () => {
        await local.toutMettreEnAttente();
        await local.enregistrerEtat({ foyerId, curseur: null, derniere: null });
        await synchroniser();
      }),
    rejoindre: (foyerId) =>
      apres(async () => {
        changer({ etat: "en_cours", derniere: null });
        const lu = await distant.lire(foyerId, null).catch((erreur) => {
          changer({ etat: "inactif" });
          throw erreur;
        });
        await local.remplacerTout(lu.changements);
        const etat = { foyerId, curseur: lu.curseur, derniere: horloge() };
        await local.enregistrerEtat(etat);
        changer({ etat: "ok", derniere: etat.derniere });
      }),
    reprendre: (foyerId) =>
      apres(async () => {
        await local.enregistrerEtat({ foyerId, curseur: null, derniere: derniere() });
        await synchroniser();
      }),
    arreter: () =>
      apres(async () => {
        await local.enregistrerEtat(null);
        changer({ etat: "inactif" });
      }),
  };
}
