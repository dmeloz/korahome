import { changerHeure, heureApprise, heureDe, heureProposee } from "../../domaine/taches";
import type { Tache } from "../../domaine/types";
import { Feuille } from "../Feuille";
import { vibrer } from "../haptique";

// L'heure d'une tâche, réglée d'un toucher : la roue de l'iPhone, comme pour une alarme, et
// « Sans heure » dessous. Kora propose l'heure où la tâche est faite d'habitude ; une heure
// choisie ici n'est plus jamais remplacée, sauf si on rend la main à Kora.
// Équivalent natif : DatePicker(displayedComponents: .hourAndMinute) dans une sheet.

export function FeuilleHeure(props: { tache: Tache | null; enregistrer: (t: Tache) => void; fermer: () => void }) {
  const t = props.tache;
  const heure = t ? heureDe(t) : null;
  const proposee = t ? heureProposee(t) : null;
  const choisir = (valeur: string | null | undefined) => {
    if (!t) return;
    vibrer();
    props.enregistrer(changerHeure(t, valeur));
  };
  return (
    <Feuille ouverte={!!t} onFermer={props.fermer} titre={t?.titre}>
      {t && (
        <div className="feuille-heure">
          <label className="rappels-horloge">
            <span className={`rappels-heure${heure ? "" : " sans"}`} aria-hidden>{heure ?? "--:--"}</span>
            <span className="discret">{heure ? "Touche l'heure pour la changer" : "Touche pour donner une heure"}</span>
            <input
              type="time"
              className="rappels-roue"
              aria-label={`Heure de « ${t.titre} »`}
              value={heure ?? ""}
              onChange={(e) => e.target.value && e.target.value !== heure && choisir(e.target.value)}
            />
          </label>
          <p className="discret feuille-heure-note">
            {heureApprise(t)
              ? `Kora propose ${proposee}, l'heure où elle est faite d'habitude.`
              : t.heure !== undefined && proposee
                ? `D'habitude, elle est faite vers ${proposee}.`
                : !proposee
                  ? "Après trois fois, Kora proposera l'heure où elle est faite d'habitude."
                  : ""}
          </p>
          <div className="feuille-heure-actions">
            {heure !== null && (
              <button className="lien" onClick={() => choisir(null)}>Sans heure</button>
            )}
            {t.heure !== undefined && (
              <button className="lien" onClick={() => choisir(undefined)}>{proposee ? `Laisser Kora choisir (${proposee})` : "Laisser Kora choisir"}</button>
            )}
          </div>
        </div>
      )}
    </Feuille>
  );
}
