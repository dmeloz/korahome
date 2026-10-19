import { sousTitreCarte, type CarteDuJour, type ChoseDuJour } from "../../domaine/aujourdhui";
import { PointEtat } from "./Page";

// La carte « Aujourd'hui » en haut de l'accueil : trois choses, dans l'ordre. Ses données
// (domaine/aujourdhui.ts) sont celles que reprendront le widget de l'iPhone et Siri.

export function CarteAujourdhui(props: { carte: CarteDuJour; toucher: (chose: ChoseDuJour) => void; voirTout?: () => void }) {
  const { carte } = props;
  return (
    <section className="carte-jour" aria-label="Aujourd'hui">
      <header className="carte-jour-entete">
        <h2>Aujourd'hui</h2>
        <span>{sousTitreCarte(carte)}</span>
      </header>
      {carte.choses.length === 0 ? (
        <p className="carte-jour-vide">Rien d'urgent ni de prévu. Bonne journée.</p>
      ) : (
        <ul>
          {carte.choses.map((c) => (
            <li key={c.cle}>
              <button className="carte-jour-ligne" onClick={() => props.toucher(c)}>
                <PointEtat etat={c.etat} />
                <span className="carte-jour-texte">{c.texte}</span>
                <span className={`carte-jour-quand ${c.etat}`}>{c.quand}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {carte.autres > 0 && props.voirTout && (
        <button className="lien carte-jour-plus" onClick={props.voirTout}>
          {carte.autres === 1 ? "Et une autre chose" : `Et ${carte.autres} autres choses`}
        </button>
      )}
    </section>
  );
}
