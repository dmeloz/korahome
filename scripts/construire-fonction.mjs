// Copie les règles de chaque fonction serveur (src/domaine/rappels.ts, src/domaine/jarvisModele.ts et
// ce dont elles dépendent) en un seul fichier JavaScript : supabase/functions/<nom>/domaine.js.
// Lancé par `npm run fonction` ; un test vérifie que les fichiers sont à jour.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { construireDomaine, FONCTIONS } from "./domaine-fonction.mjs";

for (const nom of FONCTIONS) {
  const cible = fileURLToPath(new URL(`../supabase/functions/${nom}/domaine.js`, import.meta.url));
  writeFileSync(cible, await construireDomaine(nom));
  console.log(`Écrit : ${cible}`);
}
