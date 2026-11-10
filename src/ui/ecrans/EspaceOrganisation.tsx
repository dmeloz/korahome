import type { Depot } from "../../donnees/depot";
import { aResilierBientot, contratsDe, phraseResiliation, quandResilier, resumeContrats } from "../../domaine/abonnements";
import { comptesIcloudDe, evenementsDe, ligneWidget, occurrences, resumeAgenda, titreDe } from "../../domaine/agenda";
import { planDe } from "../../domaine/budget";
import { decaler, decrireEcheance, ecartJours, marquerFaite, organiserPourMoi } from "../../domaine/taches";
import type { Tache } from "../../domaine/types";
import { useAnnoncer } from "../annulation";
import { contexteReel } from "../contexte";
import { feteFee } from "../fee";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import type { DonneesModule } from "../modules";
import { feter } from "../moteur/fete";
import type { Page } from "../pages";
import { enLettres, EnteteEspace, Grille, Jours, LigneCoche, LigneDite, Tuile } from "../pieces/Cartes";
import { CarteTael } from "../pieces/Tael";
import { ecrireAFee } from "../tael";
import { noterUsage } from "../usage";

// Organisation (Kora 0.1) : la page de cartes de l'espace. La semaine de l'agenda, ce qui presse
// en laiton (une résiliation, une tâche en retard) avec « C'est fait », l'administratif, Tael, les
// tâches à cocher d'ici, et ce qu'il y a à préparer pour demain en ivoire.

/** Combien de tâches la carte montre. */
const TACHES_SUR_LA_CARTE = 5;

export function EspaceOrganisation(props: { donnees: DonneesModule; depot: Depot; ouvrir: (p: Page) => void }) {
  const { donnees, depot } = props;
  const { aujourdhui, membreId } = donnees;
  const annoncer = useAnnoncer();
  const ouvrir = (onglet: string) => {
    noterUsage("widget", "taches");
    props.ouvrir({ nom: "module", id: "taches", onglet });
  };
  const majuscule = (t: string) => t.replace(/^./, (c) => c.toUpperCase());

  // ----- Agenda -----
  const evenements = evenementsDe(donnees.agenda);
  const agenda = resumeAgenda(evenements, donnees.animaux, aujourdhui);
  const marques = new Set(occurrences(evenements, decaler(aujourdhui, { unite: "jour", tous: -7 }), decaler(aujourdhui, { unite: "jour", tous: 7 }), donnees.animaux).map((o) => o.debut));
  const prochains = [...agenda.aujourdhui, ...agenda.semaine].slice(0, 3);
  const icloud = comptesIcloudDe(donnees.agenda).length;
  const demainJour = decaler(aujourdhui, { unite: "jour", tous: 1 });
  const demain = agenda.semaine.filter((o) => o.debut === demainJour);

  // ----- Tâches -----
  const pourMoi = membreId ? organiserPourMoi(donnees.taches, aujourdhui, membreId) : null;
  const miennes = pourMoi ? pourMoi.miennes.flatMap((g) => g.taches) : donnees.taches.filter((t) => !t.faiteLe || t.echeance <= aujourdhui);
  const montrees = miennes.slice(0, TACHES_SUR_LA_CARTE);
  const reste = miennes.length - montrees.length;
  const enRetard = miennes.filter((t) => ecartJours(aujourdhui, t.echeance) < 0);
  const faire = async (t: Tache) => {
    vibrer();
    const derniere = miennes.filter((x) => x.echeance <= aujourdhui).length === 1;
    const apres = marquerFaite(t, membreId, aujourdhui, contexteReel);
    await depot.enregistrerTache(apres);
    feteFee();
    if (derniere) feter(document.querySelector(".page-dessus .grille"));
    noterUsage("tache", t.id);
    const suite = apres.recurrence ? ` Prochaine fois ${decrireEcheance(apres.echeance, aujourdhui)}.` : "";
    annoncer(`« ${t.titre} » faite.${suite}`, () => depot.enregistrerTache(t));
  };

  // ----- Administratif -----
  const plan = planDe(donnees.budget);
  const contrats = plan ? contratsDe(plan.postes, aujourdhui) : [];
  const resiliation = plan ? aResilierBientot(plan.postes, aujourdhui)[0] ?? null : null;
  const pressee = enRetard[0] ?? miennes.find((t) => t.echeance === aujourdhui) ?? null;

  let i = 0;
  return (
    <main className="page espace organisation">
      <EnteteEspace titre="Organisation" sous={miennes.length ? `${majuscule(enLettres(miennes.length))} tâche${miennes.length > 1 ? "s" : ""} à toi${agenda.aujourdhui.length ? `, ${agenda.aujourdhui.length} rendez-vous aujourd'hui` : ""}` : agenda.aujourdhui[0] ? ligneWidget(agenda.aujourdhui[0], aujourdhui) : "Tâches, agenda et administratif"} />

      <Grille label="Organisation">
        <Tuile large i={i++} widget="agenda" onClick={() => ouvrir("agenda")} label={`Agenda : ${prochains.length ? prochains.map((o) => ligneWidget(o, aujourdhui)).join(" ; ") : "rien cette semaine"}`}>
          <p className="etiq"><Icone nom="calendrier" taille={18} />Agenda{icloud > 0 && <b className="pastille-k" style={{ marginLeft: "auto" }}>iCloud relié</b>}</p>
          <Jours aujourdhui={aujourdhui} marques={marques} />
          {prochains.length ? (
            <div className="lignes">
              {prochains.map((o) => (
                <LigneDite key={`${o.evenement.id}-${o.debut}`} texte={titreDe(o)} heure={o.evenement.heure ?? null} fin={o.debut === aujourdhui ? "aujourd'hui" : decrireEcheance(o.debut, aujourdhui)} />
              ))}
            </div>
          ) : (
            <p className="phrase">Rien de prévu cette semaine.</p>
          )}
        </Tuile>

        {resiliation ? (
          <Tuile forte i={i++} onClick={() => ouvrir("administratif")} label={phraseResiliation(resiliation)}>
            <p className="etiq">Administratif, {quandResilier(resiliation, aujourdhui)}</p>
            <p className="titre-c">{phraseResiliation(resiliation)}</p>
            <p className="doux">{resiliation.etat}</p>
          </Tuile>
        ) : pressee ? (
          <Tuile forte i={i++} role="group" label={`À faire : ${pressee.titre}`}>
            <p className="etiq">{ecartJours(aujourdhui, pressee.echeance) < -1 ? decrireEcheance(pressee.echeance, aujourdhui).replace(/^./, (c) => c.toUpperCase()) : ecartJours(aujourdhui, pressee.echeance) < 0 ? "En retard depuis hier" : "À toi aujourd'hui"}</p>
            <p className="titre-c">{pressee.titre}</p>
            <div className="actions-c">
              <button type="button" className="pilule" onClick={() => void faire(pressee)}>C'est fait</button>
            </div>
          </Tuile>
        ) : (
          <Tuile forte i={i++} onClick={() => ouvrir("taches")} label="Rien ne presse">
            <p className="etiq">Aujourd'hui</p>
            <p className="titre-c">{donnees.taches.length ? "Rien ne presse." : "Dis-moi ta première tâche."}</p>
            {miennes[0] && <p className="doux">Prochaine : {miennes[0].titre}, {decrireEcheance(miennes[0].echeance, aujourdhui)}.</p>}
          </Tuile>
        )}

        <Tuile i={i++} onClick={() => ouvrir("administratif")} label={`Administratif : ${contrats.length ? resumeContrats(contrats) : "aucun contrat"}`}>
          <p className="etiq"><Icone nom="dossier" taille={18} />Administratif</p>
          <p className="phrase">{contrats.length ? resumeContrats(contrats) : plan ? "Abonnements et assurances, avec leur date de résiliation." : "Les papiers, les démarches, les contrats."}</p>
        </Tuile>

        <CarteTael />

        <Tuile large i={i++} role="group" label={`Tâches : ${miennes.length} à toi`} className="taches-c">
          <p className="etiq"><Icone nom="coche" taille={18} />Tâches{enRetard.length > 0 && <b className="pastille-k urgent" style={{ marginLeft: "auto" }}>{enRetard.length} en retard</b>}</p>
          {montrees.length ? (
            <div className="lignes">
              {montrees.map((t) => (
                <LigneCoche key={t.id} coche={false} texte={t.titre} heure={t.heure ?? null} fin={t.echeance === aujourdhui ? null : decrireEcheance(t.echeance, aujourdhui)} urgent={ecartJours(aujourdhui, t.echeance) < 0} onClick={() => void faire(t)} />
              ))}
            </div>
          ) : (
            <p className="phrase">{donnees.taches.length ? "Rien à toi pour l'instant." : "Aucune tâche pour l'instant."}</p>
          )}
          <div className="actions-c">
            <button type="button" className="pilule fee" onClick={ecrireAFee}>Ajouter</button>
            <button type="button" className="pilule" onClick={() => ouvrir("taches")}>{reste > 0 ? `Tout voir, ${reste} de plus` : "Tout voir"}</button>
          </div>
        </Tuile>

        <Tuile contraste large i={i++} onClick={() => ouvrir("agenda")} label="À préparer pour demain">
          <p className="etiq">Demain</p>
          <p className="titre-c">{demain[0] ? `${titreDe(demain[0])}${demain[0].evenement.heure ? `, ${demain[0].evenement.heure}` : ""}` : "Rien de prévu demain."}</p>
          {demain.length > 1 && <p className="doux">{demain.slice(1, 3).map((o) => titreDe(o)).join(", ")}</p>}
          {demain[0] && <p className="doux">Dis « à préparer la veille » à Tael si quelque chose doit être prêt ce soir.</p>}
        </Tuile>
      </Grille>
    </main>
  );
}
