import type { Synchro } from "../donnees/synchro";

/** Ce dont la planification a besoin du navigateur ; remplaçable dans les tests. */
export interface Environnement {
  visible(): boolean;
  ecouter(evenement: "visibilitychange" | "online", rappel: () => void): () => void;
}

export const environnementNavigateur: Environnement = {
  visible: () => document.visibilityState === "visible",
  ecouter(evenement, rappel) {
    const cible = evenement === "online" ? window : document;
    cible.addEventListener(evenement, rappel);
    return () => cible.removeEventListener(evenement, rappel);
  },
};

export const DELAI_APRES_MODIFICATION = 1500;
export const INTERVALLE = 30_000;

/**
 * Quand synchroniser : à l'ouverture, au retour dans l'app, au retour du réseau,
 * peu après chaque modification faite ici, et toutes les 30 secondes tant que l'app est à l'écran.
 */
export function planifierSynchro(
  synchro: Synchro,
  depot: { abonner(rappel: () => void): () => void; lireEnAttente(): Promise<unknown[]> },
  env: Environnement = environnementNavigateur,
): () => void {
  const lancer = () => void synchro.synchroniser();
  const siVisible = () => env.visible() && lancer();
  let attente: ReturnType<typeof setTimeout> | undefined;

  void synchro.demarrer().then(lancer);
  const arrets = [
    env.ecouter("visibilitychange", siVisible),
    env.ecouter("online", lancer),
    depot.abonner(() => {
      clearTimeout(attente);
      attente = setTimeout(async () => {
        // Les modifications reçues de l'autre téléphone préviennent aussi : rien à envoyer, rien à faire.
        if ((await depot.lireEnAttente()).length > 0) lancer();
      }, DELAI_APRES_MODIFICATION);
    }),
  ];
  const minuterie = setInterval(siVisible, INTERVALLE);

  return () => {
    clearTimeout(attente);
    clearInterval(minuterie);
    arrets.forEach((arreter) => arreter());
  };
}
