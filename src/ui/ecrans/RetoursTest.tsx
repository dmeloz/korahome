import { useEffect, useId, useState } from "react";
import { GENRES, basculerRegle, estPartie, etatRetour, grouperParEcran, heureCourte, type EtatRetour, type RetourTest } from "../../domaine/retours";
import type { Foyer } from "../../domaine/types";
import type { DepotLocal } from "../../donnees/depotLocal";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { Glissable } from "../Glissable";
import { effacerJournal, lireJournal } from "../journal";
import { construireRapport, copierRapport, partagerRapport } from "../rapport";
import { RepereOnglet } from "../moteur/pieces";
import { Page } from "../pieces";

// Les notes de test, rangées comme dans Sanji : nouvelles (Claude ne les a pas encore lues),
// reçues (Claude les a lues et marquées sur le serveur ; « Transmises » jusqu'en 0.0.74) et réglées.

const GROUPES: { etat: EtatRetour; titre: string }[] = [
  { etat: "nouvelle", titre: "Nouvelles" },
  { etat: "transmise", titre: "Reçues" },
  { etat: "reglee", titre: "Réglées" },
];

export function RetoursTest(props: { depot: DepotLocal; foyer: Foyer; retours: RetourTest[]; partageActif: boolean }) {
  const [etat, setEtat] = useState<string | null>(null);
  const repere = useId();
  const [ouvert, setOuvert] = useState<EtatRetour>("nouvelle");
  const [enAttente, setEnAttente] = useState<ReadonlySet<string>>(new Set());
  const [, rafraichir] = useState(0);
  const annoncer = useAnnoncer();
  const journal = lireJournal();
  const prenom = (id: string | null) => props.foyer.membres.find((m) => m.id === id)?.prenom;
  const rapport = () => construireRapport(props.retours, props.foyer.membres);

  // Les notes qui attendent encore leur envoi ; relu à chaque changement (une synchro qui part, une note écrite).
  useEffect(() => {
    const lire = () =>
      void props.depot.lireEnAttente().then((liste) => setEnAttente(new Set(liste.filter((c) => c.collection === "retours").map((c) => c.id))));
    lire();
    return props.depot.abonner(lire);
  }, [props.depot]);

  const parEtat = (e: EtatRetour) =>
    props.retours.filter((r) => etatRetour(r) === e).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  const affichees = parEtat(ouvert);

  async function partager() {
    const { texte, nom } = rapport();
    setEtat((await partagerRapport(texte, nom)) ? null : "Partage annulé.");
  }

  async function copier() {
    setEtat((await copierRapport(rapport().texte)) ? "Rapport copié. Colle-le dans la conversation." : "Copie impossible sur cet appareil.");
  }

  const supprimer = async (r: RetourTest) => {
    await props.depot.supprimerRetour(r.id);
    annoncer("Note supprimée.", () => props.depot.enregistrerRetour(r));
  };

  const ligne = (r: RetourTest) => (
    <li key={r.id}>
      <Glissable className={`retour-test${r.regleLe ? " reglee" : ""}`} onSupprimer={() => void supprimer(r)}>
      <button
        className="case"
        aria-label={r.regleLe ? "Rouvrir la note" : "Marquer la note réglée"}
        onClick={() => void props.depot.enregistrerRetour(basculerRegle(r, contexteReel))}
      >
        {r.regleLe ? "✓" : ""}
      </button>
      <div className="retour-test-texte">
        <span>{r.texte}</span>
        <span className="tache-details">
          <span className={`genre genre-${r.genre}`}>{GENRES[r.genre]}</span> · {r.ecran} · {heureCourte(r.creeLe)}
          {prenom(r.auteur) ? ` · ${prenom(r.auteur)}` : ""}
          {r.version !== __VERSION__ ? ` · ${r.version}` : ""}
        </span>
      </div>
      </Glissable>
    </li>
  );

  const nouvelles = parEtat("nouvelle").length;
  const enRoute = props.retours.filter((r) => !r.regleLe && !estPartie(r, enAttente, props.partageActif)).length;

  return (
    <Page titre="Retours de test" sousTitre={`Kora ${__VERSION__}`} className="avec-cadre">

      <div className="carte rapport">
        {props.partageActif ? (
          <p>
            {enRoute > 0
              ? `${enRoute} note${enRoute > 1 ? "s partent" : " part"} vers Claude à la prochaine synchronisation.`
              : nouvelles === 0
                ? "Claude a lu toutes les notes : pas besoin de les copier ni de les partager."
                : `${nouvelles} note${nouvelles > 1 ? "s attendent" : " attend"} que Claude les lise : elles sont déjà sur le serveur.`}
          </p>
        ) : (
          <p>Les notes partent seules vers Claude dès que le partage est activé sur ce téléphone.</p>
        )}
        <p className="discret">Une note part seule dès qu'elle est écrite. Celles des deux iPhone arrivent au même endroit, avec les gestes qui les ont précédées.</p>
      </div>

      <div className="segments" role="tablist">
        {GROUPES.map((g) => (
          <button
            key={g.etat}
            role="tab"
            aria-selected={ouvert === g.etat}
            className={ouvert === g.etat ? "actif" : ""}
            onClick={() => setOuvert(g.etat)}
          >
            {ouvert === g.etat && <RepereOnglet groupe={repere} />}
            {g.titre} <span className="discret">{parEtat(g.etat).length}</span>
          </button>
        ))}
      </div>

      {affichees.length === 0 ? (
        <p className="vide">
          {ouvert === "nouvelle"
            ? "Aucune nouvelle note. Touche la pastille « Dev » sur n'importe quel écran pour en écrire une."
            : ouvert === "transmise"
              ? "Aucune note en attente de correction."
              : "Aucune note réglée pour l'instant."}
        </p>
      ) : ouvert === "reglee" ? (
        <ul className="carte groupe">{affichees.map(ligne)}</ul>
      ) : (
        grouperParEcran(affichees).map((g) => (
          <section key={g.ecran}>
            <h2 className="rayon">{g.ecran}</h2>
            <ul className="carte groupe">{g.retours.map(ligne)}</ul>
          </section>
        ))
      )}

      <h2 className="rayon">Rapport complet</h2>
      <div className="carte rapport">
        <p className="discret">
          Les notes et le journal de ce téléphone ({journal.length} actions sur 14 jours : écrans, boutons, erreurs ; jamais
          le texte des champs).
        </p>
        <div className="rapport-actions">
          <button className="lien" onClick={partager}>Partager</button>
          <button className="lien" onClick={copier}>Copier</button>
        </div>
        {etat && <p className="discret" role="status">{etat}</p>}
      </div>
      <button
        className="lien danger"
        onClick={() => {
          effacerJournal();
          rafraichir((n) => n + 1);
        }}
        disabled={journal.length === 0}
      >
        Effacer le journal
      </button>
    </Page>
  );
}
