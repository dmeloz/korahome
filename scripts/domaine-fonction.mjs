import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

/** Le code de src/domaine/rappels.ts, réuni en un module sans dépendance. */
export async function construireDomaine() {
  const paquet = await rolldown({
    input: fileURLToPath(new URL("../src/domaine/rappels.ts", import.meta.url)),
    logLevel: "silent",
  });
  const { output } = await paquet.generate({ format: "esm" });
  await paquet.close();
  return `// Généré par \`npm run fonction\` depuis src/domaine/rappels.ts : ne pas modifier à la main.\n${output[0].code}`;
}
