// Jarvis dans Siri : « Dis Siri, Tael », puis la demande à voix haute. Un raccourci de l'iPhone
// envoie la phrase à la fonction serveur supabase/functions/siri avec le jeton de cette personne ;
// le serveur lit lui-même le foyer, interroge Jarvis, applique ses actions et renvoie une phrase
// que Siri dit. Ce fichier tient ses règles, sans réseau ni stockage (copiées par `npm run fonction`) :
// - les données du foyer relues depuis les documents du serveur (donneesDepuisDocuments) ;
// - ce qui supprime attend le oui : Siri pose la question, « oui » au tour suivant le fait ;
// - « annule » défait le dernier tour, comme le bouton Annuler de l'app ;
// - les documents à écrire sur le serveur pour chaque modification (lignesAEcrire).

import {
  annulation,
  aConfirmer,
  appliquerActions,
  decrireFoyer,
  lireActions,
  questionPour,
  type ActionJarvis,
  type DonneesFoyer,
  type Modification,
} from "./jarvis";
import { normaliser } from "./rayons";
import type { Contexte, Foyer, Id, Jour } from "./types";

export {
  CONSIGNES_JARVIS,
  coutMicroChf,
  etatBudget,
  formaterChf,
  messageDemande,
  MODELE_JARVIS,
  moisDe,
  noteServeur,
  OUTILS_JARVIS,
  phrasePanne,
  TOURS_RETENUS,
} from "./jarvisModele";
export { annulation, aConfirmer, appliquerActions, decrireFoyer, lireActions, questionPour };

/** Les collections que Jarvis lit et modifie. */
export const COLLECTIONS_SIRI = ["foyer", "listes", "elements", "taches", "animaux", "stock", "catalogue", "jardin", "memoire", "retours", "agenda", "budget", "menus", "vetements"] as const;

/** Une question en attente, ou le dernier tour (pour « annule » et la suite de la conversation), au plus tant de minutes. */
export const MINUTES_RETENUES = 10;

/** La phrase que Siri ajoute à une question : le raccourci la repère pour réécouter tout de suite. */
export const OUI_OU_NON = "Oui ou non ?";

/** Le nom proposé pour le raccourci : la fée du téléphone (Tael pour Dany, Navi pour Sarah). */
export function nomPropose(prenom: string | null | undefined): string {
  const p = normaliser(prenom ?? "");
  if (p.startsWith("d") || p.startsWith("melo")) return "Tael";
  if (p.startsWith("s")) return "Navi";
  return "Jarvis";
}

/** Le nom gardé avec le jeton : un mot ou deux, sans rien d'autre. */
export function nomAssistant(v: unknown): string {
  const nom = typeof v === "string" ? v.replace(/[^\p{L}\p{N} '-]/gu, "").trim().slice(0, 30) : "";
  return nom || "Jarvis";
}

/** Ce que Jarvis sait de sa voix quand il passe par Siri. */
export function consignesSiri(consignes: string, nom: string): string {
  return `${consignes}
Ici, tu passes par Siri et tu t'appelles ${nom} : ta réponse est dite à voix haute, sans écran. Une ou deux phrases courtes, sans liste, sans emoji, sans adresse ni chiffre inutile. Pas de photo ni de lien possible par Siri.`;
}

/** Les données du foyer telles que le serveur les garde (une ligne par document). */
export function donneesDepuisDocuments(lignes: readonly { collection: string; donnees: unknown }[], version = "Siri"): DonneesFoyer | null {
  const de = <T>(c: string) => lignes.filter((l) => l.collection === c && l.donnees).map((l) => l.donnees as T);
  const foyer = de<Foyer>("foyer")[0];
  if (!foyer) return null;
  return {
    foyer,
    listes: de("listes"),
    elements: de("elements"),
    taches: de("taches"),
    animaux: de("animaux"),
    produits: de("stock"),
    catalogue: de("catalogue"),
    zones: de("jardin"),
    meteo: null,
    souvenirs: de("memoire"),
    retours: de("retours"),
    agenda: de("agenda"),
    budget: de("budget"),
    menus: de("menus"),
    vetements: de("vetements"),
    version,
  };
}

export type Reponse = "oui" | "non" | "annule" | null;

/** « Oui », « non » ou « annule » dit seul (ou presque) ; null pour une vraie demande. */
export function reponseCourte(phrase: string): Reponse {
  const t = normaliser(phrase).replace(/[.!?,;]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(oui|ouais|ok|okay|d'accord|dac|vas-y|vas y|go|confirme|je confirme|c'est ca|exact|bien sur|oui vas-y|oui vas y|oui merci|oui oui|oui s'il te plait|fais-le|fais le)$/.test(t)) return "oui";
  if (/^(non|non merci|laisse|laisse tomber|pas maintenant|surtout pas|non non|rien)$/.test(t)) return "non";
  if (/^(annule|annule ca|annule tout|defais|defais ca|reviens en arriere|annuler|annule le|annule la derniere chose)$/.test(t)) return "annule";
  return null;
}

/** Ce que le serveur garde d'un tour à l'autre, avec le jeton de la personne. */
export interface Suite {
  /** L'action qui attend le oui (une seule à la fois par la voix). */
  attente: ActionJarvis | null;
  /** Ce que le dernier tour a changé, pour « annule ». */
  modifications: Modification[];
  /** Les derniers échanges, pour comprendre « et des œufs aussi ». */
  tours: { role: "personne" | "jarvis"; texte: string }[];
  le: string;
}

/** La suite d'avant, si elle date de moins de MINUTES_RETENUES. */
export function suiteRecente(v: unknown, maintenant: string): Suite | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Partial<Suite>;
  if (typeof s.le !== "string" || Date.parse(maintenant) - Date.parse(s.le) > MINUTES_RETENUES * 60_000) return null;
  return {
    attente: s.attente ?? null,
    modifications: Array.isArray(s.modifications) ? s.modifications : [],
    tours: Array.isArray(s.tours) ? s.tours.slice(-6) : [],
    le: s.le,
  };
}

/** Une ligne de la table documents. */
export interface LigneDocument {
  collection: string;
  id: Id;
  donnees: unknown | null;
}

/** Ce qu'il faut écrire sur le serveur pour chaque modification de Jarvis. */
export function lignesAEcrire(modifications: readonly Modification[]): LigneDocument[] {
  return modifications.map((m) => {
    if (!("supprime" in m && m.supprime)) return { collection: m.collection, id: m.apres.id, donnees: m.apres };
    // Venu d'un calendrier iCloud : marqué pour que le serveur l'y efface aussi (comme le téléphone).
    if (m.collection === "agenda" && m.apres.icloud) return { collection: "agenda", id: m.apres.id, donnees: { ...m.apres, aRetirer: true } };
    return { collection: m.collection, id: m.apres.id, donnees: null };
  });
}

/** Ce qu'il faut écrire pour défaire le dernier tour. */
export function lignesAnnulation(modifications: readonly Modification[]): LigneDocument[] {
  return annulation(modifications).map(({ collection, id, remettre }) => ({ collection, id, donnees: remettre }));
}

/** Retire ce que Siri dirait mal : mise en forme, emoji, retours à la ligne. */
export function pourLaVoix(texte: string): string {
  return texte
    .replace(/[*_#`>]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

/** Le résultat d'un tour : la phrase à dire, ce qui s'écrit, ce qui reste en attente. */
export interface TourSiri {
  dit: string;
  modifications: Modification[];
  attente: ActionJarvis | null;
}

/** Applique ce que Jarvis a demandé ; une action qui supprime devient la question du tour. */
export function tourSiri(
  texteModele: string,
  appels: readonly { nom: string; entree: unknown }[],
  donnees: DonneesFoyer,
  membreId: Id | null,
  aujourdhui: Jour,
  ctx: Contexte,
): TourSiri {
  const actions = lireActions(appels);
  const directes = actions.filter((a) => !aConfirmer(a));
  const attente = actions.find(aConfirmer) ?? null;
  const resultat = appliquerActions(directes, donnees, membreId, aujourdhui, ctx);
  const phrases = [texteModele, ...resultat.faits, ...resultat.echecs].filter(Boolean);
  if (attente) phrases.push(`${questionPour(attente).question} ${OUI_OU_NON}`);
  const dit = pourLaVoix(phrases.join(" ")) || "C'est fait.";
  return { dit, modifications: resultat.modifications, attente };
}

/** « Oui » à la question d'avant : l'action se fait. */
export function confirmer(attente: ActionJarvis, donnees: DonneesFoyer, membreId: Id | null, aujourdhui: Jour, ctx: Contexte): TourSiri {
  const resultat = appliquerActions([attente], donnees, membreId, aujourdhui, ctx);
  return { dit: pourLaVoix([...resultat.faits, ...resultat.echecs].join(" ")) || "C'est fait.", modifications: resultat.modifications, attente: null };
}

/** La phrase à coller dans « Décrire un raccourci » (Raccourcis, iOS 26) : le raccourci entier, l'adresse dedans. */
export function demandeRaccourciSiri(adresse: string, nom: string): string {
  return [
    `Crée un raccourci nommé « ${nom} », pour que je puisse dire « Dis Siri, ${nom} ».`,
    "1. Action « Demander une saisie » : type Texte, question « Je t'écoute ».",
    "2. Action « Obtenir le contenu de l'URL » :",
    `- URL : ${adresse}`,
    "- Méthode : POST",
    "- Corps de la requête : JSON, avec un champ de type Texte : demande = la saisie demandée à l'étape 1",
    "3. Action « Énoncer le texte » (ou « Afficher le résultat ») avec le contenu obtenu.",
    `4. Si le contenu obtenu contient « ${OUI_OU_NON} » : redemander une saisie (question « Oui ou non ? »), l'envoyer de la même façon à la même URL (champ demande), puis énoncer la réponse.`,
    "Pas d'autre action.",
  ].join("\n");
}

/** Un bouton sur l'écran d'accueil de l'iPhone : un raccourci qui envoie une demande toute faite à la fée, sans parler. */
export interface RaccourciEcran {
  id: "courses" | "soir" | "depense";
  nom: string;
  /** Ce que le bouton fait, en une ligne, pour la page Siri. */
  resume: string;
  /** La question posée au moment du toucher ; null quand la demande part telle quelle. */
  question: string | null;
  /** La demande envoyée à la fée ; « {saisie} » est remplacé par la réponse à la question. */
  demande: string;
}

export const RACCOURCIS_ECRAN: readonly RaccourciEcran[] = [
  { id: "courses", nom: "Aux courses", resume: "Demande quoi, puis l'ajoute à la liste de courses.", question: "Quoi ajouter aux courses ?", demande: "Ajoute aux courses : {saisie}" },
  { id: "soir", nom: "Ce soir", resume: "Dit ce qu'il reste à faire ce soir et ce qu'on mange.", question: null, demande: "Qu'est-ce qu'il reste à faire ce soir, et qu'est-ce qu'on mange ?" },
  { id: "depense", nom: "Dépense", resume: "Demande le montant et le libellé, puis la note au budget.", question: "Quelle dépense ? (ex. Migros 84.30)", demande: "Note cette dépense au budget : {saisie}" },
];

/** La phrase à coller dans « Décrire un raccourci » pour un bouton de l'écran d'accueil, avec l'adresse de cet iPhone. */
export function demandeRaccourciEcran(adresse: string, nomFee: string, r: RaccourciEcran): string {
  const corps = r.question ? "le texte de l'étape 1 dans la demande ci-dessous à la place de {saisie}" : "la demande ci-dessous telle quelle";
  return [
    `Crée un raccourci nommé « ${r.nom} » à mettre sur l'écran d'accueil ; il parle à ${nomFee}, l'assistant de notre app, sans que j'aie à ouvrir l'app.`,
    ...(r.question ? [`1. Action « Demander une saisie » : type Texte, question « ${r.question} ».`] : []),
    `${r.question ? "2" : "1"}. Action « Obtenir le contenu de l'URL » :`,
    `- URL : ${adresse}`,
    "- Méthode : POST",
    `- Corps de la requête : JSON, un champ de type Texte nommé demande, qui contient ${corps} :`,
    `« ${r.demande} »`,
    `${r.question ? "3" : "2"}. Action « Afficher la notification » avec le contenu obtenu.`,
    "Pas d'autre action. Propose ensuite de l'ajouter à l'écran d'accueil.",
  ].join("\n");
}
