import type { Changement } from "../domaine/synchro";
import type { Distant } from "./distant";

/**
 * Le serveur partagé en mémoire, pour les tests : mêmes règles que supabase/schema.sql
 * (une ligne par document, la plus récente gagne, heure du serveur pour le curseur).
 */
export function serveurFactice() {
  const lignes = new Map<string, Changement & { foyerId: string; majServeur: string }>();
  let t = Date.parse("2026-10-09T12:00:00.000Z");
  let panne = false;
  const distant: Distant = {
    async lire(foyerId, depuis) {
      if (panne) throw new Error("Serveur injoignable");
      const lues = [...lignes.values()]
        .filter((l) => l.foyerId === foyerId && (depuis === null || l.majServeur > depuis))
        .sort((a, b) => a.majServeur.localeCompare(b.majServeur));
      return {
        changements: lues.map(({ collection, id, donnees, maj }) => ({ collection, id, donnees: structuredClone(donnees), maj })),
        curseur: lues.at(-1)?.majServeur ?? null,
      };
    },
    async envoyer(foyerId, changements) {
      if (panne) throw new Error("Serveur injoignable");
      for (const c of changements) {
        const cle = `${foyerId}/${c.collection}/${c.id}`;
        const avant = lignes.get(cle);
        if (avant && c.maj < avant.maj) continue;
        lignes.set(cle, { ...structuredClone(c), foyerId, majServeur: new Date((t += 1000)).toISOString() });
      }
    },
  };
  return {
    distant,
    lignes,
    tomberEnPanne: (oui: boolean) => {
      panne = oui;
    },
  };
}
