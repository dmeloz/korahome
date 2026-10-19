import type { Evenement } from "../../domaine/agenda";
import { useEffect, useState } from "react";
import type { Zone } from "../../domaine/jardin";
import type { Meteo } from "../../domaine/meteo";
import type { Animal } from "../../domaine/mitsu";
import type { Produit } from "../../domaine/stock";
import {
  basculerJour,
  decrireJours,
  formaterHeure,
  lireHeure,
  JOURS_SEMAINE,
  RACCOURCIS_JOURS,
  rappelDuMatin,
  type PreferencesRappels,
} from "../../domaine/rappels";
import type { Foyer, Jour, Tache } from "../../domaine/types";
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

const CHOIX: { cle: "agenda" | "budget" | "taches" | "mitsu" | "stock" | "jardin" | "mots"; titre: string; detail: string }[] = [
  { cle: "agenda", titre: "Agenda", detail: "Les rendez-vous, anniversaires et sorties du jour, les tiens et ceux de nous deux." },
  { cle: "taches", titre: "Mes tâches", detail: "Celles que tu as prises et les tâches libres, du jour et en retard." },
  { cle: "budget", titre: "Factures", detail: "Les factures du Budget à payer dans les trois jours, et celles en retard." },
  { cle: "mitsu", titre: "Mitsu", detail: "Commande à passer, provisions qui s'épuisent, soins à venir." },
  { cle: "stock", titre: "Frigo et placards", detail: "Ce qui arrive à sa date dans les trois jours." },
  { cle: "jardin", titre: "Jardin", detail: "Le gel annoncé pour la nuit et les zones à arroser." },
  { cle: "mots", titre: "Mots du couple", detail: "Quand l'autre t'écrit un petit mot, tout de suite ou à l'heure prévue." },
];

export function Notifications(props: {
  serveur: ServeurRappels | null;
  /** Le foyer partagé ; null tant que le partage n'est pas activé sur ce téléphone. */
  foyerId: string | null;
  membreId: string | null;
  ouvrirPartage: () => void;
  /** Pour l'aperçu du rappel. */
  foyer: Foyer;
  taches: Tache[];
  evenements: Evenement[];
  /** Les factures du Budget à payer bientôt. */
  factures: { libelle: string; echeance: string }[];
  animaux: Animal[];
  produits: Produit[];
  zones: Zone[];
  meteo: Meteo | null;
  aujourdhui: Jour;
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
  const heure = formaterHeure(preferences.heure, preferences.minute);

  /** Enregistre les choix sur ce téléphone et, si les rappels sont actifs, sur le serveur. */
  const changer = (suivantes: PreferencesRappels) =>
    agir(async () => {
      setPreferences(suivantes);
      enregistrerPreferences(suivantes);
      if (etat === "actifs" && serveur && foyerId) await mettreAJourRappels(serveur, foyerId, membreId, suivantes);
    });

  const memesJours = (jours: readonly number[]) =>
    jours.length === preferences.jours.length && jours.every((j) => preferences.jours.includes(j));

  // Comme une alarme de l'app Horloge : la grande heure ouvre la roue de l'iPhone,
  // les jours se cochent un par un ou d'un raccourci.
  const reglerHeure = (
    <>
      <label className="rappels-horloge">
        <span className="rappels-heure" aria-hidden>{heure}</span>
        <span className="discret">{decrireJours(preferences.jours)}</span>
        {/* La roue de l'heure de l'iPhone, comme pour une alarme : heure et minute au choix. */}
        <input
          type="time"
          className="rappels-roue"
          aria-label="Heure du rappel"
          min="05:00"
          max="22:59"
          value={`${String(preferences.heure).padStart(2, "0")}:${String(preferences.minute ?? 0).padStart(2, "0")}`}
          disabled={occupe}
          onChange={(e) => {
            const lue = lireHeure(e.target.value);
            if (lue && (lue.heure !== preferences.heure || lue.minute !== (preferences.minute ?? 0))) changer({ ...preferences, ...lue });
          }}
        />
      </label>
      <div className="rappels-jours" role="group" aria-label="Jours du rappel">
        {JOURS_SEMAINE.map((j) => {
          const actif = preferences.jours.includes(j.numero);
          return (
            <button
              key={j.numero}
              className={`rappels-jour${actif ? " actif" : ""}`}
              aria-pressed={actif}
              aria-label={j.nom}
              disabled={occupe || (actif && preferences.jours.length === 1)}
              onClick={() => changer({ ...preferences, jours: basculerJour(preferences.jours, j.numero) })}
            >
              {j.initiale}
            </button>
          );
        })}
      </div>
      <div className="puces rappels-raccourcis">
        {RACCOURCIS_JOURS.map((r) => (
          <button
            key={r.libelle}
            className={`puce${memesJours(r.jours) ? " active" : ""}`}
            disabled={occupe}
            onClick={() => changer({ ...preferences, jours: [...r.jours] })}
          >
            {r.libelle}
          </button>
        ))}
      </div>
    </>
  );

  // Ce que dirait le rappel si on était au matin, présenté comme une notification de l'iPhone.
  const rappel = rappelDuMatin({ foyer: props.foyer, membreId, evenements: props.evenements, factures: props.factures, taches: props.taches, animaux: props.animaux, produits: props.produits, zones: props.zones, meteo: props.meteo, aujourdhui: props.aujourdhui, preferences });
  const apercu = (
    <>
      <h2 className="rayon">Aperçu</h2>
      {rappel ? (
        <div className="notification-ios" aria-label="Aperçu du rappel">
          <span className="notification-icone" aria-hidden>KH</span>
          <div className="notification-texte">
            <p className="notification-entete">
              <strong>{rappel.titre}</strong>
              <span>{heure}</span>
            </p>
            <p>{rappel.corps}</p>
          </div>
        </div>
      ) : (
        <p className="discret rappels-vide">Rien à signaler aujourd'hui : ce jour-là, pas de notification.</p>
      )}
    </>
  );

  return (
    <main className="rappels">
      <h1>Notifications</h1>
      <p className="discret rappels-intro">
        Aux jours et à l'heure que tu choisis, un seul rappel avec ce qui t'attend dans la journée. Rien à faire : pas
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
        <>
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
        {apercu}
        </>
      ) : (
        <>
          <div className="carte rappels-carte rappels-actifs">
            <span className="partage-point" aria-hidden />
            <p>Activés sur cet iPhone : {decrireJours(preferences.jours).toLowerCase()} à {heure}.</p>
          </div>
          <h2 className="rayon">Horaire</h2>
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
          {apercu}
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
