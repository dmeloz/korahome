// L'état du partage, dit en mots simples sur l'accueil et dans Réglages : on sait d'un
// coup d'œil si ce que l'on vient d'écrire est déjà sur l'iPhone de l'autre.

export type EtatSynchro = "inactif" | "en_cours" | "ok" | "erreur";

export interface EtatPartage {
  /** « calme » : tout va bien ; « jour » : en route ; « urgent » : à regarder. */
  ton: "calme" | "jour" | "urgent";
  texte: string;
  detail: string;
}

/**
 * @param enAttente les modifications pas encore envoyées
 * @param derniere la dernière synchro réussie (ISO 8601)
 * @param enLigne le téléphone a internet
 */
export function decrireEtatPartage(entree: { disponible: boolean; etat: EtatSynchro; enAttente: number; derniere: string | null; enLigne: boolean; maintenant: string }): EtatPartage {
  if (!entree.disponible || entree.etat === "inactif") return { ton: "calme", texte: "Sur ce téléphone", detail: "Le partage n'est pas activé : rien ne part sur l'autre iPhone." };
  const depuis = entree.derniere ? ilYA(entree.derniere, entree.maintenant) : null;
  const attente = entree.enAttente === 1 ? "1 changement" : `${entree.enAttente} changements`;
  if (!entree.enLigne) {
    return entree.enAttente
      ? { ton: "jour", texte: `${attente} en attente`, detail: "Pas d'internet : tout partira dès le retour du réseau." }
      : { ton: "calme", texte: "Hors ligne", detail: depuis ? `À jour ${depuis}. Ce que tu changes partira au retour du réseau.` : "Ce que tu changes partira au retour du réseau." };
  }
  if (entree.etat === "erreur") return { ton: "urgent", texte: "Partage en panne", detail: entree.enAttente ? `${attente} pas encore envoyé${entree.enAttente > 1 ? "s" : ""}. Kora réessaie seule.` : "Kora réessaie seule." };
  if (entree.etat === "en_cours" || entree.enAttente > 0) return { ton: "jour", texte: entree.enAttente ? `${attente} en route` : "Mise à jour…", detail: "Envoi vers l'autre iPhone." };
  return { ton: "calme", texte: "À jour", detail: depuis ? `Partagé avec l'autre iPhone ${depuis}.` : "Partagé avec l'autre iPhone." };
}

/** « à l'instant », « il y a 5 min », « il y a 2 h », « hier ». */
export function ilYA(depuis: string, maintenant: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(maintenant) - Date.parse(depuis)) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  return heures < 48 ? "hier" : `il y a ${Math.round(heures / 24)} jours`;
}
