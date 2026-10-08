import { mkdirSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { Connect, Plugin } from "vite";

// Dépôt automatique des rapports de test sur le Mac qui sert l'app : le bouton
// « Envoyer au Mac » de l'iPhone poste le rapport ici, et il est écrit dans
// retours-de-test/ (ignoré par Git), où Claude le lit directement.

export const CHEMIN = "/__kora/retours";
export const TAILLE_MAX = 1024 * 1024;
const ENTETE = /^# Rapport Kora (\d+\.\d+\.\d+)\b/;

export class RapportRefuse extends Error {
  constructor(
    message: string,
    readonly statut: number,
  ) {
    super(message);
  }
}

/**
 * Écrit le rapport dans le dossier, sous un nom choisi ici (jamais par le
 * téléphone), et met à jour « dernier-rapport.md ». Renvoie le nom du fichier.
 */
export function deposerRapport(dossier: string, contenu: string, maintenant = new Date()): string {
  if (Buffer.byteLength(contenu) > TAILLE_MAX) throw new RapportRefuse("Rapport trop volumineux.", 413);
  const entete = contenu.match(ENTETE);
  if (!entete) throw new RapportRefuse("Ce n'est pas un rapport Kora.", 400);
  const horodatage = maintenant.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const nom = `kora-${entete[1]}-${horodatage}.md`;
  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, nom), contenu, "utf8");
  writeFileSync(join(dossier, "dernier-rapport.md"), contenu, "utf8");
  return nom;
}

function lireCorps(req: IncomingMessage): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const morceaux: Buffer[] = [];
    let taille = 0;
    req.on("data", (m: Buffer) => {
      taille += m.length;
      if (taille > TAILLE_MAX) {
        rejeter(new RapportRefuse("Rapport trop volumineux.", 413));
        req.destroy();
      } else morceaux.push(m);
    });
    req.on("end", () => resoudre(Buffer.concat(morceaux).toString("utf8")));
    req.on("error", rejeter);
  });
}

/** Une autre page web ne peut pas déposer de fichier : seule l'app elle-même, servie par ce Mac. */
export function origineAcceptee(origine: string | undefined, hote: string | undefined): boolean {
  if (!origine) return true;
  try {
    return new URL(origine).host === hote;
  } catch {
    return false;
  }
}

export function gestionnaire(dossier: string): Connect.NextHandleFunction {
  return (req, res: ServerResponse) => {
    const repondre = (statut: number, corps: object) => {
      res.statusCode = statut;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(corps));
    };
    if (req.method !== "POST") return repondre(405, { erreur: "Méthode non permise." });
    if (!origineAcceptee(req.headers.origin, req.headers.host)) return repondre(403, { erreur: "Origine refusée." });
    lireCorps(req)
      .then((corps) => repondre(201, { fichier: deposerRapport(dossier, corps) }))
      .catch((e: unknown) =>
        repondre(e instanceof RapportRefuse ? e.statut : 500, { erreur: e instanceof Error ? e.message : "Erreur." }),
      );
  };
}

/** Branche la réception des rapports sur le serveur de développement et sur `npm run serveur`. */
export function recevoirRapports(dossier: string): Plugin {
  return {
    name: "korahome-retours-de-test",
    configureServer: (serveur) => void serveur.middlewares.use(CHEMIN, gestionnaire(dossier)),
    configurePreviewServer: (serveur) => void serveur.middlewares.use(CHEMIN, gestionnaire(dossier)),
  };
}
