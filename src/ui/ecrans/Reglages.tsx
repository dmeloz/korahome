import { useState, type ReactNode } from "react";
import { Feuille } from "../Feuille";
import type { Foyer } from "../../domaine/types";
import { decrireJours, formaterHeure } from "../../domaine/rappels";
import { lirePreferences } from "../rappels";
import { Icone, type NomIcone } from "../Icone";
import { MESSAGES_VERIFICATION, type ResultatVerification } from "../miseAJour";
import type { EtatPartage } from "../../domaine/etatPartage";
import { decrireDerniere } from "../../domaine/sauvegarde";
import { aujourdhuiLocal } from "../contexte";
import { lireDerniereSauvegarde } from "../sauvegarde";
import { nomFee, sonActif } from "../fee";
import { choisirTheme, lireTheme, THEMES, type Theme } from "../theme";
import { enregistrerDate, enregistrerVerre, lireDate, lireVerre, TAILLE_DATE } from "../accueilLocal";
import { Page } from "../pieces";

const ETATS_PARTAGE = { indisponible: "Bientôt", inactif: "Désactivé", actif: "Activé" } as const;

// Des Réglages épurés, à la manière de ceux de l'iPhone : la personne du
// téléphone en tête, puis quelques lignes groupées, chacune avec son pictogramme.

function Ligne(props: { picto: NomIcone; titre: string; valeur?: ReactNode; onClick: () => void; chevron?: boolean; alerte?: boolean }) {
  return (
    <li>
      <button className="ligne ligne-reglage" onClick={props.onClick}>
        <span className="picto-reglage"><Icone nom={props.picto} taille={18} /></span>
        <span className="ligne-texte">{props.titre}</span>
        {props.alerte && <span className="alerte alerte-ligne" aria-hidden />}
        {props.valeur !== undefined && <span className="discret valeur-reglage">{props.valeur}</span>}
        {props.chevron !== false && <span className="chevron"><Icone nom="suivant" taille={16} /></span>}
      </button>
    </li>
  );
}

export function Reglages(props: {
  foyer: Foyer;
  membreId: string | null;
  ouvrirTelephone: () => void;
  verifierMiseAJour: () => Promise<ResultatVerification>;
  nouvelleVersion: boolean;
  appliquerMiseAJour: () => void;
  notesOuvertes: number;
  ouvrirRetours: () => void;
  ouvrirPartage: () => void;
  ouvrirNotifications: () => void;
  ouvrirAppris: () => void;
  ouvrirApparence: () => void;
  ouvrirSauvegarde: () => void;
  ouvrirCalendrier: () => void;
  ouvrirSiri: () => void;
  ouvrirFee: () => void;
  siri: string;
  revoirVisite: () => void;
  calendrier: string;
  calendrierEnErreur: boolean;
  etatPartage: EtatPartage;
  partage: "indisponible" | "inactif" | "actif";
  pastilleVisible: boolean;
  changerPastille: (visible: boolean) => void;
}) {
  const [verification, setVerification] = useState<string | null>(null);
  const moi = props.foyer.membres.find((m) => m.id === props.membreId);
  const rappels = lirePreferences();

  const version = async () => {
    if (props.nouvelleVersion) return props.appliquerMiseAJour();
    setVerification("Vérification…");
    setVerification(MESSAGES_VERIFICATION[await props.verifierMiseAJour()]);
  };

  return (
    <Page titre="Réglages" className="reglages avec-cadre">

      <button className="carte profil" onClick={props.ouvrirTelephone}>
        <span className="initiale profil-initiale" style={{ background: moi?.couleur ?? "var(--surface-haute)" }}>
          {moi?.prenom.charAt(0) ?? "?"}
        </span>
        <span className="profil-texte">
          <strong>{moi?.prenom ?? "Qui utilise ce téléphone ?"}</strong>
          <span className="discret">{props.foyer.nom} · ce téléphone</span>
        </span>
        {moi && <span className="verrou-cadenas" aria-label="verrouillé"><Icone nom="cadenas" taille={16} /></span>}
        <span className="chevron"><Icone nom="suivant" taille={16} /></span>
      </button>

      <ul className="carte groupe">
        <Ligne picto="lune" titre="Apparence" valeur={THEMES.find((t) => t.id === lireTheme())?.libelle} onClick={props.ouvrirApparence} />
      </ul>

      <ul className="carte groupe">
        <Ligne picto="partage" titre="Partage" valeur={props.partage === "actif" ? props.etatPartage.texte : ETATS_PARTAGE[props.partage]} alerte={props.etatPartage.ton === "urgent"} onClick={props.ouvrirPartage} />
        <Ligne picto="sauvegarde" titre="Sauvegarde" valeur={decrireDerniere(lireDerniereSauvegarde(), aujourdhuiLocal())} onClick={props.ouvrirSauvegarde} />
        <Ligne
          picto="cloche"
          titre="Notifications"
          valeur={`${formaterHeure(rappels.heure, rappels.minute)} · ${decrireJours(rappels.jours)}`}
          onClick={props.ouvrirNotifications}
        />
        <Ligne picto="calendrier" titre="Calendrier de l'iPhone" valeur={props.calendrier} alerte={props.calendrierEnErreur} onClick={props.ouvrirCalendrier} />
        <Ligne picto="jarvis" titre={nomFee()} valeur={sonActif() ? "Son activé" : "Sans son"} onClick={props.ouvrirFee} />
        <Ligne picto="micro" titre="Siri" valeur={props.siri} onClick={props.ouvrirSiri} />
        <Ligne picto="appris" titre={`Ce que ${nomFee()} sait`} onClick={props.ouvrirAppris} />
      </ul>

      <ul className="carte groupe">
        <Ligne
          picto="info"
          titre={`Kora ${__VERSION__}`}
          valeur={props.nouvelleVersion ? "Mettre à jour" : verification ?? "Vérifier"}
          alerte={props.nouvelleVersion}
          chevron={false}
          onClick={() => void version()}
        />
        <Ligne picto="info" titre="Visite guidée" valeur="Revoir" onClick={props.revoirVisite} />
      </ul>

      <h2 className="rayon">Développement</h2>
      <ul className="carte groupe">
        <Ligne
          picto="note"
          titre="Retours de test"
          valeur={props.notesOuvertes > 0 ? <span className="pastille">{props.notesOuvertes}</span> : undefined}
          onClick={props.ouvrirRetours}
        />
        <li>
          <button
            className="ligne ligne-reglage"
            role="switch"
            aria-checked={props.pastilleVisible}
            onClick={() => props.changerPastille(!props.pastilleVisible)}
          >
            <span className="picto-reglage"><Icone nom="pastilleDev" taille={18} /></span>
            <span className="ligne-texte">Pastille « Dev »</span>
            <span className={`interrupteur${props.pastilleVisible ? " actif" : ""}`} aria-hidden />
          </button>
        </li>
      </ul>
    </Page>
  );
}

/**
 * « Ce téléphone » : qui l'utilise, ce qui décide des tâches « miennes », des rappels
 * et de la signature des notes. Une fois choisie, la personne est verrouillée :
 * en changer demande une confirmation, pour qu'un toucher distrait ne mélange rien.
 */
export function Telephone(props: { foyer: Foyer; membreId: string | null; choisir: (id: string) => void }) {
  const moi = props.foyer.membres.find((m) => m.id === props.membreId);
  const [deverrouille, setDeverrouille] = useState(!moi);
  const [confirmer, setConfirmer] = useState(false);

  return (
    <Page titre="Ce téléphone" className="reglages avec-cadre">
      <h2 className="rayon">Qui l'utilise</h2>
      {moi && !deverrouille ? (
        <>
          <div className="carte profil verrou">
            <span className="initiale profil-initiale" style={{ background: moi.couleur }}>{moi.prenom.charAt(0)}</span>
            <span className="profil-texte">
              <strong>{moi.prenom}</strong>
              <span className="discret">Ce téléphone est à {moi.prenom}</span>
            </span>
            <span className="verrou-cadenas" aria-label="verrouillé"><Icone nom="cadenas" taille={20} /></span>
          </div>
          <p className="discret rappels-intro">
            Les tâches « miennes », les rappels du matin et la signature des notes sont à son nom. Ce réglage reste sur cet
            iPhone.
          </p>
          <button className="lien" onClick={() => setConfirmer(true)}>Changer de personne</button>
        </>
      ) : (
        <>
          <p className="discret rappels-intro">
            Qui l'utilise ? Ce choix décide de tes tâches, de tes rappels et de la signature de tes notes. Il se verrouille
            ensuite sur cet iPhone.
          </p>
          <ul className="carte groupe">
            {props.foyer.membres.map((m) => (
              <li key={m.id}>
                <button
                  className="ligne ligne-reglage"
                  onClick={() => {
                    props.choisir(m.id);
                    setDeverrouille(false);
                  }}
                >
                  <span className="initiale" style={{ background: m.couleur }}>{m.prenom.charAt(0)}</span>
                  <span className="ligne-texte">{m.prenom}</span>
                  {props.membreId === m.id && <span className="coche-reglage" aria-label="sélectionné"><Icone nom="coche" taille={18} /></span>}
                </button>
              </li>
            ))}
          </ul>
          {moi && <button className="lien" onClick={() => setDeverrouille(false)}>Garder {moi.prenom}</button>}
        </>
      )}

      {moi && (
        <Feuille ouverte={confirmer} onFermer={() => setConfirmer(false)} alerte titre="Changer de personne ?">
            <h2>Changer de personne ?</h2>
            <p className="discret">
              Ce téléphone ne sera plus à {moi.prenom} : ses tâches et ses rappels passeront à la personne choisie.
            </p>
            <div className="feuille-actions">
              <button
                className="bouton-principal"
                onClick={() => {
                  setConfirmer(false);
                  setDeverrouille(true);
                }}
              >
                Changer
              </button>
              <button className="lien" onClick={() => setConfirmer(false)}>Annuler</button>
            </div>
        </Feuille>
      )}
    </Page>
  );
}

/** « Apparence » : le thème, le verre des widgets et la taille de la date, propres à ce téléphone. */
export function Apparence() {
  const [theme, setTheme] = useState<Theme>(lireTheme);
  return (
    <Page titre="Apparence" sousTitre="Sur ce téléphone seulement" className="reglages avec-cadre">
      <h2 className="rayon">Thème</h2>
      <div className="choix-theme" role="radiogroup" aria-label="Thème de ce téléphone">
        {THEMES.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={theme === t.id}
            className={`theme-carte theme-${t.id}${theme === t.id ? " actif" : ""}`}
            onClick={() => {
              choisirTheme(t.id);
              setTheme(t.id);
            }}
          >
            <span className="theme-apercu" aria-hidden><span /><span /><span /></span>
            <strong>{t.libelle}</strong>
            <span className="discret">{t.detail}</span>
          </button>
        ))}
      </div>
      <ReglagesAccueil theme={theme} />
    </Page>
  );
}

/** Le verre des widgets et la taille de la date. */
function ReglagesAccueil({ theme }: { theme: Theme }) {
  const sombre = theme === "sombre" || (theme === "auto" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const [verre, setVerre] = useState<number | null>(lireVerre);
  const [date, setDate] = useState(lireDate);
  const valeurVerre = verre ?? (sombre ? 28 : 92);
  return (
    <>
      <h2 className="rayon">Accueil</h2>
      <div className="carte reglages-curseurs">
        <label className="curseur-reglage">
          <span className="curseur-titre">
            Verre des widgets
            <span className="discret">{verre === null ? (sombre ? "Transparent, comme le thème sombre" : "Opaque, comme le thème clair") : `${valeurVerre} %`}</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={valeurVerre}
            aria-label="Verre des widgets, de transparent à opaque"
            onChange={(e) => {
              const v = Number(e.target.value);
              setVerre(v);
              enregistrerVerre(v);
            }}
          />
        </label>
        {verre !== null && (
          <button
            className="lien"
            onClick={() => {
              setVerre(null);
              enregistrerVerre(null);
            }}
          >
            Suivre le thème
          </button>
        )}
        <label className="curseur-reglage">
          <span className="curseur-titre">
            Taille de la date
            <span className="discret">{date.taille} points</span>
          </span>
          <input
            type="range"
            min={TAILLE_DATE.min}
            max={TAILLE_DATE.max}
            step={1}
            value={date.taille}
            aria-label="Taille de la date de l'accueil"
            onChange={(e) => {
              const r = { ...date, taille: Number(e.target.value) };
              setDate(r);
              enregistrerDate(r);
              window.dispatchEvent(new Event("korahome:date"));
            }}
          />
        </label>
        <p className="discret curseur-aide">La date se glisse aussi du doigt sur l'accueil, à gauche ou au centre.</p>
      </div>
    </>
  );
}
