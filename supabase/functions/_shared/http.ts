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
