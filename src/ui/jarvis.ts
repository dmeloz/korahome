import { annulation, type Modification } from "../domaine/jarvis";
import type { Animal } from "../domaine/mitsu";
import type { Produit } from "../domaine/stock";
import type { Element, Tache } from "../domaine/types";
import type { Depot } from "../donnees/depot";

// Jarvis passe par le Dépôt, comme les écrans : ce qu'il fait se partage avec l'autre
// iPhone, et se défait d'un toucher sur « Annuler ».

type Ecritures = Pick<
  Depot,
  "enregistrerElement" | "supprimerElements" | "enregistrerTache" | "supprimerTache" | "enregistrerProduit" | "supprimerProduit" | "enregistrerAnimal"
>;

export async function enregistrerModifications(depot: Ecritures, modifications: readonly Modification[]): Promise<void> {
  for (const m of modifications) {
    if (m.collection === "elements") await depot.enregistrerElement(m.apres);
    else if (m.collection === "taches") await depot.enregistrerTache(m.apres);
    else if (m.collection === "stock") await depot.enregistrerProduit(m.apres);
    else await depot.enregistrerAnimal(m.apres);
  }
}

/** Remet chaque document comme avant Jarvis ; ce qu'il avait créé disparaît. */
export async function annulerModifications(depot: Ecritures, modifications: readonly Modification[]): Promise<void> {
  for (const { collection, id, remettre } of annulation(modifications)) {
    if (collection === "elements") await (remettre ? depot.enregistrerElement(remettre as Element) : depot.supprimerElements([id]));
    else if (collection === "taches") await (remettre ? depot.enregistrerTache(remettre as Tache) : depot.supprimerTache(id));
    else if (collection === "stock") await (remettre ? depot.enregistrerProduit(remettre as Produit) : depot.supprimerProduit(id));
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

/**
 * Écoute une phrase en français. `enCours` reçoit la transcription au fil de la parole,
 * `fin` la phrase complète (vide si rien n'a été compris). Renvoie de quoi arrêter.
 */
export function ecouter(enCours: (texte: string) => void, fin: (texte: string, erreur: string | null) => void): () => void {
  const Fabrique = fabriqueReconnaissance();
  if (!Fabrique) {
    fin("", "La voix n'est pas disponible sur ce téléphone.");
    return () => {};
  }
  const r = new Fabrique();
  r.lang = "fr-FR";
  r.interimResults = true;
  r.continuous = false;
  let texte = "";
  let erreur: string | null = null;
  r.onresult = (e) => {
    texte = Array.from(e.results, (res) => res[0]?.transcript ?? "").join("");
    enCours(texte);
  };
  r.onerror = (e) => {
    erreur = e.error === "not-allowed" || e.error === "service-not-allowed" ? "Autorise le micro pour KoraHome dans les réglages de l'iPhone." : e.error === "no-speech" ? null : "Je n'ai pas bien entendu.";
  };
  r.onend = () => fin(texte.trim(), erreur);
  r.start();
  return () => r.stop();
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
