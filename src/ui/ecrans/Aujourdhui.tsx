import { useEffect, useEffectEvent, useState } from "react";
import type { Depot } from "../../donnees/depot";
import type { ServeurJarvis } from "../../donnees/distant";
import { resiliationsDuJour } from "../../domaine/abonnements";
import { evenementsDe, ligneWidget, occurrences, resumeAgenda, titreDe } from "../../domaine/agenda";
import { etatAMoi } from "../../domaine/aMoi";
import { bilanAOuvrir, bilanDeLaSemaine, remarqueDuJour } from "../../domaine/apprentissage";
import { carteDuJour, dejaSurLaCarte, demainDuJour, momentDuJour, resteAFaire, titreMoment, type ChoseDuJour } from "../../domaine/aujourdhui";
import { basculerCoeur, clinDuJour } from "../../domaine/bandeau";
import { etatDesPots, facturesDuJour, formaterMontant, planDe } from "../../domaine/budget";
import { enDirect } from "../../domaine/ecranAccueil";
import type { EtatPartage } from "../../domaine/etatPartage";
import { filDuFoyer, gesteDit } from "../../domaine/fil";
import { ligneRetard } from "../../domaine/foyer";
import { composerHub } from "../../domaine/hub";
import { aSortirCeSoir, nomDechet, reglageDechets } from "../../domaine/maison";
import { meteoDu } from "../../domaine/meteo";
import { nouveauteADire } from "../../domaine/nouveautes";
import type { OuRecherche } from "../../domaine/recherche";
import { repartitionDue } from "../../domaine/repartition";
import { decrireDerniere, sauvegardeDue } from "../../domaine/sauvegarde";
import { decaler, decrireEcheance, marquerFaite } from "../../domaine/taches";
import { salutation } from "../../domaine/tael";
import { heureMinute, NOMS_JOURS } from "../../domaine/texte";
import type { Tache } from "../../domaine/types";
import type { WidgetId } from "../../domaine/tableauDeBord";
import { useAnnoncer } from "../annulation";
import { calculerApprentissages } from "../apprendre";
import { clinDejaDit, noterClinDit, useClinDuJour } from "../clinDuJour";
import { aujourdhuiLocal, contexteReel } from "../contexte";
import { direSiCalme, feteFee, taireFee } from "../fee";
import { vibrer } from "../haptique";
import { Icone } from "../Icone";
import { ignorer } from "../journal";
import { MODULES, type DonneesModule } from "../modules";
import { sceller, soufflerPuis } from "../moteur/langage";
import type { Page } from "../pages";
import { CarteDemarrage } from "../pieces/Demarrage";
import { Coche, dateLongue, enLettres, EnteteEspace, Grille, Jours, LigneCoche, Tuile } from "../pieces/Cartes";
import { FeuilleHeure } from "../pieces/FeuilleHeure";
import { RechercheFee } from "../pieces/RechercheFee";
import { CarteTael } from "../pieces/Tael";
import { etatRappels } from "../rappels";
import { lireDerniereSauvegarde } from "../sauvegarde";
import { sauver } from "../sauver";
import { CLES, ecrireTexte, lireTexte } from "../stockageLocal";
import { ecrireAFee } from "../tael";
import { fermerRemarque, lireAdaptations, lireDernierBilan, noterUsage, remarqueAMontrer } from "../usage";
import { nuitDeCeTelephone, useVieFee } from "../vieFee";
import { lireDerniereRepartition } from "./Taches";

// Aujourd'hui (Kora 0.1) : le premier des six espaces. Depuis 0.1.14 (maquette « Aujourd'hui sans
// répétition », validée par Melo le 11 novembre 2026), chaque chose se dit à un seul endroit : le
// salut et Tael à côté, puis la carte du moment (ce qui attend aujourd'hui, en laiton seulement
// quand quelque chose attend ; sinon le repas du soir ou le calme), les courses et le seul grand
// chiffre, l'Agenda pour la suite de la semaine, « Demain » en ivoire pour tout ce que demain
// apporte, le mot de l'autre, le fil « Chez nous ». Tael n'a sa carte que pour dire autre chose.
// Les règles sont dans `domaine/aujourdhui.ts` (`momentDuJour`, `demainDuJour`).

/** Combien de choses du jour la carte du jour retient. */
const CHOSES_CARTE = 12;

export function Aujourdhui(props: {
  donnees: DonneesModule;
  depot: Depot;
  jarvis: { serveur: ServeurJarvis; foyerId: string } | null;
  partageActif: boolean;
  partage: EtatPartage;
  rappelsNonLus: number;
  ouvrir: (p: Page) => void;
  /** Envoie et reçoit les changements tout de suite ; absent sans partage. */
  synchroniser?: () => Promise<void>;
  ouvrirRepartition: () => void;
  aller: (ou: OuRecherche) => void;
  /** Aucune page n'est ouverte par-dessus : la fée parle d'ici. */
  auDessus: boolean;
}) {
  const { donnees, depot, ouvrir } = props;
  const { foyer, membreId, aujourdhui } = donnees;
  const moi = foyer.membres.find((m) => m.id === membreId);
  const autre = foyer.membres.find((m) => m.id !== membreId) ?? null;
  const annoncer = useAnnoncer();
  const maintenant = new Date();
  const [heureDe, setHeureDe] = useState<Tache | null>(null);

  // Les rappels n'arrivent plus sur ce téléphone (nouvelle installation, autorisation retirée) : on le dit.
  const [notificationsCoupees, setNotificationsCoupees] = useState(false);
  useEffect(() => {
    let vivant = true;
    if (!matchMedia("(display-mode: standalone)").matches) return;
    void etatRappels()
      .then((e) => vivant && setNotificationsCoupees(e === "inactifs" || e === "refuses"))
      .catch(ignorer);
    return () => {
      vivant = false;
    };
  }, [props.auDessus]);

  const ouvrirEspace = (id: WidgetId, onglet?: string) => {
    noterUsage("widget", id);
    ouvrir({ nom: "module", id, onglet });
  };

  // ----- Ce que les modules disent d'eux -----
  const apercu = (id: WidgetId) => MODULES[id]!.widget(donnees);
  const courses = apercu("courses");
  const evenements = evenementsDe(donnees.agenda);
  const derniereSauvegarde = lireDerniereSauvegarde();
  // La nuit tombée le soir, la carte montre déjà demain.
  const { montrer } = nuitDeCeTelephone(aujourdhui, maintenant);
  const jourCarte = montrer === "demain" ? decaler(aujourdhui, { unite: "jour", tous: 1 }) : aujourdhui;
  const carte = carteDuJour(
    {
      ...donnees,
      aujourdhui: jourCarte,
      evenements,
      factures: facturesDuJour(donnees.budget, aujourdhui, 1),
      resiliations: resiliationsDuJour(donnees.budget, aujourdhui),
      sauvegardeDue: sauvegardeDue(derniereSauvegarde, aujourdhui) && maintenant.getDay() === 0,
      repartitionDue: repartitionDue(foyer, donnees.taches, aujourdhui, lireDerniereRepartition()),
      dechets: reglageDechets(donnees.maison),
    },
    CHOSES_CARTE,
  );
  // La carte du moment : ce qui attend aujourd'hui ; la nuit tombée, elle montre déjà demain.
  const heure = maintenant.getHours();
  const nuitTombee = montrer === "demain";
  const soir = !nuitTombee && heure >= 17;
  const moment = momentDuJour(carte, soir);
  const hub = composerHub({ foyer, membreId, aujourdhui, maintenant: maintenant.toISOString(), couple: donnees.couple, zones: donnees.zones, meteo: donnees.meteo });

  const cocherChose = async (c: ChoseDuJour) => {
    const avant = donnees.taches.find((t) => t.id === c.tacheId);
    if (!avant) return;
    vibrer();
    const derniere = resteAFaire(carte) === 1;
    const apres = marquerFaite(avant, membreId, aujourdhui, contexteReel);
    await depot.enregistrerTache(apres);
    feteFee();
    if (derniere) sceller(document.querySelector(".page-dessus .grille"));
    noterUsage("tache", avant.id);
    const suite = apres.recurrence ? ` Prochaine fois ${decrireEcheance(apres.echeance, aujourdhui)}.` : "";
    annoncer(`« ${avant.titre} » faite.${suite}`, () => depot.enregistrerTache(avant));
  };
  const toucherChose = (c: Pick<ChoseDuJour, "destination">) => {
    if (c.destination === "sauvegarde") ouvrir({ nom: "sauvegarde" });
    else if (c.destination === "repartition") props.ouvrirRepartition();
    else if (c.destination === "administratif") ouvrirEspace("taches", "administratif");
    else if (c.destination === "taches") ouvrirEspace("taches", "taches");
    else if (c.destination === "agenda") ouvrirEspace("taches", "agenda");
    else if (c.destination === "mitsu" || c.destination === "jardin") ouvrirEspace("maison", c.destination);
    else if (c.destination === "stock") ouvrirEspace("chef", "frigo");
    else if (c.destination === "chef") ouvrirEspace("chef", "semaine");
    else if (c.destination === "maison") ouvrirEspace("maison", "entretien");
    else ouvrirEspace(c.destination);
  };

  // ----- Ce que Tael dit d'elle-même : la nouveauté, la remarque du jour, le clin d'œil -----
  const adaptations = lireAdaptations();
  const appris = bilanDeLaSemaine(calculerApprentissages(donnees));
  const bilanPret = bilanAOuvrir(aujourdhui, lireDernierBilan(), appris.length);
  const remarque = adaptations.remarques ? remarqueDuJour({ ...donnees, membreId }) : null;
  // Ce que la carte du moment montre déjà (une tâche en retard, un produit à finir), elle ne le redit pas.
  const montrerRemarque = remarqueAMontrer(remarque?.cle ?? null, aujourdhui) && !(remarque && dejaSurLaCarte(remarque.cle, moment));
  useClinDuJour({ donnees, depot, jarvis: props.jarvis });
  const clin = clinDuJour(donnees.couple, aujourdhui);
  const nouveaute = nouveauteADire(__VERSION__, lireTexte(CLES.nouveauteVue), donnees.elements.length + donnees.taches.length > 0);
  const aDire = nouveaute ? `nouveaute:${nouveaute.version}` : remarque && montrerRemarque ? `remarque:${remarque.cle}` : clin && !clinDejaDit(aujourdhui) ? `clin:${aujourdhui}` : null;
  const essayerDeDire = useEffectEvent(() => {
    if (!aDire) return;
    if (aDire.startsWith("nouveaute:") && nouveaute) {
      const dit = direSiCalme({ cle: aDire, texte: nouveaute.texte, actions: [{ texte: "Voir", faire: () => ouvrirEspace(nouveaute.ou.id, nouveaute.ou.onglet) }, { texte: "Merci" }] });
      if (dit) ecrireTexte(CLES.nouveauteVue, nouveaute.version);
    } else if (aDire.startsWith("remarque:") && remarque) {
      const module = remarque.module;
      const dit = direSiCalme({ cle: aDire, texte: remarque.texte, actions: module ? [{ texte: "Voir", faire: () => ouvrirEspace(module) }, { texte: "Merci" }] : [{ texte: "Merci" }] });
      if (dit) fermerRemarque(remarque.cle, aujourdhui);
    } else if (clin && direSiCalme({ cle: aDire, texte: clin.texte })) noterClinDit(aujourdhui);
  });
  useEffect(() => {
    if (!aDire || !props.auDessus) return;
    const id = setInterval(essayerDeDire, 2500);
    return () => clearInterval(id);
  }, [aDire, props.auDessus]);
  useEffect(() => {
    if (!props.auDessus) taireFee();
  }, [props.auDessus]);

  // ----- La vie de la fée : sommeil, alertes, l'heure des tâches, le jour J -----
  const agenda = resumeAgenda(evenements, donnees.animaux, aujourdhui);
  useVieFee({
    actif: props.auDessus,
    aujourdhui,
    carte,
    taches: donnees.taches,
    membreId,
    autre: autre?.prenom ?? null,
    couple: donnees.couple,
    meteo: donnees.meteo,
    listes: donnees.listes,
    elements: donnees.elements,
    ouvrir: (destination) => (destination === "courses" ? ouvrirEspace("chef", "courses") : toucherChose({ destination })),
    cocher: (c) => void cocherChose(c),
    repousser: (c) => {
      const t = donnees.taches.find((x) => x.id === c.tacheId);
      if (!t) return;
      sauver(depot.enregistrerTache({ ...t, heure: heureMinute(new Date(Date.now() + 15 * 60_000)) }));
    },
  });

  // ----- Les cartes -----
  const meteoJour = meteoDu(donnees.meteo, aujourdhui);
  const sous = `${dateLongue(maintenant)}${meteoJour ? ` · ${Math.round(meteoJour.max)}° dehors` : ""}`;
  const titreCarte = nuitTombee ? "Demain" : titreMoment(heure);
  const premiere = moment.premiere;
  const quandPremiere = premiere ? (premiere.quand !== "aujourd'hui" ? premiere.quand : (premiere.heure ?? null)) : null;
  const direct = enDirect({ ...donnees, foyer, membreId }, maintenant.toISOString());
  // Demain en une carte : ses rendez-vous, la collecte des déchets, le froid du matin.
  const demainJour = decaler(aujourdhui, { unite: "jour", tous: 1 });
  const meteoDemain = meteoDu(donnees.meteo, demainJour);
  const demain = nuitTombee
    ? null
    : demainDuJour({
        evenements: agenda.semaine.filter((o) => o.debut === demainJour).map((o) => ({ titre: titreDe(o), heure: o.evenement.heure ?? null })),
        dechets: aSortirCeSoir(reglageDechets(donnees.maison), aujourdhui).map(nomDechet),
        meteo: meteoDemain,
        soir,
      });
  // L'Agenda dit la suite de la semaine : aujourd'hui est dans la carte du moment (sauf ce qui
  // ne concerne que l'autre), demain dans sa carte.
  const marques = new Set(occurrences(evenements, decaler(aujourdhui, { unite: "jour", tous: -7 }), decaler(aujourdhui, { unite: "jour", tous: 7 }), donnees.animaux).map((o) => o.debut));
  const suiteSemaine = [...agenda.aujourdhui.filter((o) => o.evenement.pour && o.evenement.pour !== membreId), ...agenda.semaine.filter((o) => o.debut > demainJour)].slice(0, 2);
  const phraseAgenda = suiteSemaine.length
    ? `${suiteSemaine.map((o) => ligneWidget(o, aujourdhui, true)).join(" ; ")}.`
    : `${agenda.aujourdhui.length + agenda.semaine.length ? "Rien d'autre" : "Rien de prévu"} d'ici ${NOMS_JOURS[maintenant.getDay()]} prochain.`;
  const plan = planDe(donnees.budget);
  const aMoi = plan && membreId ? etatAMoi(plan, donnees.budget, membreId, aujourdhui) : null;
  const pots = plan ? etatDesPots(plan, donnees.budget, aujourdhui) : null;
  const filEntrees = filDuFoyer(donnees, maintenant.toISOString());
  const filDuJour = filEntrees.some((e) => aujourdhuiLocal(new Date(e.quand)) === aujourdhui);
  const retard = ligneRetard(foyer, membreId, __VERSION__, maintenant.toISOString());
  // Les petites cartes du bas : la dernière prend toute la largeur quand elles sont en nombre impair.
  const petites = [hub.balcon ? "jardin" : null, bilanPret ? "bilan" : null, props.rappelsNonLus > 0 ? "rappels" : null].filter((c) => c !== null);
  const seule = (carteId: string) => petites.length % 2 === 1 && petites[petites.length - 1] === carteId;
  const majuscule = (n: number) => enLettres(n).replace(/^./, (c) => c.toUpperCase());

  let i = 0;
  return (
    <main className="page espace aujourdhui">
      <EnteteEspace titre={`${salutation(heure)}${moi ? ` ${moi.prenom}` : ""}`} sous={sous} />

      <CarteDemarrage
        foyer={foyer}
        membreId={membreId}
        partageActif={props.partageActif}
        taches={donnees.taches}
        ouvrir={(ou) => (ou === "taches" ? ouvrirEspace("taches", "taches") : ouvrir({ nom: ou }))}
      />

      <Grille label="Aujourd'hui">
        {/* Le mot de l'autre a sa carte plus bas : Tael ne le redit pas dans la sienne. */}
        <CarteTael vol sansMot={!!hub.mot && !!autre} />

        <Tuile className={`moment${premiere ? "" : " calme"}`} forte={!!premiere} large i={i++} role="group" widget={premiere ? premiere.destination : moment.menu ? "chef" : "taches"} touche="taches" label={`${titreCarte} : ${premiere?.texte ?? moment.menu ?? "rien ne presse"}`}>
          <div className="moment-haut">
            <p className="etiq">{titreCarte}</p>
            {premiere ? quandPremiere && <span className="moment-quand">{quandPremiere}</span> : moment.menu && <span className="moment-quand">menu du Chef</span>}
          </div>
          <button type="button" className="moment-titre" onClick={() => (premiere ? toucherChose(premiere) : moment.menu ? ouvrirEspace("chef", "semaine") : ouvrirEspace("taches", "taches"))}>
            {premiere?.texte ?? moment.menu ?? (moment.faites ? `Tout est fait.${heure >= 17 ? " Belle soirée." : ""}` : "Rien de prévu, rien ne presse.")}
          </button>
          {premiere && (
            <div className="actions-c">
              {premiere.tacheId ? (
                <>
                  <button type="button" className="pilule pleine" onClick={(e) => soufflerPuis(e.currentTarget.closest<HTMLElement>(".tuile"), () => void cocherChose(premiere))}>C'est fait</button>
                  <button type="button" className="pilule" onClick={() => setHeureDe(donnees.taches.find((t) => t.id === premiere.tacheId) ?? null)}>Plus tard</button>
                </>
              ) : (
                <button type="button" className="pilule pleine" onClick={() => toucherChose(premiere)}>Ouvrir</button>
              )}
            </div>
          )}
          {!premiere && moment.faites > 0 && (
            <p className="moment-fait"><Coche />{majuscule(moment.faites)} chose{moment.faites > 1 ? "s" : ""} faite{moment.faites > 1 ? "s" : ""} aujourd'hui{moment.menu ? ", plus rien à faire" : ""}.</p>
          )}
          {moment.ensuite.length > 0 && (
            <div className="moment-suite">
              {premiere && <p className="etiq">Ensuite</p>}
              <div className="lignes">
                {moment.ensuite.map((c) =>
                  c.tacheId ? (
                    <LigneCoche key={c.cle} coche={false} texte={c.texte} heure={c.heure} fin={c.etat === "urgent" ? c.quand : null} onClick={() => void cocherChose(c)} />
                  ) : (
                    <button key={c.cle} type="button" className="li" onClick={() => toucherChose(c)}>
                      <span className="li-point" aria-hidden />
                      <span className="li-texte">{c.texte}</span>
                      <small>{c.quand}</small>
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
          {moment.autres > 0 && (
            <button type="button" className="moment-autres" onClick={() => ouvrirEspace("taches", "taches")}>Et {enLettres(moment.autres)} autre{moment.autres > 1 ? "s" : ""}</button>
          )}
        </Tuile>

        <Tuile large={!plan} i={i++} widget="courses" onClick={() => ouvrirEspace("chef", "courses")} label={`Courses : ${courses.chiffre} ${courses.legende}`}>
          <p className="etiq"><Icone nom="panier" taille={18} />Courses</p>
          <p className="phrase">
            {courses.chiffre === 0 ? "Rien à acheter." : direct ? <>{direct.qui} finit les courses, il reste <b>{enLettres(courses.chiffre)}</b> chose{courses.chiffre > 1 ? "s" : ""}.</> : <><b>{majuscule(courses.chiffre)}</b> chose{courses.chiffre > 1 ? "s" : ""} à prendre.</>}
          </p>
          {direct && <p className="pastille-k"><b className="navi direct">en direct</b></p>}
        </Tuile>

        {plan && (
          <Tuile i={i++} widget="budget" onClick={() => ouvrirEspace("budget")} label={aMoi ? `À toi ce mois : ${formaterMontant(aMoi.reste)}` : `Budget : ${formaterMontant(pots!.courses.solde)} sur la carte courses`}>
            <p className="etiq"><Icone nom="portefeuille" taille={18} />{aMoi ? "À toi ce mois" : "Carte courses"}</p>
            <p className="grand-chiffre">
              {formaterMontant(Math.max(0, Math.round(aMoi ? (aMoi.suivi ? aMoi.reste : aMoi.prevu) : pots!.courses.solde)), false)}<small>CHF</small>
            </p>
            {aMoi?.ecartMoisPrecedent !== null && aMoi?.ecartMoisPrecedent !== undefined && (
              <p className="pastille-k"><b>{aMoi.ecartMoisPrecedent > 0 ? "+" : ""}{Math.round(aMoi.ecartMoisPrecedent)}</b> vs le mois d'avant</p>
            )}
          </Tuile>
        )}

        <Tuile large i={i++} widget="agenda" onClick={() => ouvrirEspace("taches", "agenda")} label={`Agenda : ${phraseAgenda}`}>
          <p className="etiq"><Icone nom="calendrier" taille={18} />Agenda</p>
          <Jours aujourdhui={aujourdhui} marques={marques} />
          <p className="phrase">{phraseAgenda}</p>
        </Tuile>

        {demain && (
          <Tuile contraste large i={i++} onClick={() => ouvrirEspace("taches", "agenda")} label={`Demain : ${demain.titre}`}>
            <p className="etiq">Demain</p>
            <p className="titre-c">{demain.titre}</p>
            {demain.suite && <p className="doux">{demain.suite}</p>}
          </Tuile>
        )}

        {hub.mot && autre && (
          <Tuile className="mot" large i={i++} role="group" label={`Mot de ${autre.prenom}`}>
            <p className="etiq"><Icone nom="coeur" taille={18} />{hub.mot.titre.replace(/^De /, "")}</p>
            <q>{hub.mot.mot.texte}</q>
            <div className="actions-c">
              {!hub.mot.coeurDonne && membreId && (
                <button type="button" className="pilule" onClick={() => { vibrer(); sauver(depot.enregistrerCouple(basculerCoeur(hub.mot!.mot, membreId))); }}>Un cœur</button>
              )}
              <button type="button" className="pilule" onClick={() => ouvrir({ nom: "mots" })}>Répondre</button>
            </div>
          </Tuile>
        )}

        <Tuile large i={i++} widget="fil" onClick={() => ouvrir({ nom: "fil" })} label="Chez nous, cette semaine">
          <p className="etiq"><Icone nom="activite" taille={18} />Chez nous{filDuJour ? ", aujourd'hui" : ", ces sept jours"}</p>
          <p className="doux fil-c">
            {retard ? `${retard}. ` : ""}
            {filEntrees.length === 0 ? "Ce que chacun fait, au fil des jours : rien encore." : ""}
            {filEntrees.slice(0, 2).map((e) => gesteDit(e, foyer, membreId)).map((g) => `${g.qui} ${g.texte}`).join(". ")}
            {filEntrees.length ? "." : ""}
          </p>
        </Tuile>

        {hub.balcon && (
          <Tuile large={seule("jardin")} i={i++} widget="jardin" onClick={() => ouvrirEspace("maison", "jardin")} label={`Jardin : ${hub.balcon.geste}`}>
            <p className="etiq"><Icone nom="feuille" taille={18} />Jardin</p>
            <div className="meteo-c">
              {hub.balcon.nuit && <span className="deg">{hub.balcon.nuit}</span>}
              <p className="doux">{hub.balcon.geste}</p>
            </div>
          </Tuile>
        )}

        {bilanPret && (
          <Tuile large={seule("bilan")} i={i++} onClick={() => ouvrir({ nom: "bilan" })} label="Bilan de la semaine">
            <p className="etiq"><Icone nom="appris" taille={18} />Bilan</p>
            <p className="phrase">{appris.length === 1 ? "Une chose apprise, à garder ou non." : `${majuscule(appris.length)} choses apprises, à garder ou non.`}</p>
          </Tuile>
        )}

        {props.rappelsNonLus > 0 && (
          <Tuile large={seule("rappels")} i={i++} onClick={() => ouvrir({ nom: "rappels" })} label={`Rappels, ${props.rappelsNonLus} nouveaux`}>
            <p className="etiq"><Icone nom="cloche" taille={18} />Rappels</p>
            <p className="phrase"><b>{majuscule(props.rappelsNonLus)}</b> envoyé{props.rappelsNonLus > 1 ? "s" : ""} par Kora, pas encore relu{props.rappelsNonLus > 1 ? "s" : ""}.</p>
          </Tuile>
        )}
      </Grille>

      {/* Le partage et la sauvegarde vivent dans Réglages : ici seulement quand il y a un souci. */}
      <footer className="pied-espace">
        {(props.partage.ton === "urgent" || props.partage.horsLigne) && (
          <button type="button" className={`etat-pied ${props.partage.ton}`} onClick={() => ouvrir({ nom: "partage" })}>
            <span className={`point-etat ${props.partage.ton}`} aria-hidden />
            {props.partage.texte}
          </button>
        )}
        {notificationsCoupees && (
          <button type="button" className="etat-pied urgent" onClick={() => ouvrir({ nom: "notifications" })}>
            <span className="point-etat urgent" aria-hidden />
            Notifications coupées sur ce téléphone
          </button>
        )}
        {props.synchroniser && <BoutonSynchro synchroniser={props.synchroniser} />}
        {sauvegardeDue(derniereSauvegarde, aujourdhui) && (
          <button type="button" className="etat-pied" onClick={() => ouvrir({ nom: "sauvegarde" })}>
            <Icone nom="sauvegarde" taille={15} />
            Sauvegarde : {decrireDerniere(derniereSauvegarde, aujourdhui)}
          </button>
        )}
        <button type="button" className="etat-pied" onClick={ecrireAFee}>Écrire à {moi ? "ta fée" : "la fée"}</button>
      </footer>

      <FeuilleHeure
        tache={heureDe}
        fermer={() => setHeureDe(null)}
        enregistrer={(t) => {
          setHeureDe(t);
          sauver(depot.enregistrerTache(t));
        }}
      />

      {props.auDessus && <RechercheFee donnees={donnees} aller={props.aller} ouvrirModule={(id) => ouvrirEspace(id)} />}
    </main>
  );
}

/** « Synchroniser » : la synchro passe déjà seule, mais on peut la demander d'un toucher. */
function BoutonSynchro({ synchroniser }: { synchroniser: () => Promise<void> }) {
  const [enCours, setEnCours] = useState(false);
  const lancer = async () => {
    if (enCours) return;
    vibrer();
    setEnCours(true);
    try {
      await Promise.all([synchroniser().catch(ignorer), new Promise((r) => setTimeout(r, 600))]);
    } finally {
      setEnCours(false);
    }
  };
  return (
    <button type="button" className={`etat-pied${enCours ? " en-cours" : ""}`} onClick={() => void lancer()} disabled={enCours}>
      <Icone nom="actualiser" taille={15} />
      {enCours ? "Synchronisation…" : "Synchroniser"}
    </button>
  );
}
