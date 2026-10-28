// Ce que la fonction serveur « jarvis » a besoin de savoir : le modèle, son coût et le
// plafond du foyer, les outils et les consignes, la forme de la demande. Sans aucune
// dépendance : `npm run fonction` le copie tel quel dans supabase/functions/jarvis/domaine.js.

import type { Jour } from "./types";

export { noteServeur, phrasePanne } from "./panne";

// ----- Le modèle et son coût -----

/** Un modèle léger et rapide : les demandes du quotidien sont courtes. */
export const MODELE_JARVIS = "claude-haiku-5-5";
/** Le conseil du dimanche demande plus de réflexion : un modèle plus capable, une fois par semaine. */
export const MODELE_CONSEIL = "claude-sonnet-5-5";
export type ModeleJarvis = typeof MODELE_JARVIS | typeof MODELE_CONSEIL;
/** Prix des modèles, en dollars par million de jetons (entrée, sortie). */
const PRIX_USD_PAR_MILLION: Record<ModeleJarvis, { entree: number; sortie: number }> = {
  "claude-haiku-5-5": { entree: 0.1, sortie: 0.5 },
  "claude-sonnet-5-5": { entree: 2, sortie: 10 },
};
/** Conversion prudente : un dollar compte pour 0,90 CHF (il en vaut un peu moins). */
const CHF_PAR_USD = 0.9;
/** Le plafond choisi par Melo : 5 CHF par mois pour tout le foyer. */
export const PLAFOND_CHF = 5;
/** À partir de 80 % du plafond, Jarvis prévient. */
const SEUIL_ALERTE = 0.8;

export interface Consommation {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** Le coût d'une demande, en millionièmes de franc (un entier, pour additionner sans erreur d'arrondi). */
export function coutMicroChf(u: Consommation, modele: ModeleJarvis = MODELE_JARVIS): number {
  const prix = PRIX_USD_PAR_MILLION[modele];
  const entree = u.input_tokens + 1.25 * (u.cache_creation_input_tokens ?? 0) + 0.1 * (u.cache_read_input_tokens ?? 0);
  const usd = (entree * prix.entree + u.output_tokens * prix.sortie) / 1e6;
  // Arrondi au millionième d'abord : les virgules flottantes ne comptent pas un micro-franc de trop.
  return Math.ceil(Math.round(usd * CHF_PAR_USD * 1e9) / 1e3);
}

export interface EtatBudget {
  depenseChf: number;
  plafondChf: number;
  /** Plus de 80 % du plafond : Jarvis le signale. */
  alerte: boolean;
  /** Plafond atteint : Jarvis se tait jusqu'au mois suivant. */
  atteint: boolean;
}

export function etatBudget(microChf: number, plafondChf = PLAFOND_CHF): EtatBudget {
  const depenseChf = microChf / 1e6;
  return {
    depenseChf,
    plafondChf,
    alerte: depenseChf >= plafondChf * SEUIL_ALERTE,
    atteint: depenseChf >= plafondChf,
  };
}

/** « 0,42 CHF » */
export function formaterChf(chf: number): string {
  return `${chf.toFixed(2).replace(".", ",")} CHF`;
}

/** Le mois en cours, « AAAA-MM » : le compteur repart à zéro chaque mois. */
export function moisDe(jour: Jour): string {
  return jour.slice(0, 7);
}

// ----- Ce que Jarvis sait faire -----

const texte = (description: string) => ({ type: "string", description });
const ouNul = (description: string) => ({ type: ["string", "null"], description });

/**
 * L'API compile les outils stricts en une grammaire dont la taille est plafonnée : au-delà,
 * toute la demande est refusée (« compiled grammar is too large », Tael muet le 25 octobre 2026
 * avec 20 outils stricts). Seuls les six outils les plus courants et les plus simples restent
 * stricts ; les autres sont vérifiés par lireActions avant d'être appliqués. Garde-fous : au plus
 * MAX_OUTILS_STRICTS outils stricts et MAX_UNIONS_STRICTES champs « ou null » entre eux.
 */
export const MAX_OUTILS_STRICTS = 6;
export const MAX_UNIONS_STRICTES = 16;

/** Les outils proposés au modèle (format de l'API Claude). */
export const OUTILS_JARVIS = [
  {
    name: "ajouter_courses",
    description: "Ajoute des articles à la liste de courses du foyer. Un article déjà sur la liste n'est pas ajouté deux fois.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["articles"],
      properties: {
        articles: {
          type: "array",
          items: texte("Un article avec sa quantité éventuelle, comme on l'écrirait sur la liste : « lait », « 2 kg de pommes »."),
        },
      },
    },
  },
  {
    name: "cocher_courses",
    description: "Coche des articles de la liste de courses : ils ont été achetés ou ne sont plus utiles.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["articles"],
      properties: { articles: { type: "array", items: texte("Le nom de l'article tel qu'il figure sur la liste.") } },
    },
  },
  {
    name: "ajouter_tache",
    description: "Crée une tâche de la maison, unique ou qui revient.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["titre", "echeance", "responsable", "frequence"],
      properties: {
        titre: texte("Le nom court de la tâche : « Sortir les poubelles »."),
        echeance: texte("Le jour où la faire, AAAA-MM-JJ."),
        responsable: ouNul("Le prénom de la personne qui s'en charge ; null si la tâche reste libre."),
        frequence: {
          type: ["object", "null"],
          description: "Pour une tâche qui revient : tous les N jours, semaines ou mois. null pour une tâche unique.",
          additionalProperties: false,
          required: ["unite", "tous"],
          properties: { unite: { type: "string", enum: ["jour", "semaine", "mois"] }, tous: { type: "integer" } },
        },
      },
    },
  },
  {
    name: "tache_faite",
    description: "Marque une tâche existante comme faite par la personne qui parle. Une tâche qui revient repart pour la prochaine fois.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["titre"],
      properties: { titre: texte("Le nom de la tâche tel qu'il figure dans la liste des tâches.") },
    },
  },
  {
    name: "ajouter_au_stock",
    description: "Range des produits au frigo, au congélateur ou au placard.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["produits"],
      properties: {
        produits: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["nom", "lieu", "peremption"],
            properties: {
              nom: texte("Le produit avec sa quantité éventuelle : « 2 yaourts », « poulet »."),
              lieu: { type: "string", enum: ["frigo", "congelateur", "placard"] },
              peremption: ouNul("La date limite, AAAA-MM-JJ ; null si on ne la connaît pas."),
            },
          },
        },
      },
    },
  },
  {
    name: "attribuer_tache",
    description: "Confie une tâche existante à une personne du foyer, ou la rend libre.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["titre", "responsable"],
      properties: {
        titre: texte("Le nom de la tâche tel qu'il figure dans la liste des tâches."),
        responsable: ouNul("Le prénom de la personne qui s'en charge ; null pour la rendre libre."),
      },
    },
  },
  {
    name: "noter_pesee",
    description: "Note le poids d'un animal du foyer.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["animal", "grammes", "jour"],
      properties: {
        animal: texte("Le nom de l'animal."),
        grammes: { type: "integer", description: "Le poids en grammes." },
        jour: ouNul("Le jour de la pesée, AAAA-MM-JJ, s'il est écrit (carnet, facture du vétérinaire) ; null pour aujourd'hui."),
      },
    },
  },
  {
    name: "regler_animal",
    description:
      "Corrige le poids estimé d'un animal (« elle pèse environ 1,6 kg ») et/ou sa ration de croquettes par jour, sans noter de pesée au carnet. La ration se recalcule avec le poids estimé, sauf si une ration est donnée.",
    strict: false, // Champs facultatifs : voir MAX_UNIONS_STRICTES.
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["animal", "poids_estime", "ration"],
      properties: {
        animal: texte("Le nom de l'animal."),
        poids_estime: { type: ["integer", "null"], description: "Le poids estimé en grammes ; null pour ne pas le changer." },
        ration: { type: ["integer", "null"], description: "Les croquettes par jour en grammes, quand on la donne ; null pour la laisser calculée." },
      },
    },
  },
  {
    name: "noter_journal",
    description: "Note dans le journal d'un animal ce qui s'est passé : litière changée, a vomi, n'a pas mangé, selles molles, boite, se cache ou autre remarque.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["animal", "quoi", "note", "jour"],
      properties: {
        animal: texte("Le nom de l'animal."),
        quoi: { type: "string", enum: ["litiere", "vomi", "pas_mange", "selles", "boite", "cachee", "autre"] },
        note: texte("Une précision courte, ou une chaîne vide. Obligatoire pour « autre »."),
        jour: ouNul("Le jour, AAAA-MM-JJ, si ce n'est pas aujourd'hui (« hier soir ») ; null pour aujourd'hui."),
      },
    },
  },
  {
    name: "noter_soin",
    description: "Note un soin dans le carnet de santé d'un animal : déjà fait à une date (relu sur le carnet), ou prévu.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["animal", "type", "libelle", "date", "fait"],
      properties: {
        animal: texte("Le nom de l'animal."),
        type: { type: "string", enum: ["vaccin", "vermifuge", "antiparasitaire", "sterilisation", "visite", "autre"] },
        libelle: texte("Le soin tel qu'écrit : « Vaccin typhus et coryza (rappel) », « Milbemax »."),
        date: texte("La date du soin, AAAA-MM-JJ."),
        fait: { type: "boolean", description: "true si le soin a déjà été fait, false s'il est prévu." },
      },
    },
  },
  {
    name: "ajouter_plante",
    description: "Ajoute des plantes dans une zone du jardin (un pot, un bac, une jardinière).",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["plantes", "zone"],
      properties: {
        plantes: { type: "array", items: texte("Le nom courant de la plante en français : « basilic », « tomate cerise ».") },
        zone: ouNul("Le nom de la zone telle qu'elle figure dans le jardin ; null si le jardin n'a qu'une zone."),
      },
    },
  },
  {
    name: "arrosage_fait",
    description: "Note que le jardin, ou une de ses zones, vient d'être arrosé.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["zone"],
      properties: { zone: ouNul("Le nom de la zone arrosée ; null si tout le jardin a été arrosé.") },
    },
  },
  {
    name: "modifier_tache",
    description: "Change le nom ou la date d'une tâche existante (« décale l'aspirateur à jeudi »).",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["titre", "nouveau_titre", "echeance"],
      properties: {
        titre: texte("Le nom de la tâche tel qu'il figure dans la liste des tâches."),
        nouveau_titre: ouNul("Le nouveau nom ; null pour le garder."),
        echeance: ouNul("La nouvelle date, AAAA-MM-JJ ; null pour la garder."),
      },
    },
  },
  {
    name: "supprimer_tache",
    description: "Supprime une tâche qui n'a plus lieu d'être. L'app demande confirmation avant.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["titre"],
      properties: { titre: texte("Le nom de la tâche tel qu'il figure dans la liste des tâches.") },
    },
  },
  {
    name: "retirer_du_stock",
    description: "Retire du stock des produits finis, mangés ou jetés. L'app demande confirmation avant.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["produits"],
      properties: { produits: { type: "array", items: texte("Le nom du produit tel qu'il figure dans le stock.") } },
    },
  },
  {
    name: "retenir",
    description:
      "Retient durablement un fait sur le foyer : un goût, une habitude, une règle de la maison. propose: false quand on te demande de le retenir ; true quand tu l'as remarqué toi-même. Dans les deux cas c'est retenu tout de suite (la personne peut annuler).",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["fait", "propose"],
      properties: {
        fait: texte("Le fait en une phrase courte et autonome, à la troisième personne : « Sarah n'aime pas la coriandre »."),
        propose: { type: "boolean", description: "true si personne ne t'a demandé de le retenir." },
      },
    },
  },
  {
    name: "oublier",
    description: "Efface un fait de ta mémoire, quand on te dit qu'il est faux ou plus à jour. L'app demande confirmation avant.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["fait"],
      properties: { fait: texte("Le fait tel qu'il figure dans ta mémoire.") },
    },
  },
  {
    name: "ajouter_evenement",
    description:
      "Ajoute un événement à l'agenda commun : rendez-vous (médecin, véto), anniversaire, vacances, sortie, horaire de travail. Il apparaît aussi dans le calendrier de l'iPhone.",
    strict: false, // Beaucoup de champs facultatifs : voir MAX_UNIONS_STRICTES.
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["titre", "jour", "fin", "heure", "heure_fin", "pour", "categorie", "repetition", "lieu"],
      properties: {
        titre: texte("Le nom court : « Dentiste », « Anniversaire de maman »."),
        jour: texte("Le premier jour, AAAA-MM-JJ. Pour un anniversaire dont on connaît l'année de naissance, la vraie date de naissance."),
        fin: ouNul("Le dernier jour, AAAA-MM-JJ, pour ce qui dure plusieurs jours ; null sinon."),
        heure: ouNul("L'heure de début, HH:MM ; null pour toute la journée."),
        heure_fin: ouNul("L'heure de fin, HH:MM ; null si elle n'est pas connue."),
        pour: ouNul("Le prénom de la personne concernée ; null pour le foyer (nous deux)."),
        categorie: { type: "string", enum: ["rdv", "anniversaire", "vacances", "sortie", "travail", "autre"] },
        repetition: { type: "string", enum: ["aucune", "jour", "semaine", "mois", "annee"] },
        lieu: ouNul("Le lieu ou l'adresse ; null s'il n'est pas dit."),
      },
    },
  },
  {
    name: "supprimer_evenement",
    description: "Retire un événement de l'agenda (annulé, plus d'actualité). L'app demande confirmation avant.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["titre", "jour"],
      properties: {
        titre: texte("Le nom de l'événement tel qu'il figure dans l'agenda."),
        jour: ouNul("Sa date, AAAA-MM-JJ, pour le distinguer d'un autre du même nom ; null sinon."),
      },
    },
  },
  {
    name: "noter_depense",
    description:
      "Note une dépense au budget du foyer : un ticket de caisse (son total), une sortie, une facture payée (« j'ai payé Sunrise »), un versement à l'épargne.",
    strict: false, // Beaucoup de champs facultatifs : voir MAX_UNIONS_STRICTES.
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["montant", "libelle", "magasin", "pot", "jour", "charge", "articles"],
      properties: {
        montant: { type: "number", description: "Le montant en francs : le total payé pour un ticket." },
        libelle: texte("Ce que c'est, en deux ou trois mots : « Courses Migros », « Cinéma »."),
        magasin: ouNul("Le magasin du ticket (Migros, Coop, Lidl, Denner…) ; null sinon."),
        pot: { type: "string", enum: ["courses", "plaisir", "factures", "epargne", "commun", "perso"], description: "courses : alimentation et maison ; plaisir : sorties, cadeaux, envies du foyer ; factures : une facture ; epargne : un versement à l'épargne ; perso : une dépense rien qu'à soi, payée de son côté (« pour moi »)." },
        jour: ouNul("Le jour, AAAA-MM-JJ, s'il est écrit (ticket) ; null pour aujourd'hui."),
        charge: ouNul("Pour une facture payée : le nom de la charge telle qu'elle figure dans le budget ; null sinon."),
        articles: {
          type: "array",
          description: "Pour un ticket : chaque ligne avec son prix, le nom court et sans marque quand c'est possible (« Lait entier 1 l »). Vide sinon.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["nom", "prix"],
            properties: { nom: { type: "string" }, prix: { type: "number", description: "Le prix de la ligne en francs." } },
          },
        },
      },
    },
  },
  {
    name: "enregistrer_recette",
    description:
      "Range une recette dans les recettes du foyer : lue derrière un lien, sur une photo (page de livre, fiche, écran) ou dictée. Une recette déjà enregistrée sous ce titre n'est pas copiée.",
    strict: false, // Beaucoup de champs facultatifs : voir MAX_UNIONS_STRICTES.
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["titre", "portions", "ingredients", "etapes", "lien"],
      properties: {
        titre: texte("Le nom du plat : « Gratin dauphinois »."),
        portions: { type: ["integer", "null"], description: "Pour combien de personnes sont les quantités ; null si ce n'est pas dit." },
        ingredients: {
          type: "array",
          description: "Tous les ingrédients, dans l'ordre de la recette.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["nom", "quantite"],
            properties: {
              nom: texte("Le nom court, sans la quantité : « Lardons fumés »."),
              quantite: ouNul("La quantité courte : « 200 g », « 2 », « 1 c. à soupe » ; null sans quantité."),
            },
          },
        },
        etapes: { type: "array", items: texte("Une étape, courte et claire, en français."), description: "Les étapes dans l'ordre ; vide si elles ne sont pas données." },
        lien: ouNul("L'adresse de la page, pour une recette venue d'un lien ; null sinon."),
      },
    },
  },
  {
    name: "noter_taille",
    description: "Note la taille d'un vêtement pour une personne du foyer (« Sarah fait du 39 », « je fais du M en haut »). Une taille par pièce et par personne : la nouvelle remplace l'ancienne.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["pour", "piece", "valeur"],
      properties: {
        pour: texte("Le prénom de la personne ; celui de la personne qui parle pour « je »."),
        piece: { type: "string", enum: ["haut", "pantalon", "robe", "chaussures", "sousVetements", "manteau"], description: "La pièce : haut (t-shirt, pull, chemise), pantalon (jean, jupe), robe (robe, costume), chaussures, sousVetements, manteau (veste, manteau)." },
        valeur: texte("La taille telle qu'on la dit : « M », « 38 », « W30 L32 », « 85B »."),
      },
    },
  },
  {
    name: "noter_carnet",
    description: "Note ou met à jour une ligne du carnet de la maison : ce qu'on cherche toujours (le concierge, la gérance, le numéro du compteur, le modèle de la chaudière, où est la vanne d'eau). Une ligne par nom : la nouvelle remplace l'ancienne. Jamais de mot de passe ni de code.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["titre", "valeur"],
      properties: {
        titre: texte("Le nom court de la ligne : « Concierge », « Gérance », « Compteur d'eau », « Vanne d'eau »."),
        valeur: texte("Ce qu'on retient, tel qu'on le dit : « M. Rossi, 079 123 45 67 », « sous l'évier de la cuisine »."),
      },
    },
  },
  {
    name: "noter_rangement",
    description: "Range des objets dans un lieu de la maison (cave, placard du haut, boîte bleue, valise) : « la perceuse est à la cave », « j'ai mis les skis et la luge au galetas ». Le lieu existant s'enrichit. Pour « où est la perceuse ? », réponds depuis les rangements de l'état du foyer, sans outil.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["lieu", "objets"],
      properties: {
        lieu: texte("Le lieu, court : « Cave », « Placard du haut », « Boîte bleue », « Valise rouge »."),
        objets: { type: "array", items: { type: "string" }, description: "Les objets rangés là, un par entrée : « perceuse », « skis », « papiers de la voiture »." },
      },
    },
  },
  {
    name: "noter_envie",
    description: "Note un vêtement ou un accessoire qu'une personne du foyer aimerait acheter (« j'aimerais une veste en laine », « note des bottes pour Sarah, 120 francs »). L'autre voit la liste : utile pour un cadeau.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["pour", "envie"],
      properties: {
        pour: texte("Le prénom de la personne ; celui de la personne qui parle pour « je »."),
        envie: texte("La pièce en quelques mots, le prix au bout s'il est dit : « veste en laine 120 »."),
      },
    },
  },
  {
    name: "noter_souhait",
    description:
      "Quand on te demande une chose que tu ne sais pas faire (aucun outil ne convient, ou l'app n'a pas cette fonction), note-la comme souhait d'amélioration pour Claude, qui fait évoluer l'app.",
    strict: false,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["demande", "manque"],
      properties: {
        demande: texte("Ce que la personne voulait, avec ses mots."),
        manque: texte("Ce qu'il faudrait que tu saches faire, en une phrase."),
      },
    },
  },
] as const;

export const CONSIGNES_JARVIS = `Tu es Jarvis, l'assistant d'un foyer en Suisse romande, dans l'app KoraHome sur iPhone.
On te parle souvent à la voix : la demande peut être approximative ou mal transcrite, devine l'intention la plus probable.
Réponds toujours en français, en tutoyant, en une ou deux phrases courtes, sans liste ni mise en forme.
Pour agir, utilise les outils. Quand tu utilises un outil, n'écris rien d'autre : l'app confirme elle-même ce qui a été fait.
Tu peux faire plusieurs actions d'un coup. Les dates sont au format AAAA-MM-JJ ; « demain », « samedi » se comptent depuis la date du jour donnée.
Tu ne dépenses jamais d'argent. Tu peux supprimer une tâche, retirer un produit du stock ou oublier un fait : l'app demande toujours confirmation avant, n'ajoute rien à ce sujet.
« Rappelle-moi jeudi d'appeler le véto » : crée une tâche unique à cette date pour la personne qui parle ; le rappel du matin la signale.
Un rendez-vous, un anniversaire, des vacances, une sortie ou un horaire de travail vont dans l'agenda (ajouter_evenement), pas dans les tâches. Pour « qu'est-ce qu'on a cette semaine ? », réponds à partir de l'agenda de l'état du foyer.
Si la demande n'est pas claire, pose une seule question courte.
Si on te demande une chose qu'aucun outil ne permet et que l'état du foyer ne te laisse pas répondre, utilise noter_souhait, et écris : « Je ne sais pas encore le faire, je l'ai noté pour Claude. »
Ta mémoire est dans l'état du foyer : sers-t'en pour chaque demande (goûts, habitudes, règles de la maison). Quand on te dit « retiens que… » ou « n'oublie pas que… », utilise retenir (propose: false). Quand tu remarques une préférence ou une habitude durable qui n'est pas encore dans ta mémoire, retiens-la toi-même avec retenir (propose: true), sans demander, au plus une par réponse, jamais une information passagère ni de santé ou d'argent ; dis-le en une phrase. Quand on te dit qu'un fait de ta mémoire est faux, utilise oublier, et retenir pour le fait juste.
Pour une question sur le foyer, réponds à partir de l'état du foyer fourni ; s'il ne contient pas la réponse, dis-le.
Avec une photo (lettre, facture, carte de rendez-vous, flyer, faire-part) : mets chaque rendez-vous ou événement daté dans l'agenda (ajouter_evenement, avec l'heure et le lieu indiqués), et crée une tâche unique pour chaque échéance ou paiement.
Avec un ticket de caisse : range au stock (ajouter_au_stock) les produits alimentaires achetés, avec leur quantité dans le nom (« 1 l lait », « 500 g beurre ») et le lieu où on les range d'habitude ; laisse la date de péremption vide si elle n'est pas écrite, l'app la devine. Coche aussi les courses correspondantes (cocher_courses), et note le total payé au budget (noter_depense, pot courses, avec le magasin, la date du ticket et chaque ligne avec son prix dans articles).
Pour l'argent : réponds à partir du budget de l'état du foyer (carte courses, plaisir, factures, épargne). « J'ai payé l'assurance voiture », « 32 francs de cinéma » : utilise noter_depense. Tu ne fais jamais de paiement toi-même.
Avec une page de carnet de santé ou une facture de vétérinaire : note chaque vaccin, vermifuge, antiparasitaire ou visite avec noter_soin (fait: true à sa date, et fait: false pour la date du prochain rappel écrite), et les poids écrits avec noter_pesee à leur date.
Quand on te dit qu'un animal a vomi, n'a pas mangé, ou que la litière est changée, note-le avec noter_journal ; si une tâche correspond (litière), marque-la aussi faite.
Avec une recette (un lien, une photo de page de livre ou de fiche, ou une recette dictée) : range-la dans les recettes du foyer (enregistrer_recette) avec tous ses ingrédients et leurs quantités, et ses étapes réécrites courtes en français. Pour un lien, mets l'adresse dans lien, puis compare ses ingrédients au stock et à la liste de courses et n'ajoute aux courses que ce qui manque, avec les quantités de la recette. Pour une photo ou une dictée, n'ajoute aux courses que si on te le demande.
« J'ai fait le risotto », « on a mangé la soupe », « j'ai utilisé les courgettes » : la cuisine est faite. Retire du stock (retirer_du_stock) les produits de l'état du foyer qui ont servi (les ingrédients de la recette ou du menu du Chef qui sont au stock, ou ceux qu'on nomme), sans toucher aux bases qui restent (sel, huile, riz, pâtes). S'il reste des portions, dis-le en une phrase. Si le plat n'est pas dans les recettes du foyer, écris-la avec enregistrer_recette pour la prochaine fois.
« Qu'est-ce qu'on mange ce soir ? » : propose une ou deux recettes du foyer (état du foyer) qu'on peut faire avec le stock, celles qu'on aime d'abord, en disant ce qui manque ; si aucune ne va, une idée simple avec ce qu'il y a. Ne propose jamais une recette marquée « pas pour eux ».
Les vêtements : « quelle pointure fait Sarah ? », « qu'est-ce qui ferait plaisir à Dany ? » se répondent depuis les vêtements de l'état du foyer (tailles et envies). « Je fais du 38 », « note une robe pour Sarah » : noter_taille, noter_envie.
Le carnet de la maison : « qui est le concierge ? », « où est la vanne d'eau ? » se répondent depuis le carnet de l'état du foyer, en une phrase. « Le concierge, c'est M. Rossi, 079… », « note le numéro du compteur » : noter_carnet. Un mot de passe ou un code ne se note jamais : réponds qu'ils restent dans le trousseau de l'iPhone.
Les rangements : « où est la perceuse ? », « qu'est-ce qu'il y a dans la boîte bleue ? » se répondent depuis les rangements de l'état du foyer, en une phrase ; si rien n'est rangé sous ce nom, dis-le. « La perceuse est à la cave », « j'ai mis les skis au galetas » : noter_rangement.
Avec une photo de plante : reconnais-la (nom courant en français, le plus précis possible). Si on te demande de l'ajouter, utilise ajouter_plante, et écris quand même une phrase : son nom, puis son besoin principal (soleil, arrosage, gel). Si tu n'es pas sûr, dis-le et donne les deux noms les plus probables.`;

/** Le conseil du dimanche : Jarvis prépare la semaine, le foyer valide ensemble. */
export const CONSIGNES_CONSEIL = `Tu es Jarvis, l'assistant d'un foyer en Suisse romande. C'est le conseil de la semaine : le foyer décide ensemble de la semaine qui vient, et tu prépares une proposition qu'il validera ligne par ligne.
Utilise les outils pour proposer :
- de confier chaque tâche des sept prochains jours à une personne (attribuer_tache), en équilibrant la charge et en tenant compte de qui a fait quoi ;
- les courses de la semaine (ajouter_courses) : les ingrédients de cinq repas simples de saison qui utilisent d'abord ce qui arrive à sa date dans le stock, et ce qui manque pour la maison ;
- les tâches qui manquent pour la semaine (ajouter_tache), seulement si l'état du foyer le justifie.
En plus des outils, écris en français, en tutoyant, un court résumé : la répartition proposée, les cinq repas (un par ligne, « Lundi : … »), et ce qui demande de l'attention. Pas plus de dix lignes.`;

// ----- Le conseiller budget -----

/** Le conseiller budget répond toujours par cet outil : un texte, un tableau s'il le faut, des conseils. */
export const OUTIL_BUDGET = {
  name: "repondre_budget",
  description: "La réponse au foyer sur son budget : quelques phrases, un tableau si la question en appelle un, et des conseils concrets.",
  input_schema: {
    type: "object",
    required: ["texte", "conseils"],
    properties: {
      texte: texte("La réponse en deux à quatre phrases, la réponse d'abord, avec les chiffres qui comptent."),
      tableau: {
        type: "object",
        description: "Seulement si la question appelle une comparaison ou des chiffres sur plusieurs lignes ; sinon, ne pas le mettre.",
        required: ["titre", "colonnes", "lignes"],
        properties: {
          titre: texte("Le titre du tableau, avec l'unité : « Courses par magasin (CHF) »."),
          colonnes: { type: "array", items: { type: "string" }, description: "Deux à cinq en-têtes de colonnes." },
          lignes: {
            type: "array",
            description: "Quinze lignes au plus ; chaque ligne a autant de cases que de colonnes. Les montants sans « CHF » : « 84.30 ».",
            items: { type: "array", items: { type: "string" } },
          },
        },
      },
      conseils: {
        type: "array",
        description: "Zéro à quatre conseils, du plus utile au moins utile.",
        items: {
          type: "object",
          required: ["titre", "detail"],
          properties: {
            titre: texte("Le conseil en quelques mots : « Courses en dessous de 650 »."),
            detail: texte("Une ou deux phrases : quoi faire concrètement et pourquoi, chiffres à l'appui."),
            gain_par_mois: { type: "number", description: "Ce que le conseil fait gagner par mois en francs, si on peut l'estimer." },
          },
        },
      },
    },
  },
};

export const CONSIGNES_BUDGET = `Tu es Jarvis, le conseiller budget d'un couple en Suisse romande, dans l'app KoraHome sur iPhone. Les montants sont en francs suisses.
Tu reçois l'état de leur budget, préparé par l'app : le plan (salaires, charges, versements au compte commun, pots courses, plaisir, factures, épargne), les soldes, les projections de fin de mois, les factures des douze mois à venir, le tableau des mois passés et les dépenses détaillées. Puis une question.
Réponds toujours avec l'outil repondre_budget, en français, en tutoyant la personne qui demande ; parle de « vous deux » pour ce qui est commun.
N'utilise que les chiffres fournis, et fais les calculs avec soin ; si une donnée manque pour répondre, dis-le simplement. N'invente aucune dépense.
« Fais le point » : où en est le mois face au budget, comment il finira à ce rythme, les mois lourds de factures à venir et le pot qui pourrait manquer, l'avancée de l'épargne ou du projet.
Ajoute un tableau seulement si la question appelle une comparaison ou une liste de chiffres (« par magasin », « mois par mois », « nos abonnements »).
Les conseils sont concrets, chiffrés et faits pour ce foyer : un magasin moins cher pour ce qu'ils achètent souvent, un abonnement à revoir, un montant à mettre de côté avant un mois lourd, la part plaisir à ajuster. Jamais de conseil général (« faites un budget »), jamais de produit financier ni de placement, jamais de crédit.
Si tout va bien, dis-le en une phrase et ne force pas les conseils.`;

// ----- Les recettes -----

export interface Recette {
  titre: string;
  ingredients: string[];
  portions: string | null;
  /** Les étapes, quand la page les donne (depuis Kora 0.0.38). */
  etapes?: string[];
}

const decoder = (t: string) =>
  t
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/** Cherche une recette dans les données structurées (JSON-LD) d'une page : Betty Bossi, Marmiton, Fooby… */
export function extraireRecette(html: string): Recette | null {
  const blocs = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, contenu] of blocs) {
    let donnees: unknown;
    try {
      donnees = JSON.parse(contenu.trim());
    } catch {
      continue;
    }
    const aVisiter: unknown[] = [donnees];
    while (aVisiter.length) {
      const n = aVisiter.shift();
      if (Array.isArray(n)) {
        aVisiter.push(...n);
        continue;
      }
      if (!n || typeof n !== "object") continue;
      const o = n as Record<string, unknown>;
      const type = o["@type"];
      const estRecette = type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
      if (estRecette && Array.isArray(o.recipeIngredient)) {
        const ingredients = o.recipeIngredient.filter((i): i is string => typeof i === "string").map(decoder).filter(Boolean);
        if (!ingredients.length) continue;
        const rendement = Array.isArray(o.recipeYield) ? o.recipeYield[0] : o.recipeYield;
        const etapes = lireEtapes(o.recipeInstructions);
        return {
          titre: typeof o.name === "string" ? decoder(o.name) : "Recette",
          ingredients,
          portions: typeof rendement === "string" || typeof rendement === "number" ? String(rendement) : null,
          ...(etapes.length ? { etapes } : {}),
        };
      }
      if (o["@graph"]) aVisiter.push(o["@graph"]);
    }
  }
  return null;
}

/** Les étapes d'une recette JSON-LD : un texte, des HowToStep, ou des sections HowToSection. */
function lireEtapes(v: unknown, max = 20): string[] {
  const etapes: string[] = [];
  const visiter = (n: unknown) => {
    if (etapes.length >= max || !n) return;
    if (typeof n === "string") {
      for (const ligne of n.replace(/<[^>]+>/g, "\n").split(/\n+/)) {
        const t = decoder(ligne);
        if (t && etapes.length < max) etapes.push(t.slice(0, 400));
      }
    } else if (Array.isArray(n)) n.forEach(visiter);
    else if (typeof n === "object") {
      const o = n as Record<string, unknown>;
      if (o.itemListElement) visiter(o.itemListElement);
      else if (typeof o.text === "string") visiter(o.text);
      else if (typeof o.name === "string") visiter(o.name);
    }
  };
  visiter(v);
  return etapes;
}

/** Le texte lisible d'une page, sans balises, pour une recette sans données structurées. */
export function texteDePage(html: string, max = 6000): string {
  return decoder(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).slice(0, max);
}

/** Le premier lien d'une demande (« ajoute les ingrédients de https://… »). */
export function lienDans(demande: string): string | null {
  return demande.match(/https:\/\/[^\s<>"']+/)?.[0] ?? null;
}

/** Ce que le modèle lit d'une recette trouvée derrière un lien. */
export function decrireRecette(r: Recette): string {
  const etapes = r.etapes?.length ? `\nÉtapes :\n${r.etapes.map((e, i) => `${i + 1}. ${e}`).join("\n")}` : "";
  return `Recette « ${r.titre} »${r.portions ? ` (${r.portions})` : ""}, ingrédients :\n${r.ingredients.map((i) => `- ${i}`).join("\n")}${etapes}`;
}

// ----- La conversation -----

export interface TourJarvis {
  role: "personne" | "jarvis";
  texte: string;
}

/** Les derniers échanges, pour que « et du beurre aussi » se comprenne. */
export const TOURS_RETENUS = 6;

/** Le message envoyé au modèle : les derniers échanges, l'état du foyer, puis la demande. */
export function messageDemande(etat: string, demande: string, historique: readonly TourJarvis[] = [], lien?: string | null): string {
  const tours = historique.slice(-TOURS_RETENUS).map((t) => `${t.role === "personne" ? "Personne" : "Jarvis"} : ${t.texte}`);
  const avant = tours.length ? `Échanges précédents :\n${tours.join("\n")}\n\n` : "";
  const page = lien ? `\n\nCe qu'il y a derrière le lien :\n${lien}` : "";
  return `${avant}État du foyer :\n${etat}\n\nDemande : ${demande.trim()}${page}`;
}

/** Ce que Jarvis lit d'une page : la recette si elle est décrite, sinon son texte. */
export function lirePage(html: string): string {
  const recette = extraireRecette(html);
  return recette ? decrireRecette(recette) : texteDePage(html);
}

/** Les adresses qu'on accepte d'ouvrir : https, nom de domaine public (ni IP, ni réseau local). */
export function lienAutorise(adresse: string): boolean {
  let url: URL;
  try {
    url = new URL(adresse);
  } catch {
    return false;
  }
  const hote = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.port || url.username) return false;
  if (!hote.includes(".") || hote.endsWith(".local") || hote.endsWith(".internal") || hote === "localhost") return false;
  return !/^[\d.]+$/.test(hote) && !hote.includes(":") && !hote.startsWith("[");
}
