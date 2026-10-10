// Copie les règles des rappels (src/domaine/rappels.ts et ce dont elles dépendent) en un
// seul fichier JavaScript pour la fonction serveur : supabase/functions/rappels/domaine.js.
// Lancé par `npm run fonction` ; un test vérifie que le fichier est à jour.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { construireDomaine } from "./domaine-fonction.mjs";

const cible = fileURLToPath(new URL("../supabase/functions/rappels/domaine.js", import.meta.url));
writeFileSync(cible, await construireDomaine());
console.log(`Écrit : ${cible}`);
