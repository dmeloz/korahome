// Tout ce que Kora garde sur ce téléphone seulement, jamais synchronisé ni envoyé : les
// réglages de chacun, ce que la fée a déjà dit, quelques caches. C'est le seul accès au
// `localStorage` de l'app (la session Supabase, « korahome.session », est gérée par sa
// bibliothèque dans src/donnees/supabase.ts).
//
// Chaque fonction avale les erreurs du stockage (navigation privée, stockage plein) et rend
// la valeur de repli : un réglage qui ne s'enregistre pas vaut alors pour cette visite.

/** Les clés gardées sur le téléphone. Ne jamais en changer le texte : les téléphones les ont déjà. */
export const CLES = {
  // ----- L'appareil -----
  /** Qui utilise ce téléphone (id du membre). */
  membreCourant: "korahome.membreCourant",
  /** Le thème choisi : « sombre » ou « clair » (absent = Auto). */
  theme: "korahome.theme",
  /** « masquee » quand la pastille « Dev » est cachée sur ce téléphone. */
  pastilleDev: "korahome.coinDev",
  /** Le journal discret des retours de test (JSON, 14 jours). */
  journal: "korahome.journal",
  /** « 1 » une fois la visite guidée de l'accueil vue ou passée. */
  visiteVue: "korahome.visite.vue",
  /** « 1 » quand la carte « Prête en 5 étapes » de l'accueil a été rangée (« Plus tard »). */
  demarrageRange: "korahome.demarrage.range",
  /** Préfixe des petites aides de page déjà rangées (« korahome.aide.<page> » = « 1 »). */
  prefixeAide: "korahome.aide.",
  /** La version dont la fée a déjà annoncé la nouveauté sur ce téléphone (0.0.79). */
  nouveauteVue: "korahome.nouveaute.vue",

  // ----- L'accueil -----
  /** L'ordre des widgets de l'accueil (JSON). */
  tableauDeBord: "korahome.tableauDeBord",
  /** La taille de chaque widget (JSON) ; « .2 » depuis 0.0.23, les anciennes tailles sont oubliées. */
  taillesWidgets: "korahome.taillesWidgets.2",
  /** La place et la taille de la grande date (JSON). */
  date: "korahome.date",
  /** Les petits signes choisis sous la date (JSON). */
  signes: "korahome.signes",
  /** L'intensité du verre des widgets, de 0 à 100 (JSON). */
  verre: "korahome.verre",
  /** Les cartes retirées des piles « En ce moment » de l'accueil (JSON, depuis 0.0.72). */
  cartesRetirees: "korahome.accueil.retirees",
  /** Combien de fois « Glisse quand c'est fait » s'est montré, et si le geste a été fait (JSON). */
  indiceGlisse: "korahome.accueil.indiceGlisse",

  // ----- La fée -----
  /** Où elle se tient : côté, hauteur, rangée (JSON). */
  placeFee: "korahome.fee",
  /** « 1 » quand son tintement est allumé. */
  feeSon: "korahome.feeSon",
  /** « micro » ou « clavier » : comment on parle à la fée d'un toucher (absent : selon l'appareil). */
  feeParole: "korahome.feeParole",
  /** Les bulles renvoyées d'un toucher, pour apprendre sa discrétion (JSON). */
  feeRenvois: "korahome.feeRenvois",
  /** Les heures où elle a déjà dit qu'elle se tairait (JSON). */
  feeDiscreteDit: "korahome.feeDiscreteDit",
  /** Les mots et cœurs de l'autre déjà vus (JSON). */
  feeVues: "korahome.feeVues",
  /** Les alertes déjà signalées aujourd'hui (JSON, jour et clés). */
  feeAlertes: "korahome.feeAlertes",
  /** Les heures de tâches déjà dites aujourd'hui (JSON, jour et clés). */
  feeHeures: "korahome.feeHeures",
  /** Les rituels déjà faits aujourd'hui, jour J compris (JSON, jour et clés). */
  feeRituels: "korahome.feeRituels",
  /** Les courses déjà vues, pour repérer celles que l'autre ajoute (JSON). */
  feeCoursesVues: "korahome.feeCoursesVues",
  /** Quand elle a parlé des courses de l'autre pour la dernière fois (millisecondes). */
  feeCoursesDit: "korahome.feeCoursesDit",
  /** Le jour où ce téléphone a demandé le clin d'œil du jour. */
  clinDemande: "korahome.clinDemande",
  /** Le jour où la fée a dit le clin d'œil du jour. */
  clinVu: "korahome.clinVu",

  // ----- Ce que Kora apprend de cette personne -----
  /** Les gestes notés : widgets ouverts, heure des tâches faites (JSON). */
  usage: "korahome.usage",
  /** Les décisions du bilan pour ce qui est personnel (JSON). */
  decisionsPerso: "korahome.appris",
  /** Le jour du dernier bilan du dimanche vu (JSON). */
  dernierBilan: "korahome.dernierBilan",
  /** Ce que la personne laisse Kora faire (JSON). */
  adaptations: "korahome.adaptations",
  /** La remarque du jour déjà montrée, et si elle a été fermée (JSON). */
  remarque: "korahome.remarque",

  // ----- Les pages -----
  /** Les préférences des rappels du matin (JSON). */
  rappels: "korahome.rappels",
  /** La météo du jardin lue chez Open-Meteo, en cache (JSON). */
  meteo: "korahome.meteo",
  /** Le jour de la dernière sauvegarde du foyer. */
  derniereSauvegarde: "korahome.derniereSauvegarde",
  /** Le dernier dimanche où la semaine a été répartie. */
  derniereRepartition: "korahome.derniereRepartition",
  /** L'adresse et le nom du raccourci Siri de cet iPhone (JSON). */
  siri: "korahome.siri",
  /** La dernière réponse du conseiller budget (JSON). */
  conseillerBudget: "korahome.conseillerBudget",
  /** L'adresse du raccourci des paiements Apple Pay de cet iPhone. */
  lienPaiements: "korahome.lienPaiements",
  /** « 1 » quand l'invitation Apple Pay a été écartée. */
  applePayVu: "korahome.applePayVu",
  /** L'identifiant de la clé Face ID qui verrouille le Budget sur ce téléphone (base64). */
  verrouBudget: "korahome.verrouBudget",
} as const;

/** Le texte gardé, null s'il n'y en a pas ; `siIndisponible` (null par défaut) si le stockage ne répond pas. */
export function lireTexte(cle: string): string | null;
export function lireTexte<D>(cle: string, siIndisponible: D): string | null | D;
export function lireTexte<D>(cle: string, siIndisponible: D | null = null): string | null | D {
  try {
    return localStorage.getItem(cle);
  } catch {
    return siIndisponible;
  }
}

/** Garde un texte. Rend false si le stockage l'a refusé. */
export function ecrireTexte(cle: string, valeur: string): boolean {
  try {
    localStorage.setItem(cle, valeur);
    return true;
  } catch {
    return false;
  }
}

/**
 * La valeur JSON gardée, ou `defaut` si la clé est absente, illisible ou le stockage indisponible.
 * La valeur n'est pas vérifiée : à l'appelant de la nettoyer.
 */
export function lireJson<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(cle);
    return brut === null ? defaut : (JSON.parse(brut) as T);
  } catch {
    return defaut;
  }
}

/** Garde une valeur en JSON. Rend false si le stockage l'a refusée. */
export function ecrireJson(cle: string, valeur: unknown): boolean {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false;
  }
}

/** Oublie une clé. Rend false si le stockage ne répond pas. */
export function effacer(cle: string): boolean {
  try {
    localStorage.removeItem(cle);
    return true;
  } catch {
    return false;
  }
}

/** Oublie toutes les clés qui commencent par `prefixe`. */
export function effacerPrefixe(prefixe: string): void {
  try {
    for (const cle of Object.keys(localStorage)) if (cle.startsWith(prefixe)) localStorage.removeItem(cle);
  } catch {
    // Stockage indisponible : rien à oublier.
  }
}
