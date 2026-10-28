import { useEffect, useState } from "react";
import { CATEGORIES_CONTRAT, contratsDe, contratVide, nomCategorie, poserContrat, PREAVIS_PROPOSES, resumeContrats, type LigneContrat } from "../../domaine/abonnements";
import { enregistrerPoste, formaterMontant, lireMontant, nouveauPlan, nouveauPoste, planDe, type DocBudget } from "../../domaine/budget";
import type { Foyer } from "../../domaine/types";
import type { Depot } from "../../donnees/depot";
import { aujourdhuiLocal, contexteReel } from "../contexte";
import { Feuille } from "../Feuille";
import { vibrer } from "../haptique";
import { Ligne, ListeVivante, Message } from "../moteur/pieces";
import { LigneAjout } from "../pieces";
import { sauver } from "../sauver";
import { Puces } from "./budget/communs";

// Les abonnements et les contrats (Kora 0.0.91, proposition 6 de la nuit du 26 octobre), en tête
// d'Organisation › Administratif : chaque contrat est une charge du Budget (catégorie abonnement
// ou assurance) ; ici on lui donne sa fin et son préavis, et Kora dit « Résilier Sunrise avant le
// 30 novembre » sur l'accueil et dans le rappel du matin. On en ajoute un en l'écrivant : « Sunrise 59 ».

export function Abonnements(props: { depot: Depot; foyer: Foyer; membreId: string | null; budget: DocBudget[] }) {
  const aujourdhui = aujourdhuiLocal();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [aide, setAide] = useState<string | null>(null);
  useEffect(() => {
    if (!aide) return;
    const minuterie = setTimeout(() => setAide(null), 6000);
    return () => clearTimeout(minuterie);
  }, [aide]);
  const plan = planDe(props.budget);
  const lignes = contratsDe(plan?.postes ?? [], aujourdhui, [null, ...(props.membreId ? [props.membreId] : [])]);
  const ligne = lignes.find((l) => l.poste.id === ouvert) ?? null;

  const enregistrer = (l: LigneContrat, changements: Parameters<typeof poserContrat>[1]) => {
    if (plan) sauver(props.depot.enregistrerBudget(enregistrerPoste(plan, poserContrat(l.poste, changements, contexteReel), contexteReel)));
  };

  /** « Sunrise 59 » ou « Assurance ménage 320 par an » : une charge de plus au Budget, rangée dans les factures. */
  async function ajouter(phrase: string) {
    const m = /^(.+?)\s+(\d[\d’' ]*(?:[.,]\d{1,2})?)(?:\.-)?\s*(?:chf)?\s*(par an|par année|\/an|par mois|\/mois)?$/i.exec(phrase.trim());
    const somme = m ? lireMontant(m[2]) : null;
    if (!m || somme === null) {
      setAide("Écris le nom puis le prix : « Sunrise 59 », « Assurance ménage 320 par an ».");
      return;
    }
    const annuel = !!m[3] && /an/i.test(m[3]);
    const base = plan ?? nouveauPlan(props.foyer.membres.map((x) => x.id), aujourdhui, contexteReel);
    const poste = nouveauPoste({ libelle: m[1], montant: somme, frequence: annuel ? "an" : "mois", pot: "factures", contrat: contratVide() }, contexteReel);
    const categorie = (CATEGORIES_CONTRAT as readonly string[]).includes(poste.categorie) ? poste.categorie : "abonnement";
    await props.depot.enregistrerBudget(enregistrerPoste(base, { ...poste, categorie }, contexteReel));
    vibrer();
    setOuvert(poste.id);
  }

  return (
    <section className="contrats">
      <h2 className="rayon">Abonnements et contrats</h2>
      {lignes.length > 0 && <p className="discret contrats-resume">{resumeContrats(lignes)}</p>}
      {lignes.length === 0 && <p className="vide">Netflix, Sunrise, la salle de sport, l'assurance : note la fin et le préavis, Kora prévient avant que ça se renouvelle.</p>}
      {lignes.length > 0 && (
        <ListeVivante className="carte groupe">
          {lignes.map((l) => (
            <Ligne key={l.poste.id}>
              <button type="button" className={`ligne contrat${l.presse ? " presse" : ""}`} onClick={() => setOuvert(l.poste.id)} aria-haspopup="dialog">
                <span className="tache-texte">
                  <span className="ligne-texte">{l.poste.libelle}</span>
                  <span className={`tache-details${l.presse ? " retard" : ""}`}>{formaterMontant(l.parMois)} par mois · {l.etat}</span>
                </span>
              </button>
            </Ligne>
          ))}
        </ListeVivante>
      )}
      <div className="carte groupe ajout-seul">
        <LigneAjout placeholder="Nouveau contrat, ex. Sunrise 59" ajouter={ajouter} />
      </div>
      <Message visible={!!aide}>{aide}</Message>

      <Feuille ouverte={!!ligne} onFermer={() => setOuvert(null)} titre={ligne?.poste.libelle}>
        {ligne && plan && (
          <div className="formulaire">
            <p className="discret">
              {nomCategorie(ligne.poste)} · {formaterMontant(ligne.poste.montant)} {ligne.poste.frequence === "an" ? "par an" : "par mois"} · {ligne.etat}
            </p>
            <label>
              Le contrat court jusqu'au
              <input
                type="date"
                key={`${ligne.poste.id}-fin`}
                value={ligne.contrat.fin ?? ""}
                min="2000-01-01"
                onChange={(e) => enregistrer(ligne, { fin: e.target.value || null })}
              />
            </label>
            <Puces
              libelle="Préavis pour résilier"
              valeur={(PREAVIS_PROPOSES as readonly number[]).includes(ligne.contrat.preavisMois) ? ligne.contrat.preavisMois : 1}
              changer={(preavisMois) => enregistrer(ligne, { preavisMois })}
              choix={PREAVIS_PROPOSES.map((n) => ({ v: n, libelle: n === 0 ? "Aucun" : n === 1 ? "1 mois" : `${n} mois` }))}
            />
            <button type="button" className="ligne chef-interrupteur" onClick={() => enregistrer(ligne, { tacite: !ligne.contrat.tacite })} aria-pressed={ligne.contrat.tacite}>
              <span className="ligne-texte">Se renouvelle tout seul chaque année</span>
              <span className={`interrupteur${ligne.contrat.tacite ? " actif" : ""}`} aria-hidden />
            </button>
            <label>
              Note
              <input
                key={`${ligne.poste.id}-note`}
                defaultValue={ligne.contrat.note ?? ""}
                placeholder="Numéro de client, où résilier…"
                maxLength={200}
                onBlur={(e) => e.target.value.trim() !== (ligne.contrat.note ?? "") && enregistrer(ligne, { note: e.target.value })}
              />
            </label>
            <p className="discret">Le montant et qui paie se changent dans le Budget, onglet Charges.</p>
          </div>
        )}
      </Feuille>
    </section>
  );
}
