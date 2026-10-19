import { useRef, useState } from "react";
import { ErreurValidation } from "../../domaine/foyer";
import { decrireDerniere, resumeSauvegarde, sauvegardeDue, type ContenuFoyer, type Sauvegarde as FichierSauvegarde } from "../../domaine/sauvegarde";
import type { Depot } from "../../donnees/depot";
import { useAnnoncer } from "../annulation";
import { Feuille } from "../Feuille";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { Page } from "../pieces";
import { exporterSauvegarde, lireDerniereSauvegarde, lireFichierSauvegarde, reprendreSauvegarde } from "../sauvegarde";

// Sauvegarde de la semaine : un fichier avec tout le foyer, rangé où l'on veut dans
// Fichiers. Le dimanche, si elle a plus d'une semaine, « Aujourd'hui » la propose.

export function Sauvegarde(props: { contenu: ContenuFoyer; depot: Depot; aujourdhui: string }) {
  const [derniere, setDerniere] = useState(lireDerniereSauvegarde);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [aReprendre, setAReprendre] = useState<FichierSauvegarde | null>(null);
  const choix = useRef<HTMLInputElement>(null);
  const annoncer = useAnnoncer();
  const due = sauvegardeDue(derniere, props.aujourdhui);

  async function sauvegarder() {
    setEnCours(true);
    setMessage(null);
    try {
      if (await exporterSauvegarde(props.contenu)) {
        vibrer();
        setDerniere(lireDerniereSauvegarde());
        annoncer("Sauvegarde faite.", () => {});
      }
    } catch {
      setMessage("L'iPhone n'a pas pu écrire le fichier, réessaie.");
    } finally {
      setEnCours(false);
    }
  }

  async function ouvrir(fichier: File | undefined) {
    if (!fichier) return;
    setMessage(null);
    try {
      setAReprendre(await lireFichierSauvegarde(fichier));
    } catch (e) {
      setMessage(e instanceof ErreurValidation ? e.message : "Ce fichier ne s'ouvre pas.");
    }
  }

  async function reprendre() {
    if (!aReprendre) return;
    try {
      await reprendreSauvegarde(props.depot, aReprendre, props.contenu.foyer.id);
      vibrer();
      setAReprendre(null);
      setMessage(`Sauvegarde du ${aReprendre.creeLe.slice(8, 10)}.${aReprendre.creeLe.slice(5, 7)} reprise.`);
    } catch (e) {
      setAReprendre(null);
      setMessage(e instanceof ErreurValidation ? e.message : "La reprise n'a pas abouti, réessaie.");
    }
  }

  return (
    <Page titre="Sauvegarde" sousTitre={`Dernière sauvegarde : ${decrireDerniere(derniere, props.aujourdhui)}`}>
      <section className={`carte sauvegarde-carte${due ? " due" : ""}`}>
        <span className="pictogramme"><Icone nom="note" taille={20} /></span>
        <div className="ligne-texte">
          <strong>Tout le foyer dans un fichier</strong>
          <p className="discret">{resumeSauvegarde(props.contenu)}.</p>
        </div>
      </section>
      <button className="bouton-principal" onClick={() => void sauvegarder()} disabled={enCours}>
        {enCours ? "Préparation…" : "Sauvegarder maintenant"}
      </button>
      <p className="discret pied-court">Choisis « Enregistrer dans Fichiers », puis iCloud Drive ou le dossier de l'Atelier sur le Mac. Une fois par semaine suffit : Kora le rappelle le dimanche.</p>

      <h2 className="rayon">Reprendre une sauvegarde</h2>
      <button className="carte proposition" onClick={() => choix.current?.click()}>
        <span className="pictogramme"><Icone nom="partage" taille={20} /></span>
        <span className="proposition-texte">
          <strong>Choisir un fichier</strong>
          <span className="discret">Tout revient comme le jour de la sauvegarde.</span>
        </span>
        <Icone nom="suivant" taille={18} />
      </button>
      <input
        ref={choix}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void ouvrir(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {message && <p className="discret" role="status">{message}</p>}

      <Feuille ouverte={!!aReprendre} onFermer={() => setAReprendre(null)} alerte titre="Reprendre la sauvegarde">
        {aReprendre && (
          <div className="alerte-corps">
            <h2>Reprendre la sauvegarde du {aReprendre.creeLe.slice(8, 10)}.{aReprendre.creeLe.slice(5, 7)} ?</h2>
            <p className="discret">{resumeSauvegarde(aReprendre)}. Ce qui a changé depuis sera remplacé, sur les deux iPhone.</p>
            <button className="bouton-principal" onClick={() => void reprendre()}>Reprendre</button>
            <button className="lien" onClick={() => setAReprendre(null)}>Annuler</button>
          </div>
        )}
      </Feuille>
    </Page>
  );
}
