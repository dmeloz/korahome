import { creerSauvegarde, lireSauvegarde, nomFichier, type ContenuFoyer, type Sauvegarde } from "../domaine/sauvegarde";
import type { DocAgenda } from "../domaine/agenda";
import type { Depot } from "../donnees/depot";
import { ErreurValidation } from "../domaine/foyer";

// La sauvegarde de la semaine sur l'iPhone : le fichier part par la feuille de partage
// (« Enregistrer dans Fichiers », iCloud Drive, le dossier de l'Atelier), et revient d'un
// toucher. Le jour de la dernière sauvegarde reste sur ce téléphone.

const CLE = "korahome.derniereSauvegarde";

export function lireDerniereSauvegarde(): string | null {
  try {
    return localStorage.getItem(CLE);
  } catch {
    return null;
  }
}

function noterSauvegarde(quand: string): void {
  try {
    localStorage.setItem(CLE, quand);
  } catch {
    // Stockage indisponible : Kora reproposera la sauvegarde, sans gravité.
  }
}

/** Écrit le fichier et le confie à l'iPhone. Renvoie faux si la personne a renoncé. */
export async function exporterSauvegarde(contenu: ContenuFoyer): Promise<boolean> {
  const maintenant = new Date().toISOString();
  const sauvegarde = creerSauvegarde(contenu, __VERSION__, maintenant);
  const nom = nomFichier(contenu.foyer, maintenant);
  const fichier = new File([JSON.stringify(sauvegarde)], nom, { type: "application/json" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [fichier] })) {
    try {
      await nav.share({ files: [fichier], title: nom });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return false;
      throw e;
    }
  } else {
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(fichier);
    lien.download = nom;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
  }
  noterSauvegarde(maintenant);
  return true;
}

export async function lireFichierSauvegarde(fichier: File): Promise<Sauvegarde> {
  return lireSauvegarde(await fichier.text());
}

/** Remet chaque document de la sauvegarde ; ce qui a changé depuis est remplacé. */
export async function reprendreSauvegarde(depot: Depot, s: Sauvegarde, foyerActuel: string): Promise<void> {
  if (s.foyer.id !== foyerActuel) throw new ErreurValidation("Cette sauvegarde est celle d'un autre foyer.");
  await depot.enregistrerFoyer(s.foyer);
  for (const l of s.listes) await depot.enregistrerListe(l);
  for (const e of s.elements) await depot.enregistrerElement(e);
  if (s.taches.length) await depot.enregistrerTaches(s.taches);
  for (const a of s.animaux) await depot.enregistrerAnimal(a);
  for (const p of s.produits) await depot.enregistrerProduit(p);
  for (const h of s.catalogue) await depot.enregistrerHabituel(h);
  for (const z of s.zones) await depot.enregistrerZone(z);
  for (const x of s.souvenirs) await depot.enregistrerSouvenir(x);
  for (const c of s.couple) await depot.enregistrerCouple(c);
  for (const m of s.menus) await depot.enregistrerMenu(m);
  for (const d of s.agenda as DocAgenda[]) await depot.enregistrerAgenda(d);
  for (const b of s.budget) await depot.enregistrerBudget(b);
  for (const r of s.retours) await depot.enregistrerRetour(r);
}
