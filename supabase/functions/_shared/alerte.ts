// Code commun des fonctions serveur : écrire la note « Bug serveur » quand l'assistant tombe.
// La note se construit dans les règles (src/domaine/panne.ts, noteServeur) ; ici, on l'écrit
// dans les retours de test du foyer, sans jamais faire échouer la réponse si l'écriture rate.

import { serveur } from "./supabase.ts";

/** Écrit la note (une seule par fonction et par jour) ; vrai si une panne a été signalée. */
export async function signalerPanne(foyerId: string, note: { id: string } | null): Promise<boolean> {
  if (!note || !foyerId) return false;
  const { error } = await serveur
    .from("documents")
    .upsert([{ foyer_id: foyerId, collection: "retours", id: note.id, donnees: note, maj_client: new Date().toISOString() }], {
      onConflict: "foyer_id,collection,id",
      ignoreDuplicates: true,
    });
  if (error) console.error("Note de panne impossible", error.message);
  return true;
}

/** Une erreur dont la panne a déjà été signalée : la réponse dit « Claude est prévenu ». */
export class PanneSignalee extends Error {
  constructor(public cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

type FaireNote = (qui: string, erreur: unknown, jour: string, ctx: { maintenant: () => string }) => { id: string } | null;

/**
 * Lance l'appel à Claude ; s'il échoue sur une panne (pas l'affluence, pas la limite du compte),
 * écrit la note « Bug serveur » du jour et relance l'erreur en `PanneSignalee`.
 */
export async function avecAlerte<T>(foyerId: string, qui: string, faireNote: FaireNote, appel: () => Promise<T>): Promise<T> {
  try {
    return await appel();
  } catch (e) {
    const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(new Date());
    if (await signalerPanne(foyerId, faireNote(qui, e, jour, { maintenant: () => new Date().toISOString() }))) throw new PanneSignalee(e);
    throw e;
  }
}
