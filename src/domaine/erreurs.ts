import { ErreurValidation } from "./foyer";

// Une erreur qui dit quoi faire : au lieu de « réessaie » partout, Kora reconnaît les pannes
// courantes (réseau, place sur l'iPhone, partage expiré, plafond de l'assistant) et donne le geste
// qui débloque. Une règle du métier garde sa propre phrase.

/** Le texte à montrer pour une erreur, à partir de ce qu'on faisait (« Enregistrer », « Envoyer le mot »). */
export function expliquerErreur(erreur: unknown, quoi = "Ça", horsLigne = false): string {
  if (erreur instanceof ErreurValidation) return erreur.message;
  const m = erreur instanceof Error ? `${erreur.name} ${erreur.message}` : typeof erreur === "string" ? erreur : "";
  if (/QuotaExceeded|quota|no space|NS_ERROR_DOM_QUOTA/i.test(m)) return "L'iPhone manque de place : libère un peu de stockage (photos, apps), puis réessaie. Rien n'est perdu.";
  if (horsLigne || /Failed to fetch|NetworkError|Load failed|network|hors ligne|ECONN|timeout|timed out/i.test(m)) return `${quoi} attend le réseau : c'est gardé sur ce téléphone et partira dès que le wifi ou la 4G revient.`;
  if (/401|403|Connexion requise|JWT|session|Invalid Refresh Token|autre compte/i.test(m)) return "Le partage de ce téléphone a expiré : ouvre Réglages › Partage et relie-le à nouveau avec le code du foyer.";
  if (/plafond|5 CHF|budget mensuel|quota de l'assistant/i.test(m)) return "L'assistant a atteint son plafond du mois : il reprend le 1er. Le reste de Kora marche comme d'habitude.";
  if (/429|rate limit|overloaded|surcharg/i.test(m)) return "Le service est très demandé en ce moment : réessaie dans une minute.";
  if (/IndexedDB|InvalidStateError|database|base de données/i.test(m)) return "La base du téléphone n'a pas répondu : ferme Kora, rouvre-la, puis réessaie. Tes données sont synchronisées.";
  const detail = erreur instanceof Error && erreur.message ? ` (${erreur.message.slice(0, 80)})` : "";
  return `${quoi} n'a pas marché${detail}. Réessaie ; si ça revient, note-le par la pastille Dev pour qu'on le corrige.`;
}
