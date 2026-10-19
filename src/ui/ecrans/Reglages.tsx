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
import { choisirTheme, lireTheme, THEMES, type Theme } from "../theme";

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
  ouvrirSauvegarde: () => void;
  ouvrirCalendrier: () => void;
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
    <main className="reglages">
      <h1>Réglages</h1>

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
        <Ligne picto="partage" titre="Partage" valeur={props.partage === "actif" ? props.etatPartage.texte : ETATS_PARTAGE[props.partage]} alerte={props.etatPartage.ton === "urgent"} onClick={props.ouvrirPartage} />
        <Ligne picto="sauvegarde" titre="Sauvegarde" valeur={decrireDerniere(lireDerniereSauvegarde(), aujourdhuiLocal())} onClick={props.ouvrirSauvegarde} />
        <Ligne
          picto="cloche"
          titre="Notifications"
          valeur={`${formaterHeure(rappels.heure)} · ${decrireJours(rappels.jours)}`}
          onClick={props.ouvrirNotifications}
        />
        <Ligne picto="calendrier" titre="Calendrier de l'iPhone" valeur={props.calendrier} alerte={props.calendrierEnErreur} onClick={props.ouvrirCalendrier} />
        <Ligne picto="appris" titre="Ce que Kora sait de nous" onClick={props.ouvrirAppris} />
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
    </main>
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
  const [theme, setTheme] = useState<Theme>(lireTheme);

  return (
    <main className="reglages">
      <h1>Ce téléphone</h1>
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
    </main>
  );
}
