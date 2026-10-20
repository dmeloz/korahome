import { type Depense, type Pot, POTS } from "./budget";
import { ingredientsPour, type Recette } from "./recettes";
import type { Animal } from "./mitsu";
import type { Membre } from "./types";

// Les exports lisibles : la sauvegarde est un fichier technique ; ici, ce qu'on peut donner
// à quelqu'un d'autre. Le mois du budget en tableur (CSV, s'ouvre dans Numbers et Excel), une
// recette en texte à envoyer, le carnet de Mitsu pour le vétérinaire.

/** Une cellule de CSV : entre guillemets quand elle en a besoin, les guillemets doublés. */
const cellule = (v: string | number) => {
  const t = typeof v === "number" ? v.toFixed(2) : v;
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** Le tableur du mois : une ligne par dépense, point-virgule (le séparateur de Numbers et d'Excel en français), total à la fin. */
export function csvDepenses(depenses: readonly Depense[], membres: readonly Membre[]): string {
  const prenom = (id: string | null) => membres.find((m) => m.id === id)?.prenom ?? "";
  const lignes = [["Date", "Libellé", "Magasin", "Pot", "Montant CHF", "Par", "Source"].join(";")];
  for (const d of [...depenses].sort((a, b) => a.jour.localeCompare(b.jour))) {
    lignes.push([d.jour, d.libelle, d.magasin ?? "", POTS[d.pot as Pot]?.nom ?? d.pot, d.montant, prenom(d.par), d.source].map(cellule).join(";"));
  }
  lignes.push(["Total", "", "", "", depenses.reduce((t, d) => t + d.montant, 0), "", ""].map(cellule).join(";"));
  return `${lignes.join("\n")}\n`;
}

/** Une recette en texte, pour l'envoyer ou l'imprimer, aux portions choisies. */
export function texteRecette(recette: Recette, portions = recette.portions): string {
  const ingredients = ingredientsPour(recette, portions).map((i) => `- ${i.quantite ? `${i.quantite} ` : ""}${i.nom}`);
  const etapes = recette.etapes.map((e, i) => `${i + 1}. ${e}`);
  const parts = [recette.titre, `Pour ${portions} personne${portions > 1 ? "s" : ""}`, "", "Ingrédients", ...ingredients];
  if (etapes.length) parts.push("", "Préparation", ...etapes);
  if (recette.lien) parts.push("", recette.lien);
  return parts.join("\n");
}

const date = (jour: string) => `${jour.slice(8, 10)}.${jour.slice(5, 7)}.${jour.slice(0, 4)}`;

/** Le carnet d'un animal en texte : identité, soins, pesées, journal. À montrer au vétérinaire. */
export function texteCarnet(animal: Animal, membres: readonly Membre[]): string {
  const prenom = (id: string | null) => membres.find((m) => m.id === id)?.prenom;
  const parts = [`Carnet de ${animal.nom}`, `Né${animal.sexe === "male" ? "" : "e"} le ${date(animal.naissance)}${animal.arrivee ? `, à la maison depuis le ${date(animal.arrivee)}` : ""}${animal.sterilise ? ", stérilisé" + (animal.sexe === "male" ? "" : "e") : ""}`];
  const infos = animal.infos ?? {};
  if (infos.puce) parts.push(`Puce : ${infos.puce}`);
  if (infos.veterinaire) parts.push(`Vétérinaire : ${infos.veterinaire}${infos.telephoneVeto ? ` (${infos.telephoneVeto})` : ""}`);
  if (infos.assurance) parts.push(`Assurance : ${infos.assurance}`);
  const soins = [...animal.soins].sort((a, b) => b.date.localeCompare(a.date));
  if (soins.length) parts.push("", "Soins", ...soins.map((s) => `- ${date(s.date)} ${s.libelle}${s.fait ? "" : " (prévu)"}`));
  const pesees = [...animal.pesees].sort((a, b) => b.jour.localeCompare(a.jour));
  if (pesees.length) parts.push("", "Poids", ...pesees.map((p) => `- ${date(p.jour)} ${(p.grammes / 1000).toFixed(2)} kg`));
  const journal = [...(animal.journal ?? [])].sort((a, b) => b.jour.localeCompare(a.jour));
  if (journal.length) parts.push("", "Journal", ...journal.map((j) => `- ${date(j.jour)} ${j.note}${prenom(j.par) ? ` (${prenom(j.par)})` : ""}`));
  if (infos.consignes) parts.push("", "Consignes", infos.consignes);
  return parts.join("\n");
}
