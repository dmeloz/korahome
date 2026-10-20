import { useState } from "react";
import { formaterMontant, lireMontant, nomDuMois, POTS, type PlanBudget, type Pot } from "../../../domaine/budget";
import type { Foyer, Id } from "../../../domaine/types";

/** Petites pièces communes aux onglets et aux feuilles du Budget. */

export const prenomDe = (foyer: Foyer, id: Id | null) => (id ? (foyer.membres.find((m) => m.id === id)?.prenom ?? "") : "Commun");
export const montant = (n: number) => formaterMontant(n);

export const nomDuPot = (plan: PlanBudget, pot: Pot) => plan.comptes[pot] || POTS[pot].nom;
export const leJour = (jour: string) => `${Number(jour.slice(8, 10))} ${nomDuMois(Number(jour.slice(5, 7)))}`;

export const majuscule = (t: string) => t.replace(/^./, (c) => c.toUpperCase());

/** Un montant qu'on tape : il s'enregistre quand on quitte le champ. */
export function ChampMontant(props: { valeur: number; changer: (n: number) => void; libelle: string }) {
  const [texte, setTexte] = useState<string | null>(null);
  const affiche = texte ?? formaterMontant(props.valeur, false).replace(/’/g, "");
  return (
    <input
      className="budget-champ"
      inputMode="decimal"
      aria-label={props.libelle}
      value={affiche}
      onChange={(e) => setTexte(e.target.value)}
      onBlur={() => {
        const n = texte === null ? null : lireMontant(texte);
        if (n !== null) props.changer(n);
        setTexte(null);
      }}
    />
  );
}

export function Puces<T extends string | number>(props: { valeur: T; choix: readonly { v: T; libelle: string }[]; changer: (v: T) => void; libelle: string }) {
  return (
    <div className="budget-choix">
      <span className="discret">{props.libelle}</span>
      <div className="puces" role="group" aria-label={props.libelle}>
      {props.choix.map((c) => (
        <button type="button" key={String(c.v)} className={`puce${c.v === props.valeur ? " active" : ""}`} aria-pressed={c.v === props.valeur} onClick={() => props.changer(c.v)}>
          {c.libelle}
        </button>
      ))}
      </div>
    </div>
  );
}
