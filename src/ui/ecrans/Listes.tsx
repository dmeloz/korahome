import { useState, type FormEvent } from "react";
import { compterAPrendre, nouvelleListe } from "../../domaine/listes";
import type { Element, Liste } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { contexteReel } from "../contexte";
import { Icone } from "../Icone";

export function Listes(props: {
  depot: Depot;
  listes: Liste[];
  elements: Element[];
  ouvrirListe: (id: string) => void;
}) {
  const [nom, setNom] = useState("");

  async function creer(e: FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    await props.depot.enregistrerListe(nouvelleListe(nom, "📝", "simple", contexteReel));
    setNom("");
  }

  return (
    <main>
      <h1>Listes</h1>
      <ul className="carte groupe">
        {props.listes.map((l) => {
          const n = compterAPrendre(l, props.elements);
          return (
            <li key={l.id}>
              <button className="ligne" onClick={() => props.ouvrirListe(l.id)}>
                <span className="pictogramme"><Icone nom={l.type === "courses" ? "panier" : "liste"} taille={20} /></span>
                <span className="ligne-texte">{l.nom}</span>
                {n > 0 && <span className="pastille">{n}</span>}
                <span className="chevron"><Icone nom="suivant" taille={18} /></span>
              </button>
            </li>
          );
        })}
      </ul>
      <form onSubmit={creer} className="ajout">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nouvelle liste (cadeaux, bricolage…)" />
        <button type="submit" disabled={!nom.trim()} aria-label="Créer la liste">+</button>
      </form>
    </main>
  );
}
