import { useState } from "react";
import { filDuFoyer, grouperParJour, quiDe, type GesteFil } from "../../domaine/fil";
import { aujourdhuiLocal } from "../contexte";
import { Icone, type NomIcone } from "../Icone";
import type { DonneesModule } from "../modules";
import { Page } from "../pieces";

// Le fil du foyer : ce que chacun a fait ces sept derniers jours, jour par jour. Rien ne
// s'y ajoute à la main, tout vient des tâches, des courses, du budget, du jardin et des mots.

const PICTO: Record<GesteFil, NomIcone> = { tache: "coche", article: "panier", depense: "portefeuille", arrosage: "feuille", mot: "coeur" };

export function Fil(props: { donnees: DonneesModule }) {
  const [maintenant] = useState(() => new Date().toISOString());
  const { foyer, membreId } = props.donnees;
  const entrees = filDuFoyer(props.donnees, maintenant);
  const jours = grouperParJour(entrees, aujourdhuiLocal(), (iso) => aujourdhuiLocal(new Date(iso)));
  const couleur = (par: string | null) => foyer.membres.find((m) => m.id === par)?.couleur;

  return (
    <Page
      titre="Chez nous"
      sousTitre={entrees.length === 0 ? "Ce que chacun fait, au fil des jours" : `${entrees.length} geste${entrees.length > 1 ? "s" : ""} cette semaine`}
      aide={{ cle: "fil", texte: "Chaque tâche cochée, article ajouté, dépense notée, arrosage ou mot laissé apparaît ici avec son prénom. Ni score ni classement : juste ce qui s'est passé à la maison." }}
    >
      {jours.length === 0 && <p className="vide">Rien cette semaine encore. Dès qu'un de vous coche une tâche ou ajoute aux courses, ça s'écrit ici.</p>}
      {jours.map((j) => (
        <section key={j.jour}>
          <h2 className="rayon">{j.titre}</h2>
          <ul className="carte groupe">
            {j.entrees.map((e) => (
              <li key={e.cle} className="ligne fil-ligne">
                <span className="fil-heure">{new Date(e.quand).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="fil-picto" style={couleur(e.par) ? { color: couleur(e.par) } : undefined} aria-hidden><Icone nom={PICTO[e.geste]} taille={16} /></span>
                <span className="ligne-texte">
                  <strong>{quiDe(e, foyer, membreId)}</strong> {e.texte}
                  <span className="discret fil-espace">{e.espace}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Page>
  );
}
