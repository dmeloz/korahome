import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

/** Les fonctions serveur et les règles qu'elles embarquent : supabase/functions/<nom>/domaine.js. */
export const FONCTIONS = ["rappels", "jarvis"];

/** Le code de src/domaine/<nom>.ts, réuni en un module sans dépendance. */
export async function construireDomaine(nom = "rappels") {
  const paquet = await rolldown({
    input: fileURLToPath(new URL(`../src/domaine/${nom}.ts`, import.meta.url)),
    logLevel: "silent",
  });
  const { output } = await paquet.generate({ format: "esm" });
  await paquet.close();
  return `// Généré par \`npm run fonction\` depuis src/domaine/${nom}.ts : ne pas modifier à la main.\n${output[0].code}`;
}
