// Code commun des fonctions serveur : les en-têtes CORS et les réponses JSON.
// Le téléphone appelle depuis le navigateur : chaque réponse porte les mêmes en-têtes.

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** La réponse à la question préalable du navigateur (OPTIONS), sinon null. */
export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response("ok", { headers: CORS }) : null;
}

export function repondre(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, "Content-Type": "application/json" } });
}

/**
 * Si Claude refuse parce que le compte Anthropic a atteint la limite de dépense réglée dans
 * sa console (pas le plafond de 5 CHF de Kora), la phrase à montrer ; sinon null.
 */
export function limiteDuCompte(e: unknown, qui: string): string | null {
  const message = e instanceof Error ? e.message : String(e);
  if (!/usage limits/i.test(message)) return null;
  const date = message.match(/regain access on (\d{4})-(\d{2})-(\d{2})/);
  const retour = date ? `le ${Number(date[3])}.${date[2]}` : "le mois prochain";
  return `${qui} est en pause : le compte Claude a atteint la limite de dépense réglée dans la console Anthropic. Retour ${retour}, ou dès que la limite est relevée.`;
}

/** Une erreur dont le message est écrit pour la personne : il part tel quel vers le téléphone. */
export class ErreurPublique extends Error {}

/**
 * Le message d'erreur à renvoyer au téléphone. Seuls les messages écrits pour la personne partent
 * tels quels (ErreurPublique ici, ErreurValidation des règles) ; le reste (base de données, réseau,
 * bug) reste dans le journal du serveur, et la personne lit une phrase simple (veille du 26 octobre 2026).
 */
export function messageErreur(e: unknown): string {
  if (e instanceof ErreurPublique) return e.message;
  if (e instanceof Error && e.constructor?.name === "ErreurValidation") return e.message;
  return "Quelque chose a coincé sur le serveur. Réessaie dans un instant.";
}
