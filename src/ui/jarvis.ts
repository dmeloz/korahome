import { annulation, type Modification } from "../domaine/jarvis";
import type { Zone } from "../domaine/jardin";
import type { Animal } from "../domaine/mitsu";
import type { Produit } from "../domaine/stock";
import type { Element, Tache } from "../domaine/types";
import type { Depot } from "../donnees/depot";

// Jarvis passe par le Dépôt, comme les écrans : ce qu'il fait se partage avec l'autre
// iPhone, et se défait d'un toucher sur « Annuler ».

type Ecritures = Pick<
  Depot,
  | "enregistrerElement"
  | "supprimerElements"
  | "enregistrerTache"
  | "supprimerTache"
  | "enregistrerProduit"
  | "supprimerProduit"
  | "enregistrerAnimal"
  | "enregistrerZone"
>;

export async function enregistrerModifications(depot: Ecritures, modifications: readonly Modification[]): Promise<void> {
  for (const m of modifications) {
    if (m.collection === "elements") await depot.enregistrerElement(m.apres);
    else if (m.collection === "taches") await depot.enregistrerTache(m.apres);
    else if (m.collection === "stock") await depot.enregistrerProduit(m.apres);
    else if (m.collection === "jardin") await depot.enregistrerZone(m.apres);
    else await depot.enregistrerAnimal(m.apres);
  }
}

/** Remet chaque document comme avant Jarvis ; ce qu'il avait créé disparaît. */
export async function annulerModifications(depot: Ecritures, modifications: readonly Modification[]): Promise<void> {
  for (const { collection, id, remettre } of annulation(modifications)) {
    if (collection === "elements") await (remettre ? depot.enregistrerElement(remettre as Element) : depot.supprimerElements([id]));
    else if (collection === "taches") await (remettre ? depot.enregistrerTache(remettre as Tache) : depot.supprimerTache(id));
    else if (collection === "stock") await (remettre ? depot.enregistrerProduit(remettre as Produit) : depot.supprimerProduit(id));
    else if (collection === "jardin") {
      // Jarvis ne crée pas de zone : il y a toujours une version d'avant.
      if (remettre) await depot.enregistrerZone(remettre as Zone);
    }
    else if (remettre) await depot.enregistrerAnimal(remettre as Animal);
  }
}

// ----- La voix -----

interface Reconnaissance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function fabriqueReconnaissance(): (new () => Reconnaissance) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Reconnaissance; webkitSpeechRecognition?: new () => Reconnaissance };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** L'iPhone sait-il transcrire la voix dans l'app ? Sinon, la dictée du clavier reste là. */
export const voixDisponible = () => fabriqueReconnaissance() !== null;

/** Au-delà, l'écoute s'arrête d'elle-même : l'iPhone oublie parfois de dire qu'il a fini. */
export const DUREE_ECOUTE_MAX = 15_000;

/**
 * La phrase entendue. Safari sur iPhone répète parfois toute la phrase dans chaque
 * morceau (« ajoute », « ajoute du lait ») : un morceau qui reprend le précédent le remplace.
 */
export function phraseEntendue(morceaux: readonly string[]): string {
  let phrase = "";
  for (const m of morceaux) {
    const t = m.trim();
    if (!t) continue;
    if (!phrase || t.toLowerCase().startsWith(phrase.toLowerCase())) phrase = t;
    else if (!phrase.toLowerCase().endsWith(t.toLowerCase())) phrase = `${phrase} ${t}`;
  }
  return phrase;
}

function messageErreur(code: string): string | null {
  if (code === "not-allowed" || code === "service-not-allowed") return "L'iPhone refuse le micro à Kora : utilise la dictée du clavier (le micro en bas du clavier).";
  if (code === "audio-capture") return "Le micro est occupé, réessaie dans un instant.";
  if (code === "network") return "La reconnaissance de la voix demande internet.";
  if (code === "no-speech" || code === "aborted") return null;
  return "Je n'ai pas bien entendu.";
}

/**
 * Écoute une phrase en français. `enCours` reçoit la transcription au fil de la parole,
 * `fin` la phrase complète (vide si rien n'a été compris), une seule fois quoi qu'il arrive.
 * Renvoie de quoi arrêter.
 */
export function ecouter(
  enCours: (texte: string) => void,
  fin: (texte: string, erreur: string | null) => void,
  minuterie: { attendre: (f: () => void, ms: number) => unknown; annuler: (id: unknown) => void } = {
    attendre: (f, ms) => setTimeout(f, ms),
    annuler: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  },
): () => void {
  const Fabrique = fabriqueReconnaissance();
  if (!Fabrique) {
    fin("", "La voix n'est pas disponible sur ce téléphone.");
    return () => {};
  }
  let texte = "";
  let erreur: string | null = null;
  let termine = false;
  let r: Reconnaissance | null = null;
  let delai: unknown = null;
  const terminer = () => {
    if (termine) return;
    termine = true;
    if (delai !== null) minuterie.annuler(delai);
    fin(texte, erreur);
  };
  const arreter = () => {
    try {
      r?.stop();
    } catch {
      // déjà arrêtée
    }
    // Si l'iPhone ne prévient pas de la fin, on la donne nous-mêmes peu après.
    minuterie.attendre(terminer, 1500);
  };
  try {
    r = new Fabrique();
    r.lang = "fr-FR";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      texte = phraseEntendue(Array.from(e.results, (res) => res[0]?.transcript ?? ""));
      enCours(texte);
    };
    r.onerror = (e) => {
      erreur = messageErreur(e.error);
    };
    r.onend = terminer;
    r.start();
  } catch {
    erreur = "Le micro n'a pas pu démarrer : utilise la dictée du clavier.";
    terminer();
    return () => {};
  }
  delai = minuterie.attendre(arreter, DUREE_ECOUTE_MAX);
  return arreter;
}

/** Jarvis ne parle à voix haute que quand on lui a parlé. */
export function direAVoixHaute(texte: string): void {
  if (typeof speechSynthesis === "undefined" || !texte) return;
  speechSynthesis.cancel();
  const phrase = new SpeechSynthesisUtterance(texte);
  phrase.lang = "fr-FR";
  const voix = speechSynthesis.getVoices().find((v) => v.lang.startsWith("fr"));
  if (voix) phrase.voice = voix;
  speechSynthesis.speak(phrase);
}

// ----- Les photos -----

/** Réduit une photo (même HEIC de l'iPhone) en JPEG d'au plus `cote` pixels : légère à envoyer, lisible par Jarvis. */
export async function photoPourJarvis(fichier: Blob, cote = 1600): Promise<{ type: "image/jpeg"; donnees: string }> {
  const adresse = URL.createObjectURL(fichier);
  try {
    const image = new Image();
    image.src = adresse;
    await image.decode();
    const echelle = Math.min(1, cote / Math.max(image.naturalWidth, image.naturalHeight));
    const toile = document.createElement("canvas");
    toile.width = Math.round(image.naturalWidth * echelle);
    toile.height = Math.round(image.naturalHeight * echelle);
    toile.getContext("2d")!.drawImage(image, 0, 0, toile.width, toile.height);
    return { type: "image/jpeg", donnees: toile.toDataURL("image/jpeg", 0.82).split(",")[1] };
  } finally {
    URL.revokeObjectURL(adresse);
  }
}
