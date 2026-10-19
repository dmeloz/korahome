import { decrireGaspillage, souventJete, trouverHabituel, type ProduitHabituel } from "../domaine/catalogue";
import { quantiteHabituelle } from "../domaine/habitudes";
import { nouvelElement, trouverDoublon } from "../domaine/listes";
import type { Element, Liste } from "../domaine/types";
import type { Depot } from "../donnees/depot";
import { contexteReel } from "./contexte";

// Ajouter des articles à une liste, depuis la barre Jarvis comme depuis les suggestions :
// sans doublon, avec la quantité de d'habitude, et un mot quand un produit finit souvent périmé.

export async function ajouterArticles(
  depot: Pick<Depot, "enregistrerElement">,
  liste: Liste,
  elements: readonly Element[],
  textes: readonly string[],
  membreId: string | null,
  catalogue: readonly ProduitHabituel[] = [],
): Promise<{ ajoutes: Element[]; doublons: string[]; conseil: string | null }> {
  const siens = elements.filter((e) => e.listeId === liste.id);
  const ajoutes: Element[] = [];
  const doublons: string[] = [];
  let conseil: string | null = null;
  for (const texte of textes) {
    const doublon = trouverDoublon([...siens, ...ajoutes], texte);
    if (doublon) {
      doublons.push(doublon.texte);
      continue;
    }
    const element = nouvelElement(liste, texte, membreId, contexteReel);
    const habituelle = liste.type === "courses" && !element.quantite ? quantiteHabituelle(liste, element.texte) : null;
    const final = habituelle ? { ...element, quantite: habituelle } : element;
    await depot.enregistrerElement(final);
    ajoutes.push(final);
    const base = trouverHabituel([...catalogue], element.texte);
    if (base && souventJete(base)) conseil = `${base.nom} a souvent fini périmé (${decrireGaspillage(base)}) : prends-en un peu moins.`;
  }
  return { ajoutes, doublons, conseil };
}
