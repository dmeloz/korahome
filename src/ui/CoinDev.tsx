import { useEffect, useRef, useState, type FormEvent } from "react";
import { Feuille } from "./Feuille";
import { ErreurValidation } from "../domaine/foyer";
import { GENRES, nouveauRetour, type GenreRetour } from "../domaine/retours";
import type { Depot } from "../donnees/depot";
import { contexteReel } from "./contexte";
import { lireJournal, noter } from "./journal";

// La pastille « Dev », présente sur chaque écran : une note de test en deux
// gestes, marquée toute seule de l'écran, de la version et de son auteur.

export function CoinDev(props: {
  depot: Depot;
  ecran: string;
  membreId: string | null;
  ouvertes: number;
  voirRetours: () => void;
  /** À gauche de la barre Jarvis : la pastille ne couvre plus rien. */
  dansLaBarre?: boolean;
}) {
  const [ouverte, setOuverte] = useState(false);
  const [texte, setTexte] = useState("");
  const [genre, setGenre] = useState<GenreRetour>("bug");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // L'écran au moment où la feuille s'ouvre, pas celui d'après.
  const ecranNote = useRef(props.ecran);
  const champ = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!confirmation) return;
    const minuterie = setTimeout(() => setConfirmation(null), 2500);
    return () => clearTimeout(minuterie);
  }, [confirmation]);

  const ouvrir = () => {
    ecranNote.current = props.ecran;
    setMessage(null);
    setOuverte(true);
    requestAnimationFrame(() => champ.current?.focus());
  };

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    try {
      const retour = nouveauRetour(
        { texte, genre, ecran: ecranNote.current, version: __VERSION__, auteur: props.membreId },
        contexteReel,
        lireJournal(),
      );
      await props.depot.enregistrerRetour(retour);
      noter("note", GENRES[genre], ecranNote.current);
      setTexte("");
      setOuverte(false);
      setConfirmation("Note enregistrée");
    } catch (err) {
      if (err instanceof ErreurValidation) setMessage(err.message);
      else throw err;
    }
  }

  return (
    <>
      {!ouverte && !confirmation && (
        <button className={`pastille-dev${props.dansLaBarre ? " dans-la-barre" : ""}`} onClick={ouvrir} aria-label="Dev : noter un retour de test" data-journal="non">
          Dev{props.ouvertes > 0 && <span className="pastille-dev-compte">{props.ouvertes}</span>}
        </button>
      )}
      {confirmation && <div className="toast" role="status">{confirmation}</div>}
      <Feuille ouverte={ouverte} onFermer={() => setOuverte(false)}>
          <form className="feuille-formulaire" onSubmit={enregistrer} data-journal="non">
            <p className="surtitre feuille-surtitre">
              Retour de test · Kora {__VERSION__} · {ecranNote.current}
            </p>
            <div className="segments" role="radiogroup" aria-label="Genre de la note">
              {(Object.keys(GENRES) as GenreRetour[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={genre === g}
                  className={genre === g ? "actif" : ""}
                  onClick={() => setGenre(g)}
                >
                  {GENRES[g]}
                </button>
              ))}
            </div>
            <textarea
              ref={champ}
              className="champ-note"
              rows={4}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Ce que tu as remarqué…"
            />
            {message && <p className="erreur">{message}</p>}
            <div className="feuille-actions">
              <button
                type="button"
                className="lien"
                onClick={() => {
                  setOuverte(false);
                  props.voirRetours();
                }}
              >
                Voir les retours{props.ouvertes > 0 ? ` (${props.ouvertes})` : ""}
              </button>
              <button type="submit" className="bouton-principal" disabled={texte.trim() === ""}>
                Enregistrer
              </button>
            </div>
          </form>
      </Feuille>
    </>
  );
}
