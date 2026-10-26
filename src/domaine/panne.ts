// Quand l'assistant tombe : la fonction serveur (Jarvis, Siri, le Chef) écrit elle-même une note
// « Bug serveur » dans les retours de test du foyer, que Claude lit à la veille suivante.
// Le 26 octobre 2026, Tael est resté muet seize heures sans que personne ne le sache : un refus
// de l'API ne prévenait personne. Logique pure : la fonction serveur écrit la note.

import type { RetourTest } from "./retours";
import type { Contexte } from "./types";

/** Ce que l'erreur dit d'elle-même : le statut HTTP de l'API Claude, s'il y en a un, et son message. */
function lireErreur(erreur: unknown): { statut: number | null; message: string } {
  const statut = typeof (erreur as { status?: unknown })?.status === "number" ? (erreur as { status: number }).status : null;
  const message = erreur instanceof Error ? erreur.message : String(erreur);
  return { statut, message };
}

/**
 * Vrai si l'erreur est une panne à signaler : pas une affluence passagère (429), pas la limite
 * de dépense du compte (déjà dite clairement à la personne), pas un délai dépassé par le réseau.
 */
export function panneASignaler(erreur: unknown): boolean {
  const { statut, message } = lireErreur(erreur);
  if (statut === 429 || statut === 529) return false;
  if (/usage limits/i.test(message)) return false;
  return true;
}

/** Le nom court de la fonction dans l'identifiant de la note : « Jarvis » donne « jarvis ». */
function cle(qui: string): string {
  return qui
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * La note « Bug serveur » d'une panne, ou null si l'erreur n'en est pas une. Une seule note par
 * fonction et par jour : l'identifiant est fixe, une deuxième panne le même jour ne l'écrit pas
 * de nouveau. Le texte garde le statut et le début du message de l'API, jamais la demande.
 */
export function noteServeur(qui: string, erreur: unknown, jour: string, ctx: Pick<Contexte, "maintenant">): RetourTest | null {
  if (!panneASignaler(erreur)) return null;
  const { statut, message } = lireErreur(erreur);
  const detail = message.replace(/\s+/g, " ").trim().slice(0, 300);
  return {
    id: `serveur-${cle(qui)}-${jour}`,
    texte: `Bug serveur : ${qui} n'a pas pu répondre (${statut ? `statut ${statut}` : "erreur"} : ${detail || "sans message"}). Note écrite seule par le serveur.`,
    genre: "bug",
    ecran: `Serveur · ${qui}`,
    version: "serveur",
    auteur: null,
    creeLe: ctx.maintenant(),
    regleLe: null,
  };
}

/** La phrase dite à la personne quand la panne a été signalée. */
export function phrasePanne(qui: string): string {
  return `${qui} a un souci de son côté. Claude est prévenu ; réessaie un peu plus tard.`;
}
