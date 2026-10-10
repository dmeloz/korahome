// Mises à jour de l'app installée, comme dans Sanji : quand une nouvelle version
// est téléchargée, un bandeau propose « Mettre à jour » ; dans les Réglages, un
// bouton demande au navigateur d'aller chercher la dernière version. L'app vérifie
// aussi toute seule (au retour dans l'app et toutes les 30 minutes) : une pastille
// rouge s'allume dès qu'une version attend.

export type ResultatVerification = "a_jour" | "en_cours" | "indisponible";

export const MESSAGES_VERIFICATION: Record<ResultatVerification, string> = {
  a_jour: "Kora est à jour.",
  en_cours: "Une nouvelle version arrive : le bandeau « Mettre à jour » va s'afficher.",
  indisponible: "Impossible de vérifier pour l'instant (réseau ou Mac éteint).",
};

/** Ce que l'app utilise de l'inscription du service worker. */
export interface Inscription {
  update(): Promise<unknown>;
  installing: unknown;
  waiting: unknown;
}

/** Les options que reçoit `registerSW` de vite-plugin-pwa (la partie utilisée ici). */
export interface OptionsEnregistrement {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onRegisteredSW?: (url: string, inscription: Inscription | undefined) => void;
}

export interface MiseAJour {
  /** Vrai quand une nouvelle version attend d'être appliquée. */
  prete(): boolean;
  abonner(ecouteur: () => void): () => void;
  /** Applique la nouvelle version et recharge l'app. */
  appliquer(): Promise<void>;
  verifier(): Promise<ResultatVerification>;
}

/**
 * `enregistrer` = registerSW de vite-plugin-pwa. `apresChangement` reçoit de quoi
 * recharger la page dès que la nouvelle version prend la main (comme Sanji), au cas
 * où le rechargement prévu par le plugin ne se ferait pas.
 */
export function creerMiseAJour(
  enregistrer: (options: OptionsEnregistrement) => (recharger?: boolean) => Promise<void>,
  apresChangement: (recharger: () => void) => void = () => {},
  recharger: () => void = () => {},
): MiseAJour {
  let prete = false;
  let inscription: Inscription | undefined;
  const ecouteurs = new Set<() => void>();

  const appliquerSW = enregistrer({
    immediate: true,
    onNeedRefresh() {
      prete = true;
      for (const e of ecouteurs) e();
    },
    onRegisteredSW(_url, i) {
      inscription = i;
    },
  });

  return {
    prete: () => prete,
    abonner(ecouteur) {
      ecouteurs.add(ecouteur);
      return () => ecouteurs.delete(ecouteur);
    },
    async appliquer() {
      let fait = false;
      apresChangement(() => {
        if (fait) return;
        fait = true;
        recharger();
      });
      await appliquerSW(true);
    },
    async verifier() {
      if (prete) return "en_cours";
      if (!inscription) return "indisponible";
      try {
        await inscription.update();
        return inscription.installing || inscription.waiting ? "en_cours" : "a_jour";
      } catch {
        return "indisponible";
      }
    },
  };
}

/** Vérification automatique : toutes les 30 minutes tant que l'app est ouverte… */
export const INTERVALLE_VERIFICATION = 30 * 60_000;
/** …et au retour dans l'app, au plus une fois par minute. */
export const ECART_MIN_VERIFICATION = 60_000;

/**
 * Sur iPhone, une app de l'écran d'accueil reprend là où elle était sans se recharger :
 * sans ces vérifications, une nouvelle version passerait inaperçue des jours entiers.
 */
export function surveillerMisesAJour(
  maj: Pick<MiseAJour, "prete" | "verifier">,
  auRetour: (rappel: () => void) => void,
  repeter: (rappel: () => void, ms: number) => void,
  maintenant: () => number = Date.now,
): void {
  let derniere = maintenant();
  const verifier = () => {
    if (maj.prete() || maintenant() - derniere < ECART_MIN_VERIFICATION) return;
    derniere = maintenant();
    void maj.verifier();
  };
  auRetour(verifier);
  repeter(verifier, INTERVALLE_VERIFICATION);
}
