import { useEffect, useState } from "react";
import { decalerHeure, formaterHeure, HEURE_MAX, HEURE_MIN, type PreferencesRappels } from "../../domaine/rappels";
import type { ServeurRappels } from "../../donnees/distant";
import {
  activerRappels,
  desactiverRappels,
  enregistrerPreferences,
  essayerRappel,
  etatRappels,
  lirePreferences,
  mettreAJourRappels,
  type EtatRappels,
} from "../rappels";

const CHOIX: { cle: "taches" | "mitsu"; titre: string; detail: string }[] = [
  { cle: "taches", titre: "Mes tâches", detail: "Celles que tu as prises et les tâches libres, du jour et en retard." },
  { cle: "mitsu", titre: "Mitsu", detail: "Commande à passer, provisions qui s'épuisent, soins à venir." },
];

export function Notifications(props: {
  serveur: ServeurRappels | null;
  /** Le foyer partagé ; null tant que le partage n'est pas activé sur ce téléphone. */
  foyerId: string | null;
  membreId: string | null;
  ouvrirPartage: () => void;
}) {
  const [etat, setEtat] = useState<EtatRappels | null>(null);
  const [preferences, setPreferences] = useState(lirePreferences);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);

  useEffect(() => {
    etatRappels().then(setEtat, () => setEtat("impossible"));
  }, []);

  const agir = async (action: () => Promise<void>) => {
    setMessage(null);
    setOccupe(true);
    try {
      await action();
    } catch (e) {
      setMessage({ texte: e instanceof Error && e.message ? e.message : "Ça n'a pas marché, réessaie.", erreur: true });
    } finally {
      setOccupe(false);
    }
  };

  const { serveur, foyerId, membreId } = props;
  const pret = serveur && foyerId;
  const heure = formaterHeure(preferences.heure);

  /** Enregistre les choix sur ce téléphone et, si les rappels sont actifs, sur le serveur. */
  const changer = (suivantes: PreferencesRappels) =>
    agir(async () => {
      setPreferences(suivantes);
      enregistrerPreferences(suivantes);
      if (etat === "actifs" && serveur && foyerId) await mettreAJourRappels(serveur, foyerId, membreId, suivantes);
    });

  const reglerHeure = (
    <div className="rappels-reglage-heure">
      <button
        className="bouton-icone"
        aria-label="Une heure plus tôt"
        disabled={occupe || preferences.heure <= HEURE_MIN}
        onClick={() => changer({ ...preferences, heure: decalerHeure(preferences.heure, -1) })}
      >
        −
      </button>
      <p className="rappels-heure" aria-live="polite">{heure}</p>
      <button
        className="bouton-icone"
        aria-label="Une heure plus tard"
        disabled={occupe || preferences.heure >= HEURE_MAX}
        onClick={() => changer({ ...preferences, heure: decalerHeure(preferences.heure, 1) })}
      >
        +
      </button>
    </div>
  );

  return (
    <main className="rappels">
      <h1>Notifications</h1>
      <p className="discret rappels-intro">
        Chaque jour à l'heure que tu choisis, un seul rappel avec ce qui t'attend dans la journée. Rien à faire : pas
        de notification. Chacun règle les siens sur son iPhone.
      </p>

      {etat === null ? null : !pret ? (
        <div className="carte rappels-carte">
          <p>Les rappels partent du serveur du foyer : active d'abord le partage sur ce téléphone.</p>
          <button className="bouton-principal" onClick={props.ouvrirPartage}>Ouvrir le partage</button>
        </div>
      ) : etat === "ecran-accueil" ? (
        <div className="carte rappels-carte">
          <p><strong>Ouvre KoraHome depuis l'écran d'accueil.</strong></p>
          <p className="discret">
            Sur iPhone, seules les apps posées sur l'écran d'accueil peuvent envoyer des notifications. Dans Safari, touche
            Partager puis « Sur l'écran d'accueil », et rouvre KoraHome depuis son icône.
          </p>
        </div>
      ) : etat === "impossible" ? (
        <div className="carte rappels-carte">
          <p>Ce navigateur ne peut pas recevoir de notifications. Il faut iOS 16.4 ou plus récent.</p>
        </div>
      ) : etat === "refuses" ? (
        <div className="carte rappels-carte">
          <p><strong>Les notifications sont refusées sur cet iPhone.</strong></p>
          <p className="discret">Pour les rouvrir : Réglages de l'iPhone, Notifications, KoraHome, puis « Autoriser les notifications ».</p>
        </div>
      ) : etat === "inactifs" ? (
        <div className="carte rappels-carte">
          {reglerHeure}
          <p className="discret">L'iPhone va te demander l'autorisation : touche « Autoriser ».</p>
          <button
            className="bouton-principal"
            disabled={occupe}
            onClick={() =>
              agir(async () => {
                const obtenu = await activerRappels(serveur, foyerId, membreId, preferences);
                setEtat(obtenu);
                if (obtenu === "actifs") setMessage({ texte: `Rappels activés : le prochain arrive à ${heure}.`, erreur: false });
              })
            }
          >
            {occupe ? "Un instant…" : "Activer les rappels du matin"}
          </button>
        </div>
      ) : (
        <>
          <div className="carte rappels-carte rappels-actifs">
            <span className="partage-point" aria-hidden />
            <p>Activés sur cet iPhone, chaque jour à {heure}.</p>
          </div>
          <h2 className="rayon">Heure du rappel</h2>
          <div className="carte rappels-carte">{reglerHeure}</div>
          <h2 className="rayon">Dans le rappel</h2>
          <ul className="carte groupe">
            {CHOIX.map((c) => (
              <li key={c.cle}>
                <button
                  className="ligne"
                  role="switch"
                  aria-checked={preferences[c.cle]}
                  disabled={occupe}
                  onClick={() => changer({ ...preferences, [c.cle]: !preferences[c.cle] })}
                >
                  <span className="ligne-texte rappels-choix">
                    <span>{c.titre}</span>
                    <span className="discret">{c.detail}</span>
                  </span>
                  <span className={`interrupteur${preferences[c.cle] ? " actif" : ""}`} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="rappels-actions">
            <button
              className="lien"
              disabled={occupe}
              onClick={() =>
                agir(async () => {
                  await essayerRappel(serveur);
                  setMessage({ texte: "Envoyé : il arrive dans quelques secondes.", erreur: false });
                })
              }
            >
              Recevoir le rappel d'aujourd'hui maintenant
            </button>
            <button
              className="lien danger"
              disabled={occupe}
              onClick={() =>
                agir(async () => {
                  await desactiverRappels(serveur);
                  setEtat("inactifs");
                })
              }
            >
              Couper les rappels sur cet iPhone
            </button>
          </div>
        </>
      )}
      {message && (
        <p className={message.erreur ? "erreur rappels-message" : "discret rappels-message"} role={message.erreur ? "alert" : "status"}>
          {message.texte}
        </p>
      )}
    </main>
  );
}
