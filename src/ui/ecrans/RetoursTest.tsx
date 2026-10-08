import { useState } from "react";
import { GENRES, basculerRegle, grouperParEcran, heureCourte, type RetourTest } from "../../domaine/retours";
import type { Foyer } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { contexteReel } from "../contexte";
import { effacerJournal, lireJournal } from "../journal";
import {
  MESSAGES_ENVOI,
  construireRapport,
  copierRapport,
  envoyerAuMac,
  lireDernierEnvoi,
  noterEnvoi,
  partagerRapport,
} from "../rapport";

export function RetoursTest(props: { depot: Depot; foyer: Foyer; retours: RetourTest[] }) {
  const [etat, setEtat] = useState<string | null>(null);
  const [voirReglees, setVoirReglees] = useState(false);
  const [dernierEnvoi, setDernierEnvoi] = useState(lireDernierEnvoi);
  const [, rafraichir] = useState(0);
  const ouvertes = props.retours.filter((r) => !r.regleLe);
  const reglees = props.retours.filter((r) => r.regleLe);
  const journal = lireJournal();
  const prenom = (id: string | null) => props.foyer.membres.find((m) => m.id === id)?.prenom;
  const rapport = () => construireRapport(props.retours, props.foyer.membres);

  async function envoyer() {
    setEtat("Envoi au Mac…");
    const resultat = await envoyerAuMac(rapport().texte);
    if (resultat === "depose") {
      noterEnvoi();
      setDernierEnvoi(lireDernierEnvoi());
    }
    setEtat(MESSAGES_ENVOI[resultat]);
  }

  async function partager() {
    const { texte, nom } = rapport();
    if (await partagerRapport(texte, nom)) noterEnvoi();
    setDernierEnvoi(lireDernierEnvoi());
    setEtat(null);
  }

  async function copier() {
    setEtat((await copierRapport(rapport().texte)) ? "Rapport copié. Colle-le dans la conversation." : "Copie impossible sur cet appareil.");
  }

  const ligne = (r: RetourTest) => (
    <li key={r.id} className={`retour-test${r.regleLe ? " reglee" : ""}`}>
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
          <span className={`genre genre-${r.genre}`}>{GENRES[r.genre]}</span> · {heureCourte(r.creeLe)}
          {prenom(r.auteur) ? ` · ${prenom(r.auteur)}` : ""}
          {r.version !== __VERSION__ ? ` · ${r.version}` : ""}
        </span>
      </div>
    </li>
  );

  return (
    <main>
      <p className="surtitre">Kora {__VERSION__}</p>
      <h1>Retours de test</h1>

      <div className="carte rapport">
        <p className="rapport-chiffres">
          <strong>{ouvertes.length}</strong> note{ouvertes.length > 1 ? "s" : ""} ouverte{ouvertes.length > 1 ? "s" : ""}
          <span className="discret"> · {journal.length} actions enregistrées</span>
        </p>
        <button className="bouton-principal" onClick={envoyer}>Envoyer le rapport au Mac</button>
        <div className="rapport-actions">
          <button className="lien" onClick={partager}>Partager</button>
          <button className="lien" onClick={copier}>Copier</button>
        </div>
        {etat && <p className="discret" role="status">{etat}</p>}
        {dernierEnvoi && !etat && <p className="discret">Dernier rapport transmis le {heureCourte(dernierEnvoi)}.</p>}
      </div>

      {ouvertes.length === 0 && (
        <p className="vide">Aucune note ouverte. Touche la pastille « Dev » sur n'importe quel écran pour en écrire une.</p>
      )}
      {grouperParEcran(ouvertes).map((g) => (
        <section key={g.ecran}>
          <h2 className="rayon">{g.ecran}</h2>
          <ul className="carte groupe">{g.retours.map(ligne)}</ul>
        </section>
      ))}

      {reglees.length > 0 && (
        <>
          <button className="lien modifier" onClick={() => setVoirReglees(!voirReglees)}>
            {voirReglees ? "Masquer" : "Voir"} les notes réglées ({reglees.length})
          </button>
          {voirReglees && <ul className="carte groupe">{reglees.map(ligne)}</ul>}
        </>
      )}

      <p className="discret pied">
        Le rapport contient tes notes ouvertes, rangées par écran, avec les gestes qui les ont précédées, puis le
        journal des 14 derniers jours : écrans visités, boutons touchés et erreurs. Ce que tu écris dans les champs
        n'y figure pas, et rien ne part sans ton geste.
      </p>
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
    </main>
  );
}
