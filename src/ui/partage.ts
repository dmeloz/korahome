import { copierRapport } from "./rapport";

// Donner quelque chose de Kora à quelqu'un d'autre : la feuille de partage de l'iPhone (Messages,
// Mail, Fichiers…), et à défaut la copie dans le presse-papiers ou un téléchargement.

/** Un texte par la feuille de partage ; copié si elle manque. « echec » quand la personne a renoncé. */
export async function partagerTexte(titre: string, texte: string): Promise<"partage" | "copie" | "echec"> {
  try {
    if (navigator.share) {
      await navigator.share({ title: titre, text: texte });
      return "partage";
    }
  } catch {
    return "echec"; // partage annulé
  }
  return (await copierRapport(texte)) ? "copie" : "echec";
}

/** Un fichier (tableur, texte) par la feuille de partage, sinon téléchargé. Faux si la personne a renoncé. */
export async function partagerFichier(nom: string, contenu: string, type: string): Promise<boolean> {
  const fichier = new File([contenu], nom, { type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [fichier] })) {
    try {
      await nav.share({ files: [fichier], title: nom });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return false;
      throw e;
    }
  }
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(fichier);
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
  return true;
}
