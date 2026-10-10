import { useEffect, useState, type FormEvent } from "react";
import { ErreurValidation } from "../../domaine/foyer";
import {
  RECURRENCES,
  TACHES_DE_LA_SEMAINE,
  decrireEcheance,
  decrireRecurrence,
  estTerminee,
  liberer,
  marquerFaite,
  nouvelleTache,
  organiserTaches,
  prendre,
  type Filtre,
} from "../../domaine/taches";
import type { Foyer, Tache } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { aujourdhuiLocal, contexteReel } from "../contexte";
import { Glisse, TitreLie, changerContenu } from "../mouvement";

const FILTRES: { id: Filtre; libelle: string }[] = [
  { id: "toutes", libelle: "Toutes" },
  { id: "miennes", libelle: "Les miennes" },
  { id: "libres", libelle: "Libres" },
];

export function Taches(props: { depot: Depot; foyer: Foyer; membreId: string | null; taches: Tache[] }) {
  const aujourdhui = aujourdhuiLocal();
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [saisie, setSaisie] = useState("");
  const [frequence, setFrequence] = useState(2); // « Chaque semaine »
  const [echeance, setEcheance] = useState(aujourdhui);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [annulable, setAnnulable] = useState<{ texte: string; avant: Tache } | null>(null);
  const [vientDeFaire, setVientDeFaire] = useState<string | null>(null);

  useEffect(() => {
    if (!annulable) return;
    const minuterie = setTimeout(() => setAnnulable(null), 6000);
    return () => clearTimeout(minuterie);
  }, [annulable]);

  const moi = props.membreId;
  const membre = (id: string | null) => props.foyer.membres.find((m) => m.id === id);
  const plusieurs = props.foyer.membres.length > 1;
  const { groupes, terminees } = organiserTaches(props.taches, aujourdhui, filtre, moi);

  async function ajouter(e: FormEvent) {
    e.preventDefault();
    try {
      const tache = nouvelleTache(saisie, RECURRENCES[frequence].valeur, echeance, contexteReel);
      await props.depot.enregistrerTache(tache);
      setSaisie("");
      setEcheance(aujourdhui);
      setMessage(null);
    } catch (err) {
      if (err instanceof ErreurValidation) setMessage(err.message);
      else throw err;
    }
  }

  async function faire(t: Tache) {
    const apres = marquerFaite(t, moi, aujourdhui, contexteReel);
    setVientDeFaire(t.id);
    await props.depot.enregistrerTache(apres);
    const suite = apres.recurrence ? ` Prochaine fois ${decrireEcheance(apres.echeance, aujourdhui)}.` : "";
    setAnnulable({ texte: `« ${t.titre} » faite.${suite}`, avant: t });
  }

  async function annuler() {
    if (!annulable) return;
    await props.depot.enregistrerTache(annulable.avant);
    setAnnulable(null);
  }

  // Une tâche unique déjà faite redevient à faire ; elle garde sa date.
  const refaire = (t: Tache) => props.depot.enregistrerTache({ ...t, faiteLe: null, faitePar: null });

  async function supprimer(t: Tache) {
    await props.depot.supprimerTache(t.id);
    setASupprimer(null);
    setOuverte(null);
  }

  const ajouterSemaine = () =>
    props.depot.enregistrerTaches(
      TACHES_DE_LA_SEMAINE.map((titre) =>
        nouvelleTache(titre, { unite: "semaine", tous: 1 }, aujourdhui, contexteReel),
      ),
    );

  function ligne(t: Tache) {
    const terminee = estTerminee(t);
    const resp = membre(t.responsable);
    const enRetard = !terminee && t.echeance < aujourdhui;
    const details = [
      decrireRecurrence(t.recurrence),
      terminee ? `faite${membre(t.faitePar) ? ` par ${membre(t.faitePar)!.prenom}` : ""}` : decrireEcheance(t.echeance, aujourdhui),
      resp ? `${resp.id === moi ? "toi" : resp.prenom}` : plusieurs ? "libre" : null,
    ].filter(Boolean);
    const estOuverte = ouverte === t.id;

    return (
      <Glisse key={t.id} nom={`tache-${t.id}`}>
        <li>
          <div className={`ligne tache${terminee ? " coche" : ""}${t.id === vientDeFaire ? " vient-de-cocher" : ""}`}>
            <button
              className="case"
              onClick={() => (terminee ? refaire(t) : faire(t))}
              aria-label={terminee ? `Remettre « ${t.titre} » à faire` : `Marquer « ${t.titre} » comme faite`}
            >
              {terminee ? "✓" : ""}
            </button>
            <button
              className="tache-texte"
              onClick={() =>
                changerContenu(() => {
                  setOuverte(estOuverte ? null : t.id);
                  setASupprimer(null);
                })
              }
              aria-expanded={estOuverte}
            >
              <span className="ligne-texte">{t.titre}</span>
              <span className={`tache-details${enRetard ? " retard" : ""}`}>{details.join(" · ")}</span>
            </button>
            {resp && plusieurs && (
              <span className="initiale" style={{ background: resp.couleur }} title={`S'en occupe : ${resp.prenom}`}>
                {resp.prenom.charAt(0)}
              </span>
            )}
          </div>
          {estOuverte && (
            <div className="tache-actions">
              {moi && t.responsable !== moi && (
                <button className="lien" onClick={() => props.depot.enregistrerTache(prendre(t, moi))}>
                  Je m'en occupe
                </button>
              )}
              {t.responsable !== null && (
                <button className="lien" onClick={() => props.depot.enregistrerTache(liberer(t))}>
                  Rendre libre
                </button>
              )}
              {aSupprimer === t.id ? (
                <button className="lien danger" onClick={() => supprimer(t)}>
                  Confirmer la suppression
                </button>
              ) : (
                <button className="lien danger" onClick={() => setASupprimer(t.id)}>
                  Supprimer
                </button>
              )}
            </div>
          )}
        </li>
      </Glisse>
    );
  }

  const vide = props.taches.length === 0;

  return (
    <main>
      <TitreLie nom="titre-taches"><h1>Tâches</h1></TitreLie>

      <form onSubmit={ajouter} className="ajout-tache">
        <div className="ajout">
          <input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Ajouter une tâche"
            enterKeyHint="done"
            aria-label="Nouvelle tâche"
          />
          <button type="submit" disabled={!saisie.trim()} aria-label="Ajouter">+</button>
        </div>
        {saisie.trim() && (
          <div className="options-tache">
            <div className="puces" role="group" aria-label="Fréquence">
              {RECURRENCES.map((r, i) => (
                <button
                  type="button"
                  key={r.libelle}
                  className={`puce${i === frequence ? " active" : ""}`}
                  aria-pressed={i === frequence}
                  onClick={() => setFrequence(i)}
                >
                  {r.libelle}
                </button>
              ))}
            </div>
            <label className="date-tache">
              {RECURRENCES[frequence].valeur ? "À partir du" : "Pour le"}
              <input type="date" value={echeance} min="2000-01-01" onChange={(e) => setEcheance(e.target.value || aujourdhui)} />
            </label>
          </div>
        )}
      </form>
      {message && <p className="erreur" role="status">{message}</p>}

      {!vide && (
        <div className="segments" role="group" aria-label="Afficher">
          {FILTRES.filter((f) => f.id !== "miennes" || moi).map((f) => (
            <button key={f.id} className={f.id === filtre ? "actif" : ""} aria-pressed={f.id === filtre} onClick={() => changerContenu(() => setFiltre(f.id))}>
              {f.libelle}
            </button>
          ))}
        </div>
      )}

      {vide && (
        <div className="carte bientot">
          <p>Aucune tâche pour l'instant.</p>
          <p className="discret">Les tâches de la semaine que vous avez choisies : {TACHES_DE_LA_SEMAINE.join(", ")}.</p>
          <button className="bouton-principal" onClick={ajouterSemaine}>Ajouter ces 6 tâches</button>
        </div>
      )}

      {!vide && groupes.length === 0 && terminees.length === 0 && (
        <p className="vide">{filtre === "miennes" ? "Tu ne t'occupes d'aucune tâche." : "Aucune tâche libre."}</p>
      )}

      {groupes.map((g) => (
        <Glisse key={g.cle} nom={`groupe-${g.cle}`}>
          <section>
            <h2 className={`rayon${g.cle === "retard" ? " retard" : ""}`}>{g.titre}</h2>
            <ul className="carte groupe">{g.taches.map(ligne)}</ul>
          </section>
        </Glisse>
      ))}

      {terminees.length > 0 && (
        <Glisse nom="groupe-faites">
          <section>
            <div className="entete-coches">
              <h2 className="rayon">Faites ({terminees.length})</h2>
              <button className="lien" onClick={() => terminees.forEach((t) => props.depot.supprimerTache(t.id))}>
                Effacer
              </button>
            </div>
            <ul className="carte groupe">{terminees.map(ligne)}</ul>
          </section>
        </Glisse>
      )}

      {annulable && (
        <div className="toast" role="status">
          <span>{annulable.texte}</span>
          <button className="lien" onClick={annuler}>Annuler</button>
        </div>
      )}
    </main>
  );
}
