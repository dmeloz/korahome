import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

/** Les fonctions serveur et les règles qu'elles embarquent : supabase/functions/<nom>/domaine.js. */
export const FONCTIONS = ["rappels", "jarvis", "chef", "agenda", "paiements", "siri"];

/** Le fichier de règles de chaque fonction. */
const SOURCES = { rappels: "rappels", jarvis: "jarvisModele", chef: "chef", agenda: "icloud", paiements: "paiements", siri: "siri" };

/** Le code des règles de la fonction <nom>, réuni en un module sans dépendance. */
export async function construireDomaine(nom = "rappels") {
  const source = SOURCES[nom];
  const paquet = await rolldown({
    input: fileURLToPath(new URL(`../src/domaine/${source}.ts`, import.meta.url)),
    logLevel: "silent",
  });
  // Compacté sans renommer : les fichiers passent dans un seul appel de déploiement (siri faisait
  // 156 Ko) et les noms restent lisibles dans les journaux du serveur.
  const { output } = await paquet.generate({ format: "esm", minify: { compress: true, mangle: false, codegen: true } });
  await paquet.close();
  return `// Généré par \`npm run fonction\` depuis src/domaine/${source}.ts : ne pas modifier à la main.\n${output[0].code}`;
}
